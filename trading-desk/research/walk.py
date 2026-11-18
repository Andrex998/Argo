"""Walk-forward on three years of Binance 4h candles.

Every rule variant runs on each year on its own, with 220 candles of warm-up before it.
The rules are then chosen on year 1 alone and judged, untouched, on years 2 and 3.
Holding BTC over the same year is the bar to clear.
"""

from __future__ import annotations

import itertools
import json
import pickle
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from desk import backtest
from desk.config import Settings

OUT = Path(__file__).parent
CANDLE_MS = 4 * 3600 * 1000
WARMUP = 220
YEARS = {
    "Y1": ("2023-11-01", "2024-11-01"),
    "Y2": ("2024-11-01", "2025-11-01"),
    "Y3": ("2025-11-01", "2026-11-01"),
}
GRID = {
    "regime_strict": [False, True],
    "breakout_lookback": [0, 20],
    "reward_risk": [2.0, 3.0],
    "atr_stop_mult": [2.0, 3.0],
}
FEES = [0.004, 0.001]


def ms(day: str) -> int:
    return int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp() * 1000)


def settings(fee: float, variant: dict) -> Settings:
    cfg = Settings(
        _env_file=None,
        exchange="binance",
        quote="USDT",
        timeframe="4h",
        fear_greed=False,
        leverage_levels=[],
        fee_rate=fee,
    )
    for key, value in variant.items():
        setattr(cfg, key, value)
    return cfg


_cache: dict[str, dict] = {}


def load(universe: str) -> dict:
    if universe not in _cache:
        _cache[universe] = pickle.loads((OUT / f"binance-{universe}.pkl").read_bytes())
    return _cache[universe]


def run(job: tuple) -> dict:
    universe, year, fee, variant = job
    start, end = (ms(day) for day in YEARS[year])
    sliced = {
        s: [c for c in candles if start - WARMUP * CANDLE_MS <= c.ts < end]
        for s, candles in load(universe).items()
    }
    result = backtest.run(sliced, settings(fee, variant), start=start)
    trades = result.trades
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [-t.pnl for t in trades if t.pnl < 0]
    return {
        "universe": universe,
        "year": year,
        "fee": fee,
        **variant,
        "ret": round(result.return_pct, 2),
        "dd": round(result.max_drawdown_pct, 2),
        "trades": len(trades),
        "open": result.open_positions,
        "win": round(len(wins) / len(trades) * 100, 1) if trades else 0.0,
        "pf": round(sum(wins) / sum(losses), 2) if losses else None,
        "avg_r": round(sum(t.r_multiple for t in trades) / len(trades), 3) if trades else 0.0,
        "fees": round(result.fees, 2),
        "btc": None if result.benchmark_pct is None else round(result.benchmark_pct, 2),
        "best2": round(sum(sorted((t.pnl for t in trades), reverse=True)[:2]), 2),
        "symbols": result.symbols,
    }


def main() -> None:
    variants = [
        dict(zip(GRID, values, strict=True)) for values in itertools.product(*GRID.values())
    ]
    jobs = [(u, y, f, v) for u in ("u2", "u1") for y in YEARS for f in FEES for v in variants]
    print(len(jobs), "runs", flush=True)
    t0 = time.time()
    results = []
    with ProcessPoolExecutor(max_workers=4) as pool:
        for n, result in enumerate(pool.map(run, jobs), start=1):
            results.append(result)
            if n % 12 == 0:
                print(f"  {n}/{len(jobs)} in {time.time() - t0:.0f}s", flush=True)
                (OUT / "walk.json").write_text(json.dumps(results, indent=1))
    (OUT / "walk.json").write_text(json.dumps(results, indent=1))
    print("done in", round(time.time() - t0), "s", flush=True)


if __name__ == "__main__":
    sys.exit(main())
