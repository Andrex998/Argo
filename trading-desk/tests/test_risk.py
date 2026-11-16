import pytest

from desk import risk
from desk.broker import PaperBroker
from desk.models import ChartPlan, Position


def plan(entry=100.0, stop=96.0, symbol="SOL/USDC", reasons=()) -> ChartPlan:
    return ChartPlan(
        symbol,
        "up",
        entry,
        stop,
        entry + 2 * (entry - stop),
        atr=2.0,
        rsi=60.0,
        ema_fast=99.0,
        ema_slow=97.0,
        support=97.0,
        resistance=99.0,
        reasons=list(reasons),
    )


def book(**overrides) -> risk.Book:
    values = dict(
        equity=1000.0,
        cash=1000.0,
        exposure=0.0,
        open_symbols=frozenset(),
        day_start_equity=1000.0,
        peak_equity=1000.0,
    )
    return risk.Book(**{**values, **overrides})


def test_size_comes_from_the_stop_distance(cfg):
    cfg.max_position_pct = 100.0
    cfg.max_exposure_pct = 100.0
    decision = risk.evaluate(plan(stop=96.0), book(), cfg, now=0)
    # Risking 1% of 1000 with a 4-point stop: 2.5 units, 250 of notional.
    assert decision.action == "APPROVE"
    assert decision.qty == pytest.approx(2.5)
    assert decision.qty * (100.0 - 96.0) == pytest.approx(10.0)


def test_position_cap_shrinks_the_trade(cfg):
    decision = risk.evaluate(plan(), book(), cfg, now=0)
    assert decision.action == "REDUCE"
    assert decision.notional == pytest.approx(100.0)  # 10% of equity


def test_low_conviction_halves_the_size(cfg):
    decision = risk.evaluate(plan(), book(), cfg, now=0, size_factor=0.5)
    assert decision.notional == pytest.approx(50.0)


def test_exposure_cap_counts_open_positions(cfg):
    decision = risk.evaluate(plan(), book(exposure=460.0), cfg, now=0)
    assert decision.notional == pytest.approx(40.0)  # 50% of equity minus what is open


def test_never_spends_more_than_the_cash_available(cfg):
    decision = risk.evaluate(plan(), book(cash=30.0), cfg, now=0)
    assert decision.notional < 30.0
    fill = PaperBroker(cfg).buy("SOL/USDC", decision.qty, 100.0)
    assert -fill.quote_delta == pytest.approx(30.0)  # all of it, fee and slippage included


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        (dict(halted="fermato a mano"), "fermo"),
        (dict(equity=969.0), "perdita giornaliera"),
        (dict(equity=849.0, day_start_equity=849.0), "drawdown"),
        (dict(open_symbols=frozenset("ABCDE")), "posizioni aperte"),
        (dict(open_symbols=frozenset({"SOL/USDC"})), "già aperta"),
        (dict(cooldowns={"SOL/USDC": 100.0}), "pausa"),
        (dict(cash=5.0), "sotto il minimo"),
    ],
)
def test_gate_rejects(cfg, overrides, expected):
    decision = risk.evaluate(plan(), book(**overrides), cfg, now=0)
    assert decision.action == "REJECT"
    assert expected in decision.reasons[0]


def test_gate_rejects_an_invalid_plan(cfg):
    decision = risk.evaluate(plan(reasons=["trend down"]), book(), cfg, now=0)
    assert not decision.approved


def test_cooldown_expires(cfg):
    assert risk.evaluate(plan(), book(cooldowns={"SOL/USDC": 100.0}), cfg, now=101).approved


# --- exits ---------------------------------------------------------------------


def position(entry=100.0, stop=96.0) -> Position:
    return Position(
        "SOL/USDC", 1.0, entry, 0.0, entry, stop, stop, entry + 2 * (entry - stop), entry
    )


def tick(pos, price, cfg, now=60.0):
    return risk.check_exit(pos, open_=price, high=price, low=price, close=price, now=now, cfg=cfg)


def test_stop_loss(cfg):
    pos = position()
    assert tick(pos, 97.0, cfg) is None
    assert tick(pos, 95.5, cfg) == risk.Exit("stop-loss", 95.5)


def test_a_gap_through_the_stop_fills_at_the_open(cfg):
    exit_ = risk.check_exit(
        position(), open_=90.0, high=91.0, low=89.0, close=90.5, now=60, cfg=cfg
    )
    assert exit_ == risk.Exit("stop-loss", 90.0)


def test_a_candle_touching_stop_and_target_counts_as_a_loss(cfg):
    exit_ = risk.check_exit(
        position(), open_=100.0, high=110.0, low=95.0, close=109.0, now=60, cfg=cfg
    )
    assert exit_ == risk.Exit("stop-loss", 96.0)


def test_stop_moves_to_breakeven_after_one_r(cfg):
    pos = position()
    assert tick(pos, 104.5, cfg) is None
    assert pos.stop == pytest.approx(100.0 * (1 + 2 * cfg.fee_rate))
    assert tick(pos, 100.1, cfg).reason == "pareggio"


def test_winner_trails_one_r_behind_after_the_target(cfg):
    pos = position()
    assert tick(pos, 108.0, cfg) is None  # target reached
    assert pos.stop == pytest.approx(104.0)
    assert tick(pos, 115.0, cfg) is None
    assert pos.stop == pytest.approx(111.0)
    assert tick(pos, 113.0, cfg) is None  # a pullback never lowers the stop
    assert pos.stop == pytest.approx(111.0)
    assert tick(pos, 110.5, cfg) == risk.Exit("trailing-stop", 110.5)


def test_stale_position_is_closed_but_a_working_one_is_kept(cfg):
    late = cfg.max_hold_hours * 3600 + 1
    assert tick(position(), 100.5, cfg, now=late) == risk.Exit("tempo scaduto", 100.5)
    assert tick(position(), 103.0, cfg, now=late) is None


def test_paper_round_trip_costs_fees_and_slippage(cfg):
    broker = PaperBroker(cfg)
    bought = broker.buy("SOL/USDC", 2.0, 100.0)
    sold = broker.sell("SOL/USDC", 2.0, 100.0)
    assert bought.price == pytest.approx(100.1) and sold.price == pytest.approx(99.9)
    assert bought.quote_delta == pytest.approx(-(200.2 + 0.2002))
    assert sold.quote_delta == pytest.approx(199.8 - 0.1998)
    assert bought.quote_delta + sold.quote_delta < 0
