"""Rules-only backtest: Scout, Charts, risk gate and exits replayed on history.

The LLM analysts are left out on purpose. News and social posts cannot be
replayed as they were at each past moment, so any "backtest" of them would be
looking at the future. What this measures is the baseline the analysts have to
beat: the same code paths used live, with fees and slippage charged.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from desk import risk
from desk.agents import charts, scout
from desk.broker import PaperBroker
from desk.config import Settings
from desk.models import Candle, ChartPlan, Position
from desk.store import Trade

WINDOW = 200  # candles each agent sees, as in live trading


@dataclass(slots=True)
class Result:
    start_ts: float
    end_ts: float
    symbols: int
    start_equity: float
    end_equity: float
    max_drawdown_pct: float
    fees: float
    open_positions: int
    benchmark_pct: float | None  # buy-and-hold of BTC over the same period
    trades: list[Trade] = field(default_factory=list)

    @property
    def return_pct(self) -> float:
        return (self.end_equity / self.start_equity - 1) * 100

    @property
    def win_rate(self) -> float:
        return sum(t.pnl > 0 for t in self.trades) / len(self.trades) * 100 if self.trades else 0.0

    @property
    def avg_r(self) -> float:
        return sum(t.r_multiple for t in self.trades) / len(self.trades) if self.trades else 0.0

    @property
    def profit_factor(self) -> float | None:
        losses = -sum(t.pnl for t in self.trades if t.pnl < 0)
        return sum(t.pnl for t in self.trades if t.pnl > 0) / losses if losses else None


def run(histories: dict[str, list[Candle]], cfg: Settings) -> Result:
    """Replay the desk candle by candle: signals on closed candles, entries at the next open."""
    histories = {s: c for s, c in histories.items() if len(c) > scout.MIN_CANDLES}
    if not histories:
        raise ValueError("storico insufficiente per il backtest")
    timeline = sorted({c.ts for candles in histories.values() for c in candles})
    candle_s = (timeline[1] - timeline[0]) / 1000
    index = {s: {c.ts: i for i, c in enumerate(candles)} for s, candles in histories.items()}

    broker = PaperBroker(cfg)
    cash = peak = day_start = cfg.capital
    day = ""
    fees = max_drawdown = 0.0
    positions: dict[str, Position] = {}
    last_price: dict[str, float] = {}
    cooldowns: dict[str, float] = {}
    pending: list[tuple[ChartPlan, float]] = []  # (plan, notional) to fill at the next open
    trades: list[Trade] = []

    for ts in timeline:
        close_time = ts / 1000 + candle_s
        bars = {s: histories[s][i[ts]] for s, i in index.items() if ts in i}

        # 1. Fill the entries decided at the previous close.
        for plan, notional in pending:
            bar = bars.get(plan.symbol)
            if not bar or plan.symbol in positions:
                continue
            notional = min(notional, risk.affordable(cash, cfg))
            fill = broker.buy(plan.symbol, notional / bar.open, bar.open)
            shift = fill.price - plan.entry
            cash += fill.quote_delta
            fees += fill.fee
            positions[plan.symbol] = Position(
                plan.symbol,
                fill.qty,
                fill.price,
                ts / 1000,
                -fill.quote_delta,
                plan.stop + shift,
                plan.stop + shift,
                plan.target + shift,
                fill.price,
            )
        pending = []

        # 2. Manage open positions on this candle.
        for symbol, pos in list(positions.items()):
            bar = bars.get(symbol)
            if not bar:
                continue
            last_price[symbol] = bar.close
            exit_ = risk.check_exit(
                pos,
                open_=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                now=close_time,
                cfg=cfg,
            )
            if not exit_:
                continue
            fill = broker.sell(symbol, pos.qty, exit_.price)
            pnl = fill.quote_delta - pos.cost
            cash += fill.quote_delta
            fees += fill.fee
            del positions[symbol]
            trades.append(
                Trade(
                    symbol,
                    pos.qty,
                    pos.entry_price,
                    fill.price,
                    pos.entry_ts,
                    close_time,
                    pnl,
                    pnl / (pos.risk_per_unit * pos.qty),
                    exit_.reason,
                )
            )
            if pnl < 0:
                cooldowns[symbol] = close_time + cfg.cooldown_hours * 3600

        # 3. Mark the book to market.
        exposure = sum(p.qty * last_price.get(s, p.entry_price) for s, p in positions.items())
        equity = cash + exposure
        today = datetime.fromtimestamp(close_time, UTC).date().isoformat()
        if today != day:
            day, day_start = today, equity
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, (1 - equity / peak) * 100)

        # 4. Look for new setups on the candles that just closed.
        book = risk.Book(
            equity, cash, exposure, frozenset(positions), day_start, peak, cooldowns=cooldowns
        )
        if risk.blocked(book, cfg):
            continue
        candidates = []
        for symbol in bars:
            i = index[symbol][ts]
            window = histories[symbol][max(0, i - WINDOW + 1) : i + 1]
            if candidate := scout.evaluate(symbol, window, 0.0, cfg):
                candidates.append((candidate, window))
        candidates.sort(key=lambda pair: pair[0].rvol, reverse=True)
        for candidate, window in candidates:
            plan = charts.plan(candidate.symbol, window, cfg)
            decision = risk.evaluate(plan, book, cfg, close_time)
            if not decision.approved:
                continue
            pending.append((plan, decision.notional))
            # Reserve the money so later signals on this candle see the reduced book.
            book.cash -= decision.notional
            book.exposure += decision.notional
            book.open_symbols |= {plan.symbol}

    btc = next((c for s, c in histories.items() if s.startswith("BTC/")), None)
    return Result(
        start_ts=timeline[0] / 1000,
        end_ts=timeline[-1] / 1000 + candle_s,
        symbols=len(histories),
        start_equity=cfg.capital,
        end_equity=equity,
        max_drawdown_pct=max_drawdown,
        fees=fees,
        open_positions=len(positions),
        benchmark_pct=(btc[-1].close / btc[0].open - 1) * 100 if btc else None,
        trades=trades,
    )
