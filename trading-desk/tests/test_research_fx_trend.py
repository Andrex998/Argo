"""research/fx_trend.py, exam E11: the signal, the weights and their caps, the 25% band,
the costs, the placebo and the four criteria, on made-up prices (no network)."""

import math
import random
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "research"))

import fx_trend  # noqa: E402  research/fx_trend.py


def weekdays(n, start=date(2020, 1, 6)):  # a Monday
    out, d = [], start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def book(rows, price=None, moves=None, markets=("EUR/USD",)):
    """A Book by hand: `rows` are the Fridays' targets by calendar index."""
    n = len(next(iter(price.values()))) if price else 1 + max(rows)
    price = price or {m: [1.0] * n for m in markets}
    moves = moves or {m: [0.0] * n for m in markets}
    return fx_trend.Book(
        days=weekdays(n),
        markets=list(markets),
        price=price,
        move=moves,
        plan=rows,
        ready={i: len(markets) for i in rows},
        start=min(rows),
    )


# --- the signal ---------------------------------------------------------------------------


def test_signal_is_the_average_sign_of_five_lags():
    rising = [100.0 + i for i in range(100)]
    assert fx_trend.signal(rising, 79) is None  # 80 days back are needed
    assert fx_trend.signal(rising, 80) == 1.0
    assert fx_trend.signal([200.0 - i for i in range(100)], 99) == -1.0
    # Up for 70 days, then down for 10: the 5, 10, 20 and 40-day returns are negative,
    # the 80-day one is positive.
    mixed = [100.0 + k for k in range(71)] + [170.0 - 4 * j for j in range(1, 11)]
    assert fx_trend.signal(mixed, 80) == pytest.approx(-0.6)
    assert fx_trend.signal([50.0] * 100, 99) == 0.0  # no change is no sign


def test_vol60_is_yearly_over_260_trading_days():
    closes = [100.0]
    for k in range(80):
        closes.append(closes[-1] * (1.01 if k % 2 == 0 else 0.99))
    assert fx_trend.vol60(closes, 59) is None
    assert fx_trend.vol60(closes, 80) == pytest.approx(0.01 * math.sqrt(260))


# --- the weights and the caps --------------------------------------------------------------


def test_weights_share_ten_percent_among_n_markets():
    w = fx_trend.weights({"EUR/USD": (1.0, 0.08), "SLV": (-0.6, 0.30)}, 9)
    assert w["EUR/USD"] == pytest.approx(0.10 / 9 / 0.08)
    assert w["SLV"] == pytest.approx(-0.6 * 0.10 / 9 / 0.30)
    assert fx_trend.weights({"SLV": (-0.6, 0.30)}, 1)["SLV"] == pytest.approx(-0.2)
    assert fx_trend.weights({"EUR/USD": (0.2, 0.0)}, 1)["EUR/USD"] == 0.0  # no volatility


def test_half_the_capital_on_a_market_and_three_times_in_all():
    assert fx_trend.weights({"EUR/USD": (1.0, 0.05)}, 1)["EUR/USD"] == 0.5
    assert fx_trend.weights({"EUR/USD": (-1.0, 0.05)}, 1)["EUR/USD"] == -0.5
    nine = {f"M{k}": (1.0 if k % 2 else -1.0, 0.001) for k in range(9)}
    w = fx_trend.weights(nine, 9)  # each would be 11x: clipped to 0.5, then 4.5 scaled to 3
    assert sum(abs(x) for x in w.values()) == pytest.approx(3.0)
    assert all(abs(x) == pytest.approx(1 / 3) for x in w.values())
    assert w["M1"] > 0 > w["M0"]


# --- the band ------------------------------------------------------------------------------


def test_a_weight_changes_only_beyond_25_percent_of_the_one_held():
    assert not fx_trend.changes(0.12, 0.10)
    assert not fx_trend.changes(0.08, 0.10)
    assert fx_trend.changes(0.13, 0.10)
    assert fx_trend.changes(0.07, 0.10)
    assert fx_trend.changes(0.10, 0.0)  # entering
    assert fx_trend.changes(0.0, 0.10)  # leaving
    assert fx_trend.changes(-0.10, 0.10)  # turning around
    assert not fx_trend.changes(0.0, 0.0)


def test_the_band_in_the_portfolio():
    held = fx_trend.simulate(book({0: [("EUR/USD", 0.10)], 1: [("EUR/USD", 0.12)]}))
    assert held["trades"] == 1  # +20%: inside the band
    moved = fx_trend.simulate(book({0: [("EUR/USD", 0.10)], 1: [("EUR/USD", 0.13)]}))
    assert moved["trades"] == 2  # +30%: outside
    # The weight held is today's: a price that doubles doubles it, and the same target
    # is then far away.
    drift = book(
        {0: [("EUR/USD", 0.10)], 2: [("EUR/USD", 0.10)]},
        price={"EUR/USD": [1.0, 2.0, 2.0]},
        moves={"EUR/USD": [0.0, 1.0, 0.0]},
    )
    assert fx_trend.simulate(drift)["trades"] == 2


# --- the money and the costs -------------------------------------------------------------


def test_costs_are_the_spread_plus_as_much_slippage():
    assert fx_trend.cost("EUR/USD", 10_000, 1.10) == pytest.approx(2.0)  # 2 x 0.0001
    assert fx_trend.cost("USD/JPY", 10_000, 150.0) == pytest.approx(1.6)  # 2 x 0.012 yen
    assert fx_trend.cost("XAU/USD", 2, 2000.0) == pytest.approx(1.6)  # 2 x 0.40
    assert fx_trend.cost("SLV", -100, 30.0) == pytest.approx(4.0)  # selling costs too


def test_a_known_change_pays_its_cost_and_gains_its_move():
    # 10% of 10,000 $ in EUR/USD at 1.25: 800 euros, 0.16 $ to buy them.
    b = book(
        {0: [("EUR/USD", 0.10)]},
        price={"EUR/USD": [1.25, 1.30]},
        moves={"EUR/USD": [0.0, 0.05]},
    )
    run = fx_trend.simulate(b)
    assert run["units"]["EUR/USD"] == pytest.approx(800.0)
    assert run["curve"][0] == pytest.approx(10_000 - 0.16)
    assert run["curve"][1] == pytest.approx(10_000 - 0.16 + 800 * 0.05)


def test_dollar_pairs_hold_dollars_and_gain_the_move_over_the_price():
    days = weekdays(130)
    up = [(d, 150.0 + i) for i, d in enumerate(days)]
    b = fx_trend.build({"USD/JPY": up})
    i = days.index("2020-01-08")
    assert b.move["USD/JPY"][i] == pytest.approx(1.0 / up[i][1])


# --- which markets count, and when -------------------------------------------------------


def test_a_market_counts_from_its_120th_candle():
    days = weekdays(200)
    old = [(d, 1.0 + 0.001 * i) for i, d in enumerate(days)]
    young = [(d, 2.0 - 0.001 * i) for i, d in enumerate(days[90:])]  # 110 candles at the end
    b = fx_trend.build({"EUR/USD": old, "GBP/USD": young})
    first = b.days[b.start]
    assert date.fromisoformat(first).weekday() == 4
    assert days.index(first) >= 119  # EUR/USD's 120th candle
    assert all(b.ready[i] == 1 for i in b.plan)  # GBP/USD never has 120
    assert all(m == "EUR/USD" for row in b.plan.values() for m, _ in row)
    w = dict(b.plan[b.start])["EUR/USD"]
    assert w > 0  # a rising market is held long


# --- the placebo -------------------------------------------------------------------------


def test_the_placebo_keeps_the_absolute_weights_and_draws_the_signs():
    row = [("EUR/USD", 0.10), ("SLV", -0.05), ("XAU/USD", 0.0)]
    rng = random.Random(1)
    draws = [fx_trend.coin_signs(row, rng) for _ in range(200)]
    for d in draws:
        assert [(m, abs(w)) for m, w in d] == [(m, abs(w)) for m, w in row]
    signs = {w > 0 for d in draws for m, w in d if m == "EUR/USD"}
    assert signs == {True, False}

    markets = ("EUR/USD", "SLV")
    b = book(
        {0: [("EUR/USD", 0.10), ("SLV", -0.05)]},
        price={"EUR/USD": [1.0], "SLV": [30.0]},
        moves={"EUR/USD": [0.0], "SLV": [0.0]},
        markets=markets,
    )
    real = fx_trend.simulate(b)["units"]
    for seed in range(10):
        fake = fx_trend.simulate(b, random.Random(seed))["units"]
        assert {m: abs(q) for m, q in fake.items()} == pytest.approx(
            {m: abs(q) for m, q in real.items()}
        )


# --- the measures and the four criteria -------------------------------------------------


def test_calendar_years_and_the_complete_ones():
    rets = [("2019-12-30", 0.01), ("2020-03-02", 0.10), ("2020-12-31", -0.05),
            ("2021-06-01", 0.02), ("2022-01-03", 0.0)]  # fmt: skip
    years, complete = fx_trend.calendar_years(rets)
    assert years["2020"] == pytest.approx(1.10 * 0.95 - 1)
    assert complete == ["2020", "2021"]


def test_figures_on_a_known_path():
    f = fx_trend.figures([("2020-01-01", 0.10), ("2020-01-02", -0.20), ("2020-01-03", 0.05)])
    assert f["ret"] == pytest.approx(1.1 * 0.8 * 1.05 - 1)
    assert f["dd"] == pytest.approx(0.20)


def test_the_four_criteria():
    years = {str(y): 0.01 if y % 5 else -0.01 for y in range(2008, 2026)}  # 14 of 18 up
    complete = list(years)
    placebo = [k / 1000 for k in range(1000)]  # its 95th percentile is 0.95
    ok = fx_trend.criteria(0.96, years, complete, placebo, 0.02, 0.01)
    assert ok["passa"]
    assert not fx_trend.criteria(0.94, years, complete, placebo, 0.02, 0.01)["2 placebo"]
    assert not fx_trend.criteria(0.96, years, complete, placebo, -0.01, 0.01)["passa"]
    assert not fx_trend.criteria(0.96, years, complete, placebo, 0.02, -0.01)["passa"]
    few = {y: (0.01 if int(y) % 2 else -0.01) for y in years}  # 9 of 18: under 60%
    assert not fx_trend.criteria(0.96, few, complete, placebo, 0.02, 0.01)["1 rendimento"]
    low = [k / 10_000 for k in range(1000)]
    assert not fx_trend.criteria(0.29, years, complete, low, 0.02, 0.01)["1 rendimento"]


def test_five_years_before():
    assert fx_trend.years_before("2026-11-24", 5) == "2021-11-24"
    assert fx_trend.years_before("2024-02-29", 5) == "2019-02-28"
