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
import ctypes
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
KILL_ON_JOB_CLOSE = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
EXTENDED_LIMIT_INFORMATION = 9  # JobObjectExtendedLimitInformation


class _BasicLimits(ctypes.Structure):
    """JOBOBJECT_BASIC_LIMIT_INFORMATION, with sizes fixed so it reads the same anywhere."""

    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", ctypes.c_uint32),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", ctypes.c_uint32),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", ctypes.c_uint32),
        ("SchedulingClass", ctypes.c_uint32),
    ]


class _JobLimits(ctypes.Structure):
    """JOBOBJECT_EXTENDED_LIMIT_INFORMATION (144 bytes on 64-bit Windows)."""

    _fields_ = [
        ("BasicLimitInformation", _BasicLimits),
        ("IoInfo", ctypes.c_uint64 * 6),  # IO_COUNTERS
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


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
        places += [str(Path.home() / ".local/bin/claude.exe"), _on_path("claude.exe")]
    else:
        places = [str(Path.home() / ".local/bin/claude"), _on_path("claude")]
    for place in places:
        found = Path(place)
        if place and found.is_file() and (not WINDOWS or found.suffix.lower() == ".exe"):
            return found
    shim = shutil.which("claude") if WINDOWS else None
    only = f" (c'è solo {Path(shim).name}, che non va bene: serve claude.exe)" if shim else ""
    raise AgentUnavailable(
        f"Claude Code non trovato{only}: installalo o indica DESK_CLAUDE_CODE_PATH"
    )


def _on_path(name: str) -> str:
    """`name` found on PATH, but never in the current folder, the desk's own, which Windows
    searches first: a program dropped there would be started instead."""
    found = shutil.which(name)
    if not found:
        return ""
    with contextlib.suppress(OSError):
        if Path(found).resolve().parent == Path.cwd().resolve():
            return ""
    return found


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
    proc = subprocess.Popen(  # noqa: S603 - a list of arguments, no shell
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
    job = _job_for(proc)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill_tree(proc, job)
        job = None
        with contextlib.suppress(subprocess.TimeoutExpired):
            proc.communicate(timeout=PIPES_WAIT)
        raise subprocess.TimeoutExpired(command[:1], timeout) from None
    finally:
        _end_job(job, terminate=False)  # what the program left running goes with it
    return subprocess.CompletedProcess(command, proc.returncode, out, err)


def kill_tree(proc: subprocess.Popen, job: int | None = None) -> None:
    """Stop `proc` and everything it started. On Windows the job object holds exactly
    those processes; without one, taskkill follows the parent of each process."""
    if _end_job(job, terminate=True):
        pass
    elif WINDOWS:
        system = Path(os.environ.get("SYSTEMROOT") or r"C:\Windows") / "System32"
        with contextlib.suppress(OSError, subprocess.SubprocessError):
            subprocess.run(  # noqa: S603 - Windows' own taskkill, by its full path
                [str(system / "taskkill.exe"), "/PID", str(proc.pid), "/T", "/F"],
                capture_output=True,
                timeout=15,
                creationflags=NO_WINDOW,
            )
    else:
        with contextlib.suppress(OSError):
            os.killpg(proc.pid, signal.SIGKILL)  # its own session: the whole group
    with contextlib.suppress(OSError):
        proc.kill()


def _kernel32():
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)  # type: ignore[attr-defined]
    handle = ctypes.c_void_p
    for name, args in (
        ("CreateJobObjectW", [handle, ctypes.c_wchar_p]),
        ("SetInformationJobObject", [handle, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]),
        ("AssignProcessToJobObject", [handle, handle]),
        ("TerminateJobObject", [handle, ctypes.c_uint32]),
        ("CloseHandle", [handle]),
    ):
        getattr(kernel32, name).argtypes = args
        getattr(kernel32, name).restype = handle if name == "CreateJobObjectW" else ctypes.c_int
    return kernel32


def _job_for(proc: subprocess.Popen) -> int | None:
    """A Windows job object holding the program: stopping or closing the job stops every
    process it started, and only those. None elsewhere, or if Windows refuses one."""
    if not WINDOWS:
        return None
    try:
        kernel32 = _kernel32()
        job = kernel32.CreateJobObjectW(None, None)
        if not job:
            return None
        limits = _JobLimits()
        limits.BasicLimitInformation.LimitFlags = KILL_ON_JOB_CLOSE
        size = ctypes.sizeof(limits)
        if kernel32.SetInformationJobObject(
            job, EXTENDED_LIMIT_INFORMATION, ctypes.byref(limits), size
        ) and kernel32.AssignProcessToJobObject(job, int(proc._handle)):  # type: ignore[attr-defined]
            return job
        kernel32.CloseHandle(job)
    except (OSError, AttributeError, TypeError, ValueError):
        pass
    return None


def _end_job(job: int | None, *, terminate: bool) -> bool:
    """Close the job, which stops whatever is still in it; with `terminate`, stop it all
    first and say whether Windows did."""
    if job is None:
        return False
    try:
        kernel32 = _kernel32()
        stopped = bool(kernel32.TerminateJobObject(job, 1)) if terminate else True
        kernel32.CloseHandle(job)
        return stopped
    except (OSError, AttributeError):
        return False


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
    e-mail address and no user's folder, however it is written."""
    text = re.sub(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", "<e-mail>", str(text))
    home = str(Path.home())
    if len(home) > 3:
        for form in {home, home.replace("\\", "/"), home.replace("/", "\\")}:
            text = re.sub(re.escape(form), "~", text, flags=re.IGNORECASE)
    text = re.sub(r"(?i)(?<![\w.])(?:[a-z]:)?[\\/](?:users|home)[\\/][^\\/\s]+", "~", text)
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
        try:
            self.workdir.mkdir(parents=True, exist_ok=True)
            found = sorted(entry.name for entry in self.workdir.iterdir())
        except OSError as e:
            raise AgentUnavailable(f"cartella degli analisti non utilizzabile: {scrub(e)}") from e
        if found:  # a CLAUDE.md or a .claude there would be read as instructions
            raise AgentUnavailable(
                f"la cartella degli analisti ({scrub(str(self.workdir), 120)}) deve restare "
                f"vuota, invece contiene: {', '.join(found[:5])}"
            )

    def command(self, system: str, prompt: str, schema: type[BaseModel], web_search: bool):
        if web_search:
            system += f"\n\nUse at most {self.cfg.max_searches} web searches."
        # A NUL in text from the web would stop the program from starting at all.
        prompt, system = prompt.replace("\x00", ""), system.replace("\x00", "")
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
            "",  # no settings file at all: not the owner's, not a folder's
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
        except (OSError, ValueError) as e:  # not there, not a program (WinError 193), a NUL
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
        """Count the run's tokens and searches. Figures it cannot read are left out: the
        report itself is what matters."""
        if not self.on_usage:
            return
        try:
            usage = answer.get("usage") or {}
            tool_use = usage.get("server_tool_use") or {}
            searches = int(tool_use.get("web_search_requests") or 0) if web_search else 0
            spent = Usage(
                input_tokens=int(usage.get("input_tokens") or 0),
                output_tokens=int(usage.get("output_tokens") or 0),
                searches=searches,
                cost=float(answer.get("total_cost_usd") or 0.0),  # what the run would cost
            )
        except (AttributeError, TypeError, ValueError):
            return
        self.on_usage(spent)
