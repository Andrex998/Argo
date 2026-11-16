"""SQLite persistence: the desk's cash, positions, closed trades and its journal.

The desk keeps its own book instead of reading exchange balances, so it only
ever manages what it bought with the capital it was given.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path

from desk.models import Position

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS positions (
    symbol TEXT PRIMARY KEY, qty REAL, entry_price REAL, entry_ts REAL, cost REAL,
    stop REAL, initial_stop REAL, target REAL, highest REAL);
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT, qty REAL, entry_price REAL,
    exit_price REAL, entry_ts REAL, exit_ts REAL, pnl REAL, r_multiple REAL, reason TEXT);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, agent TEXT, symbol TEXT,
    message TEXT, data TEXT);
CREATE TABLE IF NOT EXISTS cooldowns (symbol TEXT PRIMARY KEY, until REAL);
CREATE TABLE IF NOT EXISTS reviews (symbol TEXT PRIMARY KEY, ts REAL);
"""


@dataclass(frozen=True, slots=True)
class Trade:
    symbol: str
    qty: float
    entry_price: float
    exit_price: float
    entry_ts: float
    exit_ts: float
    pnl: float
    r_multiple: float
    reason: str


@dataclass(frozen=True, slots=True)
class Event:
    ts: float
    agent: str
    symbol: str
    message: str


class Store:
    def __init__(self, path: Path | str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, isolation_level=None)  # autocommit
        self.db.executescript(SCHEMA)

    # --- key/value state ------------------------------------------------------

    def get(self, key: str, default: str = "") -> str:
        row = self.db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default

    def get_float(self, key: str, default: float = 0.0) -> float:
        return float(self.get(key, str(default)))

    def set(self, key: str, value: str | float) -> None:
        self.db.execute(
            "INSERT INTO kv (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )

    def add(self, key: str, amount: float) -> None:
        self.set(key, self.get_float(key) + amount)

    # --- positions and trades -------------------------------------------------

    def positions(self) -> list[Position]:
        rows = self.db.execute(
            "SELECT symbol, qty, entry_price, entry_ts, cost, stop, initial_stop, target, highest "
            "FROM positions ORDER BY entry_ts"
        ).fetchall()
        return [Position(*row) for row in rows]

    def save_position(self, pos: Position) -> None:
        self.db.execute(
            "INSERT OR REPLACE INTO positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            tuple(asdict(pos).values()),
        )

    def delete_position(self, symbol: str) -> None:
        self.db.execute("DELETE FROM positions WHERE symbol = ?", (symbol,))

    def add_trade(self, trade: Trade) -> None:
        self.db.execute(
            "INSERT INTO trades (symbol, qty, entry_price, exit_price, entry_ts, exit_ts, "
            "pnl, r_multiple, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            tuple(asdict(trade).values()),
        )

    def trades(self) -> list[Trade]:
        rows = self.db.execute(
            "SELECT symbol, qty, entry_price, exit_price, entry_ts, exit_ts, pnl, r_multiple, "
            "reason FROM trades ORDER BY exit_ts"
        ).fetchall()
        return [Trade(*row) for row in rows]

    # --- cooldowns and analysis memory ---------------------------------------

    def cooldowns(self, now: float) -> dict[str, float]:
        rows = self.db.execute("SELECT symbol, until FROM cooldowns WHERE until > ?", (now,))
        return dict(rows.fetchall())

    def set_cooldown(self, symbol: str, until: float) -> None:
        self.db.execute("INSERT OR REPLACE INTO cooldowns VALUES (?, ?)", (symbol, until))

    def reviewed_at(self, symbol: str) -> float:
        row = self.db.execute("SELECT ts FROM reviews WHERE symbol = ?", (symbol,)).fetchone()
        return row[0] if row else 0.0

    def mark_reviewed(self, symbol: str, ts: float) -> None:
        self.db.execute("INSERT OR REPLACE INTO reviews VALUES (?, ?)", (symbol, ts))

    # --- journal --------------------------------------------------------------

    def log(self, ts: float, agent: str, symbol: str, message: str, data: dict | None) -> None:
        self.db.execute(
            "INSERT INTO events (ts, agent, symbol, message, data) VALUES (?, ?, ?, ?, ?)",
            (ts, agent, symbol, message, json.dumps(data, ensure_ascii=False) if data else None),
        )

    def events(self, limit: int = 50) -> list[Event]:
        rows = self.db.execute(
            "SELECT ts, agent, symbol, message FROM events ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [Event(*row) for row in reversed(rows)]
