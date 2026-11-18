"""Market data. `CcxtMarket` reads public exchange endpoints; no API key needed.

`PerpsMarket` reads USDT perpetual futures the same way (Bybit by default), for the
perpetuals desk: candles and prices, plus the funding rate and the open interest.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Protocol

import ccxt

from desk import leverage
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


class MarketUnavailable(MarketError):
    """The exchange could not be reached right now: no connection, timeout, outage or rate limit.

    Unlike a plain MarketError (an unknown symbol, say), this one says nothing about
    the market itself, so a decision that needs the data must wait for it.
    """


def market_error(e: ccxt.BaseError, what: str) -> MarketError:
    """The ccxt error in words a user can act on, keeping the original text."""
    detail = str(e)[:300]
    if "CERTIFICATE_VERIFY_FAILED" in repr(e) or "CERTIFICATE_VERIFY_FAILED" in detail:
        return MarketUnavailable(
            f"{what}: certificato HTTPS non riconosciuto. Di solito è un antivirus che "
            f"analizza le connessioni HTTPS ({detail})"
        )
    if isinstance(e, ccxt.NetworkError):
        if "restricted location" in detail or " 451 " in detail:  # Binance's location block
            return MarketUnavailable(
                f"{what}: l'exchange rifiuta le richieste da questa posizione geografica ({detail})"
            )
        return MarketUnavailable(
            f"{what}: connessione assente o exchange non raggiungibile ({detail})"
        )
    return MarketError(f"{what}: {detail}")


class Market(Protocol):
    def universe(self) -> list[tuple[str, float]]:
        """Most liquid tradable pairs as (symbol, 24h quote volume), largest first."""
        ...

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        """Latest closed candles, oldest first."""
        ...

    def price(self, symbol: str) -> float: ...

    def lowest_since(self, symbol: str, since: float) -> float | None:
        """The lowest price traded since `since` (seconds), or None if it is not known."""
        ...


class PerpsData(Market, Protocol):
    """What the perpetuals desk reads on top of a spot market."""

    def highest_since(self, symbol: str, since: float) -> float | None:
        """The highest price traded since `since` (seconds), or None if it is not known."""
        ...

    def funding_rate(self, symbol: str) -> float:
        """The last funding rate settled: 0.0001 means 0.01% of the notional."""
        ...

    def funding_interval(self, symbol: str) -> float:
        """Seconds between two funding settlements of this contract."""
        ...

    def open_interest_growth(self, symbol: str) -> float | None:
        """The open interest's change over the last 24 hours, or None if it is not known."""
        ...


def make_exchange(cfg: Settings, *, authenticated: bool = False) -> ccxt.Exchange:
    if cfg.exchange not in ccxt.exchanges:
        raise SystemExit(f"Exchange '{cfg.exchange}' non supportato da ccxt.")
    if cfg.market == "perps" and authenticated:
        raise SystemExit("Il desk dei perpetui usa solo dati pubblici: nessuna chiave API.")
    if cfg.market != "perps":
        options = {"defaultType": "spot"}
    elif cfg.exchange == "binanceusdm":
        options = {}  # it keeps its own defaults: USDⓈ-M futures markets only
    else:
        options = {"defaultType": "swap", "defaultSubType": "linear"}  # Bybit, OKX, ...
    params: dict = {
        "enableRateLimit": True,
        "options": {**options, **SPOT_ONLY.get(cfg.exchange, {})},
        "requests_trust_env": True,  # honour proxy settings from the environment
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
            raise market_error(e, self.cfg.exchange) from e
        rows: list[tuple[str, float]] = []
        for symbol, ticker in tickers.items():
            market = markets.get(symbol)
            if not market or market.get("active") is False or not self.tradable(market):
                continue
            volume = ticker.get("quoteVolume")
            if volume is None:
                volume = (ticker.get("baseVolume") or 0) * (ticker.get("last") or 0)
            if volume >= self.cfg.min_quote_volume:
                rows.append((symbol, float(volume)))
        rows.sort(key=lambda row: row[1], reverse=True)
        return rows[: self.cfg.universe_size]

    def tradable(self, market: dict) -> bool:
        """A spot pair in the desk's quote currency on a coin that is a directional bet."""
        base = market.get("base") or ""
        return (
            bool(market.get("spot"))
            and market.get("quote") == self.cfg.quote
            and not (is_pegged(base) or LEVERAGED.search(base))
        )

    def quotes(self) -> list[tuple[str, int]]:
        """Quote currencies of the exchange's spot markets with how many pairs each has."""
        try:
            markets = self.ex.load_markets()
        except ccxt.BaseError as e:
            raise market_error(e, self.cfg.exchange) from e
        counts = Counter(
            market["quote"]
            for market in markets.values()
            if market.get("spot") and market.get("active") is not False and market.get("quote")
        )
        return counts.most_common()

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
            raise market_error(e, symbol) from e
        if not last:
            raise MarketError(f"{symbol}: nessun prezzo disponibile")
        return float(last)

    def lowest_since(self, symbol: str, since: float) -> float | None:
        """The lowest price traded since `since`, the candle still forming included.

        Read from the finest candles that still reach that far back: exchanges keep only
        the latest few hundred of each size. A candle that began before `since` is left
        out, since the desk was still watching then.
        """
        lows = self._since(symbol, since, 3)
        return min(lows) if lows else None

    def highest_since(self, symbol: str, since: float) -> float | None:
        """The highest price traded since `since`: `lowest_since` for a short."""
        highs = self._since(symbol, since, 2)
        return max(highs) if highs else None

    def _since(self, symbol: str, since: float, column: int) -> list[float]:
        """One column (2 high, 3 low) of the candles that began at or after `since`."""
        gap = self.ex.milliseconds() / 1000 - since
        timeframe = "5m" if gap <= 2 * 86_400 else "1h" if gap <= 25 * 86_400 else "1d"
        start = int(since * 1000)
        try:
            rows = self.ex.fetch_ohlcv(symbol, timeframe, since=start, limit=720)
        except ccxt.BaseError as e:
            raise market_error(e, symbol) from e
        return [float(row[column]) for row in rows if row[0] >= start and row[column] is not None]

    def _fetch(self, symbol: str, **kwargs) -> list[list]:
        try:
            return self.ex.fetch_ohlcv(symbol, self.cfg.timeframe, **kwargs)
        except ccxt.BaseError as e:
            raise market_error(e, symbol) from e

    def _closed(self, rows: list[list]) -> list[Candle]:
        """Drop the candle still forming: signals must not change after the fact."""
        now = self.ex.milliseconds()
        return [
            Candle(int(ts), float(o), float(h), float(low), float(c), float(v or 0))
            for ts, o, h, low, c, v in rows
            if ts + self.candle_ms <= now and None not in (o, h, low, c)
        ]


FUNDING_EVERY = 8 * 3600  # the usual funding interval, in seconds


class PerpsMarket(CcxtMarket):
    """USDT-margined perpetuals (Bybit by default), read through public endpoints only.

    Symbols stay ccxt's unified ones: BTC/USDT:USDT. Only the coins in `leverage_bases`
    are listed: no memecoin and no coin outside that list is ever traded on perpetuals.
    """

    OI_WINDOW = 24 * 3600 * 1000  # open interest compared with 24 hours earlier

    def tradable(self, market: dict) -> bool:
        quote = self.cfg.quote
        return (
            bool(market.get("swap") and market.get("linear"))
            and market.get("quote") == quote
            and market.get("settle") == quote
            and leverage.allowed(market.get("symbol") or "", self.cfg)
        )

    def funding_interval(self, symbol: str) -> float:
        """Seconds between two settlements. Bybit lists each contract's interval in
        minutes (480, 240, 60); a venue that does not is taken to settle every 8 hours."""
        try:
            minutes = (self.ex.market(symbol).get("info") or {}).get("fundingInterval")
            return float(minutes) * 60 if minutes else FUNDING_EVERY
        except (ccxt.BaseError, TypeError, ValueError):
            return FUNDING_EVERY

    def funding_rate(self, symbol: str) -> float:
        """The last funding rate the venue settled; 0 for a contract that has none yet."""
        try:
            rows = self.ex.fetch_funding_rate_history(symbol, limit=1)
        except ccxt.BaseError as e:
            raise market_error(e, symbol) from e
        if not rows:
            return 0.0
        rate = rows[-1].get("fundingRate")
        if rate is None:
            raise MarketError(f"{symbol}: tasso di funding non disponibile")
        return float(rate)

    def open_interest_growth(self, symbol: str) -> float | None:
        """How much the open interest grew over the last 24 hours: 0.05 for +5%.

        It counts contracts, not dollars, so a price move alone does not change it. The
        latest hourly reading is compared with the one 24 hours earlier; None when the venue
        has no readings that far back.
        """
        since = self.ex.milliseconds() - self.OI_WINDOW - 3600 * 1000
        try:
            rows = self.ex.fetch_open_interest_history(symbol, "1h", since=since, limit=30)
        except ccxt.BaseError as e:
            raise market_error(e, symbol) from e
        readings = sorted(
            (int(row["timestamp"]), float(row["openInterestAmount"]))
            for row in rows
            if row.get("timestamp") is not None and row.get("openInterestAmount") is not None
        )
        if not readings:
            return None
        latest_ts, latest = readings[-1]
        earlier = [amount for ts, amount in readings if ts <= latest_ts - self.OI_WINDOW]
        if not earlier or earlier[-1] <= 0:
            return None
        return latest / earlier[-1] - 1


def open_market(cfg: Settings, exchange: ccxt.Exchange | None = None) -> CcxtMarket:
    """The desk's market data: spot pairs, or USDT perpetuals."""
    exchange = exchange or make_exchange(cfg)
    return PerpsMarket(exchange, cfg) if cfg.market == "perps" else CcxtMarket(exchange, cfg)
