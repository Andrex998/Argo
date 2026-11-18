"""What the desk does when the connection, the PC or the journal lets it down."""

import argparse

import ccxt
import pytest

from desk import cli
from desk.agents import scout
from desk.config import Settings
from desk.desk import value_book
from desk.market import MarketError, MarketUnavailable, market_error
from tests.conftest import FakeMarket, breakout, dump, quiet
from tests.test_desk import SYMBOL, journal, make_desk


class Offline(FakeMarket):
    """A market that answers until `down` is set, then raises as a dropped connection."""

    def __init__(self, data):
        super().__init__(data)
        self.down = False

    def universe(self):
        if self.down:
            raise MarketUnavailable("kraken: connessione assente")
        return super().universe()

    def candles(self, symbol, limit=200):
        if self.down:
            raise MarketUnavailable(f"{symbol}: connessione assente")
        return super().candles(symbol, limit)

    def price(self, symbol):
        if self.down:
            raise MarketUnavailable(f"{symbol}: connessione assente")
        return super().price(symbol)

    def lowest_since(self, symbol, since):
        if self.down:
            raise MarketUnavailable(f"{symbol}: connessione assente")
        return super().lowest_since(symbol, since)


def offline_desk(cfg, data):
    desk, _, clock = make_desk(cfg, data)
    desk.market = Offline(data)
    return desk, desk.market, clock


# --- errors in words ------------------------------------------------------------


def test_exchange_errors_say_what_to_check():
    lost = market_error(ccxt.NetworkError("kraken GET https://api.kraken.com timed out"), "kraken")
    assert isinstance(lost, MarketUnavailable) and "connessione assente" in str(lost)
    tls = market_error(ccxt.NetworkError("SSLError(CERTIFICATE_VERIFY_FAILED)"), "kraken")
    assert isinstance(tls, MarketUnavailable) and "antivirus" in str(tls)
    unknown = market_error(ccxt.BadSymbol("kraken does not have market symbol XYZ/USD"), "XYZ/USD")
    assert type(unknown) is MarketError


# --- a connection that drops --------------------------------------------------------


def test_an_unreachable_btc_trend_blocks_new_longs(cfg):
    cfg.regime_filter = True

    class BtcUnreachable(FakeMarket):
        def candles(self, symbol, limit=200):
            if symbol == "BTC/USDC":
                raise MarketUnavailable("BTC/USDC: connessione assente")
            return super().candles(symbol, limit)

    desk, _, _ = make_desk(cfg, {SYMBOL: breakout(), "BTC/USDC": quiet()})
    desk.market = BtcUnreachable({SYMBOL: breakout(), "BTC/USDC": quiet()})
    desk.cycle()
    assert desk.store.positions() == []
    assert "non verificabile in questo momento" in journal(desk)


def test_a_failed_scan_is_reported_and_tells_the_loop_to_retry(cfg):
    desk, market, _ = offline_desk(cfg, {SYMBOL: breakout()})
    market.down = True
    assert desk.cycle() is False
    assert "scansione non riuscita, riprovo tra poco" in journal(desk)


def test_the_scan_stops_once_the_connection_is_clearly_gone(cfg):
    calls = []

    class DropsAfterUniverse(FakeMarket):
        def candles(self, symbol, limit=200):
            calls.append(symbol)
            raise MarketUnavailable(f"{symbol}: connessione assente")

    market = DropsAfterUniverse({f"C{i}/USDC": quiet() for i in range(10)})
    with pytest.raises(MarketUnavailable, match="scansione interrotta"):
        scout.scan(market, cfg)
    assert len(calls) == scout.CONNECTION_LOST


def test_an_outage_keeps_the_last_price_and_moves_no_anchor(cfg):
    desk, market, clock = offline_desk(cfg, {SYMBOL: breakout()})
    desk.cycle()
    [pos] = desk.store.positions()
    market.prices[SYMBOL] = pos.entry_price * 1.05
    desk.monitor()  # last good valuation: up 5%
    peak, points = desk.store.get_float("peak_equity"), len(desk.store.equity_curve())
    day = desk.store.get("day")

    market.down = True
    clock.advance(24)  # a new UTC day starts during the outage
    book = value_book(desk.store, desk.market, clock())
    assert not book.fresh
    assert desk.store.get_json("prices")[SYMBOL] == pytest.approx(pos.entry_price * 1.05)
    assert desk.store.get_float("peak_equity") == peak
    assert desk.store.get("day") == day  # the new day opens on a fresh price, not this one
    desk.monitor()
    assert len(desk.store.equity_curve()) == points  # no step drawn from a stale price

    market.down = False
    assert value_book(desk.store, desk.market, clock()).fresh


# --- the loop -------------------------------------------------------------------------


def test_the_loop_retries_a_failed_scan_within_the_candle(cfg):
    desk, market, _ = offline_desk(cfg, {SYMBOL: quiet()})
    schedule = cli.Schedule(period=3600)
    market.down = True
    cli.run_once(desk, schedule, now=7200 + 30)
    assert schedule.next_cycle == 7200 + 30 + cli.RETRY_SECONDS
    assert desk.store.get_float("next_cycle") == schedule.next_cycle

    market.down = False
    cli.run_once(desk, schedule, now=schedule.next_cycle)
    assert schedule.next_cycle == 3 * 3600 + 20  # back on the candle clock


def test_a_cycle_that_buys_waits_for_the_next_candle(cfg):
    """A pass that ends with a purchase is complete: the next one comes with the next candle,
    not five minutes later on the same candles."""
    desk, _, _ = make_desk(cfg, {SYMBOL: breakout()})
    schedule = cli.Schedule(period=3600)
    cli.run_once(desk, schedule, now=7200 + 30)
    assert desk.store.positions()  # it bought
    assert schedule.next_cycle == 3 * 3600 + 20


def test_the_loop_says_when_the_pc_was_asleep(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: quiet()})
    schedule = cli.Schedule(period=3600, next_cycle=10**9)
    cli.run_once(desk, schedule, now=1000)
    cli.run_once(desk, schedule, now=1000 + 3 * 3600)
    assert "rimasto fermo per 180 minuti" in journal(desk)


def test_the_loop_retries_after_an_unexpected_error(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: dump()})

    def broken():
        raise RuntimeError("guasto")

    desk.cycle = broken
    schedule = cli.Schedule(period=3600)
    with pytest.raises(RuntimeError):
        cli.run_once(desk, schedule, now=5000)
    assert schedule.next_cycle == 5000 + cli.RETRY_SECONDS


# --- starting without a key ------------------------------------------------------------


def test_no_key_means_rules_only_when_the_launcher_asks(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))  # no stored Claude credentials either
    cfg = Settings(_env_file=None, data_dir=tmp_path / "data")
    args = argparse.Namespace(rules_only=False, rules_if_no_key=True)
    desk = cli.trading_desk(cfg, args)
    assert desk.llm is None
    assert "sole regole" in capsys.readouterr().out
