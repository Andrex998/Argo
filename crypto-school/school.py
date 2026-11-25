"""Scuola Cripto: the class's books. BingX prices, fake money.

The agents propose, this script decides what happened. It runs with the trading desk's
Python environment, because the rules wallets reuse the desk's research code. From
trading-desk/, after `uv sync --frozen`:

  uv run --frozen python ../crypto-school/school.py <command> ...

  new STATE START           the judgment wallets, 10,000 USDT each, from START (a date)
  mark STATE OI             prices now; funding, stops and targets on the hourly candles;
                            today's open interest added to the record OI
  giorno STATE OI DIR       the rules wallets replayed from the start, the picture of the
                            market and the Guardiano's numbers: DIR/regole.json,
                            DIR/quadro.json, DIR/rischio.json
  execute STATE ORDERS      the agents' orders for their judgment wallets, at the last prices
  verify NOTEBOOK           score the notebook's predictions now due
  limite STATE AGENT PCT    the most AGENT may risk on a position (the Preside's monthly call)
  history COIN [DAYS]       daily candles, for homework (at most 1,000 days)

Each command prints a JSON report; `mark`, `giorno`, `execute` and `verify` write the files
they are given back. When BingX does not answer, the command prints {"error": ...}.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import data
import judgment
import picture
import rules

DAY_MS = rules.DAY_MS
HOUR_MS = 3_600_000
OI_DAYS = 400  # days of open interest kept in the record
TRADES_KEPT = 40  # each rules wallet's last trades, in its report


def _load(path: str, default: dict | None = None) -> dict:
    p = Path(path)
    if default is not None and not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def _save(path: str, content: dict) -> None:
    Path(path).write_text(json.dumps(content, ensure_ascii=False, indent=1), encoding="utf-8")


def _print(content: dict) -> None:
    print(json.dumps(content, ensure_ascii=False, indent=1))


def _now_ms(now: datetime) -> int:
    return int(now.timestamp() * 1000)


# --- commands --------------------------------------------------------------------------------


def mark(state_path: str, oi_path: str, now: datetime) -> dict:
    state, record = _load(state_path), _load(oi_path, {})
    end, today = _now_ms(now), now.date().isoformat()
    prices = data.tickers()
    candles, rates = {}, {}
    for coin in sorted({p["symbol"] for w in state["wallets"].values() for p in w["positions"]}):
        mine = [p for w in state["wallets"].values() for p in w["positions"] if p["symbol"] == coin]
        candles[coin] = data.klines(coin, "1h", min(judgment.ms(p["checked"]) for p in mine), end)
        rates[coin] = data.funding(coin, min(judgment.ms(p["funded"]) for p in mine), end)
    events = judgment.mark(state, candles, rates)
    state["prices"], state["prices_at"] = prices, judgment.text(end)
    if today not in record:
        snap = {"_btc": prices.get("BTC")}
        for coin in data.COINS:
            try:
                snap[coin] = round(data.open_interest(coin))
            except (data.DataError, KeyError, TypeError, ValueError):
                continue
        record[today] = snap
        record = dict(sorted(record.items())[-OI_DAYS:])
    values = judgment.snapshot(state, today)
    _save(state_path, state)
    _save(oi_path, record)
    return {"now": judgment.text(end), "events": events, "equity": values, "prices": prices,
            "open_interest_coins": len(record[today]) - 1}  # fmt: skip


def _readable(name: str, result: dict) -> dict:
    """A rules wallet's report, with times as text and only its last trades."""
    out = dict(result)
    if name == "falco":
        out["trades"] = [{**{k: v for k, v in t.items() if not k.endswith("_ts")},
                          "entry": judgment.text(t["entry_ts"]), "exit": judgment.text(t["exit_ts"])}
                         for t in result["trades"]]  # fmt: skip
        out["open"] = [{**{k: v for k, v in o.items() if k != "entry_ts"}, "since": judgment.text(o["entry_ts"])}
                       for o in result["open"]]  # fmt: skip
    out["n_trades"] = len(result["trades"])
    out["trades"] = out["trades"][-TRADES_KEPT:]
    return out


def day(state_path: str, oi_path: str, out_dir: str, now: datetime) -> dict:
    state, record = _load(state_path), _load(oi_path, {})
    end, today = _now_ms(now), now.date().isoformat()
    start_day = state["school"]["start"]
    start = rules.ms_of(start_day)
    first_rate = min(start - 10 * DAY_MS, rules.ms_of(today) - 200 * DAY_MS)
    k4h, k1d, rates = {}, {}, {}
    for coin in data.COINS:
        s = data.pair(coin)
        k4h[s] = data.klines(coin, "4h", start - 40 * DAY_MS, end)
        k1d[s] = data.klines(coin, "1d", min(start, end) - 400 * DAY_MS, end)
        rates[s] = data.funding(coin, first_rate, end)
    # Replayed even before the first day: the signals then say what each rule will do at the start.
    results = {
        "falco": rules.falco(k4h, rates, k1d["BTC/USDT"], start, max(end, start + DAY_MS)),
        "tartaruga": rules.tartaruga(k1d, rates, start_day),
        "spazzino": rules.spazzino(k1d, rates, start_day),
        "ragioniere": rules.ragioniere(k1d, rates, start_day),
    }
    results = {name: _readable(name, r) for name, r in results.items()}
    pic = picture.picture(k1d, rates, record, state.get("prices", {}), today, state.get("market"))
    numbers = picture.risk(state, results, pic)
    m = pic["mercato"]
    state["market"] = {"day": today, "panic": m["panico"], "fragile": m["fragile"], "caldo_pct": m["caldo_pct"]}
    folder = Path(out_dir)
    folder.mkdir(parents=True, exist_ok=True)
    _save(str(folder / "regole.json"), {"giorno": today, "inizio": start_day, "portafogli": results})
    _save(str(folder / "quadro.json"), pic)
    _save(str(folder / "rischio.json"), numbers)
    _save(state_path, state)
    return {"now": judgment.text(end), "regole": {n: {"capitale": numbers["portafogli"][f"{n}_regole"]["capitale"],
            "operazioni": r["n_trades"], "aperte": len(r["open"])} for n, r in results.items()},
            "confronto": numbers["confronto"], "allarmi": numbers["allarmi"], "note": numbers["note"],
            "mercato": m}  # fmt: skip


def execute(state_path: str, orders_path: str, now: datetime) -> dict:
    state, orders = _load(state_path), _load(orders_path)
    prices = data.tickers()
    state["prices"], state["prices_at"] = {**state.get("prices", {}), **prices}, judgment.text(_now_ms(now))
    events = judgment.execute(state, orders, prices, now)
    values = judgment.snapshot(state, now.date().isoformat())
    _save(state_path, state)
    return {"now": judgment.text(_now_ms(now)), "events": events, "equity": values}


def verify(notebook_path: str, now: datetime) -> dict:
    notebook = _load(notebook_path)
    predictions = notebook.setdefault("previsioni", [])
    today = now.date().isoformat()
    due: dict[str, str] = {}
    for p in predictions:
        coin, deadline = str(p.get("mercato", "")).upper(), str(p.get("scadenza", "9999"))[:10]
        if p.get("stato", "aperta") == "aperta" and coin in data.COINS and deadline < today:
            due[coin] = min(due.get(coin, deadline), deadline)
    closes = {}
    for coin, oldest in due.items():
        try:
            first = rules.ms_of(oldest)
        except ValueError:
            continue
        closes[coin] = {rules.day_of(c.ts): c.close for c in data.klines(coin, "1d", first, _now_ms(now))}
    scored = judgment.verify(predictions, closes, today)
    notebook["calibrazione"] = judgment.calibration(predictions)
    _save(notebook_path, notebook)
    return {"verificate": scored, "calibrazione": notebook["calibrazione"]}


def main(argv: list[str]) -> None:
    command, args, now = (argv[1] if len(argv) > 1 else ""), argv[2:], datetime.now(UTC)
    if command == "new" and len(args) == 2:
        _save(args[0], judgment.new_state(datetime.fromisoformat(args[1]).date().isoformat()))
        _print({"created": args[0], "start": args[1]})
    elif command == "mark" and len(args) == 2:
        _print(mark(args[0], args[1], now))
    elif command == "giorno" and len(args) == 3:
        _print(day(args[0], args[1], args[2], now))
    elif command == "execute" and len(args) == 2:
        _print(execute(args[0], args[1], now))
    elif command == "verify" and len(args) == 1:
        _print(verify(args[0], now))
    elif command == "limite" and len(args) == 3:
        state = _load(args[0])
        judgment.set_limit(state, args[1], float(args[2]))
        _save(args[0], state)
        _print({"agente": args[1], "rischio_massimo_pct": float(args[2])})
    elif command == "history" and args:
        coin, days = args[0].upper(), min(1000, int(args[1])) if len(args) > 1 else 365
        candles = data.klines(coin, "1d", _now_ms(now) - days * DAY_MS, _now_ms(now))
        print(json.dumps([{"giorno": rules.day_of(c.ts), "apertura": c.open, "massimo": c.high, "minimo": c.low,
                           "chiusura": c.close, "volume": c.volume} for c in candles]))  # fmt: skip
    else:
        print(__doc__)
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main(sys.argv)
    except data.DataError as e:
        _print({"error": str(e)})
        raise SystemExit(1) from e
