"""Technical indicators on plain lists. Each returns the latest value."""

from __future__ import annotations

from collections.abc import Sequence
from itertools import pairwise

from desk.models import Candle


def ema(values: Sequence[float], period: int) -> float:
    """Exponential moving average, seeded with the simple average of the first window."""
    if len(values) < period:
        raise ValueError(f"need {period} values, got {len(values)}")
    k = 2 / (period + 1)
    value = sum(values[:period]) / period
    for v in values[period:]:
        value = v * k + value * (1 - k)
    return value


def rsi(closes: Sequence[float], period: int = 14) -> float:
    """Wilder's relative strength index."""
    if len(closes) < period + 1:
        raise ValueError(f"need {period + 1} closes, got {len(closes)}")
    deltas = [b - a for a, b in pairwise(closes)]
    gain = sum(max(d, 0.0) for d in deltas[:period]) / period
    loss = sum(max(-d, 0.0) for d in deltas[:period]) / period
    for d in deltas[period:]:
        gain = (gain * (period - 1) + max(d, 0.0)) / period
        loss = (loss * (period - 1) + max(-d, 0.0)) / period
    if loss == 0:
        return 100.0 if gain > 0 else 50.0
    return 100 - 100 / (1 + gain / loss)


def atr(candles: Sequence[Candle], period: int = 14) -> float:
    """Wilder's average true range."""
    if len(candles) < period + 1:
        raise ValueError(f"need {period + 1} candles, got {len(candles)}")
    ranges = [
        max(c.high - c.low, abs(c.high - prev.close), abs(c.low - prev.close))
        for prev, c in pairwise(candles)
    ]
    value = sum(ranges[:period]) / period
    for r in ranges[period:]:
        value = (value * (period - 1) + r) / period
    return value
