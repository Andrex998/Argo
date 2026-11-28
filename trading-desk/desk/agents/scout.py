"""Scout: scans the most liquid markets for unusual volume with price moving up.

Pure arithmetic, no LLM: it runs on every market every cycle, so it has to be
free, fast and repeatable (the backtest calls the same `evaluate`). The perpetuals
desk also asks for the mirror image: unusual volume with the price moving down.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from statistics import fmean

from desk.config import Settings
from desk.market import Market, MarketError, MarketUnavailable
from desk.models import SIGN, Candidate, Candle, Side

SURGE = 3  # candles that make up "right now"
BASELINE = 48  # candles the surge is measured against
MIN_CANDLES = 60
CONNECTION_LOST = 3  # unreachable markets in a row that mean the connection is down
RETRY_PAUSE = 1.0  # seconds before a second try at the markets that failed once


@dataclass(slots=True)
class Scan:
    scanned: int = 0
    failed: int = 0
    candidates: list[Candidate] = field(default_factory=list)
    candles: dict[str, list[Candle]] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)  # market -> why it could not be read


def evaluate(
    symbol: str, candles: list[Candle], quote_volume: float, cfg: Settings, side: Side = "long"
) -> Candidate | None:
    """Flag the market if recent volume is a multiple of its baseline and price is rising,
    or, for a short (perpetuals only), falling."""
    if len(candles) < MIN_CANDLES:
        return None
    baseline = fmean(c.volume for c in candles[-(SURGE + BASELINE) : -SURGE])
    if baseline <= 0:
        return None
    rvol = fmean(c.volume for c in candles[-SURGE:]) / baseline
    price = candles[-1].close
    change_recent = price / candles[-SURGE - 1].close - 1
    if rvol < cfg.rvol_min or SIGN[side] * change_recent <= 0:
        return None
    return Candidate(
        symbol=symbol,
        price=price,
        rvol=rvol,
        change_recent=change_recent,
        change_24=price / candles[-25].close - 1,
        quote_volume=quote_volume,
        side=side,
    )


Judge = Callable[[str, list[Candle], float, Settings], Candidate | None]


def scan(
    market: Market,
    cfg: Settings,
    judge: Judge | None = None,
    pause: Callable[[float], None] = time.sleep,
) -> Scan:
    """Every liquid market, judged on its closed candles by `judge` (`evaluate` unless
    told otherwise).

    A market that fails to load gets a second try once the others are read: a timeout
    or a rate limit usually passes in a second. One that fails twice is skipped, and the
    scan says which and why. Several unreachable in a row mean the connection is gone,
    not the markets, so the scan stops and says so.
    """
    judge = judge or evaluate
    result = Scan()
    volumes: dict[str, float] = {}
    unreachable = 0

    def judged(symbol: str, candles: list[Candle]) -> None:
        result.scanned += 1
        candidate = judge(symbol, candles, volumes[symbol], cfg)
        if candidate:
            result.candidates.append(candidate)
            result.candles[symbol] = candles

    for symbol, quote_volume in market.universe():
        volumes[symbol] = quote_volume
        try:
            candles = market.candles(symbol)
        except MarketUnavailable as e:
            result.errors[symbol] = str(e)[:160]
            unreachable += 1
            if unreachable >= CONNECTION_LOST:
                result.failed = len(result.errors)
                raise MarketUnavailable(
                    f"scansione interrotta dopo {result.scanned} mercati: {e}"
                ) from e
            continue
        except MarketError as e:
            result.errors[symbol] = str(e)[:160]
            continue
        unreachable = 0
        judged(symbol, candles)

    if result.errors:
        pause(RETRY_PAUSE)
        for symbol in list(result.errors):
            try:
                candles = market.candles(symbol)
            except MarketError as e:
                result.errors[symbol] = str(e)[:160]
                continue
            del result.errors[symbol]
            judged(symbol, candles)
    result.failed = len(result.errors)
    result.candidates.sort(key=lambda c: c.rvol, reverse=True)
    return result
