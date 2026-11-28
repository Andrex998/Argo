"""Market data for the crypto class, from BingX's public perpetual-futures API.

Bybit and Binance turn the cloud sessions away by their location; BingX answers, with no
key: candles, funding and open interest. Candles come back as the desk's Candle (open time
in milliseconds, volume in coins), keyed as the research keys them ("SOL/USDT"), so the
research code (perps.replay, trend.signals) runs on them unchanged.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

from desk.models import Candle

API = "https://open-api.bingx.com"
# The 36 coins of the desk's research (no memecoins), and their new names on the exchange.
COINS = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "TRX", "LINK", "DOT", "MATIC", "LTC",
         "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI", "SUI",
         "TIA", "ICP", "HBAR", "AAVE", "RNDR", "FTM", "IMX", "STX", "RUNE", "ORDI", "WLD"]  # fmt: skip
ALIAS = {"FTM": "S", "MATIC": "POL", "RNDR": "RENDER"}
STEP_MS = {"1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000}
PAGE = 1000
HOUR_MS = 3_600_000
FUNDING_GAP_MS = 8 * HOUR_MS  # two settlements are never further apart than this
FUNDING_LATE_MS = 2 * HOUR_MS  # how late the exchange may publish the last settlement
FUNDING_REPAIRS = 6  # how many times a hole is asked again before giving up
FUNDING_HEAD_IDLE = 2  # answers in a row with nothing new before the first row is taken as the listing


class DataError(Exception):
    """BingX did not answer, or answered with an error: nothing is decided on a guess."""


def market(coin: str) -> str:
    """The exchange's symbol: SOL -> SOL-USDT, FTM -> S-USDT."""
    return f"{ALIAS.get(coin, coin)}-USDT"


def pair(coin: str) -> str:
    """The research's key: SOL -> SOL/USDT."""
    return f"{coin}/USDT"


def _get(path: str, params: dict, tries: int = 4):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                body = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            if attempt == tries - 1:
                raise DataError(f"BingX non risponde su {path}: {e}") from e
            time.sleep(2 * (attempt + 1))
            continue
        if body.get("code") == 0:
            time.sleep(0.12)  # well under the public rate limit
            return body.get("data")
        if attempt == tries - 1:
            raise DataError(f"BingX {path}: {body.get('code')} {str(body.get('msg'))[:160]}")
        time.sleep(2 * (attempt + 1))
    raise DataError(f"BingX {path}: nessuna risposta")


def klines(coin: str, interval: str, start_ms: int, end_ms: int) -> list[Candle]:
    """The candles that opened from start_ms and closed by end_ms, oldest first."""
    step = STEP_MS[interval]
    out: dict[int, Candle] = {}
    cursor = start_ms - start_ms % step
    while cursor < end_ms:
        stop = min(end_ms, cursor + PAGE * step)
        rows = _get("/openApi/swap/v3/quote/klines", {"symbol": market(coin), "interval": interval,
                    "startTime": cursor, "endTime": stop - 1, "limit": PAGE}) or []  # fmt: skip
        for k in rows:
            ts = int(k["time"])
            if start_ms <= ts and ts + step <= end_ms:
                out[ts] = Candle(ts, float(k["open"]), float(k["high"]), float(k["low"]),
                                 float(k["close"]), float(k["volume"]))  # fmt: skip
        cursor = stop
    return [out[t] for t in sorted(out)]


def _funding_pass(coin: str, start_ms: int, end_ms: int, out: dict[int, float]) -> None:
    """One paged request for the settlements from start_ms to end_ms, added to `out`."""
    cursor = start_ms
    while cursor < end_ms:
        stop = min(end_ms, cursor + PAGE * FUNDING_GAP_MS)
        rows = _get("/openApi/swap/v2/quote/fundingRate", {"symbol": market(coin),
                    "startTime": cursor, "endTime": stop - 1, "limit": PAGE}) or []  # fmt: skip
        for r in rows:
            t = int(r["fundingTime"])
            if start_ms <= t < end_ms:
                out[t - t % HOUR_MS] = float(r["fundingRate"])
        cursor = stop


def _funding_holes(times: list[int], end_ms: int) -> list[tuple[int, int]]:
    """The stretches without a settlement: between two rows, or from the last row to the end."""
    holes = [(a, b) for a, b in zip(times, times[1:], strict=False) if b - a > FUNDING_GAP_MS]
    if times and end_ms - times[-1] > FUNDING_GAP_MS + FUNDING_LATE_MS:
        holes.append((times[-1], end_ms))
    return holes


def funding(coin: str, start_ms: int, end_ms: int) -> dict[int, float]:
    """Each funding settlement's rate, by its time in milliseconds.

    BingX sometimes answers with rows missing, above all on old history, and says nothing. A hole
    is asked again; if it stays, this raises, because numbers on incomplete data would look right.
    Nothing before the first row is not a hole (the coin was not listed yet), but it is asked again
    until two answers in a row bring nothing new.
    """
    out: dict[int, float] = {}
    _funding_pass(coin, start_ms, end_ms, out)
    idle = 0
    for _ in range(FUNDING_REPAIRS):
        times = sorted(out)
        holes = _funding_holes(times, end_ms)
        listed = times[0] if times else end_ms
        head = [] if listed - start_ms <= FUNDING_GAP_MS else [(start_ms - 1, listed)]
        if not holes and (not head or idle >= FUNDING_HEAD_IDLE):
            break
        before = len(out)
        for a, b in holes + head:
            _funding_pass(coin, a + 1, b, out)
        idle = idle + 1 if len(out) == before else 0
    holes = _funding_holes(sorted(out), end_ms)
    if holes:
        first, last = (time.strftime("%Y-%m-%d", time.gmtime(ms / 1000)) for ms in holes[0])
        raise DataError(f"BingX: la storia del funding di {coin} ha {len(holes)} buchi (il primo dal {first} "
                        f"al {last}): i conti non si fanno su dati incompleti")  # fmt: skip
    return dict(sorted(out.items()))


def tickers() -> dict[str, float]:
    """The last price of every coin of the class, from one request."""
    rows = _get("/openApi/swap/v2/quote/ticker", {}) or []
    last = {r["symbol"]: float(r["lastPrice"]) for r in rows if r.get("lastPrice")}
    return {c: last[market(c)] for c in COINS if market(c) in last}


def open_interest(coin: str) -> float:
    """Open interest now, in dollars."""
    return float(_get("/openApi/swap/v2/quote/openInterest", {"symbol": market(coin)})["openInterest"])
