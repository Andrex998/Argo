"""The desk: runs the agents in order and keeps the book.

Scout -> Charts -> risk pre-check -> News, Sentiment -> Skeptic -> Chief ->
risk gate -> Executor. Every step is written to the journal with its reason.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime

from pydantic import BaseModel

from desk import risk
from desk.agents import analysts, charts, scout
from desk.agents.llm import LLM, AgentUnavailable, Usage
from desk.broker import Broker, BrokerError
from desk.config import Settings
from desk.market import Market, MarketError
from desk.models import Candidate, ChartPlan, Position
from desk.store import Store, Trade

Echo = Callable[[float, str, str, str], None]


class Desk:
    def __init__(
        self,
        cfg: Settings,
        market: Market,
        broker: Broker,
        store: Store,
        llm: LLM | None = None,
        clock: Callable[[], float] = time.time,
        echo: Echo | None = None,
    ):
        self.cfg = cfg
        self.market = market
        self.broker = broker
        self.store = store
        self.llm = llm  # None runs the desk on rules alone
        self.clock = clock
        self.echo = echo
        init_book(store, cfg)

    def say(self, agent: str, message: str, symbol: str = "", data: dict | None = None) -> None:
        now = self.clock()
        self.store.log(now, agent, symbol, message, data)
        if self.echo:
            self.echo(now, agent, symbol, message)

    def record_usage(self, usage: Usage) -> None:
        self.store.add("llm_input_tokens", usage.input_tokens)
        self.store.add("llm_output_tokens", usage.output_tokens)
        self.store.add("llm_searches", usage.searches)
        self.store.add("llm_cost", usage.cost)

    # --- the book -------------------------------------------------------------

    def book(self) -> risk.Book:
        return value_book(self.store, self.market, self.clock())

    # --- exits ----------------------------------------------------------------

    def monitor(self) -> None:
        """Check every open position against its stop, trailing stop and time limit."""
        for pos in self.store.positions():
            try:
                price = self.market.price(pos.symbol)
            except MarketError as e:
                self.say("EXECUTOR", f"prezzo non disponibile, riprovo: {e}", pos.symbol)
                continue
            exit_ = risk.check_exit(
                pos, open_=price, high=price, low=price, close=price, now=self.clock(), cfg=self.cfg
            )
            if exit_:
                self.close(pos, price, exit_.reason)
            else:
                self.store.save_position(pos)  # the stop may have moved up

    def close(self, pos: Position, ref_price: float, reason: str) -> None:
        try:
            fill = self.broker.sell(pos.symbol, pos.qty, ref_price)
        except BrokerError as e:
            self.say("EXECUTOR", f"vendita fallita, riprovo al prossimo controllo: {e}", pos.symbol)
            return
        now = self.clock()
        pnl = fill.quote_delta - pos.cost
        r_multiple = pnl / (pos.risk_per_unit * pos.qty)
        self.store.add("cash", fill.quote_delta)
        self.store.delete_position(pos.symbol)
        self.store.add_trade(
            Trade(
                pos.symbol,
                pos.qty,
                pos.entry_price,
                fill.price,
                pos.entry_ts,
                now,
                pnl,
                r_multiple,
                reason,
            )
        )
        if pnl < 0:
            self.store.set_cooldown(pos.symbol, now + self.cfg.cooldown_hours * 3600)
        self.say(
            "EXECUTOR",
            f"venduto a {fill.price:g} ({reason}): {pnl:+.2f} {self.cfg.quote}, {r_multiple:+.1f}R",
            pos.symbol,
        )

    def close_all(self, reason: str = "chiusura manuale") -> None:
        for pos in self.store.positions():
            try:
                self.close(pos, self.market.price(pos.symbol), reason)
            except MarketError as e:
                self.say("EXECUTOR", f"chiusura non riuscita: {e}", pos.symbol)

    # --- entries --------------------------------------------------------------

    def cycle(self) -> None:
        """One full pass of the desk: manage exits, scan, debate, trade."""
        self.monitor()
        try:
            scan = scout.scan(self.market, self.cfg)
        except MarketError as e:
            self.say("SCOUT", f"scansione non riuscita: {e}")
            return
        flagged = ", ".join(f"{c.symbol} {c.rvol:.1f}x" for c in scan.candidates) or "nessuno"
        self.say(
            "SCOUT",
            f"{scan.scanned} mercati analizzati, {len(scan.candidates)} con volume anomalo: "
            f"{flagged}",
        )
        if not scan.candidates:
            return

        book = self.book()
        if reason := risk.blocked(book, self.cfg):
            self.say("RISK", f"nessuna nuova entrata: {reason}")
            return

        debates = 0
        for candidate in scan.candidates:
            symbol = candidate.symbol
            now = self.clock()
            plan = charts.plan(symbol, scan.candles[symbol], self.cfg)
            if not plan.valid:
                self.say("CHARTS", f"scartato: {'; '.join(plan.reasons)}", symbol)
                continue
            # Ask the gate before paying analysts for a trade it would refuse anyway.
            precheck = risk.evaluate(plan, book, self.cfg, now)
            if not precheck.approved:
                self.say("RISK", f"respinto: {precheck.reasons[0]}", symbol)
                continue
            self.say(
                "CHARTS",
                f"trend {plan.trend}, RSI {plan.rsi:.0f} · entrata {plan.entry:g} · "
                f"stop {plan.stop:g} (-{plan.stop_pct:.1f}%) · target {plan.target:g}",
                symbol,
            )

            size_factor = 1.0
            if self.llm:
                if now - self.store.reviewed_at(symbol) < self.cfg.reanalyze_hours * 3600:
                    self.say("DESK", "già discusso di recente, non lo rianalizzo", symbol)
                    continue
                if debates >= self.cfg.max_candidates:
                    self.say("DESK", "limite di analisi per ciclo raggiunto", symbol)
                    continue
                debates += 1
                self.store.mark_reviewed(symbol, now)
                factor = self._debate(candidate, plan, now)
                if factor is None:
                    continue
                size_factor = factor

            decision = risk.evaluate(plan, book, self.cfg, now, size_factor)
            if not decision.approved:
                self.say("RISK", f"respinto: {decision.reasons[0]}", symbol)
                continue
            note = f" ({'; '.join(decision.reasons)})" if decision.reasons else ""
            self.say(
                "RISK",
                f"{decision.action}: {decision.notional:.2f} {self.cfg.quote}, "
                f"{decision.notional / book.equity:.1%} del capitale{note}",
                symbol,
            )
            self._open(plan, decision)
            book = self.book()

    def _debate(self, candidate: Candidate, plan: ChartPlan, now: float) -> float | None:
        """Run the analysts on one setup. Returns the size factor for a BUY, else None."""
        symbol = candidate.symbol
        brief = analysts.market_brief(candidate, plan, self.cfg, now)

        news = self._ask("NEWS", symbol, lambda: analysts.news(self.llm, brief, self.cfg))
        if news:
            self.say("NEWS", f"{news.impact}: {news.summary}", symbol, news.model_dump())
        mood = self._ask("SENTIMENT", symbol, lambda: analysts.sentiment(self.llm, brief, self.cfg))
        if mood:
            self.say(
                "SENTIMENT",
                f"{mood.mood}, rischio hype {mood.hype_risk}: {mood.summary}",
                symbol,
                mood.model_dump(),
            )
        reports = f"News report:\n{_dump(news)}\n\nSentiment report:\n{_dump(mood)}"

        objections = self._ask(
            "SKEPTIC", symbol, lambda: analysts.skeptic(self.llm, brief, reports, self.cfg)
        )
        if not objections:
            self.say("CHIEF", "WAIT: senza il parere dello Skeptic non si compra", symbol)
            return None
        for number, objection in enumerate(objections.objections, start=1):
            self.say("SKEPTIC", f"{number}. [{objection.severity}] {objection.reason}", symbol)

        verdict = self._ask(
            "CHIEF", symbol, lambda: analysts.chief(self.llm, brief, reports, objections, self.cfg)
        )
        if not verdict:
            return None
        self.say(
            "CHIEF",
            f"{verdict.decision} (fiducia {verdict.confidence:.2f}, convinzione "
            f"{verdict.conviction}): {verdict.summary}",
            symbol,
            verdict.model_dump(),
        )
        if verdict.decision != "BUY":
            return None
        if reason := analysts.enforce(verdict, objections, self.cfg):
            self.say("DESK", f"BUY annullato: {reason}", symbol)
            return None
        return analysts.SIZE_FACTOR[verdict.conviction]

    def _ask(self, agent: str, symbol: str, call: Callable[[], BaseModel]):
        try:
            return call()
        except AgentUnavailable as e:
            self.say(agent, f"non disponibile: {e}", symbol)
            return None

    def _open(self, plan: ChartPlan, decision: risk.RiskDecision) -> None:
        try:
            fill = self.broker.buy(plan.symbol, decision.qty, plan.entry)
        except BrokerError as e:
            self.say("EXECUTOR", f"acquisto fallito: {e}", plan.symbol)
            return
        # Keep the planned stop and target distances, anchored to the real fill price.
        shift = fill.price - plan.entry
        position = Position(
            symbol=plan.symbol,
            qty=fill.qty,
            entry_price=fill.price,
            entry_ts=self.clock(),
            cost=-fill.quote_delta,
            stop=plan.stop + shift,
            initial_stop=plan.stop + shift,
            target=plan.target + shift,
            highest=fill.price,
        )
        self.store.add("cash", fill.quote_delta)
        self.store.save_position(position)
        self.say(
            "EXECUTOR",
            f"comprato {fill.qty:g} a {fill.price:g} · stop {position.stop:g} · "
            f"target {position.target:g}",
            plan.symbol,
        )


def init_book(store: Store, cfg: Settings) -> None:
    """Give a new desk its starting capital. Later runs keep the stored book."""
    if not store.get("cash"):
        store.set("cash", cfg.capital)
        store.set("peak_equity", cfg.capital)


def value_book(store: Store, market: Market, now: float) -> risk.Book:
    """Value the account now, rolling the trading day and the equity peak forward."""
    positions = store.positions()
    exposure = sum(p.qty * _last_price(market, p) for p in positions)
    cash = store.get_float("cash")
    equity = cash + exposure

    today = datetime.fromtimestamp(now, UTC).date().isoformat()
    if store.get("day") != today:
        store.set("day", today)
        store.set("day_start_equity", equity)
    peak = max(store.get_float("peak_equity"), equity)
    store.set("peak_equity", peak)

    return risk.Book(
        equity=equity,
        cash=cash,
        exposure=exposure,
        open_symbols=frozenset(p.symbol for p in positions),
        day_start_equity=store.get_float("day_start_equity"),
        peak_equity=peak,
        halted=store.get("halted"),
        cooldowns=store.cooldowns(now),
    )


def _last_price(market: Market, pos: Position) -> float:
    try:
        return market.price(pos.symbol)
    except MarketError:
        return pos.entry_price  # value at cost until the price is back


def _dump(report: BaseModel | None) -> str:
    return report.model_dump_json(indent=2) if report else "unavailable"
