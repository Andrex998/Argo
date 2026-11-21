"""Long and short on perpetual futures: does the desk's breakout logic work both ways?

A research replay, kept apart from desk/backtest.py, on three years of Binance USDⓈ-M
4h candles with the real funding rates. Longs use the desk's own Scout and Charts. Shorts
use the same rules mirrored: a volume surge on a falling price, a downtrend, a close
under the lowest low of the previous 20 candles, the stop above and the target below.
New longs only while BTC is in an uptrend, new shorts only while it is in a downtrend.
Memecoins are left out: they get no leverage.

Sizing is the desk's: 1% of equity lost at the stop. Leverage does not raise that risk;
it only lowers the margin a position ties up, so the position caps can be wider.

Run from trading-desk/:  uv run python research/perps.py download|run
"""

from __future__ import annotations

import csv
import io
import json
import pickle
import sys
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import fmean

from desk.agents import charts, scout
from desk.config import Settings
from desk.indicators import atr, ema, rsi
from desk.models import Candle

OUT = Path(__file__).parent
MONTHS = [
    f"{y}-{m:02d}"
    for y in (2023, 2024, 2025, 2026)
    for m in range(1, 13)
    if "2023-10" <= f"{y}-{m:02d}" <= "2026-10"
]
MEME = {"DOGE", "PEPE", "SHIB", "FLOKI"}
U2 = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "AVAX", "TRX", "LINK", "DOT", "MATIC",
      "LTC", "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI",
      "SUI", "TIA", "ICP", "HBAR", "AAVE", "RNDR", "FTM", "IMX", "STX", "RUNE", "ORDI", "WLD",
      "PEPE", "SHIB", "FLOKI"]  # fmt: skip
COINS = [c for c in U2 if c not in MEME]
STITCH = {"MATIC": ["MATIC", "POL"], "FTM": ["FTM", "S"], "RNDR": ["RNDR", "RENDER"]}
SITE = "https://data.binance.vision/data/futures/um/monthly"
CANDLE_MS = 4 * 3600 * 1000
FUNDING_MS = 8 * 3600 * 1000
WARMUP = 220
YEARS = {
    "Y1": ("2023-11-01", "2024-11-01"),
    "Y2": ("2024-11-01", "2025-11-01"),
    "Y3": ("2025-11-01", "2026-11-01"),
    "3 anni": ("2023-11-01", "2026-11-01"),
}


# --- data ----------------------------------------------------------------------------------


def _rows(url: str) -> list[list[str]]:
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        text = z.read(z.namelist()[0]).decode()
    return [row for row in csv.reader(io.StringIO(text)) if row and row[0].isdigit()]


def _ms(ts: int) -> int:
    return ts // 1000 if ts > 10**14 else ts  # some files are in microseconds


def _coin(base: str) -> tuple[list[Candle], dict[int, float]]:
    candles: dict[int, Candle] = {}
    funding: dict[int, float] = {}
    for t in STITCH.get(base, [base]):
        with ThreadPoolExecutor(max_workers=6) as pool:
            klines = pool.map(
                _rows, [f"{SITE}/klines/{t}USDT/4h/{t}USDT-4h-{m}.zip" for m in MONTHS]
            )
            rates = pool.map(
                _rows, [f"{SITE}/fundingRate/{t}USDT/{t}USDT-fundingRate-{m}.zip" for m in MONTHS]
            )
            for rows in klines:
                for r in rows:
                    ts = _ms(int(r[0]))
                    candles.setdefault(
                        ts,
                        Candle(ts, float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5])),
                    )
            for rows in rates:
                for r in rows:
                    # Funding is settled at the hour; the file stamps it a few ms later.
                    ts = _ms(int(r[0])) // 60_000 * 60_000
                    funding.setdefault(ts, float(r[2]))
    return [candles[ts] for ts in sorted(candles)], funding


def download() -> None:
    data = {"klines": {}, "funding": {}}
    for base in COINS:
        candles, funding = _coin(base)
        print(base, len(candles), "candele,", len(funding), "finanziamenti", flush=True)
        if len(candles) > 300:
            data["klines"][f"{base}/USDT"] = candles
            data["funding"][f"{base}/USDT"] = funding
    (OUT / "perps.pkl").write_bytes(pickle.dumps(data))
    print(len(data["klines"]), "mercati salvati")


# --- the replay ------------------------------------------------------------------------------


@dataclass
class Pos:
    symbol: str
    side: int  # +1 long, -1 short
    qty: float
    entry: float
    entry_ts: float
    stop: float
    initial_stop: float
    target: float
    extreme: float  # best price reached: the highest for a long, the lowest for a short
    margin: float
    liquidation: float
    fees: float
    funding: float = 0.0

    @property
    def risk(self) -> float:
        return abs(self.entry - self.initial_stop)


def short_signal(window: list[Candle], cfg: Settings) -> float | None:
    """Scout mirrored: a volume surge while the price falls. Returns the relative volume."""
    if len(window) < scout.MIN_CANDLES:
        return None
    baseline = fmean(c.volume for c in window[-(scout.SURGE + scout.BASELINE) : -scout.SURGE])
    if baseline <= 0:
        return None
    rvol = fmean(c.volume for c in window[-scout.SURGE :]) / baseline
    change = window[-1].close / window[-scout.SURGE - 1].close - 1
    return rvol if rvol >= cfg.rvol_min and change < 0 else None


def short_plan(window: list[Candle], cfg: Settings) -> tuple[float, float, float] | None:
    """Charts mirrored: (entry, stop above, target below), or None when the setup fails."""
    closes = [c.close for c in window]
    entry = closes[-1]
    trend = charts.trend_of(entry, ema(closes, charts.FAST), ema(closes, charts.SLOW))
    distance = max(cfg.atr_stop_mult * atr(window), entry * cfg.min_stop_pct / 100)
    support = min(c.low for c in window[-charts.RANGE : -scout.SURGE])
    if trend != "down" or rsi(closes) < 100 - cfg.rsi_max:
        return None
    if distance / entry * 100 > cfg.max_stop_pct or entry > support > entry - distance:
        return None
    if cfg.breakout_lookback:
        prior_low = min(c.low for c in window[-cfg.breakout_lookback - 1 : -1])
        if entry >= prior_low:
            return None
    return entry, entry + distance, entry - cfg.reward_risk * distance


def check_exit(p: Pos, bar: Candle, now: float, cfg: Settings) -> tuple[str, float] | None:
    """risk.check_exit for both sides: stop first, then breakeven at +1R, trailing after
    the target at 1R, and a stale trade closed after max_hold_hours."""
    r, s = p.risk, p.side
    if (bar.low <= p.stop) if s > 0 else (bar.high >= p.stop):
        if (p.stop <= p.initial_stop) if s > 0 else (p.stop >= p.initial_stop):
            reason = "stop-loss"
        elif (p.extreme >= p.target) if s > 0 else (p.extreme <= p.target):
            reason = "trailing-stop"
        else:
            reason = "pareggio"
        return reason, (min(p.stop, bar.open) if s > 0 else max(p.stop, bar.open))
    if s > 0:
        p.extreme = max(p.extreme, bar.high)
        if p.extreme >= p.entry + r:
            p.stop = max(p.stop, p.entry * (1 + 2 * cfg.fee_rate))
        if p.extreme >= p.target:
            p.stop = max(p.stop, p.extreme - r)
        stale_and_flat = bar.close < p.entry + 0.5 * r
    else:
        p.extreme = min(p.extreme, bar.low)
        if p.extreme <= p.entry - r:
            p.stop = min(p.stop, p.entry * (1 - 2 * cfg.fee_rate))
        if p.extreme <= p.target:
            p.stop = min(p.stop, p.extreme + r)
        stale_and_flat = bar.close > p.entry - 0.5 * r
    if now - p.entry_ts >= cfg.max_hold_hours * 3600 and stale_and_flat:
        return "tempo scaduto", bar.close
    return None


@dataclass
class Setup:
    sides: str = "both"  # "long", "short" or "both"
    leverage: float = 3.0
    cap_pos: float = 0.10  # notional of one position, as a share of equity
    cap_total: float = 0.50  # notional of all positions together
    funding: bool = True
    crowd_filter: bool = False  # skip longs when funding says longs are crowded, and vice versa
    fee: float = 0.0005
    maintenance: float = 0.01
    # entry_filter(symbol, side, ts_ms) -> bool: an extra yes/no on each setup (research hooks)
    entry_filter: object = None
    # Desk rules that differ from the defaults, e.g. {"max_stop_pct": 12} (research hooks)
    rules: dict | None = None


def replay(data: dict, setup: Setup, start: int, end: int) -> dict:
    cfg = Settings(
        _env_file=None, exchange="binance", quote="USDT", timeframe="4h", fear_greed=False,
        leverage_levels=[], fee_rate=setup.fee, **(setup.rules or {}),
    )  # fmt: skip
    histories = {
        s: [c for c in candles if start - WARMUP * CANDLE_MS <= c.ts < end]
        for s, candles in data["klines"].items()
    }
    histories = {s: c for s, c in histories.items() if len(c) > scout.MIN_CANDLES}
    funding = data["funding"]
    index = {s: {c.ts: i for i, c in enumerate(cs)} for s, cs in histories.items()}
    timeline = sorted({c.ts for cs in histories.values() for c in cs})
    leader = "BTC/USDT"
    slip = cfg.slippage

    cash = peak = day_start = 1000.0
    day = ""
    max_dd = fees = paid_funding = 0.0
    positions: dict[str, Pos] = {}
    pending: list[tuple] = []
    cooldowns: dict[str, float] = {}
    trades: list[dict] = []
    last_price: dict[str, float] = {}

    def equity_now() -> float:
        return cash + sum(
            p.side * p.qty * (last_price.get(s, p.entry) - p.entry) for s, p in positions.items()
        )

    def close(p: Pos, price: float, when: float, reason: str, liquidated: bool = False) -> None:
        nonlocal cash, fees
        if liquidated:
            pnl, fee = -p.margin, 0.0
        else:
            price *= 1 - p.side * slip
            pnl = p.side * p.qty * (price - p.entry)
            fee = p.qty * price * setup.fee
        cash += pnl - fee
        fees += fee
        net = pnl - fee - p.fees - p.funding
        trades.append(
            {"symbol": p.symbol, "side": p.side, "entry_ts": p.entry_ts, "exit_ts": when,
             "pnl": net, "r": net / (p.risk * p.qty), "reason": reason}
        )  # fmt: skip
        if net < 0:
            cooldowns[p.symbol] = when + cfg.cooldown_hours * 3600
        del positions[p.symbol]
        last_price.pop(p.symbol, None)

    for ts in timeline:
        close_time = ts / 1000 + CANDLE_MS / 1000
        bars = {s: histories[s][i[ts]] for s, i in index.items() if ts in i}

        # 0. Funding, every 8 hours on the notional: longs pay a positive rate, shorts get it.
        if setup.funding and ts % FUNDING_MS == 0:
            for s, p in positions.items():
                rate = funding.get(s, {}).get(ts)
                if rate is not None and s in bars:
                    amount = p.side * p.qty * bars[s].open * rate
                    cash -= amount
                    p.funding += amount
                    paid_funding += amount

        # 1. Fill the entries decided at the previous close.
        for side, symbol, plan_entry, plan_stop, plan_target, notional in pending:
            bar = bars.get(symbol)
            if not bar or symbol in positions:
                continue
            equity = equity_now()
            free = equity - sum(p.margin for p in positions.values())
            notional = min(notional, free * setup.leverage)
            if notional < cfg.min_notional:
                continue
            price = bar.open * (1 + side * slip)
            shift = price - plan_entry
            qty = notional / price
            fee = notional * setup.fee
            cash -= fee
            fees += fee
            margin = notional / setup.leverage
            liq_move = 1 / setup.leverage - setup.maintenance
            positions[symbol] = Pos(
                symbol, side, qty, price, ts / 1000, plan_stop + shift, plan_stop + shift,
                plan_target + shift, price, margin, price * (1 - side * liq_move), fee,
            )  # fmt: skip
        pending = []

        # 2. Exits on this candle: liquidation first, then the desk's own rules.
        for symbol, p in list(positions.items()):
            bar = bars.get(symbol)
            if not bar:
                continue
            last_price[symbol] = bar.close
            gap_through = bar.open <= p.liquidation if p.side > 0 else bar.open >= p.liquidation
            if gap_through:
                close(p, p.liquidation, close_time, "liquidazione", liquidated=True)
                continue
            exit_ = check_exit(p, bar, close_time, cfg)
            if exit_:
                close(p, exit_[1], close_time, exit_[0])

        # 3. Mark the book.
        equity = equity_now()
        today = datetime.fromtimestamp(close_time, UTC).date().isoformat()
        if today != day:
            day, day_start = today, equity
        peak = max(peak, equity)
        max_dd = max(max_dd, (1 - equity / peak) * 100)

        # 4. New setups on the candles that just closed.
        if close_time * 1000 < start or leader not in bars:
            continue
        if equity <= day_start * (1 - cfg.max_daily_loss_pct / 100):
            continue
        i = index[leader][ts]
        btc = histories[leader][max(0, i - 200 + 1) : i + 1]
        if len(btc) < charts.SLOW:
            continue
        closes = [c.close for c in btc]
        regime = charts.trend_of(closes[-1], ema(closes, charts.FAST), ema(closes, charts.SLOW))
        side = 1 if regime == "up" else -1 if regime == "down" else 0
        if (
            side == 0
            or (setup.sides == "long" and side < 0)
            or (setup.sides == "short" and side > 0)
        ):
            continue
        candidates = []
        for symbol in bars:
            if symbol in positions or cooldowns.get(symbol, 0) > close_time:
                continue
            j = index[symbol][ts]
            window = histories[symbol][max(0, j - 200 + 1) : j + 1]
            if side > 0:
                c = scout.evaluate(symbol, window, 0.0, cfg)
                if not c:
                    continue
                plan = charts.plan(symbol, window, cfg)
                if not plan.valid:
                    continue
                candidates.append((c.rvol, symbol, plan.entry, plan.stop, plan.target))
            else:
                rvol = short_signal(window, cfg)
                plan = short_plan(window, cfg) if rvol else None
                if plan:
                    candidates.append((rvol, symbol, *plan))
        candidates.sort(reverse=True)
        exposure = sum(p.qty * last_price.get(s, p.entry) for s, p in positions.items())
        open_count = len(positions)
        for _, symbol, entry, stop, target in candidates:
            if open_count >= cfg.max_open_positions:
                break
            if setup.crowd_filter:
                rates = funding.get(symbol, {})
                recent = [rates[t] for t in rates if ts - 3 * FUNDING_MS < t <= ts]
                rate = fmean(recent) if recent else 0.0
                if (side > 0 and rate > 0.0003) or (side < 0 and rate < -0.0001):
                    continue
            if setup.entry_filter and not setup.entry_filter(symbol, side, ts + CANDLE_MS):
                continue
            distance = abs(entry - stop)
            if 2 * (setup.fee + slip) * entry / distance > cfg.max_cost_r:
                continue
            notional = equity * cfg.risk_per_trade_pct / 100 / distance * entry
            notional = min(notional, equity * setup.cap_pos, equity * setup.cap_total - exposure)
            if notional < cfg.min_notional:
                continue
            pending.append((side, symbol, entry, stop, target, notional))
            exposure += notional
            open_count += 1

    # Positions still open are valued at the last price.
    equity = equity_now()
    wins = sum(t["pnl"] for t in trades if t["pnl"] > 0)
    losses = -sum(t["pnl"] for t in trades if t["pnl"] < 0)
    btc = [c for c in data["klines"][leader] if start <= c.ts < end]
    return {
        "ret": round((equity / 1000 - 1) * 100, 1),
        "dd": round(max_dd, 1),
        "trades": len(trades),
        "long": sum(t["side"] > 0 for t in trades),
        "short": sum(t["side"] < 0 for t in trades),
        "pnl_long": round(sum(t["pnl"] for t in trades if t["side"] > 0), 1),
        "pnl_short": round(sum(t["pnl"] for t in trades if t["side"] < 0), 1),
        "pf": round(wins / losses, 2) if losses else None,
        "win": round(sum(t["pnl"] > 0 for t in trades) / len(trades) * 100) if trades else 0,
        "fees": round(fees, 1),
        "funding": round(paid_funding, 1),
        "liquidations": sum(t["reason"] == "liquidazione" for t in trades),
        "without_best2": round(
            (equity - sum(sorted((t["pnl"] for t in trades), reverse=True)[:2])) / 10 - 100, 1
        ),
        "btc": round((btc[-1].close / btc[0].open - 1) * 100, 1) if btc else None,
    }


SETUPS = {
    "solo rialzo, perpetui": Setup(sides="long"),
    "solo ribasso, perpetui": Setup(sides="short"),
    "rialzo e ribasso": Setup(sides="both"),
    "rialzo e ribasso, misura piena": Setup(sides="both", cap_pos=0.33, cap_total=1.5),
    "rialzo e ribasso, filtro affollamento": Setup(sides="both", crowd_filter=True),
}


def _job(args: tuple) -> dict:
    name, year = args
    data = pickle.loads((OUT / "perps.pkl").read_bytes())
    start, end = (
        int(datetime.fromisoformat(d).replace(tzinfo=UTC).timestamp() * 1000) for d in YEARS[year]
    )
    return {"setup": name, "year": year, **replay(data, SETUPS[name], start, end)}


def run() -> None:
    jobs = [(name, year) for name in SETUPS for year in YEARS]
    with ProcessPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(_job, jobs))
    (OUT / "perps.json").write_text(json.dumps(rows, indent=1))
    for r in rows:
        print(
            f"{r['setup']:<40} {r['year']:<7} {r['ret']:+7.1f}%  dd {r['dd']:4.1f}%  "
            f"n {r['trades']:3d} (L {r['long']} {r['pnl_long']:+.0f} / S {r['short']} "
            f"{r['pnl_short']:+.0f})  pf {r['pf']}  win {r['win']}%  fees {r['fees']}  "
            f"funding {r['funding']:+}  liq {r['liquidations']}  senza 2 migliori "
            f"{r['without_best2']:+.1f}%  BTC {r['btc']:+.1f}%"
        )


if __name__ == "__main__":
    {"download": download, "run": run}[sys.argv[1]]()
