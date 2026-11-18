import pytest

from desk.agents.llm import AgentUnavailable
from desk.broker import PaperBroker
from desk.desk import Desk
from desk.models import (
    NewsReport,
    Objection,
    Rebuttal,
    SentimentReport,
    SkepticReport,
    Verdict,
)
from desk.store import Store
from desk.synthetic import bounce
from tests.conftest import Clock, FakeLLM, FakeMarket, breakout, dump, quiet

SYMBOL = "SOL/USDC"

NEWS = NewsReport(
    catalyst_found=True,
    catalyst="listing",
    impact="bullish",
    red_flags=[],
    headlines=[],
    summary="Nuovo listing confermato.",
    confidence=0.8,
)
MOOD = SentimentReport(mood="bullish", hype_risk="low", summary="Interesse reale.", confidence=0.7)
OBJECTIONS = SkepticReport(
    objections=[
        Objection(reason="volume concentrato", evidence="3 candele", severity="serious"),
        Objection(reason="RSI alto", evidence="RSI 72", severity="minor"),
        Objection(reason="mercato debole", evidence="BTC laterale", severity="serious"),
    ],
    summary="Tre dubbi.",
)


def verdict(decision="BUY", confidence=0.8, conviction="high", rebutted=(1, 2, 3)) -> Verdict:
    return Verdict(
        decision=decision,
        conviction=conviction,
        confidence=confidence,
        summary="Sintesi.",
        rebuttals=[
            Rebuttal(objection_number=n, rebutted=n in rebutted, argument="…") for n in (1, 2, 3)
        ],
    )


def make_desk(cfg, data, llm=None):
    market, clock = FakeMarket(data), Clock()
    desk = Desk(cfg, market, PaperBroker(cfg), Store(":memory:"), llm=llm, clock=clock)
    return desk, market, clock


def journal(desk) -> str:
    return "\n".join(f"{e.agent} {e.symbol} {e.message}" for e in desk.store.events(200))


def llm(**overrides) -> FakeLLM:
    answers = dict(
        NewsReport=NEWS, SentimentReport=MOOD, SkepticReport=OBJECTIONS, Verdict=verdict()
    )
    return FakeLLM(**{**answers, **overrides})


# --- rules only ----------------------------------------------------------------


def test_cycle_buys_the_breakout_and_ignores_the_rest(cfg):
    desk, market, _ = make_desk(cfg, {SYMBOL: breakout(), "ETH/USDC": quiet(), "XRP/USDC": dump()})
    desk.cycle()

    (pos,) = desk.store.positions()
    assert pos.symbol == SYMBOL
    assert pos.stop < pos.entry_price < pos.target
    assert pos.cost == pytest.approx(100.0, rel=0.01)  # 10% position cap
    book = desk.book()
    assert book.cash == pytest.approx(1000.0 - pos.cost)
    assert book.equity == pytest.approx(1000.0, abs=0.5)  # only fees and slippage are gone
    assert "3 mercati analizzati, 1 con volume anomalo" in journal(desk)


def test_stop_loss_closes_the_trade_and_bars_reentry(cfg):
    desk, market, clock = make_desk(cfg, {SYMBOL: breakout()})
    desk.cycle()
    (pos,) = desk.store.positions()

    market.prices[SYMBOL] = pos.stop * 0.999
    clock.advance(1)
    desk.monitor()

    assert desk.store.positions() == []
    (trade,) = desk.store.trades()
    assert trade.reason == "stop-loss"
    assert trade.pnl < 0
    assert -1.4 < trade.r_multiple < -1.0  # the planned 1R plus fees and slippage both ways
    assert desk.book().cash == pytest.approx(1000.0 + trade.pnl)

    market.prices[SYMBOL] = market.data[SYMBOL][-1].close
    desk.cycle()  # same signal, but the symbol is cooling down
    assert desk.store.positions() == []
    assert "pausa dopo un'uscita in perdita" in journal(desk)


def test_winner_is_sold_by_the_trailing_stop(cfg):
    desk, market, _ = make_desk(cfg, {SYMBOL: breakout()})
    desk.cycle()
    (pos,) = desk.store.positions()
    r = pos.risk_per_unit

    for price in (pos.target + r, pos.target - 0.1 * r):
        market.prices[SYMBOL] = price
        desk.monitor()

    (trade,) = desk.store.trades()
    assert trade.reason == "trailing-stop"
    assert trade.pnl > 0 and trade.r_multiple > 1.5


def test_halted_desk_opens_nothing(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()})
    desk.store.set("halted", "fermato a mano")
    desk.cycle()
    assert desk.store.positions() == []
    assert "nessuna nuova entrata" in journal(desk)


def test_close_all_flattens_the_book(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "ETH/USDC": breakout()})
    desk.cycle()
    assert len(desk.store.positions()) == 2
    desk.close_all()
    assert desk.store.positions() == []
    assert len(desk.store.trades()) == 2


def test_book_survives_a_restart(cfg, tmp_path):
    market, clock = FakeMarket({SYMBOL: breakout()}), Clock()
    Desk(cfg, market, PaperBroker(cfg), Store(tmp_path / "desk.db"), clock=clock).cycle()
    reopened = Desk(cfg, market, PaperBroker(cfg), Store(tmp_path / "desk.db"), clock=clock)
    assert [p.symbol for p in reopened.store.positions()] == [SYMBOL]
    assert reopened.book().cash < 1000.0


# --- with analysts -------------------------------------------------------------


def test_buy_needs_every_serious_objection_rebutted(cfg):
    fake = llm()
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.cycle()
    assert len(desk.store.positions()) == 1
    assert fake.calls == ["NewsReport", "SentimentReport", "SkepticReport", "Verdict"]


def test_unrebutted_serious_objection_cancels_the_buy(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm(Verdict=verdict(rebutted=(1, 2))))
    desk.cycle()
    assert desk.store.positions() == []
    assert "BUY annullato: obiezione 3 (serious) senza risposta" in journal(desk)


def test_unrebutted_minor_objection_does_not_block(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm(Verdict=verdict(rebutted=(1, 3))))
    desk.cycle()
    assert len(desk.store.positions()) == 1


def test_low_confidence_cancels_the_buy(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm(Verdict=verdict(confidence=0.4)))
    desk.cycle()
    assert desk.store.positions() == []
    assert "fiducia 0.40 sotto la soglia" in journal(desk)


@pytest.mark.parametrize("decision", ["WAIT", "SKIP"])
def test_chief_can_pass(cfg, decision):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm(Verdict=verdict(decision=decision)))
    desk.cycle()
    assert desk.store.positions() == []


def test_low_conviction_buys_half_size(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, llm(Verdict=verdict(conviction="low")))
    desk.cycle()
    (pos,) = desk.store.positions()
    assert pos.cost == pytest.approx(50.0, rel=0.01)


def test_no_trade_without_the_skeptic(cfg):
    fake = llm(SkepticReport=AgentUnavailable("errore API 500"))
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.cycle()
    assert desk.store.positions() == []
    assert "Verdict" not in fake.calls


def test_missing_news_is_passed_on_as_unavailable(cfg):
    fake = llm(NewsReport=AgentUnavailable("limite di richieste raggiunto"))
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.cycle()
    assert "NEWS SOL/USDC non disponibile: limite di richieste raggiunto" in journal(desk)
    assert fake.calls[-1] == "Verdict"  # the debate still runs, with the gap visible to all


def test_a_judged_market_is_not_paid_for_twice(cfg):
    fake = llm(Verdict=verdict(decision="WAIT"))
    desk, _, clock = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.cycle()
    clock.advance(1)
    desk.cycle()
    assert fake.calls.count("Verdict") == 1
    clock.advance(cfg.reanalyze_hours)
    desk.cycle()
    assert fake.calls.count("Verdict") == 2


def test_analysts_are_not_paid_when_the_gate_would_refuse(cfg):
    fake = llm()
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()}, fake)
    desk.store.set("halted", "fermato a mano")
    desk.cycle()
    assert fake.calls == []


def test_debates_per_cycle_are_capped(cfg):
    cfg.max_candidates = 1
    fake = llm()
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "ETH/USDC": breakout()}, fake)
    desk.cycle()
    assert fake.calls.count("Verdict") == 1
    assert len(desk.store.positions()) == 1


# --- market regime -------------------------------------------------------------


def test_no_new_longs_while_btc_is_falling(cfg):
    cfg.regime_filter = True
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "BTC/USDC": dump()})
    desk.cycle()
    assert desk.store.positions() == []
    assert "nessuna nuova entrata: BTC/USDC in trend ribassista" in journal(desk)


def test_longs_are_allowed_while_btc_holds_up(cfg):
    cfg.regime_filter = True
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "BTC/USDC": quiet()})
    desk.cycle()
    assert [p.symbol for p in desk.store.positions()] == [SYMBOL]


def test_regime_filter_is_skipped_when_btc_is_not_listed(cfg):
    cfg.regime_filter = True
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()})
    desk.cycle()
    assert len(desk.store.positions()) == 1
    assert "filtro di mercato saltato" in journal(desk)


def test_strict_regime_also_waits_out_a_sideways_btc(cfg):
    cfg.regime_filter = True
    cfg.regime_strict = True
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "BTC/USDC": bounce()})  # sideways
    desk.cycle()
    assert desk.store.positions() == []
    assert "BTC/USDC non in trend rialzista" in journal(desk)

    cfg.regime_strict = False  # the default rule only waits out a falling BTC
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "BTC/USDC": bounce()})
    desk.cycle()
    assert len(desk.store.positions()) == 1
