"""Exam E02 of the library: a slow trend engine on the 36 perpetuals, daily, sized by
volatility. Does it make money after costs and funding, and does it add to the 4h desk?

The rules are the library's (research/biblioteca.md, E02), fixed before this test:
- T1, the sign of the return: s = the average of sign(close today / close L days ago - 1)
  for L = 7, 14, 28, 56, 112 days, from -1 to +1. Two variants: long and short; long only.
- T2, Donchian channels: for L = 10, 20, 30, 60, 90, 150 days a sub-signal turns 1 when
  the close clears the highest close of the previous L days and back to 0 when it falls
  under the channel's midpoint. s = the average of the six, from 0 to 1. Long only. The
  library asked to check this exit against the paper first; SSRN turns automated readers
  away, so it is the rule the library declared, unchecked.
- Reference, not a candidate: the Turtles' System 2 on daily candles (in on a 55-day
  breakout, out on a 20-day one, a stop at 2 N, 1% risk, no additions, shorts mirrored).
- The weight of a coin is s x (0.20 / N) / vol30. N is the number of coins with 120 days
  of history that day; vol30 is the annualized volatility of the last 30 daily returns.
  So each coin carries the same share of risk. At most 20% of equity on a coin, 1.5x
  gross. A weight changes only when the new one differs from the held one by more than
  25%. No fixed stop: out when the signal says so, plus an emergency stop at 4 daily
  standard deviations.
- Decided on the daily close at 00:00 UTC, executed at the open of the 00:00 candle.
  Fees 0.055% and slippage 0.1% on every change; funding every 8 hours.

Year 1 is mostly warm-up and decides nothing. The verdict is on years 2 and 3, on the
average of the three variants:
- it fails if that average loses money after costs and funding;
- it fails if half of it, next to the 4h desk (E01 at the current rules) at equal risk,
  does not raise the desk's MAR (yearly return over worst drawdown);
- it was luck on one coin if the result disappears without the best coin;
- T2 does not replicate the paper if it holds only before April 2025.

Run from trading-desk/:  uv run python research/trend.py
"""

from __future__ import annotations

import json
import math
import pickle
import sys
from datetime import UTC, datetime
from pathlib import Path
from statistics import fmean, pstdev

sys.path.insert(0, str(Path(__file__).parent))

import derivs  # noqa: E402
import perps  # noqa: E402

OUT = Path(__file__).parent
DAY_MS = 86_400_000
COST = 0.00055 + 0.001  # fee and slippage, on every change of position
TARGET_VOL, CAP_COIN, CAP_GROSS, BAND, EMERGENCY = 0.20, 0.20, 1.5, 0.25, 4.0
HISTORY = 120  # days a coin needs before it joins
T1_LAGS = (7, 14, 28, 56, 112)
T2_LAGS = (10, 20, 30, 60, 90, 150)
YEARS = {"Y1": ("2023-11-01", "2024-11-01"), "Y2": ("2024-11-01", "2025-11-01"),
         "Y3": ("2025-11-01", "2026-11-01")}  # fmt: skip
JUDGED = ("2024-11-01", "2026-11-01")  # years 2 and 3
PAPER_END = "2025-04-01"  # the paper's own sample ends here
VARIANTS = ("T1 long e short", "T1 solo long", "T2 solo long")


# --- daily candles from the 4h ones --------------------------------------------------------


def daily(candles: list, rates: dict) -> list[dict]:
    """One bar per UTC day: open at 00:00, high, low, close at 24:00, and the funding
    settled that day with the price at each settlement."""
    days: dict[int, list] = {}
    for c in candles:
        days.setdefault(c.ts // DAY_MS, []).append(c)
    bars = []
    for key in sorted(days):
        cs = sorted(days[key], key=lambda c: c.ts)
        funding = [
            (c.ts % DAY_MS // 3_600_000, c.open, rates[c.ts])
            for c in cs
            if c.ts % perps.FUNDING_MS == 0 and c.ts in rates
        ]
        bars.append({"day": datetime.fromtimestamp(key * 86400, UTC).date().isoformat(),
                     "open": cs[0].open, "high": max(c.high for c in cs),
                     "low": min(c.low for c in cs), "close": cs[-1].close,
                     "funding": funding})  # fmt: skip
    return bars


def sign(x: float) -> int:
    return (x > 0) - (x < 0)


def signals(bars: list[dict]) -> dict[str, list]:
    """Per day, from the closes up to that day: T1, T2, vol30 (annualized) and the daily
    standard deviation, the Turtles' channels and N."""
    closes = [b["close"] for b in bars]
    n = len(bars)
    t1, t2, vol, sd = [None] * n, [None] * n, [None] * n, [None] * n
    state = dict.fromkeys(T2_LAGS, 0)
    rets = [None] + [closes[i] / closes[i - 1] - 1 for i in range(1, n)]
    hi55, lo55, hi20, lo20, atr20 = [None] * n, [None] * n, [None] * n, [None] * n, [None] * n
    for i in range(n):
        if i >= max(T1_LAGS):
            t1[i] = fmean(sign(closes[i] / closes[i - lag] - 1) for lag in T1_LAGS)
        for lag in T2_LAGS:
            if i >= lag:
                window = closes[i - lag : i]
                top, bottom = max(window), min(window)
                if closes[i] > top:
                    state[lag] = 1
                elif closes[i] < (top + bottom) / 2:
                    state[lag] = 0
        t2[i] = fmean(state.values()) if i >= min(T2_LAGS) else None
        if i >= 30:
            last = rets[i - 29 : i + 1]
            sd[i] = pstdev(last)
            vol[i] = sd[i] * math.sqrt(365)
        if i >= 55:
            hi55[i] = max(b["high"] for b in bars[i - 55 : i])
            lo55[i] = min(b["low"] for b in bars[i - 55 : i])
        if i >= 20:
            hi20[i] = max(b["high"] for b in bars[i - 20 : i])
            lo20[i] = min(b["low"] for b in bars[i - 20 : i])
            ranges = [
                max(b["high"] - b["low"], abs(b["high"] - p["close"]), abs(b["low"] - p["close"]))
                for p, b in zip(bars[i - 20 : i], bars[i - 19 : i + 1], strict=True)
            ]
            atr20[i] = fmean(ranges)
    return {"T1": t1, "T2": t2, "vol": vol, "sd": sd, "hi55": hi55, "lo55": lo55,
            "hi20": hi20, "lo20": lo20, "atr20": atr20}  # fmt: skip


# --- the portfolio -------------------------------------------------------------------------


def simulate(
    coins: dict,
    variant: str,
    exclude: frozenset = frozenset(),
    start: str = "",
    target_vol: float = TARGET_VOL,
    capital: float = 1000.0,
) -> dict:
    """Day by day: execute at the open what the last close decided, pay funding, check the
    stops on the day's range, mark at the close, decide for tomorrow."""
    calendar = sorted({b["day"] for c in coins.values() for b in c["bars"]})
    index = {s: {b["day"]: i for i, b in enumerate(c["bars"])} for s, c in coins.items()}
    equity = capital
    units: dict[str, float] = {}  # signed, per coin
    stops: dict[str, float] = {}
    turtle_stop: dict[str, float] = {}  # the Turtles' stop, fixed at entry
    target: dict[str, float] = {}  # units decided at the last close
    curve, costs, funding_paid, gross = {}, 0.0, 0.0, []
    pnl_by_coin: dict[str, float] = {}

    def book(symbol: str, amount: float, day: str) -> None:
        if JUDGED[0] <= day < JUDGED[1]:
            pnl_by_coin[symbol] = pnl_by_coin.get(symbol, 0.0) + amount

    for day in calendar:
        today = {s: coins[s]["bars"][index[s][day]] for s in coins if day in index[s]}
        # 1. Funding at 00:00 on the positions held overnight, then the open's trades.
        for s, q in units.items():
            if s in today:
                for hour, price, rate in today[s]["funding"]:
                    if hour == 0:  # the 00:00 settlement
                        paid = q * price * rate
                        equity -= paid
                        funding_paid += paid
                        book(s, -paid, day)
        for s in set(units) | set(target):
            if s not in today:
                continue
            want, have = target.get(s, 0.0), units.get(s, 0.0)
            if want != have:
                fee = abs(want - have) * today[s]["open"] * COST
                equity -= fee
                costs += fee
                book(s, -fee, day)
                units[s] = want
        units = {s: q for s, q in units.items() if q}
        # 2. The day: profit from the open, the stops on the range, funding at 08:00 and 16:00.
        for s, q in list(units.items()):
            if s not in today:
                continue
            bar = today[s]
            stop = stops.get(s)
            hit = stop is not None and (bar["low"] <= stop if q > 0 else bar["high"] >= stop)
            out = (min(stop, bar["open"]) if q > 0 else max(stop, bar["open"])) if hit else None
            for hour, price, rate in bar["funding"]:
                if hour and not hit:  # 08:00 and 16:00, unless a stop closed it first
                    paid = q * price * rate
                    equity -= paid
                    funding_paid += paid
                    book(s, -paid, day)
            move = q * ((out if hit else bar["close"]) - bar["open"])
            equity += move
            book(s, move, day)
            if hit:
                fee = abs(q) * out * COST
                equity -= fee
                costs += fee
                book(s, -fee, day)
                del units[s]
                turtle_stop.pop(s, None)
        if day >= start:
            curve[day] = equity
        gross.append(
            sum(abs(q) * today[s]["close"] for s, q in units.items() if s in today) / equity
        )
        # 3. Decide tomorrow's positions at today's close.
        target, stops = decide(
            coins, today, index, day, units, turtle_stop, equity, variant, exclude, target_vol
        )
        if day < start:  # before the start nothing is held
            target, stops = {}, {}
        # From tomorrow's open the overnight move counts too: carry it into the open.
        for s, q in units.items():
            nxt = next_open(coins[s]["bars"], index[s], day)
            if nxt is not None:
                move = q * (nxt - today[s]["close"]) if s in today else 0.0
                equity += move
                book(s, move, day)
    return {"curve": curve, "costs": costs, "funding": funding_paid, "units": dict(units),
            "gross": fmean(gross) if gross else 0.0, "by_coin": pnl_by_coin}  # fmt: skip


def next_open(bars: list[dict], index: dict, day: str) -> float | None:
    i = index.get(day)
    return bars[i + 1]["open"] if i is not None and i + 1 < len(bars) else None


def decide(
    coins, today, index, day, units, turtle_stop, equity, variant, exclude, target_vol=TARGET_VOL
):
    """The units each coin should hold from tomorrow's open, and the stops for tomorrow."""
    ready = {s for s, bar in today.items() if s not in exclude and index[s][day] + 1 >= HISTORY}
    target, stops = {}, {}
    if variant == "Turtle S2":
        for s in ready:
            i, sig, bar = index[s][day], coins[s]["sig"], today[s]
            q = units.get(s, 0.0)
            n = sig["atr20"][i]
            if q > 0:
                keep = bar["close"] >= sig["lo20"][i]
            elif q < 0:
                keep = bar["close"] <= sig["hi20"][i]
            else:
                keep = False
            if keep:
                target[s] = q
                stops[s] = turtle_stop[s]
                continue
            turtle_stop.pop(s, None)
            if q == 0 and n and sig["hi55"][i] is not None:
                side = (
                    1
                    if bar["close"] > sig["hi55"][i]
                    else -1
                    if bar["close"] < sig["lo55"][i]
                    else 0
                )
                if side:
                    size = min(0.01 * equity / (2 * n), CAP_COIN * equity / bar["close"])
                    target[s] = side * size
                    stops[s] = turtle_stop[s] = bar["close"] - side * 2 * n
        scale_gross(target, today, equity)
        return target, stops
    key = "T2" if variant.startswith("T2") else "T1"
    weights = {}
    for s in ready:
        i, sig = index[s][day], coins[s]["sig"]
        sv, vol = sig[key][i], sig["vol"][i]
        if sv is None or not vol:
            continue
        if variant.endswith("solo long"):
            sv = max(sv, 0.0)
        if sv:
            weights[s] = max(-CAP_COIN, min(CAP_COIN, sv * (target_vol / len(ready)) / vol))
    total = sum(abs(w) for w in weights.values())
    if total > CAP_GROSS:
        weights = {s: w * CAP_GROSS / total for s, w in weights.items()}
    for s in set(weights) | set(units):
        if s not in today:
            if s in units:
                target[s] = units[s]
            continue
        price = today[s]["close"]
        want = weights.get(s, 0.0)
        have = units.get(s, 0.0) * price / equity
        if want == 0.0 or have == 0.0 or abs(want - have) > BAND * abs(have):
            target[s] = want * equity / price
        else:
            target[s] = units[s]
        if target[s]:
            sd = coins[s]["sig"]["sd"][index[s][day]] or 0.0
            stops[s] = (
                price * (1 - EMERGENCY * sd) if target[s] > 0 else price * (1 + EMERGENCY * sd)
            )
    return {s: q for s, q in target.items() if q}, stops


def scale_gross(target: dict, today: dict, equity: float) -> None:
    gross = sum(abs(q) * today[s]["close"] for s, q in target.items() if s in today) / equity
    if gross > CAP_GROSS:
        for s in target:
            target[s] *= CAP_GROSS / gross


# --- measuring -----------------------------------------------------------------------------


def returns(curve: dict) -> dict[str, float]:
    days = sorted(curve)
    return {d: curve[d] / curve[p] - 1 for p, d in zip(days, days[1:], strict=False)}


def figures(daily: dict[str, float], start: str, end: str) -> dict:
    """Return %, worst drawdown %, MAR (yearly return / worst drawdown) and Sharpe."""
    rs = [r for d, r in sorted(daily.items()) if start <= d < end]
    if not rs:
        return {}
    value, peak, worst = 1.0, 1.0, 0.0
    for r in rs:
        value *= 1 + r
        peak = max(peak, value)
        worst = max(worst, 1 - value / peak)
    years = len(rs) / 365
    yearly = value ** (1 / years) - 1
    sd = pstdev(rs)
    return {"ret": round((value - 1) * 100, 1), "dd": round(worst * 100, 1),
            "mar": round(yearly / worst, 2) if worst else None,
            "sharpe": round(fmean(rs) / sd * math.sqrt(365), 2) if sd else None}  # fmt: skip


def e01_curve() -> dict[str, float]:
    """The 4h desk at its current rules (12% cap, rule C, the Bybit fee), day by day."""
    data = pickle.loads((OUT / "perps.pkl").read_bytes())
    setup = perps.Setup(sides="both", cap_pos=0.33, cap_total=1.5, fee=0.00055,
                        rules={"max_stop_pct": 12.0}, keep_curve=True)  # fmt: skip
    setup.entry_filter = derivs.make_filter("C", pickle.loads((OUT / "derivs.pkl").read_bytes()))
    start, end = (int(datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp() * 1000)
                  for d in ("2023-11-01", "2026-11-01"))  # fmt: skip
    return dict(perps.replay(data, setup, start, end)["curve"])


def run() -> None:
    data = pickle.loads((OUT / "perps.pkl").read_bytes())
    coins = {}
    for s, candles in data["klines"].items():
        bars = daily(candles, data["funding"].get(s, {}))
        coins[s] = {"bars": bars, "sig": signals(bars)}

    runs = {v: simulate(coins, v) for v in (*VARIANTS, "Turtle S2")}
    daily_r = {v: returns(r["curve"]) for v, r in runs.items()}
    common = sorted(set.intersection(*(set(daily_r[v]) for v in VARIANTS)))
    daily_r["media delle tre"] = {d: fmean(daily_r[v][d] for v in VARIANTS) for d in common}
    e01 = returns(e01_curve())
    daily_r["E01 (4 ore)"] = e01

    periods = {**YEARS, "anni 2 e 3": JUDGED}
    table = {v: {p: figures(r, *span) for p, span in periods.items()} for v, r in daily_r.items()}

    # Next to the 4h desk at equal risk, on years 2 and 3.
    shared = sorted(
        d for d in set(e01) & set(daily_r["media delle tre"]) if JUDGED[0] <= d < JUDGED[1]
    )
    a = [e01[d] for d in shared]
    b = [daily_r["media delle tre"][d] for d in shared]
    scale = pstdev(a) / pstdev(b)
    together = {d: 0.5 * x + 0.5 * y * scale for d, x, y in zip(shared, a, b, strict=True)}
    mean_a, mean_b = fmean(a), fmean(b)
    corr = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b, strict=True)) / (
        len(a) * pstdev(a) * pstdev(b)
    )
    combo = {"E01 da solo": figures(e01, *JUDGED), "E01 + trend lento": figures(together, *JUDGED),
             "correlazione": round(corr, 2), "scala del trend": round(scale, 2)}  # fmt: skip

    # Without the coin that made the most in years 2 and 3.
    by_coin: dict[str, float] = {}
    for v in VARIANTS:
        for s, x in runs[v]["by_coin"].items():
            by_coin[s] = by_coin.get(s, 0.0) + x
    best = max(by_coin, key=by_coin.get)
    without = {v: returns(simulate(coins, v, frozenset({best}))["curve"]) for v in VARIANTS}
    without_avg = [figures(without[v], *JUDGED)["ret"] for v in VARIANTS]

    t2 = daily_r["T2 solo long"]
    paper = {"prima di aprile 2025": figures(t2, JUDGED[0], PAPER_END)["ret"],
             "da aprile 2025": figures(t2, PAPER_END, JUDGED[1])["ret"]}  # fmt: skip

    avg_judged = fmean(table[v]["anni 2 e 3"]["ret"] for v in VARIANTS)
    verdict = {
        "media delle tre varianti, anni 2 e 3 (%)": round(avg_judged, 1),
        "positiva dopo costi e funding": avg_judged > 0,
        "accanto al 4 ore alza il MAR": combo["E01 + trend lento"]["mar"]
        > combo["E01 da solo"]["mar"],
        f"senza la moneta migliore ({best}) resta positiva": fmean(without_avg) > 0,
        "T2 regge anche dopo aprile 2025": paper["da aprile 2025"] > 0,
    }
    result = {"tabella": table, "accanto_al_4_ore": combo, "moneta_migliore": best,
              "senza_la_migliore": dict(zip(VARIANTS, without_avg, strict=True)),
              "T2_prima_e_dopo": paper, "verdetto": verdict,
              "costi_e_funding": {v: {"costi": round(r["costs"], 1),
                                      "funding": round(r["funding"], 1),
                                      "esposizione_media": round(r["gross"], 2)}
                                  for v, r in runs.items()}}  # fmt: skip
    (OUT / "trend.json").write_text(json.dumps(result, indent=1, ensure_ascii=False))

    print("Rendimento % · calo massimo % · MAR · Sharpe")
    for v, rows in table.items():
        cells = "  ".join(
            f"{p} {f['ret']:+6.1f} dd {f['dd']:4.1f} mar {f['mar']} sh {f['sharpe']}"
            for p, f in rows.items()
            if f
        )
        print(f"  {v:<16} {cells}")
    print("\nCosti e funding su 1.000 $ (tre anni):")
    for v, r in runs.items():
        print(f"  {v:<16} costi {r['costs']:6.1f} $  funding {r['funding']:+6.1f} $  "
              f"esposizione media {r['gross']:.2f}x")  # fmt: skip
    print("\nAccanto al 4 ore (anni 2 e 3, rischio uguale):", json.dumps(combo, ensure_ascii=False))
    print(f"Senza {best}: {dict(zip(VARIANTS, without_avg, strict=True))}")
    print("T2 prima e dopo aprile 2025:", paper)
    print("\nVerdetto:", json.dumps(verdict, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    run()
