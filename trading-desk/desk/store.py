"""SQLite persistence: the desk's cash, positions, closed trades and its journal.

The desk keeps its own book instead of reading exchange balances, so it only
ever manages what it bought with the capital it was given.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path

from desk.leverage import Book, LegResult, book_from_state, book_state
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
CREATE TABLE IF NOT EXISTS equity (ts REAL PRIMARY KEY, equity REAL);
CREATE TABLE IF NOT EXISTS leverage_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT, level REAL, symbol TEXT, margin REAL, entry REAL,
    exit REAL, opened REAL, closed REAL, pnl REAL, fees REAL, funding REAL, liquidated INTEGER);
"""
TABLES = (
    "kv",
    "positions",
    "trades",
    "events",
    "cooldowns",
    "reviews",
    "equity",
    "leverage_results",
)


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
    def __init__(self, path: Path | str, *, readonly: bool = False):
        """Open the desk's database. A read-only store never creates or changes anything."""
        if readonly:
            self.db = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
            return
        in_memory = str(path) == ":memory:"
        if not in_memory:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, isolation_level=None, timeout=10)  # autocommit
        if not in_memory:
            # Lets the dashboard read while the desk writes.
            self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    def reset(self) -> None:
        """Empty every table. Used by the demo to start a session over."""
        for table in TABLES:
            self.db.execute(f"DELETE FROM {table}")

    # --- key/value state ------------------------------------------------------

    def get(self, key: str, default: str = "") -> str:
        row = self.db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default

    def get_float(self, key: str, default: float = 0.0) -> float:
        return float(self.get(key, str(default)))

    def get_json(self, key: str) -> dict:
        raw = self.get(key)
        return json.loads(raw) if raw else {}

    def set(self, key: str, value: str | float) -> None:
        self.db.execute(
            "INSERT INTO kv (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )

    def set_json(self, key: str, value: dict) -> None:
        self.set(key, json.dumps(value, ensure_ascii=False))

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

    # --- equity history -------------------------------------------------------

    def add_equity(self, ts: float, equity: float, min_gap: float = 0.0) -> None:
        """Record a point, unless one was just recorded and equity has barely moved."""
        last = self.db.execute("SELECT ts, equity FROM equity ORDER BY ts DESC LIMIT 1").fetchone()
        if last and ts - last[0] < min_gap and abs(equity - last[1]) < 0.0005 * last[1]:
            return
        self.db.execute("INSERT OR REPLACE INTO equity VALUES (?, ?)", (ts, equity))

    def equity_curve(self, limit: int = 400) -> list[tuple[float, float]]:
        """The latest points, oldest first."""
        rows = self.db.execute(
            "SELECT ts, equity FROM equity ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
        return rows[::-1]

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

    def events_after(self, after_id: int, limit: int = 300) -> list[dict]:
        """Journal entries newer than `after_id`, oldest first; the latest ones when it is 0."""
        columns = "id, ts, agent, symbol, message, data"
        if after_id > 0:
            rows = self.db.execute(
                f"SELECT {columns} FROM events WHERE id > ? ORDER BY id LIMIT ?", (after_id, limit)
            ).fetchall()
        else:
            rows = self.db.execute(
                f"SELECT {columns} FROM events ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()[::-1]
        return [
            {
                "id": id_,
                "ts": ts,
                "agent": agent,
                "symbol": symbol,
                "message": message,
                "data": json.loads(data) if data else {},
            }
            for id_, ts, agent, symbol, message, data in rows
        ]

    # --- simulated leverage ----------------------------------------------------

    def leverage_books(self, levels: list[float], capital: float) -> list[Book]:
        """The shadow book of each level, new ones starting from `capital`."""
        found = []
        for level in levels:
            state = self.get_json(f"leverage:{level:g}")
            if state:
                found.append(book_from_state(state))
            else:
                found.append(
                    Book(
                        level=float(level),
                        start=capital,
                        cash=capital,
                        peak=capital,
                        last_equity=capital,
                    )
                )
        return found

    def save_leverage(self, book: Book) -> None:
        self.set_json(f"leverage:{book.level:g}", book_state(book))

    def add_leverage_result(self, result: LegResult) -> None:
        self.db.execute(
            "INSERT INTO leverage_results (level, symbol, margin, entry, exit, opened, closed, "
            "pnl, fees, funding, liquidated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                result.level,
                result.symbol,
                result.margin,
                result.entry,
                result.exit,
                result.opened,
                result.closed,
                result.pnl,
                result.fees,
                result.funding,
                int(result.liquidated),
            ),
        )

    def leverage_results(self, limit: int = 50) -> list[LegResult]:
        """The latest closed leveraged positions, newest first."""
        rows = self.db.execute(
            "SELECT symbol, level, margin, entry, exit, opened, closed, pnl, fees, funding, "
            "liquidated FROM leverage_results ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [LegResult(*row[:-1], bool(row[-1])) for row in rows]
