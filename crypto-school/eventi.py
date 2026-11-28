"""The event study: what prices did in the days after a list of dated events.

It turns "this kind of news matters" into numbers. For every kind of event it measures the
return from the close of the event's day to the close 1, 3 and 7 days later, and compares
it with all the days of the same period. The p value says how often the same number of
days picked at random gives a difference at least as large: a large p means luck.

From trading-desk:
    uv run --frozen python ../crypto-school/eventi.py ../crypto-school/eventi.json 2023-01-01 BTC ETH
Reads public BingX prices only; it writes nothing to the school and places no orders.
"""

from __future__ import annotations

import json
import random
import sys
from datetime import UTC, datetime
from pathlib import Path
from statistics import fmean, median

sys.path.insert(0, str(Path(__file__).parent))

import data  # noqa: E402
import rules  # noqa: E402

HORIZONS = (1, 3, 7)  # days after the event
ROUND_TRIP_PCT = 2 * rules.COST * 100  # fee and slippage, in and out
DROP_PCT, JUMP_PCT = -5.0, 5.0  # a daily close this far from the one before is an event of its own
DRAWS, SEED = 2000, 7  # random days for the p value; a fixed seed gives the same answer every run
MIN_EVENTS = 8  # under this the table says the sample is too small to read


def forward(closes: dict[str, float], day: str, horizon: int, order: list[str] | None = None) -> float | None:
    """The % from the close of `day` to the close `horizon` days later; None without both closes."""
    order = order or sorted(closes)
    if day not in closes:
        return None
    i = order.index(day) + horizon
    if i >= len(order) or closes[day] <= 0:
        return None
    return (closes[order[i]] / closes[day] - 1) * 100


def price_events(closes: dict[str, float], threshold_pct: float) -> list[str]:
    """The days whose close fell to `threshold_pct` or lower (or rose to it or higher, if positive)."""
    order, out = sorted(closes), []
    for a, b in zip(order, order[1:], strict=False):
        if closes[a] <= 0:
            continue
        move = (closes[b] / closes[a] - 1) * 100
        if (threshold_pct < 0 and move <= threshold_pct) or (threshold_pct > 0 and move >= threshold_pct):
            out.append(b)
    return out


def study(closes: dict[str, float], days: list[str], horizons: tuple[int, ...] = HORIZONS,
          draws: int = DRAWS, seed: int = SEED) -> dict:  # fmt: skip
    order, rng, out = sorted(closes), random.Random(seed), {}
    for h in horizons:
        every = {d: forward(closes, d, h, order) for d in order}
        every = {d: v for d, v in every.items() if v is not None}
        got = [every[d] for d in days if d in every]
        row = {"n": len(got), "saltati": len(days) - len(got)}
        if got and every:
            base = fmean(every.values())
            diff = fmean(got) - base
            pool = list(every.values())
            beats = sum(abs(fmean(rng.sample(pool, len(got))) - base) >= abs(diff) - 1e-12 for _ in range(draws))
            row |= {"media_pct": fmean(got), "mediana_pct": median(got),
                    "positivi": sum(v > 0 for v in got) / len(got), "base_pct": base,
                    "differenza_pct": diff, "p": beats / draws,
                    "netto_long_pct": fmean(got) - ROUND_TRIP_PCT,
                    "pochi": len(got) < MIN_EVENTS}  # fmt: skip
        out[str(h)] = row
    return out


def main(events_path: str, start_day: str, coins: list[str]) -> None:
    with open(events_path, encoding="utf-8") as f:
        kinds = {k: v["giorni"] for k, v in json.load(f).items()}
    end = int(datetime.now(UTC).timestamp() * 1000)
    closes = {}
    for coin in ["BTC", *[c for c in coins if c != "BTC"]]:
        candles = data.klines(coin, "1d", rules.ms_of(start_day), end)
        closes[coin] = {rules.day_of(c.ts): c.close for c in candles[:-1]}  # the last candle is still open
    kinds["crollo_btc"] = price_events(closes["BTC"], DROP_PCT)
    kinds["impennata_btc"] = price_events(closes["BTC"], JUMP_PCT)
    report = {kind: {coin: study(closes[coin], [d for d in days if d >= start_day]) for coin in closes}
              for kind, days in kinds.items()}  # fmt: skip
    print(json.dumps({"dal": start_day, "costi_andata_ritorno_pct": round(ROUND_TRIP_PCT, 3), "eventi": report},
                     indent=1, ensure_ascii=False))  # fmt: skip


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:] or ["BTC", "ETH"])
