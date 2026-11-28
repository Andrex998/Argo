"""The gym of the crypto class: anonymous cases from the past, to train the agents' judgment.

Every Sunday each wallet agent gets 20 cases drawn from the last three years of BingX's
daily candles: 10 of its own trade and 10 at random, as a control. A case shows only what
could be seen on its day: the last 30 daily candles and a few numbers. There is no coin and
no date, and prices are rescaled so the last close is 100, so the model cannot remember how
it went. The agent says whether the price will be higher or lower in 7 days, with a
probability, and gives a plan: long, short or nothing, with a stop and maybe a target.

Then the engine looks at the 7 days after and scores both:
- the probability, with Brier's score (0 is perfect, 0.25 is always saying 50%);
- the plan, in R: the result over the risk taken, costs included, funding left out.

The same cases are also played by a simplified version of the agent's written rule, so
judgment and rule meet on the same ground.

The cases are drawn from the session's date: the scorer finds them again from the same
data, and no file of answers sits on disk while the agents work.
"""

from __future__ import annotations

import itertools
import math
import random
from statistics import fmean, pstdev

from desk.indicators import atr, rsi
from desk.models import Candle

import judgment
import rules

HORIZON = 7  # days the prediction and the plan look ahead
SHOWN = 30  # daily candles shown in a case
PER_AGENT = 20  # cases a session, half of the agent's own trade
FIRST_DAY = "2023-10-01"  # the cases' days: three years before the school...
GAP_DAYS = 30  # ...up to a month before the session
WARMUP = 210  # candles a coin needs before a case
T1_LAGS = (7, 14, 28, 56, 112)
LETTER = {"falco": "F", "tartaruga": "T", "spazzino": "S", "ragioniere": "R"}
DAY_MS = rules.DAY_MS


def _pct(a: float, b: float) -> float | None:
    return round((a / b - 1) * 100, 2) if b else None


def _t1(closes: list[float], i: int) -> float | None:
    """The Tartaruga's signal: the average sign of the returns over 7 to 112 days."""
    if i < max(T1_LAGS):
        return None
    return fmean((closes[i] > closes[i - lag]) - (closes[i] < closes[i - lag]) for lag in T1_LAGS)


class Market:
    """The data of a session: daily candles and funding by coin, with what the cases need
    precomputed (the funding of the last 7 days, BTC's state, the breadth of the market)."""

    def __init__(self, daily: dict[str, list[Candle]], rates: dict[str, dict[int, float]]):
        self.daily = {s: daily[s] for s in sorted(daily)}
        self.days = {s: [rules.day_of(c.ts) for c in cs] for s, cs in self.daily.items()}
        self.closes = {s: [c.close for c in cs] for s, cs in self.daily.items()}
        self.index = {s: {d: i for i, d in enumerate(ds)} for s, ds in self.days.items()}
        self.f7: dict[tuple[str, str], float] = {}  # (pair, day) -> funding of the 7 days up to that day's close
        for s, r in rates.items():
            if not r or s not in self.daily:
                continue
            times = sorted(r)
            total = [0.0, *itertools.accumulate(r[t] for t in times)]
            first = times[0]
            for d in self.days[s]:
                end = rules.ms_of(d) + DAY_MS
                if end - 7 * DAY_MS < first:
                    continue
                lo = next_index(times, end - 7 * DAY_MS)
                hi = next_index(times, end)
                if hi > lo:
                    self.f7[(s, d)] = total[hi] - total[lo]
        self.f7_day: dict[str, list[float]] = {}  # day -> every coin's 7-day funding, sorted
        for (_, d), v in self.f7.items():
            self.f7_day.setdefault(d, []).append(v)
        for values in self.f7_day.values():
            values.sort()
        above: dict[str, list[bool]] = {}
        for s, closes in self.closes.items():
            for i in range(50, len(closes)):
                above.setdefault(self.days[s][i], []).append(closes[i] > fmean(closes[i - 49 : i + 1]))
        self.breadth = {d: round(100 * sum(v) / len(v), 1) for d, v in above.items() if len(v) >= 10}

    def btc(self, day: str) -> dict | None:
        i = self.index.get("BTC/USDT", {}).get(day)
        if i is None or i < 100:
            return None
        closes = self.closes["BTC/USDT"]
        rets = [b / a - 1 for a, b in itertools.pairwise(closes[i - 20 : i + 1])]
        return {"var_7g_pct": _pct(closes[i], closes[i - 7]), "var_30g_pct": _pct(closes[i], closes[i - 30]),
                "da_media50_pct": _pct(closes[i], fmean(closes[i - 49 : i + 1])),
                "da_media100_pct": _pct(closes[i], fmean(closes[i - 99 : i + 1])),
                "vol20_annua_pct": round(pstdev(rets) * math.sqrt(365) * 100, 1),
                "monete_sopra_media50_pct": self.breadth.get(day)}  # fmt: skip

    def f7_rank(self, pair: str, day: str) -> tuple[int, int] | None:
        """Where the coin's 7-day funding stands that day among the coins with funding:
        (position from the lowest, how many)."""
        mine = self.f7.get((pair, day))
        if mine is None:
            return None
        values = self.f7_day[day]
        return next_index(values, mine), len(values)


def next_index(times: list, t: float) -> int:
    """The first position in `times` (sorted) at or after t."""
    lo, hi = 0, len(times)
    while lo < hi:
        mid = (lo + hi) // 2
        if times[mid] < t:
            lo = mid + 1
        else:
            hi = mid
    return lo


# --- what a case shows ------------------------------------------------------------------------


def numbers(m: Market, pair: str, i: int) -> dict:
    """What could be seen at the close of day i, without prices or dates."""
    cs, closes = m.daily[pair], m.closes[pair]
    last = closes[i]
    rets = [b / a - 1 for a, b in itertools.pairwise(closes[i - 20 : i + 1])]
    before = cs[i - 20 : i]
    rank = m.f7_rank(pair, m.days[pair][i])
    f7 = m.f7.get((pair, m.days[pair][i]))
    volume = fmean(c.volume for c in before)
    btc = m.daily.get("BTC/USDT")
    beta = None
    if btc:
        mine = {m.days[pair][k]: closes[k] / closes[k - 1] - 1 for k in range(i - 59, i + 1)}
        base = {m.days["BTC/USDT"][k]: btc[k].close / btc[k - 1].close - 1 for k in range(1, len(btc))}
        common = [d for d in mine if d in base]
        if len(common) >= 30:
            x, y = [base[d] for d in common], [mine[d] for d in common]
            mx, my = fmean(x), fmean(y)
            vx = fmean((a - mx) ** 2 for a in x)
            beta = round(fmean((a - mx) * (b - my) for a, b in zip(x, y, strict=True)) / vx, 2) if vx else None
    return {
        "var_1g_pct": _pct(last, closes[i - 1]), "var_7g_pct": _pct(last, closes[i - 7]),
        "var_30g_pct": _pct(last, closes[i - 30]), "var_90g_pct": _pct(last, closes[i - 90]),
        "atr14_pct": round(atr(cs[i - 30 : i + 1], 14) / last * 100, 2),
        "vol20_annua_pct": round(pstdev(rets) * math.sqrt(365) * 100, 1),
        "da_media50_pct": _pct(last, fmean(closes[i - 49 : i + 1])),
        "da_media100_pct": _pct(last, fmean(closes[i - 99 : i + 1])),
        "da_media200_pct": _pct(last, fmean(closes[i - 199 : i + 1])),
        "rsi2": round(rsi(closes[i - 29 : i + 1], 2), 1), "rsi14": round(rsi(closes[i - 59 : i + 1], 14), 1),
        "da_max20_precedente_pct": _pct(last, max(c.high for c in before)),
        "da_min20_precedente_pct": _pct(last, min(c.low for c in before)),
        "volume_su_media20": round(cs[i].volume / volume, 2) if volume else None,
        "segnale_trend": _t1(closes, i),
        "funding_7g_pct": round(f7 * 100, 3) if f7 is not None else None,
        "funding_posizione": f"{rank[0] + 1}° più basso su {rank[1]}" if rank else None,
        "beta_btc": beta,
    }  # fmt: skip


def shown(m: Market, pair: str, i: int) -> list[list[float]]:
    """The last candles up to day i: prices with the last close at 100, volume against its
    average in the window."""
    cs = m.daily[pair][i - SHOWN + 1 : i + 1]
    k, v = 100 / cs[-1].close, fmean(c.volume for c in cs) or 1
    return [[round(c.open * k, 1), round(c.high * k, 1), round(c.low * k, 1), round(c.close * k, 1),
             round(c.volume / v, 1)] for c in cs]  # fmt: skip


# --- which cases ----------------------------------------------------------------------------------


def of_the_trade(agent: str, m: Market, pair: str, i: int) -> bool:
    """Whether day i of the coin is a case of the agent's own trade."""
    cs, closes, day = m.daily[pair], m.closes[pair], m.days[pair][i]
    if agent == "falco":  # a close past the 20 days before, on volume
        before = cs[i - 20 : i]
        volume = fmean(c.volume for c in before)
        past = closes[i] > max(c.high for c in before) or closes[i] < min(c.low for c in before)
        return past and volume > 0 and cs[i].volume > 1.5 * volume
    if agent == "spazzino":  # RSI(2) at an extreme
        r2 = rsi(closes[i - 29 : i + 1], 2)
        return r2 < 10 or r2 > 90
    if agent == "tartaruga":  # every horizon agrees, or the signal just turned
        now, before = _t1(closes, i), _t1(closes, i - 1)
        return now in (1.0, -1.0) or (now is not None and before is not None and (now > 0) != (before > 0))
    if agent == "ragioniere":  # funding among the three lowest or highest of the day
        rank = m.f7_rank(pair, day)
        return bool(rank) and rank[1] >= 10 and (rank[0] < 3 or rank[0] >= rank[1] - 3)
    raise ValueError(agent)


def draw(m: Market, session_day: str) -> dict[str, list[dict]]:
    """The session's cases for each agent, always the same for the same data and day."""
    cutoff = rules.day_of(rules.ms_of(session_day) - GAP_DAYS * DAY_MS)
    pool = [(s, i) for s in m.daily for i in range(WARMUP, len(m.daily[s]) - HORIZON)
            if FIRST_DAY <= m.days[s][i] <= cutoff]  # fmt: skip
    out = {}
    for agent, letter in LETTER.items():
        rng = random.Random(f"{session_day}-{agent}")
        own = [c for c in pool if of_the_trade(agent, m, *c)]
        picked = rng.sample(own, min(PER_AGENT // 2, len(own)))
        chosen = set(picked)
        rest = [c for c in pool if c not in chosen]
        picked_random = rng.sample(rest, PER_AGENT - len(picked))
        cases = [(c, "mestiere") for c in picked] + [(c, "a caso") for c in picked_random]
        rng.shuffle(cases)
        out[agent] = [{"caso": f"{letter}{n:02d}", "pair": s, "i": i, "giorno": m.days[s][i], "tipo": kind}
                      for n, ((s, i), kind) in enumerate(cases, 1)]  # fmt: skip
    return out


def public(m: Market, case: dict) -> dict:
    """A case as the agent sees it: no coin, no date, no price level."""
    pair, i = case["pair"], case["i"]
    return {"caso": case["caso"], "candele": shown(m, pair, i), "numeri": numbers(m, pair, i),
            "mercato": m.btc(m.days[pair][i])}  # fmt: skip


# --- playing a plan, and the simplified rules -------------------------------------------------------


def play(m: Market, pair: str, i: int, side: str, stop_pct: float, target_pct: float | None,
         days: int = HORIZON) -> dict:  # fmt: skip
    """A plan entered at day i's close and held for `days` days at most, on daily candles:
    a stop or target touched closes it (the stop first when one candle reaches both)."""
    cs, entry, sign = m.daily[pair], m.closes[pair][i], 1 if side == "long" else -1
    stop = entry * (1 - sign * stop_pct / 100)
    target = entry * (1 + sign * target_pct / 100) if target_pct else None
    p, exit_price, why = {"side": side, "stop": stop, "target": target}, None, "scadenza"
    for c in cs[i + 1 : i + 1 + days]:
        hit = judgment._exit_on(p, c)
        if hit:
            why, exit_price = hit
            break
    if exit_price is None:
        exit_price = cs[i + days].close
    risk = abs(entry - stop) + 2 * judgment.COST * entry
    gain = sign * (exit_price - entry) - judgment.COST * (entry + exit_price)
    return {"r": round(gain / risk, 2), "uscita": why}


def rule_plan(agent: str, m: Market, pair: str, i: int) -> dict | None:
    """What the agent's written rule would do on the case, simplified to daily candles and a
    7-day horizon: side, stop and target in %, days held. None: the rule stays out."""
    cs, closes = m.daily[pair], m.closes[pair]
    last, day = closes[i], m.days[pair][i]
    a = atr(cs[i - 30 : i + 1], 14) / last * 100
    btc = m.btc(day)
    if agent == "falco":
        before = cs[i - 20 : i]
        up, down = closes[i] > max(c.high for c in before), closes[i] < min(c.low for c in before)
        surge = cs[i].volume > 1.5 * fmean(c.volume for c in before)
        btc_up = btc is not None and btc["da_media50_pct"] > 0
        side = "long" if up and surge and btc_up else "short" if down and surge and not btc_up else None
        stop = min(12.0, max(1.0, 3 * a))
        return {"side": side, "stop_pct": stop, "target_pct": 3 * stop, "days": HORIZON} if side else None
    if agent == "tartaruga":
        signal = _t1(closes, i)
        if not signal or signal <= 0:
            return None
        sd = pstdev([b / a_ - 1 for a_, b in itertools.pairwise(closes[i - 20 : i + 1])]) * 100
        return {"side": "long", "stop_pct": min(25.0, max(1.0, 4 * sd)), "target_pct": None, "days": HORIZON}
    if agent == "spazzino":
        r2, sma100 = rsi(closes[i - 29 : i + 1], 2), fmean(closes[i - 99 : i + 1])
        btc_up = btc is not None and btc["da_media100_pct"] > 0
        side = ("long" if last > sma100 and btc_up and r2 < 10 else
                "short" if last < sma100 and not btc_up and r2 > 90 else None)  # fmt: skip
        return {"side": side, "stop_pct": min(25.0, max(1.0, 3 * a)), "target_pct": None, "days": 5} if side else None
    if agent == "ragioniere":
        rank = m.f7_rank(pair, day)
        if not rank or rank[1] < 10:
            return None
        side = "long" if rank[0] < 3 else "short" if rank[0] >= rank[1] - 3 else None
        return {"side": side, "stop_pct": 25.0, "target_pct": None, "days": HORIZON} if side else None
    raise ValueError(agent)


# --- scoring ----------------------------------------------------------------------------------------


def check_answer(a: dict) -> str | None:
    """Why an answer cannot be scored, or None when it can."""
    if a.get("direzione") not in ("su", "giu"):
        return "la direzione deve essere su o giu"
    try:
        prob = float(a["probabilita"])
    except (KeyError, TypeError, ValueError):
        return "probabilità mancante"
    if not 0.5 <= prob <= 0.99:
        return "la probabilità va da 0,5 a 0,99"
    if a.get("azione") not in ("long", "short", "niente"):
        return "l'azione deve essere long, short o niente"
    if a["azione"] != "niente":
        try:
            stop = float(a["stop_pct"])
            target = float(a["target_pct"]) if a.get("target_pct") not in (None, "") else None
        except (KeyError, TypeError, ValueError):
            return "stop o target non sono numeri"
        if not 1 <= stop <= 25:
            return "lo stop va dall'1% al 25%"
        if target is not None and target <= 0:
            return "il target deve essere sopra zero"
    return None


def score(agent: str, m: Market, cases: list[dict], answers: list[dict]) -> list[dict]:
    """Each case with its answer, what happened in the 7 days after, and the scores."""
    by_case = {str(a.get("caso")): a for a in answers if isinstance(a, dict)}
    out = []
    for case in cases:
        pair, i = case["pair"], case["i"]
        later = m.closes[pair][i + HORIZON]
        moved = _pct(later, m.closes[pair][i])
        row = {"caso": case["caso"], "moneta": pair.split("/")[0], "giorno": case["giorno"], "tipo": case["tipo"],
               "var_7g_dopo_pct": moved}  # fmt: skip
        plan = rule_plan(agent, m, pair, i)
        row["regola"] = {"azione": "niente", "r": 0.0, "uscita": None}
        if plan:
            played = play(m, pair, i, plan["side"], plan["stop_pct"], plan["target_pct"], plan["days"])
            row["regola"] = {"azione": plan["side"], **played}
        answer = by_case.get(case["caso"])
        why = check_answer(answer) if answer else "nessuna risposta"
        if why:
            out.append({**row, "valida": False, "motivo": why})
            continue
        prob, right = float(answer["probabilita"]), (answer["direzione"] == "su") == (later > m.closes[pair][i])
        played = {"r": 0.0, "uscita": None}
        if answer["azione"] != "niente":
            target = float(answer["target_pct"]) if answer.get("target_pct") not in (None, "") else None
            played = play(m, pair, i, answer["azione"], float(answer["stop_pct"]), target)
        out.append({**row, "valida": True, "direzione": answer["direzione"], "probabilita": prob,
                    "giusta": right, "brier": round((prob - right) ** 2, 4), "azione": answer["azione"],
                    "stop_pct": answer.get("stop_pct"), "target_pct": answer.get("target_pct"),
                    "perche": str(answer.get("perche", ""))[:200], **played})  # fmt: skip
    return out


def _block(rows: list[dict]) -> dict:
    valid = [r for r in rows if r["valida"]]
    trades = [r for r in valid if r["azione"] != "niente"]
    rule = [r["regola"] for r in rows if r["regola"]["azione"] != "niente"]
    return {"n": len(rows), "valide": len(valid),
            "brier": round(fmean(r["brier"] for r in valid), 4) if valid else None,
            "giuste_pct": round(100 * fmean(r["giusta"] for r in valid), 1) if valid else None,
            "operazioni": len(trades), "r_medio": round(fmean(r["r"] for r in trades), 2) if trades else None,
            "r_totale": round(sum(r["r"] for r in trades), 2),
            "operazioni_regola": len(rule), "r_totale_regola": round(sum(r["r"] for r in rule), 2)}  # fmt: skip


def summary(rows: list[dict]) -> dict:
    """A session's numbers for one agent: all cases, its trade's and the random ones."""
    valid = [r for r in rows if r["valida"]]
    preds = [{"probabilita": r["probabilita"], "esito": int(r["giusta"]), "brier": r["brier"], "stato": "verificata"}
             for r in valid]  # fmt: skip
    best = max(valid, key=lambda r: r["r"], default=None)
    worst = min(valid, key=lambda r: r["r"], default=None)
    return {**_block(rows), "mestiere": _block([r for r in rows if r["tipo"] == "mestiere"]),
            "a_caso": _block([r for r in rows if r["tipo"] == "a caso"]),
            "calibrazione": judgment.calibration(preds),
            "migliore": best["caso"] if best else None, "peggiore": worst["caso"] if worst else None}  # fmt: skip


def into_notebook(notebook: dict, day: str, rows: list[dict]) -> dict:
    """Add a session to the agent's notebook: its numbers, its cases in short, and the
    calibration over every case it has played in the gym."""
    gym = notebook.setdefault("palestra", {})
    s = summary(rows)
    sessions = [x for x in gym.get("sessioni", []) if x.get("data") != day]
    sessions.append({"data": day, **{k: v for k, v in s.items() if k != "calibrazione"}})
    cases = [x for x in gym.get("casi", []) if x.get("data") != day]
    cases += [{"data": day, "caso": r["caso"], "tipo": r["tipo"], "probabilita": r["probabilita"],
               "esito": int(r["giusta"]), "brier": r["brier"], "r": r["r"], "r_regola": r["regola"]["r"]}
              for r in rows if r["valida"]]  # fmt: skip
    gym["sessioni"], gym["casi"] = sessions[-30:], cases[-600:]
    preds = [{**x, "stato": "verificata"} for x in gym["casi"]]
    gym["calibrazione"] = judgment.calibration(preds)
    return s
