"""Tests of the office PC's open interest saver. No network."""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "pc-ufficio"))

import data  # noqa: E402
import salva_oi  # noqa: E402

NOW = datetime(2026, 11, 28, 18, 7, tzinfo=UTC)


def _exchange(bad: dict | None = None):
    """A BingX where every coin has 1,000,000 of open interest at price 10, except the `bad` ones."""
    bad = bad or {}

    def fetch(path, params):
        if path.endswith("/ticker"):
            return [{"symbol": salva_oi.market(c), "lastPrice": "10"} for c in salva_oi.COINS]
        coin = next(c for c in salva_oi.COINS if salva_oi.market(c) == params["symbol"])
        if isinstance(bad.get(coin), Exception):
            raise bad[coin]
        return {"openInterest": bad.get(coin, "1000000")}

    return fetch


def test_le_monete_sono_le_stesse_della_scuola():
    assert salva_oi.COINS == data.COINS
    assert salva_oi.ALIAS == data.ALIAS


def test_una_riga_ha_open_interest_e_prezzo_di_tutte_le_monete():
    row = salva_oi.snapshot(_exchange(), NOW)

    assert row["ora_utc"] == "2026-11-28 18:07:00"
    assert len(row["oi_usd"]) == 36 and row["oi_usd"]["BTC"] == 1_000_000
    assert row["prezzi"]["FTM"] == 10.0
    assert row["mancanti"] == []


def test_un_numero_sbagliato_o_un_errore_lascia_fuori_solo_quella_moneta():
    bad = {"ETH": "0", "SOL": "-5", "ADA": "nan", "XRP": None, "DOT": salva_oi.DataError("giù")}

    row = salva_oi.snapshot(_exchange(bad), NOW)

    assert row["mancanti"] == ["ETH", "SOL", "XRP", "ADA", "DOT"]
    assert "ETH" not in row["oi_usd"] and "ETH" not in row["prezzi"]
    assert len(row["oi_usd"]) == 31


def test_con_troppe_monete_senza_dati_non_si_scrive_niente():
    bad = {c: "0" for c in salva_oi.COINS[:10]}

    with pytest.raises(salva_oi.DataError, match="non scrivo niente"):
        salva_oi.snapshot(_exchange(bad), NOW)


def test_ogni_salvataggio_aggiunge_una_riga_al_file_del_mese(tmp_path):
    row = salva_oi.snapshot(_exchange(), NOW)

    first = salva_oi.append(tmp_path, row)
    salva_oi.append(tmp_path, row)

    assert first.name == "oi-2026-11.jsonl"
    lines = first.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2 and json.loads(lines[1])["oi_usd"]["BTC"] == 1_000_000
