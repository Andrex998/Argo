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
    expected = (
        notional * 0.03 - notional * 0.0005 - notional * 1.03 * 0.0005 - notional * 3 * 0.0001
    )
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


# --- live: the desk's own trades, shadowed ------------------------------------------------


def live_desk(cfg, levels=(3.0, 20.0)):
    from tests.conftest import breakout
    from tests.test_desk import SYMBOL, make_desk

    cfg.leverage_levels = list(levels)
    desk, market, clock = make_desk(cfg, {SYMBOL: breakout()})
    return desk, market, clock, SYMBOL


def test_a_buy_opens_a_shadow_per_level_and_says_where_each_liquidates(cfg):
    desk, _, _, symbol = live_desk(cfg)
    desk.cycle()
    [pos] = desk.store.positions()
    x3, x20 = desk.shadows
    assert x3.legs[symbol].entry == x20.legs[symbol].entry == pos.entry_price
    assert x20.legs[symbol].qty == pytest.approx(x3.legs[symbol].qty * 20 / 3)
    events = [e.message for e in desk.store.events(50) if e.agent == "LEVA"]
    assert events and "x3" in events[0] and "x20" in events[0]


def test_a_crash_liquidates_twenty_x_and_the_desk_sells_at_its_stop(cfg):
    desk, market, _, symbol = live_desk(cfg)
    desk.cycle()
    [pos] = desk.store.positions()
    x3, x20 = desk.shadows
    liquidation = x20.legs[symbol].liquidation
    market.prices[symbol] = min(liquidation, pos.stop) * 0.99  # below both
    desk.monitor()
    assert desk.store.positions() == []  # the desk took its stop
    assert symbol not in x20.legs and x20.liquidations == 1
    assert symbol not in x3.legs and x3.liquidations == 0  # closed with the desk
    results = desk.store.leverage_results()
    assert {(r.level, r.liquidated) for r in results} == {(3.0, False), (20.0, True)}
    text = "\n".join(e.message for e in desk.store.events(50))
    assert "x20 liquidata" in text and "con la leva: x3" in text


def test_shadow_books_survive_a_restart(cfg):
    from desk.broker import PaperBroker
    from desk.desk import Desk

    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    again = Desk(cfg, market, PaperBroker(cfg), desk.store, clock=clock)
    assert [b.level for b in again.shadows] == [3.0, 20.0]
    assert again.shadows[1].legs[symbol].liquidation == desk.shadows[1].legs[symbol].liquidation
    assert again.shadows[1].cash == pytest.approx(desk.shadows[1].cash)


def test_funding_is_charged_while_the_position_is_open(cfg):
    desk, market, clock, symbol = live_desk(cfg, levels=(10.0,))
    cfg.funding_rate_8h = 0.0001
    desk.cycle()
    (x10,) = desk.shadows
    clock.advance(8)
    desk.monitor()
    leg = x10.legs[symbol]
    assert leg.funding == pytest.approx(leg.qty * market.prices[symbol] * 0.0001, rel=1e-6)


def test_a_quick_sale_and_rebuy_in_the_backtest_values_the_new_leg_at_its_entry(cfg, monkeypatch):
    """A coin sold earlier keeps no old price: re-bought on the same candle as another coin,
    its new leg is worth its margin when the second leg is sized, not the old price's worth."""
    from desk.agents import charts, scout
    from desk.models import Candidate, ChartPlan
    from desk.synthetic import HOUR_MS, series

    cfg.leverage_levels = [20.0]
    cfg.leverage_bases = ["AAA", "BBB"]
    cfg.max_hold_hours = 3.0  # AAA's first trade ends on time, at 100
    n = 160
    falling = [100.0] * 104 + [100.0 - 20.0 * (i + 1) / 26 for i in range(26)] + [80.0] * 30
    histories = {
        "AAA/USDC": series(falling, [1000.0] * n),
        "BBB/USDC": series([50.0] * n, [1000.0] * n),
    }
    signals = {("AAA/USDC", 100): 5.0, ("AAA/USDC", 130): 5.0, ("BBB/USDC", 130): 3.0}

    def evaluate(symbol, window, quote_volume, cfg):
        rvol = signals.get((symbol, window[-1].ts // HOUR_MS))
        close = window[-1].close
        return Candidate(symbol, close, rvol, 0.03, 0.05, 1e7) if rvol else None

    def plan(symbol, window, cfg):
        close = window[-1].close
        return ChartPlan(symbol, "up", close, close * 0.95, close * 1.1, 1.0, 50.0, *[close] * 4)

    monkeypatch.setattr(scout, "evaluate", evaluate)
    monkeypatch.setattr(charts, "plan", plan)
    seen = []
    original = Book.open

    def spy(self, symbol, share, entry, now, cfg, prices):
        at_entry = self.cash + sum(leg.value(leg.entry) for leg in self.legs.values())
        seen.append((symbol, self.equity(prices), at_entry))
        return original(self, symbol, share, entry, now, cfg, prices)

    monkeypatch.setattr(Book, "open", spy)
    backtest.run(histories, cfg)
    assert [s for s, _, _ in seen] == ["AAA/USDC", "AAA/USDC", "BBB/USDC"]
    _, used, at_entry = seen[-1]
    assert used == pytest.approx(at_entry)  # not AAA's new leg valued at its old 100


# --- which coins get leverage ---------------------------------------------------------------


def test_memecoins_and_unknown_coins_get_no_leverage(cfg):
    assert leverage.allowed("BTC/USD", cfg) and leverage.allowed("sol/usdc", cfg)
    for symbol in ("DOGE/USD", "PEPE/USD", "TRUMP/USD", "PENGU/USD", "NUOVACOIN/USD"):
        assert not leverage.allowed(symbol, cfg)


def test_a_memecoin_buy_opens_no_shadow_and_says_so(cfg):
    from tests.conftest import breakout
    from tests.test_desk import make_desk

    cfg.leverage_levels = [3.0, 20.0]
    desk, _, _ = make_desk(cfg, {"PEPE/USDC": breakout()})
    desk.cycle()
    assert [p.symbol for p in desk.store.positions()] == ["PEPE/USDC"]  # spot still trades it
    assert all(not b.legs for b in desk.shadows)
    said = "\n".join(e.message for e in desk.store.events(50) if e.agent == "LEVA")
    assert "nessuna leva simulata" in said and "memecoin" in said


def test_backtest_leaves_coins_outside_the_list_on_spot_only(cfg):
    cfg.leverage_levels = [3.0]
    cfg.leverage_bases = ["BTC"]
    result = backtest.run({"SOL/USDC": history([0.01] * 12 + [-0.03] * 3)}, cfg)
    assert len(result.trades) == 1 and result.unleveraged == 1
    (x3,) = result.leverage
    assert x3.results == [] and x3.last_equity == pytest.approx(x3.start)


# --- live: gaps, manual closes, leftovers, journal order ------------------------------------


def test_a_dip_through_liquidation_while_the_pc_slept_liquidates_on_waking(cfg):
    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    x3, x20 = desk.shadows
    liquidation = x20.legs[symbol].liquidation
    clock.advance(8)  # the PC slept
    market.lows[symbol] = liquidation * 0.99  # the price dipped through x20's level...
    desk.monitor()  # ...and is back where it was when the desk wakes up
    assert symbol not in x20.legs and x20.liquidations == 1
    assert symbol in x3.legs and x3.liquidations == 0
    assert desk.store.positions()  # the desk's own stop was not hit at the price now
    said = "\n".join(e.message for e in desk.store.events(50) if e.agent == "LEVA")
    assert "x20 liquidata" in said and "mentre il desk non controllava" in said


def test_without_a_gap_the_lowest_price_is_not_even_asked(cfg):
    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    market.lows[symbol] = 0.0  # would liquidate everything, if it were read
    clock.advance(1 / 60)  # the next check, a minute later
    desk.monitor()
    assert all(symbol in b.legs for b in desk.shadows)


def test_a_gap_that_cannot_be_read_falls_back_to_the_price_now(cfg):
    from desk.market import MarketUnavailable

    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()

    def unreachable(symbol, since):
        raise MarketUnavailable("kraken: connessione assente")

    market.lowest_since = unreachable
    clock.advance(8)
    desk.monitor()
    assert all(symbol in b.legs for b in desk.shadows)
    assert desk.shadows[0].legs[symbol].funding > 0  # funding is still charged


def test_close_all_settles_the_shadows_for_the_time_the_desk_was_stopped(cfg):
    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    x3, x20 = desk.shadows
    market.lows[symbol] = x20.legs[symbol].liquidation * 0.99
    clock.advance(48)  # desk run stopped for two days, then `desk close-all`
    desk.close_all()
    assert desk.store.positions() == []
    results = {r.level: r for r in desk.store.leverage_results()}
    assert results[20.0].liquidated and not results[3.0].liquidated
    assert results[3.0].funding > 0  # two days of funding, charged before the close


def test_a_shadow_left_over_from_an_older_position_is_closed_at_the_desk_sale(cfg):
    from desk.broker import PaperBroker
    from desk.desk import Desk

    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    [pos] = desk.store.positions()
    # x20 is switched off; meanwhile the desk sells at its stop.
    cfg.leverage_levels = [3.0]
    without = Desk(cfg, market, PaperBroker(cfg), desk.store, clock=clock)
    market.prices[symbol] = pos.stop * 0.999
    clock.advance(1)
    without.monitor()
    [sale] = desk.store.trades()
    # x20 is switched back on: its leg belongs to a position the desk no longer holds.
    cfg.leverage_levels = [3.0, 20.0]
    again = Desk(cfg, market, PaperBroker(cfg), desk.store, clock=clock)
    x20 = again.shadows[1]
    assert symbol not in x20.legs
    [result] = [r for r in desk.store.leverage_results() if r.level == 20.0]
    assert result.exit == pytest.approx(sale.exit_price) and not result.liquidated


def test_the_journal_tells_the_sale_before_its_leveraged_results(cfg):
    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    [pos] = desk.store.positions()
    market.prices[symbol] = pos.stop * 0.999
    clock.advance(1 / 60)
    desk.monitor()
    order = [e.message for e in desk.store.events(50)]
    sold = next(i for i, m in enumerate(order) if m.startswith("venduto"))
    leveraged = next(i for i, m in enumerate(order) if m.startswith("con la leva"))
    assert sold < leveraged


def test_a_failing_simulation_never_stops_the_desk_from_taking_its_stop(cfg):
    desk, market, clock, symbol = live_desk(cfg)
    desk.cycle()
    [pos] = desk.store.positions()

    def broken(*args):
        raise RuntimeError("dato strano dall'exchange")

    desk._shadow_tick = broken
    desk._shadow_close = broken
    market.prices[symbol] = pos.stop * 0.999
    clock.advance(1 / 60)
    desk.monitor()
    assert desk.store.positions() == []  # the real stop was taken
    said = "\n".join(e.message for e in desk.store.events(50))
    assert "venduto" in said and "simulazione della leva saltata" in said


def test_a_leg_saved_without_its_funding_time_counts_from_its_opening():
    state = {
        "level": 3.0, "start": 1000.0, "cash": 900.0, "fees": 0.0, "funding": 0.0,
        "liquidations": 0, "peak": 1000.0, "max_drawdown_pct": 0.0, "wiped_at": None,
        "last_equity": 1000.0, "entry_fees": {},
        "legs": {"SOL/USD": {"margin": 100.0, "qty": 3.0, "entry": 100.0, "liquidation": 67.67,
                             "opened": 1_750_000_000.0, "funding": 0.0}},
    }  # fmt: skip
    book = leverage.book_from_state(state)
    assert book.legs["SOL/USD"].funded_until == 1_750_000_000.0
