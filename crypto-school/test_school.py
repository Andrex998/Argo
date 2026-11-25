"""Tests of the crypto class's engine, without the network.

From trading-desk/:  uv run --frozen pytest ../crypto-school/test_school.py -q
"""

from __future__ import annotations

import json
import random
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from desk.models import Candle  # noqa: E402

import data  # noqa: E402
import gym  # noqa: E402
import judgment  # noqa: E402
import picture  # noqa: E402
import rules  # noqa: E402
import school  # noqa: E402

H = 3_600_000
DAY = rules.DAY_MS
NOW = datetime(2026, 11, 26, 6, 0, tzinfo=UTC)


def at(moment: str) -> int:
    return judgment.ms(moment)


def state_with(prices: dict[str, float] | None = None) -> dict:
    s = judgment.new_state("2026-11-26")
    s["prices"] = prices or {"BTC": 60_000.0, "ETH": 2_000.0, "SOL": 100.0, "XRP": 1.0, "ADA": 0.5}
    return s


def open_long(s: dict, name: str = "falco", symbol: str = "SOL", stop: float = 95.0, risk: float = 1.0, **extra):
    order = {"action": "open", "symbol": symbol, "side": "long", "stop": stop, "risk_pct": risk, **extra}
    return judgment.execute(s, {name: [order]}, s["prices"], NOW)[0]


# --- the judgment wallets ---------------------------------------------------------------------


def test_new_state_has_four_wallets_of_ten_thousand():
    s = judgment.new_state("2026-11-26")
    assert list(s["wallets"]) == ["falco", "tartaruga", "spazzino", "ragioniere"]
    assert all(w["cash"] == 10_000 and w["max_risk_pct"] == 2.0 for w in s["wallets"].values())


def test_open_sizes_the_loss_at_the_stop_costs_included():
    s = state_with()
    e = open_long(s)
    assert e["event"] == "aperta" and e["id"] == "falco-1"
    p = s["wallets"]["falco"]["positions"][0]
    loss_at_stop = p["units"] * (100 - 95) + p["units"] * (100 + 95) * judgment.COST
    assert loss_at_stop == pytest.approx(100.0, rel=0.01)  # 1% of 10,000
    assert s["wallets"]["falco"]["cash"] == pytest.approx(10_000 - p["units"] * 100 * judgment.COST)
    assert p["checked"] == p["funded"] == p["opened"] == "2026-11-26 06:00:00"


@pytest.mark.parametrize(
    ("order", "why"),
    [
        ({"symbol": "PEPE", "side": "long", "stop": 1}, "moneta sconosciuta"),
        ({"symbol": "SOL", "side": "up", "stop": 95}, "long o short"),
        ({"symbol": "SOL", "side": "long", "stop": 105}, "parte sbagliata"),
        ({"symbol": "SOL", "side": "short", "stop": 95}, "parte sbagliata"),
        ({"symbol": "SOL", "side": "long", "stop": 99.5}, "tra 1% e 25%"),
        ({"symbol": "SOL", "side": "long", "stop": 70}, "tra 1% e 25%"),
        ({"symbol": "SOL", "side": "long", "stop": 95, "risk_pct": 2.5}, "fuori dai limiti"),
        ({"symbol": "SOL", "side": "long", "stop": 95, "risk_pct": 0}, "fuori dai limiti"),
        ({"symbol": "SOL", "side": "long", "stop": 95, "target": 90}, "target"),
        ({"symbol": "SOL", "side": "long", "stop": "basso"}, "non sono numeri"),
        ({"symbol": "SOL", "side": "long"}, "non sono numeri"),
    ],
)
def test_orders_outside_the_rules_are_refused(order, why):
    s = state_with()
    e = judgment.execute(s, {"falco": [{"action": "open", **order}]}, s["prices"], NOW)[0]
    assert e["event"] == "respinto" and why in e["reason"]
    assert s["wallets"]["falco"]["positions"] == [] and s["wallets"]["falco"]["cash"] == 10_000


def test_one_position_per_coin_and_at_most_four():
    s = state_with()
    assert open_long(s)["event"] == "aperta"
    assert "già una posizione" in open_long(s)["reason"]
    for coin, stop in (("BTC", 54_000), ("ETH", 1_800), ("XRP", 0.9)):
        assert open_long(s, symbol=coin, stop=stop)["event"] == "aperta"
    assert "il massimo" in open_long(s, symbol="ADA", stop=0.45)["reason"]


def test_positions_together_stay_under_three_times_the_wallet():
    s = state_with()
    open_long(s, symbol="BTC", stop=59_000, risk=2)  # 1.67% away: about 1.07 times the wallet
    open_long(s, symbol="ETH", stop=1_970, risk=2)  # 1.5% away: would be about 1.1 times
    e = open_long(s, symbol="SOL", stop=99, risk=2)  # 1% away: would be about 1.5 times, cut to fit
    assert e["event"] == "aperta" and e["risk_usd"] < 200
    worth = sum(p["units"] * s["prices"][p["symbol"]] for p in s["wallets"]["falco"]["positions"])
    assert worth == pytest.approx(3 * judgment.equity(s["wallets"]["falco"], s["prices"]), rel=0.001)
    assert "3 volte" in open_long(s, symbol="XRP", stop=0.98, risk=1)["reason"]


def test_the_guardiano_halves_the_most_on_panic_days_only_today():
    s = state_with()
    s["market"] = {"day": "2026-11-26", "panic": True, "fragile": None}
    e = open_long(s, risk=1.5)
    assert e["event"] == "respinto" and "panico" in e["reason"]
    assert open_long(s, risk=1.0)["event"] == "aperta"
    s = state_with()
    s["market"] = {"day": "2026-11-25", "panic": True, "fragile": None}
    assert open_long(s, risk=1.5)["event"] == "aperta"
    s = state_with()
    s["market"] = {"day": "2026-11-26", "panic": False, "fragile": True}
    assert "FRAGILE" in open_long(s, risk=1.5)["reason"]


def test_the_preside_can_lower_an_agents_most():
    s = state_with()
    judgment.set_limit(s, "falco", 0.5)
    assert "Preside" in open_long(s, risk=1.0)["reason"]
    assert open_long(s, risk=0.5)["event"] == "aperta"
    with pytest.raises(ValueError):
        judgment.set_limit(s, "falco", 3)
    with pytest.raises(ValueError):
        judgment.set_limit(s, "cronista", 1)


def test_closing_books_price_costs_and_funding():
    s = state_with()
    open_long(s)
    p = s["wallets"]["falco"]["positions"][0]
    p["funding"] = 2.0  # paid at a settlement, already taken from the cash
    s["wallets"]["falco"]["cash"] -= 2.0
    prices = {**s["prices"], "SOL": 110.0}
    e = judgment.execute(s, {"falco": [{"action": "close", "id": "falco-1", "reason": "basta"}]}, prices, NOW)[0]
    assert e["event"] == "chiusa" and e["exit"] == 110.0 and "basta" in e["exit_reason"]
    costs = p["units"] * (100 + 110) * judgment.COST
    assert e["pnl"] == pytest.approx(p["units"] * 10 - costs - 2.0, abs=0.01)
    assert s["wallets"]["falco"]["cash"] == pytest.approx(10_000 + e["pnl"], abs=0.01)
    assert e["r"] == pytest.approx(e["pnl"] / p["risk_usd"], abs=0.01)
    assert judgment.execute(s, {"falco": [{"action": "close", "id": "falco-1"}]}, prices, NOW)[0]["event"] == "respinto"


def test_closes_go_before_opens_and_unknown_actions_are_refused():
    s = state_with()
    open_long(s)
    orders = {"falco": [{"action": "open", "symbol": "SOL", "side": "short", "stop": 105},
                        {"action": "close", "id": "falco-1"}, {"action": "buy"}]}  # fmt: skip
    events = judgment.execute(s, orders, s["prices"], NOW)
    assert [e["event"] for e in events] == ["chiusa", "aperta", "respinto"]


def candle(moment: str, o: float, h: float, low: float, c: float) -> Candle:
    return Candle(at(moment), o, h, low, c, 1.0)


def test_mark_skips_the_opening_candle_and_closes_at_the_stop():
    s = state_with()
    open_long(s)  # at 06:00:00, stop 95
    candles = {"SOL": [candle("2026-11-26 06:00:00", 100, 101, 90, 100),  # the candle it opened in
                       candle("2026-11-26 07:00:00", 100, 102, 98, 99),
                       candle("2026-11-26 08:00:00", 99, 99, 94, 95)]}  # fmt: skip
    events = judgment.mark(s, candles, {})
    assert len(events) == 1 and events[0]["exit_reason"] == "stop" and events[0]["exit"] == 95
    assert events[0]["closed"] == "2026-11-26 08:00:00"
    assert events[0]["r"] == pytest.approx(-1.0, abs=0.02)


def test_mark_fills_a_jump_past_the_stop_at_the_open_and_puts_the_stop_first():
    s = state_with()
    open_long(s, target=110)
    e = judgment.mark(s, {"SOL": [candle("2026-11-26 07:00:00", 93, 96, 92, 95)]}, {})[0]
    assert e["exit_reason"].startswith("stop (apertura") and e["exit"] == 93
    s = state_with()
    open_long(s, target=110)
    e = judgment.mark(s, {"SOL": [candle("2026-11-26 07:00:00", 100, 111, 94, 100)]}, {})[0]
    assert e["exit_reason"] == "stop"


def test_mark_reaches_the_target_and_remembers_what_it_checked():
    s = state_with()
    open_long(s, target=110)
    quiet = [candle("2026-11-26 07:00:00", 100, 105, 97, 104)]
    assert judgment.mark(s, {"SOL": quiet}, {}) == []
    assert s["wallets"]["falco"]["positions"][0]["checked"] == "2026-11-26 07:00:00"
    later = [*quiet, candle("2026-11-26 08:00:00", 104, 112, 103, 111)]
    e = judgment.mark(s, {"SOL": later}, {})[0]
    assert e["exit_reason"] == "target" and e["exit"] == 110


def test_funding_is_paid_at_each_settlement_once():
    s = state_with()
    open_long(s)
    order = {"action": "open", "symbol": "ETH", "side": "short", "stop": 2_100, "risk_pct": 1}
    judgment.execute(s, {"tartaruga": [order]}, s["prices"], NOW)
    rates = {"SOL": {at("2026-11-26 06:00:00"): 0.01, at("2026-11-26 08:00:00"): 0.0001},
             "ETH": {at("2026-11-26 08:00:00"): 0.0002}}  # fmt: skip
    candles = {"SOL": [candle("2026-11-26 07:00:00", 100, 101, 99, 100),
                       candle("2026-11-26 08:00:00", 102, 103, 101, 102)],
               "ETH": [candle("2026-11-26 08:00:00", 2_000, 2_010, 1_990, 2_000)]}  # fmt: skip
    sol = s["wallets"]["falco"]["positions"][0]
    eth = s["wallets"]["tartaruga"]["positions"][0]
    cash_sol, cash_eth = s["wallets"]["falco"]["cash"], s["wallets"]["tartaruga"]["cash"]
    judgment.mark(s, candles, rates)
    assert sol["funding"] == pytest.approx(sol["units"] * 102 * 0.0001)  # not the 06:00 one, before it opened
    assert s["wallets"]["falco"]["cash"] == pytest.approx(cash_sol - sol["funding"])
    assert eth["funding"] == pytest.approx(-eth["units"] * 2_000 * 0.0002)  # the short earns it
    assert s["wallets"]["tartaruga"]["cash"] == pytest.approx(cash_eth - eth["funding"])
    judgment.mark(s, candles, rates)
    assert sol["funding"] == pytest.approx(sol["units"] * 102 * 0.0001)


def test_snapshot_keeps_one_value_a_day():
    s = state_with()
    judgment.snapshot(s, "2026-11-26")
    open_long(s)
    values = judgment.snapshot(s, "2026-11-26")
    assert [e["date"] for e in s["wallets"]["falco"]["equity"]] == ["2026-11-26"]
    assert values["falco"] < 10_000 and values["spazzino"] == 10_000


# --- predictions --------------------------------------------------------------------------------


def test_predictions_are_scored_on_the_deadlines_close():
    preds = [
        {"mercato": "BTC", "direzione": "sopra", "livello": 60_000, "scadenza": "2026-11-28",
         "probabilita": 0.7, "fatta": "2026-11-26"},
        {"mercato": "eth", "direzione": "sotto", "livello": 2_000, "scadenza": "2026-11-28",
         "probabilita": 0.6, "fatta": "2026-11-26"},
        {"mercato": "SOL", "direzione": "sopra", "livello": 100, "scadenza": "2026-11-30",
         "probabilita": 0.8, "fatta": "2026-11-26"},
        {"mercato": "DOGE", "direzione": "sopra", "livello": 1, "scadenza": "2026-11-28", "probabilita": 0.6},
        {"mercato": "BTC", "direzione": "sopra", "livello": 1, "scadenza": "2026-11-28", "probabilita": 0.4},
    ]  # fmt: skip
    closes = {"BTC": {"2026-11-28": 61_000.0}, "ETH": {"2026-11-28": 2_100.0}, "SOL": {"2026-11-30": 120.0}}
    scored = judgment.verify(preds, closes, "2026-11-30")
    assert [p["esito"] for p in scored] == [1, 0]
    assert preds[0]["brier"] == pytest.approx(0.09) and preds[1]["brier"] == pytest.approx(0.36)
    assert preds[2].get("stato", "aperta") == "aperta"  # its day is not over yet
    assert preds[3]["stato"] == preds[4]["stato"] == "non valida"
    cal = judgment.calibration(preds)
    assert cal["n"] == 2 and cal["successi"] == 0.5 and cal["eccesso_di_sicurezza"] == pytest.approx(0.15)
    assert judgment.calibration([])["brier"] is None


# --- the picture and the Guardiano's numbers ------------------------------------------------------


def walk(seed: int, days: int, start: str = "2025-08-01", drift: float = 0.0) -> list[Candle]:
    rng, price, out = random.Random(seed), 100.0 + seed, []
    t0 = rules.ms_of(start)
    for i in range(days):
        o = price
        price *= 1 + drift + rng.gauss(0, 0.03)
        out.append(Candle(t0 + i * DAY, o, max(o, price) * 1.01, min(o, price) * 0.99, price, 1_000 + 10 * seed))
    return out


def market(days: int = 480, coins: int = 12) -> tuple[dict, dict]:
    names = ["BTC", *data.COINS[1:coins]]
    daily = {data.pair(c): walk(i, days) for i, c in enumerate(names)}
    t0 = rules.ms_of("2025-08-01")
    rates = {data.pair(c): {t0 + k * 8 * H: 0.0001 + 0.00001 * i for k in range(days * 3)} for i, c in enumerate(names)}
    return daily, rates


def test_heat_is_the_median_excess_over_the_base():
    t0 = rules.ms_of("2026-01-01")
    rates = {f"C{i}": {t0 + k * 8 * H: 0.0001 + i * 0.00001 for k in range(60)} for i in range(11)}
    out = picture.heat(rates, ["2026-01-10", "2026-01-03"])
    assert out["2026-01-10"] == pytest.approx(0.00005)  # the median coin pays 0.015% every 8 hours
    assert "2026-01-03" not in out  # not 7 days of funding yet


def test_picture_and_risk_on_a_quiet_market():
    daily, rates = market()
    today = rules.day_of(daily["BTC/USDT"][-1].ts + DAY)
    pic = picture.picture(daily, rates, {}, {"BTC": 1.0}, today)
    assert pic["giorno"] == rules.day_of(daily["BTC/USDT"][-1].ts) and len(pic["monete"]) == 12
    btc = pic["monete"]["BTC"]
    assert btc["beta_btc"] == pytest.approx(1.0) and btc["corr_btc"] == pytest.approx(1.0)
    assert btc["funding_7g_pct"] == pytest.approx(0.21) and btc["oi_mln"] is None
    assert sorted(c["rango_volume"] for c in pic["monete"].values()) == list(range(1, 13))
    m = pic["mercato"]
    assert m["fragile"] is None and m["cascata"] is None and m["caldo_pct"] is not None
    s = state_with()
    open_long(s)
    numbers = picture.risk(s, {}, pic)
    assert set(numbers["portafogli"]) == {f"{a}_{k}" for a in judgment.AGENTS for k in ("giudizio", "regole")}
    falco = numbers["portafogli"]["falco_giudizio"]
    assert falco["posizioni"] == 1 and falco["rischio_long_pct"] == pytest.approx(1.0, abs=0.05)
    assert numbers["confronto"]["falco"]["differenza"] < 0  # the entry's cost
    assert any("FRAGILE non misurabile" in n for n in numbers["note"])


def test_fragile_and_the_cascade_from_the_schools_record():
    daily, rates = market()
    last = daily["BTC/USDT"][-1].ts
    today = rules.day_of(last + DAY)
    for r in rates.values():  # the last week's funding two and a half times as high as ever
        for t in r:
            if t >= last - 6 * DAY:
                r[t] *= 2.5
    oi = {rules.day_of(last + DAY - 14 * DAY): {"_btc": 100.0, "BTC": 1_000.0, "ETH": 500.0},
          rules.day_of(last): {"_btc": 100.0, "BTC": 1_250.0, "ETH": 600.0},
          today: {"_btc": 90.0, "BTC": 1_150.0, "ETH": 300.0}}  # fmt: skip
    m = picture.picture(daily, rates, oi, {}, today)["mercato"]
    assert m["caldo_percentile_180g"] == 100.0
    assert m["oi_btc_14g_pct"] == pytest.approx((1_150 / 90) / 10 * 100 - 100, abs=0.01)
    assert m["fragile"] is True
    assert m["cascata"] is True  # -22% of open interest with BTC -10%
    calm = {k: dict(v) for k, v in oi.items()}
    calm[today]["BTC"] = 900.0
    m = picture.picture(daily, rates, calm, {}, today)["mercato"]
    assert m["fragile"] is False
    m = picture.picture(daily, rates, calm, {}, today, before={"fragile": True})
    assert m["mercato"]["fragile"] is True  # it ends only under the 70th percentile


# --- the commands, with BingX replaced by a fake ---------------------------------------------------


@pytest.fixture
def fake_bingx(monkeypatch):
    daily, rates = market(days=520, coins=36)
    four = {s: [Candle(c.ts + k * 4 * H, c.open, c.high, c.low, c.close, c.volume / 6) for c in cs for k in range(6)]
            for s, cs in daily.items()}  # fmt: skip
    hourly = {s: [Candle(c.ts + k * H, c.open, c.high, c.low, c.close, c.volume / 4) for c in cs for k in range(4)]
              for s, cs in four.items()}  # fmt: skip
    calls = {"oi": 0}

    def klines(coin, interval, start_ms, end_ms):
        src = {"1d": daily, "4h": four, "1h": hourly}[interval][data.pair(coin)]
        step = data.STEP_MS[interval]
        return [c for c in src if start_ms <= c.ts and c.ts + step <= end_ms]

    def open_interest(coin):
        calls["oi"] += 1
        return 2e9 if coin == "BTC" else 1e8

    last = {c: daily[data.pair(c)][-1].close for c in data.COINS}
    monkeypatch.setattr(data, "klines", klines)
    monkeypatch.setattr(
        data, "funding", lambda coin, a, b: {t: r for t, r in rates[data.pair(coin)].items() if a <= t < b}
    )
    monkeypatch.setattr(data, "tickers", lambda: dict(last))
    monkeypatch.setattr(data, "open_interest", open_interest)
    end = daily["BTC/USDT"][-1].ts + DAY
    return {"now": datetime.fromtimestamp(end / 1000 + 6 * 3600, UTC), "calls": calls, "last": last}


def test_a_morning_of_commands(tmp_path, fake_bingx):
    now = fake_bingx["now"]
    start = rules.day_of(judgment.ms(now.strftime("%Y-%m-%d %H:%M:%S")) - 30 * DAY)
    state, oi = str(tmp_path / "stato.json"), str(tmp_path / "oi.json")
    school._save(state, judgment.new_state(start))
    report = school.mark(state, oi, now)
    assert report["open_interest_coins"] == 36 and fake_bingx["calls"]["oi"] == 36
    school.mark(state, oi, now)
    assert fake_bingx["calls"]["oi"] == 36  # once a day
    summary = school.day(state, oi, str(tmp_path / "oggi"), now)
    assert set(summary["regole"]) == set(judgment.AGENTS)
    regole = school._load(str(tmp_path / "oggi" / "regole.json"))
    assert regole["inizio"] == start and len(regole["portafogli"]["tartaruga"]["curve"]) >= 29
    assert school._load(state)["market"]["day"] == now.date().isoformat()
    coin = "SOL"
    price = fake_bingx["last"][coin]
    folder = tmp_path / "oggi"
    (folder / "stato.json").write_text((tmp_path / "stato.json").read_text())
    assert len(school.context(str(folder))["scritti"]) == 5
    falco = school._load(str(folder / "contesto-falco.json"))
    assert falco["portafoglio_a_giudizio"]["rischio_massimo_oggi_pct"] in (1.0, 2.0)
    assert "ultime_operazioni" in falco["portafoglio_a_regole"]
    orders = tmp_path / "ordini.json"
    order = {"action": "open", "symbol": coin, "side": "long", "stop": price * 0.9, "risk_pct": 1, "reason": "prova"}
    school._save(str(orders), {"spazzino": [order]})
    out = school.execute(state, str(orders), now)
    assert out["events"][0]["event"] == "aperta" and out["equity"]["spazzino"] < 10_000
    notebook = tmp_path / "quaderno.json"
    school._save(str(notebook), {"previsioni": [{"mercato": coin, "direzione": "sopra", "livello": price / 2,
                                                 "scadenza": start, "probabilita": 0.9}]})  # fmt: skip
    assert school.verify(str(notebook), now)["calibrazione"]["n"] == 1


# --- the Sunday gym ----------------------------------------------------------------------------


def lively(seed: int, days: int, start: str) -> list[Candle]:
    """A random walk whose volume varies, with a surge now and then."""
    rng = random.Random(1000 + seed)
    out = []
    for c in walk(seed, days, start=start):
        surge = 3 if rng.random() < 0.08 else 1
        out.append(Candle(c.ts, c.open, c.high, c.low, c.close, c.volume * (0.5 + rng.random()) * surge))
    return out


@pytest.fixture(scope="module")
def gym_market():
    names = ["BTC", *data.COINS[1:14]]
    daily = {data.pair(c): lively(i, 1060, "2023-01-01") for i, c in enumerate(names)}
    t0 = rules.ms_of("2025-07-01")
    rates = {data.pair(c): {t0 + k * 8 * H: 0.0001 * ((i % 5) - 2) + 0.00001 * k % 7 for k in range(3 * 400)}
             for i, c in enumerate(names)}  # fmt: skip
    return gym.Market(daily, rates)


def test_the_gym_draws_the_same_cases_for_the_same_day(gym_market):
    first, again = gym.draw(gym_market, "2025-12-28"), gym.draw(gym_market, "2025-12-28")
    assert first == again and first != gym.draw(gym_market, "2026-01-04")
    for agent, cases in first.items():
        assert [c["caso"] for c in cases] == [f"{gym.LETTER[agent]}{n:02d}" for n in range(1, 21)]
        assert sum(c["tipo"] == "mestiere" for c in cases) == 10
        assert all(gym.FIRST_DAY <= c["giorno"] <= "2025-11-28" for c in cases)
        assert all(gym.of_the_trade(agent, gym_market, c["pair"], c["i"]) for c in cases if c["tipo"] == "mestiere")


def test_a_case_shows_no_coin_no_date_and_no_price(gym_market):
    case = gym.draw(gym_market, "2025-12-28")["ragioniere"][0]
    seen = gym.public(gym_market, case)
    assert set(seen) == {"caso", "candele", "numeri", "mercato"}
    assert len(seen["candele"]) == gym.SHOWN and seen["candele"][-1][3] == 100.0
    text = json.dumps(seen)
    assert case["pair"].split("/")[0] not in text and "202" not in text


def flat_market(path: list[tuple[float, float, float]]) -> gym.Market:
    """One coin: ten quiet days at 100, then the days given as (high, low, close)."""
    t0, candles, last = rules.ms_of("2025-01-01"), [], 100.0
    for k in range(10):
        candles.append(Candle(t0 + k * DAY, 100, 101, 99, 100, 1))
    for k, (high, low, close) in enumerate(path, 10):
        candles.append(Candle(t0 + k * DAY, last, high, low, close, 1))
        last = close
    return gym.Market({"SOL/USDT": candles}, {})


def test_a_plan_is_played_on_the_days_after():
    falling = flat_market([(100, 94, 95), (96, 90, 91), *[(91, 90, 91)] * 6])
    out = gym.play(falling, "SOL/USDT", 9, "long", 5, 10)
    assert out["uscita"] == "stop" and out["r"] == pytest.approx(-1.0, abs=0.01)
    rising = flat_market([(104, 99, 103), (111, 103, 110), *[(110, 109, 110)] * 6])
    out = gym.play(rising, "SOL/USDT", 9, "long", 5, 10)
    assert out["uscita"] == "target" and out["r"] > 1.8
    quiet = flat_market([(101, 99, 100)] * 8)
    out = gym.play(quiet, "SOL/USDT", 9, "short", 5, None)
    assert out["uscita"] == "scadenza" and -0.07 < out["r"] < 0


def test_answers_are_scored_and_kept_in_the_notebook(gym_market):
    cases = gym.draw(gym_market, "2025-12-28")["falco"]
    answers = [{"caso": c["caso"], "direzione": "su", "probabilita": 0.7, "azione": "long", "stop_pct": 5,
                "target_pct": 10, "perche": "prova"} for c in cases[:17]]  # fmt: skip
    answers += [
        {"caso": cases[17]["caso"], "direzione": "su", "probabilita": 0.3, "azione": "niente"},
        {"caso": cases[18]["caso"], "direzione": "giu", "probabilita": 0.6, "azione": "short", "stop_pct": 40},
    ]
    rows = gym.score("falco", gym_market, cases, answers)
    assert [r["valida"] for r in rows].count(True) == 17
    assert {r["motivo"] for r in rows if not r["valida"]} == {
        "la probabilità va da 0,5 a 0,99",
        "lo stop va dall'1% al 25%",
        "nessuna risposta",
    }
    good = [r for r in rows if r["valida"]]
    assert all(r["brier"] == pytest.approx((0.7 - r["giusta"]) ** 2) for r in good)
    assert all(r["giusta"] == (r["var_7g_dopo_pct"] > 0) for r in good)
    assert all("r" in r["regola"] for r in rows)
    notebook = {}
    s = gym.into_notebook(notebook, "2025-12-28", rows)
    assert s["valide"] == 17 and s["mestiere"]["n"] + s["a_caso"]["n"] == 20
    assert notebook["palestra"]["calibrazione"]["n"] == 17
    gym.into_notebook(notebook, "2025-12-28", rows)
    assert len(notebook["palestra"]["sessioni"]) == 1 and len(notebook["palestra"]["casi"]) == 17


# --- the evening check ------------------------------------------------------------------------------


def test_a_quiet_evening_raises_nothing():
    s = state_with()
    open_long(s)
    judgment.snapshot(s, "2026-11-26")
    reasons, numbers = school.evening_reasons(s, {**s["prices"], "BTC": 61_000.0}, None, None, "2026-11-26")
    assert reasons == [] and numbers["btc_pct"] == pytest.approx(1.67, abs=0.01)


def test_the_evening_reasons_to_meet():
    s = state_with({c: 100.0 for c in data.COINS})
    open_long(s, stop=95, risk=2)  # SOL: a 5% fall costs the 2% at the stop
    judgment.snapshot(s, "2026-11-26")
    crash = {c: 88.0 for c in data.COINS}
    morning_oi = {c: 1e8 for c in data.COINS}
    now_oi = {c: 0.8e8 for c in data.COINS}
    reasons, numbers = school.evening_reasons(s, crash, now_oi, morning_oi, "2026-11-26")
    assert "BTC −12,0% dalla mattina" in reasons
    assert any("36 monete su 36" in r for r in reasons)
    assert "CASCATA: open interest −20,0% con BTC −12,0%" in reasons
    assert any(r.startswith("il portafoglio a giudizio del Falco −") for r in reasons)
    assert numbers["portafogli_pct"]["falco"] < -4
    assert any(r.startswith("CASCATA") for r in reasons) and numbers["open_interest_pct"] == -20.0
    up = {c: 108.0 for c in data.COINS}
    reasons, _ = school.evening_reasons(s, up, now_oi, morning_oi, "2026-11-26")
    assert not any(r.startswith("CASCATA") for r in reasons)  # the open interest fell, but BTC rose


def test_falcos_times_are_read_as_seconds():
    second = rules.ms_of("2026-11-26") // 1000
    result = {"curve": {}, "trades": [{"symbol": "SOL", "entry_ts": second, "exit_ts": second + 3600, "pnl": 1.0}],
              "open": [{"symbol": "BTC", "entry_ts": second}], "segnali": None}  # fmt: skip
    out = school._readable("falco", result)
    assert out["trades"][0]["entry"] == "2026-11-26 00:00:00" and out["trades"][0]["exit"] == "2026-11-26 01:00:00"
    assert out["open"][0]["since"] == "2026-11-26 00:00:00" and "entry_ts" not in out["open"][0]
