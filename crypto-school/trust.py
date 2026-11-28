"""What makes the crypto class's results worth trusting: a sealed register of its decisions,
a traffic light for each wallet with criteria written in advance, and the checks of the
monthly auditor.

**The sealed register.** After each meeting the engine takes the decisions just made:
- the orders, and the engine's fills of them;
- every prediction with its probability;
- the capital of each wallet.

It writes them as one text and seals it with a SHA-256 fingerprint of the text joined to
the fingerprint of the meeting before. Changing anything in the past breaks every
fingerprint after it. The page recomputes the chain each time it opens, and the monthly
auditor sends the last fingerprint to the owner's phone.

**The traffic light**, for each of the eight wallets, from criteria written before any
result:
- *grey*: too early, under 180 days of data and under 100 closed trades;
- *red*: a drawdown over 20% from the peak, or a loss once the sample is complete;
- *green*: the sample is complete, it gains more than cash, the low end of its yearly
  return at 90% confidence is above zero, its drawdown is within 20%, and it earns more
  per unit of drawdown than holding BTC;
- *yellow*: anything else.

Green for 365 days in a row is the library's "veterano": only then may the owner consider
a small test with real money. That decision is his alone.
"""

from __future__ import annotations

import hashlib
import json
import math
from statistics import fmean, pstdev

START = "inizio"
MIN_DAYS, MIN_TRADES = 180, 100
MAX_DRAWDOWN_PCT = 20.0
READY_DAYS = 365
MIN_DRAWDOWN = 0.01  # the drawdown counted at least 1%, so a steady curve is not divided by zero
Z90 = 1.645


# --- the sealed register --------------------------------------------------------------------------


def canonical(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fingerprint(previous: str, text: str) -> str:
    return hashlib.sha256(f"{previous}|{text}".encode()).hexdigest()


def decisions(minutes: dict, moment: str = "mattina") -> dict:
    """What a meeting decided before knowing how it ends: the orders, the engine's fills,
    the predictions and the capitals."""
    keep = ("wallet", "event", "id", "symbol", "side", "units", "entry", "stop", "target", "exit", "pnl", "reason")
    if moment == "sera":
        part = minutes.get("sera") or {}
        positions, events, predictions, when = (
            part.get("posizioni") or {},
            part.get("eventi_ordini") or [],
            [],
            part.get("ora"),
        )
    else:
        positions, events, when = (
            minutes.get("posizioni") or {},
            minutes.get("eventi_ordini") or [],
            minutes.get("mercati_ora"),
        )
        speakers = [minutes.get("briefing") or {}, *positions.values(), minutes.get("scettico") or {}]
        fields = ("id", "mercato", "direzione", "livello", "scadenza", "probabilita")
        said = [p for s in speakers if isinstance(s, dict) for p in (s.get("previsioni") or [])]
        predictions = [{k: p.get(k) for k in fields} for p in said if isinstance(p, dict)]
    orders = {who: p.get("ordini") or [] for who, p in positions.items() if isinstance(p, dict) and "ordini" in p}
    fills = [{k: e.get(k) for k in keep if k in e} for e in events if isinstance(e, dict)]
    capitals = minutes.get("capitali") if moment == "mattina" else None
    return {
        "data": minutes.get("data"),
        "momento": moment,
        "ora": when,
        "ordini": orders,
        "esecuzioni": fills,
        "previsioni": predictions,
        "capitali": capitals,
    }


def seal(register: dict, minutes: dict, moment: str = "mattina") -> dict:
    """Seal a meeting's decisions at the end of the register's chain. Sealing the same
    meeting again replaces its seal only while it is the last one: the past stays as it is."""
    entries = register.setdefault("giorni", [])
    same = [i for i, e in enumerate(entries) if e["data"] == minutes.get("data") and e["momento"] == moment]
    if same and same[-1] != len(entries) - 1:
        raise ValueError(f"la riunione {minutes.get('data')} {moment} è già sigillata e non è l'ultima")
    if same:
        entries.pop()
    previous = entries[-1]["sigillo"] if entries else START
    text = canonical(decisions(minutes, moment))
    entry = {"data": minutes.get("data"), "momento": moment, "precedente": previous, "testo": text,
             "sigillo": fingerprint(previous, text)}  # fmt: skip
    entries.append(entry)
    return entry


def check(register: dict) -> dict:
    """Recompute every fingerprint of the chain."""
    previous, broken = START, None
    entries = register.get("giorni", [])
    for e in entries:
        if e.get("precedente") != previous or fingerprint(previous, e.get("testo", "")) != e.get("sigillo"):
            broken = f"{e.get('data')} {e.get('momento')}"
            break
        previous = e["sigillo"]
    return {"sigilli": len(entries), "integra": broken is None, "rotta_a": broken, "ultimo": previous}


# --- the traffic lights ----------------------------------------------------------------------------


def curve_stats(curve: dict[str, float]) -> dict:
    """Days, return, worst drawdown and the low end of the yearly return at 90% confidence,
    from a daily equity curve {day: value}."""
    values = [v for _, v in sorted(curve.items())]
    if len(values) < 2:
        return {"giorni": max(0, len(values) - 1), "rendimento_pct": 0.0, "calo_massimo_pct": 0.0,
                "annuo_basso90_pct": None, "rendimento_su_calo": None}  # fmt: skip
    rets = [b / a - 1 for a, b in zip(values, values[1:], strict=False) if a]
    peak, worst = values[0], 0.0
    for v in values:
        peak = max(peak, v)
        worst = max(worst, 1 - v / peak)
    total = values[-1] / values[0] - 1
    low = (fmean(rets) - Z90 * pstdev(rets) / math.sqrt(len(rets))) * 365 if len(rets) > 1 else None
    return {"giorni": len(rets), "rendimento_pct": round(total * 100, 2), "calo_massimo_pct": round(worst * 100, 2),
            "annuo_basso90_pct": round(low * 100, 2) if low is not None else None,
            "rendimento_su_calo": round(total / max(worst, MIN_DRAWDOWN), 2)}  # fmt: skip


def light(stats: dict, trades: int, btc: dict) -> tuple[str, list[str]]:
    """The colour of a wallet and the reasons, from the criteria written in advance."""
    if stats["calo_massimo_pct"] > MAX_DRAWDOWN_PCT:
        return "rosso", [f"calo massimo {stats['calo_massimo_pct']}%, oltre il {MAX_DRAWDOWN_PCT:g}%"]
    if stats["giorni"] < MIN_DAYS and trades < MIN_TRADES:
        return "grigio", [
            f"troppo presto: {stats['giorni']} giorni su {MIN_DAYS} e {trades} operazioni su {MIN_TRADES}"
        ]
    if stats["rendimento_pct"] <= 0:
        return "rosso", [f"perde il {abs(stats['rendimento_pct'])}% con il campione completo"]
    missing = []
    if stats["annuo_basso90_pct"] is None or stats["annuo_basso90_pct"] <= 0:
        missing.append("il guadagno non è ancora distinguibile dal caso (limite basso al 90% sotto zero)")
    mine, theirs = stats["rendimento_su_calo"], btc.get("rendimento_su_calo")
    if theirs is not None and (mine is None or mine <= theirs):
        missing.append("rende meno di BTC tenuto per unità di calo")
    return ("verde", ["tutti i criteri rispettati"]) if not missing else ("giallo", missing)


def difference_stats(judgment: dict[str, float], rules: dict[str, float]) -> dict:
    """Whether an agent's judgment adds to its rule: the daily change of the gap between its
    two wallets, with its 90% interval."""
    days = sorted(set(judgment) & set(rules))
    gap = [judgment[d] - rules[d] for d in days]
    steps = [b - a for a, b in zip(gap, gap[1:], strict=False)]
    if len(steps) < 2:
        return {"giorni": len(steps), "differenza": round(gap[-1], 2) if gap else 0.0, "verdetto": "non si sa ancora"}
    mean, half = fmean(steps), Z90 * pstdev(steps) / math.sqrt(len(steps))
    verdict = "aggiunge" if mean - half > 0 else "toglie" if mean + half < 0 else "non si sa ancora"
    return {"giorni": len(steps), "differenza": round(gap[-1], 2), "al_giorno": round(mean, 2),
            "intervallo90_al_giorno": [round(mean - half, 2), round(mean + half, 2)], "verdetto": verdict}  # fmt: skip


def lights(today: str, curves: dict[str, dict[str, float]], trades: dict[str, int], btc_curve: dict[str, float],
           before: dict | None = None) -> dict:  # fmt: skip
    """Every wallet's light, the benchmarks, and how long each has been green. `curves` and
    `trades` are keyed "<agent>_<regole|giudizio>"; `before` is yesterday's result."""
    btc = curve_stats(btc_curve)
    old = (before or {}).get("portafogli", {})
    out = {}
    for name, curve in sorted(curves.items()):
        stats = curve_stats(curve)
        colour, reasons = light(stats, trades.get(name, 0), btc)
        was = old.get(name, {})
        streak = was.get("giorni_verdi", 0)
        if colour == "verde" and was.get("data") != today:
            streak = streak + 1 if was.get("colore") == "verde" else 1
        elif colour != "verde":
            streak = 0
        out[name] = {"data": today, "colore": colour, "motivi": reasons, "operazioni": trades.get(name, 0), **stats,
                     "giorni_verdi": streak, "pronto_per_una_prova_reale": streak >= READY_DAYS}  # fmt: skip
    agents = sorted({n.rsplit("_", 1)[0] for n in curves})
    gaps = {a: difference_stats(curves.get(f"{a}_giudizio", {}), curves.get(f"{a}_regole", {})) for a in agents}
    criteria = {"giorni_minimi": MIN_DAYS, "operazioni_minime": MIN_TRADES, "calo_massimo_pct": MAX_DRAWDOWN_PCT,
                "giorni_verdi_per_una_prova_reale": READY_DAYS}  # fmt: skip
    cash = {"rendimento_pct": 0.0, "calo_massimo_pct": 0.0}
    return {"giorno": today, "portafogli": out, "giudizio_contro_regola": gaps,
            "benchmark": {"btc_tenuto": {**btc, "curva": dict(sorted(btc_curve.items()))}, "contanti": cash},
            "criteri": criteria}  # fmt: skip
