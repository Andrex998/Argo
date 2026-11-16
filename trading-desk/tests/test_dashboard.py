import json
import threading
import urllib.request

import pytest

from desk import dashboard, demo
from desk.broker import PaperBroker
from desk.desk import Desk
from desk.store import Store
from tests.conftest import Clock, FakeMarket, breakout


@pytest.fixture
def demo_db(tmp_path):
    """One complete demo session, played without pauses."""
    path = tmp_path / "demo.db"
    demo.run(path, threading.Event(), pace=0.0, loop=False)
    return path


def kinds(path) -> list[str]:
    return [e["data"]["kind"] for e in dashboard.events(path, 0)["events"]]


def test_demo_session_shows_every_outcome(demo_db):
    seen = kinds(demo_db)
    for kind in ("scan", "plan", "plan_rejected", "news", "sentiment", "objection", "verdict",
                 "buy_cancelled", "sized", "buy", "stop_moved", "sell"):  # fmt: skip
        assert kind in seen, kind
    state = dashboard.state(demo_db, demo.settings(), now=0.0, demo=True)
    reasons = {t["reason"] for t in state["trades"]["recent"]}
    assert reasons == {"trailing-stop", "stop-loss"}  # the demo shows a win and a loss
    assert state["trades"]["wins"] == 1
    assert state["positions"] == []
    assert state["equity"] == pytest.approx(state["cash"])


def test_demo_runs_the_real_risk_rule(demo_db):
    events = dashboard.events(demo_db, 0)["events"]
    cancelled = next(e for e in events if e["data"]["kind"] == "buy_cancelled")
    assert cancelled["symbol"] == demo.GAMMA
    assert "dealbreaker" in cancelled["message"]
    assert not any(e["data"]["kind"] == "buy" and e["symbol"] == demo.GAMMA for e in events)


def test_state_before_the_desk_has_run(tmp_path, cfg):
    state = dashboard.state(tmp_path / "missing.db", cfg, now=0.0)
    assert state["ready"] is False
    assert state["mode"] == "paper"
    assert dashboard.events(tmp_path / "missing.db", 0) == {"events": []}


def test_state_values_open_positions_from_the_last_seen_price(tmp_path, cfg):
    path, clock = tmp_path / "desk.db", Clock()
    market = FakeMarket({"SOL/USDC": breakout()})
    desk = Desk(cfg, market, PaperBroker(cfg), Store(path), clock=clock)
    desk.cycle()
    (held,) = desk.store.positions()
    market.prices["SOL/USDC"] = held.entry_price * 1.01
    desk.monitor()

    state = dashboard.state(path, cfg, clock())
    (pos,) = state["positions"]
    assert pos["last"] == pytest.approx(held.entry_price * 1.01)
    assert pos["pnl"] > 0
    assert state["equity"] == pytest.approx(state["cash"] + pos["value"])
    assert state["heartbeat"] == clock()
    assert len(state["equity_curve"]) >= 1
    assert state["busy"] == {}  # nobody is left marked as working


def test_events_are_incremental(demo_db):
    first = dashboard.events(demo_db, 0)["events"]
    assert [e["id"] for e in first] == sorted(e["id"] for e in first)
    later = dashboard.events(demo_db, first[9]["id"])["events"]
    assert later[0]["id"] == first[10]["id"]
    assert dashboard.events(demo_db, first[-1]["id"]) == {"events": []}


def test_a_new_session_gets_a_new_id(tmp_path):
    path = tmp_path / "demo.db"
    sessions = set()
    for _ in range(2):
        demo.run(path, threading.Event(), pace=0.0, loop=False)
        sessions.add(dashboard.state(path, demo.settings(), 0.0)["session"])
    assert len(sessions) == 2


def test_busy_marker_is_cleared_even_when_an_analyst_fails(cfg):
    from desk.agents.llm import AgentUnavailable

    desk = Desk(cfg, FakeMarket({}), PaperBroker(cfg), Store(":memory:"), clock=Clock())

    def fail():
        assert desk.store.get_json("busy")["agent"] == "NEWS"
        raise AgentUnavailable("errore API 500")

    assert desk._ask("NEWS", "cerca", "SOL/USDC", fail) is None
    assert desk.store.get("busy") == ""


def test_http_server_serves_the_page_and_the_api(demo_db):
    server = dashboard.serve(demo.settings(), demo_db, lambda: 123.0, port=0, demo=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with urllib.request.urlopen(base + "/") as response:
            page = response.read().decode()
            assert "default-src 'none'" in response.headers["Content-Security-Policy"]
        assert "ARGO" in page
        # Nothing is loaded from another site: no remote scripts, styles, fonts or images.
        assert not any(mark in page for mark in ('src="http', 'href="http', "@import", "url(http"))
        state = json.load(urllib.request.urlopen(base + "/api/state"))
        assert state["ready"] and state["demo"] and state["now"] == 123.0
        events = json.load(urllib.request.urlopen(base + "/api/events?after=0"))
        assert len(events["events"]) > 30
        assert json.load(urllib.request.urlopen(base + "/api/events?after=x"))["events"]
        with pytest.raises(urllib.error.HTTPError):
            urllib.request.urlopen(base + "/api/secret")
    finally:
        server.shutdown()


def test_demo_never_touches_the_network(tmp_path, monkeypatch):
    import socket

    def refuse(*args, **kwargs):
        raise AssertionError("the demo tried to open a network connection")

    monkeypatch.setattr(socket, "create_connection", refuse)
    monkeypatch.setattr(socket.socket, "connect", refuse)
    demo.run(tmp_path / "demo.db", threading.Event(), pace=0.0, loop=False)
    assert "buy" in kinds(tmp_path / "demo.db")
