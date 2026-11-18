"""Desk settings. Every value can be overridden in `.env` with the `DESK_` prefix."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="DESK_", extra="ignore", populate_by_name=True
    )

    # --- Where and how much -------------------------------------------------
    mode: Literal["paper", "live"] = "paper"
    exchange: str = "kraken"  # any ccxt exchange id: kraken, binance, bybit, okx, ...
    quote: str = "USD"  # quote currency of the pairs to trade
    capital: float = 1000.0  # the only money the desk may deploy, in quote currency
    data_dir: Path = Path("data")

    # --- Scout: what counts as "unusual movement" ---------------------------
    timeframe: str = "1h"
    universe_size: int = 40  # most liquid pairs scanned each cycle
    min_quote_volume: float = 1_000_000  # 24h volume floor, in quote currency
    rvol_min: float = 2.0  # recent volume vs. its own baseline
    max_candidates: int = 2  # setups sent to the (paid) LLM analysts per cycle

    # --- Charts: trade plan --------------------------------------------------
    atr_stop_mult: float = 2.0
    min_stop_pct: float = 1.5
    max_stop_pct: float = 8.0
    reward_risk: float = 2.0
    rsi_max: float = 80.0

    # --- Risk gate: hard limits no agent can override -----------------------
    risk_per_trade_pct: float = 1.0  # equity lost if the stop is hit
    max_position_pct: float = 10.0  # equity in a single position
    max_exposure_pct: float = 50.0  # equity in all positions together
    max_open_positions: int = 5
    max_daily_loss_pct: float = 3.0  # no new entries for the rest of the UTC day
    max_drawdown_pct: float = 15.0  # halts the desk until `desk resume`
    min_notional: float = 10.0
    max_cost_r: float = 0.33  # round-trip fees and slippage as a share of the amount at risk
    regime_filter: bool = True  # no new longs while BTC itself is in a downtrend
    cooldown_hours: float = 12.0  # no re-entry on a symbol after a losing exit
    max_hold_hours: float = 72.0  # stale positions are closed

    # --- Costs (set fee_rate to your exchange's real taker fee) -------------
    fee_rate: float = 0.004  # Kraken taker fee at the entry tier
    slippage_bps: float = 10.0

    # --- LLM analysts --------------------------------------------------------
    model: str = "claude-opus-5-5"
    language: str = "italiano"
    min_confidence: float = 0.6
    reanalyze_hours: float = 6.0  # don't pay to re-analyse a symbol just judged
    max_searches: int = 3  # web searches per research agent
    fear_greed: bool = True  # give the Sentiment analyst the public Fear & Greed index
    refusal_fallback: bool = True  # let the API retry a declined request on a fallback model
    anthropic_api_key: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")

    # --- Loop: a full cycle runs at every candle close ------------------------
    monitor_seconds: int = 60  # how often open positions are checked in between

    # --- Live page: a snapshot of the desk every minute (optional) ----------
    live_url: str = ""  # https://<progetto>.supabase.co
    live_key: str = ""  # the project's publishable (anon) key: public by design
    live_token: str = ""  # the desk's own write token: keep it out of the repository

    # --- Live trading credentials (trade-only key, withdrawals disabled) ----
    exchange_api_key: str = ""
    exchange_api_secret: str = ""
    exchange_api_password: str = ""  # passphrase, only for exchanges that use one

    @property
    def db_path(self) -> Path:
        return self.data_dir / f"desk-{self.mode}.db"

    @property
    def slippage(self) -> float:
        return self.slippage_bps / 10_000
