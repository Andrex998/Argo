"""Shared data types.

Dataclasses carry what the deterministic code computes; pydantic models are the
structured answers the LLM analysts must return.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel


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

    @property
    def valid(self) -> bool:
        return not self.reasons

    @property
    def risk_per_unit(self) -> float:
        return self.entry - self.stop

    @property
    def stop_pct(self) -> float:
        return self.risk_per_unit / self.entry * 100

    @property
    def reward_risk(self) -> float:
        return (self.target - self.entry) / self.risk_per_unit


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
