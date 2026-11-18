"""Simulated leverage: liquidation, fees, funding and the shadow books in the backtest."""

import pytest

from desk import backtest, leverage
from desk.leverage import Book, liquidated_first, liquidation_price
from tests.test_backtest import history

ENTRY = 100.0


def book(cfg, level, cash=1000.0):
    return Book(level=level, start=cash, cash=cash, peak=cash)


# --- the contract -----------------------------------------------------------------------


def test_liquidation_comes_before_one_over_leverage(cfg):
    cfg.maintenance_margin = 0.01
    assert liquidation_price(ENTRY, 20, cfg.maintenance_margin) == pytest.approx(96.0)  # -4%
    assert liquidation_price(ENTRY, 15, cfg.maintenance_margin) == pytest.approx(94.3333, abs=1e-3)
    assert liquidation_price(ENTRY, 3, cfg.maintenance_margin) == pytest.approx(67.6667, abs=1e-3)
    assert liquidation_price(ENTRY, 1, cfg.maintenance_margin) == 0.0  # nothing borrowed


def test_a_position_costs_its_margin_plus_the_fee_on_the_whole_notional(cfg):
    cfg.futures_fee_rate = 0.0005
    b = book(cfg, 20)
    leg = b.open("SOL/USD", 0.10, ENTRY, now=0.0, cfg=cfg, prices={})
    assert leg.margin == pytest.approx(100.0)  # 10% of 1000
    assert leg.qty * ENTRY == pytest.approx(2000.0)  # 20x
    assert b.cash == pytest.approx(1000 - 100 - 2000 * 0.0005)
    assert b.equity({"SOL/USD": ENTRY}) == pytest.approx(1000 - 1.0)


def test_a_winner_earns_leverage_times_the_move_less_fees_and_funding(cfg):
    cfg.futures_fee_rate, cfg.funding_rate_8h = 0.0005, 0.0001
    b = book(cfg, 10)
    b.open("SOL/USD", 0.10, ENTRY, now=0.0, cfg=cfg, prices={})
    b.accrue("SOL/USD", ENTRY, now=24 * 3600, cfg=cfg)  # three funding periods
    result = b.close("SOL/USD", 103.0, now=24 * 3600, cfg=cfg)
    notional = 1000.0
    expected = notional * 0.03 - notional * 0.0005 - notional * 1.03 * 0.0005 - notional * 3 * 0.0001
    assert result.pnl == pytest.approx(expected)
    assert result.funding == pytest.approx(0.3)
    assert b.cash == pytest.approx(1000 + expected)
    assert not result.liquidated


def test_liquidation_loses_the_margin_and_nothing_more(cfg):
    b = book(cfg, 20)
    b.open("SOL/USD", 0.10, ENTRY, now=0.0, cfg=cfg, prices={})
    cash_after_open = b.cash
    result = b.liquidate("SOL/USD", now=60.0)
    assert result.liquidated and b.liquidations == 1
    assert b.cash == cash_after_open  # the margin is gone, the rest of the book is not
    assert result.pnl == pytest.approx(-100.0 - result.fees)


def test_a_gap_far_below_liquidation_still_costs_only_the_margin(cfg):
    b = book(cfg, 20)
    b.open("SOL/USD", 0.10, ENTRY, now=0.0, cfg=cfg, prices={})
    cash_after_open = b.cash
    result = b.close("SOL/USD", 50.0, now=60.0, cfg=cfg)  # -50% at 20x
    assert b.cash == cash_after_open
    assert result.pnl == pytest.approx(-100.0 - 2000 * cfg.futures_fee_rate)


@pytest.mark.parametrize(
    ("open_", "low", "stop", "expected"),
    [
        (100.0, 95.0, 97.0, False),  # the desk's stop (97) is met before liquidation (96)
        (100.0, 95.0, 95.5, True),  # liquidation (96) comes before the stop (95.5)
        (95.0, 94.0, 97.0, True),  # opens below liquidation: gone at once
        (100.0, 96.5, 90.0, False),  # never reached 96
    ],
)
def test_which_comes_first_liquidation_or_stop(cfg, open_, low, stop, expected):
    cfg.maintenance_margin = 0.01
    leg = book(cfg, 20).open("SOL/USD", 0.10, ENTRY, now=0.0, cfg=cfg, prices={})
    assert liquidated_first(leg, open_=open_, low=low, stop=stop) is expected


def test_a_wiped_out_book_takes_no_new_positions(cfg):
    b = book(cfg, 20)
    b.cash = 5.0
    b.mark({}, now=1.0)
    assert b.wiped_at == 1.0
    assert b.open("SOL/USD", 0.10, ENTRY, now=2.0, cfg=cfg, prices={}) is None


# --- the backtest ------------------------------------------------------------------------


def test_backtest_runs_a_book_per_level_on_the_same_trades(cfg):
    cfg.leverage_levels = [3.0, 20.0]
    result = backtest.run({"SOL/USDC": history([0.01] * 12 + [-0.03] * 3)}, cfg)
    (trade,) = result.trades
    assert [b.level for b in result.leverage] == [3.0, 20.0]
    for b in result.leverage:
        (leg,) = b.results
        assert leg.entry == pytest.approx(trade.entry_price)
        assert b.last_equity == pytest.approx(b.start + leg.pnl)
    x3, x20 = result.leverage
    assert x3.results[0].pnl > trade.pnl  # a winner pays more with leverage
    assert x20.results[0].pnl > x3.results[0].pnl


def test_a_tight_stop_closes_twenty_x_before_liquidation(cfg):
    cfg.leverage_levels = [20.0]
    cfg.maintenance_margin = 0.01
    # The desk's stop sits under 2% below the entry, above 20x's liquidation (-4%).
    result = backtest.run({"SOL/USDC": history([-0.06, -0.02, -0.02], surge=1)}, cfg)
    (trade,) = result.trades
    (x20,) = result.leverage
    assert trade.reason == "stop-loss"
    assert not x20.results[0].liquidated
    move = trade.exit_price / trade.entry_price - 1
    assert x20.results[0].pnl == pytest.approx(
        x20.results[0].margin * 20 * move - x20.results[0].fees - x20.results[0].funding
    )


def test_twenty_x_is_liquidated_where_spot_only_takes_its_stop(cfg):
    cfg.leverage_levels = [3.0, 20.0]
    cfg.maintenance_margin = 0.01
    cfg.min_stop_pct = 5.0  # a wide stop: 5% below the entry, past 20x's liquidation (-4%)
    # A breakout that fails and slides 6% in one candle.
    result = backtest.run({"SOL/USDC": history([-0.06, -0.02, -0.02], surge=1)}, cfg)
    (trade,) = result.trades
    assert trade.reason == "stop-loss"
    x3, x20 = result.leverage
    assert not x3.results[0].liquidated
    assert x20.results[0].liquidated and x20.liquidations == 1
    assert x20.results[0].pnl == pytest.approx(-x20.results[0].margin - x20.results[0].fees)


def test_no_levels_no_shadow_books(cfg):
    cfg.leverage_levels = []
    result = backtest.run({"SOL/USDC": history([0.01] * 12)}, cfg)
    assert result.leverage == []


def test_books_start_from_the_desk_capital(cfg):
    cfg.leverage_levels = [5.0]
    (b,) = leverage.books(cfg)
    assert b.cash == b.start == b.peak == cfg.capital
