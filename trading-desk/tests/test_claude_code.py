"""The analysts through Claude Code, on the owner's subscription: the command, the answer,
the failures, and the hourly and daily cap."""

import argparse
import json
import subprocess

import pytest

from desk import cli
from desk.agents.claude_code import ClaudeCodeLLM
from desk.agents.llm import AgentUnavailable
from desk.config import Settings
from desk.models import NewsReport
from tests.conftest import breakout
from tests.test_desk import NEWS, SYMBOL, journal, llm, make_desk


class Runner:
    """Stands in for subprocess.run: records the call, answers with prepared output."""

    def __init__(self, answer=None, *, raises=None, stdout=None):
        self.answer = answer
        self.raises = raises
        self.stdout = stdout
        self.calls = []

    def __call__(self, command, **kwargs):
        self.calls.append((command, kwargs))
        if self.raises:
            raise self.raises
        out = self.stdout if self.stdout is not None else json.dumps(self.answer)
        return subprocess.CompletedProcess(command, 0, stdout=out, stderr="")


@pytest.fixture
def program(tmp_path):
    exe = tmp_path / "claude.exe"
    exe.write_text("")
    return exe


def settings(tmp_path, program, **overrides):
    return Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        analysts="claude-code",
        claude_code_path=str(program),
        **overrides,
    )


def ok(payload, **extra):
    return {"type": "result", "is_error": False, "structured_output": payload, **extra}


def test_a_structured_answer_becomes_the_report(tmp_path, program, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-should-not-pass")
    monkeypatch.setenv("CLAUDE_CODE_ENTRYPOINT", "cli")
    usage = []
    run = Runner(ok(NEWS.model_dump(), total_cost_usd=0.11, usage={"input_tokens": 900}))
    model = ClaudeCodeLLM(settings(tmp_path, program), on_usage=usage.append, run=run)
    report = model.ask("Sei l'analista News.", "Market: SOL/USD", NewsReport, web_search=True)
    assert report == NEWS
    [(command, kwargs)] = run.calls
    assert command[:3] == [str(program), "-p", "Market: SOL/USD"]
    for flag in ("--strict-mcp-config", "--no-session-persistence", "--disable-slash-commands"):
        assert flag in command
    assert command[command.index("--tools") + 1] == "WebSearch"
    assert command[command.index("--allowedTools") + 1] == "WebSearch"
    assert command[command.index("--system-prompt") + 1] == "Sei l'analista News."
    assert json.loads(command[command.index("--json-schema") + 1])["title"] == "NewsReport"
    assert kwargs["cwd"] == tmp_path / "data" / "analysts"
    assert not any(k.startswith(("ANTHROPIC_", "CLAUDE")) for k in kwargs["env"])  # the login
    assert usage[0].cost == pytest.approx(0.11) and usage[0].input_tokens == 900


def test_an_analyst_without_research_gets_no_tools_at_all(tmp_path, program):
    run = Runner(ok(NEWS.model_dump()))
    ClaudeCodeLLM(settings(tmp_path, program), run=run).ask("s", "p", NewsReport)
    [(command, _)] = run.calls
    assert command[command.index("--tools") + 1] == ""
    assert "--allowedTools" not in command


def test_an_answer_in_plain_text_is_read_too(tmp_path, program):
    text = "Ecco il report:\n```json\n" + json.dumps(NEWS.model_dump()) + "\n```"
    run = Runner({"type": "result", "is_error": False, "result": text})
    assert ClaudeCodeLLM(settings(tmp_path, program), run=run).ask("s", "p", NewsReport) == NEWS


@pytest.mark.parametrize(
    ("runner", "said"),
    [
        (Runner({"is_error": True, "result": "Usage limit reached"}), "Usage limit"),
        (Runner({"is_error": False, "api_error_status": 429, "result": "x"}), "Claude Code"),
        (Runner(raises=subprocess.TimeoutExpired("claude", 180)), "non ha risposto in 180"),
        (Runner(stdout="non è JSON"), "non ha risposto"),
        (Runner({"is_error": False, "result": "nessun json qui"}), "non interpretabile"),
        (Runner(ok({"catalyst_found": True})), "non interpretabile"),
    ],
)
def test_every_failure_means_no_trade(tmp_path, program, runner, said):
    model = ClaudeCodeLLM(settings(tmp_path, program), run=runner)
    with pytest.raises(AgentUnavailable, match=said):
        model.ask("s", "p", NewsReport)


def test_without_claude_code_the_launcher_falls_back_to_rules(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("PATH", str(tmp_path))  # no claude on PATH
    monkeypatch.setenv("APPDATA", str(tmp_path))  # nor in npm's folder
    cfg = Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        analysts="claude-code",
        claude_code_path=str(tmp_path / "missing.exe"),
    )
    desk = cli.trading_desk(cfg, argparse.Namespace(rules_only=False, rules_if_no_key=True))
    assert desk.llm is None and desk.store.get("analysts") == "solo regole"
    assert "Claude Code non trovato" in capsys.readouterr().out


def test_the_analysts_take_no_more_markets_than_the_hourly_cap(cfg):
    other = "ETH/USDC"
    cfg.analyst_max_per_hour = 1
    desk, _, clock = make_desk(cfg, {SYMBOL: breakout(), other: breakout()}, llm=llm())
    desk.cycle()
    assert len(desk.store.positions()) == 1  # one discussed and bought, the other not asked
    assert "già 1 analisi nell'ultima ora" in journal(desk)
    clock.advance(1.01)  # an hour later the cap has room again
    assert desk._analysts_busy(clock()) == ""


def test_and_no_more_than_the_daily_cap(cfg):
    cfg.analyst_max_per_hour, cfg.analyst_max_per_day = 10, 2
    desk, _, clock = make_desk(cfg, {SYMBOL: breakout()}, llm=llm())
    for _ in range(2):
        desk._count_debate(clock())
        clock.advance(2)
    assert "nelle ultime 24 ore" in desk._analysts_busy(clock())
    clock.advance(21)  # the first one is now more than 24 hours old
    assert desk._analysts_busy(clock()) == ""
