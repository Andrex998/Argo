"""The three years in one run: headline numbers, and what larger sizing would do."""

import json
import pickle
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from walk import CANDLE_MS, WARMUP, ms, settings  # noqa: E402

from desk import backtest  # noqa: E402

OUT = Path(__file__).parent
START, END = ms("2023-11-01"), ms("2026-11-01")
RULES = {
    "oggi (stop 2 ATR)": dict(
        regime_strict=True, breakout_lookback=20, reward_risk=3.0, atr_stop_mult=2.0
    ),
    "proposta (stop 3 ATR)": dict(
        regime_strict=True, breakout_lookback=20, reward_risk=3.0, atr_stop_mult=3.0
    ),
    "scelta sul 1o anno": dict(
        regime_strict=False, breakout_lookback=20, reward_risk=3.0, atr_stop_mult=3.0
    ),
    "regole vecchie": dict(
        regime_strict=False, breakout_lookback=0, reward_risk=2.0, atr_stop_mult=2.0
    ),
}
SIZING = {
    "1% a operazione": dict(risk_per_trade_pct=1.0, max_position_pct=10.0, max_exposure_pct=50.0),
    "2% a operazione": dict(risk_per_trade_pct=2.0, max_position_pct=20.0, max_exposure_pct=100.0),
}


def job(args):
    universe, fee, rule, size = args
    histories = pickle.loads((OUT / f"binance-{universe}.pkl").read_bytes())
    sliced = {
        s: [c for c in cs if START - WARMUP * CANDLE_MS <= c.ts < END]
        for s, cs in histories.items()
    }
    r = backtest.run(sliced, settings(fee, {**RULES[rule], **SIZING[size]}), start=START)
    t = r.trades
    wins = sum(x.pnl for x in t if x.pnl > 0)
    losses = -sum(x.pnl for x in t if x.pnl < 0)
    best2 = sum(sorted((x.pnl for x in t), reverse=True)[:2])
    return dict(
        universe=universe,
        fee=fee,
        rule=rule,
        size=size,
        ret=round(r.return_pct, 1),
        dd=round(r.max_drawdown_pct, 1),
        trades=len(t),
        pf=round(wins / losses, 2) if losses else None,
        win=round(r.win_rate),
        btc=round(r.benchmark_pct, 1),
        ret_without_best2=round((r.end_equity - best2) / r.start_equity * 100 - 100, 1),
    )


if __name__ == "__main__":
    jobs = [
        (u, f, rule, size)
        for u in ("u2", "u1")
        for f in (0.004, 0.001)
        for rule in RULES
        for size in SIZING
    ]
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(job, jobs))
    (OUT / "full.json").write_text(json.dumps(rows, indent=1))
    for x in rows:
        print(
            f"{x['universe']} fee {x['fee'] * 100:.1f}% {x['rule']:<22} {x['size']:<16} "
            f"ret {x['ret']:+6.1f}%  dd {x['dd']:4.1f}%  n {x['trades']:3d}  pf {x['pf']}  "
            f"win {x['win']}%  senza le 2 migliori {x['ret_without_best2']:+.1f}%  "
            f"(BTC {x['btc']:+.1f}%)"
        )
