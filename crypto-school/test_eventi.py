"""Tests of the event study: what prices did after a list of dated events. No network."""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import eventi  # noqa: E402


def _days(n: int, first: str = "2025-01-01") -> list[str]:
    d0 = date.fromisoformat(first)
    return [(d0 + timedelta(days=i)).isoformat() for i in range(n)]


def test_rendimento_in_avanti_parte_dalla_chiusura_del_giorno_dell_evento():
    closes = dict(zip(_days(4), [100.0, 110.0, 121.0, 60.5], strict=True))

    got = eventi.forward(closes, "2025-01-02", 1)

    assert round(got, 6) == 10.0  # from 110 to 121, not from 100


def test_evento_senza_abbastanza_giorni_dopo_viene_saltato_e_contato():
    closes = dict(zip(_days(5), [100.0, 101.0, 102.0, 103.0, 104.0], strict=True))

    got = eventi.study(closes, ["2025-01-02", "2025-01-05", "2030-01-01"], horizons=(1,), draws=10)

    assert got["1"]["n"] == 1
    assert got["1"]["saltati"] == 2


def test_giorni_di_crollo_sono_quelli_con_la_chiusura_sotto_la_soglia():
    closes = dict(zip(_days(4), [100.0, 94.0, 93.0, 99.0], strict=True))

    got = eventi.price_events(closes, -5.0)

    assert got == ["2025-01-02"]  # −6%; −1,06% and +6,45% are not drops


def test_un_effetto_vero_esce_con_una_differenza_positiva_e_un_p_piccolo():
    days, closes, price, events = _days(400), {}, 100.0, []
    for i, d in enumerate(days):
        if i % 20 == 1:  # the day after each event the price jumps 4%
            price *= 1.04
        closes[d] = price
        if i % 20 == 0 and i + 1 < len(days):
            events.append(d)

    got = eventi.study(closes, events, horizons=(1,), draws=500)["1"]

    assert got["differenza_pct"] > 3.0
    assert got["p"] < 0.05


def test_eventi_senza_effetto_non_risultano_significativi():
    days = _days(400)
    closes = {d: 100.0 * (1.01 if i % 2 else 1.0) for i, d in enumerate(days)}  # a flat zigzag

    got = eventi.study(closes, days[10:390:7], horizons=(2,), draws=500)["2"]  # two days on: always 0%

    assert abs(got["differenza_pct"]) < 0.01
    assert got["p"] > 0.5


def test_il_netto_toglie_i_costi_di_andata_e_ritorno():
    closes = dict(zip(_days(3), [100.0, 100.0, 101.0], strict=True))

    got = eventi.study(closes, ["2025-01-02"], horizons=(1,), draws=10)["1"]

    assert round(got["media_pct"], 6) == 1.0
    assert round(got["netto_long_pct"], 6) == round(1.0 - eventi.ROUND_TRIP_PCT, 6)
