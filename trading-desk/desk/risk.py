"""Risk gate and exit rules.

Plain code with the final say: no agent, prompt or web page can talk its way
past these limits. Live trading and the backtest share every line.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from desk.config import Settings
from desk.models import ChartPlan, Position


@dataclass(slots=True)
class Book:
    """The desk's account as the gate sees it."""

    equity: float
    cash: float
    exposure: float  # value of all open positions (on perpetuals, their whole notional)
    open_symbols: frozenset[str]
    day_start_equity: float
    peak_equity: float
    halted: str = ""  # reason trading is stopped; empty when allowed
    cooldowns: dict[str, float] = field(default_factory=dict)  # symbol -> barred until
    fresh: bool = True  # False when a price came from the last valuation, not the exchange
    margin: float = 0.0  # margin tied up by open perpetual positions; 0 on spot


@dataclass(slots=True)
class RiskDecision:
    action: Literal["APPROVE", "REDUCE", "REJECT"]
    qty: float = 0.0
    notional: float = 0.0
    reasons: list[str] = field(default_factory=list)

    @property
    def approved(self) -> bool:
        return self.action != "REJECT"


def affordable(cash: float, cfg: Settings) -> float:
    """Largest notional that cash can pay for once slippage and the fee are added."""
    return cash / ((1 + cfg.slippage) * (1 + cfg.fee_rate))


def blocked(book: Book, cfg: Settings) -> str:
    """Why the desk may not open anything right now, or '' if it may."""
    if book.halted:
        return f"desk fermo: {book.halted}"
    if not book.fresh:
        # The day's loss and the drawdown would be measured on old prices.
        return "prezzo di una posizione aperta non disponibile: limiti di perdita non verificabili"
    if book.peak_equity > 0:
        drawdown = (1 - book.equity / book.peak_equity) * 100
        if drawdown >= cfg.max_drawdown_pct:
            return f"drawdown {drawdown:.1f}% oltre il limite {cfg.max_drawdown_pct:.1f}%"
    if book.day_start_equity > 0:
        day_loss = (1 - book.equity / book.day_start_equity) * 100
        if day_loss >= cfg.max_daily_loss_pct:
            return (
                f"perdita giornaliera {day_loss:.1f}% oltre il limite {cfg.max_daily_loss_pct:.1f}%"
            )
    if len(book.open_symbols) >= cfg.max_open_positions:
        return f"già {len(book.open_symbols)} posizioni aperte (massimo {cfg.max_open_positions})"
    return ""


def evaluate(
    plan: ChartPlan, book: Book, cfg: Settings, now: float, size_factor: float = 1.0
) -> RiskDecision:
    """Approve, shrink or reject a trade. The stop distance sets the size."""
    if reason := refusal(plan, book, cfg, now, cfg.fee_rate):
        return RiskDecision("REJECT", reasons=[reason])
    caps = [
        (book.equity * cfg.max_position_pct / 100 * size_factor, "limite per posizione"),
        (book.equity * cfg.max_exposure_pct / 100 - book.exposure, "limite di esposizione"),
        (affordable(book.cash, cfg), "liquidità disponibile"),
    ]
    return sized(at_risk(plan, book, cfg, size_factor), caps, plan.entry, cfg)


def refusal(plan: ChartPlan, book: Book, cfg: Settings, now: float, fee_rate: float) -> str:
    """Why the gate refuses the plan before sizing it, or '' if it may be sized.
    `fee_rate` is the venue's taker fee: spot and perpetuals charge differently."""
    if reason := blocked(book, cfg):
        return reason
    if plan.symbol in book.open_symbols:
        return "posizione già aperta su questo mercato"
    if book.cooldowns.get(plan.symbol, 0) > now:
        return "mercato in pausa dopo un'uscita in perdita"
    if not plan.valid:
        return plan.reasons[0]
    if plan.risk_per_unit <= 0:
        return "stop non valido"
    # A tight stop on an expensive venue loses to fees even when the idea is right.
    cost_r = 2 * (fee_rate + cfg.slippage) * plan.entry / plan.risk_per_unit
    if cost_r > cfg.max_cost_r:
        return f"commissioni e slippage al {cost_r:.0%} del rischio (massimo {cfg.max_cost_r:.0%})"
    return ""


def at_risk(plan: ChartPlan, book: Book, cfg: Settings, size_factor: float = 1.0) -> float:
    """The notional that loses risk_per_trade_pct of equity if the stop is hit."""
    risk_budget = book.equity * cfg.risk_per_trade_pct / 100 * size_factor
    return risk_budget / plan.risk_per_unit * plan.entry


def sized(
    notional: float, caps: list[tuple[float, str]], price: float, cfg: Settings
) -> RiskDecision:
    """Shrink `notional` to every cap it exceeds, saying which, and buy it at `price`.
    A size under the exchange's minimum is rejected."""
    reasons = []
    for cap, label in caps:
        if notional > cap:
            notional = cap
            reasons.append(f"ridotta al {label}")
    if notional < cfg.min_notional:
        return RiskDecision(
            "REJECT",
            reasons=[f"size {max(notional, 0):.2f} sotto il minimo {cfg.min_notional:.2f}"],
        )
    return RiskDecision("REDUCE" if reasons else "APPROVE", notional / price, notional, reasons)


@dataclass(frozen=True, slots=True)
class Exit:
    reason: str
    price: float


def check_exit(
    pos: Position,
    *,
    open_: float,
    high: float,
    low: float,
    close: float,
    now: float,
    cfg: Settings,
) -> Exit | None:
    """Advance a position by one observation (a live tick or a closed candle).

    The stop is tested before the high is used, so a candle that touches both is
    counted as a loss. Updates `pos.stop` and `pos.highest` in place.
    """
    if low <= pos.stop:
        if pos.stop <= pos.initial_stop:
            reason = "stop-loss"
        elif pos.highest >= pos.target:
            reason = "trailing-stop"
        else:
            reason = "pareggio"
        return Exit(reason, min(pos.stop, open_))  # a gap fills at the open, not at the stop

    pos.highest = max(pos.highest, high)
    r = pos.risk_per_unit
    if pos.highest >= pos.entry_price + r:  # +1R: the trade can no longer lose
        pos.stop = max(pos.stop, pos.entry_price * (1 + 2 * cfg.fee_rate))
    if pos.highest >= pos.target:  # target reached: let it run, trailing 1R behind
        pos.stop = max(pos.stop, pos.highest - r)

    stale = now - pos.entry_ts >= cfg.max_hold_hours * 3600
    if stale and close < pos.entry_price + 0.5 * r:
        return Exit("tempo scaduto", close)
    return None
