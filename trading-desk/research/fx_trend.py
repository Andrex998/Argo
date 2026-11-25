"""Exam E11 of the library: the slow trend of E02 on the forex school's nine markets (seven
currency pairs, gold, and SLV for silver), on daily candles. Does it make money after
costs, and does the sign of its signal beat random signs?

The rules are the library's (research/biblioteca.md, E11, committed in 9c3b2b3 before the
data was looked at), implemented as written:
- The signal: s = the average sign of the returns over 5, 10, 20, 40 and 80 trading days
  (1, 2, 4, 8 and 16 weeks), from -1 to +1. Long and short.
- The weight of a market = s x (0.10 / N) / vol60. N is the number of markets with 120 days
  of history; vol60 the yearly volatility of the last 60 daily returns.
- At most 0.5 times equity on a market and 3 times in all.
- Decided every Friday at the close and executed at that same close. A weight changes only
  when the new one is more than 25% away from the one held.
- Costs: on every change, the forex school's spread (MARKETS in fx-school/school.py) plus a
  slippage equal to the spread. Rollover interest is left out: a declared limit.
- Placebo: 1,000 series with the same absolute weights and the signs of the signal drawn at
  random every Friday.
- It passes only if all four hold: (1) after costs, over the whole period, the Sharpe is at
  least 0.3 and at least 60% of the complete calendar years are positive; (2) the Sharpe
  beats the placebo's 95th percentile; (3) the return stays positive without the best
  market; (4) the return is positive over the last 5 years too.

Where the text leaves a detail open, the simplest reading, fixed before the run:
- Data: one Twelve Data request per market for its last 5,000 daily candles, read and
  cleaned as the school reads them (school._get and school._candles, with the school's
  sanity check). Only Monday to Friday candles: the rule counts trading days, five to a
  week, and the feed has added Saturday and Sunday candles to the currencies since
  2024-2025. Candles dated on or after the day they were read are dropped (still forming).
- Each market counts its own trading days: the lags and vol60 use its own candles, close
  to close. vol60 is the population standard deviation of the last 60 returns x sqrt(260)
  (five days a week, 52 weeks); the portfolio's volatility and Sharpe use the same 260.
- N counts the markets with at least 120 candles up to that Friday, whether or not they
  trade that day; a market enters on its 120th candle. The whole period starts on the
  first Friday with N >= 1 and ends on the last closed candle.
- Money as the school counts it: positions are held in units, and a weight is a dollar
  value over equity. The dollar pairs (USD/JPY, USD/CHF, USD/CAD) hold dollars and gain
  move / price (school.usd). The weight "held" is today's: it drifts with price and equity.
- The band: a weight changes when |new - held| > 25% of |held|, so entering, leaving and
  turning around always trade. The caps: each weight is clipped to +-0.5, then all of them
  are scaled down together if their sum in absolute value is over 3.
- Friday: a calendar Friday on which the market has a candle. A market without one that
  Friday (SLV on Good Friday) keeps its position until the next Friday.
- Costs: |units changed| x 2 x the spread in MARKETS, at that day's price, turned into
  dollars as the school does (school.usd).
- The placebo: each Friday a fair coin, independent for each market and each Friday,
  replaces the sign of the signal; weights, caps, band and costs are those of the rules, so
  the target weights keep their absolute values. Seed 2026. The 95th percentile is the
  951st of the 1,000 sorted Sharpes, as in research/placebo.py.
- The Sharpe is the mean over the standard deviation of the daily returns of the equity
  curve, x sqrt(260). A calendar year is complete when the period covers all of it, and
  positive when its return after costs is above zero.
- The best market is the one that made the most dollars, net of its costs, over the whole
  period; criterion 3 runs the rules again without it (N then counts the other eight).
- The last 5 years run from the last close on or before the same day five years before
  the end; their return is read on the same equity curve.
- Capital: 10,000 $, the size of a school wallet.

Reported outside the verdict, which they do not change: the Sharpe before costs against
the placebo's before costs (random signs turn around more often, so they pay more), and
the split before and after 2010 that the exam names as a warning.

Run from trading-desk/:  uv run --frozen python research/fx_trend.py
The candles are read from Twelve Data only when the cache does not have them yet (the
network proxy adds the key); FX_TREND_CACHE sets another cache folder.
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from bisect import bisect_right
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from statistics import fmean, pstdev

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "fx-school"))

import school  # noqa: E402  fx-school/school.py: the client, the spreads, the money

OUT = Path(__file__).parent
CACHE = Path(
    os.environ.get(
        "FX_TREND_CACHE",
        str(Path(__file__).parent / "data" / "fx_trend"),
    )
)
SIZE = 5000  # daily candles asked per market: the most one request returns
PACE = 8.0  # seconds between requests: under the free plan's 8 a minute

LAGS = (5, 10, 20, 40, 80)  # trading days: 1, 2, 4, 8 and 16 weeks
VOL_DAYS = 60
HISTORY = 120  # candles a market needs before it counts
TARGET = 0.10  # yearly volatility shared out among the N markets
CAP_MARKET, CAP_GROSS, BAND = 0.5, 3.0, 0.25
SLIPPAGE = 1.0  # times the spread, paid on top of the spread
DAYS_PER_YEAR = 260  # five trading days a week
FRIDAY = 4
CAPITAL = school.CAPITAL
SIMS, SEED = 1000, 2026
THRESHOLDS = {"sharpe": 0.3, "positive_years": 0.6, "placebo": 0.95}


# --- data ------------------------------------------------------------------------------------


def cache_file(symbol: str, cache: Path = CACHE) -> Path:
    return cache / f"{symbol.replace('/', '_')}.json"


def download(cache: Path = CACHE) -> int:
    """One request per market not yet in the cache; the raw answer is kept as it came, with
    the moment it was read. Returns the number of requests made."""
    cache.mkdir(parents=True, exist_ok=True)
    made = 0
    for symbol in school.MARKETS:
        path = cache_file(symbol, cache)
        if path.exists():
            continue
        if made:
            time.sleep(PACE)
        params = {"symbol": symbol, "interval": "1day", "outputsize": SIZE, "timezone": "UTC"}
        body = school._get(params)
        made += 1
        read_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
        path.write_text(json.dumps({"letto": read_at, "risposta": body}))
    return made


def weekday(day: str) -> int:
    return date.fromisoformat(day[:10]).weekday()


def load(cache: Path = CACHE) -> tuple[dict[str, list[school.Candle]], dict[str, dict]]:
    """Each market's candles as the school reads them (its sanity check), Monday to Friday,
    only days already closed when they were read; and what was left out."""
    candles, notes = {}, {}
    for symbol in school.MARKETS:
        raw = json.loads(cache_file(symbol, cache).read_text())
        body, read_on = raw["risposta"], raw["letto"][:10]
        sane = school._candles(body, symbol)
        weekdays = [c for c in sane if weekday(c.start) < 5]
        closed = [c for c in weekdays if c.start[:10] < read_on]
        candles[symbol] = closed
        received = len(body.get("values", []))
        notes[symbol] = {
            "letto": raw["letto"],
            "ricevute": received,
            "scartate dal controllo della scuola": received - len(sane),
            "sabato e domenica": len(sane) - len(weekdays),
            "ancora in corso": len(weekdays) - len(closed),
        }
    return candles, notes


def hygiene(candles: dict[str, list[school.Candle]]) -> dict:
    """What looks wrong in the candles kept: holes over 4 days, the share of candles whose
    close is their own open (a stale close), and currency closes that jump more than 5% and
    come back the next day."""
    out = {}
    for symbol, cs in candles.items():
        days = [date.fromisoformat(c.start[:10]) for c in cs]
        holes = [
            (a.isoformat(), b.isoformat())
            for a, b in zip(days, days[1:], strict=False)
            if (b - a).days > 4
        ]
        stale_by_year: dict[str, list[int]] = {}
        for c in cs:
            count = stale_by_year.setdefault(c.start[:4], [0, 0])
            count[0] += abs(c.close / c.open - 1) < 0.0002
            count[1] += 1
        spikes = []
        if symbol not in ("XAU/USD", "SLV"):
            for a, b, c in zip(cs, cs[1:], cs[2:], strict=False):
                up, back = b.close / a.close - 1, c.close / b.close - 1
                given_back = abs(c.close / a.close - 1) < 0.3 * abs(up)
                if abs(up) > 0.05 and up * back < 0 and given_back:
                    spikes.append((b.start[:10], a.close, b.close, c.close))
        out[symbol] = {
            "buchi oltre 4 giorni": holes,
            "chiusura uguale all'apertura, % per anno": {
                y: round(100 * n / total) for y, (n, total) in sorted(stale_by_year.items())
            },
            "picchi di un giorno oltre il 5%": spikes,
        }
    return out


# --- the signal and the weights ------------------------------------------------------------------


def sign(x: float) -> int:
    return (x > 0) - (x < 0)


def signal(closes: list[float], i: int) -> float | None:
    """s at candle i: the average sign of the returns over the five lags, from -1 to +1."""
    if i < max(LAGS):
        return None
    return fmean(sign(closes[i] / closes[i - lag] - 1) for lag in LAGS)


def vol60(closes: list[float], i: int) -> float | None:
    """The yearly volatility of the last 60 close-to-close returns up to candle i."""
    if i < VOL_DAYS:
        return None
    rets = [closes[k] / closes[k - 1] - 1 for k in range(i - VOL_DAYS + 1, i + 1)]
    return pstdev(rets) * math.sqrt(DAYS_PER_YEAR)


def weights(sv: dict[str, tuple[float, float]], n: int) -> dict[str, float]:
    """s x (0.10 / N) / vol60 for each market {name: (s, vol60)}, each clipped to +-0.5,
    then all scaled down together if the gross is over 3."""
    w = {
        m: max(-CAP_MARKET, min(CAP_MARKET, s * (TARGET / n) / v)) if v else 0.0
        for m, (s, v) in sv.items()
    }
    gross = sum(abs(x) for x in w.values())
    if gross > CAP_GROSS:
        w = {m: x * CAP_GROSS / gross for m, x in w.items()}
    return w


def changes(new: float, held: float) -> bool:
    """The 25% band: a weight changes only when the new one is more than 25% away from the
    one held. Entering, leaving and turning around always pass."""
    return abs(new - held) > BAND * abs(held)


def cost(symbol: str, units: float, price: float) -> float:
    """Dollars paid to change a position by `units`: the spread plus a slippage as large."""
    spread = school.MARKETS[symbol]["spread"]
    return school.usd(symbol, abs(units), (1 + SLIPPAGE) * spread, price)


def coin_signs(row: list[tuple[str, float]], rng: random.Random) -> list[tuple[str, float]]:
    """The placebo's Friday: the same absolute weights, each sign from a fair coin."""
    return [(m, abs(w) if rng.random() < 0.5 else -abs(w)) for m, w in row]


# --- the portfolio ------------------------------------------------------------------------


@dataclass(frozen=True)
class Book:
    """What the simulation needs, worked out once from the closes."""

    days: list[str]  # the calendar: every weekday on which some market has a candle
    markets: list[str]
    price: dict[str, list[float | None]]  # the last close known each day
    move: dict[str, list[float]]  # dollars gained that day by one unit held
    plan: dict[int, list[tuple[str, float]]]  # each Friday: the target weights
    ready: dict[int, int]  # each Friday: N
    start: int  # the first Friday with N >= 1


def build(series: dict[str, list[tuple[str, float]]], exclude: frozenset = frozenset()) -> Book:
    """The calendar, the daily moves and every Friday's target weights. The targets depend on
    prices alone, so they are the same for the real run and for the placebo."""
    markets = sorted(m for m in series if m not in exclude)
    days = sorted({d for m in markets for d, _ in series[m]})
    at = {d: i for i, d in enumerate(days)}
    price: dict[str, list[float | None]] = {}
    move: dict[str, list[float]] = {}
    for m in markets:
        move[m] = [0.0] * len(days)
        own: list[float | None] = [None] * len(days)
        prev = None
        for d, c in series[m]:
            own[at[d]] = c
            if prev is not None:
                move[m][at[d]] = school.usd(m, 1.0, c - prev, c)
            prev = c
        last = None
        for i, c in enumerate(own):
            last = c if c is not None else last
            own[i] = last
        price[m] = own
    dates = {m: [d for d, _ in series[m]] for m in markets}
    closes = {m: [c for _, c in series[m]] for m in markets}
    index = {m: {d: k for k, d in enumerate(dates[m])} for m in markets}
    plan, ready = {}, {}
    for i, d in enumerate(days):
        if weekday(d) != FRIDAY:
            continue
        n = sum(bisect_right(dates[m], d) >= HISTORY for m in markets)
        if not n:
            continue
        sv = {}
        for m in markets:
            k = index[m].get(d)
            if k is not None and k + 1 >= HISTORY:
                sv[m] = (signal(closes[m], k), vol60(closes[m], k))
        plan[i] = sorted(weights(sv, n).items())
        ready[i] = n
    return Book(days, markets, price, move, plan, ready, min(plan))


def simulate(book: Book, rng: random.Random | None = None, capital: float = CAPITAL) -> dict:
    """Day by day: each position gains its market's move to the day's close; on Fridays the
    weights are traded to their targets at that close, past the band, and the costs paid.
    With `rng`, the placebo: the same absolute weights with a coin for each sign."""
    units = dict.fromkeys(book.markets, 0.0)
    gains = dict.fromkeys(book.markets, 0.0)
    paid = dict.fromkeys(book.markets, 0.0)
    equity, spent_total, trades, flips, turnover = capital, 0.0, 0, 0, 0.0
    curve, spent_curve, exposure = [], [], []
    for i in range(len(book.days)):
        for m, q in units.items():
            if q:
                g = q * book.move[m][i]
                gains[m] += g
                equity += g
        row = book.plan.get(i)
        if row is not None:
            if rng is not None:
                row = coin_signs(row, rng)
            spent = 0.0
            for m, w in row:
                one = school.notional(m, 1.0, book.price[m][i])  # dollars per unit
                if changes(w, units[m] * one / equity):
                    new = w * equity / one
                    c = cost(m, new - units[m], book.price[m][i])
                    paid[m] += c
                    spent += c
                    trades += 1
                    flips += new * units[m] < 0
                    turnover += abs(new - units[m]) * one / equity
                    units[m] = new
            equity -= spent
            spent_total += spent
            exposure.append(
                sum(abs(school.notional(m, q, book.price[m][i])) for m, q in units.items() if q)
                / equity
            )
        curve.append(equity)
        spent_curve.append(spent_total)
    return {
        "curve": curve,
        "spent": spent_curve,
        "gains": gains,
        "paid": paid,
        "units": units,
        "trades": trades,
        "flips": flips,  # changes that turn a position around
        "turnover": turnover,  # dollars traded over equity, summed
        "exposure": fmean(exposure) if exposure else 0.0,
    }


# --- measuring -----------------------------------------------------------------------------


def daily(book: Book, curve: list[float], capital: float = CAPITAL) -> list[tuple[str, float]]:
    """The daily returns of a curve from the first Friday on (before it, it is flat)."""
    return [
        (book.days[i], curve[i] / (curve[i - 1] if i else capital) - 1)
        for i in range(book.start, len(curve))
    ]


def sharpe(rets: list[tuple[str, float]]) -> float:
    rs = [r for _, r in rets]
    sd = pstdev(rs)
    return fmean(rs) / sd * math.sqrt(DAYS_PER_YEAR) if sd else 0.0


def figures(rets: list[tuple[str, float]]) -> dict:
    """Total return, yearly return, yearly volatility and worst drawdown (fractions), Sharpe."""
    value, peak, worst = 1.0, 1.0, 0.0
    for _, r in rets:
        value *= 1 + r
        peak = max(peak, value)
        worst = max(worst, 1 - value / peak)
    rs = [r for _, r in rets]
    return {
        "from": rets[0][0],
        "to": rets[-1][0],
        "ret": value - 1,
        "yearly": value ** (DAYS_PER_YEAR / len(rs)) - 1,
        "vol": pstdev(rs) * math.sqrt(DAYS_PER_YEAR),
        "sharpe": sharpe(rets),
        "dd": worst,
    }


def calendar_years(rets: list[tuple[str, float]]) -> tuple[dict[str, float], list[str]]:
    """The return of each calendar year, and the years the period covers completely."""
    years: dict[str, float] = {}
    for day, r in rets:
        years[day[:4]] = (1 + years.get(day[:4], 0.0)) * (1 + r) - 1
    first, last = rets[0][0], rets[-1][0]
    complete = [y for y in years if first < f"{y}-01-01" and last > f"{y}-12-31"]
    return years, complete


def years_before(day: str, n: int) -> str:
    d = date.fromisoformat(day)
    return d.replace(year=d.year - n, day=min(d.day, 28) if d.month == 2 else d.day).isoformat()


def percentile(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))]


def criteria(
    sharpe_: float,
    years: dict[str, float],
    complete: list[str],
    placebo: list[float],
    without_best: float,
    last5: float,
) -> dict[str, bool]:
    """The four conditions; one missed is enough to fail."""
    positive = sum(years[y] > 0 for y in complete) / len(complete) if complete else 0.0
    verdict = {
        "1 rendimento": sharpe_ >= THRESHOLDS["sharpe"]
        and positive >= THRESHOLDS["positive_years"],
        "2 placebo": sharpe_ > percentile(placebo, THRESHOLDS["placebo"]),
        "3 senza il mercato migliore": without_best > 0,
        "4 ultimi 5 anni": last5 > 0,
    }
    verdict["passa"] = all(verdict.values())
    return verdict


def placebo(book: Book, sims: int = SIMS, seed: int = SEED) -> list[dict]:
    """The placebo's series: Sharpe after costs, Sharpe before costs, dollars of costs."""
    rng = random.Random(seed)
    out = []
    for _ in range(sims):
        run = simulate(book, rng)
        gross = [c + s for c, s in zip(run["curve"], run["spent"], strict=True)]
        out.append(
            {
                "sharpe": sharpe(daily(book, run["curve"])),
                "sharpe_lordo": sharpe(daily(book, gross)),
                "costi": run["spent"][-1],
            }
        )
    return out


# --- the exam ------------------------------------------------------------------------------


def pct(x: float, digits: int = 1) -> float:
    return round(100 * x, digits)


def main() -> None:
    made = download()
    candles, notes = load()
    series = {m: [(c.start[:10], c.close) for c in cs] for m, cs in candles.items()}
    book = build(series)
    run = simulate(book)
    rets = daily(book, run["curve"])
    whole = figures(rets)
    years, complete = calendar_years(rets)

    contribution = {m: run["gains"][m] - run["paid"][m] for m in book.markets}
    best = max(contribution, key=contribution.get)
    book_without = build(series, frozenset({best}))
    without = figures(daily(book_without, simulate(book_without)["curve"]))

    cutoff = years_before(book.days[-1], 5)
    last5 = figures([(d, r) for d, r in rets if d > cutoff])

    draws = placebo(book)
    sharpes = [p["sharpe"] for p in draws]
    gross_curve = [c + s for c, s in zip(run["curve"], run["spent"], strict=True)]
    gross_sharpe = sharpe(daily(book, gross_curve))
    gross_draws = [p["sharpe_lordo"] for p in draws]

    verdict = criteria(whole["sharpe"], years, complete, sharpes, without["ret"], last5["ret"])
    positive = [y for y in complete if years[y] > 0]

    def shown(f: dict) -> dict:
        return {
            "dal": f["from"],
            "al": f["to"],
            "rendimento %": pct(f["ret"]),
            "rendimento annuo %": pct(f["yearly"], 2),
            "volatilità annua %": pct(f["vol"], 2),
            "sharpe": round(f["sharpe"], 3),
            "calo massimo %": pct(f["dd"]),
        }

    enters = {}
    for i in sorted(book.plan):
        for m, _ in book.plan[i]:
            enters.setdefault(m, book.days[i])
    markets = {
        m: {
            "primo giorno": series[m][0][0],
            "ultimo giorno": series[m][-1][0],
            "giorni": len(series[m]),
            "in portafoglio dal": enters[m],
            "contributo $": round(contribution[m], 1),
            "contributo % del capitale": pct(contribution[m] / CAPITAL, 2),
            "costi $": round(run["paid"][m], 1),
        }
        for m in book.markets
    }
    result = {
        "esame": "E11, research/biblioteca.md (regole nel commit 9c3b2b3)",
        "richieste a Twelve Data in questa esecuzione": made,
        "capitale $": CAPITAL,
        "periodo": shown(whole),
        "operazioni": run["trades"],
        "inversioni di segno": run["flips"],
        "giro d'affari annuo, volte il capitale": round(
            run["turnover"] * DAYS_PER_YEAR / len(rets), 1
        ),
        "costi $": round(run["spent"][-1], 1),
        "esposizione lorda media": round(run["exposure"], 3),
        "anni solari %": {y: pct(r, 2) for y, r in years.items()},
        "anni completi": complete,
        "anni completi positivi": f"{len(positive)} su {len(complete)}",
        # The exam's own warning: a result that lives only before 2010.
        "fino al 2010": shown(figures([(d, r) for d, r in rets if d < "2011-01-01"])),
        "dal 2011": shown(figures([(d, r) for d, r in rets if d >= "2011-01-01"])),
        "mercati": markets,
        "mercato migliore": best,
        "senza il mercato migliore": shown(without),
        "ultimi 5 anni": shown(last5),
        "placebo": {
            "serie": SIMS,
            "sharpe vero": round(whole["sharpe"], 3),
            "sharpe del placebo: 5°, 50° e 95° percentile": [
                round(percentile(sharpes, q), 3) for q in (0.05, 0.5, 0.95)
            ],
            "batte il % delle serie": round(
                100 * sum(s < whole["sharpe"] for s in sharpes) / SIMS, 1
            ),
            "costi medi del placebo $": round(fmean(p["costi"] for p in draws), 1),
            "solo per informazione, prima dei costi": {
                "sharpe vero": round(gross_sharpe, 3),
                "95° percentile del placebo": round(percentile(gross_draws, 0.95), 3),
                "batte il % delle serie": round(
                    100 * sum(s < gross_sharpe for s in gross_draws) / SIMS, 1
                ),
            },
        },
        "criteri": verdict,
        "dati": notes,
        "igiene": hygiene(candles),
    }
    (OUT / "fx_trend.json").write_text(json.dumps(result, indent=1, ensure_ascii=False))

    print(f"E11 · trend lento su valute, oro e argento ({made} richieste a Twelve Data)")
    print(json.dumps(result["periodo"], ensure_ascii=False))
    print(f"operazioni {run['trades']} ({run['flips']} inversioni di segno), "
          f"costi {run['spent'][-1]:.1f} $ su {CAPITAL:,.0f} $, "
          f"esposizione lorda media {run['exposure']:.2f}x")  # fmt: skip
    print("anni solari %:", json.dumps(result["anni solari %"]))
    print(f"anni completi positivi: {result['anni completi positivi']}")
    print("fino al 2010:", json.dumps(result["fino al 2010"], ensure_ascii=False))
    print("dal 2011:", json.dumps(result["dal 2011"], ensure_ascii=False))
    print("mercati:")
    for m, row in markets.items():
        print(f"  {m:<8} dati dal {row['primo giorno']}  {row['giorni']} giorni  "
              f"in portafoglio dal {row['in portafoglio dal']}  "
              f"contributo {row['contributo $']:+8.1f} $  "
              f"costi {row['costi $']:6.1f} $")  # fmt: skip
    print(f"senza {best}:", json.dumps(result["senza il mercato migliore"], ensure_ascii=False))
    print("ultimi 5 anni:", json.dumps(result["ultimi 5 anni"], ensure_ascii=False))
    print("placebo:", json.dumps(result["placebo"], ensure_ascii=False))
    print("criteri:", json.dumps(verdict, ensure_ascii=False))


if __name__ == "__main__":
    main()
