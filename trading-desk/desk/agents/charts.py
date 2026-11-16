"""Charts: reads the trend and maps entry, stop and target before any trade.

Levels come from code, not from a model looking at numbers: they must be exact
and identical in live trading and in the backtest.
"""

from __future__ import annotations

from desk.agents.scout import SURGE
from desk.config import Settings
from desk.indicators import atr, ema, rsi
from desk.models import Candle, ChartPlan

FAST, SLOW = 20, 50
SWING = 10  # candles defining the nearest support
RANGE = 60  # candles defining the range the surge started from


def plan(symbol: str, candles: list[Candle], cfg: Settings) -> ChartPlan:
    closes = [c.close for c in candles]
    entry = closes[-1]
    ema_fast, ema_slow = ema(closes, FAST), ema(closes, SLOW)
    rsi_now, atr_now = rsi(closes), atr(candles)

    if entry > ema_slow and ema_fast > ema_slow:
        trend = "up"
    elif entry < ema_slow and ema_fast < ema_slow:
        trend = "down"
    else:
        trend = "sideways"

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
