import json
import threading

import pytest

from desk import demo, snapshot
from desk.config import Settings


def test_snapshot_of_a_session_fits_the_page(tmp_path):
    db = tmp_path / "demo.db"
    demo.run(db, threading.Event(), pace=0.0, loop=False)
    cfg = demo.settings()

    docs = snapshot.build(db, cfg, now=2_000_000_000.0)

    assert set(docs) == set(snapshot.DOCUMENTS)
    for name, doc in docs.items():
        text = json.dumps(doc, ensure_ascii=False, allow_nan=False)
        assert len(text.encode()) < 256 * 1024, name  # the store's limit per document
        assert doc["at"] == 2_000_000_000
    account, feed = docs["account"], docs["feed"]
    assert account["ready"] and account["trades"] > 0 and account["capital"] == cfg.capital
    assert account["analysts"] == "solo regole"
    assert account["realized_won"] + account["realized_lost"] == pytest.approx(
        account["realized_pnl"], abs=0.02
    )
    ids = [item["id"] for item in feed["items"]]
    assert ids == sorted(ids) and len(ids) <= snapshot.FEED_SIZE
    assert {"SCOUT", "RISK", "EXECUTOR"} <= {a["agent"] for a in feed["agents"]}
    assert feed["scan"]["scanned"] > 0
    assert 0 < len(docs["curve"]["points"]) <= snapshot.CURVE_POINTS
    assert docs["book"]["trades"][0]["closed"] >= docs["book"]["trades"][-1]["closed"]
    leverage = docs["book"]["leverage"]
    assert [b["level"] for b in leverage["books"]] == cfg.leverage_levels
    assert all(b["start"] == cfg.capital for b in leverage["books"])


def test_snapshot_before_the_desk_ever_ran(tmp_path):
    docs = snapshot.build(tmp_path / "none.db", Settings(), now=1.0)
    assert docs["account"]["ready"] is False
    assert docs["feed"]["items"] == [] and docs["book"]["positions"] == []


def test_files_are_written_whole(tmp_path):
    db = tmp_path / "demo.db"
    demo.run(db, threading.Event(), pace=0.0, loop=False)
    paths = snapshot.write(snapshot.build(db, demo.settings(), 1.0), tmp_path / "live")
    assert sorted(p.name for p in paths) == ["account.json", "book.json", "curve.json", "feed.json"]
    assert not list((tmp_path / "live").glob("*.tmp"))
    assert json.loads(paths[0].read_text(encoding="utf-8"))["at"] == 1


def test_spread_keeps_the_ends():
    points = list(range(1000))
    spread = snapshot._spread(points, 240)
    assert len(spread) == 240 and spread[0] == 0 and spread[-1] == 999
