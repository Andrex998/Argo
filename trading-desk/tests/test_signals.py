from desk.agents import charts, scout
from desk.indicators import atr, ema, rsi
from desk.market import is_pegged
from desk.models import Candle
from tests.conftest import breakout, dump, quiet, series


def test_ema_of_a_constant_is_the_constant():
    assert ema([5.0] * 30, 20) == 5.0


def test_ema_follows_price_with_a_lag():
    rising = [float(i) for i in range(1, 61)]
    assert rising[-20] < ema(rising, 20) < rising[-1]


def test_rsi_extremes_and_balance():
    assert rsi([float(i) for i in range(1, 30)]) == 100.0
    assert rsi([float(i) for i in range(30, 1, -1)]) == 0.0
    assert rsi([10.0] * 30) == 50.0


def test_atr_counts_gaps_between_candles():
    flat = [Candle(i, 10, 11, 9, 10, 1) for i in range(20)]
    assert atr(flat) == 2.0
    gapped = flat + [Candle(20, 15, 16, 14, 15, 1)]  # range 2, but 6 above the last close
    assert atr(gapped) > 2.0


def test_scout_flags_a_volume_surge_with_rising_price(cfg):
    candidate = scout.evaluate("SOL/USDC", breakout(), 1e7, cfg)
    assert candidate is not None
    assert candidate.rvol == 4.0
    assert candidate.change_recent > 0.03


def test_scout_ignores_normal_volume(cfg):
    assert scout.evaluate("SOL/USDC", quiet(), 1e7, cfg) is None


def test_scout_ignores_a_surge_while_price_falls(cfg):
    assert scout.evaluate("SOL/USDC", dump(), 1e7, cfg) is None


def test_scout_needs_enough_history(cfg):
    assert scout.evaluate("SOL/USDC", breakout()[-40:], 1e7, cfg) is None


def test_charts_plans_a_breakout_in_an_uptrend(cfg):
    plan = charts.plan("SOL/USDC", breakout(), cfg)
    assert plan.valid, plan.reasons
    assert plan.trend == "up"
    assert plan.stop < plan.entry < plan.target
    assert round(plan.reward_risk, 6) == cfg.reward_risk
    assert cfg.min_stop_pct <= plan.stop_pct <= cfg.max_stop_pct


def test_charts_rejects_a_downtrend(cfg):
    plan = charts.plan("SOL/USDC", dump(), cfg)
    assert not plan.valid
    assert plan.trend == "down"


def test_charts_rejects_an_overbought_market(cfg):
    straight_up = series([100 * 1.01**i for i in range(120)], [1000.0] * 120)
    plan = charts.plan("SOL/USDC", straight_up, cfg)
    assert any("ipercomprato" in reason for reason in plan.reasons)


def test_charts_rejects_resistance_right_above_entry(cfg):
    candles = breakout()
    old, ceiling = candles[60], candles[-1].close * 1.005
    candles[60] = Candle(old.ts, old.open, ceiling, old.low, old.close, old.volume)
    plan = charts.plan("SOL/USDC", candles, cfg)
    assert any("resistenza" in reason for reason in plan.reasons)


def test_charts_rejects_a_stop_wider_than_the_limit(cfg):
    wild = series(
        [100 * (1.06 if i % 2 == 0 else 0.96) ** (i // 2 + 1) for i in range(120)], [1000.0] * 120
    )
    plan = charts.plan("SOL/USDC", wild, cfg)
    assert any("stop" in reason for reason in plan.reasons)


def test_stablecoins_and_fiat_are_not_tradable_bases():
    assert all(is_pegged(base) for base in ("USDT", "USDC", "USDG", "PYUSD", "EURC", "DAI", "GBP"))
    assert not any(is_pegged(base) for base in ("BTC", "ETH", "SOL", "JUP", "SUI"))


def test_the_exchanges_the_desk_documents_are_known_to_ccxt():
    from desk.config import Settings
    from desk.market import make_exchange

    for exchange in ("kraken", "bybiteu", "bybit", "bingx"):
        built = make_exchange(Settings(_env_file=None, exchange=exchange))
        assert built.id == exchange
        assert built.options["defaultType"] == "spot"


def test_quote_currencies_are_listed_most_used_first(cfg):
    from types import SimpleNamespace

    from desk.market import CcxtMarket

    markets = {
        "BTC/USDC": {"spot": True, "quote": "USDC"},
        "ETH/USDC": {"spot": True, "quote": "USDC"},
        "BTC/EUR": {"spot": True, "quote": "EUR"},
        "OLD/EUR": {"spot": True, "quote": "EUR", "active": False},
        "BTC/USDT:USDT": {"spot": False, "quote": "USDT"},
    }
    exchange = SimpleNamespace(load_markets=lambda: markets, parse_timeframe=lambda tf: 3600)
    assert CcxtMarket(exchange, cfg).quotes() == [("USDC", 2), ("EUR", 1)]
