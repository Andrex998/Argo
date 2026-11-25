"""The judgment wallets of the crypto class, and the scoring of everyone's predictions.

Each wallet agent (Falco, Tartaruga, Spazzino, Ragioniere) has a second wallet of 10,000
USDT of fake money. There it trades with its own judgment, once a day at the morning
meeting. Its rules wallet (rules.py) trades the same market by code, so the gap between the
two measures whether the agent's judgment adds or takes away.

The engine holds every order to the same limits:
- **Stop.** Every position has one, between 1% and 25% from the price. The target is
  optional.
- **Risk.** At most 2% of the wallet is lost at the stop, costs included; 1% is the default.
  The Guardiano's written rule halves the most to 1% on BTC's panic days and in the FRAGILE
  state. The Preside can lower an agent's most at the monthly scrutiny.
- **Size.** At most 4 positions, one per coin. All of them together are worth at most 3
  times the wallet.
- **Costs.** 0.055% fee and 0.1% slippage a side; funding paid or earned at each settlement.

Prices are BingX's. Orders fill at the last price when they are executed. Every position is
checked against each hourly candle after the one it opened in: a stop or target touched
closes it, at the level or at the candle's open when the price jumped past it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import fmean

from desk.models import Candle

from data import COINS

CAPITAL = 10_000.0
COST = 0.00055 + 0.001  # fee and slippage, a side: the same as the rules wallets
MAX_RISK_PCT = 2.0
CAUTIOUS_RISK_PCT = 1.0  # the most on panic days and in the FRAGILE state
DEFAULT_RISK_PCT = 1.0
MAX_POSITIONS = 4
MAX_LEVERAGE = 3.0
STOP_RANGE_PCT = (1.0, 25.0)
AGENTS = ("falco", "tartaruga", "spazzino", "ragioniere")


def text(ms: float) -> str:
    return datetime.fromtimestamp(ms / 1000, UTC).strftime("%Y-%m-%d %H:%M:%S")


def ms(moment: str) -> int:
    return int(datetime.fromisoformat(moment).replace(tzinfo=UTC).timestamp() * 1000)


def new_state(start: str) -> dict:
    def wallet() -> dict:
        return {"cash": CAPITAL, "positions": [], "closed": [], "equity": [], "next_id": 1,
                "max_risk_pct": MAX_RISK_PCT, "funding": 0.0, "costs": 0.0}  # fmt: skip

    return {"school": {"start": start, "capital": CAPITAL}, "prices": {}, "prices_at": "",
            "market": {}, "wallets": {a: wallet() for a in AGENTS}}  # fmt: skip


def _sign(p: dict) -> int:
    return 1 if p["side"] == "long" else -1


def equity(wallet: dict, prices: dict[str, float]) -> float:
    """Cash plus what the open positions gain or lose at these prices."""
    return wallet["cash"] + sum(
        _sign(p) * p["units"] * (prices.get(p["symbol"], p["entry"]) - p["entry"]) for p in wallet["positions"]
    )


# --- closing positions on the hourly candles ---------------------------------------------------


def _exit_on(p: dict, c: Candle) -> tuple[str, float] | None:
    """Where a candle closes the position, if it does. The stop counts first when one
    candle reaches both; a candle that opens past a level fills at its open."""
    stop, target = p["stop"], p.get("target")
    if p["side"] == "long":
        if c.open <= stop:
            return "stop (apertura oltre lo stop)", c.open
        if c.low <= stop:
            return "stop", stop
        if target and c.open >= target:
            return "target (apertura oltre il target)", c.open
        if target and c.high >= target:
            return "target", target
    else:
        if c.open >= stop:
            return "stop (apertura oltre lo stop)", c.open
        if c.high >= stop:
            return "stop", stop
        if target and c.open <= target:
            return "target (apertura oltre il target)", c.open
        if target and c.low <= target:
            return "target", target
    return None


def close_position(wallet: dict, p: dict, price: float, when: str, reason: str) -> dict:
    move = _sign(p) * p["units"] * (price - p["entry"])
    cost = p["units"] * price * COST
    wallet["cash"] += move - cost
    wallet["costs"] += cost
    wallet["positions"].remove(p)
    costs = p["entry_cost"] + cost
    pnl = move - costs - p["funding"]
    trade = {**p, "exit": price, "closed": when, "exit_reason": reason[:300],
             "price_pnl": round(move, 2), "costs": round(costs, 2), "funding": round(p["funding"], 2),
             "pnl": round(pnl, 2), "r": round(pnl / p["risk_usd"], 2) if p["risk_usd"] else None}  # fmt: skip
    trade["entry_cost"] = round(p["entry_cost"], 2)
    wallet["closed"].append(trade)
    return trade


def mark(state: dict, candles: dict[str, list[Candle]], rates: dict[str, dict[int, float]]) -> list[dict]:
    """Charge the funding settled since each position was last looked at, and close every
    position an hourly candle took to its stop or target. A position is checked from the
    first candle after the one it opened in; only complete candles are given, and none is
    looked at twice. Funding is paid at the price the settlement's candle opened at."""
    events = []
    for name, wallet in state["wallets"].items():
        for p in list(wallet["positions"]):
            for c in candles.get(p["symbol"], []):
                if c.ts <= ms(p["checked"]):
                    continue
                rate = rates.get(p["symbol"], {}).get(c.ts)
                if rate is not None and c.ts > ms(p["funded"]):
                    paid = _sign(p) * p["units"] * c.open * rate
                    wallet["cash"] -= paid
                    wallet["funding"] += paid
                    p["funding"] += paid
                    p["funded"] = text(c.ts)
                hit = _exit_on(p, c)
                if hit:
                    trade = close_position(wallet, p, hit[1], text(c.ts), hit[0])
                    events.append({"wallet": name, "event": "chiusa", **trade})
                    break
                p["checked"] = text(c.ts)
    return events


def snapshot(state: dict, day: str) -> dict[str, float]:
    """Each wallet's equity at the latest prices, recorded once per day."""
    out = {}
    for name, wallet in state["wallets"].items():
        value = round(equity(wallet, state.get("prices", {})), 2)
        wallet["equity"] = [e for e in wallet["equity"] if e["date"] != day] + [{"date": day, "value": value}]
        out[name] = value
    return out


# --- the agents' orders -----------------------------------------------------------------------


def _reject(name: str, order: dict, why: str) -> dict:
    return {"wallet": name, "event": "respinto", "order": order, "reason": why}


def risk_limit(state: dict, wallet: dict, day: str) -> tuple[float, str]:
    """The most a new position may risk, in % of the wallet, and why it is lower than 2%."""
    top, why = min(MAX_RISK_PCT, float(wallet.get("max_risk_pct", MAX_RISK_PCT))), ""
    if top < MAX_RISK_PCT:
        why = " (limite deciso dal Preside allo scrutinio)"
    market = state.get("market", {})
    if market.get("day") == day and (market.get("panic") or market.get("fragile")) and top > CAUTIOUS_RISK_PCT:
        top = CAUTIOUS_RISK_PCT
        why = " (regola del Guardiano: " + ("giorno di panico di BTC" if market.get("panic") else "stato FRAGILE") + ")"
    return top, why


def open_position(state: dict, name: str, wallet: dict, order: dict, prices: dict[str, float],
                  when: str) -> dict:  # fmt: skip
    symbol, side = str(order.get("symbol", "")).upper(), order.get("side")
    if symbol not in COINS:
        return _reject(name, order, f"moneta sconosciuta: {symbol}")
    if side not in ("long", "short"):
        return _reject(name, order, "il lato deve essere long o short")
    if symbol not in prices:
        return _reject(name, order, f"prezzo di {symbol} non disponibile")
    if any(p["symbol"] == symbol for p in wallet["positions"]):
        return _reject(name, order, f"già una posizione aperta su {symbol}")
    if len(wallet["positions"]) >= MAX_POSITIONS:
        return _reject(name, order, f"già {MAX_POSITIONS} posizioni aperte, il massimo")
    try:
        stop = float(order["stop"])
        target = float(order["target"]) if order.get("target") not in (None, "") else None
        risk_pct = float(order.get("risk_pct", DEFAULT_RISK_PCT))
    except (KeyError, TypeError, ValueError):
        return _reject(name, order, "stop, target o rischio non sono numeri")
    top, why = risk_limit(state, wallet, when[:10])
    if not 0 < risk_pct <= top:
        return _reject(name, order, f"rischio {risk_pct}% fuori dai limiti (0-{top:g}%){why}")
    entry, sign = prices[symbol], 1 if side == "long" else -1
    distance = sign * (entry - stop)
    if distance <= 0:
        return _reject(name, order, "lo stop è dalla parte sbagliata del prezzo")
    lo, hi = STOP_RANGE_PCT
    if not lo <= distance / entry * 100 <= hi:
        where = f"stop a {distance / entry * 100:.2f}% dal prezzo"
        return _reject(name, order, f"{where}: deve stare tra {lo:g}% e {hi:g}%")
    if target is not None and sign * (target - entry) <= 0:
        return _reject(name, order, "il target è dalla parte sbagliata del prezzo")
    value = equity(wallet, prices)
    risk_usd = value * risk_pct / 100
    per_unit = distance + 2 * COST * entry  # the loss at the stop, costs in and out included
    units = risk_usd / per_unit
    exposure = sum(p["units"] * prices.get(p["symbol"], p["entry"]) for p in wallet["positions"])
    room = (MAX_LEVERAGE * value - exposure) / (1 + MAX_LEVERAGE * COST)  # the entry's cost lowers the wallet
    if units * entry > room:
        if room < value * 0.05:
            return _reject(name, order, f"posizioni già a {MAX_LEVERAGE:g} volte il capitale, il massimo")
        units = room / entry
        risk_usd = units * per_unit
    cost = units * entry * COST
    wallet["cash"] -= cost
    wallet["costs"] += cost
    position = {"id": f"{name}-{wallet['next_id']}", "symbol": symbol, "side": side, "units": units,
                "entry": entry, "stop": stop, "target": target, "risk_usd": round(risk_usd, 2),
                "risk_pct": round(risk_usd / value * 100, 3), "entry_cost": cost, "funding": 0.0,
                "opened": when, "checked": when, "funded": when,
                "reason": str(order.get("reason", ""))[:300]}  # fmt: skip
    wallet["next_id"] += 1
    wallet["positions"].append(position)
    return {"wallet": name, "event": "aperta", **position}


def execute(state: dict, orders: dict, prices: dict[str, float], now: datetime) -> list[dict]:
    """Carry out each agent's orders at these prices: closes first, then opens, in the order
    given."""
    events, when = [], now.strftime("%Y-%m-%d %H:%M:%S")
    for name, wallet in state["wallets"].items():
        mine = [o for o in orders.get(name, []) if isinstance(o, dict)]
        for order in sorted(mine, key=lambda o: o.get("action") != "close"):
            action = order.get("action")
            if action == "close":
                p = next((p for p in wallet["positions"] if p["id"] == order.get("id")), None)
                if not p:
                    events.append(_reject(name, order, "posizione da chiudere non trovata"))
                elif p["symbol"] not in prices:
                    events.append(_reject(name, order, f"prezzo di {p['symbol']} non disponibile"))
                else:
                    reason = f"chiusa dall'agente: {order.get('reason', '')}"
                    trade = close_position(wallet, p, prices[p["symbol"]], when, reason)
                    events.append({"wallet": name, "event": "chiusa", **trade})
            elif action == "open":
                events.append(open_position(state, name, wallet, order, prices, when))
            else:
                events.append(_reject(name, order, "azione sconosciuta: open o close"))
    return events


def set_limit(state: dict, name: str, pct: float) -> None:
    """The Preside's decision at the monthly scrutiny: the most an agent may risk."""
    if name not in state["wallets"] or not 0.25 <= pct <= MAX_RISK_PCT:
        raise ValueError(f"agente o limite non valido: {name} {pct}")
    state["wallets"][name]["max_risk_pct"] = pct


# --- everyone's predictions, checked against the daily closes -------------------------------------

BUCKETS = ((0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.0))


def check_prediction(p: dict) -> str | None:
    """Why a prediction cannot be scored, or None when it can."""
    if str(p.get("mercato", "")).upper() not in COINS:
        return f"moneta sconosciuta: {p.get('mercato')}"
    if p.get("direzione") not in ("sopra", "sotto"):
        return "la direzione deve essere sopra o sotto"
    try:
        float(p["livello"])
        prob = float(p["probabilita"])
        deadline = datetime.fromisoformat(str(p["scadenza"])).date().isoformat()
    except (KeyError, TypeError, ValueError):
        return "livello, probabilità o scadenza non validi"
    if not 0.5 <= prob <= 0.99:
        return "la probabilità va da 0,5 a 0,99: si scommette sul lato più probabile"
    if p.get("fatta") and deadline <= str(p["fatta"]):
        return "la scadenza deve venire dopo il giorno della previsione"
    return None


def verify(predictions: list[dict], closes: dict[str, dict[str, float]], today: str) -> list[dict]:
    """Score every open prediction whose deadline has passed: the coin's daily close (UTC)
    of the deadline against the level. The score is Brier's: (probability - outcome)^2, 0 at
    best, 0.25 for always saying 50%. Returns the predictions scored now."""
    scored = []
    for p in predictions:
        if p.get("stato", "aperta") != "aperta":
            continue
        why = check_prediction(p)
        if why:
            p.update(stato="non valida", motivo=why)
            continue
        deadline = str(p["scadenza"])[:10]
        if deadline >= today:  # the deadline's daily candle is not complete yet
            continue
        close = closes.get(str(p["mercato"]).upper(), {}).get(deadline)
        if close is None:
            continue
        level, prob = float(p["livello"]), float(p["probabilita"])
        hit = close > level if p["direzione"] == "sopra" else close < level
        p.update(stato="verificata", chiusura=close, giorno_chiusura=deadline, esito=int(hit),
                 brier=round((prob - hit) ** 2, 4))  # fmt: skip
        scored.append(p)
    return scored


def calibration(predictions: list[dict]) -> dict:
    """How sure an agent said it was, against how often it was right, overall and by band
    of probability. Overconfidence is the first minus the second."""
    scored = [p for p in predictions if p.get("stato") == "verificata"]
    if not scored:
        return {"n": 0, "brier": None, "sicurezza_media": None, "successi": None,
                "eccesso_di_sicurezza": None, "fasce": []}  # fmt: skip
    bands = []
    for lo, hi in BUCKETS:
        inside = [
            p for p in scored if lo <= float(p["probabilita"]) < hi or (hi == 1.0 and float(p["probabilita"]) >= lo)
        ]  # noqa: E501
        if inside:
            bands.append({"da": lo, "a": hi, "n": len(inside),
                          "detta": round(fmean(float(p["probabilita"]) for p in inside), 3),
                          "avverata": round(fmean(p["esito"] for p in inside), 3)})  # fmt: skip
    sure, right = fmean(float(p["probabilita"]) for p in scored), fmean(p["esito"] for p in scored)
    return {"n": len(scored), "brier": round(fmean(p["brier"] for p in scored), 4),
            "sicurezza_media": round(sure, 3), "successi": round(right, 3),
            "eccesso_di_sicurezza": round(sure - right, 3), "fasce": bands}  # fmt: skip
