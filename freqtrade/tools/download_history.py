"""Download Binance's 4h candles and store them for Freqtrade under Kraken's pair names.

Kraken only serves the latest 720 candles, so a three-year backtest needs another source.
This reads Binance's public archive (data.binance.vision), the same candles our desk's own
backtester used, and stores each XXX/USDT market as Kraken's XXX/USD pair. The coins are
the 40 largest of November 2023 (the desk's "U2" test) minus ORDI, which Kraken does not
list. Coins renamed since then are stitched and stored under their new ticker.

Run it from the freqtrade folder, with Freqtrade installed:
    python tools/download_history.py
"""

from __future__ import annotations

import argparse
import csv
import io
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

import pandas as pd
from freqtrade.data.history import get_datahandler
from freqtrade.enums import CandleType

URL = "https://data.binance.vision/data/spot/monthly/klines/{t}USDT/4h/{t}USDT-4h-{m}.zip"
SAME_NAME = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "AVAX", "TRX", "LINK", "DOT", "LTC",
    "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI",
    "SUI", "TIA", "ICP", "HBAR", "AAVE", "IMX", "STX", "RUNE", "WLD", "PEPE", "SHIB", "FLOKI",
]  # fmt: skip
# Kraken pair -> the Binance tickers holding its history, the old ticker first.
PAIRS = {f"{base}/USD": [base] for base in SAME_NAME}
PAIRS |= {"POL/USD": ["MATIC", "POL"], "S/USD": ["FTM", "S"], "RENDER/USD": ["RNDR", "RENDER"]}


def months(first: str, last: str) -> list[str]:
    return [p.strftime("%Y-%m") for p in pd.period_range(first, last, freq="M")]


def month(ticker: str, month_: str) -> list[list[float]]:
    try:
        with urllib.request.urlopen(URL.format(t=ticker, m=month_), timeout=60) as response:
            raw = response.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:  # not listed (yet, or any more) that month
            return []
        raise
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        text = archive.read(archive.namelist()[0]).decode()
    rows = []
    for row in csv.reader(io.StringIO(text)):
        if not row or not row[0].isdigit():
            continue  # some files start with a header
        ts = int(row[0])
        if ts > 10**14:  # spot files switched to microseconds in 2025
            ts //= 1000
        rows.append([ts, *map(float, row[1:6])])
    return rows


def history(tickers: list[str], wanted: list[str]) -> pd.DataFrame:
    seen: dict[int, list[float]] = {}
    for ticker in tickers:
        with ThreadPoolExecutor(max_workers=6) as pool:
            for rows in pool.map(partial(month, ticker), wanted):
                for row in rows:
                    seen.setdefault(int(row[0]), row)  # the old ticker wins where both exist
    df = pd.DataFrame(
        [seen[ts] for ts in sorted(seen)],
        columns=["date", "open", "high", "low", "close", "volume"],
    )
    df["date"] = pd.to_datetime(df["date"], unit="ms", utc=True)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    # One month before the test: Freqtrade wants 200 candles of warm-up before 2023-11-01.
    parser.add_argument("--first", default="2023-09", help="first month (default 2023-09)")
    parser.add_argument("--last", default="2026-10", help="last month (default 2026-10)")
    parser.add_argument("--datadir", default="user_data/data/kraken", type=Path)
    parser.add_argument("--pairs", nargs="*", help="only these pairs, e.g. BTC/USD POL/USD")
    args = parser.parse_args()
    wanted = months(args.first, args.last)
    args.datadir.mkdir(parents=True, exist_ok=True)
    store = get_datahandler(args.datadir, "feather")
    for pair, tickers in PAIRS.items():
        if args.pairs and pair not in args.pairs:
            continue
        df = history(tickers, wanted)
        if df.empty:
            print(f"{pair}: no candles found")
            continue
        store.ohlcv_store(pair, "4h", df, CandleType.SPOT)
        first, last = df["date"].iloc[0], df["date"].iloc[-1]
        print(f"{pair}: {len(df)} candles, {first:%Y-%m-%d} .. {last:%Y-%m-%d}")


if __name__ == "__main__":
    main()
