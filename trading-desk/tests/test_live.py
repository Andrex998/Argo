import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from desk import cli, demo, live
from desk.config import Settings
from tests.conftest import quiet
from tests.test_desk import SYMBOL, journal, make_desk


class Database:
    """A stand-in for Supabase's RPC endpoint that records what it is sent."""

    def __init__(self, status=200):
        self.status = status
        self.requests: list[tuple[str, dict, dict]] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                headers = {
                    k.lower(): v for k, v in self.headers.items()
                }  # names are case-insensitive
                outer.requests.append((self.path, headers, body))
                self.send_response(outer.status)
                self.end_headers()
                self.wfile.write(b"" if outer.status < 300 else b'{"message":"token non valido"}')

            def log_message(self, *args):
                pass

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def close(self):
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def database():
    db = Database()
    yield db
    db.close()


def settings(url, **overrides):
    return Settings(
        _env_file=None, live_url=url, live_key="chiave-pubblica", live_token="segreto", **overrides
    )


def test_nothing_is_sent_unless_all_three_settings_are_there():
    assert not live.Publisher.configured(Settings(_env_file=None))
    assert not live.Publisher.configured(Settings(_env_file=None, live_url="https://x.supabase.co"))
    assert live.Publisher.configured(settings("https://x.supabase.co"))


def test_a_snapshot_reaches_the_database_with_its_token(tmp_path, database):
    db = tmp_path / "demo.db"
    demo.run(db, threading.Event(), pace=0.0, loop=False)
    publisher = live.Publisher(settings(database.url + "/"), db)

    assert publisher.publish(now=1_800_000_000.0) == ""

    [(path, headers, body)] = database.requests
    assert path == "/rest/v1/rpc/pcdesk_publish"
    assert headers["apikey"] == "chiave-pubblica"
    assert headers["authorization"] == "Bearer chiave-pubblica"
    assert body["token"] == "segreto"
    assert set(body["docs"]) == {"account", "feed", "curve", "book"}
    assert body["docs"]["account"]["ready"] is True


def test_a_refusal_and_a_dead_line_are_reported_in_words(tmp_path):
    refusing = Database(status=401)
    try:
        error = live.Publisher(settings(refusing.url), tmp_path / "none.db").publish(1.0)
    finally:
        refusing.close()
    assert error.startswith("risposta 401") and "token non valido" in error

    dead = live.Publisher(settings("http://127.0.0.1:9"), tmp_path / "none.db", timeout=2)
    assert dead.publish(1.0).startswith("database non raggiungibile")


def test_the_journal_hears_of_trouble_once_and_of_the_recovery(cfg, tmp_path):
    desk, _, _ = make_desk(cfg, {SYMBOL: quiet()})
    answers = iter(["database non raggiungibile (x)", "database non raggiungibile (y)", ""])

    class Flaky:
        failing = ""

        def publish(self, now):
            return next(answers)

    flaky = Flaky()
    for _ in range(3):
        cli.publish(desk, flaky, now=1.0)
    text = journal(desk)
    assert text.count("pagina live non aggiornata") == 1
    assert "pagina live di nuovo aggiornata" in text
    assert flaky.failing == ""


def test_a_broken_snapshot_never_stops_the_desk(cfg):
    desk, _, _ = make_desk(cfg, {SYMBOL: quiet()})

    class Broken:
        failing = ""

        def publish(self, now):
            raise RuntimeError("disco pieno")

    broken = Broken()
    cli.publish(desk, broken, now=1.0)
    assert "fotografia non riuscita (disco pieno)" in journal(desk)
