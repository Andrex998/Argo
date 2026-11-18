"""The dashboard: a local, read-only web page over the desk's database.

It only ever reads. There is no endpoint that places an order, halts the desk
or changes a setting, so leaving it open cannot move money.
"""

from __future__ import annotations

import json
import socket
import sqlite3
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from desk.config import Settings
from desk.store import Store

# The page loads nothing from other sites and can only talk back to this server.
CONTENT_SECURITY_POLICY = (
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
    "connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'"
)
RECENT_TRADES = 6


def state(db_path: Path, cfg: Settings, now: float, demo: bool = False) -> dict:
    """Everything the page shows except the conversation, read from the database alone."""
    perps = cfg.market == "perps"
    base = {
        "ready": False,
        "now": now,
        "demo": demo,
        "mode": cfg.mode,
        "exchange": cfg.exchange,
        "quote": cfg.quote,
        "timeframe": cfg.timeframe,
        "capital": cfg.capital,
        "analysts": cfg.model,
        "limits": {
            "max_exposure_pct": cfg.max_exposure_pct,
            "max_open_positions": cfg.max_open_positions,
            "max_daily_loss_pct": cfg.max_daily_loss_pct,
            "max_drawdown_pct": cfg.max_drawdown_pct,
        },
    }
    if perps:
        base["market"] = "perps"
        base["max_leverage"] = cfg.perps_max_leverage
        base["limits"]["max_exposure_pct"] = cfg.perps_cap_total_pct  # on the whole notional
    if not Path(db_path).exists():
        return base
    try:
        store = Store(db_path, readonly=True)
    except sqlite3.OperationalError:
        return base
    try:
        if not store.get("cash"):
            return base
        prices = store.get_json("prices")
        cash = store.get_float("cash")
        extra = {}
        if perps:
            positions, open_profit = perps_positions(store, prices)
            exposure = sum(p["value"] for p in positions)
            equity = cash + open_profit
            trades = store.perps_trades()
            extra = {
                "margin": sum(p["margin"] for p in positions),
                "funding": sum(t.funding for t in trades) + sum(p["funding"] for p in positions),
            }
        else:
            positions = []
            for pos in store.positions():
                last = prices.get(pos.symbol, pos.entry_price)
                positions.append(
                    {
                        "symbol": pos.symbol,
                        "qty": pos.qty,
                        "entry": pos.entry_price,
                        "entry_ts": pos.entry_ts,
                        "last": last,
                        "stop": pos.stop,
                        "initial_stop": pos.initial_stop,
                        "target": pos.target,
                        "value": pos.qty * last,
                        "pnl": pos.qty * last - pos.cost,
                        "pnl_pct": (pos.qty * last / pos.cost - 1) * 100,
                    }
                )
            exposure = sum(p["value"] for p in positions)
            equity = cash + exposure
            trades = store.trades()
        return base | {
            "ready": True,
            "session": store.get("session"),
            "cash": cash,
            "exposure": exposure,
            "equity": equity,
            "day_start_equity": store.get_float("day_start_equity", cfg.capital),
            "peak_equity": store.get_float("peak_equity", cfg.capital),
            "halted": store.get("halted"),
            "heartbeat": store.get_float("heartbeat"),
            "next_cycle": store.get_float("next_cycle"),
            "busy": store.get_json("busy"),
            "positions": positions,
            "trades": {
                "count": len(trades),
                "wins": sum(t.pnl > 0 for t in trades),
                "pnl": sum(t.pnl for t in trades),
                "avg_r": sum(t.r_multiple for t in trades) / len(trades) if trades else 0.0,
                "recent": [
                    {
                        "symbol": t.symbol,
                        "reason": t.reason,
                        "pnl": t.pnl,
                        "r": t.r_multiple,
                        "exit_ts": t.exit_ts,
                    }
                    | ({"side": t.side} if perps else {})
                    for t in trades[: -RECENT_TRADES - 1 : -1]
                ],
            },
            "llm": {
                "cost": store.get_float("llm_cost"),
                "searches": store.get_float("llm_searches"),
            },
            "equity_curve": store.equity_curve(),
            **extra,
        }
    finally:
        store.close()


def perps_positions(store: Store, prices: dict[str, float]) -> tuple[list[dict], float]:
    """The perpetual positions as the page shows them, and their open profit together.

    `value` is the position's whole notional. `pnl` is net of the entry fee and the funding
    so far, and `pnl_pct` relates it to the margin: what the money tied up has made.
    """
    positions, open_profit = [], 0.0
    for pos in store.perps_positions():
        last = prices.get(pos.symbol, pos.entry_price)
        profit = pos.profit(last)
        open_profit += profit
        pnl = profit - pos.fees - pos.funding
        positions.append(
            {
                "symbol": pos.symbol,
                "side": pos.side,
                "qty": pos.qty,
                "entry": pos.entry_price,
                "entry_ts": pos.entry_ts,
                "last": last,
                "stop": pos.stop,
                "initial_stop": pos.initial_stop,
                "target": pos.target,
                "value": pos.qty * last,
                "pnl": pnl,
                "pnl_pct": pnl / pos.margin * 100,
                "leverage": pos.leverage,
                "margin": pos.margin,
                "liquidation": pos.liquidation,
                "funding": pos.funding,
            }
        )
    return positions, open_profit


def events(db_path: Path, after_id: int) -> dict:
    """Journal entries the page has not seen yet."""
    if not Path(db_path).exists():
        return {"events": []}
    try:
        store = Store(db_path, readonly=True)
    except sqlite3.OperationalError:
        return {"events": []}
    try:
        return {"events": store.events_after(after_id)}
    finally:
        store.close()


class _Server(ThreadingHTTPServer):
    """On Windows, SO_REUSEADDR lets a second program bind a port that is already taken,
    after which requests reach either one. Ask Windows for the port exclusively instead."""

    allow_reuse_address = sys.platform != "win32"

    def server_bind(self) -> None:
        if sys.platform == "win32":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def serve(
    cfg: Settings,
    db_path: Path,
    clock,
    host: str = "127.0.0.1",
    port: int = 8787,
    demo: bool = False,
) -> ThreadingHTTPServer:
    """Build the server. The caller decides which thread runs `serve_forever`."""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            url = urlsplit(self.path)
            if url.path == "/":
                page = resources.files("desk").joinpath("dashboard.html").read_bytes()
                self._send(page, "text/html; charset=utf-8")
            elif url.path == "/api/state":
                self._json(state(db_path, cfg, clock(), demo))
            elif url.path == "/api/events":
                after = parse_qs(url.query).get("after", ["0"])[0]
                self._json(events(db_path, int(after) if after.isdigit() else 0))
            else:
                self.send_error(HTTPStatus.NOT_FOUND)

        def _json(self, payload: dict) -> None:
            self._send(
                json.dumps(payload, ensure_ascii=False).encode(), "application/json; charset=utf-8"
            )

        def _send(self, body: bytes, content_type: str) -> None:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args) -> None:
            pass  # one line per poll would bury the desk's own output

    return _Server((host, port), Handler)
