"""Market data. `CcxtMarket` reads public exchange endpoints; no API key needed."""

from __future__ import annotations

import re
from typing import Protocol

import ccxt

from desk.config import Settings
from desk.models import Candle

# Bases that are not a directional bet: fiat and anything pegged to it. New
# stablecoins appear all the time, so any ticker containing USD or EUR is skipped too.
PEGGED = frozenset({"DAI", "GHO", "FRAX", "UST", "GBP", "AUD", "CHF", "JPY", "TRY", "BRL"})
LEVERAGED = re.compile(r"\d+[LS]$")  # BTC3L, ETH5S, ...

# Binance lists futures on separate hosts that are restricted in some regions.
# The desk trades spot only, so it never needs to load them.
SPOT_ONLY = {"binance": {"fetchMarkets": {"types": ["spot"]}}}


def is_pegged(base: str) -> bool:
    return base in PEGGED or "USD" in base or "EUR" in base


class MarketError(Exception):
    """The exchange could not be reached or returned unusable data."""


class Market(Protocol):
    def universe(self) -> list[tuple[str, float]]:
        """Most liquid tradable pairs as (symbol, 24h quote volume), largest first."""
        ...

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        """Latest closed candles, oldest first."""
        ...

    def price(self, symbol: str) -> float: ...


def make_exchange(cfg: Settings, *, authenticated: bool = False) -> ccxt.Exchange:
    if cfg.exchange not in ccxt.exchanges:
        raise SystemExit(f"Exchange '{cfg.exchange}' non supportato da ccxt.")
    params: dict = {
        "enableRateLimit": True,
        "options": {"defaultType": "spot", **SPOT_ONLY.get(cfg.exchange, {})},
        "requests_trust_env": True,  # honour system proxy and CA settings
    }
    if authenticated:
        if not (cfg.exchange_api_key and cfg.exchange_api_secret):
            raise SystemExit("Mancano DESK_EXCHANGE_API_KEY e DESK_EXCHANGE_API_SECRET in .env.")
        params["apiKey"] = cfg.exchange_api_key
        params["secret"] = cfg.exchange_api_secret
        if cfg.exchange_api_password:
            params["password"] = cfg.exchange_api_password
    return getattr(ccxt, cfg.exchange)(params)


class CcxtMarket:
    def __init__(self, exchange: ccxt.Exchange, cfg: Settings):
        self.ex = exchange
        self.cfg = cfg
        self.candle_ms = exchange.parse_timeframe(cfg.timeframe) * 1000

    def universe(self) -> list[tuple[str, float]]:
        try:
            markets = self.ex.load_markets()
            tickers = self.ex.fetch_tickers()
        except ccxt.BaseError as e:
            raise MarketError(f"{self.cfg.exchange}: {e}") from e
        rows: list[tuple[str, float]] = []
        for symbol, ticker in tickers.items():
            market = markets.get(symbol)
            if not market or not market.get("spot") or market.get("active") is False:
                continue
            if market.get("quote") != self.cfg.quote:
                continue
            base = market.get("base") or ""
            if is_pegged(base) or LEVERAGED.search(base):
                continue
            volume = ticker.get("quoteVolume")
            if volume is None:
                volume = (ticker.get("baseVolume") or 0) * (ticker.get("last") or 0)
            if volume >= self.cfg.min_quote_volume:
                rows.append((symbol, float(volume)))
        rows.sort(key=lambda row: row[1], reverse=True)
        return rows[: self.cfg.universe_size]

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        return self._closed(self._fetch(symbol, limit=limit + 1))[-limit:]

    def history(self, symbol: str, bars: int) -> list[Candle]:
        """Up to `bars` closed candles, paging back as far as the exchange allows."""
        since = self.ex.milliseconds() - (bars + 1) * self.candle_ms
        seen: dict[int, list] = {}
        while True:
            batch = self._fetch(symbol, since=since, limit=1000)
            fresh = [row for row in batch if row[0] not in seen]
            if not fresh:
                break
            seen.update((row[0], row) for row in fresh)
            since = max(seen) + self.candle_ms
            if since >= self.ex.milliseconds():
                break
        return self._closed([seen[ts] for ts in sorted(seen)])[-bars:]

    def price(self, symbol: str) -> float:
        try:
            last = self.ex.fetch_ticker(symbol).get("last")
        except ccxt.BaseError as e:
            raise MarketError(f"{symbol}: {e}") from e
        if not last:
            raise MarketError(f"{symbol}: nessun prezzo disponibile")
        return float(last)

    def _fetch(self, symbol: str, **kwargs) -> list[list]:
        try:
            return self.ex.fetch_ohlcv(symbol, self.cfg.timeframe, **kwargs)
        except ccxt.BaseError as e:
            raise MarketError(f"{symbol}: {e}") from e

    def _closed(self, rows: list[list]) -> list[Candle]:
        """Drop the candle still forming: signals must not change after the fact."""
        now = self.ex.milliseconds()
        return [
            Candle(int(ts), float(o), float(h), float(low), float(c), float(v or 0))
            for ts, o, h, low, c, v in rows
            if ts + self.candle_ms <= now and None not in (o, h, low, c)
        ]
