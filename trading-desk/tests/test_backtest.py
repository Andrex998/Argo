import pytest

from desk import backtest
from tests.conftest import series, zigzag


def history(after: list[float], surge: int = 3) -> list:
    """Uptrend, `surge` breakout candles on four times the volume, then whatever `after` says."""
    closes = zigzag(117, 100.0, 0.005, -0.003)
    for _ in range(surge):
        closes.append(closes[-1] * 1.01)
    for move in after:
        closes.append(closes[-1] * (1 + move))
    volumes = [1000.0] * 117 + [4000.0] * surge + [1000.0] * len(after)
    return series(closes, volumes)


def test_winning_breakout(cfg):
    result = backtest.run({"SOL/USDC": history([0.01] * 12 + [-0.03] * 3)}, cfg)
    (trade,) = result.trades
    assert trade.reason == "trailing-stop"
    assert trade.pnl > 0
    assert result.end_equity == pytest.approx(cfg.capital + trade.pnl)
    assert result.fees > 0


def test_failed_breakout_loses_about_one_r(cfg):
    result = backtest.run({"SOL/USDC": history([-0.02] * 6, surge=1)}, cfg)
    (trade,) = result.trades
    assert trade.reason == "stop-loss"
    assert -1.5 < trade.r_multiple < -1.0  # the planned 1R plus fees and slippage
    assert result.end_equity < cfg.capital
    assert result.max_drawdown_pct > 0


def test_entry_fills_at_the_open_after_the_signal(cfg):
    candles = history([0.01] * 12 + [-0.03] * 3)
    (trade,) = backtest.run({"SOL/USDC": candles}, cfg).trades
    fill_at = next(i for i, c in enumerate(candles) if c.ts / 1000 == trade.entry_ts)
    # Candle 117 is the first with unusual volume: the signal cannot come earlier,
    # and the order fills on the candle after it.
    assert fill_at == 118
    assert trade.entry_price == pytest.approx(candles[fill_at].open * (1 + cfg.slippage))


def test_no_signal_no_trade(cfg):
    result = backtest.run(
        {"SOL/USDC": series(zigzag(200, 100.0, 0.005, -0.003), [1000.0] * 200)}, cfg
    )
    assert result.trades == []
    assert result.end_equity == cfg.capital


def test_benchmark_is_btc_buy_and_hold(cfg):
    candles = history([0.01] * 12)
    result = backtest.run({"BTC/USDC": candles}, cfg)
    assert result.benchmark_pct == pytest.approx((candles[-1].close / candles[0].open - 1) * 100)


def test_too_little_history_is_an_error(cfg):
    with pytest.raises(ValueError):
        backtest.run({"SOL/USDC": history([])[:30]}, cfg)


def test_regime_filter_keeps_the_backtest_out_of_a_falling_market(cfg):
    falling_btc = series(zigzag(135, 100.0, -0.005, 0.003), [1000.0] * 135)
    histories = {"SOL/USDC": history([0.01] * 12 + [-0.03] * 3), "BTC/USDC": falling_btc}
    assert len(backtest.run(histories, cfg).trades) == 1
    cfg.regime_filter = True
    assert backtest.run(histories, cfg).trades == []
