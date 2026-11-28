"""The four rules wallets replayed over the past, same code and costs as the daily run.

From trading-desk: uv run --frozen python ../crypto-school/storia.py 2024-11-28 out.json
Reads public BingX prices only; it writes nothing to the school and places no orders.
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import data  # noqa: E402
import rules  # noqa: E402

WARMUP_4H_DAYS, WARMUP_1D_DAYS, WARMUP_RATE_DAYS = 40, 400, 10  # the same as school.day


def main(start_day: str, out_path: str) -> None:
    end = int(datetime.now(UTC).timestamp() * 1000)
    start = rules.ms_of(start_day)
    k4h, k1d, rates, missing = {}, {}, {}, {}
    for coin in data.COINS:
        s = data.pair(coin)
        try:
            k4h[s] = data.klines(coin, "4h", start - WARMUP_4H_DAYS * rules.DAY_MS, end)
            k1d[s] = data.klines(coin, "1d", start - WARMUP_1D_DAYS * rules.DAY_MS, end)
            rates[s] = data.funding(coin, start - WARMUP_RATE_DAYS * rules.DAY_MS, end)
        except data.DataError as e:  # a coin without data is left out and named in the output
            missing[coin] = str(e)[:200]
            for table in (k4h, k1d, rates):
                table.pop(s, None)
    runs = {
        "falco": lambda: rules.falco(k4h, rates, k1d["BTC/USDT"], start, end),
        "tartaruga": lambda: rules.tartaruga(k1d, rates, start_day),
        "spazzino": lambda: rules.spazzino(k1d, rates, start_day),
        "ragioniere": lambda: rules.ragioniere(k1d, rates, start_day),
    }
    res = {}
    for name, run in runs.items():
        r = run()
        res[name] = {"curve": r["curve"], "trades": r.get("trades", []), "parti": r.get("parti")}
    rate_counts = {s.split("/")[0]: len(v) for s, v in rates.items()}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"start": start_day, "missing": missing, "funding_rows": rate_counts, "res": res}, f)
    for name, r in res.items():
        days = sorted(r["curve"])
        print(name, days[0], days[-1], r["curve"][days[-1]], len(r["trades"]), r["parti"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
