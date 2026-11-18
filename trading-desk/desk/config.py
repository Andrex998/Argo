"""Desk settings. Every value can be overridden in `.env` with the `DESK_` prefix."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The perpetuals desk (DESK_MARKET=perps) reads USDT-margined perpetuals through public
# data only, no API key. Bybit by default: the owner's PC cannot reach Binance at all.
PERPS_EXCHANGE = "bybit"  # also tested by its unified API: okx, binanceusdm
PERPS_QUOTE = "USDT"  # quote and settlement currency of its contracts

# Coins the leverage simulation may shadow, and the only coins the perpetuals desk
# trades: large, established, with deep perpetual markets. Memecoins (DOGE, PEPE, TRUMP,
# PENGU, ...) are left out on purpose, and so is any coin not named here, since new
# memecoins keep entering the most traded pairs.
LEVERAGE_BASES = (
    "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "AVAX", "LINK", "LTC", "BCH", "DOT", "TRX",
    "TON", "XLM", "XMR", "ZEC", "ETC", "ATOM", "NEAR", "SUI", "APT", "ARB", "OP", "AAVE",
    "UNI", "HBAR", "ICP", "INJ", "TAO", "ENA", "CRV", "FIL", "HYPE", "QNT",
)  # fmt: skip


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="DESK_", extra="ignore", populate_by_name=True
    )

    # --- Where and how much -------------------------------------------------
    mode: Literal["paper", "live"] = "paper"
    # spot: buys and sells coins. perps: long and short on perpetual futures, paper only.
    market: Literal["spot", "perps"] = "spot"
    exchange: str = "kraken"  # any ccxt exchange id: kraken, binance, bybit, okx, ...
    quote: str = "USD"  # quote currency of the pairs to trade
    capital: float = 1000.0  # the only money the desk may deploy, in quote currency
    data_dir: Path = Path("data")

    # --- Scout: what counts as "unusual movement" ---------------------------
    timeframe: str = "4h"  # fewer, larger moves: fees weigh less than on 1h
    universe_size: int = 40  # most liquid pairs scanned each cycle
    min_quote_volume: float = 1_000_000  # 24h volume floor, in quote currency
    rvol_min: float = 2.0  # recent volume vs. its own baseline
    max_candidates: int = 2  # setups sent to the (paid) LLM analysts per cycle

    # --- Charts: trade plan --------------------------------------------------
    atr_stop_mult: float = 3.0  # 3 years of 4h candles: 2 ATR broke even after fees, 3 ATR did not
    min_stop_pct: float = 1.5
    max_stop_pct: float = 8.0
    reward_risk: float = 3.0
    rsi_max: float = 80.0
    breakout_lookback: int = 20  # the close must clear the high of that many candles (0: off)

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
    regime_strict: bool = True  # no new longs unless BTC is in an uptrend (False: unless falling)
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
    # "claude-code": the analysts run through Claude Code on this PC, on the owner's Claude
    # subscription, with no API key. "api": the Anthropic API with ANTHROPIC_API_KEY.
    # "off": no analysts on either desk.
    analysts: Literal["api", "claude-code", "off"] = "api"
    # The perpetuals desk was tested on its rules alone: the analysts join it only when
    # this says so, and a value that cannot be read leaves them out.
    perps_analysts: bool = False
    claude_code_path: str = ""  # empty: claude.exe where npm or the installer put it, or PATH
    claude_code_model: str = "sonnet"  # an alias Claude Code understands
    claude_code_timeout: float = Field(default=180.0, ge=10.0, le=900.0)  # seconds a question
    # The subscription is shared with the owner's own use of Claude: each market discussed
    # costs four calls, so the analysts take at most this many markets, both desks together.
    analyst_max_per_hour: int = Field(default=3, ge=0, le=30)
    analyst_max_per_day: int = Field(default=20, ge=0, le=300)

    # --- Loop: a full cycle runs at every candle close ------------------------
    monitor_seconds: int = 60  # how often open positions are checked in between

    # --- Simulated leverage: shadow books on perpetuals, never real orders ----
    # x1 is the same contract without leverage: it separates the fee saving from leverage itself.
    leverage_levels: list[float] = Field(default_factory=lambda: [1.0, 3.0, 5.0, 10.0, 15.0, 20.0])
    leverage_bases: list[str] = Field(default_factory=lambda: list(LEVERAGE_BASES))
    futures_fee_rate: float = 0.0005  # taker fee on the whole notional (Kraken Futures, Bybit)
    funding_rate_8h: float = 0.0001  # a long pays 0.01% of the notional every 8 hours
    maintenance_margin: float = (
        0.01  # 1%: typical for altcoins; liquidation comes before 1/leverage
    )

    # --- Perpetuals desk (DESK_MARKET=perps): paper only, long and short ------
    # research/perps.py's "full size". The risk per trade stays risk_per_trade_pct at the
    # stop; leverage only lets a position reach that size with less margin tied up.
    perps_exchange: str = PERPS_EXCHANGE  # ccxt id of the venue whose perpetuals are read
    perps_fee_rate: float = 0.00055  # taker fee on the whole notional (Bybit 0.055%)
    perps_cap_position_pct: float = 33.0  # notional of one position, % of equity
    perps_cap_total_pct: float = 150.0  # notional of all positions together, % of equity
    perps_max_leverage: float = Field(default=3.0, ge=1.0, le=20.0)
    perps_oi_filter: bool = True  # enter only while the coin's open interest grew over 24h

    # --- Live page: a snapshot of the desk every minute (optional) ----------
    live_url: str = ""  # https://<progetto>.supabase.co
    live_key: str = ""  # the project's publishable (anon) key: public by design
    live_token: str = ""  # the desk's own write token: keep it out of the repository

    # --- Live trading credentials (trade-only key, withdrawals disabled) ----
    exchange_api_key: str = ""
    exchange_api_secret: str = ""
    exchange_api_password: str = ""  # passphrase, only for exchanges that use one

    @field_validator("analysts", mode="before")
    @classmethod
    def _analysts(cls, value: object) -> str:
        """`DESK_ANALYSTS` as written in .env: case, spaces and an underscore do not matter,
        and anything unknown switches the analysts off instead of stopping the desks."""
        name = str(value).strip().lower().replace("_", "-")
        if name in ("api", "claude-code", "off"):
            return name
        print(f"DESK_ANALYSTS={value!r} non riconosciuto (claude-code, api, off): analisti spenti.")
        return "off"

    @field_validator(
        "perps_analysts",
        "claude_code_timeout",
        "analyst_max_per_hour",
        "analyst_max_per_day",
        mode="wrap",
    )
    @classmethod
    def _or_default(cls, value: object, handler, info: ValidationInfo) -> object:
        """A typo or an absurd value in the analysts' keys must not stop the desks (they
        would restart every 30 seconds for ever): the default stands in, and the console
        says so. For the perpetuals' switch the default is off."""
        try:
            return handler(value)
        except ValidationError:
            default = cls.model_fields[info.field_name].default
            print(f"DESK_{info.field_name.upper()}={value!r} non valido: uso {default!r}.")
            return default

    @model_validator(mode="after")
    def _perps_venue(self) -> Settings:
        """The perpetuals desk always reads USDT perpetuals on `perps_exchange`, whatever
        exchange and currency the spot desk takes from the same .env."""
        if self.market == "perps":
            self.exchange, self.quote = self.perps_exchange, PERPS_QUOTE
        return self

    @property
    def db_path(self) -> Path:
        """One database per desk: the perpetuals desk keeps its own, so both run at once."""
        suffix = "-perps" if self.market == "perps" else ""
        return self.data_dir / f"desk-{self.mode}{suffix}.db"

    @property
    def slippage(self) -> float:
        return self.slippage_bps / 10_000
