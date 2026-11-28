"""Tests of the BingX reader: an exchange that answers with holes must not pass in silence. No network."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

import data  # noqa: E402

H = 3_600_000
START = 1_700_006_400_000  # a settlement time: 2023-11-15 00:00 UTC
SETTLEMENTS = [START + i * 8 * H for i in range(300)]  # 100 days, three a day
END = SETTLEMENTS[-1] + 1


def _exchange(monkeypatch, answer):
    """BingX replaced by `answer(asked_times, call_number)`, which chooses the rows to give back."""
    calls = []

    def get(path, params):
        asked = [t for t in SETTLEMENTS if params["startTime"] <= t <= params["endTime"]]
        calls.append(params)
        return [{"fundingTime": t, "fundingRate": "0.0001"} for t in answer(asked, len(calls))]

    monkeypatch.setattr(data, "_get", get)
    return calls


def test_funding_completo_arriva_con_una_sola_richiesta(monkeypatch):
    calls = _exchange(monkeypatch, lambda asked, n: asked)

    got = data.funding("BTC", START, END)

    assert list(got) == SETTLEMENTS
    assert len(calls) == 1


def test_funding_ripara_il_buco_quando_bingx_risponde_a_meta(monkeypatch):
    # the first answer loses twenty days in the middle; asked again, the exchange gives them
    holed = lambda asked: [t for t in asked if not 100 <= SETTLEMENTS.index(t) < 160]  # noqa: E731
    _exchange(monkeypatch, lambda asked, n: holed(asked) if n == 1 else asked)

    got = data.funding("BTC", START, END)

    assert list(got) == SETTLEMENTS


def test_funding_recupera_le_righe_tagliate_dal_limite(monkeypatch):
    # the exchange gives back only the newest 120 rows of what it is asked
    _exchange(monkeypatch, lambda asked, n: asked[-120:])

    got = data.funding("BTC", START, END)

    assert list(got) == SETTLEMENTS


def test_funding_si_ferma_con_un_errore_se_il_buco_resta(monkeypatch):
    _exchange(monkeypatch, lambda asked, n: [t for t in asked if not 100 <= SETTLEMENTS.index(t) < 160])

    with pytest.raises(data.DataError, match="funding di BTC"):
        data.funding("BTC", START, END)


def test_funding_si_ferma_con_un_errore_se_mancano_gli_ultimi_giorni(monkeypatch):
    _exchange(monkeypatch, lambda asked, n: [t for t in asked if SETTLEMENTS.index(t) < 280])

    with pytest.raises(data.DataError, match="funding di BTC"):
        data.funding("BTC", START, END)


def test_funding_di_una_moneta_quotata_dopo_parte_dal_suo_primo_giorno(monkeypatch):
    listed = SETTLEMENTS[90:]  # nothing before the listing, and that is not a hole
    _exchange(monkeypatch, lambda asked, n: [t for t in asked if t in listed])

    got = data.funding("BTC", START, END)

    assert list(got) == listed


def test_funding_di_una_moneta_senza_storia_e_vuoto(monkeypatch):
    _exchange(monkeypatch, lambda asked, n: [])

    assert data.funding("BTC", START, END) == {}
