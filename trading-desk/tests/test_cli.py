import argparse
import io
import os
import socket
import sys

import pytest

from desk import cli
from desk.config import Settings
from desk.instance import AlreadyRunning, claim
from desk.store import Store


def test_a_console_without_a_character_prints_a_placeholder(monkeypatch):
    raw = io.BytesIO()
    console = io.TextIOWrapper(raw, encoding="cp1252")
    monkeypatch.setattr(sys, "stdout", console)

    cli._never_crash_on_print()
    print("BTC 64000 → 66000 · però")
    console.flush()

    assert raw.getvalue().decode("cp1252") == "BTC 64000 ? 66000 · però\n"


def test_console_tweaks_do_nothing_off_windows(monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")
    cli._keep_console_responsive()


def test_only_one_desk_per_database(tmp_path):
    db = tmp_path / "data" / "desk-paper.db"
    held = claim(db)
    with pytest.raises(AlreadyRunning):
        claim(db)
    os.close(held)  # what the operating system does when the first desk exits
    os.close(claim(db))


def test_a_second_desk_points_to_the_one_already_running(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    cfg = Settings(data_dir=tmp_path / "data")
    Store(cfg.db_path).set("dashboard_url", "http://127.0.0.1:9787")
    held = claim(cfg.db_path)
    opened = []
    monkeypatch.setattr(cli.webbrowser, "open", opened.append)
    try:
        with pytest.raises(SystemExit, match="già acceso.*127.0.0.1:9787"):
            cli.trading_desk(cfg, argparse.Namespace(open=True, rules_only=True))
    finally:
        os.close(held)
    assert opened == ["http://127.0.0.1:9787"]


def test_the_dashboard_moves_when_its_port_is_taken(tmp_path, capsys):
    taken = socket.socket()
    taken.bind(("127.0.0.1", 0))
    taken.listen()
    port = taken.getsockname()[1]
    args = argparse.Namespace(host="127.0.0.1", port=port, open=False)
    try:
        server, url = cli.start_dashboard(Settings(), tmp_path / "desk.db", args)
    finally:
        taken.close()
    try:
        assert server.server_address[1] != port
        assert url == f"http://127.0.0.1:{server.server_address[1]}"
        assert f"La porta {port} non è disponibile" in capsys.readouterr().out
    finally:
        server.shutdown()
        server.server_close()
