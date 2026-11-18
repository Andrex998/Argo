"""The perpetuals desk: long and short, margin, funding, liquidation, paper only."""

import argparse
import json
import os
from types import SimpleNamespace

import pytest

from desk import cli, perps, risk, snapshot
from desk.broker import BrokerError, LiveBroker, PerpsPaperBroker
from desk.config import Settings
from desk.instance import AlreadyRunning, claim
from desk.market import MarketError, MarketUnavailable, PerpsMarket, make_exchange
from desk.models import ChartPlan, PerpPosition
from desk.perps_desk import PerpsDesk
from desk.store import Store
from desk.synthetic import bounce
from tests.conftest import Clock, FakeMarket, breakout, dump, quiet, series, zigzag

SOL, ETH, BTC, PEPE = "SOL/USDT:USDT", "ETH/USDT:USDT", "BTC/USDT:USDT", "PEPE/USDT:USDT"
HOUR = 3600.0


def rising():
    return quiet()  # an uptrend without a volume surge


def falling():
    return series(zigzag(120, 100.0, -0.005, 0.003), [1000.0] * 120)


class FakePerpsMarket(FakeMarket):
    def __init__(self, data):
        super().__init__(data)
        self.highs: dict[str, float] = {}  # the highest price of a gap in the checks, if any
        self.rates: dict[str, float] = {}
        self.growth: dict[str, float | None] = {}
        self.asked: list[str] = []  # the markets whose open interest was read

    def highest_since(self, symbol, since):
        return self.highs.get(symbol)

    def funding_rate(self, symbol):
        return self.rates.get(symbol, 0.0)

    def open_interest_growth(self, symbol):
        self.asked.append(symbol)
        growth = self.growth.get(symbol, 0.05)  # new money coming in, unless a test says not
        if isinstance(growth, Exception):
            raise growth
        return growth


def perps_desk(cfg, data, store=None):
    market, clock = FakePerpsMarket(data), Clock()
    desk = PerpsDesk(cfg, market, PerpsPaperBroker(cfg), store or Store(":memory:"), clock=clock)
    return desk, market, clock


def journal(desk) -> str:
    return "\n".join(f"{e.agent} {e.symbol} {e.message}" for e in desk.store.events(500))


def position(side="long", entry=100.0, stop=96.0, target=108.0, leverage=3.0) -> PerpPosition:
    return PerpPosition(
        SOL, side, 1.0, entry, 0.0, stop, stop, target, entry, 33.0, leverage,
        perps.liquidation_price(entry, side, leverage, 0.01), 0.05,
    )  # fmt: skip


def short_plan(entry=100.0, stop=104.0) -> ChartPlan:
    return ChartPlan(
        SOL, "down", entry, stop, entry - 2 * (stop - entry), atr=2.0, rsi=40.0, ema_fast=101.0,
        ema_slow=103.0, support=90.0, resistance=105.0, side="short",
    )  # fmt: skip


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


# --- settings ---------------------------------------------------------------------------------


def test_the_spot_desk_keeps_its_defaults_and_the_perps_desk_its_own_venue_and_file():
    spot = Settings(_env_file=None)
    assert (spot.market, spot.exchange, spot.quote) == ("spot", "kraken", "USD")
    assert spot.db_path.name == "desk-paper.db"
    pcfg = Settings(_env_file=None, market="perps", exchange="kraken", quote="USD")
    assert (pcfg.exchange, pcfg.quote) == ("bybit", "USDT")  # whatever .env says
    okx = Settings(_env_file=None, market="perps", perps_exchange="okx")
    assert okx.exchange == "okx"
    assert pcfg.db_path.name == "desk-paper-perps.db"
    assert (pcfg.perps_cap_position_pct, pcfg.perps_cap_total_pct) == (33.0, 150.0)
    assert (pcfg.perps_fee_rate, pcfg.perps_max_leverage, pcfg.perps_oi_filter) == (
        0.00055,
        3.0,
        True,
    )


# --- exits on both sides ----------------------------------------------------------------------

# Candles (open, high, low, close) around a long entered at 100, stop 96, target 108.
SCENARIOS = {
    "stop-loss": [(100, 101, 99, 100.5), (100, 100.5, 95.5, 96)],
    "gap": [(100, 101, 99, 100), (93, 94, 92, 93.5)],
    "pareggio": [(100, 104.5, 99.5, 104), (104, 104.2, 99.0, 99.5)],
    "trailing-stop": [(100, 108.5, 100, 108), (108, 115, 107.5, 114), (114, 114.5, 110.5, 111)],
    "tempo scaduto": [(100, 101, 99.5, 100.5)] * 19,
}


def walk(pos, candles, cfg):
    """Feed candles four hours apart; the exit (or None) and the stop after each one."""
    steps = []
    for i, (o, h, low, c) in enumerate(candles, start=1):
        exit_ = perps.check_exit(pos, open_=o, high=h, low=low, close=c, now=i * 4 * HOUR, cfg=cfg)
        steps.append((exit_, pos.stop))
        if exit_:
            break
    return steps


@pytest.mark.parametrize("name", SCENARIOS)
def test_short_exits_mirror_long_exits(pcfg, name):
    candles = SCENARIOS[name]
    mirrored = [(200 - o, 200 - low, 200 - h, 200 - c) for o, h, low, c in candles]
    longs = walk(position("long"), candles, pcfg)
    shorts = walk(position("short", stop=104.0, target=92.0), mirrored, pcfg)
    assert len(longs) == len(shorts)
    for (long_exit, long_stop), (short_exit, short_stop) in zip(longs, shorts, strict=True):
        assert short_stop == pytest.approx(200 - long_stop)
        assert (long_exit is None) == (short_exit is None)
        if long_exit:
            assert short_exit.reason == long_exit.reason
            assert short_exit.price == pytest.approx(200 - long_exit.price)
    assert longs[-1][0].reason == {"gap": "stop-loss"}.get(name, name)


def test_a_gap_through_a_short_stop_fills_at_the_open(pcfg):
    exit_ = perps.check_exit(
        position("short", stop=104.0, target=92.0),
        open_=107.0, high=108.0, low=106.0, close=107.5, now=4 * HOUR, cfg=pcfg,
    )  # fmt: skip
    assert exit_ == risk.Exit("stop-loss", 107.0)


# --- sizing -----------------------------------------------------------------------------------


def test_a_short_is_sized_by_its_stop_like_a_long(pcfg):
    decision = perps.evaluate(short_plan(stop=104.0), book(), pcfg, now=0)
    # 1% of 1000 lost 4 points above the entry: 250 of notional, under every cap.
    assert decision.action == "APPROVE"
    assert decision.notional == pytest.approx(250.0)
    assert decision.qty == pytest.approx(250.0 / (100.0 * (1 - pcfg.slippage)))  # sells lower


@pytest.mark.parametrize(
    ("overrides", "expected", "label"),
    [
        ({}, 330.0, "limite per posizione"),  # 33% of equity
        ({"exposure": 1400.0}, 100.0, "limite di esposizione"),  # 150% of equity, all positions
        ({"margin": 990.0}, 30.0, "margine disponibile"),  # free margin 10, at x3
    ],
)
def test_short_caps(pcfg, overrides, expected, label):
    decision = perps.evaluate(short_plan(stop=101.5), book(**overrides), pcfg, now=0)
    assert decision.action == "REDUCE"
    assert decision.notional == pytest.approx(expected)
    assert decision.reasons[-1] == f"ridotta al {label}"


def test_without_free_margin_nothing_opens(pcfg):
    decision = perps.evaluate(short_plan(), book(margin=999.0), pcfg, now=0)
    assert decision.action == "REJECT" and "sotto il minimo" in decision.reasons[0]


def test_the_perpetuals_fee_sets_the_cost_check(pcfg):
    assert perps.evaluate(short_plan(stop=101.0), book(), pcfg, now=0).approved  # 30% of 1R
    tight = perps.evaluate(short_plan(stop=100.8), book(), pcfg, now=0)  # 37.5% of 1R
    assert tight.action == "REJECT" and "commissioni" in tight.reasons[0]


def test_leverage_is_only_what_the_size_needs(pcfg):
    full = book()
    assert perps.margin_for(330.0, full, pcfg) == pytest.approx((110.0, 3.0))  # the largest: x3
    assert perps.margin_for(220.0, full, pcfg) == pytest.approx((110.0, 2.0))
    assert perps.margin_for(80.0, full, pcfg) == pytest.approx((80.0, 1.0))  # no leverage needed
    assert perps.margin_for(120.0, book(margin=950.0), pcfg) == pytest.approx((50.0, 2.4))


def test_isolated_margin_liquidates_either_way_of_the_entry():
    assert perps.liquidation_price(100.0, "long", 3.0, 0.01) == pytest.approx(67.6667, abs=1e-4)
    assert perps.liquidation_price(100.0, "short", 3.0, 0.01) == pytest.approx(132.3333, abs=1e-4)
    assert perps.liquidation_price(100.0, "short", 1.0, 0.01) == pytest.approx(199.0)


# --- funding ----------------------------------------------------------------------------------


def test_funding_sign():
    long, short = position("long"), position("short", stop=104.0, target=92.0)
    assert perps.funding(long, 100.0, 0.0001) == pytest.approx(0.01)  # longs pay a positive rate
    assert perps.funding(short, 100.0, 0.0001) == pytest.approx(-0.01)  # ...and shorts get it
    assert perps.funding(long, 100.0, -0.0002) == pytest.approx(-0.02)
    assert perps.funding(short, 100.0, -0.0002) == pytest.approx(0.02)


def test_funding_is_settled_every_eight_hours_utc():
    midnight = 1_750_032_000.0  # 2025-06-16 00:00 UTC
    assert perps.funding_times(midnight - 1, midnight) == [midnight]
    assert perps.funding_times(midnight, midnight + 8 * HOUR - 1) == []  # opened on the hour
    assert len(perps.funding_times(midnight, midnight + 24 * HOUR)) == 3
    assert len(perps.funding_times(midnight, midnight + 24 * HOUR, 4 * HOUR)) == 6  # Bybit 4h


@pytest.mark.parametrize(("side", "said"), [("short", "funding incassato"), ("long", "pagato")])
def test_the_desk_settles_funding_with_the_right_sign(pcfg, side, said):
    data = {SOL: dump(), BTC: falling()} if side == "short" else {SOL: breakout(), BTC: rising()}
    desk, market, clock = perps_desk(pcfg, data)
    desk.cycle()
    [pos] = desk.store.perps_positions()
    cash = desk.store.get_float("cash")
    market.rates[SOL] = 0.0003
    clock.advance(1)  # one settlement passes
    desk.monitor()
    [pos] = desk.store.perps_positions()
    paid = pos.sign * pos.qty * market.prices[SOL] * 0.0003
    assert pos.funding == pytest.approx(paid)
    assert desk.store.get_float("cash") == pytest.approx(cash - paid)
    assert said in journal(desk)
    clock.advance(1 / 60)
    desk.monitor()  # nothing more is due until the next settlement
    assert desk.store.perps_positions()[0].funding == pytest.approx(paid)


def test_a_contract_that_settles_every_four_hours_is_charged_every_four_hours(pcfg):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    market.funding_interval = lambda symbol: 4 * HOUR  # as Bybit lists some contracts
    desk.cycle()
    market.rates[SOL] = 0.0001
    clock.advance(
        8
    )  # from 15:06 to 23:06 UTC: 16:00 and 20:00 settle, on an 8h contract only 16:00
    desk.monitor()
    [pos] = desk.store.perps_positions()
    assert pos.funding == pytest.approx(2 * pos.sign * pos.qty * market.prices[SOL] * 0.0001)


# --- liquidation ------------------------------------------------------------------------------


def test_a_candle_that_opens_past_the_liquidation_liquidates_before_the_stop():
    long = position("long")  # stop 96, liquidated at 67.67
    assert perps.liquidated(long, open_=65.0, high=66.0, low=60.0)
    assert not perps.liquidated(long, open_=90.0, high=91.0, low=60.0)  # the stop comes first
    short = position("short", stop=104.0, target=92.0)  # liquidated at 132.33
    assert perps.liquidated(short, open_=135.0, high=140.0, low=134.0)
    assert not perps.liquidated(short, open_=110.0, high=140.0, low=109.0)


def test_a_liquidation_nearer_than_the_stop_comes_first():
    high_leverage = position("long", leverage=20.0)  # liquidated at 96: above a 95 stop
    high_leverage.stop = 95.0
    assert perps.liquidated(high_leverage, open_=99.0, high=99.5, low=94.0)


@pytest.mark.parametrize("side", ["long", "short"])
def test_a_gap_through_the_liquidation_liquidates_on_waking(pcfg, side):
    data = {SOL: breakout(), BTC: rising()} if side == "long" else {SOL: dump(), BTC: falling()}
    desk, market, clock = perps_desk(pcfg, data)
    desk.cycle()
    [pos] = desk.store.perps_positions()
    clock.advance(8)  # the PC slept, and the price went through the liquidation and came back
    if side == "long":
        market.lows[SOL] = pos.liquidation * 0.99
    else:
        market.highs[SOL] = pos.liquidation * 1.01
    cash = desk.store.get_float("cash")
    desk.monitor()
    assert desk.store.perps_positions() == []
    [trade] = desk.store.perps_trades()
    assert trade.reason == "liquidazione" and trade.exit_price == pytest.approx(pos.liquidation)
    assert desk.store.get_float("cash") == pytest.approx(cash - pos.margin)
    assert trade.pnl == pytest.approx(-pos.margin - pos.fees)
    said = journal(desk)
    assert f"{side.upper()} liquidata" in said and "mentre il desk non controllava" in said


def test_without_a_gap_the_extremes_are_not_even_asked(pcfg):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.cycle()
    market.highs[SOL] = 10**9  # would liquidate, if it were read
    clock.advance(1 / 60)
    desk.monitor()
    assert desk.store.perps_positions()


# --- the regime picks the side ----------------------------------------------------------------


def test_the_regime_reads_btc():
    assert perps.regime(rising()) == 1
    assert perps.regime(falling()) == -1
    assert perps.regime(bounce()) == 0  # sideways: nothing
    assert perps.regime(rising()[:30]) == 0  # too little history to tell


def test_btc_falling_means_shorts_only(pcfg):
    desk, _, _ = perps_desk(pcfg, {SOL: dump(), ETH: breakout(), BTC: falling()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert (pos.symbol, pos.side) == (SOL, "short")
    assert pos.stop > pos.entry_price > pos.target
    assert pos.liquidation > pos.stop and 1.0 <= pos.leverage <= pcfg.perps_max_leverage
    said = journal(desk)
    assert "con BTC in discesa si apre solo short, non long" in said
    assert "SHORT, si guadagna se il prezzo scende: venduto allo scoperto" in said
    assert "leva x" in said and "margine" in said


def test_btc_rising_means_longs_only(pcfg):
    desk, _, _ = perps_desk(pcfg, {SOL: dump(), ETH: breakout(), BTC: rising()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert (pos.symbol, pos.side) == (ETH, "long")
    assert "con BTC in salita si apre solo long, non short" in journal(desk)


def test_btc_sideways_or_unknown_means_nothing(pcfg):
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), ETH: breakout(), BTC: bounce()})
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "nessuna nuova entrata: BTC/USDT:USDT senza una direzione" in journal(desk)

    del market.data[BTC]
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "trend di BTC/USDT:USDT non verificabile" in journal(desk)


# --- the book ---------------------------------------------------------------------------------


def test_cash_pays_only_fees_and_funding_until_the_close(pcfg):
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    assert desk.store.get_float("cash") == pytest.approx(1000.0 - pos.fees)
    assert pos.qty * pos.entry_price <= 0.33 * 1000.0 + 1e-6  # the position cap
    market.prices[SOL] = pos.entry_price * 0.98  # the short gains 2%
    b = desk.book()
    assert b.equity == pytest.approx(1000.0 - pos.fees + pos.qty * pos.entry_price * 0.02)
    assert b.exposure == pytest.approx(pos.qty * market.prices[SOL])  # the whole notional
    assert b.margin == pytest.approx(pos.margin)


def test_a_short_wins_when_the_price_falls(pcfg):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    r = pos.risk_per_unit
    for price in (pos.target - r, pos.target + 0.1 * r):  # past the target, then back up
        market.prices[SOL] = price
        clock.advance(1 / 60)
        desk.monitor()
    [trade] = desk.store.perps_trades()
    assert trade.side == "short" and trade.reason == "trailing-stop"
    assert trade.pnl > 0 and trade.r_multiple > 1.5
    assert desk.store.get_float("cash") == pytest.approx(1000.0 + trade.pnl)
    said = journal(desk)
    assert "target raggiunto" in said and "SHORT chiusa: ricomprato a" in said


def test_a_short_stopped_out_bars_reentry(pcfg):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    market.prices[SOL] = pos.stop * 1.001
    clock.advance(1 / 60)
    desk.monitor()
    [trade] = desk.store.perps_trades()
    assert trade.reason == "stop-loss" and -1.4 < trade.r_multiple < -1.0
    market.prices[SOL] = market.data[SOL][-1].close
    desk.cycle()  # the same signal, but the market is cooling down
    assert desk.store.perps_positions() == []
    assert "pausa dopo un'uscita in perdita" in journal(desk)


def test_breakeven_on_a_short_lowers_the_stop(pcfg):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.cycle()
    [pos] = desk.store.perps_positions()
    market.prices[SOL] = pos.entry_price - 1.1 * pos.risk_per_unit
    clock.advance(1 / 60)
    desk.monitor()
    [moved] = desk.store.perps_positions()
    assert moved.stop == pytest.approx(pos.entry_price * (1 - 2 * pcfg.perps_fee_rate))
    assert "stop abbassato a pareggio" in journal(desk)


def test_positions_survive_a_restart_and_close_all_settles_them(pcfg, tmp_path):
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()}, Store(tmp_path / "p.db"))
    desk.cycle()
    again = PerpsDesk(pcfg, market, PerpsPaperBroker(pcfg), Store(tmp_path / "p.db"), clock=clock)
    assert [(p.symbol, p.side) for p in again.store.perps_positions()] == [(SOL, "short")]
    assert again.shadows == []  # the perpetuals desk has no shadow books
    market.rates[SOL] = 0.0001
    clock.advance(24)  # stopped for a day, then `desk close-all`
    again.close_all()
    [trade] = again.store.perps_trades()
    assert trade.reason == "chiusura manuale" and trade.funding < 0  # three settlements received
    assert again.store.get_float("cash") == pytest.approx(1000.0 + trade.pnl)


# --- memecoins --------------------------------------------------------------------------------


def stub_exchange(**methods):
    defaults = dict(parse_timeframe=lambda tf: 4 * 3600, milliseconds=lambda: 1_750_000_000_000)
    return SimpleNamespace(**{**defaults, **methods})


def swap(base, quote="USDT", settle="USDT", **extra):
    symbol = f"{base}/{quote}:{settle}"
    return symbol, {"symbol": symbol, "base": base, "quote": quote, "settle": settle,
                    "swap": True, "linear": True, "spot": False, **extra}  # fmt: skip


def test_the_perps_universe_has_no_memecoin_and_no_other_contract(pcfg):
    markets = dict(
        [swap("BTC"), swap("SOL"), swap("PEPE"), swap("1000PEPE"), swap("DOGE"),
         swap("TRUMP"), swap("XRP", quote="USDC", settle="USDC"), swap("ETH", active=False),
         ("BTC/USDT:USDT-261225", {"symbol": "BTC/USDT:USDT-261225", "base": "BTC",
          "quote": "USDT", "settle": "USDT", "swap": False, "future": True, "linear": True}),
         ("ADA/USDT", {"symbol": "ADA/USDT", "base": "ADA", "quote": "USDT", "spot": True})]
    )  # fmt: skip
    tickers = {symbol: {"quoteVolume": 5e9 if "BTC" in symbol else 9e8} for symbol in markets}
    exchange = stub_exchange(load_markets=lambda: markets, fetch_tickers=lambda: tickers)
    assert PerpsMarket(exchange, pcfg).universe() == [(BTC, 5e9), (SOL, 9e8)]


def test_a_memecoin_never_trades_on_perps(pcfg):
    desk, _, _ = perps_desk(pcfg, {PEPE: dump(), BTC: falling()})
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "PEPE non è tra le monete ammesse: niente perpetui sulle memecoin" in journal(desk)


# --- open interest (research/derivs.py, rule C) -----------------------------------------------


def test_open_interest_falling_skips_the_setup(pcfg):
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    market.growth[SOL] = -0.032
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "scartato: posizioni aperte sul mercato in calo nelle ultime 24 ore (-3.2%)" in (
        journal(desk)
    )


def test_open_interest_must_grow_not_just_hold(pcfg):
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    market.growth[SOL] = 0.0
    desk.cycle()
    assert desk.store.perps_positions() == []
    assert "posizioni aperte sul mercato ferme" in journal(desk)


@pytest.mark.parametrize(
    ("reading", "said"),
    [(None, "storico troppo corto"), (MarketUnavailable("binanceusdm: timeout"), "non leggibili")],
)
def test_without_an_open_interest_reading_there_is_no_opinion(pcfg, reading, said):
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    market.growth[SOL] = reading
    desk.cycle()
    assert [p.symbol for p in desk.store.perps_positions()] == [SOL]
    assert said in journal(desk) and "entrata senza filtro" in journal(desk)


def test_the_open_interest_filter_can_be_switched_off(pcfg):
    pcfg.perps_oi_filter = False
    desk, market, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    market.growth[SOL] = -0.5
    desk.cycle()
    assert [p.symbol for p in desk.store.perps_positions()] == [SOL]
    assert market.asked == []


def oi_rows(amounts, values=None, end=1_750_000_000_000 - 1_000_000):
    """Hourly readings ending at `end`, oldest first, as ccxt returns them."""
    start = end - (len(amounts) - 1) * 3_600_000
    values = values or [None] * len(amounts)
    return [
        {"timestamp": start + i * 3_600_000, "openInterestAmount": a, "openInterestValue": v}
        for i, (a, v) in enumerate(zip(amounts, values, strict=True))
    ]


def test_open_interest_growth_compares_contracts_with_24_hours_earlier(pcfg):
    asked = []

    def history(symbol, timeframe, since=None, limit=None):
        asked.append((symbol, timeframe, since))
        # 25 hourly readings: contracts up 10%, dollars down (the price fell harder).
        return oi_rows([1000.0] + [1050.0] * 23 + [1100.0], [5e6] + [4.8e6] * 23 + [4.5e6])

    market = PerpsMarket(stub_exchange(fetch_open_interest_history=history), pcfg)
    assert market.open_interest_growth(SOL) == pytest.approx(0.10)
    [(symbol, timeframe, since)] = asked
    assert (symbol, timeframe, since) == (SOL, "1h", 1_750_000_000_000 - 25 * 3_600_000)


def test_open_interest_too_short_to_compare_gives_none(pcfg):
    def history(symbol, timeframe, since=None, limit=None):
        return oi_rows([1000.0, 990.0, 980.0])

    market = PerpsMarket(stub_exchange(fetch_open_interest_history=history), pcfg)
    assert market.open_interest_growth(SOL) is None


def test_funding_and_highest_price_from_the_exchange(pcfg):
    rows = [[1_749_999_000_000 + i * 300_000, 100, 100 + i, 99, 100, 1] for i in range(5)]
    exchange = stub_exchange(
        fetch_funding_rate_history=lambda symbol, limit=None: [{"fundingRate": 0.00012}],
        fetch_ohlcv=lambda symbol, timeframe, since=None, limit=None: rows,
    )
    market = PerpsMarket(exchange, pcfg)
    assert market.funding_rate(SOL) == pytest.approx(0.00012)
    assert market.highest_since(SOL, 1_749_999_000) == 104
    assert market.highest_since(SOL, 1_749_999_300) == 104  # the candle before is left out
    empty = PerpsMarket(
        stub_exchange(fetch_funding_rate_history=lambda symbol, limit=None: []), pcfg
    )
    assert empty.funding_rate(SOL) == 0.0


# --- paper only -------------------------------------------------------------------------------


def test_perps_refuse_live_mode(tmp_path):
    args = argparse.Namespace(live=False, rules_only=True)
    live_cfg = Settings(_env_file=None, market="perps", mode="live", data_dir=tmp_path)
    with pytest.raises(SystemExit, match="solo in paper trading"):
        cli.trading_desk(live_cfg, args)
    paper = Settings(_env_file=None, market="perps", data_dir=tmp_path)
    with pytest.raises(SystemExit, match="solo in paper trading"):
        cli.trading_desk(paper, argparse.Namespace(live=True, rules_only=True))
    with pytest.raises(BrokerError, match="solo in paper"):
        LiveBroker(SimpleNamespace(load_markets=dict), paper)
    with pytest.raises(SystemExit, match="nessuna chiave"):
        make_exchange(paper, authenticated=True)
    assert not (tmp_path / "desk-live-perps.lock").exists()  # refused before taking the lock


def test_the_paper_broker_fills_both_ways():
    broker = PerpsPaperBroker(Settings(_env_file=None, market="perps"))
    sold = broker.open(SOL, "short", 2.0, 100.0)
    assert sold.price == pytest.approx(99.9) and sold.quote_delta == pytest.approx(-sold.fee)
    assert sold.fee == pytest.approx(2.0 * 99.9 * 0.00055)  # on the notional, Bybit's taker fee
    bought_back = broker.close(SOL, "short", 2.0, 99.9, 90.0)
    assert bought_back.price == pytest.approx(90.09)
    assert bought_back.quote_delta == pytest.approx(2.0 * (99.9 - 90.09) - bought_back.fee)


# --- two desks, one PC ------------------------------------------------------------------------


def test_both_desks_claim_their_own_lock(tmp_path):
    spot = Settings(_env_file=None, data_dir=tmp_path)
    pcfg = Settings(_env_file=None, data_dir=tmp_path, market="perps")
    held = [claim(spot.db_path), claim(pcfg.db_path)]
    try:
        with pytest.raises(AlreadyRunning):
            claim(pcfg.db_path)
    finally:
        for fd in held:
            os.close(fd)


def test_both_desks_start_side_by_side(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    args = argparse.Namespace(live=False, rules_only=True)
    spot = cli.trading_desk(Settings(_env_file=None, data_dir=tmp_path), args)
    both = cli.trading_desk(Settings(_env_file=None, data_dir=tmp_path, market="perps"), args)
    assert type(spot).__name__ == "Desk" and isinstance(both, PerpsDesk)
    assert both.llm is None  # --rules-only
    assert type(both.market).__name__ == "PerpsMarket"
    assert spot.store.db is not both.store.db


def test_market_on_the_command_line_beats_the_environment(monkeypatch):
    seen = []
    monkeypatch.setattr(cli, "cmd_journal", lambda cfg, args: seen.append(cfg.market))
    monkeypatch.setenv("DESK_MARKET", "perps")
    cli.main(["journal", "--market", "spot"])
    cli.main(["journal"])
    monkeypatch.delenv("DESK_MARKET")
    cli.main(["journal", "--market", "perps"])
    assert seen == ["spot", "perps", "perps"]


# --- the live page ----------------------------------------------------------------------------


def test_snapshot_ids_and_fields(pcfg, tmp_path):
    db = tmp_path / "desk-paper-perps.db"
    desk, market, clock = perps_desk(pcfg, {SOL: dump(), ETH: dump(), BTC: falling()}, Store(db))
    desk.cycle()
    [first, _] = desk.store.perps_positions()
    market.prices[first.symbol] = first.stop * 1.01
    clock.advance(1 / 60)
    desk.monitor()

    docs = snapshot.build(db, pcfg, now=clock())
    assert list(docs) == ["perps_account", "perps_feed", "perps_curve", "perps_book"]
    assert snapshot.documents(pcfg) == tuple(docs)
    assert snapshot.documents(Settings(_env_file=None)) == snapshot.DOCUMENTS
    for doc in docs.values():
        json.dumps(doc, allow_nan=False)
    account, book_ = docs["perps_account"], docs["perps_book"]
    assert account["market"] == "perps" and account["exchange"] == "bybit"
    assert account["max_exposure_pct"] == 150.0 and account["max_leverage"] == 3.0
    assert account["margin"] > 0 and account["oi_filter"] is True
    assert account["analysts"] == "solo regole"
    [open_] = book_["positions"]
    assert open_["side"] == "short" and 1.0 <= open_["leverage"] <= 3.0
    assert open_["margin"] > 0 and open_["liquidation"] > open_["stop"]
    [closed] = book_["trades"]
    assert closed["side"] == "short" and closed["reason"] == "stop-loss"
    assert "leverage" not in book_  # the spot desk's shadow books are not part of perps
    items = docs["perps_feed"]["items"]
    assert {"scan", "plan", "sized", "open", "close"} <= {item["kind"] for item in items}
    assert {item["side"] for item in items if item["kind"] in ("open", "close")} == {"short"}
    assert {f["side"] for f in docs["perps_feed"]["scan"]["flagged"]} == {"short"}


def test_snapshot_before_the_perps_desk_ever_ran(pcfg, tmp_path):
    docs = snapshot.build(tmp_path / "none.db", pcfg, now=1.0)
    assert set(docs) == {"perps_account", "perps_feed", "perps_curve", "perps_book"}
    assert docs["perps_account"] == {
        "at": 1,
        "ready": False,
        "mode": "paper",
        "exchange": "bybit",
        "market": "perps",
    }


def test_status_and_scan_on_perps_need_no_spot_market(pcfg, tmp_path, monkeypatch, capsys):
    market = FakePerpsMarket({SOL: dump(), BTC: falling()})
    monkeypatch.setattr(cli, "open_market", lambda cfg, exchange=None: market)
    cli.cmd_scan(pcfg, argparse.Namespace())
    out = capsys.readouterr().out
    assert "si aprirebbe solo short" in out and "SHORT" in out and "setup valido" in out

    pcfg.data_dir = tmp_path
    desk, _, _ = perps_desk(pcfg, {SOL: dump(), BTC: falling()}, Store(pcfg.db_path))
    desk.cycle()
    cli.cmd_status(pcfg, argparse.Namespace())
    out = capsys.readouterr().out
    assert "Posizioni aperte: 1" in out and "SHORT" in out and "margine impegnato" in out


def test_the_backtest_points_to_the_research_on_perps(pcfg):
    with pytest.raises(SystemExit, match="research/perps.py"):
        cli.cmd_backtest(pcfg, argparse.Namespace(days=30))


def test_market_data_errors_still_reach_the_desk_in_words(pcfg):
    class Broken(FakePerpsMarket):
        def funding_rate(self, symbol):
            raise MarketError(f"{symbol}: tasso non disponibile")

    desk, _, clock = perps_desk(pcfg, {SOL: dump(), BTC: falling()})
    desk.market = Broken({SOL: dump(), BTC: falling()})
    desk.cycle()
    clock.advance(1)
    desk.monitor()  # the funding is retried at the next check, the position kept
    assert desk.store.perps_positions()[0].funding == 0.0
    assert "funding non disponibile, riprovo" in journal(desk)


def test_a_location_block_is_not_called_a_lost_connection():
    import ccxt

    from desk.market import market_error

    blocked = market_error(
        ccxt.ExchangeNotAvailable(
            'binanceusdm GET https://fapi.binance.com/fapi/v1/exchangeInfo 451  {"code":0,'
            '"msg":"Service unavailable from a restricted location according to ..."}'
        ),
        "binanceusdm",
    )
    assert isinstance(blocked, MarketUnavailable) and "posizione geografica" in str(blocked)


def test_each_desk_tries_its_own_dashboard_port_first(monkeypatch, tmp_path):
    tried = []

    def taken(cfg, db_path, clock, host, port, demo):
        tried.append(port)
        raise OSError("porta occupata")

    monkeypatch.setattr(cli.dashboard, "serve", taken)
    args = argparse.Namespace(port=None, host="127.0.0.1", open=False)
    for market in ("spot", "perps"):
        with pytest.raises(SystemExit, match="Nessuna porta"):
            cli.start_dashboard(Settings(_env_file=None, market=market), tmp_path / "x.db", args)
    assert tried == [8787, 9787, 0, 8788, 9788, 0]
