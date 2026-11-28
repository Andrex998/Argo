"""Three years of 4h candles from Binance's public data site, for two universes.

U1: the coins the desk trades on Kraken today (optimistic: today's survivors).
U2: the main coins of November 2023, chosen before the test period (no survivorship).
Renamed coins are stitched: MATIC->POL, FTM->S, RNDR->RENDER (1:1 conversions or renames).
"""

from __future__ import annotations

import csv
import io
import pickle
import sys
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from desk.models import Candle

OUT = Path(__file__).parent
MONTHS = [f"{y}-{m:02d}" for y in (2023, 2024, 2025, 2026) for m in range(1, 13)]
MONTHS = [m for m in MONTHS if "2023-10" <= m <= "2026-10"]
U1 = [
    "AAVE",
    "ADA",
    "ASTER",
    "AVAX",
    "BNB",
    "BTC",
    "CRV",
    "DOGE",
    "ENA",
    "ETH",
    "HBAR",
    "HYPE",
    "ICP",
    "INJ",
    "LIGHTER",
    "LINK",
    "LTC",
    "NEAR",
    "NIGHT",
    "PAXG",
    "PENGU",
    "PEPE",
    "PUMP",
    "QNT",
    "SOL",
    "SUI",
    "TAO",
    "TON",
    "TRUMP",
    "TRX",
    "UNI",
    "USELESS",
    "VVV",
    "XDC",
    "XLM",
    "XMR",
    "XRP",
    "ZEC",
    "ZRO",
]
U2 = [
    "BTC",
    "ETH",
    "BNB",
    "SOL",
    "XRP",
    "DOGE",
    "ADA",
    "AVAX",
    "TRX",
    "LINK",
    "DOT",
    "MATIC",
    "LTC",
    "BCH",
    "ATOM",
    "UNI",
    "ETC",
    "XLM",
    "NEAR",
    "FIL",
    "APT",
    "ARB",
    "OP",
    "INJ",
    "SEI",
    "SUI",
    "TIA",
    "ICP",
    "HBAR",
    "AAVE",
    "RNDR",
    "FTM",
    "IMX",
    "STX",
    "RUNE",
    "ORDI",
    "WLD",
    "PEPE",
    "SHIB",
    "FLOKI",
]
STITCH = {"MATIC": ["MATIC", "POL"], "FTM": ["FTM", "S"], "RNDR": ["RNDR", "RENDER"]}
URL = "https://data.binance.vision/data/spot/monthly/klines/{s}USDT/4h/{s}USDT-4h-{m}.zip"


def month(ticker: str, m: str) -> list[Candle]:
    try:
        with urllib.request.urlopen(URL.format(s=ticker, m=m), timeout=60) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        text = z.read(z.namelist()[0]).decode()
    out = []
    for row in csv.reader(io.StringIO(text)):
        if not row or not row[0].isdigit():
            continue  # a header line in some files
        ts = int(row[0])
        if ts > 10**14:  # spot files switched to microseconds in 2025
            ts //= 1000
        out.append(
            Candle(ts, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5]))
        )
    return out


def history(base: str) -> list[Candle]:
    seen: dict[int, Candle] = {}
    for ticker in STITCH.get(base, [base]):
        with ThreadPoolExecutor(max_workers=6) as pool:
            for candles in pool.map(month, [ticker] * len(MONTHS), MONTHS):
                for c in candles:
                    seen.setdefault(c.ts, c)  # the old ticker wins where both exist
    return [seen[ts] for ts in sorted(seen)]


def main() -> None:
    cache: dict[str, list[Candle]] = {}
    for base in sorted(set(U1) | set(U2)):
        try:
            cache[base] = history(base)
        except Exception as e:  # noqa: BLE001
            print("  failed", base, e, flush=True)
            cache[base] = []
        c = cache[base]
        span = f"{len(c)} candles" + (f", {c[0].ts} .. {c[-1].ts}" if c else "")
        print(base, span, flush=True)
    for name, coins in (("u1", U1), ("u2", U2)):
        data = {f"{b}/USDT": cache[b] for b in coins if len(cache[b]) > 300}
        (OUT / f"binance-{name}.pkl").write_bytes(pickle.dumps(data))
        missing = [b for b in coins if len(cache[b]) <= 300]
        print(name, len(data), "markets; missing or too short:", missing, flush=True)


if __name__ == "__main__":
    sys.exit(main())
