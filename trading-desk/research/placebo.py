"""Exam E01 of the library: is the perpetuals desk's edge in its volume breakout, or only
in trading the side BTC allows?

research/biblioteca.md sets the exam. The desk's three-year replay (B0: stops up to 8%,
rule C, 1% risk, the Bybit fee) is taken apart one change at a time (B1-B6), and its
trades are set against two placebos:

- P1, the key one: each real trade swapped for an entry at a random moment of the same
  month, on a random coin of the 36, on the side BTC allowed at that moment, managed like
  the desk's: a stop at 3 ATR (at least 1.5%, at most the cap), the target at 3R, break-even
  at 1R, trailing after the target, out after 72 hours if stale, fees, slippage and
  funding. 1,000 draws. If the desk's trades do not beat 95% of them, the volume breakout
  adds nothing to following BTC. P1s draws on the same side as the real trade, so a month
  of shorts is matched by shorts.
- P2: the same share of trades that rule C removes, removed at random from the desk without
  rule C. 1,000 draws. Rule C stays only if it beats 90% of them.

Everything is counted in R: what a trade made as a multiple of what it risked at the stop,
after costs. R does not depend on the risk per trade. The placebo's trades are simulated
by the same code as the replay's, and the script checks it: the simulation of each real
trade must give back the replay's own R.

Run from trading-desk/:  uv run python research/placebo.py
"""

from __future__ import annotations

import json
import pickle
import random
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from statistics import fmean

sys.path.insert(0, str(Path(__file__).parent))

import derivs  # noqa: E402
import perps  # noqa: E402

from desk.agents import charts, scout  # noqa: E402
from desk.config import Settings  # noqa: E402
from desk.indicators import atr, ema  # noqa: E402

OUT = Path(__file__).parent
SIMS = 1000
FEE = 0.00055  # Bybit's, as research/riskier.py
YEARS = ("Y1", "Y2", "Y3")
CAPS = (8.0, 12.0)
LEVERAGE, MAINTENANCE = 3.0, 0.01  # perps.Setup's
CANDLE, FUNDING = perps.CANDLE_MS, perps.FUNDING_MS

# name: (desk rules, rule C, sides, fee, extra candles before the fill)
VARIANTS = {
    "B0": ({}, True, "both", FEE, 0),
    "B1": ({}, False, "both", FEE, 0),
    "B2": ({}, True, "long", FEE, 0),
    "B3": ({}, True, "short", FEE, 0),
    "B4": ({"max_stop_pct": 12.0}, True, "both", FEE, 0),
    "B4-noC": ({"max_stop_pct": 12.0}, False, "both", FEE, 0),
    "B5": ({}, True, "both", FEE, 1),
    "B6": ({"slippage_bps": 20.0}, True, "both", 2 * FEE, 0),
}
NAMES = {
    "B0": "regole del 18/11: stop fino all'8%, regola C",
    "B1": "B0 senza regola C",
    "B2": "B0 solo long",
    "B3": "B0 solo short",
    "B4": "stop fino al 12%, regola C (in uso dal 21/11)",
    "B4-noC": "B4 senza regola C",
    "B5": "B0 con una candela di ritardo in più",
    "B6": "B0 con costi doppi",
}


@cache
def data() -> dict:
    return pickle.loads((OUT / "perps.pkl").read_bytes())


@cache
def metrics() -> dict:
    return pickle.loads((OUT / "derivs.pkl").read_bytes())


def bounds(year: str) -> tuple[int, int]:
    start, end = perps.YEARS[year]
    return tuple(
        int(datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp() * 1000) for d in (start, end)
    )


def year_of(ms: float) -> str | None:
    return next((y for y in YEARS if bounds(y)[0] <= ms < bounds(y)[1]), None)


def month_of(ms: float) -> str:
    return datetime.fromtimestamp(ms / 1000, UTC).strftime("%Y-%m")


def settings(cap: float, fee: float = FEE, **rules) -> Settings:
    """The research replay's settings (perps.replay builds the same)."""
    return Settings(
        _env_file=None,
        exchange="binance",
        quote="USDT",
        timeframe="4h",
        fear_greed=False,
        leverage_levels=[],
        fee_rate=fee,
        max_stop_pct=cap,
        **rules,
    )


# --- the replays ------------------------------------------------------------------------------


def _replay(args: tuple) -> dict:
    name, year = args
    rules, rule_c, sides, fee, delay = VARIANTS[name]
    setup = perps.Setup(sides=sides, cap_pos=0.33, cap_total=1.5, fee=fee, rules=rules, delay=delay)
    setup.keep_trades = year == "3 anni"
    if rule_c:
        setup.entry_filter = derivs.make_filter("C", metrics())
    start, end = bounds(year)
    return {"variant": name, "year": year, **perps.replay(data(), setup, start, end)}


# --- one trade, managed like the desk's ------------------------------------------------------


@cache
def btc_sides() -> dict[int, int]:
    """The side BTC allows at the close of each 4h candle: +1 uptrend, -1 downtrend, 0 neither
    (perps.replay's own rule, on the same 200 candles)."""
    candles = data()["klines"]["BTC/USDT"]
    out = {}
    for i, c in enumerate(candles):
        closes = [x.close for x in candles[max(0, i - 199) : i + 1]]
        if len(closes) < charts.SLOW:
            continue
        regime = charts.trend_of(closes[-1], ema(closes, charts.FAST), ema(closes, charts.SLOW))
        out[c.ts] = 1 if regime == "up" else -1 if regime == "down" else 0
    return out


def trade(symbol: str, candles: list, j: int, side: int, cfg: Settings, end: int) -> float | None:
    """The R of a setup at the close of candle j, as perps.replay would trade it: filled at
    the next open with slippage, the stop and target moved by the same amount, funding every
    8 hours from the next candle, exits by perps.check_exit. None when the plan is one the
    desk refuses (stop too wide, costs too high) or the trade is still open at the end."""
    window = candles[max(0, j - 199) : j + 1]
    entry = window[-1].close
    distance = max(cfg.atr_stop_mult * atr(window), entry * cfg.min_stop_pct / 100)
    slip = cfg.slippage
    too_wide = distance / entry * 100 > cfg.max_stop_pct
    if too_wide or 2 * (cfg.fee_rate + slip) * entry / distance > cfg.max_cost_r:
        return None
    if j + 1 >= len(candles) or candles[j + 1].ts >= end:
        return None
    fill = candles[j + 1]
    price = fill.open * (1 + side * slip)
    shift = price - entry
    stop = entry - side * distance + shift
    target = entry + side * cfg.reward_risk * distance + shift
    liq_move = 1 / LEVERAGE - MAINTENANCE
    p = perps.Pos(
        symbol,
        side,
        1.0,
        price,
        fill.ts / 1000,
        stop,
        stop,
        target,
        price,
        price / LEVERAGE,
        price * (1 - side * liq_move),
        price * cfg.fee_rate,
    )
    rates = data()["funding"].get(symbol, {})
    for bar in candles[j + 1 :]:
        if bar.ts >= end:
            return None
        if bar.ts != fill.ts and bar.ts % FUNDING == 0 and (rate := rates.get(bar.ts)) is not None:
            p.funding += side * bar.open * rate
        if bar.open <= p.liquidation if side > 0 else bar.open >= p.liquidation:
            return (-p.margin - p.fees - p.funding) / p.risk
        exit_ = perps.check_exit(p, bar, bar.ts / 1000 + CANDLE / 1000, cfg)
        if exit_:
            out = exit_[1] * (1 - side * slip)
            return (side * (out - p.entry) - out * cfg.fee_rate - p.fees - p.funding) / p.risk
    return None


def _table(symbol: str) -> tuple[str, dict]:
    """Every entry the placebo can draw on one coin: at the close of each candle of the three
    years, on the side BTC allowed, for each stop cap. {cap: [(month, side, R), ...]}"""
    start, end = bounds("3 anni")
    candles = [c for c in data()["klines"][symbol] if c.ts < end]
    sides = btc_sides()
    cfgs = {cap: settings(cap) for cap in CAPS}
    out = {cap: [] for cap in CAPS}
    for j in range(scout.MIN_CANDLES - 1, len(candles) - 1):
        close = candles[j].ts + CANDLE
        side = sides.get(candles[j].ts, 0)
        if close < start or side == 0:
            continue
        for cap in CAPS:
            r = trade(symbol, candles, j, side, cfgs[cap], end)
            if r is not None:
                out[cap].append((month_of(candles[j + 1].ts), side, r))
    return symbol, out


def recheck(trades: list[dict], cap: float, fee: float = FEE) -> float:
    """The largest gap between the replay's R and the simulation of the same trade."""
    cfg, end = settings(cap, fee), bounds("3 anni")[1]
    worst = 0.0
    for t in trades:
        candles = [c for c in data()["klines"][t["symbol"]] if c.ts < end]
        fill = int(t["entry_ts"] * 1000)
        j = next(i for i, c in enumerate(candles) if c.ts == fill) - 1
        r = trade(t["symbol"], candles, j, t["side"], cfg, end)
        worst = max(worst, abs((r if r is not None else float("inf")) - t["r"]))
    return worst


# --- the exam ---------------------------------------------------------------------------------


def percentile(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))]


def beaten(real: float, draws: list[float]) -> float:
    """The share of placebo draws the real figure beats, in %."""
    return round(100 * sum(d < real for d in draws) / len(draws), 1)


def summary(real: float, draws: list[float]) -> dict:
    return {
        "vero": round(real, 1),
        "placebo_medio": round(fmean(draws), 1),
        "placebo_p5": round(percentile(draws, 0.05), 1),
        "placebo_p95": round(percentile(draws, 0.95), 1),
        "batte_pct": beaten(real, draws),
    }


def p1(trades: list[dict], pool: list, same_side: bool, rng: random.Random) -> dict:
    """The placebo P1 for one variant: totals in R, over three years, per year and per side."""
    by_month: dict = defaultdict(list)
    by_month_side: dict = defaultdict(list)
    for month, side, r in pool:
        by_month[month].append(r)
        by_month_side[month, side].append(r)
    keys = [
        (month_of(t["entry_ts"] * 1000), t["side"], year_of(t["entry_ts"] * 1000)) for t in trades
    ]
    groups = {
        "3 anni": lambda k: True,
        **{y: (lambda k, y=y: k[2] == y) for y in YEARS},
        "long": lambda k: k[1] > 0,
        "short": lambda k: k[1] < 0,
    }
    draws = {g: [] for g in groups}
    for _ in range(SIMS):
        rs = [rng.choice(by_month_side[m, s] if same_side else by_month[m]) for m, s, _ in keys]
        for g, member in groups.items():
            draws[g].append(sum(r for r, k in zip(rs, keys, strict=True) if member(k)))
    real = {
        g: sum(t["r"] for t, k in zip(trades, keys, strict=True) if member(k))
        for g, member in groups.items()
    }
    counts = {g: sum(map(member, keys)) for g, member in groups.items()}
    return {g: summary(real[g], draws[g]) | {"operazioni": counts[g]} for g in groups}


def p2(with_c: list[dict], without_c: list[dict], rng: random.Random) -> dict:
    """The placebo P2: as many trades as rule C keeps, kept at random from the desk without it."""
    keep = len(with_c)
    rs = [t["r"] for t in without_c]
    draws = [sum(rng.sample(rs, keep)) for _ in range(SIMS)]
    return summary(sum(t["r"] for t in with_c), draws) | {
        "operazioni_con_c": keep,
        "operazioni_senza_c": len(without_c),
        "tolte_pct": round(100 * (1 - keep / len(without_c)), 1),
    }


def run() -> None:
    jobs = [(name, year) for name in VARIANTS for year in (*YEARS, "3 anni")]
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(_replay, jobs))
        tables = dict(pool.map(_table, sorted(data()["klines"])))
    runs = {(r["variant"], r["year"]): r for r in rows}
    trades = {name: runs[name, "3 anni"].pop("trade_list") for name in VARIANTS}

    # The simulation must give back the replay's own trades.
    checks = {name: recheck(trades[name], cap) for name, cap in (("B0", 8.0), ("B4", 12.0))}
    assert all(gap < 1e-6 for gap in checks.values()), checks

    rng = random.Random(2026)
    exam = {}
    for name, cap in (("B0", 8.0), ("B4", 12.0)):
        pool_ = [row for rows_ in tables.values() for row in rows_[cap]]
        exam[name] = {
            "P1": p1(trades[name], pool_, same_side=False, rng=rng),
            "P1s": p1(trades[name], pool_, same_side=True, rng=rng),
            "P2": p2(trades[name], trades["B1" if name == "B0" else "B4-noC"], rng),
            "R_medio_vero": round(fmean(t["r"] for t in trades[name]), 3),
            "R_medio_placebo": round(fmean(r for _, _, r in pool_), 3),
            "ingressi_possibili": len(pool_),
        }
    years = {name: {y: runs[name, y]["ret"] for y in YEARS} for name in VARIANTS}
    verdict = {}
    for name in ("B0", "B4"):
        e = exam[name]["P1"]
        verdict[name] = {
            "P1 sui 3 anni (serve oltre 95)": e["3 anni"]["batte_pct"],
            "anni oltre 95 (servono 2 su 3)": sum(e[y]["batte_pct"] > 95 for y in YEARS),
            "P2, regola C (serve oltre 90)": exam[name]["P2"]["batte_pct"],
        }
    verdict["B5 positivo ogni anno"] = all(v > 0 for v in years["B5"].values())
    verdict["B6 positivo ogni anno"] = all(v > 0 for v in years["B6"].values())
    result = {
        "varianti": NAMES,
        "anni": years,
        "replay": [runs[k] for k in sorted(runs)],
        "esame": exam,
        "verdetto": verdict,
        "controllo_simulazione": checks,
    }
    (OUT / "placebo.json").write_text(json.dumps(result, indent=1, ensure_ascii=False))

    print("Rendimento per anno (%, replay a 1.000 $ per anno):")
    for name in VARIANTS:
        r3 = runs[name, "3 anni"]
        per_year = "  ".join(f"{y} {years[name][y]:+6.1f}" for y in YEARS)
        print(
            f"  {name:<7} {NAMES[name]:<48} {per_year}"
            f"   3 anni {r3['ret']:+6.1f}  op {r3['trades']}"
        )
    for name in ("B0", "B4"):
        e = exam[name]
        print(
            f"\n{name}: R medio vero {e['R_medio_vero']:+.3f}, placebo "
            f"{e['R_medio_placebo']:+.3f} su {e['ingressi_possibili']} ingressi possibili"
        )
        for test in ("P1", "P1s"):
            for g, s in e[test].items():
                band = f"[{s['placebo_p5']:+.1f}, {s['placebo_p95']:+.1f}]"
                print(
                    f"  {test:<4} {g:<7} op {s['operazioni']:3d}  vero {s['vero']:+7.1f} R  "
                    f"placebo {s['placebo_medio']:+7.1f} {band}  batte il {s['batte_pct']}%"
                )
        s = e["P2"]
        band = f"[{s['placebo_p5']:+.1f}, {s['placebo_p95']:+.1f}]"
        print(
            f"  P2   regola C: tiene {s['operazioni_con_c']} op su {s['operazioni_senza_c']} "
            f"({s['tolte_pct']}% tolte), vero {s['vero']:+.1f} R, a caso "
            f"{s['placebo_medio']:+.1f} {band}, batte il {s['batte_pct']}%"
        )
    print("\nVerdetto:", json.dumps(verdict, ensure_ascii=False, indent=1))
    print("Controllo: la simulazione ridà l'R del replay, scarto massimo", checks)


if __name__ == "__main__":
    run()
