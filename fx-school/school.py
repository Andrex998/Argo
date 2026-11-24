"""Mini scuola forex: the school's books. Real prices, fake money.

The students propose, this script decides what happened. It reads hourly candles from
Twelve Data (the session's network proxy adds the key to each request), checks every
open position against each candle since it opened (stop, target, a gap through either),
and executes the students' orders after holding them to the school's rules. All money is
in US dollars.

Silver is traded through SLV, an ETF that holds silver, because the free data plan has
no XAG/USD. SLV trades only in New York hours, so an SLV order waits for the next session
and fills at the first hourly candle's open: never at an old price the student could
already see past.

Run from fx-school/ with plain Python 3 (no packages needed):

  python3 school.py new state.json                  a new school, both wallets at 10,000 $
  python3 school.py mark state.json                 prices now; close what the candles closed
  python3 school.py execute state.json orders.json  the students' orders, at those prices
  python3 school.py picture                         every market on daily candles, today
  python3 school.py history "EUR/USD" 500           daily candles, for homework

`mark` and `execute` write the new state back into state.json and print a report.
"""

from __future__ import annotations

import itertools
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

API = "https://api.twelvedata.com/time_series"
PER_MINUTE = 8  # the free plan's credits per minute: one per market asked
CAPITAL = 10_000.0
MAX_RISK_PCT = 2.0  # of equity, lost if the stop is hit
DEFAULT_RISK_PCT = 1.0
MAX_POSITIONS = 4  # per student
MAX_LEVERAGE = 10.0  # all positions' value together, in multiples of equity
PRICES_FRESH = timedelta(hours=3)  # orders need prices this recent
HOUR = timedelta(hours=1)

# Days a market does not trade although it is a weekday (the school's six weeks only).
HOLIDAYS = {
    "fx": {"2026-12-25", "2027-01-01"},
    "nyse": {"2026-11-26", "2026-12-25", "2027-01-01"},  # Thanksgiving, Christmas, New Year
}

# Spread paid on each trade (half on the way in, half on the way out), and the smallest
# stop the school accepts. Markets quoted in dollars ("quote") gain in dollars; for the
# dollar pairs ("base") a move is in yen, francs or Canadian dollars, turned into dollars.
MARKETS = {
    "EUR/USD": {"spread": 0.00010, "min_stop": 0.0010, "usd": "quote", "hours": "fx"},
    "GBP/USD": {"spread": 0.00012, "min_stop": 0.0010, "usd": "quote", "hours": "fx"},
    "AUD/USD": {"spread": 0.00012, "min_stop": 0.0010, "usd": "quote", "hours": "fx"},
    "NZD/USD": {"spread": 0.00015, "min_stop": 0.0010, "usd": "quote", "hours": "fx"},
    "USD/JPY": {"spread": 0.012, "min_stop": 0.10, "usd": "base", "hours": "fx"},
    "USD/CHF": {"spread": 0.00015, "min_stop": 0.0010, "usd": "base", "hours": "fx"},
    "USD/CAD": {"spread": 0.00015, "min_stop": 0.0010, "usd": "base", "hours": "fx"},
    "XAU/USD": {"spread": 0.40, "min_stop": 5.0, "usd": "quote", "hours": "fx"},
    "SLV": {"spread": 0.02, "min_stop": 0.30, "usd": "quote", "hours": "nyse"},
}


@dataclass(frozen=True)
class Candle:
    start: str  # "YYYY-MM-DD HH:MM:SS", UTC
    open: float
    high: float
    low: float
    close: float


class PriceError(Exception):
    """The prices could not be read: nothing is decided on a guess."""


def _at(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "")).replace(tzinfo=UTC)


def _text(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S")


# --- market hours ---------------------------------------------------------------------------


def market_open(symbol: str, now: datetime) -> bool:
    """Forex and gold: from Sunday 22:00 to Friday 22:00 UTC. SLV: New York, 14:30 to 21:00
    UTC on weekdays. Neither on its holidays."""
    day, minutes = now.weekday(), now.hour * 60 + now.minute
    if now.date().isoformat() in HOLIDAYS[MARKETS[symbol]["hours"]]:
        return False
    if MARKETS[symbol]["hours"] == "nyse":
        return day < 5 and 14 * 60 + 30 <= minutes < 21 * 60
    if day == 5:  # Saturday
        return False
    if day == 6:  # Sunday
        return minutes >= 22 * 60
    return not (day == 4 and minutes >= 22 * 60)  # Friday evening


# --- prices -------------------------------------------------------------------------------


def _get(params: dict, wait: float = 62.0) -> dict:
    url = f"{API}?{urllib.parse.urlencode(params, safe='/,')}"
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                body = json.load(response)
        except urllib.error.HTTPError as e:
            body = {"status": "error", "code": e.code, "message": e.read()[:300].decode("utf-8", "replace")}
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            raise PriceError(f"Twelve Data non risponde: {e}") from e
        if isinstance(body, dict) and body.get("code") == 429 and attempt == 1:
            time.sleep(wait)  # the minute's credits are used up: one more try after it
            continue
        if isinstance(body, dict) and body.get("status") == "error":
            raise PriceError(f"Twelve Data: {body.get('code')} {str(body.get('message'))[:160]}")
        return body
    raise PriceError("Twelve Data: troppe richieste anche dopo un minuto")


def _candles(series: dict) -> list[Candle]:
    if not isinstance(series, dict) or series.get("status") == "error" or "values" not in series:
        raise PriceError(f"serie non valida: {str(series)[:160]}")
    candles = []
    for v in series["values"]:
        start = v["datetime"] if len(v["datetime"]) > 10 else v["datetime"] + " 00:00:00"
        candles.append(Candle(start, float(v["open"]), float(v["high"]), float(v["low"]),
                              float(v["close"])))  # fmt: skip
    return sorted(candles, key=lambda c: c.start)


def fetch(symbols: list[str], interval: str = "1h", size: int = 48,
          pause: float = 62.0) -> dict[str, list[Candle]]:  # fmt: skip
    """The last `size` candles of each market, oldest first, in UTC. The free plan allows
    8 markets a minute, so a longer list is read in groups a minute apart."""
    out: dict[str, list[Candle]] = {}
    for i in range(0, len(symbols), PER_MINUTE):
        if i:
            time.sleep(pause)
        group = symbols[i : i + PER_MINUTE]
        params = {"symbol": ",".join(group), "interval": interval, "outputsize": size,
                  "timezone": "UTC"}  # fmt: skip
        body = _get(params)
        for symbol in group:
            out[symbol] = _candles(body if len(group) == 1 else body.get(symbol, {}))
    return out


# --- money ---------------------------------------------------------------------------------


def usd(symbol: str, units: float, move: float, price: float) -> float:
    """Dollars gained by `units` when the price moves by `move` to `price`."""
    return units * move if MARKETS[symbol]["usd"] == "quote" else units * move / price


def notional(symbol: str, units: float, price: float) -> float:
    """What a position is worth in dollars."""
    return units * price if MARKETS[symbol]["usd"] == "quote" else units


def fill(symbol: str, price: float, buying: bool) -> float:
    half = MARKETS[symbol]["spread"] / 2
    return price + half if buying else price - half


def new_state(start: str) -> dict:
    def wallet() -> dict:
        return {"cash": CAPITAL, "positions": [], "pending": [], "closed": [], "equity": [],
                "next_id": 1}  # fmt: skip

    return {"school": {"start": start, "capital": CAPITAL}, "prices": {}, "prices_at": "",
            "wallets": {"macro": wallet(), "tecnico": wallet()}}  # fmt: skip


def equity(wallet: dict, prices: dict[str, float]) -> float:
    open_pnl = 0.0
    for p in wallet["positions"]:
        price = prices.get(p["symbol"], p["entry"])
        exit_price = fill(p["symbol"], price, buying=p["side"] == "short")
        sign = 1 if p["side"] == "long" else -1
        open_pnl += usd(p["symbol"], p["units"], sign * (exit_price - p["entry"]), exit_price)
    return wallet["cash"] + open_pnl


# --- the picture of each market on daily candles ----------------------------------------------


def _digits(price: float) -> int:
    return 5 if price < 5 else 3 if price < 500 else 2


def picture(candles: dict[str, list[Candle]], today: str) -> dict:
    """Where each market stands on daily candles: its moves over 1, 5, 20, 60 and 250
    days in %, its average daily range (ATR 14), its 50 and 200 day averages, and the
    highs and lows it made. The last candle is still forming if it is today's."""
    out = {}
    for symbol, cs in candles.items():
        if len(cs) < 2:
            continue
        closes = [c.close for c in cs]
        last, d = closes[-1], _digits(closes[-1])
        ranges = [max(c.high, p.close) - min(c.low, p.close) for p, c in itertools.pairwise(cs)]
        atr = sum(ranges[-14:]) / len(ranges[-14:])
        row = {
            "ultima_candela": cs[-1].start[:10] + (" (in corso)" if cs[-1].start[:10] >= today else ""),
            "prezzo": round(last, d),
            "variazione_pct": {
                f"{n}g": round((last / closes[-1 - n] - 1) * 100, 2) if len(closes) > n else None
                for n in (1, 5, 20, 60, 250)
            },
            "atr14": round(atr, d),
            "atr14_pct": round(atr / last * 100, 2),
            "max_20g": round(max(c.high for c in cs[-20:]), d),
            "min_20g": round(min(c.low for c in cs[-20:]), d),
            "max_250g": round(max(c.high for c in cs[-250:]), d),
            "min_250g": round(min(c.low for c in cs[-250:]), d),
        }
        for n in (50, 200):
            average = sum(closes[-n:]) / n if len(closes) >= n else None
            row[f"media{n}"] = round(average, d) if average else None
            row[f"distanza_media{n}_pct"] = round((last / average - 1) * 100, 2) if average else None
        out[symbol] = row
    return out


# --- marking positions against new candles -------------------------------------------------


def _exit_on(p: dict, c: Candle) -> tuple[str, float] | None:
    """Where a candle closes the position, if it does. The stop counts first when one
    candle reaches both; a candle that opens past a level fills at its open."""
    long = p["side"] == "long"
    stop, target = p["stop"], p.get("target")
    if long:
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
    exit_price = fill(p["symbol"], price, buying=p["side"] == "short")
    sign = 1 if p["side"] == "long" else -1
    pnl = usd(p["symbol"], p["units"], sign * (exit_price - p["entry"]), exit_price)
    wallet["cash"] += pnl
    wallet["positions"].remove(p)
    trade = {**p, "exit": round(exit_price, 6), "closed": when, "exit_reason": reason,
             "pnl": round(pnl, 2), "r": round(pnl / p["risk_usd"], 2) if p["risk_usd"] else None}  # fmt: skip
    wallet["closed"].append(trade)
    return trade


def mark(state: dict, candles: dict[str, list[Candle]], now: datetime) -> list[dict]:
    """Fill the orders that waited for a market to open, then close every position a
    candle took to its stop or target. A position is checked from the first candle after
    the one it opened in; a complete candle is not looked at twice, and the candle still
    forming is looked at again next time."""
    events = []
    for name, wallet in state["wallets"].items():
        for order in list(wallet.get("pending", [])):
            first = next(
                (c for c in candles.get(order["symbol"], []) if _at(c.start) >= _at(order["placed"])),
                None,
            )
            if first:
                wallet["pending"].remove(order)
                prices = {**state.get("prices", {}), order["symbol"]: first.open}
                event = open_position(name, wallet, order["order"], prices, first.start,
                                      equity_prices=state.get("prices", {}))  # fmt: skip
                events.append({**event, "waited_from": order["placed"]})
        for p in list(wallet["positions"]):
            for c in candles.get(p["symbol"], []):
                start = _at(c.start)
                if start <= _at(p["checked"]):
                    continue
                hit = _exit_on(p, c)
                if hit:
                    trade = close_position(wallet, p, hit[1], c.start, hit[0])
                    events.append({"wallet": name, "event": "chiusa", **trade})
                    break
                if start + HOUR <= now:
                    p["checked"] = c.start
    return events


def snapshot(state: dict, prices: dict[str, float], day: str) -> dict:
    """Each wallet's equity at the latest prices, recorded once per day."""
    out = {}
    for name, wallet in state["wallets"].items():
        value = round(equity(wallet, prices), 2)
        wallet["equity"] = [e for e in wallet["equity"] if e["date"] != day] + [{"date": day, "value": value}]
        out[name] = value
    return out


# --- the students' orders ------------------------------------------------------------------


def _reject(name: str, order: dict, why: str) -> dict:
    return {"wallet": name, "event": "respinto", "order": order, "reason": why}


def open_position(name: str, wallet: dict, order: dict, prices: dict[str, float], when: str,
                  equity_prices: dict[str, float] | None = None) -> dict:  # fmt: skip
    symbol, side = order.get("symbol"), order.get("side")
    if symbol not in MARKETS:
        return _reject(name, order, f"mercato sconosciuto: {symbol}")
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
    if not 0 < risk_pct <= MAX_RISK_PCT:
        return _reject(name, order, f"rischio {risk_pct}% fuori dai limiti (0-{MAX_RISK_PCT}%)")
    entry = fill(symbol, prices[symbol], buying=side == "long")
    sign = 1 if side == "long" else -1
    distance = sign * (entry - stop)
    if distance <= 0:
        return _reject(name, order, "lo stop è dalla parte sbagliata del prezzo")
    if distance < MARKETS[symbol]["min_stop"]:
        return _reject(name, order, f"stop troppo vicino: minimo {MARKETS[symbol]['min_stop']}")
    if target is not None and sign * (target - entry) <= 0:
        return _reject(name, order, "il target è dalla parte sbagliata del prezzo")
    marks = {**(equity_prices or prices), symbol: prices[symbol]}
    value_now = equity(wallet, marks)
    risk_usd = value_now * risk_pct / 100
    per_unit = usd(symbol, 1.0, distance, stop)
    units = risk_usd / per_unit
    exposure = sum(notional(p["symbol"], p["units"], marks.get(p["symbol"], p["entry"])) for p in wallet["positions"])
    room = MAX_LEVERAGE * value_now - exposure
    if notional(symbol, units, entry) > room:
        if room <= 0:
            return _reject(name, order, f"leva oltre {MAX_LEVERAGE:g} volte il capitale")
        units *= room / notional(symbol, units, entry)
        risk_usd = units * per_unit
    position = {
        "id": f"{name}-{wallet['next_id']}", "symbol": symbol, "side": side,
        "units": round(units, 6), "entry": round(entry, 6), "stop": stop, "target": target,
        "risk_usd": round(risk_usd, 2), "opened": when, "checked": when,
        "reason": str(order.get("reason", ""))[:300],
    }  # fmt: skip
    wallet["next_id"] += 1
    wallet["positions"].append(position)
    return {"wallet": name, "event": "aperta", **position}


def execute(state: dict, orders: dict, now: datetime) -> list[dict]:
    """Carry out each student's orders at the prices `mark` read, closes first, in the
    order given. A market that is closed refuses them, except SLV, whose orders wait for
    New York to open."""
    events = []
    prices = state.get("prices", {})
    if not state.get("prices_at") or now - _at(state["prices_at"]) > PRICES_FRESH:
        return [{"event": "respinto", "reason": "prezzi vecchi: prima va lanciato mark"}]
    when = _text(now)
    for name, wallet in state["wallets"].items():
        mine = [o for o in orders.get(name, []) if isinstance(o, dict)]
        for order in sorted(mine, key=lambda o: o.get("action") != "close"):
            action, symbol = order.get("action"), order.get("symbol")
            if action == "close":
                p = next((p for p in wallet["positions"] if p["id"] == order.get("id")), None)
                if not p:
                    events.append(_reject(name, order, "posizione da chiudere non trovata"))
                elif not market_open(p["symbol"], now):
                    events.append(_reject(name, order, f"{p['symbol']}: mercato chiuso"))
                else:
                    reason = f"chiusa dall'allievo: {order.get('reason', '')}"[:300]
                    trade = close_position(wallet, p, prices[p["symbol"]], when, reason)
                    events.append({"wallet": name, "event": "chiusa", **trade})
            elif action == "open" and symbol in MARKETS and not market_open(symbol, now):
                if MARKETS[symbol]["hours"] == "nyse" and now.weekday() < 5:
                    wallet.setdefault("pending", []).append({"symbol": symbol, "placed": when, "order": order})
                    events.append({"wallet": name, "event": "in attesa", "order": order,
                                   "reason": "SLV apre a New York: si compra alla prima ora"})  # fmt: skip
                else:
                    events.append(_reject(name, order, f"{symbol}: mercato chiuso"))
            elif action == "open":
                events.append(open_position(name, wallet, order, prices, when))
            else:
                events.append(_reject(name, order, "azione sconosciuta: open o close"))
    return events


# --- command line --------------------------------------------------------------------------


def _load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _save(path: str, state: dict) -> None:
    Path(path).write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


def _hours_needed(state: dict, now: datetime) -> int:
    """Enough hourly candles to cover every position since it was last checked."""
    oldest = min(
        [_at(p["checked"]) for w in state["wallets"].values() for p in w["positions"]]
        + [_at(o["placed"]) for w in state["wallets"].values() for o in w.get("pending", [])]
        + [now - timedelta(hours=48)]
    )
    return min(5000, int((now - oldest) / HOUR) + 6)


def main(argv: list[str]) -> None:
    command = argv[1] if len(argv) > 1 else ""
    now = datetime.now(UTC)
    if command == "new":
        _save(argv[2], new_state(now.date().isoformat()))
        print(json.dumps({"created": argv[2], "start": now.date().isoformat()}))
    elif command == "mark":
        state = _load(argv[2])
        candles = fetch(list(MARKETS), "1h", _hours_needed(state, now))
        state["prices"] = {s: cs[-1].close for s, cs in candles.items() if cs}
        state["prices_at"] = _text(now)
        events = mark(state, candles, now)
        values = snapshot(state, state["prices"], now.date().isoformat())
        _save(argv[2], state)
        print(json.dumps({"now": _text(now), "events": events, "equity": values,
                          "prices": state["prices"]}, ensure_ascii=False, indent=1))  # fmt: skip
    elif command == "execute":
        state, orders = _load(argv[2]), _load(argv[3])
        events = execute(state, orders, now)
        values = snapshot(state, state.get("prices", {}), now.date().isoformat())
        _save(argv[2], state)
        print(json.dumps({"now": _text(now), "events": events, "equity": values},
                         ensure_ascii=False, indent=1))  # fmt: skip
    elif command == "picture":
        candles = fetch(list(MARKETS), "1day", 260)
        print(json.dumps(picture(candles, now.date().isoformat()), ensure_ascii=False, indent=1))
    elif command == "history":
        symbol, days = argv[2], int(argv[3]) if len(argv) > 3 else 500
        candles = fetch([symbol], "1day", min(days, 5000))[symbol]
        print(json.dumps([asdict(c) for c in candles]))
    else:
        print(__doc__)
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except PriceError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        raise SystemExit(1) from e
