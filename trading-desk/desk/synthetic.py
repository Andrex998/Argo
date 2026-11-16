"""Made-up candle series with known shapes, for the tests and the dashboard demo."""

from __future__ import annotations

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


def breakout(n: int = 120, surge_volume: float = 4000.0, start: float = 100.0) -> list[Candle]:
    """Steady uptrend, then three strong candles on a multiple of the usual volume."""
    closes = zigzag(n - 3, start, 0.005, -0.003)
    for _ in range(3):
        closes.append(closes[-1] * 1.01)
    return series(closes, [1000.0] * (n - 3) + [surge_volume] * 3)


def quiet(n: int = 120, start: float = 100.0) -> list[Candle]:
    return series(zigzag(n, start, 0.005, -0.003), [1000.0] * n)


def dump(n: int = 120) -> list[Candle]:
    """Downtrend ending in a high-volume sell-off."""
    closes = zigzag(n - 3, 100.0, -0.005, 0.003)
    for _ in range(3):
        closes.append(closes[-1] * 0.99)
    return series(closes, [1000.0] * (n - 3) + [4000.0] * 3)


def bounce(n: int = 120, surge_volume: float = 3000.0, start: float = 100.0) -> list[Candle]:
    """Downtrend, then three rising candles on high volume: noticed, but not a setup."""
    closes = zigzag(n - 3, start, -0.005, 0.003)
    for _ in range(3):
        closes.append(closes[-1] * 1.01)
    return series(closes, [1000.0] * (n - 3) + [surge_volume] * 3)
