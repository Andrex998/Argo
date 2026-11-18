"""The analysts through Claude Code: the owner's Claude subscription, no API key.

`ClaudeCodeLLM` answers like `ClaudeLLM`, one structured report per question, by running
the Claude Code command line in print mode on the owner's PC. Each question is a fresh
session that is never saved, run in an empty folder outside the desk's own. It has web
search only when the analyst needs it (News, Sentiment) and no tools at all otherwise.
MCP servers, plugins (those synced from claude.ai included), hooks, slash commands and the
user's settings are not loaded, and the answer must match the report's JSON schema.

Only the native program is ever started. On Windows npm also installs claude.cmd and
claude.ps1, which run through cmd.exe or PowerShell: cmd.exe cuts the prompt at its first
line break, dropping every flag after it, and reads & | < > in it as commands, and the
prompt carries text from the web. So on Windows only a .exe will do. A question that runs
too long is stopped with every process it started.

The subscription is shared with the owner's own use of Claude, so the desk caps how many
markets the analysts discuss per hour and per day (`analyst_max_per_hour`, `..._per_day`).
"""

from __future__ import annotations

import contextlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path

from pydantic import BaseModel, ValidationError

from desk.agents.llm import AgentUnavailable, Effort, T, Usage
from desk.config import Settings

Runner = Callable[..., subprocess.CompletedProcess]

WINDOWS = sys.platform == "win32"
# Where `npm install -g @anthropic-ai/claude-code` puts the native program on Windows.
WINDOWS_NPM = Path("npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe")
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW: never flash a console on the office PC
SEARCH_TOOL = "WebSearch"
# --setting-sources does not reach these: no hooks at all, no plugins synced from claude.ai.
CONTAINED = json.dumps({"disableAllHooks": True, "syncClaudeAiPlugins": False})
PIPES_WAIT = 5.0  # seconds to wait for the output once a stopped program is gone
ERROR_FILE = "analysts-last-error.txt"  # in the data folder: raw output stays on the PC


def find_claude(cfg: Settings) -> Path:
    """The native Claude Code program: the configured path, then where the npm package and
    the native installer put it, then PATH. On Windows only a .exe, never one of npm's
    shims. Raises AgentUnavailable, saying why, when there is none."""
    if cfg.claude_code_path:
        configured = Path(cfg.claude_code_path).expanduser()
        if WINDOWS and configured.suffix.lower() != ".exe":
            raise AgentUnavailable(
                f"DESK_CLAUDE_CODE_PATH deve indicare claude.exe, non {configured.name}: "
                "i file .cmd, .bat e .ps1 passano da cmd.exe o PowerShell"
            )
        if not configured.is_file():
            raise AgentUnavailable(f"Claude Code non trovato in {configured}")
        return configured
    if WINDOWS:
        appdata = os.environ.get("APPDATA")
        places = [str(Path(appdata) / WINDOWS_NPM)] if appdata else []
        places += [str(Path.home() / ".local/bin/claude.exe"), shutil.which("claude.exe") or ""]
    else:
        places = [str(Path.home() / ".local/bin/claude"), shutil.which("claude") or ""]
    for place in places:
        found = Path(place)
        if place and found.is_file() and (not WINDOWS or found.suffix.lower() == ".exe"):
            return found
    shim = shutil.which("claude") if WINDOWS else None
    only = f" (c'è solo {Path(shim).name}, che non va bene: serve claude.exe)" if shim else ""
    raise AgentUnavailable(
        f"Claude Code non trovato{only}: installalo o indica DESK_CLAUDE_CODE_PATH"
    )


def default_workdir() -> Path:
    """An empty folder of the analysts' own, outside the desk's folder and any project:
    no project settings, no CLAUDE.md and no files near it for the program to pick up."""
    if WINDOWS:
        base = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
    else:
        base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base) / "argo-desk" / "analysts"


def clean_env() -> dict[str, str]:
    """This process's environment without the variables that would replace the owner's
    subscription login with a key, or point the program at another session."""
    return {k: v for k, v in os.environ.items() if not re.match(r"^(ANTHROPIC_|CLAUDE)", k)}


def run_program(
    command: list[str], *, cwd: Path, env: dict[str, str], timeout: float
) -> subprocess.CompletedProcess:
    """Run a program with no window and nothing on its input. When it runs past `timeout`,
    stop it together with every process it started, and never wait without limit for
    output that one of them may still hold open."""
    flags = {"creationflags": NO_WINDOW} if WINDOWS else {"start_new_session": True}
    proc = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        **flags,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill_tree(proc)
        with contextlib.suppress(subprocess.TimeoutExpired):
            proc.communicate(timeout=PIPES_WAIT)
        raise subprocess.TimeoutExpired(command[:1], timeout) from None
    return subprocess.CompletedProcess(command, proc.returncode, out, err)


def kill_tree(proc: subprocess.Popen) -> None:
    """Stop `proc` and everything it started."""
    if WINDOWS:
        with contextlib.suppress(OSError, subprocess.SubprocessError):
            subprocess.run(
                ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                capture_output=True,
                timeout=15,
                creationflags=NO_WINDOW,
            )
    else:
        with contextlib.suppress(OSError):
            os.killpg(proc.pid, signal.SIGKILL)  # its own session: the whole group
    with contextlib.suppress(OSError):
        proc.kill()


def _no_constant(name: str) -> float:
    raise ValueError(f"valore non ammesso: {name}")


def _json_object(text: str) -> dict:
    """The JSON object in a model's answer, with or without a ```json fence around it.
    NaN and Infinity are refused: they would slip past every numeric check."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    return json.loads(text, parse_constant=_no_constant)


def scrub(text: str, limit: int = 160) -> str:
    """An error as it may appear in the journal and on the live page: short, with no
    e-mail address and no path under the user's home."""
    text = re.sub(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", "<e-mail>", str(text))
    home = str(Path.home())
    text = text.replace(home, "~") if len(home) > 1 else text
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


class ClaudeCodeLLM:
    def __init__(
        self,
        cfg: Settings,
        on_usage: Callable[[Usage], None] | None = None,
        run: Runner = run_program,
        workdir: Path | None = None,
    ):
        self.cfg = cfg
        self.on_usage = on_usage
        self.run = run
        self.program = find_claude(cfg)
        self.workdir = workdir or default_workdir()
        self.workdir.mkdir(parents=True, exist_ok=True)

    def command(self, system: str, prompt: str, schema: type[BaseModel], web_search: bool):
        if web_search:
            system += f"\n\nUse at most {self.cfg.max_searches} web searches."
        # A researching analyst needs a turn per search, one for the report, one to end.
        turns = self.cfg.max_searches + 3 if web_search else 3
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
            SEARCH_TOOL if web_search else "",
            "--settings",
            CONTAINED,
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--no-session-persistence",
            "--setting-sources",
            "project",  # the empty working folder: none of the owner's settings
            "--max-turns",
            str(turns),
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
        command = self.command(system, prompt, schema, web_search)
        try:
            done = self.run(
                command, cwd=self.workdir, env=clean_env(), timeout=self.cfg.claude_code_timeout
            )
        except subprocess.TimeoutExpired as e:
            raise AgentUnavailable(
                f"Claude Code non ha risposto in {self.cfg.claude_code_timeout:.0f} s"
            ) from e
        except OSError as e:  # not there, not a program (WinError 193), not allowed
            raise AgentUnavailable(f"Claude Code non avviabile: {scrub(e)}") from e
        answer = self._answer(done)
        self._record(answer, web_search)
        payload = answer.get("structured_output")
        try:
            if payload is None:
                payload = _json_object(str(answer.get("result") or ""))
            return schema.model_validate(payload)
        except (ValueError, ValidationError) as e:
            raise AgentUnavailable(f"risposta non interpretabile: {scrub(e)}") from e

    def _answer(self, done: subprocess.CompletedProcess) -> dict:
        """Claude Code's JSON report of the run; an error, a usage limit or a refusal
        becomes AgentUnavailable, which the desk treats as 'no trade'. The raw output of a
        failed run is kept in the data folder, not in the journal."""
        answer = None
        for line in reversed((done.stdout or "").strip().splitlines()):
            try:
                answer = json.loads(line, parse_constant=_no_constant)
                break
            except ValueError:
                continue
        if not isinstance(answer, dict):
            self._keep(done.stdout, done.stderr)
            raise AgentUnavailable(
                f"Claude Code non ha risposto (codice {done.returncode}): dettagli in {ERROR_FILE}"
            )
        if answer.get("is_error") or answer.get("api_error_status"):
            self._keep(done.stdout, done.stderr)
            why = answer.get("result") or answer.get("subtype") or answer.get("api_error_status")
            raise AgentUnavailable(f"Claude Code: {scrub(why)}")
        return answer

    def _keep(self, stdout: str | None, stderr: str | None) -> None:
        """Keep the raw output of the last failed run, for whoever looks into it on the PC."""
        with contextlib.suppress(OSError):
            path = self.cfg.data_dir / ERROR_FILE
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"stdout:\n{stdout or ''}\n\nstderr:\n{stderr or ''}\n", "utf-8")

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
