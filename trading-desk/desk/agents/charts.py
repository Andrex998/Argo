"""Charts: reads the trend and maps entry, stop and target before any trade.

Levels come from code, not from a model looking at numbers: they must be exact
and identical in live trading and in the backtest.
"""

from __future__ import annotations

from typing import Literal

from desk.agents.scout import SURGE
from desk.config import Settings
from desk.indicators import atr, ema, rsi
from desk.models import Candle, ChartPlan

FAST, SLOW = 20, 50
SWING = 10  # candles defining the nearest support
RANGE = 60  # candles defining the range the surge started from


def trend_of(price: float, ema_fast: float, ema_slow: float) -> Literal["up", "down", "sideways"]:
    if price > ema_slow and ema_fast > ema_slow:
        return "up"
    if price < ema_slow and ema_fast < ema_slow:
        return "down"
    return "sideways"


def market_falling(candles: list[Candle], strict: bool = False) -> bool:
    """True when the market leader rules out new longs: in a downtrend, or, when `strict`,
    in anything short of an uptrend (a sideways leader blocks too)."""
    closes = [c.close for c in candles]
    trend = trend_of(closes[-1], ema(closes, FAST), ema(closes, SLOW))
    return trend != "up" if strict else trend == "down"


def plan(symbol: str, candles: list[Candle], cfg: Settings) -> ChartPlan:
    closes = [c.close for c in candles]
    entry = closes[-1]
    ema_fast, ema_slow = ema(closes, FAST), ema(closes, SLOW)
    rsi_now, atr_now = rsi(closes), atr(candles)
    trend = trend_of(entry, ema_fast, ema_slow)

    # The stop sits a volatility-sized distance below entry, never tighter than the floor.
    stop_distance = max(cfg.atr_stop_mult * atr_now, entry * cfg.min_stop_pct / 100)
    resistance = max(c.high for c in candles[-RANGE:-SURGE])

    reasons: list[str] = []
    if trend != "up":
        reasons.append(f"trend {trend}: serve prezzo sopra EMA{SLOW} ed EMA{FAST} sopra EMA{SLOW}")
    if rsi_now > cfg.rsi_max:
        reasons.append(f"RSI {rsi_now:.0f} oltre {cfg.rsi_max:.0f}: ipercomprato")
    if stop_distance / entry * 100 > cfg.max_stop_pct:
        reasons.append(
            f"stop al {stop_distance / entry * 100:.1f}% oltre il massimo {cfg.max_stop_pct:.1f}%"
        )
    if entry < resistance < entry + stop_distance:
        reasons.append("resistenza a meno di 1R sopra l'entrata")
    if cfg.breakout_lookback:
        prior_high = max(c.high for c in candles[-cfg.breakout_lookback - 1 : -1])
        if entry <= prior_high:
            reasons.append(
                f"nessuna rottura: chiusura sotto il massimo delle {cfg.breakout_lookback} "
                "candele precedenti"
            )

    return ChartPlan(
        symbol=symbol,
        trend=trend,
        entry=entry,
        stop=entry - stop_distance,
        target=entry + cfg.reward_risk * stop_distance,
        atr=atr_now,
        rsi=rsi_now,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        support=min(c.low for c in candles[-SWING:]),
        resistance=resistance,
        reasons=reasons,
    )
