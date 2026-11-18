"""Shared data types.

Dataclasses carry what the deterministic code computes; pydantic models are the
structured answers the LLM analysts must return.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel

Side = Literal["long", "short"]
SIGN = {"long": 1, "short": -1}  # a long gains when the price rises, a short when it falls


@dataclass(frozen=True, slots=True)
class Candle:
    ts: int  # open time, milliseconds
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(slots=True)
class Candidate:
    """A market the Scout flagged for unusual activity."""

    symbol: str
    price: float
    rvol: float  # recent volume / baseline volume
    change_recent: float  # price change over the surge window
    change_24: float  # price change over the last 24 candles
    quote_volume: float  # 24h traded volume in quote currency
    side: Side = "long"  # short: a surge on a falling price (perpetuals only)


@dataclass(slots=True)
class ChartPlan:
    """Trend read and trade plan from the Charts desk."""

    symbol: str
    trend: Literal["up", "down", "sideways"]
    entry: float
    stop: float
    target: float
    atr: float
    rsi: float
    ema_fast: float
    ema_slow: float
    support: float
    resistance: float
    reasons: list[str] = field(default_factory=list)  # why the setup is rejected
    side: Side = "long"  # a short has its stop above the entry and its target below

    @property
    def valid(self) -> bool:
        return not self.reasons

    @property
    def risk_per_unit(self) -> float:
        return self.entry - self.stop if self.side == "long" else self.stop - self.entry

    @property
    def stop_pct(self) -> float:
        return self.risk_per_unit / self.entry * 100

    @property
    def reward_risk(self) -> float:
        reward = self.target - self.entry if self.side == "long" else self.entry - self.target
        return reward / self.risk_per_unit


@dataclass(slots=True)
class Position:
    symbol: str
    qty: float
    entry_price: float
    entry_ts: float
    cost: float  # quote currency spent to open, fees included
    stop: float
    initial_stop: float
    target: float
    highest: float

    @property
    def risk_per_unit(self) -> float:
        return self.entry_price - self.initial_stop


@dataclass(slots=True)
class PerpPosition:
    """A long or a short on a perpetual contract, with isolated margin (paper only)."""

    symbol: str
    side: Side
    qty: float
    entry_price: float
    entry_ts: float
    stop: float
    initial_stop: float
    target: float
    best: float  # the best price reached: the highest for a long, the lowest for a short
    margin: float  # what the position puts up, and all it can lose if liquidated
    leverage: float  # notional at entry / margin
    liquidation: float
    fees: float  # the entry fee
    funding: float = 0.0  # funding paid so far; negative when received
    funded_until: float = 0.0  # the last funding settlement charged
    checked: float = 0.0  # the last time the price was checked

    @property
    def sign(self) -> int:
        return SIGN[self.side]

    @property
    def risk_per_unit(self) -> float:
        return abs(self.entry_price - self.initial_stop)

    def profit(self, price: float) -> float:
        """The open profit or loss at `price`, before fees and funding."""
        return self.sign * self.qty * (price - self.entry_price)


@dataclass(slots=True)
class Fill:
    qty: float  # base units actually bought or sold
    price: float  # average fill price
    fee: float  # total fee valued in quote currency
    quote_delta: float  # change in quote cash: negative for buys


# --- LLM analyst reports ----------------------------------------------------


class Headline(BaseModel):
    title: str
    source: str
    date: str


class NewsReport(BaseModel):
    catalyst_found: bool
    catalyst: str
    impact: Literal["bullish", "bearish", "neutral", "unclear"]
    red_flags: list[str]
    headlines: list[Headline]
    summary: str
    confidence: float


class SentimentReport(BaseModel):
    mood: Literal["bullish", "bearish", "mixed", "euphoric", "quiet"]
    hype_risk: Literal["low", "medium", "high"]
    summary: str
    confidence: float


class Objection(BaseModel):
    reason: str
    evidence: str
    severity: Literal["minor", "serious", "dealbreaker"]


class SkepticReport(BaseModel):
    objections: list[Objection]
    summary: str


class Rebuttal(BaseModel):
    objection_number: int
    rebutted: bool
    argument: str


class Verdict(BaseModel):
    decision: Literal["BUY", "WAIT", "SKIP"]
    conviction: Literal["low", "medium", "high"]
    confidence: float
    rebuttals: list[Rebuttal]
    summary: str
