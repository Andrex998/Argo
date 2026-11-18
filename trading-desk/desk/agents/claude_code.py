"""The analysts through Claude Code: the owner's Claude subscription, no API key.

`ClaudeCodeLLM` answers like `ClaudeLLM`, one structured report per question, by running
the Claude Code command line in print mode on the owner's PC. Each question is a fresh
session that is never saved. It has web search only when the analyst needs it (News,
Sentiment) and no tools at all otherwise. MCP servers, plugins, hooks and the user's
settings are not loaded, and the answer must match the report's JSON schema.

The subscription is shared with the owner's own use of Claude, so the desk caps how many
markets the analysts discuss per hour and per day (`analyst_max_per_hour`, `..._per_day`).
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from pydantic import BaseModel, ValidationError

from desk.agents.llm import AgentUnavailable, Effort, T, Usage
from desk.config import Settings

Runner = Callable[..., subprocess.CompletedProcess]

# Where `npm install -g @anthropic-ai/claude-code` puts the native program on Windows.
WINDOWS_NPM = Path("npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe")
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW: never flash a console on the office PC
MAX_TURNS = {False: 3, True: 8}  # a researching analyst needs a few turns for its searches
SEARCH_TOOL = "WebSearch"


def find_claude(cfg: Settings) -> Path | None:
    """The Claude Code program: the configured path, then PATH, then npm's folder."""
    candidates = [cfg.claude_code_path] if cfg.claude_code_path else []
    candidates += [shutil.which("claude") or ""]
    if appdata := os.environ.get("APPDATA"):
        candidates.append(str(Path(appdata) / WINDOWS_NPM))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    return None


def clean_env() -> dict[str, str]:
    """This process's environment without the variables that would replace the owner's
    subscription login with a key, or point the program at another session."""
    return {k: v for k, v in os.environ.items() if not re.match(r"^(ANTHROPIC_|CLAUDE)", k)}


def _json_object(text: str) -> dict:
    """The JSON object in a model's answer, with or without a ```json fence around it."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    return json.loads(text)


class ClaudeCodeLLM:
    def __init__(
        self,
        cfg: Settings,
        on_usage: Callable[[Usage], None] | None = None,
        run: Runner = subprocess.run,
    ):
        self.cfg = cfg
        self.on_usage = on_usage
        self.run = run
        self.program = find_claude(cfg)
        if self.program is None:
            raise AgentUnavailable(
                "Claude Code non trovato: installalo o indica DESK_CLAUDE_CODE_PATH"
            )
        # An empty folder of its own: no project settings, no files the model could read.
        self.workdir = cfg.data_dir / "analysts"
        self.workdir.mkdir(parents=True, exist_ok=True)

    def command(self, system: str, prompt: str, schema: type[BaseModel], web_search: bool):
        tools = SEARCH_TOOL if web_search else ""
        command = [
            str(self.program),
            "-p",
            prompt,
            "--output-format",
            "json",
            "--json-schema",
            json.dumps(schema.model_json_schema(), ensure_ascii=False),
            "--system-prompt",
            system,
            "--model",
            self.cfg.claude_code_model,
            "--tools",
            tools,
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--no-session-persistence",
            "--setting-sources",
            "project",  # the empty working folder: none of the owner's hooks or plugins
            "--max-turns",
            str(MAX_TURNS[web_search]),
        ]
        if web_search:
            command += ["--allowedTools", SEARCH_TOOL]
        return command

    def ask(
        self,
        system: str,
        prompt: str,
        schema: type[T],
        *,
        effort: Effort = "medium",
        web_search: bool = False,
    ) -> T:
        extra = {"creationflags": NO_WINDOW} if sys.platform == "win32" else {}
        try:
            done = self.run(
                self.command(system, prompt, schema, web_search),
                cwd=self.workdir,
                env=clean_env(),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.cfg.claude_code_timeout,
                **extra,
            )
        except FileNotFoundError as e:
            raise AgentUnavailable(f"Claude Code non avviabile: {e}") from e
        except subprocess.TimeoutExpired as e:
            raise AgentUnavailable(
                f"Claude Code non ha risposto in {self.cfg.claude_code_timeout:.0f} s"
            ) from e
        answer = self._answer(done)
        self._record(answer, web_search)
        payload = answer.get("structured_output")
        try:
            if payload is None:
                payload = _json_object(str(answer.get("result") or ""))
            return schema.model_validate(payload)
        except (ValueError, ValidationError) as e:
            raise AgentUnavailable(f"risposta non interpretabile: {str(e)[:200]}") from e

    def _answer(self, done: subprocess.CompletedProcess) -> dict:
        """Claude Code's JSON report of the run; an error, a usage limit or a refusal
        becomes AgentUnavailable, which the desk treats as 'no trade'."""
        answer = None
        for line in reversed((done.stdout or "").strip().splitlines()):
            try:
                answer = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
        if not isinstance(answer, dict):
            detail = (done.stderr or done.stdout or "").strip()[-300:]
            raise AgentUnavailable(
                f"Claude Code non ha risposto (codice {done.returncode}): {detail}"
            )
        if answer.get("is_error") or answer.get("api_error_status"):
            why = answer.get("result") or answer.get("subtype") or answer.get("api_error_status")
            raise AgentUnavailable(f"Claude Code: {str(why)[:300]}")
        return answer

    def _record(self, answer: dict, web_search: bool) -> None:
        if not self.on_usage:
            return
        usage = answer.get("usage") or {}
        tool_use = usage.get("server_tool_use") or {}
        self.on_usage(
            Usage(
                input_tokens=int(usage.get("input_tokens") or 0),
                output_tokens=int(usage.get("output_tokens") or 0),
                searches=int(tool_use.get("web_search_requests") or 0) if web_search else 0,
                cost=float(answer.get("total_cost_usd") or 0.0),  # what the run would cost
            )
        )
