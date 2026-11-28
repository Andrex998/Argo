"""More risk on the perpetuals desk: which kind, if any, held up over three years?

The owner asked for more risk. This replays the perpetuals desk as it runs today (long
and short, full size, x3, the Bybit fee, rule C on the open interest) next to variants
that each change one thing, then two and three together:

- wider stops allowed (12% instead of 8%): more setups, same 1% risk at the stop;
- rule C off: setups enter whatever the open interest did;
- 2% risk per trade instead of 1%: bigger positions, up to the same caps.

The replay does not stop at the desk's 15% drawdown halt: a drawdown past it means the
live desk would have stopped until `desk resume`.

Run from trading-desk/:  uv run python research/riskier.py
"""

from __future__ import annotations

import json
import pickle
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import derivs  # noqa: E402
import perps  # noqa: E402

OUT = Path(__file__).parent
HALT = 15.0  # the live desk's max_drawdown_pct
VARIANTS = {
    "regole di oggi": ({}, True),
    "stop fino al 12%": ({"max_stop_pct": 12.0}, True),
    "senza regola C": ({}, False),
    "rischio 2%": ({"risk_per_trade_pct": 2.0}, True),
    "stop 12% + senza C": ({"max_stop_pct": 12.0}, False),
    "stop 12% + senza C + 2%": ({"max_stop_pct": 12.0, "risk_per_trade_pct": 2.0}, False),
    "stop 12% + rischio 1,5%": ({"max_stop_pct": 12.0, "risk_per_trade_pct": 1.5}, True),
    "stop 12% + rischio 2%": ({"max_stop_pct": 12.0, "risk_per_trade_pct": 2.0}, True),
}


def _job(args: tuple) -> dict:
    name, year = args
    rules, rule_c = VARIANTS[name]
    data = pickle.loads((OUT / "perps.pkl").read_bytes())
    setup = perps.Setup(sides="both", cap_pos=0.33, cap_total=1.5, fee=0.00055, rules=rules)
    if rule_c:
        metrics = pickle.loads((OUT / "derivs.pkl").read_bytes())
        setup.entry_filter = derivs.make_filter("C", metrics)
    start, end = (
        int(datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp() * 1000)
        for d in perps.YEARS[year]
    )
    return {"variant": name, "year": year, **perps.replay(data, setup, start, end)}


def run() -> None:
    jobs = [(name, year) for name in VARIANTS for year in perps.YEARS]
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(_job, jobs))
    (OUT / "riskier.json").write_text(json.dumps(rows, indent=1))
    for r in rows:
        halt = "  FERMO (>15%)" if r["dd"] > HALT else ""
        print(
            f"{r['variant']:<26} {r['year']:<7} {r['ret']:+7.1f}%  dd {r['dd']:4.1f}%  "
            f"n {r['trades']:3d} (L {r['long']} / S {r['short']})  pf {r['pf']}  "
            f"win {r['win']}%  liq {r['liquidations']}  senza 2 migliori "
            f"{r['without_best2']:+.1f}%  BTC {r['btc']:+.1f}%{halt}"
        )


if __name__ == "__main__":
    run()
