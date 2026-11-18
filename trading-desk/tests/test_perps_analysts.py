"""The analysts on the perpetuals desk: prompts written for the trade's own direction, the
Chief's SHORT, sizing by conviction, the price after the debate, and one budget for both
desks."""

import argparse
import sqlite3

import pytest

from desk import cli, snapshot
from desk.agents.budget import AnalystBudget
from desk.agents.llm import AgentUnavailable
from desk.broker import PerpsPaperBroker
from desk.config import Settings
from desk.market import MarketUnavailable
from desk.models import NewsReport, ShortVerdict
from desk.perps_desk import PerpsDesk
from desk.store import Store
from tests.conftest import Clock, FakeLLM, breakout, dump
from tests.test_desk import MOOD, OBJECTIONS, SYMBOL, make_desk, verdict
from tests.test_perps import BTC, ETH, SOL, FakePerpsMarket, falling, journal, rising

BEARISH = NewsReport(
    catalyst_found=True,
    catalyst="exploit",
    impact="bearish",
    red_flags=[],
    headlines=[],
    summary="Exploit confermato sul protocollo.",
    confidence=0.8,
)


class Recording(FakeLLM):
    """A FakeLLM that also keeps the system prompt and the brief of every question."""

    def __init__(self, **answers):
        super().__init__(**answers)
        self.prompts: dict[str, tuple[str, str]] = {}

    def ask(self, system, prompt, schema, *, effort="medium", web_search=False):
        self.prompts[schema.__name__] = (system, prompt)
        return super().ask(system, prompt, schema, effort=effort, web_search=web_search)


def short_verdict(decision="SHORT", **kwargs) -> ShortVerdict:
    return ShortVerdict(**{**verdict(**kwargs).model_dump(), "decision": decision})


def llm(**overrides) -> Recording:
    answers = dict(
        NewsReport=BEARISH,
        SentimentReport=MOOD,
        SkepticReport=OBJECTIONS,
        Verdict=verdict(),
        ShortVerdict=short_verdict(),
    )
    return Recording(**{**answers, **overrides})


def perps_desk(cfg, data, fake, store=None):
    market, clock = FakePerpsMarket(data), Clock()
    broker = PerpsPaperBroker(cfg)
    desk = PerpsDesk(cfg, market, broker, store or Store(":memory:"), llm=fake, clock=clock)
    return desk, market, clock


def shorting(cfg, fake, store=None):
    """A desk that sees SOL falling on volume while BTC falls: a short setup."""
    return perps_desk(cfg, {SOL: dump(), BTC: falling()}, fake, store)


# --- the debate on a short --------------------------------------------------------------------


def test_the_chief_opens_a_short_with_its_own_word(pcfg):
    fake = llm()
    desk, _, _ = shorting(pcfg, fake)
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert (pos.symbol, pos.side) == (SOL, "short")
    assert fake.calls == ["NewsReport", "SentimentReport", "SkepticReport", "ShortVerdict"]
    said = journal(desk)
    assert f"CHIEF {SOL} SHORT (fiducia 0.80, convinzione high)" in said
    assert "rischio rimbalzo low" in said  # the crowd's danger for a short is a rebound
    verdicts = [e for e in desk.store.events(500) if e.agent == "CHIEF"]
    assert verdicts[-1].message.startswith("SHORT")


def test_a_short_is_briefed_and_argued_as_a_short(pcfg):
    fake = llm()
    desk, market, _ = shorting(pcfg, fake)
    market.rates[SOL] = -0.0003
    market.growth[SOL] = 0.08
    desk.cycle()
    system, brief = fake.prompts["ShortVerdict"]
    assert "Trade: SHORT on the perpetual contract: the desk profits if the price falls" in brief
    assert "above (+" in brief and "below (" in brief  # the stop above, the target below
    assert "BTC: in a downtrend, so the desk opens only shorts for now" in brief
    assert "Funding rate: -0.0300% every 8h (shorts pay longs)" in brief
    assert "Open interest over the last 24h: +8.0%" in brief
    assert "perpetual futures" in system and "at most 3x leverage" in system
    assert "- SHORT: the evidence supports the fall continuing" in system
    assert "BUY" not in system
    assert "bearish news supports this short" in fake.prompts["NewsReport"][0]
    assert "short squeeze" in fake.prompts["SentimentReport"][0]
    assert "three reasons not to open it" in fake.prompts["SkepticReport"][0]


def test_a_reading_that_fails_is_said_to_be_missing(pcfg):
    pcfg.perps_oi_filter = False  # without the filter only the brief asks for it
    fake = llm()
    desk, market, _ = shorting(pcfg, fake)
    market.growth[SOL] = MarketUnavailable("bybit: timeout")
    desk.cycle()
    assert "Open interest over the last 24h: not available" in fake.prompts["NewsReport"][1]
    assert market.asked == [SOL]


@pytest.mark.parametrize("decision", ["WAIT", "SKIP"])
def test_a_chief_that_waits_or_skips_opens_nothing(pcfg, decision):
    desk, _, _ = shorting(pcfg, llm(ShortVerdict=short_verdict(decision)))
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert f"CHIEF {SOL} {decision}" in journal(desk)


def test_an_unanswered_serious_objection_cancels_the_short(pcfg):
    desk, _, _ = shorting(pcfg, llm(ShortVerdict=short_verdict(rebutted=(1, 2))))
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "SHORT annullato: obiezione 3 (serious) senza risposta" in journal(desk)


def test_low_confidence_cancels_the_short(pcfg):
    desk, _, _ = shorting(pcfg, llm(ShortVerdict=short_verdict(confidence=0.4)))
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "fiducia 0.40 sotto la soglia" in journal(desk)


def test_no_short_without_the_skeptic(pcfg):
    fake = llm(SkepticReport=AgentUnavailable("Claude Code: Usage limit reached"))
    desk, _, _ = shorting(pcfg, fake)
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "ShortVerdict" not in fake.calls
    assert "WAIT: senza il parere dello Skeptic non si apre lo short" in journal(desk)


def test_low_conviction_halves_the_short(pcfg):
    full, _, _ = shorting(pcfg, llm())
    half, _, _ = shorting(pcfg, llm(ShortVerdict=short_verdict(conviction="low")))
    full.cycle()
    half.cycle()
    [a], [b] = full.store.perps_positions(), half.store.perps_positions()
    assert b.qty == pytest.approx(a.qty / 2, rel=1e-6)
    assert b.leverage == pytest.approx(a.leverage / 2, rel=1e-6)  # the same margin, less leverage


def test_the_analysts_are_not_asked_about_a_setup_the_rules_drop(pcfg):
    fake = llm()
    desk, market, _ = shorting(pcfg, fake)
    market.growth[SOL] = -0.05  # the open interest rules it out first
    desk.cycle()
    assert desk.store.perps_positions() == [] and fake.calls == []


def test_a_market_discussed_lately_is_not_discussed_again(pcfg):
    fake = llm(ShortVerdict=short_verdict("WAIT"))
    desk, _, clock = shorting(pcfg, fake)
    desk.cycle()
    clock.advance(1)
    desk.cycle()
    assert fake.calls.count("ShortVerdict") == 1
    assert "già discusso di recente" in journal(desk)


# --- the price after the debate ---------------------------------------------------------------


def test_the_short_is_entered_at_the_price_after_the_debate(pcfg):
    desk, market, _ = shorting(pcfg, llm())
    close = market.data[SOL][-1].close
    market.prices[SOL] = close * 0.99  # the price moved on while the analysts talked
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert pos.entry_price == pytest.approx(close * 0.99 * (1 - pcfg.slippage))
    assert pos.stop > pos.entry_price > pos.target


def test_a_setup_that_ran_away_during_the_debate_is_dropped(pcfg):
    desk, market, _ = shorting(pcfg, llm())
    market.prices[SOL] = market.data[SOL][-1].close * 0.5
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "durante l'analisi il prezzo è passato da" in journal(desk)


# --- longs on the perpetuals, and the spot desk -----------------------------------------------


def test_a_perps_long_opens_on_the_chiefs_buy(pcfg):
    fake = llm()
    desk, _, _ = perps_desk(pcfg, {ETH: breakout(), BTC: rising()}, fake)
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert (pos.symbol, pos.side) == (ETH, "long")
    assert fake.calls[-1] == "Verdict"
    system, brief = fake.prompts["Verdict"]
    assert "Trade: LONG" in brief and "BTC: in an uptrend" in brief
    assert "- BUY:" in system and "perpetual futures" in system
    assert "rischio hype" in journal(desk)


def test_the_spot_desk_still_briefs_a_spot_long(cfg):
    fake = llm()
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.cycle()
    assert len(desk.store.positions()) == 1
    system, brief = fake.prompts["Verdict"]
    assert "spot trading desk that only takes long positions" in system
    assert "Trade:" not in brief and "Funding" not in brief and "SHORT" not in system


# --- one budget for both desks ----------------------------------------------------------------


def test_the_two_desks_draw_on_one_budget(cfg, pcfg, tmp_path):
    cfg.analyst_max_per_hour = pcfg.analyst_max_per_hour = 1
    spot, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm())
    spot.budget = AnalystBudget.shared(tmp_path)  # each desk its own connection, as on the PC
    spot.cycle()
    assert len(spot.store.positions()) == 1

    fake = llm()
    desk, _, _ = shorting(pcfg, fake)
    desk.budget = AnalystBudget.shared(tmp_path)
    desk.cycle()
    assert desk.store.perps_positions() == [] and fake.calls == []
    assert "non lo faccio analizzare: già 1 analisi nell'ultima ora" in journal(desk)


def test_the_perps_desk_starts_with_the_analysts_and_the_shared_budget(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    program = tmp_path / "claude.exe"
    program.write_text("")
    cfg = Settings(
        _env_file=None,
        data_dir=tmp_path,
        market="perps",
        analysts="claude-code",
        claude_code_path=str(program),
    )
    args = argparse.Namespace(live=False, rules_only=False, rules_if_no_key=True)
    desk = cli.trading_desk(cfg, args)
    assert isinstance(desk, PerpsDesk) and type(desk.llm).__name__ == "ClaudeCodeLLM"
    assert desk.store.get("analysts") == "Claude Code (sonnet, abbonamento)"
    assert (tmp_path / "analysts-budget.db").exists()
    docs = snapshot.build(cfg.db_path, cfg, now=1.0)
    assert docs["perps_account"]["analysts"] == "Claude Code (sonnet, abbonamento)"


def test_a_locked_budget_means_no_debate_not_a_stopped_desk(pcfg, tmp_path):
    other = sqlite3.connect(tmp_path / "analysts-budget.db", isolation_level=None)
    fake = llm()
    desk, _, _ = shorting(pcfg, fake)
    desk.budget = AnalystBudget(tmp_path / "analysts-budget.db", timeout=0.05)
    other.execute("BEGIN IMMEDIATE")  # the other desk is counting, and takes too long
    try:
        assert desk.cycle()
    finally:
        other.execute("ROLLBACK")
    assert desk.store.perps_positions() == [] and fake.calls == []
    assert "il conteggio delle analisi non è leggibile" in journal(desk)


# --- while the analysts think -----------------------------------------------------------------


def test_the_stops_are_watched_while_the_analysts_think(pcfg):
    fake = llm()
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), ETH: dump(), BTC: falling()}, fake)
    asked = []

    def ask(system, prompt, schema, **kwargs):
        asked.append(schema.__name__)
        if schema.__name__ == "NewsReport" and asked.count("NewsReport") == 2:
            [first] = desk.store.perps_positions()  # the first short, opened a debate ago
            market.prices[first.symbol] = first.stop * 1.01  # the market turns meanwhile
        return Recording.ask(fake, system, prompt, schema, **kwargs)

    fake.ask = ask
    desk.cycle()
    [trade] = desk.store.perps_trades()
    assert trade.reason == "stop-loss"  # closed during the second debate, not after it
    said = [f"{e.agent} {e.message}" for e in desk.store.events(500)]
    closed = next(i for i, line in enumerate(said) if "SHORT chiusa" in line)
    last_verdict = max(i for i, line in enumerate(said) if line.startswith("CHIEF SHORT"))
    assert closed < last_verdict
    [still_open] = desk.store.perps_positions()
    assert still_open.symbol != trade.symbol


def test_a_failing_analyst_is_on_record_until_one_answers(pcfg, tmp_path):
    db = tmp_path / "desk-paper-perps.db"
    fake = llm(SkepticReport=AgentUnavailable("Claude Code: Usage limit reached"))
    desk, _, clock = shorting(pcfg, fake, Store(db))
    desk.cycle()
    assert desk.store.get_json("analysts_error")["agent"] == "SKEPTIC"
    account = snapshot.build(db, pcfg, now=clock())["perps_account"]
    assert account["analysts_error"] == "Claude Code: Usage limit reached"

    fake.answers["SkepticReport"] = OBJECTIONS
    clock.advance(pcfg.reanalyze_hours + 1)
    desk.cycle()
    assert desk.store.get("analysts_error") == ""
    assert snapshot.build(db, pcfg, now=clock())["perps_account"]["analysts_error"] == ""
