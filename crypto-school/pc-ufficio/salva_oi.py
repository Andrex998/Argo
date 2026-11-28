"""Saves the open interest and the price of the school's 36 coins, one line per run.

BingX keeps no history of the open interest: what is not saved today is lost. This runs on the
office PC every hour, without Claude, so a day the school skips does not lose the data.

It needs only Python, no library and no key: it reads public prices and writes one line in
dati/oi-AAAA-MM.jsonl, next to this file. It places no orders.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

API = "https://open-api.bingx.com"
# the same coins and names as crypto-school/data.py (a test keeps the two lists equal)
COINS = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "TRX", "LINK", "DOT", "MATIC", "LTC",
         "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI",
         "SUI", "TIA", "ICP", "HBAR", "AAVE", "RNDR", "FTM", "IMX", "STX", "RUNE", "ORDI", "WLD"]  # fmt: skip
ALIAS = {"FTM": "S", "MATIC": "POL", "RNDR": "RENDER"}
TRIES, TIMEOUT_S, PAUSE_S = 3, 30, 0.15
MIN_COINS = 30  # with fewer coins the exchange is having a bad moment: nothing is written


class DataError(Exception):
    pass


def market(coin: str) -> str:
    return f"{ALIAS.get(coin, coin)}-USDT"


def get(path: str, params: dict):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(TRIES):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_S) as response:
                body = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            if attempt == TRIES - 1:
                raise DataError(f"BingX non risponde su {path}: {e}") from e
            time.sleep(2 * (attempt + 1))
            continue
        if body.get("code") == 0:
            time.sleep(PAUSE_S)
            return body.get("data")
        if attempt == TRIES - 1:
            raise DataError(f"BingX {path}: {body.get('code')} {str(body.get('msg'))[:160]}")
        time.sleep(2 * (attempt + 1))
    raise DataError(f"BingX {path}: nessuna risposta")


def positive(value) -> float | None:
    """The number, if it is a real amount above zero; the exchange's answers are not trusted."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if 0 < number < float("inf") else None


def snapshot(fetch=get, now: datetime | None = None) -> dict:
    """One line: the time, and for every coin with good numbers its open interest and price."""
    now = now or datetime.now(UTC)
    rows = fetch("/openApi/swap/v2/quote/ticker", {}) or []
    last = {r.get("symbol"): positive(r.get("lastPrice")) for r in rows if isinstance(r, dict)}
    oi, prices, missing = {}, {}, []
    for coin in COINS:
        try:
            answer = fetch("/openApi/swap/v2/quote/openInterest", {"symbol": market(coin)})
            amount = positive(answer.get("openInterest")) if isinstance(answer, dict) else None
        except DataError:
            amount = None
        price = last.get(market(coin))
        if amount is None or price is None:
            missing.append(coin)
            continue
        oi[coin], prices[coin] = round(amount), price
    if len(oi) < MIN_COINS:
        raise DataError(f"solo {len(oi)} monete su {len(COINS)} con dati buoni: non scrivo niente")
    return {"ora_utc": now.strftime("%Y-%m-%d %H:%M:%S"), "oi_usd": oi, "prezzi": prices, "mancanti": missing}


def append(folder: Path, row: dict) -> Path:
    """Adds the line to the month's file and gives back its path."""
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"oi-{row['ora_utc'][:7]}.jsonl"
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    return path


def main() -> int:
    folder = Path(__file__).parent / "dati"
    try:
        row = snapshot()
    except DataError as e:
        folder.mkdir(parents=True, exist_ok=True)
        with open(folder / "errori.log", "a", encoding="utf-8") as f:
            f.write(f"{datetime.now(UTC):%Y-%m-%d %H:%M:%S} {e}\n")
        print(f"Non salvato: {e}")
        return 1
    path = append(folder, row)
    total = sum(row["oi_usd"].values()) / 1e9
    print(f"Salvato alle {row['ora_utc']} UTC: {len(row['oi_usd'])} monete, open interest totale "
          f"{total:.2f} miliardi di dollari, BTC a {row['prezzi'].get('BTC')}.")  # fmt: skip
    if row["mancanti"]:
        print("Senza dati questa volta: " + ", ".join(row["mancanti"]))
    print(f"File: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
