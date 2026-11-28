"""ArgoDesk: the rules-only strategy of our crypto paper-trading desk, ported to Freqtrade.

The port replicates the desk rule by rule; it does not try to improve it. Every number
below is a default of trading-desk/desk/config.py or a constant of the desk's agents, so
change them there first, or not at all.

Where each rule comes from (trading-desk/desk/):
- agents/scout.py   the volume surge: the last 3 candles' volume against the 48 before
                    them, with the price up over those 3 candles
- agents/charts.py  the plan: uptrend on EMA 20/50, RSI cap, ATR stop with a floor and a
                    ceiling, no resistance within 1R, breakout above the last 20 highs,
                    and BTC's own uptrend as the regime filter
- risk.py           the gate: fee filter, 1% risk sizing and its caps, daily-loss and
                    drawdown blocks, cooldown after a loss; and the exits: initial stop,
                    breakeven at +1R, 1R trailing stop once the target is hit, time limit
- backtest.py       signals on closed candles, entries at the next open, best rvol first

The desk computes its indicators on the last 200 candles only, seeding each average with
the simple mean of the window's first values (desk/indicators.py). `seeded_average`
reproduces that exactly, so a setup here is a setup there.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import NamedTuple

import numpy as np
import pandas as pd
from freqtrade.enums import RunMode
from freqtrade.exchange import ROUND_DOWN, price_to_precision
from freqtrade.persistence import Trade
from freqtrade.strategy import (
    IStrategy,
    informative,
    stoploss_from_absolute,
    timeframe_to_minutes,
    timeframe_to_prev_date,
)
from numpy.lib.stride_tricks import sliding_window_view

# --- The desk's parameters ----------------------------------------------------
WINDOW = 200  # candles each agent sees (desk/backtest.py)
SURGE, BASELINE, MIN_CANDLES = 3, 48, 60  # agents/scout.py
RVOL_MIN = 2.0  # recent volume against its baseline
FAST, SLOW = 20, 50  # agents/charts.py: EMA periods
RANGE = 60  # candles defining the range the surge started from
RSI_PERIOD = ATR_PERIOD = 14  # desk/indicators.py
RSI_MAX = 80.0
ATR_STOP_MULT = 3.0
MIN_STOP_PCT = 1.5
MAX_STOP_PCT = 8.0
REWARD_RISK = 3.0
BREAKOUT_LOOKBACK = 20
RISK_PER_TRADE_PCT = 1.0
MAX_POSITION_PCT = 10.0
MAX_EXPOSURE_PCT = 50.0
MAX_DAILY_LOSS_PCT = 3.0
MAX_DRAWDOWN_PCT = 15.0
MIN_NOTIONAL = 10.0
MAX_COST_R = 0.33  # round-trip fees and slippage as a share of the amount at risk
COOLDOWN_HOURS = 12.0
MAX_HOLD_HOURS = 72.0
FEE_RATE = 0.004  # the desk's fee: it sets the fee filter and the breakeven level
SLIPPAGE = 0.001  # slippage_bps 10
# max_open_positions (5) is max_open_trades in the config.


# --- Indicators, exactly as the desk computes them -----------------------------
def seeded_weights(length: int, period: int, alpha: float) -> np.ndarray:
    """The desk's recursive average over `length` values, as the weights of one dot product.

    The first `period` values seed a simple mean; each later value is blended in with `alpha`.
    """
    weights = np.empty(length)
    weights[:period] = (1 - alpha) ** (length - period) / period
    weights[period:] = alpha * (1 - alpha) ** np.arange(length - period - 1, -1, -1)
    return weights


def seeded_average(values: np.ndarray, period: int, alpha: float, window: int) -> np.ndarray:
    """At every row, the desk's average of the last `window` values (of all of them at first)."""
    out = np.full(len(values), np.nan)
    for n in range(period, min(window, len(values)) + 1):  # the window is still filling up
        out[n - 1] = values[:n] @ seeded_weights(n, period, alpha)
    if len(values) > window:
        windows = sliding_window_view(values, window)
        out[window - 1 :] = windows @ seeded_weights(window, period, alpha)
    return out


def desk_ema(close: pd.Series, period: int) -> np.ndarray:
    return seeded_average(close.to_numpy(float), period, 2 / (period + 1), WINDOW)


def desk_rsi(close: pd.Series, period: int = RSI_PERIOD) -> np.ndarray:
    """Wilder's RSI on the last 200 closes, that is on their 199 changes."""
    change = np.diff(close.to_numpy(float))
    gain = seeded_average(np.maximum(change, 0), period, 1 / period, WINDOW - 1)
    loss = seeded_average(np.maximum(-change, 0), period, 1 / period, WINDOW - 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        rsi = np.where(loss == 0, np.where(gain > 0, 100.0, 50.0), 100 - 100 / (1 + gain / loss))
    return np.concatenate([[np.nan], rsi])


def desk_atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> np.ndarray:
    """Wilder's ATR on the last 200 candles, that is on their 199 true ranges."""
    high, low = df["high"].to_numpy(float)[1:], df["low"].to_numpy(float)[1:]
    prev_close = df["close"].to_numpy(float)[:-1]
    true_range = np.maximum.reduce(
        [high - low, np.abs(high - prev_close), np.abs(low - prev_close)]
    )
    return np.concatenate([[np.nan], seeded_average(true_range, period, 1 / period, WINDOW - 1)])


def uptrend(df: pd.DataFrame) -> pd.Series:
    """charts.trend_of == "up": price above the EMA50 and the EMA20 above the EMA50."""
    ema_fast, ema_slow = desk_ema(df["close"], FAST), desk_ema(df["close"], SLOW)
    return ((df["close"] > ema_slow) & (ema_fast > ema_slow)).astype(float)


class Book(NamedTuple):
    """The account at a candle close, as the desk's risk gate sees it (risk.Book)."""

    time: datetime
    equity: float
    cash: float
    exposure: float  # market value of the positions held
    held: frozenset[str]  # pairs holding a position at this close


class ArgoDesk(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "4h"
    can_short = False
    startup_candle_count = WINDOW
    process_only_new_candles = True
    minimal_roi = {"0": 100.0}  # off: the desk takes no fixed profit
    stoploss = -0.10  # safety net only: the desk's stop replaces it as soon as the order fills
    use_custom_stoploss = True
    trailing_stop = False
    use_exit_signal = True  # lets custom_exit apply the time limit
    ignore_buying_expired_candle_after = 900  # dry/live: buy just after the close, like the desk

    # --- Setup ------------------------------------------------------------------
    def bot_start(self, **kwargs) -> None:
        self._frames: dict[str, pd.DataFrame] = {}  # per pair, the columns the gate reads
        self._book: Book | None = None
        self._day: date | None = None
        self._day_start = self._peak = self._capital()
        if not self._backtesting():
            # After a restart the peak is rebuilt from the closed trades; the unrealised
            # highs of positions open before the restart are not known any more.
            equity = self._capital()
            for trade in sorted(
                Trade.get_trades_proxy(is_open=False), key=lambda t: t.close_date_utc
            ):
                equity += trade.close_profit_abs or 0.0
                self._peak = max(self._peak, equity)

    @informative("4h", "BTC/{stake}", fmt="btc_{column}")
    def populate_indicators_btc(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        """BTC's own trend for the regime filter (charts.market_falling, strict)."""
        dataframe["uptrend"] = uptrend(dataframe)
        return dataframe

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        df = dataframe
        close, volume = df["close"], df["volume"]
        # Scout: the last 3 candles' volume against the 48 before them.
        df["baseline"] = volume.shift(SURGE).rolling(BASELINE).mean()
        df["rvol"] = volume.rolling(SURGE).mean() / df["baseline"]
        df["change_recent"] = close / close.shift(SURGE) - 1
        # Charts.
        df["uptrend"] = uptrend(df)
        df["rsi"] = desk_rsi(close)
        df["stop_distance"] = np.maximum(ATR_STOP_MULT * desk_atr(df), close * MIN_STOP_PCT / 100)
        df["resistance"] = df["high"].shift(SURGE).rolling(RANGE - SURGE).max()
        df["prior_high"] = df["high"].shift(1).rolling(BREAKOUT_LOOKBACK).max()
        # Risk gate: a tight stop on an expensive venue loses to fees even when right.
        df["cost_r"] = 2 * (FEE_RATE + SLIPPAGE) * close / df["stop_distance"]
        return df

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        df = dataframe
        close, stop = df["close"], df["stop_distance"]
        surge = (
            (np.arange(len(df)) >= MIN_CANDLES - 1)  # the scout needs 60 candles
            & (df["baseline"] > 0)
            & (df["rvol"] >= RVOL_MIN)
            & (df["change_recent"] > 0)
        )
        plan = (
            (df["uptrend"] == 1)
            & (df["rsi"] <= RSI_MAX)
            & (stop / close * 100 <= MAX_STOP_PCT)
            & ~((close < df["resistance"]) & (df["resistance"] < close + stop))  # within 1R
            & (close > df["prior_high"])  # breakout above the last 20 highs
        )
        market = df["btc_uptrend"] == 1  # strict regime: BTC itself must be in an uptrend
        setup = surge & plan & market
        df["enter_long"] = setup.astype(int)
        df.loc[setup, "enter_tag"] = "volume_surge"
        self._frames[metadata["pair"]] = df.set_index("date")[
            ["close", "stop_distance", "rvol", "cost_r", "enter_long"]
        ]
        return df

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        return dataframe  # exits come from custom_stoploss and custom_exit

    # --- The risk gate ------------------------------------------------------------
    def bot_loop_start(self, current_time: datetime, **kwargs) -> None:
        # Value the book at every candle close, as the desk does: the day's starting
        # equity and the equity peak come from these valuations.
        self._mark(timeframe_to_prev_date(self.timeframe, current_time))
        if self._backtesting():
            # Place each open trade's stop for the candle about to be read (see Exits).
            for trade in Trade.get_trades_proxy(is_open=True):
                highest = trade.get_custom_data("highest")
                if highest is not None:  # the entry has filled
                    stop = self._desk_stop(trade)
                    trade.adjust_stop_loss(highest, self._stoploss(trade, stop, highest))

    def confirm_trade_entry(
        self,
        pair: str,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        current_time: datetime,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> bool:
        """risk.evaluate, judged at the close of the signal candle like the desk does."""
        now = timeframe_to_prev_date(self.timeframe, current_time)
        return pair in self._gate(now)

    def custom_stake_amount(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_stake: float,
        min_stake: float | None,
        max_stake: float,
        leverage: float,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> float:
        """risk.evaluate sizing, as decided by the gate for this close."""
        now = timeframe_to_prev_date(self.timeframe, current_time)
        return self._gate(now).get(pair, 0.0)

    def _gate(self, now: datetime) -> dict[str, float]:
        """The desk's risk gate at the close `now`: the setups it approves, with their size.

        Like desk/backtest.py, it takes the setups with the highest rvol first, and each
        approval reserves its slot and its money before the next setup is judged. Freqtrade
        asks pair by pair in its own order, so the whole close is decided here at once.
        """
        book = self._mark(now)
        if self._blocked(book):  # daily-loss or drawdown limit
            return {}
        setups = []
        for pair in self._frames:
            signal = self._signal(pair, now)
            if signal is None or pair in book.held:  # one position per market
                continue
            if self._cooling_down(pair, now):  # paused after a losing exit
                continue
            if signal["cost_r"] > MAX_COST_R:  # fees and slippage above a third of the risk
                continue
            setups.append((signal["rvol"], pair, signal))
        approved: dict[str, float] = {}
        cash, exposure = book.cash, book.exposure
        for _, pair, signal in sorted(setups, key=lambda s: s[0], reverse=True):
            if len(book.held) + len(approved) >= self.config["max_open_trades"]:
                break
            # Lose at most 1% of equity at the stop, within the position, exposure and cash
            # limits. With the default limits, the 10% position cap always binds.
            risk_budget = book.equity * RISK_PER_TRADE_PCT / 100
            notional = min(
                risk_budget / signal["stop_distance"] * signal["close"],
                book.equity * MAX_POSITION_PCT / 100,
                book.equity * MAX_EXPOSURE_PCT / 100 - exposure,
                cash / ((1 + SLIPPAGE) * (1 + FEE_RATE)),
            )
            if notional < MIN_NOTIONAL:
                continue
            approved[pair] = notional
            cash -= notional
            exposure += notional
        return approved

    # --- Exits --------------------------------------------------------------------
    # The desk tests each price against the stop it already has, and only then lets that
    # price raise the stop (risk.check_exit). Live, Freqtrade sees a price every few seconds
    # and custom_stoploss follows that order. A backtest sees whole candles and would raise
    # the stop with a candle's high before testing its low, so there bot_loop_start places
    # each candle's stop at the candle's open, and custom_stoploss only records the high.

    def order_filled(self, pair: str, trade: Trade, order, current_time: datetime, **kwargs):
        if order.ft_order_side == trade.entry_side:
            self._levels(trade)  # fix the entry and 1R before the first stop is placed

    def custom_stoploss(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        after_fill: bool,
        **kwargs,
    ) -> float | None:
        """The stop of risk.check_exit, from the prices seen before this one."""
        stop = self._desk_stop(trade)
        if after_fill:  # the entry just filled: the initial stop
            return self._stoploss(trade, stop, current_rate)
        # A backtest passes the candle's high here; live, the latest price.
        trade.set_custom_data("highest", max(trade.get_custom_data("highest"), current_rate))
        if self._backtesting():
            return None  # this candle's stop was placed by bot_loop_start
        return self._stoploss(trade, stop, current_rate)

    def custom_exit(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        **kwargs,
    ) -> str | None:
        """The rest of risk.check_exit, at the latest price (in a backtest, the candle's open)."""
        price = current_rate
        if self._backtesting():  # the desk's backtest applies the time limit at the close
            price = self._close(pair, timeframe_to_prev_date(self.timeframe, current_time), price)
        if self._time_is_up(trade, current_time, price):
            return "time_limit"
        # Already at or below the stop, e.g. after a gap: the desk sells at this price, not at
        # the stop. Freqtrade cannot place a stop above the price, so this exit covers it.
        entry, risk = self._levels(trade)
        stop = trade.get_custom_data("stop")
        if current_rate <= stop:
            if stop <= entry - risk:
                return "stop_loss"
            return "breakeven" if stop <= entry * (1 + 2 * FEE_RATE) else "trailing_stop"
        return None

    # --- Helpers --------------------------------------------------------------------
    @property
    def _candle(self) -> timedelta:
        return timedelta(minutes=timeframe_to_minutes(self.timeframe))

    def _backtesting(self) -> bool:
        return self.dp.runmode in (RunMode.BACKTEST, RunMode.HYPEROPT)

    def _capital(self) -> float:
        """The only money the desk may use (desk/config.py capital)."""
        wallet = self.config.get("available_capital", self.config["dry_run_wallet"])
        return float(wallet[self.config["stake_currency"]] if isinstance(wallet, dict) else wallet)

    def _signal(self, pair: str, now: datetime) -> pd.Series | None:
        """The pair's candle that closed at `now`, if it holds a setup."""
        frame = self._frames.get(pair)
        signal_date = now - self._candle
        if frame is None or signal_date not in frame.index:
            return None
        row = frame.loc[signal_date]
        return row if row["enter_long"] == 1 else None

    def _close(self, pair: str, now: datetime, default: float) -> float:
        """Close of the last candle that closed at or before `now`."""
        frame = self._frames.get(pair)
        price = frame["close"].asof(now - self._candle) if frame is not None else None
        return default if price is None or pd.isna(price) else float(price)

    def _mark(self, now: datetime) -> Book:
        """Value the account at the close `now` (desk/backtest.py, step 3) and roll the
        trading day and the equity peak forward."""
        if self._backtesting() and self._book is not None and self._book.time == now:
            # Freqtrade handles this candle's exits before its entries; the desk decided
            # those entries at the close, so they see the book as it was then.
            return self._book
        realized, held = 0.0, []
        for trade in Trade.get_trades_proxy(is_open=False):
            if self._sold_at(trade) <= now:
                realized += trade.close_profit_abs or 0.0
            elif trade.open_date_utc < now:
                held.append(trade)  # sold after this close: still held at it
        for trade in Trade.get_trades_proxy(is_open=True):
            if trade.open_date_utc >= now:
                continue  # entered at this close: a reservation, not part of the book yet
            price = self._close(trade.pair, now, trade.open_rate)
            if self._time_is_up(trade, now, price):
                # The desk sells it at this close, before looking for new setups; Freqtrade
                # sells it at the next open (custom_exit), so count it as sold here.
                value = trade.amount * price * (1 - trade.fee_close)
                realized += value - trade.stake_amount * (1 + trade.fee_open)
            else:
                held.append(trade)
        cash = self._capital() + realized - sum(t.stake_amount * (1 + t.fee_open) for t in held)
        exposure = sum(t.amount * self._close(t.pair, now, t.open_rate) for t in held)
        equity = cash + exposure
        if now.date() != self._day:  # a new UTC day starts from this valuation
            self._day, self._day_start = now.date(), equity
        self._peak = max(self._peak, equity)
        self._book = Book(now, equity, cash, exposure, frozenset(t.pair for t in held))
        return self._book

    def _time_is_up(self, trade: Trade, now: datetime, price: float) -> bool:
        """risk.check_exit's time limit: held 72 hours without reaching +0.5R."""
        entry, risk = trade.get_custom_data("entry"), trade.get_custom_data("risk")
        if entry is None or risk is None:  # the entry order has not filled yet
            return False
        stale = now - trade.open_date_utc >= timedelta(hours=MAX_HOLD_HOURS)
        return stale and price < entry + 0.5 * risk

    def _blocked(self, book: Book) -> bool:
        """risk.blocked: no new entries in a 15% drawdown or after losing 3% on the day."""
        drawdown = (1 - book.equity / self._peak) * 100
        day_loss = (1 - book.equity / self._day_start) * 100
        return drawdown >= MAX_DRAWDOWN_PCT or day_loss >= MAX_DAILY_LOSS_PCT

    def _cooling_down(self, pair: str, now: datetime) -> bool:
        """No new entry for 12 hours after a losing exit the desk knew of at this close."""
        for trade in Trade.get_trades_proxy(pair=pair, is_open=False):
            if (trade.close_profit_abs or 0.0) < 0:
                sold = self._sold_at(trade)
                if sold <= now < sold + timedelta(hours=COOLDOWN_HOURS):
                    return True
        return False

    def _sold_at(self, trade: Trade) -> datetime:
        """When the desk counts a trade as sold. A stop is hit during a candle and counted at
        that candle's close; the time limit sells at the close it is decided at, which
        Freqtrade carries out at the next open."""
        if trade.exit_reason == "time_limit":
            return trade.close_date_utc
        return timeframe_to_prev_date(self.timeframe, trade.close_date_utc) + self._candle

    def _levels(self, trade: Trade) -> tuple[float, float]:
        """The trade's entry price and 1R (its initial stop distance), fixed at the fill."""
        entry, risk = trade.get_custom_data("entry"), trade.get_custom_data("risk")
        if entry is not None and risk is not None:
            return entry, risk
        entry = trade.open_rate
        if self._backtesting():
            # Freqtrade fills at the open and charges the desk's 10 bps of slippage in the fee;
            # the desk sets its levels from the slipped fill, so the backtest does too.
            entry *= 1 + SLIPPAGE
        frame = self._frames.get(trade.pair)
        signal_close = timeframe_to_prev_date(self.timeframe, trade.open_date_utc)
        risk = (
            frame["stop_distance"].asof(signal_close - self._candle) if frame is not None else None
        )
        if risk is None or pd.isna(risk):  # no candles for the signal: keep the safety stop
            risk = trade.open_rate * abs(self.stoploss)
        entry, risk = float(entry), float(risk)
        trade.set_custom_data("entry", entry)
        trade.set_custom_data("risk", risk)
        trade.set_custom_data("highest", entry)
        trade.set_custom_data("stop", entry - risk)
        return entry, risk

    def _desk_stop(self, trade: Trade) -> float:
        """The stop from the highest price seen so far (risk.check_exit), kept for custom_exit."""
        entry, risk = self._levels(trade)
        highest = trade.get_custom_data("highest")
        stop = entry - risk
        if highest >= entry + risk:  # +1R: the trade can no longer lose
            stop = max(stop, entry * (1 + 2 * FEE_RATE))
        if highest >= entry + REWARD_RISK * risk:  # target reached: let it run, 1R behind
            stop = max(stop, highest - risk)
        trade.set_custom_data("stop", stop)
        return stop

    def _stoploss(self, trade: Trade, stop: float, reference: float) -> float:
        """The ratio below `reference` that places Freqtrade's stop on the desk's level.

        Freqtrade rounds a stop up to the price tick, so it would trigger one tick above the
        desk's stop. Rounded down to the tick instead, it triggers on exactly the prices the
        desk's "low <= stop" does; a hair below it keeps Freqtrade's rounding on that tick.
        """
        on_tick = price_to_precision(
            stop, trade.price_precision, trade.precision_mode_price, rounding_mode=ROUND_DOWN
        )
        return stoploss_from_absolute(on_tick * (1 - 1e-9), reference, leverage=trade.leverage)
