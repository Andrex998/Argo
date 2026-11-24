"""The school's books: dollars on every market, stops and targets on hourly candles,
market hours, and the rules the students' orders must pass. No network: candles are
made up here.

Run from the repository root:  trading-desk/.venv/bin/python -m pytest fx-school -q
"""

from datetime import UTC, datetime

import pytest
import school  # pytest puts this folder on the import path
from school import Candle

# Tuesday 24/11/2026, 07:23 UTC: the hour the school day runs.
NOW = datetime(2026, 11, 24, 7, 23, tzinfo=UTC)
OPENED = "2026-11-24 07:23:00"


def state(prices=None):
    s = school.new_state("2026-11-24")
    s["prices"], s["prices_at"] = prices or {}, OPENED
    return s


def opened(s, name="macro", **order):
    prices = order.pop("prices")
    event = school.open_position(name, s["wallets"][name], order, prices, OPENED)
    assert event["event"] == "aperta", event
    return event


def hour(h, o, hi, lo, c, day=24):
    return Candle(f"2026-11-{day:02d} {h:02d}:00:00", o, hi, lo, c)


def test_one_percent_risk_is_one_percent_of_equity_at_the_stop():
    s = state()
    p = opened(s, symbol="EUR/USD", side="long", stop=1.0400, target=1.0700, prices={"EUR/USD": 1.0500})
    assert p["entry"] == pytest.approx(1.05005)  # half the spread
    assert p["units"] * (p["entry"] - 1.0400) == pytest.approx(100.0, rel=1e-4)
    gold = opened(s, symbol="XAU/USD", side="short", stop=2700.0, prices={"XAU/USD": 2650.0})
    assert gold["units"] * (2700.0 - gold["entry"]) == pytest.approx(100.0, rel=1e-4)


def test_a_dollar_pair_loses_its_risk_in_dollars_at_the_stop():
    s = state()
    p = opened(s, symbol="USD/JPY", side="long", stop=150.0, prices={"USD/JPY": 155.0})
    wallet = s["wallets"]["macro"]
    trade = school.close_position(wallet, wallet["positions"][0], 150.0 + 0.006, OPENED, "stop")
    assert trade["pnl"] == pytest.approx(-100.0, abs=0.5)
    assert wallet["cash"] == pytest.approx(10_000.0 + trade["pnl"])
    assert p["risk_usd"] == pytest.approx(100.0)


@pytest.mark.parametrize(
    ("candle", "reason", "price"),
    [
        (hour(9, 1.0500, 1.0520, 1.0390, 1.0450), "stop", 1.0400),
        (hour(9, 1.0350, 1.0380, 1.0300, 1.0320), "stop (apertura oltre lo stop)", 1.0350),
        (hour(9, 1.0500, 1.0720, 1.0480, 1.0690), "target", 1.0700),
        (hour(9, 1.0750, 1.0780, 1.0720, 1.0760), "target (apertura oltre il target)", 1.0750),
        (hour(9, 1.0500, 1.0720, 1.0390, 1.0600), "stop", 1.0400),  # both: the stop first
    ],
)
def test_candles_close_longs_at_stop_target_or_the_gap(candle, reason, price):
    s = state()
    opened(s, symbol="EUR/USD", side="long", stop=1.0400, target=1.0700, prices={"EUR/USD": 1.0500})
    later = datetime(2026, 11, 24, 12, tzinfo=UTC)
    [event] = school.mark(s, {"EUR/USD": [candle]}, later)
    assert event["exit_reason"] == reason
    assert event["exit"] == pytest.approx(price - school.MARKETS["EUR/USD"]["spread"] / 2)


def test_shorts_are_the_mirror_image():
    s = state()
    opened(s, symbol="SLV", side="short", stop=40.0, target=36.0, prices={"SLV": 38.0})
    [event] = school.mark(s, {"SLV": [hour(15, 38.0, 38.2, 35.9, 36.1)]}, NOW.replace(hour=20))
    assert event["exit_reason"] == "target" and event["pnl"] > 0
    assert event["r"] == pytest.approx(1.0, abs=0.05)


def test_the_entry_hour_and_complete_hours_are_not_looked_at_again():
    s = state()
    opened(s, symbol="EUR/USD", side="long", stop=1.0400, prices={"EUR/USD": 1.0500})
    entry_hour = hour(7, 1.0450, 1.0510, 1.0380, 1.0500)  # dipped below before the entry
    quiet = hour(8, 1.0500, 1.0550, 1.0450, 1.0520)
    assert school.mark(s, {"EUR/USD": [entry_hour, quiet]}, NOW.replace(hour=9, minute=30)) == []
    assert s["wallets"]["macro"]["positions"][0]["checked"] == "2026-11-24 08:00:00"
    forming = hour(9, 1.0520, 1.0540, 1.0480, 1.0530)  # 09:00-10:00, still forming at 09:30
    assert school.mark(s, {"EUR/USD": [quiet, forming]}, NOW.replace(hour=9, minute=30)) == []
    assert s["wallets"]["macro"]["positions"][0]["checked"] == "2026-11-24 08:00:00"
    crash = hour(9, 1.0520, 1.0540, 1.0350, 1.0360)  # the same hour, once complete
    [event] = school.mark(s, {"EUR/USD": [crash]}, NOW.replace(hour=11))
    assert event["closed"] == "2026-11-24 09:00:00"


@pytest.mark.parametrize(
    ("moment", "fx", "slv"),
    [
        (datetime(2026, 11, 24, 7, 23, tzinfo=UTC), True, False),  # Tuesday morning
        (datetime(2026, 11, 24, 15, 0, tzinfo=UTC), True, True),  # New York open
        (datetime(2026, 11, 27, 22, 30, tzinfo=UTC), False, False),  # Friday night
        (datetime(2026, 11, 28, 12, 0, tzinfo=UTC), False, False),  # Saturday
        (datetime(2026, 11, 29, 21, 0, tzinfo=UTC), False, False),  # Sunday afternoon
        (datetime(2026, 11, 29, 22, 30, tzinfo=UTC), True, False),  # Sunday night
    ],
)
def test_market_hours(moment, fx, slv):
    assert school.market_open("EUR/USD", moment) is fx
    assert school.market_open("XAU/USD", moment) is fx
    assert school.market_open("SLV", moment) is slv


@pytest.mark.parametrize(
    ("order", "why"),
    [
        ({"symbol": "BTC/USD", "side": "long", "stop": 1}, "mercato sconosciuto"),
        ({"symbol": "EUR/USD", "side": "up", "stop": 1.04}, "long o short"),
        ({"symbol": "EUR/USD", "side": "long", "stop": 1.06}, "parte sbagliata"),
        ({"symbol": "EUR/USD", "side": "long", "stop": 1.0499}, "troppo vicino"),
        ({"symbol": "EUR/USD", "side": "long", "stop": 1.04, "target": 1.03}, "target"),
        ({"symbol": "EUR/USD", "side": "long", "stop": 1.04, "risk_pct": 5}, "fuori dai limiti"),
        ({"symbol": "EUR/USD", "side": "long", "stop": "basso"}, "non sono numeri"),
    ],
)
def test_orders_that_break_the_rules_are_refused(order, why):
    s = state()
    event = school.open_position("tecnico", s["wallets"]["tecnico"], order, {"EUR/USD": 1.05}, OPENED)
    assert event["event"] == "respinto" and why in event["reason"]
    assert s["wallets"]["tecnico"]["positions"] == []


def test_leverage_is_capped_at_ten_times_equity():
    s = state()
    p = opened(s, symbol="EUR/USD", side="long", stop=1.0485, prices={"EUR/USD": 1.0500})
    assert school.notional("EUR/USD", p["units"], p["entry"]) < 10 * 10_000
    q = opened(s, symbol="GBP/USD", side="long", stop=1.2485, prices={"EUR/USD": 1.05, "GBP/USD": 1.25})
    total = sum(school.notional(x["symbol"], x["units"], x["entry"]) for x in (p, q))
    assert total == pytest.approx(10 * 10_000, rel=0.01) and q["risk_usd"] < 100


def test_four_positions_at_most_and_one_per_market():
    s = state()
    prices = {"EUR/USD": 1.05, "GBP/USD": 1.25, "AUD/USD": 0.65, "NZD/USD": 0.59, "XAU/USD": 2650.0}
    opened(s, symbol="EUR/USD", side="long", stop=1.03, prices=prices)
    again = school.open_position("macro", s["wallets"]["macro"],
                                 {"symbol": "EUR/USD", "side": "short", "stop": 1.07}, prices, OPENED)  # fmt: skip
    assert "già una posizione aperta" in again["reason"]
    for symbol, stop in (("GBP/USD", 1.23), ("AUD/USD", 0.63), ("NZD/USD", 0.57)):
        opened(s, symbol=symbol, side="long", stop=stop, prices=prices)
    fifth = school.open_position("macro", s["wallets"]["macro"],
                                 {"symbol": "XAU/USD", "side": "long", "stop": 2600.0}, prices, OPENED)  # fmt: skip
    assert "posizioni aperte, il massimo" in fifth["reason"]


def test_execute_closes_first_then_opens_at_the_prices_mark_read():
    s = state({"EUR/USD": 1.06, "XAU/USD": 2650.0})
    p = opened(s, symbol="EUR/USD", side="long", stop=1.04, prices={"EUR/USD": 1.05})
    orders = {
        "macro": [
            {"action": "open", "symbol": "XAU/USD", "side": "long", "stop": 2600.0, "reason": "tassi reali in calo"},
            {"action": "close", "id": p["id"], "reason": "BCE più dura del previsto"},
        ],
        "tecnico": [{"action": "buy"}],
    }
    events = school.execute(s, orders, NOW)
    assert [e["event"] for e in events] == ["chiusa", "aperta", "respinto"]
    assert events[0]["pnl"] > 0 and "BCE" in events[0]["exit_reason"]
    values = school.snapshot(s, s["prices"], "2026-11-24")
    assert values["tecnico"] == 10_000.0 and values["macro"] > 10_000.0


def test_no_orders_on_old_prices_or_on_a_closed_market():
    s = state({"EUR/USD": 1.05})
    s["prices_at"] = "2026-11-24 01:00:00"  # six hours before NOW
    [event] = school.execute(s, {"macro": [{"action": "open"}]}, NOW)
    assert "prezzi vecchi" in event["reason"]
    s["prices_at"] = "2026-11-28 11:00:00"
    saturday = datetime(2026, 11, 28, 12, 0, tzinfo=UTC)
    order = {"action": "open", "symbol": "EUR/USD", "side": "long", "stop": 1.04}
    [event] = school.execute(s, {"macro": [order]}, saturday)
    assert event["event"] == "respinto" and "mercato chiuso" in event["reason"]


def test_an_slv_order_waits_for_new_york_and_fills_at_the_first_open():
    s = state({"SLV": 38.0, "EUR/USD": 1.05})
    order = {"action": "open", "symbol": "SLV", "side": "long", "stop": 36.0, "reason": "domanda solare"}
    [event] = school.execute(s, {"tecnico": [order]}, NOW)  # 07:23 UTC: New York is closed
    assert event["event"] == "in attesa" and s["wallets"]["tecnico"]["positions"] == []
    session = [hour(14, 38.5, 38.9, 38.4, 38.8), hour(15, 38.8, 39.0, 38.6, 38.9)]
    later = datetime(2026, 11, 25, 7, 23, tzinfo=UTC)
    [filled] = school.mark(s, {"SLV": session}, later)
    assert filled["event"] == "aperta" and filled["opened"] == "2026-11-24 14:00:00"
    assert filled["entry"] == pytest.approx(38.5 + 0.01)  # the first open, plus half the spread
    assert s["wallets"]["tecnico"]["pending"] == []
    # the 15:00 candle, complete, was then checked against the stop
    assert s["wallets"]["tecnico"]["positions"][0]["checked"] == "2026-11-24 15:00:00"


@pytest.mark.parametrize(
    ("moment", "fx", "slv"),
    [
        (datetime(2026, 11, 26, 15, 0, tzinfo=UTC), True, False),  # Thanksgiving: New York shut
        (datetime(2026, 12, 25, 9, 0, tzinfo=UTC), False, False),  # Christmas
        (datetime(2027, 1, 1, 15, 0, tzinfo=UTC), False, False),  # New Year's Day
    ],
)
def test_holidays(moment, fx, slv):
    assert school.market_open("XAU/USD", moment) is fx
    assert school.market_open("SLV", moment) is slv


def test_the_picture_of_a_market_on_daily_candles():
    # 300 days rising by 1 a day from 100, each day ranging 2 around its close
    days = [Candle(f"day-{i:03d} 00:00:00", 100 + i - 0.5, 100 + i + 1, 100 + i - 1, 100 + i)
            for i in range(300)]  # fmt: skip
    row = school.picture({"XAU/USD": days}, "2026-11-24")["XAU/USD"]
    assert row["prezzo"] == 399
    assert row["variazione_pct"]["1g"] == pytest.approx((399 / 398 - 1) * 100, abs=0.01)
    assert row["variazione_pct"]["250g"] == pytest.approx((399 / 149 - 1) * 100, abs=0.01)
    assert row["atr14"] == pytest.approx(2.0)  # the range, wider than the move from the last close
    assert row["media50"] == pytest.approx(374.5) and row["distanza_media50_pct"] > 0
    assert row["max_20g"] == 400 and row["min_20g"] == 379
