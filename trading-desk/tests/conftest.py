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
