"""The perpetuals desk: long and short on USDT perpetual futures, paper only.

The spot desk's loop (Scout, Charts, Risk, the analysts, Executor and the journal) on the
rules of desk/perps.py. The research replayed the rules alone; with the analysts on, a
setup the rules allow is also discussed by them first, with prompts written for its
direction and the contract's funding and open interest in the brief. Its book is
margin-based: cash pays only fees and funding until a position closes, and the equity
counts every position's open profit or loss.
"""

from __future__ import annotations

from desk import leverage, perps, risk
from desk.agents import analysts
from desk.broker import BrokerError, PerpsBroker
from desk.desk import Desk, mark_prices, roll_book
from desk.market import MarketError, PerpsData
from desk.models import SIGN, Candidate, Candle, ChartPlan, PerpPosition
from desk.store import PerpTrade, Store

NAME = perps.SIDE_NAME
GAIN = {"long": "si guadagna se il prezzo sale", "short": "si guadagna se il prezzo scende"}


class PerpsDesk(Desk):
    """The desk on perpetual contracts. Its broker only simulates: there is no live mode."""

    market: PerpsData
    broker: PerpsBroker

    def _shadow_books(self) -> list[leverage.Book]:
        return []  # this desk trades the perpetuals itself: there is nothing to shadow

    def book(self) -> risk.Book:
        return value_perps_book(self.store, self.market, self.clock())

    # --- exits ----------------------------------------------------------------

    def monitor(self) -> None:
        """Check every open position: liquidation first, then funding, the stop, the
        trailing stop and the time limit."""
        for pos in self.store.perps_positions():
            try:
                price = self.market.price(pos.symbol)
            except MarketError as e:
                self.say("EXECUTOR", f"prezzo non disponibile, riprovo: {e}", pos.symbol, "error")
                continue
            now = self.clock()
            if not self._catch_up(pos, price, now):
                self._watch(pos, open_=price, high=price, low=price, close=price, now=now)
        self._pulse()

    def close_all(self, reason: str = "chiusura manuale") -> None:
        for pos in self.store.perps_positions():
            try:
                price = self.market.price(pos.symbol)
            except MarketError as e:
                self.say("EXECUTOR", f"chiusura non riuscita: {e}", pos.symbol, "error")
                continue
            # close-all runs while `desk run` is stopped: settle that time first.
            if self._catch_up(pos, price, self.clock()):
                continue
            if perps.liquidated(pos, open_=price, high=price, low=price):
                self._liquidate(pos)
            else:
                self.close(pos, price, reason)
        self._pulse()

    def _catch_up(self, pos: PerpPosition, price: float, now: float) -> bool:
        """Settle what happened since the last check: a liquidation while the desk was not
        watching, then the funding due. Returns True when the position is gone."""
        if now - pos.checked > self._gap_seconds() and self._liquidated_in_gap(pos):
            return True
        self._fund(pos, price, now)
        return False

    def _watch(
        self, pos: PerpPosition, *, open_: float, high: float, low: float, close: float, now: float
    ) -> bool:
        """Move a position on by one observation: a tick when live, a candle in a replay.
        Returns True when the position closed."""
        if perps.liquidated(pos, open_=open_, high=high, low=low):
            self._liquidate(pos)
            return True
        stop_before = pos.stop
        trailing_before = perps.reached(pos.sign, pos.best, pos.target)
        exit_ = perps.check_exit(
            pos, open_=open_, high=high, low=low, close=close, now=now, cfg=self.cfg
        )
        if exit_:
            self.close(pos, exit_.price, exit_.reason)
            return True
        pos.checked = now
        self.store.save_perps_position(pos)
        self._tell_stop(pos, stop_before, trailing_before)
        return False

    def _tell_stop(self, pos: PerpPosition, stop_before: float, trailing_before: bool) -> None:
        s = pos.sign
        if not trailing_before and perps.reached(s, pos.best, pos.target):
            self.say(
                "EXECUTOR",
                f"target raggiunto: da ora lo stop segue il prezzo, adesso a {pos.stop:g}",
                pos.symbol,
                "stop_moved",
                stop=pos.stop,
                mode="trailing",
            )
        elif perps.reached(-s, stop_before, pos.initial_stop) and not perps.reached(
            -s, pos.stop, pos.initial_stop
        ):
            moved = "alzato" if s > 0 else "abbassato"
            self.say(
                "EXECUTOR",
                f"stop {moved} a pareggio ({pos.stop:g}): questa operazione non può più perdere",
                pos.symbol,
                "stop_moved",
                stop=pos.stop,
                mode="breakeven",
            )

    def _liquidated_in_gap(self, pos: PerpPosition) -> bool:
        """After a gap in the checks (PC asleep, desk stopped, no connection) the worst price
        traded during the gap counts as well: the exchange liquidates whether the desk is
        watching or not, and the desk's own stop could not have closed the position first."""
        read = self.market.lowest_since if pos.sign > 0 else self.market.highest_since
        try:
            worst = read(pos.symbol, pos.checked)
        except MarketError:
            return False  # the price now is still checked; the gap stays unread
        if worst is None or not perps.reached(-pos.sign, worst, pos.liquidation):
            return False
        extreme = "minimo" if pos.sign > 0 else "massimo"
        self._liquidate(pos, f" mentre il desk non controllava ({extreme} {worst:g})")
        return True

    def _funding_period(self, symbol: str) -> float:
        """The contract's funding interval in seconds: usually 8 hours, on Bybit some
        contracts settle every 4 hours or every hour."""
        try:
            interval = getattr(self.market, "funding_interval", None)
            return interval(symbol) if interval else perps.FUNDING_PERIOD
        except MarketError:
            return perps.FUNDING_PERIOD

    def _fund(self, pos: PerpPosition, price: float, now: float) -> None:
        """Settle the funding due since the last settlement, on the notional, at the
        contract's own interval."""
        due = perps.funding_times(pos.funded_until, now, self._funding_period(pos.symbol))
        if not due:
            return
        try:
            rate = self.market.funding_rate(pos.symbol)
        except MarketError as e:
            self.say("EXECUTOR", f"funding non disponibile, riprovo: {e}", pos.symbol, "error")
            return
        amount = len(due) * perps.funding(pos, price, rate)
        self.store.add("cash", -amount)
        pos.funding += amount
        pos.funded_until = due[-1]
        self.store.save_perps_position(pos)
        if not amount:
            return
        payer = "i long pagano gli short" if rate > 0 else "gli short pagano i long"
        missed = f", {len(due)} scadenze mentre il desk era fermo" if len(due) > 1 else ""
        self.say(
            "EXECUTOR",
            f"funding {'pagato' if amount > 0 else 'incassato'}: {abs(amount):.4f} "
            f"{self.cfg.quote} (tasso {rate:+.4%}: {payer}{missed})",
            pos.symbol,
            "funding",
            amount=amount,
            rate=rate,
            periods=len(due),
        )

    def _liquidate(self, pos: PerpPosition, when: str = "") -> None:
        """The price reached the liquidation level: the exchange keeps the margin."""
        self.store.add("cash", -pos.margin)
        trade = self._record(pos, pos.liquidation, "liquidazione", -pos.margin)
        q = self.cfg.quote
        self.say(
            "EXECUTOR",
            f"{NAME[pos.side]} liquidata a {pos.liquidation:g}{when}: persi {pos.margin:.2f} {q} "
            f"di margine ({trade.pnl:+.2f} {q} con commissioni e funding)",
            pos.symbol,
            "liquidation",
            side=pos.side,
            price=pos.liquidation,
            pnl=trade.pnl,
            r=trade.r_multiple,
        )

    def close(self, pos: PerpPosition, ref_price: float, reason: str) -> None:
        try:
            fill = self.broker.close(pos.symbol, pos.side, pos.qty, pos.entry_price, ref_price)
        except BrokerError as e:
            self.say(
                "EXECUTOR",
                f"chiusura fallita, riprovo al prossimo controllo: {e}",
                pos.symbol,
                "error",
            )
            return
        self.store.add("cash", fill.quote_delta)
        trade = self._record(pos, fill.price, reason, fill.quote_delta, fill.fee)
        q = self.cfg.quote
        done = "venduto" if pos.side == "long" else "ricomprato"
        funding = ""
        if pos.funding:
            paid = "pagato" if pos.funding > 0 else "incassato"
            funding = f" · funding {paid} in tutto {abs(pos.funding):.2f} {q}"
        self.say(
            "EXECUTOR",
            f"{NAME[pos.side]} chiusa: {done} a {fill.price:g} ({reason}), {trade.pnl:+.2f} {q}, "
            f"{trade.r_multiple:+.1f}R{funding}",
            pos.symbol,
            "close",
            side=pos.side,
            price=fill.price,
            reason=reason,
            pnl=trade.pnl,
            r=trade.r_multiple,
            funding=pos.funding,
        )

    def _record(
        self,
        pos: PerpPosition,
        exit_price: float,
        reason: str,
        settled: float,
        exit_fee: float = 0.0,
    ) -> PerpTrade:
        """Book a closed position. `settled` is what the close moved into cash: the profit
        or loss less the exit fee, or minus the margin on a liquidation."""
        now = self.clock()
        pnl = settled - pos.fees - pos.funding
        trade = PerpTrade(
            pos.symbol,
            pos.side,
            pos.qty,
            pos.entry_price,
            exit_price,
            pos.entry_ts,
            now,
            pnl,
            pnl / (pos.risk_per_unit * pos.qty),
            reason,
            pos.leverage,
            pos.margin,
            pos.fees + exit_fee,
            pos.funding,
        )
        self.store.delete_perps_position(pos.symbol)
        self.store.add_perps_trade(trade)
        if pnl < 0:
            self.store.set_cooldown(pos.symbol, now + self.cfg.cooldown_hours * 3600)
        return trade

    # --- entries --------------------------------------------------------------

    def _look_for_entries(self) -> bool:
        scan = self._scan(perps.signal)
        if scan is None:
            return False
        if not scan.candidates:
            return True
        book = self.book()
        side, why = self._regime()
        if reason := risk.blocked(book, self.cfg) or why:
            self.say("RISK", f"nessuna nuova entrata: {reason}", kind="blocked")
            return True
        for candidate in scan.candidates:
            if self._consider(candidate, scan.candles[candidate.symbol], side, book):
                book = self.book()
        return True

    def _flagged(self, candidate: Candidate) -> tuple[str, dict]:
        move = "in salita" if candidate.side == "long" else "in calo"
        return f"{candidate.symbol} {candidate.rvol:.1f}x {move}", {
            "symbol": candidate.symbol,
            "rvol": candidate.rvol,
            "side": candidate.side,
        }

    def _regime(self) -> tuple[int, str]:
        """The side BTC's trend allows (+1 long, -1 short), or 0 and why neither is."""
        leader = perps.leader(self.cfg)
        try:
            candles = self.market.candles(leader)
        except MarketError as e:
            return 0, f"trend di {leader} non verificabile in questo momento ({e})"
        side = perps.regime(candles)
        if not side:
            return 0, f"{leader} senza una direzione: né long né short finché non ne prende una"
        return side, ""

    def _consider(
        self, candidate: Candidate, candles: list[Candle], side: int, book: risk.Book
    ) -> bool:
        """Take one flagged market through Charts, Risk, the open interest and the analysts.
        Returns True when a position was opened."""
        symbol = candidate.symbol
        if SIGN[candidate.side] != side:
            trend, allowed = ("in salita", "long") if side > 0 else ("in discesa", "short")
            self.say(
                "RISK",
                f"respinto: con BTC {trend} si apre solo {allowed}, non {candidate.side}",
                symbol,
                "risk_rejected",
            )
            return False
        plan = perps.plan(candidate, candles, self.cfg)
        if not plan.valid:
            self.say("CHARTS", f"scartato: {'; '.join(plan.reasons)}", symbol, "plan_rejected")
            return False
        decision = perps.evaluate(plan, book, self.cfg, self.clock())
        if not decision.approved:
            self.say("RISK", f"respinto: {decision.reasons[0]}", symbol, "risk_rejected")
            return False
        self._tell_plan(plan)
        if veto := self._open_interest_veto(symbol):
            self.say("RISK", f"scartato: {veto}", symbol, "risk_rejected")
            return False
        size_factor = self._verdict(candidate, plan)
        if size_factor is None:
            return False
        if self.llm:  # sized again: at the price after the debate, at the Chief's conviction
            if (plan := self._repriced(plan)) is None:
                return False
            book = self.book()  # the stops were checked during the debate
            decision = perps.evaluate(plan, book, self.cfg, self.clock(), size_factor)
            if not decision.approved:
                self.say("RISK", f"respinto: {decision.reasons[0]}", symbol, "risk_rejected")
                return False
        note = f" ({'; '.join(decision.reasons)})" if decision.reasons else ""
        self.say(
            "RISK",
            f"{decision.action}: posizione da {decision.notional:.2f} {self.cfg.quote}, "
            f"{decision.notional / book.equity:.1%} del capitale{note}",
            symbol,
            "sized",
            action=decision.action,
            notional=decision.notional,
            share=decision.notional / book.equity,
        )
        return self._enter(plan, decision, book)

    def _brief(self, candidate: Candidate, plan: ChartPlan, now: float) -> str:
        """The facts every analyst starts from, with what only a perpetual contract has:
        BTC's trend, the funding rate and the open interest."""
        symbol = candidate.symbol
        trend = "an uptrend" if plan.side == "long" else "a downtrend"
        extra = [f"BTC: in {trend}, so the desk opens only {plan.side}s for now"]
        try:
            rate = self.market.funding_rate(symbol)
        except MarketError:
            extra.append("Funding rate: not available")
        else:
            payer = "longs pay shorts" if rate > 0 else "shorts pay longs" if rate < 0 else "zero"
            hours = self._funding_period(symbol) / 3600
            extra.append(f"Funding rate: {rate:+.4%} every {hours:g}h ({payer})")
        try:
            growth = self.market.open_interest_growth(symbol)
        except MarketError:
            growth = None
        extra.append(
            "Open interest over the last 24h: "
            + ("not available" if growth is None else f"{growth:+.1%}")
        )
        return analysts.market_brief(candidate, plan, self.cfg, now, extra)

    def _tell_plan(self, plan: ChartPlan) -> None:
        sign = "-" if plan.side == "long" else "+"
        self.say(
            "CHARTS",
            f"{NAME[plan.side]} · trend {plan.trend}, RSI {plan.rsi:.0f} · entrata "
            f"{plan.entry:g} · stop {plan.stop:g} ({sign}{plan.stop_pct:.1f}%) · "
            f"target {plan.target:g}",
            plan.symbol,
            "plan",
            side=plan.side,
            trend=plan.trend,
            rsi=plan.rsi,
            entry=plan.entry,
            stop=plan.stop,
            stop_pct=plan.stop_pct,
            target=plan.target,
        )

    def _open_interest_veto(self, symbol: str) -> str:
        """research/derivs.py's rule C, when `perps_oi_filter` is on: why the open interest
        rules the entry out, or ''. Without a reading the entry goes ahead, as in the
        research, and the journal says so."""
        if not self.cfg.perps_oi_filter:
            return ""
        try:
            growth = self.market.open_interest_growth(symbol)
        except MarketError as e:
            growth, why = None, f"non leggibili ({e})"
        else:
            why = "con uno storico troppo corto"
        if growth is None:
            self.say("RISK", f"posizioni aperte sul mercato {why}: entrata senza filtro", symbol)
        return perps.open_interest_veto(growth)

    def _enter(self, plan: ChartPlan, decision: risk.RiskDecision, book: risk.Book) -> bool:
        try:
            fill = self.broker.open(plan.symbol, plan.side, decision.qty, plan.entry)
        except BrokerError as e:
            self.say("EXECUTOR", f"apertura fallita: {e}", plan.symbol, "error")
            return False
        now = self.clock()
        margin, leverage_ = perps.margin_for(fill.qty * fill.price, book, self.cfg)
        shift = fill.price - plan.entry  # the planned distances, from the real fill
        pos = PerpPosition(
            symbol=plan.symbol,
            side=plan.side,
            qty=fill.qty,
            entry_price=fill.price,
            entry_ts=now,
            stop=plan.stop + shift,
            initial_stop=plan.stop + shift,
            target=plan.target + shift,
            best=fill.price,
            margin=margin,
            leverage=leverage_,
            liquidation=perps.liquidation_price(
                fill.price, plan.side, leverage_, self.cfg.maintenance_margin
            ),
            fees=fill.fee,
            funded_until=now,
            checked=now,
        )
        self.store.add("cash", fill.quote_delta)
        self.store.save_perps_position(pos)
        done = "comprato" if plan.side == "long" else "venduto allo scoperto"
        self.say(
            "EXECUTOR",
            f"{NAME[plan.side]}, {GAIN[plan.side]}: {done} {fill.qty:g} a {fill.price:g} · "
            f"stop {pos.stop:g} · target {pos.target:g} · leva x{leverage_:.1f} · "
            f"margine {margin:.2f} {self.cfg.quote} · liquidazione a {pos.liquidation:g}",
            plan.symbol,
            "open",
            side=plan.side,
            qty=fill.qty,
            price=fill.price,
            stop=pos.stop,
            target=pos.target,
            leverage=leverage_,
            margin=margin,
            liquidation=pos.liquidation,
        )
        return True


def value_perps_book(store: Store, market: PerpsData, now: float) -> risk.Book:
    """Value the perpetuals account now, rolling the trading day and the peak forward.

    The equity is the cash plus every position's open profit or loss. The exposure is the
    positions' whole notional, long and short alike; the margin is what they tie up.
    """
    positions = store.perps_positions()
    prices, fresh = mark_prices(store, market, positions)
    cash = store.get_float("cash")
    equity = cash + sum(p.profit(prices[p.symbol]) for p in positions)
    exposure = sum(p.qty * prices[p.symbol] for p in positions)
    margin = sum(p.margin for p in positions)
    return roll_book(store, now, cash, equity, exposure, positions, fresh, margin)
