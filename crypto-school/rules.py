"""The rules wallets of the crypto class: each wallet agent's strategy, run by code.

Every day each wallet is replayed from the class's start to now on BingX data: the same
candles give the same trades, so nothing is stored between days and nothing can drift.
Each starts with 10,000 USDT of fake money. Costs: 0.055% fee and 0.1% slippage a side;
funding paid or earned at every settlement.

- Falco: the perpetuals desk's breakout (research/perps.replay), long and short, stops up
  to 12%, 1% risk times the volatility target with the panic halving (exam E03, V2, which
  passed). Rule C on the open interest is left out: BingX keeps no history of it.
- Tartaruga: the slow trend, the sign of 7-112 day returns, long only (research/trend.py).
  It failed exam E02, so it trains at a quarter of the standard risk (5% volatility).
- Spazzino: RSI(2) in the trend's direction (the rules of exam E10), daily, on BTC, ETH and
  the 10 coins with the most volume. Its own idea, buying forced selling (E09), needs the
  open interest's history, which the school starts recording today.
- Ragioniere: carry on funding (the rules of exam E08), every Monday, dollar-neutral.
"""

from __future__ import annotations

import math
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from statistics import fmean, median, pstdev

sys.path.insert(0, str(Path(__file__).parent.parent / "trading-desk" / "research"))

import perps  # noqa: E402  research/perps.py
import trend  # noqa: E402  research/trend.py
from desk.indicators import atr, rsi  # noqa: E402
from desk.models import Candle  # noqa: E402

CAPITAL = 10_000.0
COST = 0.00055 + 0.001  # fee and slippage, a side
TARGET_VOL = 0.2011  # exam E03: the median EWMA volatility of the desk's equity in year 1
DAY_MS = 86_400_000


def day_of(ms: float) -> str:
    return datetime.fromtimestamp(ms / 1000, UTC).date().isoformat()


# --- Falco ---------------------------------------------------------------------------------


def panic_days(btc_daily: list[Candle]) -> set[str]:
    """Days BTC closed under its 50-day average with its 20-day volatility in the top 20%
    of the last 365 days (exam E03, V2)."""
    closes = [c.close for c in btc_daily]
    rets = [None] + [b / a - 1 for a, b in zip(closes, closes[1:], strict=False)]
    vol20: list[float | None] = [None] * len(closes)
    out = set()
    for i in range(len(closes)):
        if i >= 20:
            vol20[i] = pstdev(rets[i - 19 : i + 1])
        if i < 50 or vol20[i] is None:
            continue
        past = [v for v in vol20[max(0, i - 364) : i + 1] if v is not None]
        below = closes[i] < fmean(closes[i - 49 : i + 1])
        if below and len(past) >= 60 and vol20[i] >= sorted(past)[int(0.8 * (len(past) - 1))]:
            out.add(day_of(btc_daily[i].ts))
    return out


def vol_target(panic: set[str]):
    """New trades risk 1% x k: k = TARGET_VOL over the EWMA volatility (half-life 10 days)
    of the wallet's daily equity, between 0.25 and 1.5; halved again on panic days."""
    lam = 0.5 ** (1 / 10)
    state = {"seen": 0, "var": None, "last": None, "n": 0}

    def scale(close_s: float, marks: list[float]) -> float:
        while state["seen"] < len(marks):
            mark = marks[state["seen"]]
            if state["last"] is not None:
                r = mark / state["last"] - 1
                state["var"] = r * r if state["var"] is None else lam * state["var"] + (1 - lam) * r * r
                state["n"] += 1
            state["last"] = mark
            state["seen"] += 1
        vol = math.sqrt(state["var"] * 365) if state["var"] is not None and state["n"] >= 20 else None
        k = 1.0 if not vol else min(1.5, max(0.25, TARGET_VOL / vol))
        midnight = math.floor(close_s / 86400) * 86400
        if day_of((midnight - 1) * 1000) in panic:
            k *= 0.5
        return k

    return scale


def falco(k4h: dict[str, list[Candle]], rates: dict, btc_daily: list[Candle], start_ms: int,
          end_ms: int) -> dict:  # fmt: skip
    setup = perps.Setup(sides="both", cap_pos=0.33, cap_total=1.5, fee=0.00055,
                        rules={"max_stop_pct": 12.0, "risk_per_trade_pct": 1.0},
                        keep_trades=True, keep_curve=True)  # fmt: skip
    setup.risk_scale = vol_target(panic_days(btc_daily))
    r = perps.replay({"klines": k4h, "funding": rates}, setup, start_ms, end_ms)
    x = CAPITAL / 1000  # the replay keeps its books on 1,000
    return {
        "curve": {d: round(v * x, 2) for d, v in r["curve"]},
        "trades": [
            {
                "symbol": t["symbol"].split("/")[0],
                "side": "long" if t["side"] > 0 else "short",
                "entry_ts": t["entry_ts"],
                "exit_ts": t["exit_ts"],
                "pnl": round(t["pnl"] * x, 2),
                "r": round(t["r"], 2),
                "reason": t["reason"],
            }
            for t in r["trade_list"]
        ],  # fmt: skip
        "open": [
            {
                "symbol": p["symbol"].split("/")[0],
                "side": "long" if p["side"] > 0 else "short",
                "entry": p["entry"],
                "stop": p["stop"],
                "target": p["target"],
                "last": p["last"],
                "qty": round(p["qty"] * x, 6),
                "entry_ts": p["entry_ts"],
            }
            for p in r["open_list"]
        ],  # fmt: skip
        "exposure": r["exposure"],
    }


# --- Tartaruga -------------------------------------------------------------------------------


def bars(candles: list[Candle], rates: dict[int, float]) -> list[dict]:
    """research/trend.py's daily bars, from daily candles: funding at each settlement, priced
    at the day's open (close enough for a cost that is a few hundredths of a percent)."""
    by_day: dict[str, list] = {}
    for t, rate in rates.items():
        by_day.setdefault(day_of(t), []).append(((t % DAY_MS) // 3_600_000, rate))
    return [{"day": day_of(c.ts), "open": c.open, "high": c.high, "low": c.low, "close": c.close,
             "funding": [(h, c.open, rate) for h, rate in sorted(by_day.get(day_of(c.ts), []))]}
            for c in candles]  # fmt: skip


def tartaruga(daily: dict[str, list[Candle]], rates: dict, start_day: str) -> dict:
    coins = {}
    for s, candles in daily.items():
        b = bars(candles, rates.get(s, {}))
        coins[s] = {"bars": b, "sig": trend.signals(b)}
    r = trend.simulate(coins, "T1 solo long", start=start_day, target_vol=0.05, capital=CAPITAL)
    now = {s.split("/")[0]: round(c["sig"]["T1"][-1], 2) for s, c in coins.items()
           if c["sig"]["T1"] and c["sig"]["T1"][-1] is not None}  # fmt: skip
    ranked = sorted(now, key=lambda s: -now[s])
    held = [{"symbol": s.split("/")[0], "side": "long" if q > 0 else "short", "qty": round(abs(q), 6),
             "last": coins[s]["bars"][-1]["close"]} for s, q in r["units"].items()]  # fmt: skip
    return {"curve": {d: round(v, 2) for d, v in r["curve"].items()}, "trades": [], "open": held,
            "segnali": {"positivi": sum(v > 0 for v in now.values()), "monete": len(now),
                        "piu_forti": {s: now[s] for s in ranked[:5]}, "piu_deboli": {s: now[s] for s in ranked[-5:]}},
            "costi": round(r["costs"], 2), "funding": round(r["funding"], 2),
            "esposizione_media": round(r["gross"], 3)}  # fmt: skip


# --- a small daily book, for Spazzino and Ragioniere ----------------------------------------------


class Book:
    """Positions in coins on daily bars. Every price a position meets (an open where it
    trades, a stop, a close) is booked as it comes; funding at the day's settlements; costs
    on every change."""

    def __init__(self) -> None:
        self.equity = CAPITAL
        self.units: dict[str, float] = {}  # signed
        self.last: dict[str, float] = {}  # the price each position was last valued at
        self.entry: dict[str, dict] = {}
        self.trades: list[dict] = []
        self.parts = {"prezzo": 0.0, "funding": 0.0, "costi": 0.0}

    def value_at(self, s: str, price: float) -> None:
        q = self.units.get(s, 0.0)
        if q:
            move = q * (price - self.last[s])
            self.equity += move
            self.parts["prezzo"] += move
        self.last[s] = price

    def trade_to(self, s: str, units: float, price: float, day: str, why: str = "") -> None:
        have = self.units.get(s, 0.0)
        if units == have:
            return
        self.value_at(s, price)
        cost = abs(units - have) * price * COST
        self.equity -= cost
        self.parts["costi"] -= cost
        flipped = have and (not units or math.copysign(1, units) != math.copysign(1, have))
        if flipped:
            e = self.entry.pop(s)
            self.trades.append({"symbol": s.split("/")[0], "side": "long" if have > 0 else "short",
                                "entry_day": e["day"], "exit_day": day, "entry": e["price"], "exit": price,
                                "pnl": round(have * (price - e["price"]), 2), "reason": why})  # fmt: skip
        if units and (not have or flipped):
            self.entry[s] = {"day": day, "price": price}
        if units:
            self.units[s] = units
        else:
            self.units.pop(s, None)
            self.last.pop(s, None)

    def close_day(self, s: str, bar: dict) -> None:
        q = self.units.get(s, 0.0)
        if not q:
            return
        paid = sum(q * price * rate for _, price, rate in bar["funding"])
        self.equity -= paid
        self.parts["funding"] -= paid
        self.value_at(s, bar["close"])


def _table(daily: dict[str, list[Candle]], rates: dict) -> tuple[list[str], dict]:
    table = {s: {b["day"]: b for b in bars(cs, rates.get(s, {}))} for s, cs in daily.items()}
    return sorted({d for t in table.values() for d in t}), table


def _eve(day: str) -> str:
    return (datetime.fromisoformat(day) - timedelta(days=1)).date().isoformat()


def _vol20(closes: list[float]) -> float | None:
    rets = [b / a - 1 for a, b in zip(closes[-21:-1], closes[-20:], strict=False)]
    return pstdev(rets) if len(rets) >= 20 else None


# --- Spazzino (exam E10's rules) -------------------------------------------------------------


def spazzino(daily: dict[str, list[Candle]], rates: dict, start_day: str) -> dict:
    """Long when a coin closes above its 100-day average, BTC above its own, and RSI(2)
    under 10; short in the mirror (under, under, RSI(2) over 90). In at the next day's open;
    out at the next open after a close past the 5-day average, RSI(2) past 70 (30), or 5
    days in; an emergency stop at 3 daily ATR. 0.5% risk, at most 5 positions; the universe
    is BTC, ETH and the 10 coins with the most volume, chosen each month."""
    days, table = _table(daily, rates)
    book, curve = Book(), {}
    pending: dict[str, tuple[float, str, float | None]] = {}  # units, why, stop
    held: dict[str, dict] = {}  # stop, day index of entry
    hist: dict[str, list[Candle]] = {s: [] for s in daily}
    universe: list[str] = []
    month, eve = "", _eve(start_day)
    for i, day in enumerate(days):
        today = {s: t[day] for s, t in table.items() if day in t}
        for s, (units, why, stop) in list(pending.items()):  # the open: yesterday's decisions
            if s in today:
                book.trade_to(s, units, today[s]["open"], day, why)
                if units:
                    held[s] = {"stop": stop, "i": i}
                else:
                    held.pop(s, None)
        pending.clear()
        for s in list(book.units):  # the day: emergency stops on the range, then the close
            if s not in today:
                continue
            q, bar, stop = book.units[s], today[s], held[s]["stop"]
            if stop and (bar["low"] <= stop if q > 0 else bar["high"] >= stop):
                book.trade_to(s, 0.0, min(stop, bar["open"]) if q > 0 else max(stop, bar["open"]), day,
                              "stop di emergenza")  # fmt: skip
                held.pop(s, None)
            else:
                book.close_day(s, bar)
        for s, bar in today.items():
            hist[s].append(Candle(0, bar["open"], bar["high"], bar["low"], bar["close"], volume_on(daily[s], day)))
        if day >= start_day:
            curve[day] = round(book.equity, 2)
        if day < eve:  # decisions from the eve of the start, so the first trade is on the first day
            continue
        if day[:7] != month:
            month = day[:7]
            vols = {s: fmean(c.close * c.volume for c in h[-30:]) for s, h in hist.items() if len(h) >= 30}
            others = sorted((s for s in vols if s not in ("BTC/USDT", "ETH/USDT")), key=lambda s: -vols[s])
            universe = [s for s in ("BTC/USDT", "ETH/USDT") if s in vols] + others[:10]
        btc = [c.close for c in hist.get("BTC/USDT", [])]
        btc_trend = 0 if len(btc) < 100 else (1 if btc[-1] > fmean(btc[-100:]) else -1)
        for s, q in book.units.items():
            closes = [c.close for c in hist[s]]
            r2, sma5 = rsi(closes[-30:], 2), fmean(closes[-5:])
            done = (closes[-1] > sma5 or r2 > 70) if q > 0 else (closes[-1] < sma5 or r2 < 30)
            if done or i - held[s]["i"] >= 4:  # out at the 5th open at the latest
                pending[s] = (0.0, "uscita: media a 5, RSI(2) o 5 giorni", None)
        slots = 5 - len(book.units) + len(pending)
        for s in universe:
            if slots <= 0 or s in book.units or len(hist[s]) < 100 or not btc_trend:
                continue
            closes = [c.close for c in hist[s]]
            sma100, r2, a = fmean(closes[-100:]), rsi(closes[-30:], 2), atr(hist[s][-30:], 14)
            side = 1 if closes[-1] > sma100 and btc_trend > 0 and r2 < 10 else (
                -1 if closes[-1] < sma100 and btc_trend < 0 and r2 > 90 else 0)  # fmt: skip
            if not side or not a:
                continue
            units = side * min(book.equity * 0.005 / (3 * a), book.equity * 0.33 / closes[-1])
            pending[s] = (units, "RSI(2) nel verso del trend", closes[-1] - side * 3 * a)
            slots -= 1
    summary = _summary(book, curve, {s.split("/")[0]: why for s, (u, why, _) in pending.items()})
    for o in summary["open"]:  # the emergency stop of each open position
        o["stop"] = held.get(f"{o['symbol']}/USDT", {}).get("stop")
    return summary


def volume_on(candles: list[Candle], day: str) -> float:
    for c in reversed(candles):
        d = day_of(c.ts)
        if d == day:
            return c.volume
        if d < day:
            break
    return 0.0


# --- Ragioniere (exam E08's rules) ----------------------------------------------------------------


def ragioniere(daily: dict[str, list[Candle]], rates: dict, start_day: str) -> dict:
    """Every Monday: long the fifth of the coins with the lowest funding over 7 days, short
    the fifth with the highest (at least 3 a side), weights as 1/vol20, 0.5 long and 0.5
    short, at most 15% a coin; a held coin stays while it is in its extreme third. Coins need
    60 days of history and a 30-day volume above the median. A drop of 15% from the peak
    halves the book for 4 weeks."""
    days, table = _table(daily, rates)
    book, curve, peak, halved_until = Book(), {}, CAPITAL, ""
    hist: dict[str, list[Candle]] = {s: [] for s in daily}
    target: dict[str, float] | None = None
    for day in days:
        today = {s: t[day] for s, t in table.items() if day in t}
        if target is not None and datetime.fromisoformat(day).weekday() == 0:  # Monday's open
            for s in set(book.units) | set(target):
                if s in today:
                    book.trade_to(s, target.get(s, 0.0) / today[s]["open"], today[s]["open"], day, "ribilanciamento")
            target = None
        for s in list(book.units):
            if s in today:
                book.close_day(s, today[s])
        for s, bar in today.items():
            hist[s].append(Candle(0, bar["open"], bar["high"], bar["low"], bar["close"], volume_on(daily[s], day)))
        if day >= start_day:
            curve[day] = round(book.equity, 2)
            peak = max(peak, book.equity)
            if not halved_until and book.equity < peak * 0.85:
                halved_until = (datetime.fromisoformat(day) + timedelta(days=28)).date().isoformat()
        if halved_until and day >= halved_until:
            halved_until = ""
        if day < _eve(start_day) or datetime.fromisoformat(day).weekday() != 6:  # decided on Sunday's close
            continue
        ranked, f7 = _carry_rank(hist, rates, day)
        if not ranked:
            continue
        n = max(3, round(len(ranked) / 5))
        third = max(n, len(ranked) // 3)
        held_long = [s for s, q in book.units.items() if q > 0 and s in ranked[:third]]
        held_short = [s for s, q in book.units.items() if q < 0 and s in ranked[-third:]]
        longs = list(dict.fromkeys([*held_long, *ranked[:n]]))
        shorts = list(dict.fromkeys([*held_short, *ranked[-n:]]))
        side_size = book.equity * (0.25 if halved_until else 0.5)
        target = {}
        for side, group in ((1, longs), (-1, shorts)):
            inv = {s: 1 / v for s in group if (v := _vol20([c.close for c in hist[s]]))}
            total = sum(inv.values())
            for s, w in inv.items():
                target[s] = side * min(book.equity * 0.15, side_size * w / total)
    summary = _summary(book, curve, {s.split("/")[0]: round(v, 2) for s, v in (target or {}).items()})
    ranked, f7 = _carry_rank(hist, rates, days[-1]) if days else ([], {})
    n = max(3, round(len(ranked) / 5))
    yearly = {s.split("/")[0]: round(f7[s] * 365 / 7 * 100, 1) for s in ranked}  # funding in % a year
    summary["classifica"] = {"long": {s.split("/")[0]: yearly[s.split("/")[0]] for s in ranked[:n]},
                             "short": {s.split("/")[0]: yearly[s.split("/")[0]] for s in ranked[-n:]}}  # fmt: skip
    return summary


def _carry_rank(hist: dict[str, list[Candle]], rates: dict, day: str) -> tuple[list[str], dict[str, float]]:
    """The coins with 60 days of history and a 30-day volume above the median, from the
    lowest funding over the 7 days up to `day`'s close to the highest."""
    ready = [s for s, h in hist.items() if len(h) >= 60]
    vols = {s: fmean(c.close * c.volume for c in hist[s][-30:]) for s in ready}
    if len(vols) < 6:
        return [], {}
    cut = median(vols.values())
    end = ms_of(day) + DAY_MS
    f7 = {s: sum(r for t, r in rates.get(s, {}).items() if end - 7 * DAY_MS <= t < end)
          for s in ready if vols[s] > cut}  # fmt: skip
    return sorted(f7, key=lambda s: f7[s]), f7


def ms_of(day: str) -> int:
    return int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp() * 1000)


def _summary(book: Book, curve: dict, signals: dict) -> dict:
    open_ = [{"symbol": s.split("/")[0], "side": "long" if q > 0 else "short", "qty": round(abs(q), 6),
              "entry": book.entry.get(s, {}).get("price"), "since": book.entry.get(s, {}).get("day")}
             for s, q in book.units.items()]  # fmt: skip
    return {"curve": curve, "trades": book.trades, "open": open_, "segnali": signals,
            "parti": {k: round(v, 2) for k, v in book.parts.items()}}  # fmt: skip
