"""The perpetuals desk's rules: long and short on USDⓈ-M perpetual futures, paper only.

Every rule here is the one research/perps.py replayed on three years of Binance candles
with the real funding rates. Longs use the desk's own Scout and Charts. Shorts use the
same rules mirrored: a volume surge on a falling price, a downtrend, a close under the
lowest low of the previous candles, the stop above and the target below. BTC's trend
picks the side: longs while it rises, shorts while it falls, nothing while it drifts.
Memecoins and any coin outside `leverage_bases` are never traded here.

Sizing stays the desk's: risk_per_trade_pct of equity lost at the stop. Leverage does
not raise that risk. It only lets a position reach that size with less margin tied up,
and never goes above `perps_max_leverage`. The margin is isolated: a position can lose
its margin, never more.
"""

from __future__ import annotations

from desk import leverage, risk
from desk.agents import charts, scout
from desk.config import Settings
from desk.indicators import atr, ema, rsi
from desk.models import SIGN, Candidate, Candle, ChartPlan, PerpPosition, Side

FUNDING_PERIOD = 8 * 3600  # the usual interval: 00:00, 08:00 and 16:00 UTC
SIDE_NAME = {"long": "LONG", "short": "SHORT"}


def leader(cfg: Settings) -> str:
    """The contract whose trend picks the side: BTC/USDT:USDT."""
    return f"BTC/{cfg.quote}:{cfg.quote}"


# --- one rule written once for both sides -----------------------------------------------------


def reached(sign: int, price: float, level: float) -> bool:
    """Whether `price` is at or beyond `level` going up (sign +1) or down (sign -1)."""
    return price >= level if sign > 0 else price <= level


def better(sign: int, a: float, b: float) -> float:
    """The better of two prices for a position: the higher for a long, the lower for a short."""
    return max(a, b) if sign > 0 else min(a, b)


def worse(sign: int, a: float, b: float) -> float:
    return min(a, b) if sign > 0 else max(a, b)


# --- which side, which markets, which setups --------------------------------------------------


def regime(candles: list[Candle]) -> int:
    """The side BTC's trend allows: +1 (longs) while it rises, -1 (shorts) while it falls,
    0 (nothing) while it drifts sideways or there are too few candles to tell."""
    if len(candles) < charts.SLOW:
        return 0
    closes = [c.close for c in candles]
    trend = charts.trend_of(closes[-1], ema(closes, charts.FAST), ema(closes, charts.SLOW))
    return {"up": 1, "down": -1}.get(trend, 0)


def signal(
    symbol: str, candles: list[Candle], quote_volume: float, cfg: Settings
) -> Candidate | None:
    """The Scout both ways: a volume surge on a rising price (long) or a falling one (short)."""
    return scout.evaluate(symbol, candles, quote_volume, cfg) or scout.evaluate(
        symbol, candles, quote_volume, cfg, side="short"
    )


def plan(candidate: Candidate, candles: list[Candle], cfg: Settings) -> ChartPlan:
    """Charts for a long, Charts mirrored for a short."""
    if candidate.side == "long":
        return charts.plan(candidate.symbol, candles, cfg)
    return short_plan(candidate.symbol, candles, cfg)


def short_plan(symbol: str, candles: list[Candle], cfg: Settings) -> ChartPlan:
    """Charts mirrored, rule by rule: a downtrend, not oversold, the stop a volatility-sized
    distance above the entry, no support within 1R below, a close under the recent lows."""
    closes = [c.close for c in candles]
    entry = closes[-1]
    ema_fast, ema_slow = ema(closes, charts.FAST), ema(closes, charts.SLOW)
    rsi_now, atr_now = rsi(closes), atr(candles)
    trend = charts.trend_of(entry, ema_fast, ema_slow)
    stop_distance = max(cfg.atr_stop_mult * atr_now, entry * cfg.min_stop_pct / 100)
    support = min(c.low for c in candles[-charts.RANGE : -scout.SURGE])

    reasons: list[str] = []
    if trend != "down":
        reasons.append(
            f"trend {trend}: serve prezzo sotto EMA{charts.SLOW} ed EMA{charts.FAST} "
            f"sotto EMA{charts.SLOW}"
        )
    if rsi_now < 100 - cfg.rsi_max:
        reasons.append(f"RSI {rsi_now:.0f} sotto {100 - cfg.rsi_max:.0f}: ipervenduto")
    if stop_distance / entry * 100 > cfg.max_stop_pct:
        reasons.append(
            f"stop al {stop_distance / entry * 100:.1f}% oltre il massimo {cfg.max_stop_pct:.1f}%"
        )
    if entry > support > entry - stop_distance:
        reasons.append("supporto a meno di 1R sotto l'entrata")
    if cfg.breakout_lookback:
        prior_low = min(c.low for c in candles[-cfg.breakout_lookback - 1 : -1])
        if entry >= prior_low:
            reasons.append(
                f"nessuna rottura: chiusura sopra il minimo delle {cfg.breakout_lookback} "
                "candele precedenti"
            )

    return ChartPlan(
        symbol=symbol,
        trend=trend,
        entry=entry,
        stop=entry + stop_distance,
        target=entry - cfg.reward_risk * stop_distance,
        atr=atr_now,
        rsi=rsi_now,
        ema_fast=ema_fast,
        ema_slow=ema_slow,
        support=support,
        resistance=max(c.high for c in candles[-charts.SWING :]),
        reasons=reasons,
        side="short",
    )


def evaluate(
    plan: ChartPlan, book: risk.Book, cfg: Settings, now: float, size_factor: float = 1.0
) -> risk.RiskDecision:
    """The risk gate on perpetuals: the spot desk's refusals, with the perpetuals' fee, and
    the same risk at the stop. The caps are on the notional: one position, all of them
    together, and what the free margin can carry at the highest leverage. `size_factor`
    is the Chief's conviction: low conviction halves the risk and the position cap."""
    if not leverage.allowed(plan.symbol, cfg):
        coin = leverage.base(plan.symbol)
        reason = f"{coin} non è tra le monete ammesse: niente perpetui sulle memecoin"
        return risk.RiskDecision("REJECT", reasons=[reason])
    if reason := risk.refusal(plan, book, cfg, now, cfg.perps_fee_rate):
        return risk.RiskDecision("REJECT", reasons=[reason])
    caps = [
        (book.equity * cfg.perps_cap_position_pct / 100 * size_factor, "limite per posizione"),
        (book.equity * cfg.perps_cap_total_pct / 100 - book.exposure, "limite di esposizione"),
        ((book.equity - book.margin) * cfg.perps_max_leverage, "margine disponibile"),
    ]
    # Sized at the price it will fill at, slippage included, as the research does.
    fill = plan.entry * (1 + SIGN[plan.side] * cfg.slippage)
    return risk.sized(risk.at_risk(plan, book, cfg, size_factor), caps, fill, cfg)


def open_interest_veto(growth: float | None) -> str:
    """research/derivs.py's rule C: enter only while new money comes in, that is while the
    open interest grew over the last 24 hours. Without a reading there is no opinion.
    Returns why the setup is skipped, or ''."""
    if growth is None or growth > 0:
        return ""
    trend = "in calo" if growth < 0 else "ferme"
    return f"posizioni aperte sul mercato {trend} nelle ultime 24 ore ({growth:+.1%})"


# --- margin, leverage, liquidation ------------------------------------------------------------


def margin_for(notional: float, book: risk.Book, cfg: Settings) -> tuple[float, float]:
    """The margin a new position puts up, and the leverage that takes it to `notional`.

    A position puts up at most what the largest one allowed needs at the highest leverage
    (33% of equity at x3: 11%), and never more than the free margin. Within that it takes
    as little leverage as reaches its size: x1 when the margin covers the whole notional.
    The gate's caps make sure the leverage never exceeds `perps_max_leverage`.
    """
    allowance = book.equity * cfg.perps_cap_position_pct / 100 / cfg.perps_max_leverage
    margin = min(notional, allowance, book.equity - book.margin)
    return margin, notional / margin


def liquidation_price(entry: float, side: Side, leverage_: float, maintenance: float) -> float:
    """Isolated margin: where the exchange closes the position and keeps its margin.
    A long at x3 goes at entry x (1 - (1/3 - maintenance)), a short at entry x (1 + ...)."""
    return entry * (1 - SIGN[side] * (1 / leverage_ - maintenance))


def liquidated(pos: PerpPosition, *, open_: float, high: float, low: float) -> bool:
    """Whether a candle, or a tick (open = high = low), liquidates the position before the
    desk's stop can close it. Moving against the position the price meets the nearer of
    the two first; a candle that opens beyond the liquidation price is liquidated at once."""
    s = pos.sign
    if not reached(-s, low if s > 0 else high, pos.liquidation):
        return False
    return reached(-s, open_, pos.liquidation) or reached(s, pos.liquidation, pos.stop)


# --- exits ------------------------------------------------------------------------------------


def check_exit(
    pos: PerpPosition,
    *,
    open_: float,
    high: float,
    low: float,
    close: float,
    now: float,
    cfg: Settings,
) -> risk.Exit | None:
    """risk.check_exit for both sides: the stop first, breakeven at +1R, trailing 1R behind
    the best price once the target is reached, a stale trade closed after max_hold_hours.
    Moves `pos.stop` and `pos.best` in place."""
    s, r = pos.sign, pos.risk_per_unit
    favourable, adverse = (high, low) if s > 0 else (low, high)
    if reached(-s, adverse, pos.stop):
        if reached(-s, pos.stop, pos.initial_stop):
            reason = "stop-loss"
        elif reached(s, pos.best, pos.target):
            reason = "trailing-stop"
        else:
            reason = "pareggio"
        return risk.Exit(reason, worse(s, pos.stop, open_))  # a gap fills at the open

    pos.best = better(s, pos.best, favourable)
    if reached(s, pos.best, pos.entry_price + s * r):  # +1R: the trade can no longer lose
        pos.stop = better(s, pos.stop, pos.entry_price * (1 + s * 2 * cfg.perps_fee_rate))
    if reached(s, pos.best, pos.target):  # target reached: let it run, trailing 1R behind
        pos.stop = better(s, pos.stop, pos.best - s * r)

    stale = now - pos.entry_ts >= cfg.max_hold_hours * 3600
    if stale and not reached(s, close, pos.entry_price + s * 0.5 * r):
        return risk.Exit("tempo scaduto", close)
    return None


# --- funding ----------------------------------------------------------------------------------


def funding_times(since: float, until: float, period: float = FUNDING_PERIOD) -> list[float]:
    """The funding settlements after `since` and up to `until` (seconds), every `period`
    seconds from midnight UTC: Bybit settles some contracts every 4 hours or every hour."""
    times, t = [], (since // period + 1) * period
    while t <= until:
        times.append(t)
        t += period
    return times


def funding(pos: PerpPosition, price: float, rate: float) -> float:
    """What one settlement costs the position, on its notional: positive is paid, negative
    received. A positive rate makes longs pay shorts; a negative one, shorts pay longs."""
    return pos.sign * pos.qty * price * rate
