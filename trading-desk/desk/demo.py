"""A staged session for `desk dashboard --demo`: the real desk on a made-up market.

Scout, Charts, the risk gate, the broker and the exit rules are the real code.
Only the inputs are staged: synthetic candles for five markets that do not
exist, and analysts that read prepared lines instead of calling a model. The
dashboard marks everything from here as a demo.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from pathlib import Path

from pydantic import BaseModel

from desk.broker import PaperBroker
from desk.config import Settings
from desk.desk import Desk
from desk.market import MarketError
from desk.models import (
    Candle,
    Headline,
    NewsReport,
    Objection,
    Rebuttal,
    SentimentReport,
    SkepticReport,
    Verdict,
)
from desk.store import Store
from desk.synthetic import bounce, breakout, quiet

Pause = Callable[[float], None]

ALFA, BETA, GAMMA, DELTA, OMEGA = "ALFA/USD", "BETA/USD", "GAMMA/USD", "DELTA/USD", "OMEGA/USD"
START_PRICE = {ALFA: 100.0, BETA: 42.0, GAMMA: 8.4, DELTA: 250.0, OMEGA: 1.9}


class Stopped(Exception):
    """The demo was asked to end."""


def settings() -> Settings:
    return Settings(
        _env_file=None,
        mode="paper",
        exchange="demo",
        quote="USD",
        capital=1000.0,
        fee_rate=0.001,
        regime_filter=False,
        fear_greed=False,  # the demo never touches the network
        reanalyze_hours=0.0,
        cooldown_hours=0.0,
    )


class StagedMarket:
    """A market whose candles and prices the script sets by hand."""

    def __init__(self) -> None:
        self.data: dict[str, list[Candle]] = {}
        self.prices: dict[str, float] = {}

    def stage(self, data: dict[str, list[Candle]], held: set[str]) -> None:
        """Show new candles. Markets the desk holds keep the price the script gave them."""
        self.data = data
        for symbol, candles in data.items():
            if symbol not in held:
                self.prices[symbol] = candles[-1].close

    def universe(self) -> list[tuple[str, float]]:
        return [(symbol, 5_000_000.0) for symbol in self.data]

    def candles(self, symbol: str, limit: int = 200) -> list[Candle]:
        if symbol not in self.data:
            raise MarketError(f"{symbol}: mercato non disponibile")
        return self.data[symbol][-limit:]

    def price(self, symbol: str) -> float:
        if symbol not in self.prices:
            raise MarketError(f"{symbol}: nessun prezzo disponibile")
        return self.prices[symbol]


class StagedAnalysts:
    """Stands in for the model: answers with the line prepared for that market."""

    def __init__(self, lines: dict[str, dict[type, BaseModel]], pause: Pause):
        self.lines = lines
        self.pause = pause

    def ask(self, system, prompt, schema, *, effort="medium", web_search=False):
        symbol = prompt.split("\n", 1)[0].removeprefix("Market: ").split(" on ")[0]
        self.pause(3.0 if web_search else 2.2)  # a real analyst takes far longer
        return self.lines[symbol][schema]


def _objections(summary: str, *items: tuple[str, str, str]) -> SkepticReport:
    return SkepticReport(
        summary=summary,
        objections=[Objection(severity=s, reason=r, evidence=e) for s, r, e in items],
    )


def _verdict(decision, conviction, confidence, summary, *answers: tuple[bool, str]) -> Verdict:
    return Verdict(
        decision=decision,
        conviction=conviction,
        confidence=confidence,
        summary=summary,
        rebuttals=[
            Rebuttal(objection_number=n, rebutted=rebutted, argument=argument)
            for n, (rebutted, argument) in enumerate(answers, start=1)
        ],
    )


LINES: dict[str, dict[type, BaseModel]] = {
    ALFA: {
        NewsReport: NewsReport(
            catalyst_found=True,
            catalyst="Annuncio di quotazione su un secondo exchange",
            impact="bullish",
            red_flags=[],
            headlines=[
                Headline(title="ALFA sarà quotata da lunedì", source="fonte demo", date="oggi")
            ],
            summary="Il movimento ha una causa precisa e verificabile: una nuova quotazione.",
            confidence=0.8,
        ),
        SentimentReport: SentimentReport(
            mood="bullish",
            hype_risk="low",
            summary="Se ne parlava già prima del rialzo, e con argomenti, non solo di prezzo.",
            confidence=0.7,
        ),
        SkepticReport: _objections(
            "Tre dubbi, nessuno definitivo.",
            (
                "serious",
                "Il volume è concentrato in tre candele",
                "Quattro volte il volume abituale, ma solo nelle ultime tre ore",
            ),
            ("minor", "RSI già alto", "RSI sopra 70"),
            (
                "serious",
                "Dopo una quotazione spesso si vende la notizia",
                "Il catalizzatore è già pubblico",
            ),
        ),
        Verdict: _verdict(
            "BUY",
            "high",
            0.78,
            "Catalizzatore reale, trend in salita, obiezioni serie con risposta. Si compra.",
            (True, "Il volume resta alto anche nell'ultima candela e il prezzo tiene il massimo."),
            (False, "Vero: è il motivo per cui lo stop resta stretto."),
            (True, "La quotazione non è ancora avvenuta: quell'effetto riguarda il giorno stesso."),
        ),
    },
    GAMMA: {
        NewsReport: NewsReport(
            catalyst_found=False,
            catalyst="Nessuna causa identificabile",
            impact="unclear",
            red_flags=["Sblocco di token previsto tra due giorni"],
            headlines=[],
            summary="Nessuna notizia spiega il rialzo, e tra due giorni si sbloccano dei token.",
            confidence=0.6,
        ),
        SentimentReport: SentimentReport(
            mood="euphoric",
            hype_risk="high",
            summary="Molti post quasi identici, comparsi dopo il rialzo e tutti sul prezzo.",
            confidence=0.7,
        ),
        SkepticReport: _objections(
            "C'è un rischio concreto con una data.",
            ("dealbreaker", "Sblocco di token tra due giorni", "Segnalato dal report News"),
            ("serious", "Entusiasmo senza una causa", "Sentiment euforico e nessuna notizia"),
            ("minor", "Liquidità modesta", "Volume delle 24 ore vicino alla soglia minima"),
        ),
        Verdict: _verdict(
            "BUY",
            "medium",
            0.66,
            "Il grafico è pulito, ma lo sblocco resta un'incognita che non so escludere.",
            (False, "Non ho dati per escluderlo."),
            (True, "Il volume è reale e il prezzo ha rotto il massimo precedente."),
            (True, "La size è già limitata dal Risk."),
        ),
    },
    DELTA: {
        NewsReport: NewsReport(
            catalyst_found=True,
            catalyst="Aggiornamento del protocollo rilasciato ieri",
            impact="bullish",
            red_flags=[],
            headlines=[
                Headline(title="DELTA rilascia la versione 2", source="fonte demo", date="ieri")
            ],
            summary="Aggiornamento rilasciato ieri; il prezzo ha reagito ore dopo.",
            confidence=0.65,
        ),
        SentimentReport: SentimentReport(
            mood="mixed",
            hype_risk="medium",
            summary="Opinioni divise: chi segue il progetto è positivo, molti arrivano solo ora.",
            confidence=0.55,
        ),
        SkepticReport: _objections(
            "Setup discreto, non pulito.",
            (
                "serious",
                "La reazione è arrivata in ritardo sulla notizia",
                "Rilascio ieri, volume solo nelle ultime ore",
            ),
            ("minor", "Sentiment diviso", "Report Sentiment: opinioni miste"),
            ("minor", "Stop più largo del solito", "Volatilità sopra la media"),
        ),
        Verdict: _verdict(
            "BUY",
            "medium",
            0.68,
            "Setup valido ma meno netto del solito: si compra a size ridotta.",
            (
                True,
                "Il volume è arrivato quando la notizia è stata ripresa: è una reazione.",
            ),
            (False, "Vero, per questo la convinzione è media."),
            (False, "Vero: la size si riduce di conseguenza."),
        ),
    },
    OMEGA: {
        NewsReport: NewsReport(
            catalyst_found=False,
            catalyst="Nessuna causa identificabile",
            impact="unclear",
            red_flags=[],
            headlines=[],
            summary="Nessuna notizia collegata al movimento.",
            confidence=0.5,
        ),
        SentimentReport: SentimentReport(
            mood="quiet",
            hype_risk="low",
            summary="Quasi nessuno ne sta parlando.",
            confidence=0.6,
        ),
        SkepticReport: _objections(
            "Non c'è niente a sostegno.",
            ("serious", "Movimento senza una causa", "Report News: nessun catalizzatore"),
            ("minor", "Nessuna discussione", "Report Sentiment: silenzio"),
            ("minor", "Volume appena sopra la soglia", "2,4 volte il volume abituale"),
        ),
        Verdict: _verdict(
            "WAIT",
            "low",
            0.4,
            "Niente spiega il movimento: si aspetta una conferma.",
            (False, "Non ho argomenti contro."),
            (False, "Vero."),
            (False, "Vero."),
        ),
    },
}


def _markets(**shapes: Callable[..., list[Candle]]) -> dict[str, list[Candle]]:
    """All five markets, quiet unless a shape is given for one of them."""
    by_name = {ALFA: "alfa", BETA: "beta", GAMMA: "gamma", DELTA: "delta", OMEGA: "omega"}
    return {
        symbol: shapes.get(name, quiet)(start=START_PRICE[symbol])
        for symbol, name in by_name.items()
    }


def play(db_path: Path, pause: Pause) -> None:
    """Run one staged session from an empty book to the last trade."""
    cfg = settings()
    store = Store(db_path)
    store.reset()
    store.set("demo", "1")
    market = StagedMarket()
    desk = Desk(
        cfg,
        market,
        PaperBroker(cfg),
        store,
        llm=StagedAnalysts(LINES, pause),
        equity_interval=0.0,
    )

    def cycle(**shapes) -> None:
        market.stage(_markets(**shapes), held={p.symbol for p in store.positions()})
        desk.cycle()
        pause(3.0)

    def move(symbol: str, r: float) -> None:
        """Put the price `r` times the risk distance away from the entry, then check exits."""
        position = next(p for p in store.positions() if p.symbol == symbol)
        market.prices[symbol] = position.entry_price + r * position.risk_per_unit
        desk.monitor()
        pause(1.6)

    try:
        pause(1.5)
        # A clean breakout is bought; a bounce in a downtrend is noticed and dropped.
        cycle(
            alfa=lambda start: breakout(surge_volume=4200.0, start=start),
            beta=lambda start: bounce(surge_volume=2600.0, start=start),
        )
        move(ALFA, 0.6)
        move(ALFA, 1.15)  # +1R: the stop goes to breakeven
        # The Chief wants to buy, but leaves a dealbreaker unanswered: the desk cancels it.
        cycle(gamma=lambda start: breakout(surge_volume=3600.0, start=start))
        move(ALFA, 1.7)
        move(ALFA, 2.2)  # target reached: the stop starts trailing
        move(ALFA, 2.9)
        move(ALFA, 1.85)  # pullback through the trailing stop: sold at a profit
        # One reduced-size buy and one market the desk decides to leave alone.
        cycle(
            delta=lambda start: breakout(surge_volume=3800.0, start=start),
            omega=lambda start: breakout(surge_volume=2400.0, start=start),
        )
        move(DELTA, 0.4)
        move(DELTA, -0.5)
        move(DELTA, -1.05)  # stopped out: the loss the stop was sized for
        cycle()  # nothing unusual: the desk does nothing
    finally:
        store.close()


def run(db_path: Path, stop: threading.Event, pace: float = 1.0, loop: bool = True) -> None:
    """Play the session, over and over unless `loop` is off, until `stop` is set."""

    def pause(seconds: float) -> None:
        if stop.wait(seconds * pace):
            raise Stopped

    try:
        while True:
            play(db_path, pause)
            if not loop:
                return
            pause(15.0)
    except Stopped:
        pass
