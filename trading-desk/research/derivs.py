"""Does the derivatives market's positioning help pick the trades?

Binance publishes, every 5 minutes and for each perpetual: the open interest, the
long/short ratio of all accounts, the long/short ratio of the top traders' positions,
and the taker buy/sell volume ratio. Four rules, fixed before looking at any result,
are tried as an extra yes/no on the long-and-short replay of research/perps.py:

- A, against the crowd: no long when the accounts are far more long than usual over
  the last 30 days, no short when they are far more short;
- B, with the big traders: longs only when the top traders are at least as long as
  usual, shorts only when they are at least as short;
- C, new money: longs and shorts only while the open interest grew over 24 hours;
- D: all three together.

Run from trading-desk/:  uv run python research/derivs.py download|run
"""

from __future__ import annotations

import bisect
import csv
import io
import json
import pickle
import sys
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from statistics import median

sys.path.insert(0, str(Path(__file__).parent))
import perps  # noqa: E402

OUT = Path(__file__).parent
SITE = "https://data.binance.vision/data/futures/um/daily/metrics"
FIRST, LAST = date(2023, 9, 1), date(2026, 10, 31)
HOUR_MS = 3600 * 1000


def _day(ticker: str, day: date) -> list[tuple[int, float, float, float]]:
    """(ts at the 4h close, open interest, accounts long/short, top traders long/short)."""
    url = f"{SITE}/{ticker}USDT/{ticker}USDT-metrics-{day.isoformat()}.zip"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        text = z.read(z.namelist()[0]).decode()
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        when = datetime.fromisoformat(row["create_time"]).replace(tzinfo=UTC)
        if when.minute == 55 and when.hour % 4 == 3:  # the last reading before a 4h close
            close = int((when + timedelta(minutes=5)).timestamp() * 1000)
            try:
                out.append((close, float(row["sum_open_interest"]),
                            float(row["count_long_short_ratio"]),
                            float(row["sum_toptrader_long_short_ratio"])))  # fmt: skip
            except (TypeError, ValueError):
                continue
    return out


def download() -> None:
    days = [FIRST + timedelta(days=n) for n in range((LAST - FIRST).days + 1)]
    metrics = {}
    for base in perps.COINS:
        rows: dict[int, tuple] = {}
        for ticker in perps.STITCH.get(base, [base]):
            with ThreadPoolExecutor(max_workers=16) as pool:
                for day_rows in pool.map(_day, [ticker] * len(days), days):
                    for r in day_rows:
                        rows.setdefault(r[0], r[1:])
        metrics[f"{base}/USDT"] = {ts: rows[ts] for ts in sorted(rows)}
        print(base, len(rows), "letture", flush=True)
    (OUT / "derivs.pkl").write_bytes(pickle.dumps(metrics))


class Positioning:
    """The readings of one coin, looked up at a close with only the past in view."""

    def __init__(self, rows: dict[int, tuple]):
        self.ts = list(rows)
        self.rows = list(rows.values())

    def at(self, ts: int) -> tuple | None:
        i = bisect.bisect_right(self.ts, ts) - 1
        return self.rows[i] if i >= 0 and ts - self.ts[i] <= 4 * HOUR_MS else None

    def usual(self, ts: int, field: int) -> float | None:
        """The median of a field over the 30 days before `ts`."""
        hi = bisect.bisect_right(self.ts, ts)
        lo = bisect.bisect_left(self.ts, ts - 30 * 24 * HOUR_MS)
        values = [r[field] for r in self.rows[lo:hi]]
        return median(values) if len(values) >= 60 else None

    def oi_growth(self, ts: int) -> float | None:
        now, before = self.at(ts), self.at(ts - 24 * HOUR_MS)
        return now[0] / before[0] - 1 if now and before and before[0] else None


def make_filter(rule: str, metrics: dict):
    books = {s: Positioning(rows) for s, rows in metrics.items()}

    def against_crowd(p, side, ts):
        now, usual = p.at(ts), p.usual(ts, 1)
        if not now or not usual:
            return True  # no reading: no opinion
        return now[1] <= 1.2 * usual if side > 0 else now[1] >= usual / 1.2

    def with_big_traders(p, side, ts):
        now, usual = p.at(ts), p.usual(ts, 2)
        if not now or not usual:
            return True
        return now[2] >= usual if side > 0 else now[2] <= usual

    def new_money(p, side, ts):
        growth = p.oi_growth(ts)
        return True if growth is None else growth > 0

    rules = {"A": [against_crowd], "B": [with_big_traders], "C": [new_money],
             "D": [against_crowd, with_big_traders, new_money]}  # fmt: skip

    def check(symbol, side, ts):
        p = books.get(symbol)
        return p is None or all(rule_(p, side, ts) for rule_ in rules[rule])

    return check


NAMES = {
    "-": "nessun filtro",
    "A": "A contro la folla",
    "B": "B con i grandi trader",
    "C": "C soldi nuovi",
    "D": "D tutti insieme",
}


def _job(args):
    rule, year = args
    data = pickle.loads((OUT / "perps.pkl").read_bytes())
    setup = perps.Setup(sides="both")
    if rule != "-":
        setup.entry_filter = make_filter(rule, pickle.loads((OUT / "derivs.pkl").read_bytes()))
    start, end = (
        int(datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp() * 1000)
        for d in perps.YEARS[year]
    )
    return {"rule": NAMES[rule], "year": year, **perps.replay(data, setup, start, end)}


def run() -> None:
    jobs = [(rule, year) for rule in NAMES for year in perps.YEARS]
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(_job, jobs))
    (OUT / "derivs.json").write_text(json.dumps(rows, indent=1))
    for r in rows:
        print(
            f"{r['rule']:<24} {r['year']:<7} {r['ret']:+7.1f}%  dd {r['dd']:4.1f}%  "
            f"n {r['trades']:3d} (L {r['long']} {r['pnl_long']:+.0f} / S {r['short']} "
            f"{r['pnl_short']:+.0f})  pf {r['pf']}  senza 2 migliori {r['without_best2']:+.1f}%"
        )


if __name__ == "__main__":
    {"download": download, "run": run}[sys.argv[1]]()
