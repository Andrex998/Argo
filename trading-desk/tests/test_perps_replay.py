"""The live perpetuals desk against research/perps.py, the replay its rules come from.

A made-up market of seven coins, with BTC rising, falling and drifting in turn, volume
surges that break out in the trend's direction (half of them fail), funding every 8
hours and an open interest reading at every close. The research replays it with
research/derivs.py's rule C as its entry filter; the live desk (PerpsDesk, its broker,
its store) is driven candle by candle over the same history. Both must end with the same
trades, side by side, and the same money.
"""

import importlib.util
import math
import pickle
import random
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import pytest

from desk import perps
from desk.broker import PerpsPaperBroker
from desk.config import Settings
from desk.market import MarketError
from desk.models import Candle, PerpPosition
from desk.perps_desk import PerpsDesk
from desk.store import Store

RESEARCH = Path(__file__).parent.parent / "research"


def _research():
    spec = importlib.util.spec_from_file_location("research_perps", RESEARCH / "perps.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # dataclasses look their module up while it loads
    spec.loader.exec_module(module)
    return module


research = _research()
H4, FUNDING_MS = research.CANDLE_MS, research.FUNDING_MS
RISK = Settings(_env_file=None, market="perps").perps_risk_per_trade_pct  # the desk's own
T0 = 1_700_006_400_000  # 15/11/2023 00:00 UTC: a funding hour
COINS = ("BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "LINK")
SOL, SOL_R = "SOL/USDT:USDT", "SOL/USDT"  # the desk's symbol, and the research's
BARS = 900
START = T0 + research.WARMUP * H4


def history(seed: int) -> tuple[dict, dict]:
    """The research's data format, plus an open interest growth per (symbol, close)."""
    rng = random.Random(seed)

    def drift(i: int) -> float:
        return (0.003, -0.003, 0.0)[(i // 160) % 3]  # up, down, sideways, in turn

    btc = [drift(i) + rng.gauss(0, 0.011) for i in range(BARS)]
    klines, funding, growth = {}, {}, {}
    for k, coin in enumerate(COINS):
        symbol, price, script, rates, candles = f"{coin}/USDT", 50.0 * (k + 1), [], {}, []
        for i in range(BARS):
            ts = T0 + i * H4
            move = btc[i] if coin == "BTC" else 0.8 * btc[i] + rng.gauss(0, 0.01)
            volume = 1000 * math.exp(rng.gauss(0, 0.2))
            if coin != "BTC" and not script and drift(i) and rng.random() < 0.03:
                way = math.copysign(1, drift(i))
                script = [(way * rng.uniform(0.012, 0.02), rng.uniform(3.5, 5)) for _ in range(3)]
                if rng.random() < 0.5:  # a breakout that fails
                    script += [(-way * rng.uniform(0.01, 0.025), 1.5)] * rng.randint(1, 4)
            if script:
                move, surge = script.pop(0)
                volume *= surge
            close = price * math.exp(move)
            high = max(price, close) * (1 + abs(rng.gauss(0, 0.003)))
            low = min(price, close) * (1 - abs(rng.gauss(0, 0.003)))
            candles.append(Candle(ts, price, high, low, close, volume))  # opens at the last close
            price = close
            if ts % FUNDING_MS == 0:
                rates[ts] = 0.0001 + rng.gauss(0, 0.00025)
            growth[symbol, ts + H4] = None if rng.random() < 0.1 else rng.gauss(0.01, 0.04)
        klines[symbol], funding[symbol] = candles, rates
    return {"klines": klines, "funding": funding}, growth


class Replay:
    """A perpetuals market that shows the history up to one candle."""

    candle_ms = H4

    def __init__(self, data: dict, growth: dict):
        self.klines = {f"{s}:USDT": candles for s, candles in data["klines"].items()}
        self.rates = {f"{s}:USDT": rates for s, rates in data["funding"].items()}
        self.growth = {(f"{s}:USDT", ts): g for (s, ts), g in growth.items()}
        self.index = {s: {c.ts: i for i, c in enumerate(cs)} for s, cs in self.klines.items()}
        self.ts = 0

    def bars(self) -> dict[str, Candle]:
        return {s: self.klines[s][i[self.ts]] for s, i in self.index.items() if self.ts in i}

    def universe(self):
        return [(s, 1e7) for s, i in self.index.items() if self.ts in i]

    def candles(self, symbol, limit=200):
        i = self.index[symbol].get(self.ts)
        if i is None:
            raise MarketError(f"{symbol}: nessuna candela")
        return self.klines[symbol][max(0, i - limit + 1) : i + 1]

    def price(self, symbol):
        return self.candles(symbol, 1)[-1].close

    def funding_rate(self, symbol):
        return self.rates[symbol].get(self.ts, 0.0)

    def open_interest_growth(self, symbol):
        return self.growth.get((symbol, self.ts + H4))

    def lowest_since(self, symbol, since):
        return None

    def highest_since(self, symbol, since):
        return None


class Clock:
    now = 0.0

    def __call__(self):
        return self.now


def live(market: Replay, start: int = START, **settings) -> PerpsDesk:
    """The live desk, candle by candle, in the order the research uses: funding at the
    open, exits on the candle, the book marked at the close, new setups at the close.
    An entry fills at the close, which is the next candle's open in these histories."""
    # The research has no drawdown halt: the desk's 15% must not stop it where that would.
    cfg = Settings(
        _env_file=None,
        market="perps",
        fear_greed=False,
        perps_max_drawdown_pct=40.0,  # the highest the desk allows
        perps_fee_rate=0.0005,  # the research's fee, Binance's
        **settings,
    )
    clock = Clock()
    desk = PerpsDesk(cfg, market, PerpsPaperBroker(cfg), Store(":memory:"), clock=clock)
    for ts in sorted({c.ts for candles in market.klines.values() for c in candles}):
        market.ts = ts
        bars = market.bars()
        if ts % FUNDING_MS == 0:
            clock.now = ts / 1000
            for pos in desk.store.perps_positions():
                if pos.symbol in bars:
                    desk._fund(pos, bars[pos.symbol].open, clock.now)
        clock.now = close = (ts + H4) / 1000
        for pos in desk.store.perps_positions():
            if bar := bars.get(pos.symbol):
                desk._watch(
                    pos, open_=bar.open, high=bar.high, low=bar.low, close=bar.close, now=close
                )
        desk.book()  # rolls the trading day and the peak, as the research marks its book
        if close * 1000 >= start and "BTC/USDT:USDT" in bars:
            desk._look_for_entries()
    return desk


def agree(mine: dict, theirs: dict, money: float = 0.15, share: float = 0.0) -> None:
    """The same trades, and the same money within `money`, or within `share` of each
    figure (the research rounds to 0.1)."""
    for key in ("trades", "long", "short", "liquidations"):
        assert mine[key] == theirs[key], key
    for key in ("ret", "pnl_long", "pnl_short", "fees", "funding"):
        assert mine[key] == pytest.approx(theirs[key], abs=money, rel=share), key


def figures(desk: PerpsDesk) -> dict:
    """The research's own summary, from the live desk's book."""
    trades, still_open = desk.store.perps_trades(), desk.store.perps_positions()
    by_side = {side: [t for t in trades if t.side == side] for side in ("long", "short")}
    return {
        "ret": (desk.book().equity / 1000 - 1) * 100,
        "trades": len(trades),
        "long": len(by_side["long"]),
        "short": len(by_side["short"]),
        "pnl_long": sum(t.pnl for t in by_side["long"]),
        "pnl_short": sum(t.pnl for t in by_side["short"]),
        "fees": sum(t.fees for t in trades) + sum(p.fees for p in still_open),
        "funding": sum(t.funding for t in trades) + sum(p.funding for p in still_open),
        "liquidations": sum(t.reason == "liquidazione" for t in trades),
    }


@pytest.mark.parametrize("seed", [4, 9])
def test_the_live_desk_trades_like_the_research(seed):
    data, growth = history(seed)
    setup = research.Setup(sides="both", cap_pos=0.33, cap_total=1.5)  # the desk's defaults
    pcfg = Settings(_env_file=None, market="perps")
    setup.rules = {"max_stop_pct": pcfg.max_stop_pct, "risk_per_trade_pct": pcfg.risk_per_trade_pct}
    setup.entry_filter = lambda symbol, side, ts: (g := growth[symbol, ts]) is None or g > 0
    theirs = research.replay(data, setup, START, T0 + BARS * H4)

    desk = live(Replay(data, growth))
    agree(figures(desk), theirs)
    # The history exercises every rule: both sides, every exit, and the open interest.
    assert theirs["long"] >= 5 and theirs["short"] >= 5
    reasons = Counter(t.reason for t in desk.store.perps_trades())
    assert {"stop-loss", "pareggio", "trailing-stop", "tempo scaduto"} <= set(reasons)
    journal = [e.message for e in desk.store.events(100_000)]
    assert any(m.startswith("scartato: posizioni aperte sul mercato") for m in journal)
    assert any("entrata senza filtro" in m for m in journal)


def test_exits_match_the_research_candle_by_candle():
    """research.check_exit and perps.check_exit on the same random positions and candles:
    the same exits, the same stops and the same best prices, on both sides."""
    rng = random.Random(11)
    cfg = Settings(_env_file=None, market="perps")
    research_cfg = Settings(_env_file=None, fee_rate=cfg.perps_fee_rate)  # as the research sets
    for _ in range(400):
        side = rng.choice((1, -1))
        entry = rng.uniform(10, 1000)
        r = entry * rng.uniform(0.015, 0.08)
        stop, target = entry - side * r, entry + side * 3 * r
        theirs = research.Pos(SOL_R, side, 1.0, entry, 0.0, stop, stop, target, entry, 1, 1, 0)
        mine = PerpPosition(
            SOL, "long" if side > 0 else "short", 1.0, entry, 0.0, stop, stop, target, entry,
            1.0, 1.0, 1.0, 0.0,
        )  # fmt: skip
        price = entry
        for n in range(1, 25):
            o = price * math.exp(rng.gauss(0, 0.02))
            c = o * math.exp(rng.gauss(0, 0.02))
            h, low = max(o, c) * (1 + rng.uniform(0, 0.02)), min(o, c) * (1 - rng.uniform(0, 0.02))
            now = n * 4 * 3600.0
            expected = research.check_exit(theirs, Candle(0, o, h, low, c, 1.0), now, research_cfg)
            got = perps.check_exit(mine, open_=o, high=h, low=low, close=c, now=now, cfg=cfg)
            if expected:
                assert got is not None and (got.reason, got.price) == expected
                break
            assert got is None
            assert (mine.stop, mine.best) == (theirs.stop, theirs.extreme)
            price = c


def test_short_setups_match_the_research():
    """The mirrored Scout and Charts against research.short_signal and short_plan, on every
    window of the made-up history."""
    data, _ = history(4)
    cfg = Settings(_env_file=None, market="perps")
    research_cfg = Settings(_env_file=None, exchange="binance", quote="USDT", timeframe="4h")
    checked = 0
    for symbol, candles in data["klines"].items():
        for i in range(100, len(candles)):
            window = candles[max(0, i - 199) : i + 1]
            rvol = research.short_signal(window, research_cfg)
            flagged = perps.signal(symbol, window, 0.0, cfg)
            short = flagged if flagged and flagged.side == "short" else None
            assert (short.rvol if short else None) == rvol
            if rvol:
                plan = perps.short_plan(symbol, window, cfg)
                expected = research.short_plan(window, research_cfg)
                assert ((plan.entry, plan.stop, plan.target) if plan.valid else None) == expected
                checked += plan.valid
    assert checked >= 5


@pytest.mark.skipif(
    not (RESEARCH / "perps.pkl").exists() or not (RESEARCH / "derivs.pkl").exists(),
    reason="the research's data is not downloaded (research/perps.py, research/derivs.py)",
)
@pytest.mark.parametrize("max_stop", [8.0, 12.0])  # the rule of the research, and today's
def test_three_real_years_with_rule_c(max_stop):
    """The research's three years of Binance perpetuals, at the desk's defaults: full size
    and rule C. Its 36 coins are allowed here, ten of them outside `leverage_bases`."""
    sys.path.insert(0, str(RESEARCH))
    import derivs  # research/derivs.py

    full = pickle.loads((RESEARCH / "perps.pkl").read_bytes())
    metrics = pickle.loads((RESEARCH / "derivs.pkl").read_bytes())
    start, end = (
        int(datetime.fromisoformat(day).replace(tzinfo=UTC).timestamp() * 1000)
        for day in research.YEARS["3 anni"]
    )
    since = start - research.WARMUP * H4
    data = {
        "klines": {s: [c for c in cs if since <= c.ts < end] for s, cs in full["klines"].items()},
        "funding": full["funding"],
    }
    setup = research.Setup(sides="both", cap_pos=0.33, cap_total=1.5)
    setup.rules = {"max_stop_pct": max_stop, "risk_per_trade_pct": RISK}
    setup.entry_filter = derivs.make_filter("C", metrics)
    theirs = research.replay(data, setup, start, end)

    positioning = {f"{s}:USDT": derivs.Positioning(rows) for s, rows in metrics.items()}

    class WithOpenInterest(Replay):
        def open_interest_growth(self, symbol):
            p = positioning.get(symbol)
            return p.oi_growth(self.ts + H4) if p else None

    coins = [s.split("/")[0] for s in data["klines"]]
    market = WithOpenInterest(data, {})
    desk = live(market, start, leverage_bases=coins, perps_max_stop_pct=max_stop)  # at RISK
    # Within a candle the live desk sizes each entry on the book after the one before, and
    # sizing follows equity: at the desk's 1.5% risk a dollar or so on the 256 trades of an 8%
    # cap, a few dollars on the 412 of a 12% cap, under 2% of each figure either way. The
    # trades themselves are the same.
    agree(figures(desk), theirs, money=1.0, share=0.02)
    assert theirs["trades"] > 200 and theirs["liquidations"] == 0
