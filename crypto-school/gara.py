"""The night contest of the crypto class: a test the owner asked for on the night of 26/11/2026.

Each of the four wallet agents opens one trade with 10x leverage on a coin whose chart, to
its eye, may bounce (or fall, if it reads it the other way). It chooses its own margin, stop,
target and closing hour. Everything closes at 15:00 Italian time on 26/11 at the latest.
The most profit wins, and the prize is twice that profit. Whoever loses is credited back,
because the money is fake.

The contest has its own wallets of 10,000 USDT. The school's official wallets are not
touched, so their results, the sealed register and the traffic lights stay clean.

The engine's rules:
- **Size.** Leverage is fixed at 10: the position is worth 10 times its margin, and the
  margin goes from 1% to 100% of the wallet.
- **Liquidation.** A move of 9.5% against the position liquidates it, and the whole margin
  is lost. A stop, if there is one, must sit before that price.
- **Costs.** 0.055% fee and 0.1% slippage a side, on the position's value. Funding is paid
  or earned at each settlement.
- **Checks.** Every hourly candle after the opening is checked, in this order: the jump at
  its open, then liquidation, stop and target, and the closing hour the agent chose.
  At 15:00 Italian time (14:00 UTC) whatever is still open closes at the price of that
  moment.
"""

from __future__ import annotations

from desk.models import Candle

from data import COINS
from judgment import COST, ms, text

CAPITAL = 10_000.0
LEVERAGE = 10
LIQUIDATION = 0.095  # the move against the position that takes the whole margin
DEADLINE = "2026-11-26 14:00:00"  # UTC: 15:00 in Italy
AGENTS = ("falco", "tartaruga", "spazzino", "ragioniere")
HOUR_MS = 3_600_000


def new_state() -> dict:
    return {"scadenza_utc": DEADLINE, "leva": LEVERAGE,
            "wallets": {a: {"cash": CAPITAL, "positions": [], "closed": []} for a in AGENTS}}  # fmt: skip


def _reject(name: str, order: dict, why: str) -> dict:
    return {"wallet": name, "event": "respinto", "order": order, "reason": why}


def open_trade(state: dict, name: str, order: dict, prices: dict[str, float], when: str) -> dict:
    wallet = state["wallets"][name]
    symbol, side = str(order.get("symbol", "")).upper(), order.get("side")
    if wallet["positions"] or wallet["closed"]:
        return _reject(name, order, "nella gara c'è una sola operazione per agente")
    if symbol not in COINS or symbol not in prices:
        return _reject(name, order, f"moneta sconosciuta o senza prezzo: {symbol}")
    if side not in ("long", "short"):
        return _reject(name, order, "il lato deve essere long o short")
    try:
        pct = float(order["margine_pct"])
        stop = float(order["stop"]) if order.get("stop") not in (None, "") else None
        target = float(order["target"]) if order.get("target") not in (None, "") else None
    except (KeyError, TypeError, ValueError):
        return _reject(name, order, "margine, stop o target non sono numeri")
    if not 1 <= pct <= 100:
        return _reject(name, order, "il margine va dall'1% al 100% del portafoglio")
    entry, sign = prices[symbol], 1 if side == "long" else -1
    liq = entry * (1 - sign * LIQUIDATION)
    if stop is not None and not (sign * (entry - stop) > 0 and sign * (stop - liq) > 0):
        return _reject(name, order, f"lo stop deve stare tra il prezzo e la liquidazione ({liq:.6g})")
    if target is not None and sign * (target - entry) <= 0:
        return _reject(name, order, "il target è dalla parte sbagliata del prezzo")
    close_at = str(order.get("chiudi_alle_utc") or "")[:19] or None
    if close_at and not when < close_at <= DEADLINE:
        return _reject(name, order, f"l'ora di chiusura deve stare tra adesso e {DEADLINE} UTC")
    margin = wallet["cash"] * pct / 100
    units = margin * LEVERAGE / entry
    cost = units * entry * COST
    wallet["cash"] -= cost
    position = {"id": f"gara-{name}", "symbol": symbol, "side": side, "units": units, "entry": entry,
                "margin": round(margin, 2), "stop": stop, "target": target, "liquidazione": liq,
                "chiudi_alle_utc": close_at, "opened": when, "checked": when, "funded": when, "funding": 0.0,
                "entry_cost": cost, "reason": str(order.get("reason", ""))[:300]}  # fmt: skip
    wallet["positions"].append(position)
    return {"wallet": name, "event": "aperta", **position}


def close_trade(wallet: dict, p: dict, price: float, when: str, reason: str) -> dict:
    sign = 1 if p["side"] == "long" else -1
    move = sign * p["units"] * (price - p["entry"])
    if reason == "liquidazione":
        move = -p["margin"]  # the whole margin, and nothing more
    cost = p["units"] * price * COST
    wallet["cash"] += move - cost
    wallet["positions"].remove(p)
    pnl = move - p["entry_cost"] - cost - p["funding"]
    trade = {**p, "exit": price, "closed": when, "exit_reason": reason, "pnl": round(pnl, 2),
             "sul_margine_pct": round(pnl / p["margin"] * 100, 1)}  # fmt: skip
    wallet["closed"].append(trade)
    return trade


def _hit(p: dict, c: Candle) -> tuple[str, float] | None:
    long = p["side"] == "long"
    worse = (lambda a, b: a <= b) if long else (lambda a, b: a >= b)
    better = (lambda a, b: a >= b) if long else (lambda a, b: a <= b)
    low, high = (c.low, c.high) if long else (c.high, c.low)
    if worse(c.open, p["liquidazione"]):  # opened past the liquidation: the margin is gone
        return "liquidazione", p["liquidazione"]
    if p["stop"] is not None and worse(c.open, p["stop"]):
        return "stop", c.open
    if p["stop"] is not None and worse(low, p["stop"]):
        return "stop", p["stop"]
    if worse(low, p["liquidazione"]):
        return "liquidazione", p["liquidazione"]
    if p["target"] is not None and better(c.open, p["target"]):
        return "target", c.open
    if p["target"] is not None and better(high, p["target"]):
        return "target", p["target"]
    return None


def mark(state: dict, candles: dict[str, list[Candle]], rates: dict[str, dict[int, float]]) -> list[dict]:
    """Funding, liquidations, stops, targets, the chosen hours and the end of the contest, on
    every complete hourly candle after the opening."""
    events, deadline = [], ms(DEADLINE)
    for name, wallet in state["wallets"].items():
        for p in list(wallet["positions"]):
            sign = 1 if p["side"] == "long" else -1
            for c in candles.get(p["symbol"], []):
                if c.ts <= ms(p["checked"]) or c.ts >= deadline:
                    continue
                if p["chiudi_alle_utc"] and c.ts >= ms(p["chiudi_alle_utc"]):
                    events.append({"wallet": name, **close_trade(wallet, p, c.open, text(c.ts), "all'ora scelta")})
                    break
                rate = rates.get(p["symbol"], {}).get(c.ts)
                if rate is not None and c.ts > ms(p["funded"]):
                    paid = sign * p["units"] * c.open * rate
                    wallet["cash"] -= paid
                    p["funding"] += paid
                    p["funded"] = text(c.ts)
                hit = _hit(p, c)
                if hit:
                    events.append({"wallet": name, **close_trade(wallet, p, hit[1], text(c.ts), hit[0])})
                    break
                p["checked"] = text(c.ts)
                if c.ts + HOUR_MS >= deadline:
                    events.append({"wallet": name, **close_trade(wallet, p, c.close, DEADLINE, "fine della gara")})
                    break
    return events


def standings(state: dict, prices: dict[str, float], after_deadline: bool = False) -> dict:
    """Who is ahead: each wallet's result, closed and open. The contest is over at the
    deadline, or once every agent has traded and closed."""
    rows = {}
    for name, w in state["wallets"].items():
        open_pnl = 0.0
        for p in w["positions"]:
            sign = 1 if p["side"] == "long" else -1
            open_pnl += sign * p["units"] * (prices.get(p["symbol"], p["entry"]) - p["entry"])
        value = w["cash"] + open_pnl
        rows[name] = {
            "capitale": round(value, 2),
            "risultato": round(value - CAPITAL, 2),
            "aperta": bool(w["positions"]),
        }
    done = all(w["closed"] and not w["positions"] for w in state["wallets"].values())
    over = after_deadline or done
    best = max(rows, key=lambda n: rows[n]["risultato"])
    winner = best if over and rows[best]["risultato"] > 0 else None
    return {"finita": over, "classifica": dict(sorted(rows.items(), key=lambda kv: -kv[1]["risultato"])),
            "vincitore": winner, "premio": round(2 * rows[best]["risultato"], 2) if winner else 0.0}  # fmt: skip
