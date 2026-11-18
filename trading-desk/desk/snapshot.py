"""A snapshot of the desk for the ARGO DESK Live page on claude.ai.

It writes one JSON file per document of the page's store, read from the desk's
database alone: nothing here touches the network or the desk's state. A Claude
session then copies the files into the page. Run it as `desk snapshot` or, on a
copy that predates that command, `python -m desk.snapshot`.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sqlite3
import time
from pathlib import Path

from desk import dashboard
from desk.config import Settings
from desk.store import Store

FEED_SIZE = 80  # latest journal entries on the page
CURVE_POINTS = 240  # equity points drawn, spread over the whole history
TRADES_SHOWN = 25
DOCUMENTS = ("account", "feed", "curve", "book")


def _num(value: float, digits: int = 2) -> float | None:
    """A number the page can show, or None. JSON has no NaN or infinity."""
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def _price(value: float) -> float | None:
    """Keep enough digits for a coin priced in fractions of a cent."""
    if value is None or not math.isfinite(value):
        return None
    return float(f"{value:.6g}")


def _spread(points: list, limit: int) -> list:
    """At most `limit` points, evenly spaced, always keeping the last one."""
    if len(points) <= limit:
        return points
    step = (len(points) - 1) / (limit - 1)
    return [points[round(i * step)] for i in range(limit)]


def build(db_path: Path, cfg: Settings, now: float) -> dict[str, dict]:
    """The page's documents, keyed by name."""
    st = dashboard.state(db_path, cfg, now)
    at = _num(now, 0)
    if not st["ready"]:
        account = {"at": at, "ready": False, "mode": cfg.mode, "exchange": cfg.exchange}
        empty = {"at": at}
        return {
            "account": account,
            "feed": empty | {"items": [], "agents": [], "scan": None},
            "curve": empty | {"points": []},
            "book": empty | {"positions": [], "trades": []},
        }

    store = Store(db_path, readonly=True)
    try:
        events = store.events_after(0, limit=FEED_SIZE)
        latest = store.db.execute("SELECT agent, MAX(id) FROM events GROUP BY agent").fetchall()
        last_ids = [row[1] for row in latest]
        marks = ",".join("?" * len(last_ids))
        per_agent = (
            store.db.execute(
                f"SELECT agent, ts, symbol, message FROM events WHERE id IN ({marks})", last_ids
            ).fetchall()
            if last_ids
            else []
        )
        scan_row = store.db.execute(
            "SELECT ts, data FROM events WHERE json_extract(data, '$.kind') = 'scan' "
            "ORDER BY id DESC LIMIT 1"
        ).fetchone()
        curve = store.equity_curve(limit=100_000)
        every_trade = store.trades()
        trades = every_trade[-TRADES_SHOWN:]
        shadows = store.leverage_books(cfg.leverage_levels, cfg.capital)
        prices = store.get_json("prices")
        try:
            shadow_results = store.leverage_results(TRADES_SHOWN)
        except sqlite3.OperationalError:  # a database from before simulated leverage
            shadow_results = []
    finally:
        store.close()

    capital = cfg.capital
    equity = st["equity"]
    count = st["trades"]["count"]
    busy = st["busy"] or {}
    account = {
        "at": at,
        "ready": True,
        "mode": st["mode"],
        "exchange": st["exchange"],
        "quote": st["quote"],
        "timeframe": st["timeframe"],
        "analysts": cfg.model if cfg.anthropic_api_key else "solo regole",
        "capital": _num(capital),
        "equity": _num(equity),
        "cash": _num(st["cash"]),
        "exposure": _num(st["exposure"]),
        "exposure_pct": _num(st["exposure"] / equity * 100 if equity else 0, 1),
        "pnl": _num(equity - capital),
        "pnl_pct": _num((equity / capital - 1) * 100 if capital else 0),
        "day_pct": _num(
            (equity / st["day_start_equity"] - 1) * 100 if st["day_start_equity"] else 0
        ),
        "drawdown_pct": _num((1 - equity / st["peak_equity"]) * 100 if st["peak_equity"] else 0),
        "open_positions": len(st["positions"]),
        "trades": count,
        "wins": st["trades"]["wins"],
        "win_rate": _num(st["trades"]["wins"] / count * 100 if count else None, 0),
        "avg_r": _num(st["trades"]["avg_r"]) if count else None,
        "realized_pnl": _num(st["trades"]["pnl"]),
        "realized_won": _num(sum(t.pnl for t in every_trade if t.pnl > 0)),
        "realized_lost": _num(sum(t.pnl for t in every_trade if t.pnl < 0)),
        "halted": st["halted"] or "",
        "heartbeat": _num(st["heartbeat"], 0),
        "next_cycle": _num(st["next_cycle"], 0) or None,
        "busy_agent": busy.get("agent", ""),
        "busy_task": busy.get("task", ""),
        "busy_symbol": busy.get("symbol", ""),
        "llm_cost": _num(st["llm"]["cost"]),
        "rvol_min": _num(cfg.rvol_min, 1),
        **{key: _num(value, 1) for key, value in st["limits"].items()},
    }

    scan = None
    if scan_row:
        facts = json.loads(scan_row[1])
        scan = {
            "ts": _num(scan_row[0], 0),
            "scanned": facts.get("scanned"),
            "flagged": [
                {"symbol": f["symbol"], "rvol": _num(f["rvol"], 1)}
                for f in facts.get("flagged", [])
            ],
        }
    feed = {
        "at": at,
        "items": [
            {
                "id": e["id"],
                "ts": _num(e["ts"], 0),
                "agent": e["agent"],
                "symbol": e["symbol"],
                "kind": e["data"].get("kind", "note"),
                "message": e["message"],
            }
            for e in events
        ],
        "agents": sorted(
            (
                {"agent": agent, "ts": _num(ts, 0), "symbol": symbol, "message": message}
                for agent, ts, symbol, message in per_agent
            ),
            key=lambda a: a["agent"],
        ),
        "scan": scan,
    }
    points = [{"ts": _num(ts, 0), "equity": _num(eq)} for ts, eq in curve]
    book = {
        "at": at,
        "positions": [
            {
                "symbol": p["symbol"],
                "qty": float(f"{p['qty']:.6g}"),
                "entry": _price(p["entry"]),
                "last": _price(p["last"]),
                "stop": _price(p["stop"]),
                "target": _price(p["target"]),
                "value": _num(p["value"]),
                "pnl": _num(p["pnl"]),
                "pnl_pct": _num(p["pnl_pct"]),
                "opened": _num(p["entry_ts"], 0),
            }
            for p in st["positions"]
        ],
        "trades": [
            {
                "symbol": t.symbol,
                "entry": _price(t.entry_price),
                "exit": _price(t.exit_price),
                "opened": _num(t.entry_ts, 0),
                "closed": _num(t.exit_ts, 0),
                "pnl": _num(t.pnl),
                "r": _num(t.r_multiple),
                "reason": t.reason,
            }
            for t in reversed(trades)
        ],
    }
    book["leverage"] = {
        "fee": cfg.futures_fee_rate,
        "funding_8h": cfg.funding_rate_8h,
        "maintenance": cfg.maintenance_margin,
        "books": [
            {
                "level": shadow.level,
                "start": _num(shadow.start),
                "equity": _num(shadow.equity(prices)),
                "ret": _num((shadow.equity(prices) / shadow.start - 1) * 100),
                "liquidations": shadow.liquidations,
                "fees": _num(shadow.fees),
                "funding": _num(shadow.funding),
                "open": len(shadow.legs),
                "max_dd": _num(shadow.max_drawdown_pct, 1),
                "wiped": shadow.wiped_at is not None,
            }
            for shadow in shadows
        ],
        "legs": [
            {
                "level": shadow.level,
                "symbol": symbol,
                "margin": _num(leg.margin),
                "entry": _price(leg.entry),
                "liquidation": _price(leg.liquidation),
                "value": _num(leg.value(prices.get(symbol, leg.entry))),
                "pnl_pct": _num((leg.value(prices.get(symbol, leg.entry)) / leg.margin - 1) * 100)
                if leg.margin
                else None,
            }
            for shadow in shadows
            for symbol, leg in shadow.legs.items()
        ],
        "results": [
            {
                "level": r.level,
                "symbol": r.symbol,
                "pnl": _num(r.pnl),
                "liquidated": r.liquidated,
                "closed": _num(r.closed, 0),
            }
            for r in shadow_results
        ],
    }
    return {
        "account": account,
        "feed": feed,
        "curve": {"at": at, "points": _spread(points, CURVE_POINTS)},
        "book": book,
    }


def write(docs: dict[str, dict], out: Path) -> list[Path]:
    """One file per document, each replaced whole so a reader never sees half of one."""
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, doc in docs.items():
        path = out / f"{name}.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, ensure_ascii=False, allow_nan=False), encoding="utf-8")
        os.replace(tmp, path)
        paths.append(path)
    return paths


def run(cfg: Settings, out: Path, now: float | None = None) -> list[Path]:
    try:
        docs = build(cfg.db_path, cfg, time.time() if now is None else now)
    except sqlite3.OperationalError as e:
        raise SystemExit(f"Database del desk non leggibile ({cfg.db_path}): {e}") from e
    return write(docs, out)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m desk.snapshot", description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("data/live"), help="cartella dei file")
    args = parser.parse_args(argv)
    for path in run(Settings(), args.out):
        print(path.resolve())


if __name__ == "__main__":
    main()
