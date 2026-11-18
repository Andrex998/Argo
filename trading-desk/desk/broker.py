"""Order execution: simulated fills for paper trading, real market orders for live.

Perpetual futures are paper only: `PerpsPaperBroker` simulates them, and `LiveBroker`
refuses to start on them.
"""

from __future__ import annotations

import time
from typing import Protocol

import ccxt

from desk.config import Settings
from desk.models import SIGN, Fill, Side


class BrokerError(Exception):
    """An order could not be placed or did not fill."""


class Broker(Protocol):
    def buy(self, symbol: str, qty: float, ref_price: float) -> Fill: ...

    def sell(self, symbol: str, qty: float, ref_price: float) -> Fill: ...


class PerpsBroker(Protocol):
    def open(self, symbol: str, side: Side, qty: float, ref_price: float) -> Fill: ...

    def close(
        self, symbol: str, side: Side, qty: float, entry: float, ref_price: float
    ) -> Fill: ...


class PaperBroker:
    """Fills at the reference price made worse by slippage, then charges the taker fee."""

    def __init__(self, cfg: Settings):
        self.fee_rate = cfg.fee_rate
        self.slippage = cfg.slippage

    def buy(self, symbol: str, qty: float, ref_price: float) -> Fill:
        price = ref_price * (1 + self.slippage)
        fee = qty * price * self.fee_rate
        return Fill(qty, price, fee, -(qty * price + fee))

    def sell(self, symbol: str, qty: float, ref_price: float) -> Fill:
        price = ref_price * (1 - self.slippage)
        fee = qty * price * self.fee_rate
        return Fill(qty, price, fee, qty * price - fee)


class PerpsPaperBroker:
    """Simulated fills on a perpetual contract: the reference price made worse by slippage,
    the taker fee on the whole notional.

    The account is margin-based: opening moves only the fee out of cash, and the profit or
    loss is settled when the position closes.
    """

    def __init__(self, cfg: Settings):
        self.fee_rate = cfg.perps_fee_rate
        self.slippage = cfg.slippage

    def open(self, symbol: str, side: Side, qty: float, ref_price: float) -> Fill:
        price = ref_price * (1 + SIGN[side] * self.slippage)
        fee = qty * price * self.fee_rate
        return Fill(qty, price, fee, -fee)

    def close(self, symbol: str, side: Side, qty: float, entry: float, ref_price: float) -> Fill:
        s = SIGN[side]
        price = ref_price * (1 - s * self.slippage)
        fee = qty * price * self.fee_rate
        return Fill(qty, price, fee, s * qty * (price - entry) - fee)


class LiveBroker:
    """Market orders on a real exchange through ccxt.

    It only ever buys and sells spot. There is no withdrawal or transfer call in
    this class, and the API key should not have those permissions either.
    """

    SETTLE_ATTEMPTS = 10

    def __init__(self, exchange: ccxt.Exchange, cfg: Settings):
        if cfg.market != "spot":
            raise BrokerError("i perpetui sono solo in paper trading: nessun ordine vero")
        self.ex = exchange
        self.quote = cfg.quote
        try:
            self.ex.load_markets()
        except ccxt.BaseError as e:
            raise BrokerError(f"connessione a {cfg.exchange} fallita: {e}") from e

    def free(self, currency: str) -> float:
        try:
            balance = self.ex.fetch_balance()
        except ccxt.BaseError as e:
            raise BrokerError(f"lettura saldo fallita: {e}") from e
        return float((balance.get(currency) or {}).get("free") or 0.0)

    def buy(self, symbol: str, qty: float, ref_price: float) -> Fill:
        amount = float(self.ex.amount_to_precision(symbol, qty))
        self._check_limits(symbol, amount, ref_price)
        # Some exchanges size market buys in quote currency and need a price to convert.
        price = ref_price if self.ex.options.get("createMarketBuyOrderRequiresPrice") else None
        return self._execute(symbol, "buy", amount, price, ref_price)

    def sell(self, symbol: str, qty: float, ref_price: float) -> Fill:
        # A buy fee paid in the base asset leaves slightly less than was bought.
        held = self.free(self.ex.market(symbol)["base"])
        amount = float(self.ex.amount_to_precision(symbol, min(qty, held)))
        if amount <= 0:
            raise BrokerError(f"{symbol}: nessun saldo da vendere")
        return self._execute(symbol, "sell", amount, None, ref_price)

    def _check_limits(self, symbol: str, amount: float, ref_price: float) -> None:
        limits = self.ex.market(symbol).get("limits") or {}
        min_amount = (limits.get("amount") or {}).get("min") or 0
        min_cost = (limits.get("cost") or {}).get("min") or 0
        if amount <= 0 or amount < min_amount or amount * ref_price < min_cost:
            raise BrokerError(f"{symbol}: ordine sotto il minimo dell'exchange")

    def _settle(self, symbol: str, order: dict) -> dict:
        """Wait until the exchange reports the fill. Most return it with the order itself."""
        for _ in range(self.SETTLE_ATTEMPTS):
            if order.get("status") == "closed" and order.get("filled"):
                return order
            time.sleep(1)
            try:
                order = self.ex.fetch_order(order["id"], symbol)
            except ccxt.BaseError:
                continue
        raise BrokerError(
            f"{symbol}: ordine {order.get('id')} inviato ma non confermato, "
            "controlla sull'exchange prima di riavviare"
        )

    def _execute(
        self, symbol: str, side: str, amount: float, price: float | None, ref_price: float
    ) -> Fill:
        try:
            order = self.ex.create_order(symbol, "market", side, amount, price)
        except ccxt.BaseError as e:
            raise BrokerError(f"{symbol} {side}: {e}") from e
        order = self._settle(symbol, order)

        filled = float(order["filled"])
        average = float(order.get("average") or order.get("price") or ref_price)

        base = self.ex.market(symbol)["base"]
        fee_quote = fee_base = 0.0
        for fee in order.get("fees") or ([order["fee"]] if order.get("fee") else []):
            cost = float(fee.get("cost") or 0)
            if fee.get("currency") == base:
                fee_base += cost
            elif fee.get("currency") == self.quote:
                fee_quote += cost
            # A fee paid in a third asset (an exchange token) is not tracked.

        fee_total = fee_quote + fee_base * average
        if side == "buy":
            return Fill(filled - fee_base, average, fee_total, -(filled * average + fee_quote))
        return Fill(filled, average, fee_total, filled * average - fee_quote)
