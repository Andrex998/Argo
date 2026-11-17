"""Scout: scans the most liquid markets for unusual volume with price moving up.

Pure arithmetic, no LLM: it runs on every market every cycle, so it has to be
free, fast and repeatable (the backtest calls the same `evaluate`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from statistics import fmean

from desk.config import Settings
from desk.market import Market, MarketError, MarketUnavailable
from desk.models import Candidate, Candle

SURGE = 3  # candles that make up "right now"
BASELINE = 48  # candles the surge is measured against
MIN_CANDLES = 60
CONNECTION_LOST = 3  # unreachable markets in a row that mean the connection is down


@dataclass(slots=True)
class Scan:
    scanned: int = 0
    failed: int = 0
    candidates: list[Candidate] = field(default_factory=list)
    candles: dict[str, list[Candle]] = field(default_factory=dict)


def evaluate(
    symbol: str, candles: list[Candle], quote_volume: float, cfg: Settings
) -> Candidate | None:
    """Flag the market if recent volume is a multiple of its baseline and price is rising."""
    if len(candles) < MIN_CANDLES:
        return None
    baseline = fmean(c.volume for c in candles[-(SURGE + BASELINE) : -SURGE])
    if baseline <= 0:
        return None
    rvol = fmean(c.volume for c in candles[-SURGE:]) / baseline
    price = candles[-1].close
    change_recent = price / candles[-SURGE - 1].close - 1
    if rvol < cfg.rvol_min or change_recent <= 0:
        return None
    return Candidate(
        symbol=symbol,
        price=price,
        rvol=rvol,
        change_recent=change_recent,
        change_24=price / candles[-25].close - 1,
        quote_volume=quote_volume,
    )


def scan(market: Market, cfg: Settings) -> Scan:
    """Every liquid market, judged on its closed candles.

    A few markets that fail to load are skipped. Several unreachable in a row mean the
    connection is gone, not the markets, so the scan stops and says so.
    """
    result = Scan()
    unreachable = 0
    for symbol, quote_volume in market.universe():
        try:
            candles = market.candles(symbol)
        except MarketUnavailable as e:
            result.failed += 1
            unreachable += 1
            if unreachable >= CONNECTION_LOST:
                raise MarketUnavailable(
                    f"scansione interrotta dopo {result.scanned} mercati: {e}"
                ) from e
            continue
        except MarketError:
            result.failed += 1
            continue
        unreachable = 0
        result.scanned += 1
        candidate = evaluate(symbol, candles, quote_volume, cfg)
        if candidate:
            result.candidates.append(candidate)
            result.candles[symbol] = candles
    result.candidates.sort(key=lambda c: c.rvol, reverse=True)
    return result
