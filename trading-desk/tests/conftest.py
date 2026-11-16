"""Synthetic markets and stand-ins for the exchange and the LLM."""

from __future__ import annotations

import pytest

from desk.config import Settings
from desk.market import MarketError
from desk.models import Candle

HOUR_MS = 3_600_000


def series(closes: list[float], volumes: list[float], start_ts: int = 0) -> list[Candle]:
    candles, prev = [], closes[0]
    for i, (close, volume) in enumerate(zip(closes, volumes, strict=True)):
        candles.append(
            Candle(
                start_ts + i * HOUR_MS,
                prev,
                max(prev, close) * 1.002,
                min(prev, close) * 0.998,
                close,
                volume,
            )
        )
        prev = close
    return candles


def zigzag(n: int, start: float, up: float, down: float) -> list[float]:
    """Alternate one move of `up` with one of `down` (both as fractions)."""
    closes, price = [], start
    for i in range(n):
        price *= 1 + (up if i % 2 == 0 else down)
        closes.append(price)
    return closes


def breakout(n: int = 120, surge_volume: float = 4000.0) -> list[Candle]:
    """Steady uptrend, then three strong candles on four times the usual volume."""
    closes = zigzag(n - 3, 100.0, 0.005, -0.003)
    for _ in range(3):
        closes.append(closes[-1] * 1.01)
    return series(closes, [1000.0] * (n - 3) + [surge_volume] * 3)


def quiet(n: int = 120) -> list[Candle]:
    return series(zigzag(n, 100.0, 0.005, -0.003), [1000.0] * n)


def dump(n: int = 120) -> list[Candle]:
    """Downtrend ending in a high-volume sell-off."""
    closes = zigzag(n - 3, 100.0, -0.005, 0.003)
    for _ in range(3):
        closes.append(closes[-1] * 0.99)
    return series(closes, [1000.0] * (n - 3) + [4000.0] * 3)


class FakeMarket:
    def __init__(self, data: dict[str, list[Candle]]):
        self.data = data
        self.prices = {symbol: candles[-1].close for symbol, candles in data.items()}

    def universe(self) -> list[tuple[str, float]]:
        return [(symbol, 10_000_000.0) for symbol in self.data]

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        if symbol not in self.data:
            raise MarketError(f"{symbol}: mercato non disponibile")
        return self.data[symbol][-limit:]

    def price(self, symbol: str) -> float:
        return self.prices[symbol]


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


@pytest.fixture
def cfg() -> Settings:
    # The market-regime filter needs a BTC series; tests that use it switch it on.
    return Settings(
        _env_file=None, capital=1000.0, quote="USDC", fee_rate=0.001, regime_filter=False
    )
