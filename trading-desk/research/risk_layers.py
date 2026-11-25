"""Exams E03 and E05 of the library: two risk layers on the perpetuals desk (E01 at the
current rules: stops up to 12%, rule C, the Bybit fee), each judged at the same average
exposure as the desk without it.

E03, the volatility target (research/biblioteca.md, rules fixed before this test):
- V1: every day at 00:00 UTC, k = target / estimated volatility, kept between 0.25 and 1.5;
  new trades risk 1% x k, open positions are left alone. The estimate is the EWMA standard
  deviation (half-life 10 days) of the equity curve's daily returns, annualized; the target
  is the median of that estimate in year 1, fixed once.
- V2: V1, and the risk of new trades halves again in a panic: BTC closes under its 50-day
  average while its 20-day volatility is in the top 20% of the last 365 days.
- Against the desk at a fixed risk that gives the same average exposure. Measures: worst
  drawdown, worst week, the average of the worst 5% of days, MAR. It fails if those tails
  improve in neither year 2 nor year 3, or if the MAR is worse in both.

E05, the cap on correlated risk:
- At each new setup: the correlations of the last 60 daily returns between the coins held
  and the new one, each off the diagonal raised to at least 0.6 (crashes pull them up);
  w the risks of the positions in % of equity, signed. The entry passes only if
  sqrt(w' C w) stays at or under 3% with it; otherwise it is dropped, with no substitute.
- Variant S: at most 3 positions on the same side. Neighbours 2.5% and 3.5% show the
  plateau; they are not candidates.
- Placebo: the same share of setups dropped at random, 1,000 times. It fails if worst
  drawdown and worst week do not improve more than the placebo's at the same exposure (here:
  better than 90% of its draws, the bar the library set for rule C), or if it gives up more
  return than the drawdown it saves.

Run from trading-desk/:  uv run python research/risk_layers.py
"""

from __future__ import annotations

import json
import math
import pickle
import random
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from functools import cache
from pathlib import Path
from statistics import fmean, median, pstdev

sys.path.insert(0, str(Path(__file__).parent))

import derivs  # noqa: E402
import perps  # noqa: E402

OUT = Path(__file__).parent
FEE = 0.00055
YEARS = {
    "Y1": ("2023-11-01", "2024-11-01"),
    "Y2": ("2024-11-01", "2025-11-01"),
    "Y3": ("2025-11-01", "2026-11-01"),
}
CHECKED = ("Y2", "Y3")
SIMS = 1000
HALF_LIFE = 10
CAPS = (2.5, 3.0, 3.5)


@cache
def data() -> dict:
    return pickle.loads((OUT / "perps.pkl").read_bytes())


@cache
def metrics() -> dict:
    return pickle.loads((OUT / "derivs.pkl").read_bytes())


def ms(day: str) -> int:
    return int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp() * 1000)


def last_day(close_s: float) -> str:
    """The last UTC day complete at this moment."""
    midnight = math.floor(close_s / 86400) * 86400
    return datetime.fromtimestamp(midnight - 1, UTC).date().isoformat()


@cache
def daily_closes() -> dict[str, dict[str, float]]:
    """Each coin's close at midnight UTC, by day (the close of its 20:00 candle)."""
    out: dict[str, dict[str, float]] = {}
    for s, candles in data()["klines"].items():
        out[s] = {
            datetime.fromtimestamp((c.ts + perps.CANDLE_MS) / 1000 - 1, UTC)
            .date()
            .isoformat(): c.close
            for c in candles
            if (c.ts + perps.CANDLE_MS) % 86_400_000 == 0
        }
    return out


@cache
def daily_returns() -> dict[str, dict[str, float]]:
    out = {}
    for s, closes in daily_closes().items():
        days = sorted(closes)
        out[s] = {d: closes[d] / closes[p] - 1 for p, d in zip(days, days[1:], strict=False)}
    return out


@cache
def panic_days() -> frozenset[str]:
    """Days BTC closed under its 50-day average with its 20-day volatility in the top 20%
    of the last 365 days."""
    closes = daily_closes()["BTC/USDT"]
    days = sorted(closes)
    rets = daily_returns()["BTC/USDT"]
    vol20: dict[str, float] = {}
    out = set()
    for i, d in enumerate(days):
        if i >= 20:
            vol20[d] = pstdev(rets[x] for x in days[i - 19 : i + 1])
        if i < 50 or d not in vol20:
            continue
        below = closes[d] < fmean(closes[x] for x in days[i - 49 : i + 1])
        past = [vol20[x] for x in days[max(0, i - 364) : i + 1] if x in vol20]
        if below and len(past) >= 60 and vol20[d] >= sorted(past)[int(0.8 * (len(past) - 1))]:
            out.add(d)
    return frozenset(out)


# --- the hooks ------------------------------------------------------------------------------


class Ewma:
    """EWMA standard deviation of daily returns, annualized, fed one daily mark at a time."""

    def __init__(self, half_life: int = HALF_LIFE) -> None:
        self.lam = 0.5 ** (1 / half_life)
        self.var: float | None = None
        self.last: float | None = None
        self.n = 0

    def add(self, mark: float) -> None:
        if self.last is not None:
            r = mark / self.last - 1
            self.var = r * r if self.var is None else self.lam * self.var + (1 - self.lam) * r * r
            self.n += 1
        self.last = mark

    @property
    def vol(self) -> float | None:
        return math.sqrt(self.var * 365) if self.var is not None and self.n >= 20 else None


def vol_target(target: float, panic: bool):
    est, seen = Ewma(), [0]

    def scale(close_s: float, marks: list[float]) -> float:
        while seen[0] < len(marks):
            est.add(marks[seen[0]])
            seen[0] += 1
        k = 1.0 if est.vol is None else min(1.5, max(0.25, target / est.vol))
        if panic and last_day(close_s) in panic_days():
            k *= 0.5
        return k

    return scale


@cache
def return_days(symbol: str) -> list[str]:
    return sorted(daily_returns()[symbol])


@cache
def correlation(a: str, b: str, day: str) -> float:
    """Correlation of the two coins' last 60 daily returns up to `day`, at least 0.6; 1 when
    they share fewer than 30 days."""
    ra, rb = daily_returns()[a], daily_returns()[b]
    days = [d for d in return_days(a) if d <= day and d in rb][-60:]
    if len(days) < 30:
        return 1.0
    xa, xb = [ra[d] for d in days], [rb[d] for d in days]
    ma, mb, sa, sb = fmean(xa), fmean(xb), pstdev(xa), pstdev(xb)
    if not sa or not sb:
        return 1.0
    rho = sum((x - ma) * (y - mb) for x, y in zip(xa, xb, strict=True)) / (len(days) * sa * sb)
    return max(0.6, rho)


class Gate:
    """An entry gate that counts what it sees and drops."""

    def __init__(self, kind: str, cap: float = 3.0, drop: float = 0.0, seed: int = 0) -> None:
        self.kind, self.cap, self.drop = kind, cap, drop
        self.rng = random.Random(seed)
        self.seen = self.dropped = 0

    def __call__(self, symbol, side, close_s, book, new_risk) -> bool:
        self.seen += 1
        ok = self.check(symbol, side, close_s, book, new_risk)
        self.dropped += not ok
        return ok

    def check(self, symbol, side, close_s, book, new_risk) -> bool:
        if self.kind == "random":
            return self.rng.random() >= self.drop
        if self.kind == "same side":
            return sum(1 for _, s, _ in book if s == side) < 3
        day = last_day(close_s)
        items = [*book, (symbol, side, new_risk)]
        total = 0.0
        for i, (a, sa, wa) in enumerate(items):
            for j, (b, sb, wb) in enumerate(items):
                c = 1.0 if i == j else correlation(a, b, day)
                total += (sa * wa) * (sb * wb) * c
        return math.sqrt(max(total, 0.0)) <= self.cap


# --- runs -----------------------------------------------------------------------------------


def run_one(args: tuple) -> dict:
    """One three-year replay: name, risk % of new trades, and the layer to use."""
    name, risk, layer, param = args
    setup = perps.Setup(
        sides="both",
        cap_pos=0.33,
        cap_total=1.5,
        fee=FEE,
        rules={"max_stop_pct": 12.0, "risk_per_trade_pct": risk},
        keep_curve=True,
    )
    setup.entry_filter = derivs.make_filter("C", metrics())
    gate = None
    if layer in ("V1", "V2"):
        setup.risk_scale = vol_target(param, panic=layer == "V2")
    elif layer == "cap":
        gate = Gate("cap", cap=param)
    elif layer == "same side":
        gate = Gate("same side")
    elif layer == "random":
        gate = Gate("random", drop=param[0], seed=param[1])
    if gate:
        setup.entry_gate = gate
    start, end = ms("2023-11-01"), ms("2026-11-01")
    out = perps.replay(data(), setup, start, end)
    out["name"], out["risk"] = name, risk
    out["drop_share"] = round(gate.dropped / gate.seen, 4) if gate and gate.seen else 0.0
    return out


def tails(curve: dict[str, float], start: str, end: str) -> dict:
    """Return, worst drawdown, worst week, the average of the worst 5% of days, MAR."""
    days = sorted(d for d in curve if start <= d < end)
    if len(days) < 30:
        return {}
    values = [curve[d] for d in days]
    rets = [b / a - 1 for a, b in zip(values, values[1:], strict=False)]
    peak, worst = values[0], 0.0
    for v in values:
        peak = max(peak, v)
        worst = max(worst, 1 - v / peak)
    weeks = [values[i] / values[i - 7] - 1 for i in range(7, len(values))]
    tail = sorted(rets)[: max(1, len(rets) // 20)]
    total = values[-1] / values[0] - 1
    yearly = (1 + total) ** (365 / len(rets)) - 1
    return {
        "ret": round(total * 100, 1),
        "dd": round(worst * 100, 2),
        "week": round(min(weeks) * 100, 2),
        "cvar5": round(fmean(tail) * 100, 3),
        "mar": round(yearly / worst, 2) if worst else None,
    }


def by_year(curve: dict) -> dict:
    return {
        y: tails(curve, *span)
        for y, span in {**YEARS, "3 anni": ("2023-11-01", "2026-11-01")}.items()
    }


def matched(pool, name: str, exposure: float, base: dict) -> dict:
    """The desk without the layer, at the fixed risk that gives `exposure` on average."""
    risk = 1.0 * exposure / base["exposure"]
    first = pool.submit(run_one, (f"{name} rischio fisso", risk, None, None)).result()
    risk *= exposure / first["exposure"]
    return pool.submit(run_one, (f"{name} rischio fisso", risk, None, None)).result()


def run() -> None:
    with ProcessPoolExecutor(max_workers=4) as pool:
        base = pool.submit(run_one, ("E01 rischio 1%", 1.0, None, None)).result()
        est, series = Ewma(), {}
        for d, v in base["curve"]:
            est.add(v)
            if est.vol is not None:
                series[d] = est.vol
        target = median(v for d, v in series.items() if YEARS["Y1"][0] <= d < YEARS["Y1"][1])

        jobs = [
            ("V1", 1.0, "V1", target),
            ("V2", 1.0, "V2", target),
            *((f"tetto {c}%", 1.0, "cap", c) for c in CAPS),
            ("S", 1.0, "same side", None),
        ]
        layers = {r["name"]: r for r in pool.map(run_one, jobs)}
        fixed = {
            n: matched(pool, n, layers[n]["exposure"], base)
            for n in ("V1", "V2", "tetto 3.0%", "S")
        }

        drop = layers["tetto 3.0%"]["drop_share"]
        placebo = list(
            pool.map(
                run_one,
                [(f"placebo {i}", 1.0, "random", (drop, i)) for i in range(SIMS)],
                chunksize=10,
            )
        )

    # E03 at the same exposure.
    e03 = {}
    for name in ("V1", "V2"):
        mine, theirs = by_year(dict(layers[name]["curve"])), by_year(dict(fixed[name]["curve"]))
        years = {}
        for y in CHECKED:
            m, t = mine[y], theirs[y]
            better = [m["dd"] < t["dd"], m["week"] > t["week"], m["cvar5"] > t["cvar5"]]
            years[y] = {
                "con il livello": m,
                "rischio fisso": t,
                "code migliori": sum(better),
                "MAR migliore": m["mar"] > t["mar"],
            }
        e03[name] = {
            "esposizione": layers[name]["exposure"],
            "rischio fisso equivalente": round(fixed[name]["risk"], 3),
            "anni": years,
            "tre anni": {"con il livello": mine["3 anni"], "rischio fisso": theirs["3 anni"]},
            "passa": any(v["code migliori"] >= 2 for v in years.values())
            and not all(not v["MAR migliore"] for v in years.values()),
        }

    # E05: the cap against the same share dropped at random, scaled to the same exposure.
    e05 = {}
    cap = layers["tetto 3.0%"]
    cap_t = by_year(dict(cap["curve"]))["3 anni"]
    draws_dd, draws_week = [], []
    for p in placebo:
        f = by_year(dict(p["curve"]))["3 anni"]
        ratio = cap["exposure"] / p["exposure"]
        draws_dd.append(f["dd"] * ratio)
        draws_week.append(f["week"] * ratio)
    base_eq = by_year(dict(fixed["tetto 3.0%"]["curve"]))["3 anni"]
    e05["tetto 3%"] = {
        "segnali scartati %": round(drop * 100, 1),
        "esposizione": cap["exposure"],
        "tre anni": cap_t,
        "senza tetto, stessa esposizione": base_eq,
        "placebo calo massimo (p10, mediana)": (
            round(sorted(draws_dd)[SIMS // 10], 2),
            round(median(draws_dd), 2),
        ),
        "placebo settimana peggiore (mediana, p90)": (
            round(median(draws_week), 2),
            round(sorted(draws_week)[SIMS * 9 // 10], 2),
        ),
        "batte il placebo sul calo %": round(
            100 * sum(cap_t["dd"] < d for d in draws_dd) / SIMS, 1
        ),
        "batte il placebo sulla settimana %": round(
            100 * sum(cap_t["week"] > w for w in draws_week) / SIMS, 1
        ),
        "rendimento perso": round(base_eq["ret"] - cap_t["ret"], 1),
        "calo evitato": round(base_eq["dd"] - cap_t["dd"], 1),
    }
    t = e05["tetto 3%"]
    t["passa"] = (
        t["batte il placebo sul calo %"] >= 90
        and t["batte il placebo sulla settimana %"] >= 90
        and not t["rendimento perso"] > t["calo evitato"]
    )
    for name in ("tetto 2.5%", "tetto 3.5%", "S"):
        e05[name] = {
            "segnali scartati %": round(layers[name]["drop_share"] * 100, 1),
            "esposizione": layers[name]["exposure"],
            "tre anni": by_year(dict(layers[name]["curve"]))["3 anni"],
        }
    e05["S"]["senza tetto, stessa esposizione"] = by_year(dict(fixed["S"]["curve"]))["3 anni"]

    result = {
        "obiettivo di volatilità (anno 1)": round(target, 4),
        "base": by_year(dict(base["curve"])),
        "esposizione base": base["exposure"],
        "E03": e03,
        "E05": e05,
        "giorni di panico": len(panic_days()),
    }
    (OUT / "risk_layers.json").write_text(json.dumps(result, indent=1, ensure_ascii=False))
    print(json.dumps(result, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    run()
