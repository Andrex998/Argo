"""The analysts' budget: how many markets they may discuss per hour and per day.

The analysts run on the owner's Claude subscription (or an API key), which both desks
share with each other and with the owner's own use of Claude. So the desks count their
debates in one small database file next to their own, and both draw on it: three markets
an hour means three for the two desks together, not three each.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

HOUR, DAY = 3600.0, 86400.0
FILE = "analysts-budget.db"


class AnalystBudget:
    def __init__(self, path: Path | str = ":memory:", timeout: float = 30.0):
        """The budget kept in `path`. The default, in memory, counts for this desk alone
        and only while it runs: the demo and the tests. `timeout` is how long a desk waits
        while the other one is counting."""
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, isolation_level=None, timeout=timeout)  # autocommit
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS debates (ts REAL NOT NULL, desk TEXT, symbol TEXT)"
        )

    @classmethod
    def shared(cls, data_dir: Path) -> AnalystBudget:
        """The budget both desks share, in their data folder."""
        return cls(data_dir / FILE)

    def claim(
        self, now: float, per_hour: int, per_day: int, desk: str = "", symbol: str = ""
    ) -> str:
        """Count one debate starting now, or say why there is no room for it ('' when it
        was counted). The check and the count are one step, so the two desks can never
        both take the last place. A file that cannot be read means no debate, never a
        stopped desk."""
        try:
            self.db.execute("BEGIN IMMEDIATE")  # the other desk waits until this one is done
            try:
                hour, day = self.counts(now)
                if hour >= per_hour:
                    why = f"già {hour} analisi nell'ultima ora (il limite è {per_hour})"
                elif day >= per_day:
                    why = f"già {day} analisi nelle ultime 24 ore (il limite è {per_day})"
                else:
                    why = ""
                    self.db.execute("DELETE FROM debates WHERE ts <= ?", (now - DAY,))
                    self.db.execute("INSERT INTO debates VALUES (?, ?, ?)", (now, desk, symbol))
                self.db.execute("COMMIT")
            except BaseException:
                self.db.execute("ROLLBACK")
                raise
        except sqlite3.Error as e:
            return f"il conteggio delle analisi non è leggibile ({e})"
        return why

    def counts(self, now: float) -> tuple[int, int]:
        """The debates in the last hour and in the last 24 hours."""
        hour, day = self.db.execute(
            "SELECT COALESCE(SUM(ts > ?), 0), COUNT(*) FROM debates WHERE ts > ?",
            (now - HOUR, now - DAY),
        ).fetchone()
        return int(hour), int(day)
