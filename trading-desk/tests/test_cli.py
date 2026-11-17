import io
import sys

from desk import cli


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
