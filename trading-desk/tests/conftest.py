"""Synthetic markets and stand-ins for the exchange and the LLM."""

from __future__ import annotations

import pytest

from desk.config import Settings
from desk.market import MarketError
from desk.models import Candle
from desk.synthetic import HOUR_MS, breakout, dump, quiet, series, zigzag

__all__ = ["HOUR_MS", "breakout", "dump", "quiet", "series", "zigzag"]


class FakeMarket:
    def __init__(self, data: dict[str, list[Candle]]):
        self.data = data
        self.prices = {symbol: candles[-1].close for symbol, candles in data.items()}
        self.lows: dict[str, float] = {}  # the lowest price of a gap in the checks, if any

    def universe(self) -> list[tuple[str, float]]:
        return [(symbol, 10_000_000.0) for symbol in self.data]

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        if symbol not in self.data:
            raise MarketError(f"{symbol}: mercato non disponibile")
        return self.data[symbol][-limit:]

    def price(self, symbol: str) -> float:
        return self.prices[symbol]

    def lowest_since(self, symbol: str, since: float) -> float | None:
        return self.lows.get(symbol)


class FakeLLM:
    """Returns a prepared answer per report type and records what was asked."""

    def __init__(self, **answers):
        self.answers = answers
        self.calls: list[str] = []

    def ask(self, system, prompt, schema, *, effort="medium", web_search=False):
        self.calls.append(schema.__name__)
        answer = self.answers[schema.__name__]
        if isinstance(answer, Exception):
            raise answer
        return answer


class Clock:
    def __init__(self, now: float = 1_750_000_000.0):
        self.now = now

    def __call__(self) -> float:
        return self.now

    def advance(self, hours: float) -> None:
        self.now += hours * 3600


@pytest.fixture(autouse=True)
def _analysts_folder(tmp_path_factory, monkeypatch):
    """The analysts' working folder in a temporary place: no test touches the real one."""
    base = tmp_path_factory.mktemp("analysts")
    monkeypatch.setenv("XDG_CACHE_HOME", str(base))
    monkeypatch.setenv("LOCALAPPDATA", str(base))


@pytest.fixture(autouse=True)
def _no_retry_pause(monkeypatch):
    """The scan's second try at a failed market waits a second; the tests need not."""
    from desk.agents import scout

    monkeypatch.setattr(scout, "RETRY_PAUSE", 0.0)


@pytest.fixture
def pcfg() -> Settings:
    """The perpetuals desk on the rules the mechanics tests were written for."""
    return Settings(
        _env_file=None,
        market="perps",
        capital=1000.0,
        fear_greed=False,
        timeframe="1h",
        reward_risk=2.0,
        breakout_lookback=0,
        atr_stop_mult=2.0,
        # the sizing arithmetic counts in 1% steps; the desk's own 1.5% has its own test
        perps_risk_per_trade_pct=1.0,
        perps_max_drawdown_pct=15.0,
    )


@pytest.fixture
def cfg() -> Settings:
    # The market-regime filter needs a BTC series; tests that use it switch it on.
    return Settings(
        _env_file=None,
        capital=1000.0,
        quote="USDC",
        fee_rate=0.001,
        regime_filter=False,
        fear_greed=False,  # tests never touch the network
        # The mechanics tests were written for these rules; the defaults may move on.
        timeframe="1h",
        reward_risk=2.0,
        breakout_lookback=0,
        regime_strict=False,
        atr_stop_mult=2.0,
    )
