"""Simulated leverage: what the desk's own trades would do on a perpetual contract.

Nothing here places an order or changes a decision. For every long the desk opens on
spot, each shadow book opens the same long on a simulated linear perpetual with
isolated margin, at its own leverage, and closes it when the desk sells, unless the
position is liquidated first.

The model, per position:
- margin M is the same share of the book's equity that the desk put into the spot
  trade; the position is worth N = M x leverage, so it holds N / entry units;
- the taker fee is charged on the whole notional, at the entry and at the exit;
- the long pays funding on the notional, `funding_rate_8h` every 8 hours, pro rata;
- isolated margin: when the price falls to entry x (1 - 1/leverage + maintenance),
  the position is liquidated and its margin is lost, but never more than its margin.

Only coins in `leverage_bases` are shadowed: large, established coins with deep
perpetual markets. Memecoins never are, and a trade on any coin outside the list stays
spot only.

Real exchanges move the liquidation price with fees and funding, use a mark price
rather than the last trade, and raise the maintenance margin for larger positions.
This is an estimate of the order of magnitude, not of the last cent.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from desk.config import Settings

FUNDING_PERIOD = 8 * 3600  # seconds between two funding payments on most exchanges
WIPED_OUT = 0.01  # a book under 1% of its starting capital takes no new positions


def base(symbol: str) -> str:
    """The coin of a pair: SOL for SOL/USD."""
    return symbol.split("/")[0].upper()


def allowed(symbol: str, cfg: Settings) -> bool:
    """Whether the simulation may shadow this market. Memecoins never are."""
    return base(symbol) in {coin.upper() for coin in cfg.leverage_bases}


def liquidation_price(entry: float, level: float, maintenance: float) -> float:
    """The price at which an isolated long at `level`x is liquidated. 0 means never."""
    if level <= 1:
        return 0.0  # no borrowed money: the position can lose its value but not be liquidated
    return max(0.0, entry * (1 - 1 / level + maintenance))


@dataclass(slots=True)
class Leg:
    """One leveraged shadow of a spot position."""

    symbol: str
    margin: float
    qty: float  # units held: margin x leverage / entry
    entry: float
    liquidation: float
    opened: float
    funding: float = 0.0  # paid so far
    funded_until: float = 0.0

    def value(self, price: float) -> float:
        """What closing now would give back before the exit fee. Never below zero."""
        return max(0.0, self.margin + self.qty * (price - self.entry) - self.funding)


@dataclass(slots=True)
class LegResult:
    symbol: str
    level: float
    margin: float
    entry: float
    exit: float
    opened: float
    closed: float
    pnl: float  # cash back minus margin and entry fee
    fees: float
    funding: float
    liquidated: bool


@dataclass(slots=True)
class Book:
    """One leverage level: its cash, open legs and record."""

    level: float
    start: float
    cash: float
    legs: dict[str, Leg] = field(default_factory=dict)
    fees: float = 0.0
    funding: float = 0.0
    liquidations: int = 0
    peak: float = 0.0
    max_drawdown_pct: float = 0.0
    wiped_at: float | None = None
    last_equity: float = 0.0
    results: list[LegResult] = field(default_factory=list)
    entry_fees: dict[str, float] = field(default_factory=dict)

    def equity(self, prices: dict[str, float]) -> float:
        return self.cash + sum(
            leg.value(prices.get(symbol, leg.entry)) for symbol, leg in self.legs.items()
        )

    def mark(self, prices: dict[str, float], now: float) -> float:
        """Update the peak, the drawdown and the wiped-out flag. Returns the equity."""
        equity = self.equity(prices)
        self.last_equity = equity
        self.peak = max(self.peak, equity)
        if self.peak > 0:
            self.max_drawdown_pct = max(self.max_drawdown_pct, (1 - equity / self.peak) * 100)
        if self.wiped_at is None and equity < self.start * WIPED_OUT:
            self.wiped_at = now
        return equity

    def open(
        self,
        symbol: str,
        share: float,
        entry: float,
        now: float,
        cfg: Settings,
        prices: dict[str, float],
    ) -> Leg | None:
        """Put `share` of the book's equity up as margin for a long at `entry`."""
        if symbol in self.legs or self.wiped_at is not None or share <= 0:
            return None
        fee_rate = cfg.futures_fee_rate
        margin = share * self.equity(prices)
        # Margin and the entry fee both come out of cash.
        margin = min(margin, self.cash / (1 + self.level * fee_rate))
        if margin <= 0:
            return None
        qty = margin * self.level / entry
        fee = qty * entry * fee_rate
        self.cash -= margin + fee
        self.fees += fee
        leg = Leg(
            symbol,
            margin,
            qty,
            entry,
            liquidation_price(entry, self.level, cfg.maintenance_margin),
            now,
            funded_until=now,
        )
        self.legs[symbol] = leg
        self.entry_fees[symbol] = fee
        return leg

    def accrue(self, symbol: str, price: float, now: float, cfg: Settings) -> None:
        """Charge the funding due since the last charge, on the position's value now."""
        leg = self.legs.get(symbol)
        if not leg or now <= leg.funded_until:
            return
        due = leg.qty * price * cfg.funding_rate_8h * (now - leg.funded_until) / FUNDING_PERIOD
        leg.funding += due
        self.funding += due
        leg.funded_until = now

    def close(self, symbol: str, price: float, now: float, cfg: Settings) -> LegResult | None:
        """Close at `price` when the desk sells. Isolated margin: never lose more than it."""
        leg = self.legs.pop(symbol, None)
        if not leg:
            return None
        fee = leg.qty * price * cfg.futures_fee_rate
        back = max(0.0, leg.value(price) - fee)
        fee = min(fee, leg.value(price))  # an empty position pays no fee it cannot cover
        self.cash += back
        self.fees += fee
        return self._record(leg, price, now, back, fee, liquidated=False)

    def liquidate(self, symbol: str, now: float) -> LegResult | None:
        """The price reached the liquidation level: the margin is gone."""
        leg = self.legs.pop(symbol, None)
        if not leg:
            return None
        self.liquidations += 1
        return self._record(leg, leg.liquidation, now, 0.0, 0.0, liquidated=True)

    def _record(
        self, leg: Leg, price: float, now: float, back: float, exit_fee: float, liquidated: bool
    ) -> LegResult:
        entry_fee = self.entry_fees.pop(leg.symbol, 0.0)
        result = LegResult(
            leg.symbol,
            self.level,
            leg.margin,
            leg.entry,
            price,
            leg.opened,
            now,
            back - leg.margin - entry_fee,
            entry_fee + exit_fee,
            leg.funding,
            liquidated,
        )
        self.results.append(result)
        return result


def liquidated_first(leg: Leg, *, open_: float, low: float, stop: float) -> bool:
    """Whether a candle (or a tick, with open = low = price) liquidates the leg before the
    desk's own stop can close it.

    Going down, the price meets the higher of the two levels first. A candle that opens
    at or below the liquidation price liquidates at once, whatever the stop.
    """
    if leg.liquidation <= 0 or low > leg.liquidation:
        return False
    return open_ <= leg.liquidation or leg.liquidation >= stop


def book_state(book: Book) -> dict:
    """Everything needed to carry a book across restarts, closed results excluded."""
    return {
        "level": book.level,
        "start": book.start,
        "cash": book.cash,
        "fees": book.fees,
        "funding": book.funding,
        "liquidations": book.liquidations,
        "peak": book.peak,
        "max_drawdown_pct": book.max_drawdown_pct,
        "wiped_at": book.wiped_at,
        "last_equity": book.last_equity,
        "entry_fees": book.entry_fees,
        "legs": {
            symbol: {
                "margin": leg.margin,
                "qty": leg.qty,
                "entry": leg.entry,
                "liquidation": leg.liquidation,
                "opened": leg.opened,
                "funding": leg.funding,
                "funded_until": leg.funded_until,
            }
            for symbol, leg in book.legs.items()
        },
    }


def book_from_state(state: dict) -> Book:
    book = Book(
        level=state["level"],
        start=state["start"],
        cash=state["cash"],
        fees=state["fees"],
        funding=state["funding"],
        liquidations=state["liquidations"],
        peak=state["peak"],
        max_drawdown_pct=state["max_drawdown_pct"],
        wiped_at=state["wiped_at"],
        last_equity=state["last_equity"],
        entry_fees=dict(state["entry_fees"]),
    )
    for symbol, leg in state["legs"].items():
        book.legs[symbol] = Leg(symbol=symbol, **leg)
    return book


def books(cfg: Settings) -> list[Book]:
    return [
        Book(level=float(level), start=cfg.capital, cash=cfg.capital, peak=cfg.capital)
        for level in cfg.leverage_levels
    ]
