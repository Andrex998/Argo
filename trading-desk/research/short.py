"""Which rule changes make the desk better on history it was not tuned on?

Downloads each history once (cached), then replays the desk with every variant of a small
grid. A variant is judged on each half of the period separately, by the trades entered in
that half, so a rule that only works in one stretch of the market shows up as such.

Run from trading-desk/:  uv run python research/short.py download|grid
"""

from __future__ import annotations

import itertools
import json
import pickle
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from desk import backtest
from desk.config import Settings
from desk.market import CcxtMarket, MarketError, make_exchange

OUT = Path(__file__).parent
DATASETS = {
    # name: (exchange, quote, timeframe, days)
    "kraken-1h": ("kraken", "USD", "1h", 30),
    "kraken-4h": ("kraken", "USD", "4h", 120),
    "bingx-1h": ("bingx", "USDT", "1h", 180),
    "bingx-4h": ("bingx", "USDT", "4h", 360),
}
GRID = {
    "fee_rate": [0.004, 0.001],  # Kraken taker vs Bybit EU / Binance / BingX taker
    "regime_strict": [False, True],
    "breakout_lookback": [0, 20],
    "reward_risk": [2.0, 3.0],
    "atr_stop_mult": [2.0, 3.0],
}


def base_settings(exchange: str, quote: str, timeframe: str) -> Settings:
    return Settings(
        _env_file=None,
        exchange=exchange,
        quote=quote,
        timeframe=timeframe,
        fear_greed=False,
        leverage_levels=[],
    )


def download(name: str) -> None:
    exchange, quote, timeframe, days = DATASETS[name]
    path = OUT / f"{name}.pkl"
    if path.exists():
        print(name, "cached")
        return
    cfg = base_settings(exchange, quote, timeframe)
    market = CcxtMarket(make_exchange(cfg), cfg)
    bars = int(days * 86_400_000 / market.candle_ms) + backtest.WINDOW
    histories = {}
    universe = market.universe()
    leader = f"BTC/{quote}"
    symbols = [s for s, _ in universe]
    if leader not in symbols:
        symbols.append(leader)
    for symbol in symbols:
        try:
            histories[symbol] = market.history(symbol, bars)
        except MarketError as e:
            print("  skipped", symbol, e)
    path.write_bytes(pickle.dumps(histories))
    lengths = sorted(len(c) for c in histories.values())
    print(
        name,
        len(histories),
        "markets, candles min/median/max",
        lengths[0],
        lengths[len(lengths) // 2],
        lengths[-1],
    )


def metrics(trades: list, start: float, end: float) -> dict:
    chosen = [t for t in trades if start <= t.entry_ts < end]
    wins = [t.pnl for t in chosen if t.pnl > 0]
    losses = [-t.pnl for t in chosen if t.pnl < 0]
    return {
        "trades": len(chosen),
        "pnl": round(sum(t.pnl for t in chosen), 2),
        "win_rate": round(len(wins) / len(chosen) * 100, 1) if chosen else 0.0,
        "pf": round(sum(wins) / sum(losses), 2) if losses else None,
        "avg_r": round(sum(t.r_multiple for t in chosen) / len(chosen), 3) if chosen else 0.0,
    }


def run_variant(args: tuple) -> dict:
    name, variant = args
    exchange, quote, timeframe, _ = DATASETS[name]
    histories = pickle.loads((OUT / f"{name}.pkl").read_bytes())
    cfg = base_settings(exchange, quote, timeframe)
    for key, value in variant.items():
        setattr(cfg, key, value)
    result = backtest.run(histories, cfg)
    mid = (result.start_ts + result.end_ts) / 2
    return {
        "dataset": name,
        **variant,
        "return_pct": round(result.return_pct, 2),
        "max_dd": round(result.max_drawdown_pct, 2),
        "fees": round(result.fees, 2),
        "btc_pct": round(result.benchmark_pct, 2) if result.benchmark_pct is not None else None,
        "all": metrics(result.trades, result.start_ts, result.end_ts + 1),
        "first": metrics(result.trades, result.start_ts, mid),
        "second": metrics(result.trades, mid, result.end_ts + 1),
        "start": result.start_ts,
        "end": result.end_ts,
    }


def grid() -> None:
    variants = [
        dict(zip(GRID, values, strict=True)) for values in itertools.product(*GRID.values())
    ]
    jobs = [(name, v) for name in DATASETS if (OUT / f"{name}.pkl").exists() for v in variants]
    print(len(jobs), "runs")
    t0 = time.time()
    results = []
    with ProcessPoolExecutor(max_workers=4) as pool:
        for n, result in enumerate(pool.map(run_variant, jobs), start=1):
            results.append(result)
            if n % 16 == 0:
                print(f"  {n}/{len(jobs)} in {time.time() - t0:.0f}s", flush=True)
    (OUT / "grid.json").write_text(json.dumps(results, indent=1))
    print("done in", round(time.time() - t0), "s")


if __name__ == "__main__":
    if sys.argv[1] == "download":
        for name in sys.argv[2:] or DATASETS:
            t0 = time.time()
            download(name)
            print("  in", round(time.time() - t0), "s", flush=True)
    else:
        grid()
