"""What the class looks at each morning, computed by code: every coin on its daily candles
(the picture) and the Guardiano's numbers on risk. The agents read these numbers; they never
make them up.

The Guardiano's written states, from the library's exams E03 and E06:
- **PANICO.** Yesterday BTC closed under its 50-day average with its 20-day volatility in the
  top fifth of the last year (E03, V2).
- **CALDO.** The median over the coins of the funding of the last 7 days above the formula's
  base of 0.01% every 8 hours.
- **FRAGILE.** CALDO above its 90th percentile of the previous 180 days, with BTC's open
  interest, counted in BTC, up more than 15% in 14 days. It ends when CALDO falls under its
  70th percentile. BingX keeps no history of the open interest, so the school records it
  every morning; until it has 14 days, FRAGILE cannot be measured.
- **CASCATA.** The open interest of all the coins down 15% in a day, with BTC down 8%.

On a panic day and in the FRAGILE state the most a new position of a judgment wallet may
risk is 1% instead of 2% (judgment.risk_limit).
"""

from __future__ import annotations

import bisect
import itertools
import math
from statistics import fmean, median, pstdev

from desk.indicators import atr, rsi
from desk.models import Candle

import judgment
import rules

DAY_MS = rules.DAY_MS
BASE_FUNDING = 0.0001  # the formula's base, every 8 hours


def _pct(a: float, b: float) -> float | None:
    return round((a / b - 1) * 100, 2) if b else None


def _quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * (len(ordered) - 1) + 0.5))]


def _share(items: list, test) -> float | None:
    """The % of the items that pass the test."""
    return round(100 * sum(1 for x in items if test(x)) / len(items), 1) if items else None


def _daily_returns(candles: list[Candle]) -> dict[str, float]:
    return {rules.day_of(b.ts): b.close / a.close - 1 for a, b in itertools.pairwise(candles)}


def _beta(rets: dict[str, float], btc: dict[str, float], days: int = 60) -> tuple[float | None, float | None]:
    """The coin's beta and correlation to BTC on the last 60 daily returns."""
    common = sorted(set(rets) & set(btc))[-days:]
    if len(common) < 30:
        return None, None
    x, y = [btc[d] for d in common], [rets[d] for d in common]
    mx, my = fmean(x), fmean(y)
    cov = fmean((a - mx) * (b - my) for a, b in zip(x, y, strict=True))
    vx, vy = fmean((a - mx) ** 2 for a in x), fmean((b - my) ** 2 for b in y)
    return (cov / vx if vx else None), (cov / math.sqrt(vx * vy) if vx and vy else None)


def heat(rates: dict[str, dict[int, float]], days: list[str]) -> dict[str, float]:
    """CALDO for each day: the median over the coins of F7 / 21 - 0.01%, F7 being the funding
    settled in the 7 days up to that day's close. A coin counts once it has 7 days of funding."""
    series = []
    for r in rates.values():
        if r:
            times = sorted(r)
            series.append((times, [0.0, *itertools.accumulate(r[t] for t in times)]))
    out = {}
    for day in days:
        end = rules.ms_of(day) + DAY_MS
        start = end - 7 * DAY_MS
        excess = []
        for times, total in series:
            if times[0] > start:
                continue
            i, j = bisect.bisect_left(times, start), bisect.bisect_left(times, end)
            excess.append((total[j] - total[i]) / 21 - BASE_FUNDING)
        if len(excess) >= 10:
            out[day] = median(excess)
    return out


def _snapshot_before(oi: dict[str, dict], day: str, days: int) -> dict | None:
    """The open interest recorded `days` days before `day`, or up to two days earlier."""
    target = rules.ms_of(day) - days * DAY_MS
    for back in range(3):
        snap = oi.get(rules.day_of(target - back * DAY_MS))
        if snap:
            return snap
    return None


def picture(daily: dict[str, list[Candle]], rates: dict[str, dict[int, float]], oi: dict[str, dict],
            prices: dict[str, float], today: str, before: dict | None = None) -> dict:  # fmt: skip
    """Every coin on its daily candles (the last one complete, yesterday's in UTC) and the
    market's state. `oi` is the school's record of the open interest by day; `before` is the
    market's state of the last run, for FRAGILE's end."""
    btc = daily["BTC/USDT"]
    last_day = rules.day_of(btc[-1].ts)
    end = rules.ms_of(last_day) + DAY_MS
    btc_rets = _daily_returns(btc)
    oi_now, oi_1d, oi_7d = oi.get(today) or {}, _snapshot_before(oi, today, 1), _snapshot_before(oi, today, 7)
    coins = {}
    for s, cs in sorted(daily.items()):
        cs = [c for c in cs if c.ts < end]
        if len(cs) < 61:
            continue
        coin, closes = s.split("/")[0], [c.close for c in cs]
        last, rets = closes[-1], [b / a - 1 for a, b in itertools.pairwise(closes)]
        beta, corr = _beta(_daily_returns(cs), btc_rets)
        paid = sorted((t, r) for t, r in rates.get(s, {}).items() if t < end)
        f7 = sum(r for t, r in paid if t >= end - 7 * DAY_MS)
        coins[coin] = {
            "chiusura": last, "prezzo": prices.get(coin),
            "var_pct": {f"{n}g": _pct(last, closes[-1 - n]) for n in (1, 7, 30, 90, 365) if len(closes) > n},
            "atr14_pct": round(atr(cs[-40:], 14) / last * 100, 2),
            "vol20_annua_pct": round(pstdev(rets[-20:]) * math.sqrt(365) * 100, 1),
            "da_media50_pct": _pct(last, fmean(closes[-50:])),
            "da_media200_pct": _pct(last, fmean(closes[-200:])) if len(closes) >= 200 else None,
            "rsi2": round(rsi(closes[-30:], 2), 1), "rsi14": round(rsi(closes[-60:], 14), 1),
            "da_max20_pct": _pct(last, max(c.high for c in cs[-20:])),
            "da_min20_pct": _pct(last, min(c.low for c in cs[-20:])),
            "funding_ultimo_pct": round(paid[-1][1] * 100, 4) if paid else None,
            "funding_7g_pct": round(f7 * 100, 3), "funding_annuo_pct": round(f7 * 365 / 7 * 100, 1),
            "volume30_mln": round(fmean(c.close * c.volume for c in cs[-30:]) / 1e6, 1),
            "beta_btc": round(beta, 2) if beta is not None else None,
            "corr_btc": round(corr, 2) if corr is not None else None,
            "oi_mln": round(oi_now[coin] / 1e6, 1) if oi_now.get(coin) else None,
            "oi_var_1g_pct": _pct(oi_now[coin], oi_1d[coin]) if oi_now.get(coin) and (oi_1d or {}).get(coin) else None,
            "oi_var_7g_pct": _pct(oi_now[coin], oi_7d[coin]) if oi_now.get(coin) and (oi_7d or {}).get(coin) else None,
        }  # fmt: skip
    for rank, coin in enumerate(sorted(coins, key=lambda c: -coins[c]["volume30_mln"]), 1):
        coins[coin]["rango_volume"] = rank
    return {"giorno": last_day, "oggi": today, "mercato": _market(btc, coins, rates, oi, today, last_day, before),
            "monete": coins}  # fmt: skip


def _market(btc: list[Candle], coins: dict, rates: dict, oi: dict, today: str, last_day: str,
            before: dict | None) -> dict:  # fmt: skip
    closes = [c.close for c in btc if rules.day_of(c.ts) <= last_day]
    rets = [b / a - 1 for a, b in itertools.pairwise(closes)]
    vols = [pstdev(rets[i - 20 : i]) for i in range(20, len(rets) + 1)]
    days = [rules.day_of(rules.ms_of(last_day) - k * DAY_MS) for k in range(190, -1, -1)]
    history = heat(rates, days)
    hot = history.get(last_day)
    past = [v for d, v in sorted(history.items()) if d < last_day][-180:]
    cold = 0
    for day in reversed(days):
        if history.get(day) is None or history[day] >= 0:
            break
        cold += 1
    oi_now, oi_1d, oi_14d = oi.get(today) or {}, _snapshot_before(oi, today, 1), _snapshot_before(oi, today, 14)

    def in_btc(snap: dict | None) -> float | None:
        return snap["BTC"] / snap["_btc"] if snap and snap.get("BTC") and snap.get("_btc") else None

    doi14 = in_btc(oi_now) / in_btc(oi_14d) - 1 if in_btc(oi_now) and in_btc(oi_14d) else None
    fragile = None
    if hot is not None and len(past) >= 90 and doi14 is not None:
        if (before or {}).get("fragile"):
            fragile = hot >= _quantile(past, 0.7)
        else:
            fragile = hot > _quantile(past, 0.9) and doi14 > 0.15
    cascade = None
    if oi_now and oi_1d and oi_now.get("_btc") and oi_1d.get("_btc"):
        both = [c for c in oi_now if c != "_btc" and oi_1d.get(c)]
        total = sum(oi_now[c] for c in both) / sum(oi_1d[c] for c in both) - 1 if both else 0.0
        cascade = total <= -0.15 and oi_now["_btc"] / oi_1d["_btc"] - 1 <= -0.08
    above = [c for c in coins.values() if c["da_media50_pct"] is not None]
    month = [c["var_pct"]["30g"] for c in coins.values() if c["var_pct"].get("30g") is not None]
    return {
        "btc": {"chiusura": closes[-1], "da_media50_pct": _pct(closes[-1], fmean(closes[-50:])),
                "da_media100_pct": _pct(closes[-1], fmean(closes[-100:])),
                "da_media200_pct": _pct(closes[-1], fmean(closes[-200:])) if len(closes) >= 200 else None,
                "vol20_annua_pct": round(vols[-1] * math.sqrt(365) * 100, 1),
                "vol20_percentile_anno": round(100 * sum(v <= vols[-1] for v in vols[-365:]) / len(vols[-365:]), 1)},
        "panico": last_day in rules.panic_days(btc),
        "caldo_pct": round(hot * 100, 4) if hot is not None else None,
        "caldo_percentile_180g": _share(past, lambda v: v <= hot) if hot is not None else None,
        "freddo_giorni": cold,
        "oi_btc_14g_pct": round(doi14 * 100, 2) if doi14 is not None else None,
        "fragile": fragile, "cascata": cascade,
        "sopra_media50_pct": _share(above, lambda c: c["da_media50_pct"] > 0),
        "dispersione_30g_pct": round(pstdev(month), 2) if len(month) > 2 else None,
        "giorni_di_open_interest": len(oi),
    }  # fmt: skip


# --- the Guardiano's numbers ------------------------------------------------------------------


def _ewma_vol(values: list[float], half_life: float = 10) -> float | None:
    """The annual volatility of a daily equity series, weighting recent days more."""
    rets = [b / a - 1 for a, b in itertools.pairwise(values) if a]
    if len(rets) < 20:
        return None
    lam, var = 0.5 ** (1 / half_life), rets[0] ** 2
    for r in rets[1:]:
        var = lam * var + (1 - lam) * r * r
    return round(math.sqrt(var * 365) * 100, 1)


def wallet_risk(value: float, curve: list[float], positions: list[dict], prices: dict[str, float],
                betas: dict[str, float | None]) -> dict:  # fmt: skip
    """Exposure and risk of one wallet. Each position: symbol, side, qty and, when it has one,
    stop. The risk at the stop is what all the stops on one side would lose from here."""
    peak = max([judgment.CAPITAL, *curve, value])
    gross = net = net_beta = 0.0
    at_stop = {"long": 0.0, "short": 0.0}
    for p in positions:
        price = prices.get(p["symbol"])
        if price is None:
            continue
        sign, worth = (1 if p["side"] == "long" else -1), p["qty"] * price
        gross += worth
        net += sign * worth
        net_beta += sign * worth * (betas.get(p["symbol"]) or 1.0)
        if p.get("stop"):
            at_stop[p["side"]] += p["qty"] * max(0.0, sign * (price - p["stop"])) + worth * judgment.COST
    return {"capitale": round(value, 2), "massimo": round(peak, 2), "calo_pct": round((value / peak - 1) * 100, 2),
            "posizioni": len(positions), "lorda_pct": round(gross / value * 100, 1),
            "netta_pct": round(net / value * 100, 1), "netta_beta_pct": round(net_beta / value * 100, 1),
            "rischio_long_pct": round(at_stop["long"] / value * 100, 2),
            "rischio_short_pct": round(at_stop["short"] / value * 100, 2),
            "vol_annua_pct": _ewma_vol([*curve, value])}  # fmt: skip


def risk(state: dict, results: dict[str, dict], pic: dict) -> dict:
    """The Guardiano's numbers: every wallet's risk, the school's fund as a whole, the
    comparison of each agent's two wallets, and the alarms its written rules raise."""
    coins = pic["monete"]
    prices = {c: v["prezzo"] or v["chiusura"] for c, v in coins.items()} | state.get("prices", {})
    betas = {c: v["beta_btc"] for c, v in coins.items()}
    wallets = {}
    for name in judgment.AGENTS:
        w = state["wallets"][name]
        positions = [{"symbol": p["symbol"], "side": p["side"], "qty": p["units"], "stop": p["stop"]}
                     for p in w["positions"]]  # fmt: skip
        past = [e["value"] for e in w["equity"] if e["date"] < pic["oggi"]]
        wallets[f"{name}_giudizio"] = wallet_risk(judgment.equity(w, prices), past, positions, prices, betas)
        r = results.get(name) or {}
        curve = [v for _, v in sorted((r.get("curve") or {}).items())]
        positions = [{"symbol": o["symbol"], "side": o["side"], "qty": o["qty"], "stop": o.get("stop")}
                     for o in r.get("open", [])]  # fmt: skip
        wallets[f"{name}_regole"] = wallet_risk(curve[-1] if curve else judgment.CAPITAL, curve[:-1], positions,
                                                prices, betas)  # fmt: skip
    total = sum(w["capitale"] for w in wallets.values())
    fund = {"capitale": round(total, 2), "iniziale": judgment.CAPITAL * len(wallets),
            "netta_beta_pct": round(sum(w["netta_beta_pct"] * w["capitale"] for w in wallets.values()) / total, 1),
            "lorda_pct": round(sum(w["lorda_pct"] * w["capitale"] for w in wallets.values()) / total, 1)}  # fmt: skip
    compare = {}
    for name in judgment.AGENTS:
        by_rules, by_judgment = wallets[f"{name}_regole"]["capitale"], wallets[f"{name}_giudizio"]["capitale"]
        compare[name] = {"regole": by_rules, "giudizio": by_judgment, "differenza": round(by_judgment - by_rules, 2)}
    m, alarms, notes = pic["mercato"], [], []
    if m["panico"]:
        alarms.append("PANICO: ieri BTC ha chiuso sotto la media a 50 giorni con la volatilità nel quinto più alto "
                      "dell'anno. Oggi le nuove posizioni a giudizio rischiano al massimo l'1%.")  # fmt: skip
    if m["fragile"]:
        alarms.append(f"FRAGILE: funding in eccesso al {m['caldo_percentile_180g']}° percentile e open interest "
                      f"di BTC {m['oi_btc_14g_pct']:+}% in 14 giorni. Oggi le nuove posizioni a giudizio rischiano "
                      "al massimo l'1%.")  # fmt: skip
    elif m["fragile"] is None:
        missing = []
        if m["oi_btc_14g_pct"] is None:
            missing.append(f"14 giorni di open interest registrati dalla scuola (ne ha {m['giorni_di_open_interest']})")
        if m["caldo_percentile_180g"] is None:
            missing.append("90 giorni di storia del funding")
        notes.append(f"FRAGILE non misurabile: servono {' e '.join(missing) or 'dati completi'}.")
    if m["cascata"]:
        alarms.append("CASCATA: open interest di tutte le monete -15% in un giorno con BTC -8%.")
    if m["caldo_percentile_180g"] is not None and m["caldo_percentile_180g"] <= 10:
        notes.append(f"FREDDO: il funding in eccesso è al {m['caldo_percentile_180g']}° percentile dei 180 giorni: "
                     "chi è short paga poco o incassa, e gli short affollati rischiano uno squeeze.")  # fmt: skip
    for name, w in wallets.items():
        if w["calo_pct"] <= -15:
            alarms.append(f"CALO: {name} è a {w['calo_pct']}% dal suo massimo.")
        if name.endswith("_giudizio") and w["lorda_pct"] > 250:
            alarms.append(f"LEVA: {name} ha posizioni per il {w['lorda_pct']}% del capitale (il massimo è 300%).")
        side_risk = max(w["rischio_long_pct"], w["rischio_short_pct"])
        if side_risk > 3:
            alarms.append(f"CORRELATO: {name} rischia {side_risk}% del capitale su un lato solo (tetto E05: 3%).")
    top = judgment.CAUTIOUS_RISK_PCT if (m["panico"] or m["fragile"]) else judgment.MAX_RISK_PCT
    return {"giorno": pic["oggi"], "portafogli": wallets, "fondo": fund, "confronto": compare,
            "allarmi": alarms, "note": notes, "rischio_massimo_oggi": top}  # fmt: skip
