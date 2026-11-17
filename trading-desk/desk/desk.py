"""The desk: runs the agents in order and keeps the book.

Scout -> Charts -> risk pre-check -> News, Sentiment -> Skeptic -> Chief ->
risk gate -> Executor. Every step is written to the journal with its reason,
and tagged with a `kind` so the dashboard can show it without parsing text.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from pydantic import BaseModel

from desk import risk
from desk.agents import analysts, charts, scout
from desk.agents.llm import LLM, AgentUnavailable, Usage
from desk.broker import Broker, BrokerError
from desk.config import Settings
from desk.market import Market, MarketError, MarketUnavailable
from desk.models import Candidate, ChartPlan, Position
from desk.store import Store, Trade

Echo = Callable[[float, str, str, str], None]

EQUITY_INTERVAL = 300.0  # seconds between equity points while nothing changes


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
        equity_interval: float = EQUITY_INTERVAL,
    ):
        self.cfg = cfg
        self.market = market
        self.broker = broker
        self.store = store
        self.llm = llm  # None runs the desk on rules alone
        self.clock = clock
        self.echo = echo
        self.equity_interval = equity_interval
        init_book(store, cfg)

    def say(self, agent: str, message: str, symbol: str = "", kind: str = "note", **facts) -> None:
        """Write one journal entry. `facts` are the numbers behind the sentence."""
        now = self.clock()
        self.store.log(now, agent, symbol, message, {"kind": kind, **facts})
        self.store.set("heartbeat", now)
        if self.echo:
            self.echo(now, agent, symbol, message)

    @contextmanager
    def _working(self, agent: str, task: str, symbol: str = "") -> Iterator[None]:
        """Mark an agent as busy for as long as its slow step runs."""
        busy = {"agent": agent, "task": task, "symbol": symbol, "since": self.clock()}
        self.store.set_json("busy", busy)
        try:
            yield
        finally:
            self.store.set("busy", "")

    def record_usage(self, usage: Usage) -> None:
        self.store.add("llm_input_tokens", usage.input_tokens)
        self.store.add("llm_output_tokens", usage.output_tokens)
        self.store.add("llm_searches", usage.searches)
        self.store.add("llm_cost", usage.cost)

    # --- the book -------------------------------------------------------------

    def book(self) -> risk.Book:
        return value_book(self.store, self.market, self.clock())

    def _pulse(self) -> None:
        """Leave a sign of life and a point on the equity curve."""
        now = self.clock()
        self.store.set("heartbeat", now)
        book = self.book()
        if book.fresh:  # a stale price would draw a step that never happened
            self.store.add_equity(now, book.equity, self.equity_interval)

    # --- exits ----------------------------------------------------------------

    def monitor(self) -> None:
        """Check every open position against its stop, trailing stop and time limit."""
        for pos in self.store.positions():
            try:
                price = self.market.price(pos.symbol)
            except MarketError as e:
                self.say("EXECUTOR", f"prezzo non disponibile, riprovo: {e}", pos.symbol, "error")
                continue
            stop_before, trailing_before = pos.stop, pos.highest >= pos.target
            exit_ = risk.check_exit(
                pos, open_=price, high=price, low=price, close=price, now=self.clock(), cfg=self.cfg
            )
            if exit_:
                self.close(pos, price, exit_.reason)
                continue
            self.store.save_position(pos)  # the stop may have moved up
            if not trailing_before and pos.highest >= pos.target:
                self.say(
                    "EXECUTOR",
                    f"target raggiunto: da ora lo stop segue il prezzo, adesso a {pos.stop:g}",
                    pos.symbol,
                    "stop_moved",
                    stop=pos.stop,
                    mode="trailing",
                )
            elif stop_before <= pos.initial_stop < pos.stop:
                self.say(
                    "EXECUTOR",
                    f"stop alzato a pareggio ({pos.stop:g}): questa operazione non può più perdere",
                    pos.symbol,
                    "stop_moved",
                    stop=pos.stop,
                    mode="breakeven",
                )
        self._pulse()

    def close(self, pos: Position, ref_price: float, reason: str) -> None:
        try:
            fill = self.broker.sell(pos.symbol, pos.qty, ref_price)
        except BrokerError as e:
            self.say(
                "EXECUTOR",
                f"vendita fallita, riprovo al prossimo controllo: {e}",
                pos.symbol,
                "error",
            )
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
            "sell",
            price=fill.price,
            reason=reason,
            pnl=pnl,
            r=r_multiple,
        )

    def close_all(self, reason: str = "chiusura manuale") -> None:
        for pos in self.store.positions():
            try:
                self.close(pos, self.market.price(pos.symbol), reason)
            except MarketError as e:
                self.say("EXECUTOR", f"chiusura non riuscita: {e}", pos.symbol, "error")
        self._pulse()

    # --- entries --------------------------------------------------------------

    def cycle(self) -> bool:
        """One full pass of the desk: manage exits, scan, debate, trade.

        Returns False when the markets could not be scanned, so the caller can try
        again within the same candle instead of waiting for the next one.
        """
        self.monitor()
        scanned = self._look_for_entries()
        self._pulse()
        return scanned

    def _look_for_entries(self) -> bool:
        try:
            with self._working("SCOUT", "scansiona i mercati"):
                scan = scout.scan(self.market, self.cfg)
        except MarketError as e:
            self.say("SCOUT", f"scansione non riuscita, riprovo tra poco: {e}", kind="error")
            return False
        if scan.failed and not scan.scanned:
            self.say(
                "SCOUT",
                f"scansione non riuscita, riprovo tra poco: {scan.failed} mercati non leggibili",
                kind="error",
            )
            return False
        flagged = ", ".join(f"{c.symbol} {c.rvol:.1f}x" for c in scan.candidates) or "nessuno"
        skipped = f" ({scan.failed} non leggibili)" if scan.failed else ""
        self.say(
            "SCOUT",
            f"{scan.scanned} mercati analizzati{skipped}, {len(scan.candidates)} con volume "
            f"anomalo: {flagged}",
            kind="scan",
            scanned=scan.scanned,
            failed=scan.failed,
            flagged=[{"symbol": c.symbol, "rvol": c.rvol} for c in scan.candidates],
        )
        if not scan.candidates:
            return True

        book = self.book()
        if reason := risk.blocked(book, self.cfg) or self._market_falling():
            self.say("RISK", f"nessuna nuova entrata: {reason}", kind="blocked")
            return True

        debates = 0
        for candidate in scan.candidates:
            symbol = candidate.symbol
            now = self.clock()
            plan = charts.plan(symbol, scan.candles[symbol], self.cfg)
            if not plan.valid:
                self.say("CHARTS", f"scartato: {'; '.join(plan.reasons)}", symbol, "plan_rejected")
                continue
            # Ask the gate before paying analysts for a trade it would refuse anyway.
            precheck = risk.evaluate(plan, book, self.cfg, now)
            if not precheck.approved:
                self.say("RISK", f"respinto: {precheck.reasons[0]}", symbol, "risk_rejected")
                continue
            self.say(
                "CHARTS",
                f"trend {plan.trend}, RSI {plan.rsi:.0f} · entrata {plan.entry:g} · "
                f"stop {plan.stop:g} (-{plan.stop_pct:.1f}%) · target {plan.target:g}",
                symbol,
                "plan",
                trend=plan.trend,
                rsi=plan.rsi,
                entry=plan.entry,
                stop=plan.stop,
                stop_pct=plan.stop_pct,
                target=plan.target,
            )

            size_factor = 1.0
            if self.llm:
                if now - self.store.reviewed_at(symbol) < self.cfg.reanalyze_hours * 3600:
                    self.say(
                        "DESK", "già discusso di recente, non lo rianalizzo", symbol, "skipped"
                    )
                    continue
                if debates >= self.cfg.max_candidates:
                    self.say("DESK", "limite di analisi per ciclo raggiunto", symbol, "skipped")
                    continue
                debates += 1
                self.store.mark_reviewed(symbol, now)
                factor = self._debate(candidate, plan, now)
                if factor is None:
                    continue
                size_factor = factor

            decision = risk.evaluate(plan, book, self.cfg, now, size_factor)
            if not decision.approved:
                self.say("RISK", f"respinto: {decision.reasons[0]}", symbol, "risk_rejected")
                continue
            note = f" ({'; '.join(decision.reasons)})" if decision.reasons else ""
            self.say(
                "RISK",
                f"{decision.action}: {decision.notional:.2f} {self.cfg.quote}, "
                f"{decision.notional / book.equity:.1%} del capitale{note}",
                symbol,
                "sized",
                action=decision.action,
                notional=decision.notional,
                share=decision.notional / book.equity,
            )
            self._open(plan, decision)
            book = self.book()

    def _market_falling(self) -> str:
        """Why the wider market rules out new longs right now, or '' if it does not."""
        if not self.cfg.regime_filter:
            return ""
        leader = f"BTC/{self.cfg.quote}"
        try:
            falling = charts.market_falling(self.market.candles(leader))
        except MarketUnavailable as e:
            # Unreachable is not "not falling": without the answer, no new longs.
            return f"trend di {leader} non verificabile in questo momento ({e})"
        except MarketError as e:
            self.say("RISK", f"trend di {leader} non valutabile, filtro di mercato saltato: {e}")
            return ""
        return f"{leader} in trend ribassista" if falling else ""

    def _debate(self, candidate: Candidate, plan: ChartPlan, now: float) -> float | None:
        """Run the analysts on one setup. Returns the size factor for a BUY, else None."""
        symbol = candidate.symbol
        brief = analysts.market_brief(candidate, plan, self.cfg, now)

        news = self._ask(
            "NEWS",
            "cerca cosa ha mosso il prezzo",
            symbol,
            lambda: analysts.news(self.llm, brief, self.cfg),
        )
        if news:
            self.say("NEWS", f"{news.impact}: {news.summary}", symbol, "news", **news.model_dump())
        mood = self._ask(
            "SENTIMENT",
            "legge cosa dice la gente",
            symbol,
            lambda: analysts.sentiment(self.llm, brief, self.cfg),
        )
        if mood:
            self.say(
                "SENTIMENT",
                f"{mood.mood}, rischio hype {mood.hype_risk}: {mood.summary}",
                symbol,
                "sentiment",
                **mood.model_dump(),
            )
        reports = f"News report:\n{_dump(news)}\n\nSentiment report:\n{_dump(mood)}"

        objections = self._ask(
            "SKEPTIC",
            "cerca tre motivi per non comprare",
            symbol,
            lambda: analysts.skeptic(self.llm, brief, reports, self.cfg),
        )
        if not objections:
            self.say(
                "CHIEF",
                "WAIT: senza il parere dello Skeptic non si compra",
                symbol,
                "verdict",
                decision="WAIT",
            )
            return None
        for number, objection in enumerate(objections.objections, start=1):
            self.say(
                "SKEPTIC",
                f"{number}. [{objection.severity}] {objection.reason}",
                symbol,
                "objection",
                number=number,
                **objection.model_dump(),
            )

        verdict = self._ask(
            "CHIEF",
            "risponde alle obiezioni e decide",
            symbol,
            lambda: analysts.chief(self.llm, brief, reports, objections, self.cfg),
        )
        if not verdict:
            return None
        self.say(
            "CHIEF",
            f"{verdict.decision} (fiducia {verdict.confidence:.2f}, convinzione "
            f"{verdict.conviction}): {verdict.summary}",
            symbol,
            "verdict",
            **verdict.model_dump(),
        )
        if verdict.decision != "BUY":
            return None
        if reason := analysts.enforce(verdict, objections, self.cfg):
            self.say("DESK", f"BUY annullato: {reason}", symbol, "buy_cancelled")
            return None
        return analysts.SIZE_FACTOR[verdict.conviction]

    def _ask(self, agent: str, task: str, symbol: str, call: Callable[[], BaseModel]):
        try:
            with self._working(agent, task, symbol):
                return call()
        except AgentUnavailable as e:
            self.say(agent, f"non disponibile: {e}", symbol, "unavailable")
            return None

    def _open(self, plan: ChartPlan, decision: risk.RiskDecision) -> None:
        try:
            fill = self.broker.buy(plan.symbol, decision.qty, plan.entry)
        except BrokerError as e:
            self.say("EXECUTOR", f"acquisto fallito: {e}", plan.symbol, "error")
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
            "buy",
            qty=fill.qty,
            price=fill.price,
            stop=position.stop,
            target=position.target,
        )


def init_book(store: Store, cfg: Settings) -> None:
    """Give a new desk its starting capital. Later runs keep the stored book."""
    if not store.get("cash"):
        store.set("cash", cfg.capital)
        store.set("peak_equity", cfg.capital)
        store.set("session", uuid.uuid4().hex)  # lets the dashboard notice a fresh book


def value_book(store: Store, market: Market, now: float) -> risk.Book:
    """Value the account now, rolling the trading day and the equity peak forward.

    A price the exchange cannot give right now is taken from the last valuation. Such a
    book is not fresh: it does not open a new trading day or raise the peak, since both
    would then rest on a stale figure.
    """
    positions = store.positions()
    known = store.get_json("prices") if positions else {}
    prices, fresh = {}, True
    for p in positions:
        try:
            prices[p.symbol] = market.price(p.symbol)
        except MarketError:
            prices[p.symbol] = known.get(p.symbol, p.entry_price)
            fresh = False
    store.set_json("prices", prices)  # the dashboard values positions without the exchange
    exposure = sum(p.qty * prices[p.symbol] for p in positions)
    cash = store.get_float("cash")
    equity = cash + exposure

    peak = store.get_float("peak_equity")
    if fresh:
        today = datetime.fromtimestamp(now, UTC).date().isoformat()
        if store.get("day") != today:
            store.set("day", today)
            store.set("day_start_equity", equity)
        peak = max(peak, equity)
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
        fresh=fresh,
    )


def _dump(report: BaseModel | None) -> str:
    return report.model_dump_json(indent=2) if report else "unavailable"
