"""Command line for the desk. Run `desk --help`."""

from __future__ import annotations

import argparse
import sys
import tempfile
import threading
import time
import traceback
import webbrowser
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from desk import backtest, dashboard, demo, live, perps, radar, snapshot
from desk.agents import charts, scout
from desk.agents.llm import AgentUnavailable, ClaudeLLM
from desk.broker import BrokerError, LiveBroker, PaperBroker, PerpsPaperBroker
from desk.config import Settings
from desk.desk import Desk, init_book, value_book
from desk.instance import AlreadyRunning, claim
from desk.market import MarketError, make_exchange, open_market
from desk.perps_desk import PerpsDesk, value_perps_book
from desk.store import Store

# One colour per desk member, readable on dark and light terminals.
COLORS = {
    "SCOUT": "33",
    "NEWS": "31",
    "SENTIMENT": "35",
    "CHARTS": "34",
    "SKEPTIC": "90",
    "CHIEF": "38;5;208",
    "RISK": "32",
    "EXECUTOR": "36",
    "DESK": "1",
}


# Windows consoles show colour codes as text until a program asks for them.
_ansi = sys.platform != "win32"

RETRY_SECONDS = 300  # a scan that failed is tried again within the same candle
GAP_SECONDS = 15 * 60  # a pause this long between two passes means the PC slept or froze

PERPS_PAPER_ONLY = (
    "Il desk dei perpetui gira solo in paper trading (soldi finti): non apre mai posizioni "
    "vere. Togli DESK_MODE=live e --live per avviarlo."
)


def print_event(ts: float, agent: str, symbol: str, message: str) -> None:
    tag = f"{agent:<9}"
    if _ansi and sys.stdout.isatty():
        tag = f"\033[{COLORS.get(agent, '0')}m{tag}\033[0m"
    subject = f"{symbol} · " if symbol else ""
    print(f"{datetime.fromtimestamp(ts):%d/%m %H:%M:%S} {tag} {subject}{message}", flush=True)


def trading_desk(cfg: Settings, args: argparse.Namespace) -> Desk:
    """Build a desk that can place orders. Real money needs both DESK_MODE=live and --live,
    and is never possible on perpetuals."""
    live = getattr(args, "live", False)
    perps_desk = cfg.market == "perps"
    if perps_desk and (live or cfg.mode == "live"):
        raise SystemExit(PERPS_PAPER_ONLY)
    if cfg.mode == "live" and not live:
        raise SystemExit(
            "DESK_MODE=live: aggiungi --live per confermare che vuoi operare con soldi veri."
        )
    if live and cfg.mode != "live":
        raise SystemExit("--live richiede anche DESK_MODE=live in .env.")

    try:
        claim(cfg.db_path)
    except AlreadyRunning:
        url = Store(cfg.db_path).get("dashboard_url")
        if url and getattr(args, "open", False):
            webbrowser.open(url)
        where = f" La sua dashboard: {url}" if url else ""
        name = "Il desk dei perpetui" if perps_desk else "Il desk"
        raise SystemExit(
            f"{name} è già acceso in un'altra finestra.{where}\n"
            "Ne può girare uno solo alla volta: chiudi l'altra finestra prima di riavviarlo."
        ) from None

    exchange = make_exchange(cfg, authenticated=live)
    if live:
        broker = LiveBroker(exchange, cfg)
        free = broker.free(cfg.quote)
        print(
            f"SOLDI VERI su {cfg.exchange}: capitale assegnato al desk {cfg.capital:.2f} "
            f"{cfg.quote}, saldo libero sul conto {free:.2f} {cfg.quote}."
        )
        if free < cfg.capital:
            print("Attenzione: il saldo libero è inferiore al capitale assegnato al desk.")
    elif perps_desk:
        broker = PerpsPaperBroker(cfg)
    else:
        broker = PaperBroker(cfg)

    market = open_market(cfg, exchange)
    if perps_desk:
        # As in the research: the analysts' prompts are written for spot longs.
        print("Desk dei perpetui: decide con le sole regole (Scout, Charts, Risk).")
        return PerpsDesk(cfg, market, broker, Store(cfg.db_path), echo=print_event)
    desk = Desk(cfg, market, broker, Store(cfg.db_path), echo=print_event)
    if not getattr(args, "rules_only", False):
        try:
            desk.llm = ClaudeLLM(cfg, on_usage=desk.record_usage)
        except AgentUnavailable as e:
            if getattr(args, "rules_if_no_key", False):
                print(f"Analisti spenti ({e}): il desk decide con le sole regole.")
                return desk
            raise SystemExit(
                f"Analisti non disponibili: {e}. Imposta ANTHROPIC_API_KEY in .env "
                "oppure usa --rules-only per far girare il desk senza analisti."
            ) from e
    return desk


def cmd_scan(cfg: Settings, args: argparse.Namespace) -> None:
    market = open_market(cfg)
    if cfg.market == "perps":
        scan_perps(cfg, market)
        return
    result = scout.scan(market, cfg)
    print(
        f"{result.scanned} mercati {cfg.quote} analizzati su {cfg.exchange} "
        f"({cfg.timeframe}), {len(result.candidates)} con volume anomalo."
    )
    if not result.scanned and not result.failed:
        # Usually the wrong quote currency for this exchange: show what it actually lists.
        listed = ", ".join(f"{quote} ({count})" for quote, count in market.quotes()[:6])
        print(
            f"Nessun mercato in {cfg.quote} supera {cfg.min_quote_volume:,.0f} di volume. "
            f"Valute quotate su {cfg.exchange}: {listed}. "
            "Cambia DESK_QUOTE o abbassa DESK_MIN_QUOTE_VOLUME."
        )
    for candidate in result.candidates:
        plan = charts.plan(candidate.symbol, result.candles[candidate.symbol], cfg)
        verdict = (
            f"setup valido · entrata {plan.entry:g} · stop {plan.stop:g} "
            f"(-{plan.stop_pct:.1f}%) · target {plan.target:g}"
            if plan.valid
            else f"scartato: {'; '.join(plan.reasons)}"
        )
        print(
            f"  {candidate.symbol:<14} volume {candidate.rvol:4.1f}x · "
            f"{candidate.change_recent:+.1%} nelle ultime 3 candele · {verdict}"
        )


def scan_perps(cfg: Settings, market) -> None:
    """What the perpetuals desk sees now: both directions, and the side BTC allows."""
    result = scout.scan(market, cfg, perps.signal)
    side = perps.regime(market.candles(perps.leader(cfg)))
    allowed = {1: "si aprirebbe solo long", -1: "si aprirebbe solo short"}.get(
        side, "nessuna entrata: BTC non ha una direzione"
    )
    print(
        f"{result.scanned} perpetui {cfg.quote} analizzati su {cfg.exchange} ({cfg.timeframe}), "
        f"{len(result.candidates)} con volume anomalo. Con il trend di BTC {allowed}."
    )
    for candidate in result.candidates:
        plan = perps.plan(candidate, result.candles[candidate.symbol], cfg)
        sign = "-" if plan.side == "long" else "+"
        verdict = (
            f"setup valido · entrata {plan.entry:g} · stop {plan.stop:g} "
            f"({sign}{plan.stop_pct:.1f}%) · target {plan.target:g}"
            if plan.valid
            else f"scartato: {'; '.join(plan.reasons)}"
        )
        print(
            f"  {candidate.symbol:<16} {perps.SIDE_NAME[candidate.side]:<5} volume "
            f"{candidate.rvol:4.1f}x · {candidate.change_recent:+.1%} nelle ultime 3 candele · "
            f"{verdict}"
        )


def cmd_cycle(cfg: Settings, args: argparse.Namespace) -> None:
    trading_desk(cfg, args).cycle()


def start_dashboard(
    cfg: Settings, db_path: Path, args: argparse.Namespace, demo_mode: bool = False
):
    """Serve the dashboard on a background thread and say where it is.

    A port can be taken by another program or reserved by Windows, which sets aside
    whole ranges for WSL, Docker and Hyper-V. Then the dashboard moves to another one:
    the address is printed and the browser is opened on it either way.
    """
    server, error = None, None
    for port in dict.fromkeys(p for p in (args.port, args.port + 1000, 0) if p < 65536):
        try:
            server = dashboard.serve(cfg, db_path, time.time, args.host, port, demo_mode)
            break
        except OSError as e:
            error = e
    if server is None:
        raise SystemExit(f"Nessuna porta disponibile per la dashboard ({error}).")
    port = server.server_address[1]
    if port != args.port:
        print(f"La porta {args.port} non è disponibile: la dashboard usa la {port}.", flush=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    host = "127.0.0.1" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    url = f"http://{host}:{port}"
    print(f"Dashboard: {url}", flush=True)
    if args.open:
        webbrowser.open(url)
    return server, url


def cmd_dashboard(cfg: Settings, args: argparse.Namespace) -> None:
    stop = threading.Event()
    if args.demo:
        cfg = demo.settings()
        db_path = Path(tempfile.mkdtemp(prefix="desk-demo-")) / "demo.db"
        threading.Thread(target=demo.run, args=(db_path, stop), daemon=True).start()
        print("Demo: mercati e analisti fittizi, in un database temporaneo.")
    else:
        db_path = cfg.db_path
    start_dashboard(cfg, db_path, args, demo_mode=args.demo)
    print("Ctrl+C per chiudere.")
    try:
        while not stop.wait(0.5):  # a bare wait() never sees Ctrl+C on Windows
            pass
    except KeyboardInterrupt:
        stop.set()


@dataclass
class Schedule:
    period: float  # seconds per candle
    next_cycle: float = 0.0
    last_pass: float = 0.0


def run_once(desk: Desk, schedule: Schedule, now: float) -> None:
    """One pass of the loop: a full cycle when one is due, otherwise a check of the exits."""
    if schedule.last_pass and now - schedule.last_pass > GAP_SECONDS:
        minutes = round((now - schedule.last_pass) / 60)
        desk.say(
            "DESK",
            f"il desk è rimasto fermo per {minutes} minuti (PC in sospensione?): "
            "riprendo i controlli",
            kind="gap",
            minutes=minutes,
        )
    schedule.last_pass = now
    if now < schedule.next_cycle:
        desk.monitor()
        return
    schedule.next_cycle = now + RETRY_SECONDS  # stands if the cycle fails or raises
    try:
        if desk.cycle():
            # Next pass shortly after the next candle closes.
            schedule.next_cycle = (now // schedule.period + 1) * schedule.period + 20
    finally:
        desk.store.set("next_cycle", schedule.next_cycle)


def publish(desk: Desk, publisher: live.Publisher, now: float) -> None:
    """Send the snapshot to the live page. A failure is told once and never stops the desk."""
    try:
        error = publisher.publish(now)
    except Exception as e:  # the snapshot itself failed: the desk carries on all the same
        error = f"fotografia non riuscita ({e})"
    try:
        if error and not publisher.failing:
            desk.say("DESK", f"pagina live non aggiornata: {error}", kind="error")
        elif not error and publisher.failing:
            desk.say("DESK", "pagina live di nuovo aggiornata")
    except Exception:
        traceback.print_exc()
    publisher.failing = error


def cmd_run(cfg: Settings, args: argparse.Namespace) -> None:
    desk = trading_desk(cfg, args)
    url = start_dashboard(cfg, cfg.db_path, args)[1] if args.dashboard else ""
    desk.store.set("dashboard_url", url)
    if _keep_awake():
        print(
            "Il PC non andrà in sospensione finché il desk è acceso (lo schermo può spegnersi). "
            "Chiudere il portatile o scegliere Sospendi lo ferma comunque.",
            flush=True,
        )
    publisher = None
    if live.Publisher.configured(cfg):
        try:
            publisher = live.Publisher(cfg, cfg.db_path)
            print("Pagina live: il desk invia i suoi dati ogni minuto.", flush=True)
        except ValueError as e:
            print(f"Pagina live spenta: {e}", flush=True)
    schedule = Schedule(period=desk.market.candle_ms / 1000)
    mode = "solo regole" if desk.llm is None else f"analisti {cfg.model}"
    if cfg.market == "perps":
        mode = f"perpetui long e short su {cfg.exchange}, {mode}"
    desk.say(
        "DESK", f"avviato in modalità {cfg.mode} ({mode}), un ciclo a ogni candela {cfg.timeframe}"
    )
    try:
        while True:
            try:
                run_once(desk, schedule, time.time())
            except Exception as e:  # keep watching open positions whatever goes wrong
                traceback.print_exc()
                try:
                    desk.say("DESK", f"errore inatteso, il desk continua: {e}", kind="error")
                except Exception:  # the journal itself failed (disk full, file locked)
                    traceback.print_exc()
            if publisher:
                publish(desk, publisher, time.time())
            time.sleep(cfg.monitor_seconds)
    except KeyboardInterrupt:
        desk.say("DESK", "fermato dall'utente; le posizioni aperte restano senza controllo")


def cmd_snapshot(cfg: Settings, args: argparse.Namespace) -> None:
    for path in snapshot.run(cfg, args.out):
        print(path.resolve())


def cmd_status(cfg: Settings, args: argparse.Namespace) -> None:
    if cfg.market == "perps":
        status_perps(cfg)
        return
    store = Store(cfg.db_path)
    init_book(store, cfg)
    market = open_market(cfg)
    book = value_book(store, market, time.time())
    q = cfg.quote
    print(f"Modalità {cfg.mode} · {cfg.exchange} · {cfg.timeframe}")
    print(
        f"Equity {book.equity:.2f} {q} ({book.equity / cfg.capital - 1:+.2%} dal capitale "
        f"iniziale {cfg.capital:.2f}) · cash {book.cash:.2f} · in posizione {book.exposure:.2f}"
    )
    print(
        f"Oggi {book.equity / book.day_start_equity - 1:+.2%} · "
        f"drawdown dal picco {1 - book.equity / book.peak_equity:.2%}"
    )
    print(f"Stato: {'FERMO, ' + book.halted if book.halted else 'operativo'}")

    positions = store.positions()
    print(f"\nPosizioni aperte: {len(positions)}")
    for pos in positions:
        try:
            last = market.price(pos.symbol)
        except MarketError:
            last = pos.entry_price
        print(
            f"  {pos.symbol:<14} {pos.qty:g} @ {pos.entry_price:g} · ora {last:g} "
            f"({last / pos.entry_price - 1:+.2%}) · stop {pos.stop:g} · target {pos.target:g}"
        )

    trades = store.trades()
    if trades:
        wins = sum(t.pnl > 0 for t in trades)
        print(
            f"\nTrade chiusi: {len(trades)} · vinti {wins / len(trades):.0%} · "
            f"R medio {sum(t.r_multiple for t in trades) / len(trades):+.2f} · "
            f"P&L {sum(t.pnl for t in trades):+.2f} {q}"
        )
    print(
        f"\nSpesa analisti (stima): ${store.get_float('llm_cost'):.2f} · "
        f"{store.get_float('llm_input_tokens'):,.0f} token in, "
        f"{store.get_float('llm_output_tokens'):,.0f} out, "
        f"{store.get_float('llm_searches'):.0f} ricerche web"
    )


def status_perps(cfg: Settings) -> None:
    store = Store(cfg.db_path)
    init_book(store, cfg)
    market = open_market(cfg)
    book = value_perps_book(store, market, time.time())
    q = cfg.quote
    print(f"Perpetui, modalità {cfg.mode} · {cfg.exchange} · {cfg.timeframe}")
    print(
        f"Equity {book.equity:.2f} {q} ({book.equity / cfg.capital - 1:+.2%} dal capitale "
        f"iniziale {cfg.capital:.2f}) · cash {book.cash:.2f} · valore delle posizioni "
        f"{book.exposure:.2f} · margine impegnato {book.margin:.2f}"
    )
    print(
        f"Oggi {book.equity / book.day_start_equity - 1:+.2%} · "
        f"drawdown dal picco {1 - book.equity / book.peak_equity:.2%}"
    )
    print(f"Stato: {'FERMO, ' + book.halted if book.halted else 'operativo'}")

    positions = store.perps_positions()
    prices = store.get_json("prices")
    print(f"\nPosizioni aperte: {len(positions)}")
    for pos in positions:
        last = prices.get(pos.symbol, pos.entry_price)
        print(
            f"  {pos.symbol:<16} {perps.SIDE_NAME[pos.side]:<5} {pos.qty:g} @ {pos.entry_price:g} "
            f"· ora {last:g} ({pos.profit(last) - pos.fees - pos.funding:+.2f} {q}) · stop "
            f"{pos.stop:g} · target {pos.target:g} · leva x{pos.leverage:.1f} · margine "
            f"{pos.margin:.2f} · liquidazione {pos.liquidation:g}"
        )

    trades = store.perps_trades()
    if trades:
        wins = sum(t.pnl > 0 for t in trades)
        print(
            f"\nTrade chiusi: {len(trades)} ({sum(t.side == 'short' for t in trades)} short) · "
            f"vinti {wins / len(trades):.0%} · "
            f"R medio {sum(t.r_multiple for t in trades) / len(trades):+.2f} · "
            f"P&L {sum(t.pnl for t in trades):+.2f} {q} · funding "
            f"{sum(t.funding for t in trades):+.2f}"
        )


def cmd_journal(cfg: Settings, args: argparse.Namespace) -> None:
    for event in Store(cfg.db_path).events(args.n):
        print_event(event.ts, event.agent, event.symbol, event.message)


def cmd_backtest(cfg: Settings, args: argparse.Namespace) -> None:
    if cfg.market == "perps":
        raise SystemExit(
            "Il backtest dei perpetui è la ricerca: uv run python research/perps.py download, "
            "poi uv run python research/perps.py run."
        )
    market = open_market(cfg)
    bars = int(args.days * 86_400_000 / market.candle_ms) + backtest.WINDOW
    histories = {}
    universe = market.universe()
    for n, (symbol, _) in enumerate(universe, start=1):
        print(f"\rScarico lo storico {n}/{len(universe)}: {symbol:<16}", end="", flush=True)
        try:
            histories[symbol] = market.history(symbol, bars)
        except MarketError as e:
            print(f"\n  saltato: {e}")
    print()
    result = backtest.run(histories, cfg)

    q = cfg.quote
    print(
        f"Backtest solo regole · {cfg.exchange} · {cfg.timeframe} · {result.symbols} mercati · "
        f"{datetime.fromtimestamp(result.start_ts):%d/%m/%Y} → "
        f"{datetime.fromtimestamp(result.end_ts):%d/%m/%Y}"
    )
    print(
        f"  Capitale {result.start_equity:.2f} → {result.end_equity:.2f} {q} "
        f"({result.return_pct:+.2f}%)"
    )
    if result.benchmark_pct is not None:
        print(f"  BTC comprato e tenuto nello stesso periodo: {result.benchmark_pct:+.2f}%")
    print(f"  Drawdown massimo {result.max_drawdown_pct:.2f}% · commissioni {result.fees:.2f} {q}")
    factor = "n/d" if result.profit_factor is None else f"{result.profit_factor:.2f}"
    print(
        f"  Trade chiusi {len(result.trades)} · vinti {result.win_rate:.0f}% · "
        f"R medio {result.avg_r:+.2f} · profit factor {factor} · "
        f"ancora aperti {result.open_positions}"
    )
    reasons: dict[str, int] = {}
    for trade in result.trades:
        reasons[trade.reason] = reasons.get(trade.reason, 0) + 1
    if reasons:
        print("  Uscite: " + ", ".join(f"{k} {v}" for k, v in sorted(reasons.items())))
    if result.leverage:
        print_leverage(result, cfg)
    print(
        "\nLimiti: nessun analista LLM (non si possono rigiocare le notizie del passato); "
        "l'universo è quello dei mercati più liquidi oggi, quindi i risultati sono "
        "ottimistici; un periodo breve non dice nulla sul futuro."
    )


def print_leverage(result: backtest.Result, cfg: Settings) -> None:
    """The same trades on a simulated perpetual, one line per leverage level."""
    q = cfg.quote
    print(
        f"\nLeva simulata sulle stesse operazioni (perpetual a margine isolato: commissione "
        f"{cfg.futures_fee_rate:.2%} sul valore intero, finanziamento {cfg.funding_rate_8h:.2%} "
        f"ogni 8 ore, margine di mantenimento {cfg.maintenance_margin:.1%})"
    )
    print(
        f"  {'leva':<8}{'capitale finale':>15}{'rendimento':>12}{'drawdown':>10}"
        f"{'liquidate':>11}{'commissioni':>13}{'finanziamento':>15}"
    )
    print(
        f"  {'x1 spot':<8}{result.end_equity:>15.2f}{result.return_pct:>+11.1f}%"
        f"{result.max_drawdown_pct:>9.1f}%{'-':>11}{result.fees:>13.2f}{'-':>15}   (spot, il desk)"
    )
    for book in result.leverage:
        closed = len(book.results) + len(book.legs)
        note = (
            f"   AZZERATO il {datetime.fromtimestamp(book.wiped_at):%d/%m %H:%M}"
            if book.wiped_at is not None
            else ""
        )
        label = "x1 perp" if book.level == 1 else f"x{book.level:g}"
        print(
            f"  {label:<8}{book.last_equity:>15.2f}"
            f"{(book.last_equity / book.start - 1) * 100:>+11.1f}%{book.max_drawdown_pct:>9.1f}%"
            f"{f'{book.liquidations}/{closed}':>11}{book.fees:>13.2f}{book.funding:>15.2f}{note}"
        )
    entries = len(result.trades) + result.open_positions
    if result.unleveraged:
        difference = (
            "commissioni, finanziamento e le operazioni rimaste senza leva. "
            f"{result.unleveraged} operazioni su {entries} erano su monete fuori dalla lista "
            "della leva (memecoin e simili): restano solo nello spot."
        )
    else:
        difference = "solo commissioni e finanziamento."
    print(
        f"  Valori in {q}. 'liquidate' = posizioni perse per liquidazione / posizioni aperte. "
        f"x1 perp è lo stesso contratto senza leva: la differenza con x1 spot sono {difference} "
        "Con la leva il desk non cambia le sue regole: cambia solo quanto pesa ogni operazione."
    )


def cmd_radar(cfg: Settings, args: argparse.Namespace) -> None:
    try:
        report = radar.scan(args.address, time.time() * 1000)
    except radar.RadarError as e:
        raise SystemExit(f"Radar: {e}") from e
    price = "—" if report.price is None else f"${report.price:.6g}"
    print(f"{report.name} ${report.symbol} · {report.chain}")
    market_cap, liquidity = _usd(report.market_cap), _usd(report.liquidity)
    print(f"Prezzo {price} · market cap {market_cap} · liquidità {liquidity}")
    print(f"\nPunteggio {report.total}/100 · {report.tier} · dati verificati {report.coverage}%")
    if report.gate:
        print(f"GATE FALLITO: struttura compatibile con un rug. Punteggio limitato a {report.cap}.")
    elif report.cap:
        print(f"Sicurezza non verificata: punteggio limitato a {report.cap}.")
    print()
    for item in report.items:
        points = f"{item.points}/{item.max}" if item.verified else f"0/{item.max} non verificato"
        print(f"  {item.label:<26} {item.value:>18}   {points}")
    if report.traps:
        print("\nTrappole: " + " · ".join(report.traps))
    print(
        "\nÈ una lettura del rischio, non un segnale di acquisto. Social e crescita degli holder "
        "non si possono verificare in automatico, quindi valgono zero."
    )


def _usd(amount: float | None) -> str:
    if amount is None:
        return "—"
    for size, unit in ((1e9, "B"), (1e6, "M"), (1e3, "k")):
        if amount >= size:
            return f"${amount / size:.2f}{unit}"
    return f"${amount:.2f}"


def cmd_halt(cfg: Settings, args: argparse.Namespace) -> None:
    Store(cfg.db_path).set("halted", "fermato a mano")
    print("Desk fermo: nessuna nuova entrata. Le posizioni aperte restano gestite da `desk run`.")


def cmd_resume(cfg: Settings, args: argparse.Namespace) -> None:
    store = Store(cfg.db_path)
    init_book(store, cfg)
    value = value_perps_book if cfg.market == "perps" else value_book
    book = value(store, open_market(cfg), time.time())
    store.set("halted", "")
    store.set("peak_equity", book.equity)  # drawdown is measured from here again
    print(f"Desk riattivato. Nuovo riferimento per il drawdown: {book.equity:.2f} {cfg.quote}.")


def cmd_close_all(cfg: Settings, args: argparse.Namespace) -> None:
    args.rules_only = True
    trading_desk(cfg, args).close_all()


def _never_crash_on_print() -> None:
    """A console that cannot show a character must print '?' rather than stop the desk.
    Git Bash on Windows, for one, hands Python the cp1252 code page, which has no '→'."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(errors="replace")


def _keep_console_responsive() -> None:
    """On Windows a click inside the console window starts a text selection, and any
    program that prints is frozen until the selection ends: the desk would stop
    trading without a word. Turn that selection mode off for this window, and let the
    console show the agents' colours instead of their codes."""
    global _ansi
    if sys.platform != "win32":
        return
    import ctypes

    kernel32 = ctypes.windll.kernel32
    console_input = kernel32.GetStdHandle(-10)  # STD_INPUT_HANDLE
    mode = ctypes.c_uint32()
    if kernel32.GetConsoleMode(console_input, ctypes.byref(mode)):
        quick_edit, extended_flags = 0x0040, 0x0080
        kernel32.SetConsoleMode(console_input, (mode.value & ~quick_edit) | extended_flags)
    console_output = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
    if kernel32.GetConsoleMode(console_output, ctypes.byref(mode)):
        virtual_terminal = 0x0004
        _ansi = bool(kernel32.SetConsoleMode(console_output, mode.value | virtual_terminal))


def _keep_awake() -> bool:
    """Ask Windows not to sleep while this process runs; the screen may still turn off.
    Windows drops the request when the process ends. Returns whether it was granted."""
    if sys.platform != "win32":
        return False
    import ctypes

    continuous, system_required = 0x80000000, 0x00000001
    return bool(ctypes.windll.kernel32.SetThreadExecutionState(continuous | system_required))


def _use_system_certificates() -> None:
    """Check HTTPS certificates against the operating system's own store, as browsers do.

    An antivirus that inspects HTTPS adds its root certificate there and nowhere else, so
    Python's bundled list would reject every connection to the exchange.
    """
    if sys.platform not in ("win32", "darwin"):
        return
    try:
        import truststore
    except ImportError:
        return
    truststore.inject_into_ssl()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="desk", description="Desk di trading multi-agente. Parte in paper trading."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def command(name: str, handler, help_: str, *, trades: bool = False, desk: bool = True):
        p = sub.add_parser(name, help=help_)
        p.set_defaults(handler=handler)
        if desk:
            # Also tells the two desks' processes apart by their command line.
            p.add_argument(
                "--market",
                choices=("spot", "perps"),
                help="spot o perps (perpetui, solo paper): prevale su DESK_MARKET",
            )
        if trades:
            p.add_argument("--live", action="store_true", help="opera con soldi veri")
        return p

    rules = "senza analisti LLM: decide solo il codice (Scout, Charts, Risk)"
    command("scan", cmd_scan, "cosa vedono ora Scout e Charts, senza operare")
    no_key = "usa gli analisti se c'è la chiave Anthropic, altrimenti solo le regole"
    cycle = command("cycle", cmd_cycle, "un ciclo completo del desk", trades=True)
    cycle.add_argument("--rules-only", action="store_true", help=rules)
    cycle.add_argument("--rules-if-no-key", action="store_true", help=no_key)

    def web(p: argparse.ArgumentParser) -> None:
        p.add_argument("--port", type=int, default=8787, help="porta della dashboard")
        p.add_argument("--host", default="127.0.0.1", help="indirizzo su cui ascoltare")
        p.add_argument("--open", action="store_true", help="apre la dashboard nel browser")

    run = command("run", cmd_run, "il desk gira in continuo", trades=True)
    run.add_argument("--rules-only", action="store_true", help=rules)
    run.add_argument("--rules-if-no-key", action="store_true", help=no_key)
    run.add_argument("--dashboard", action="store_true", help="avvia anche la dashboard")
    web(run)
    board = command("dashboard", cmd_dashboard, "pagina web con gli agenti in diretta")
    board.add_argument("--demo", action="store_true", help="sessione dimostrativa, dati fittizi")
    web(board)
    command("status", cmd_status, "equity, posizioni, risultati e spesa per gli analisti")
    command(
        "snapshot", cmd_snapshot, "fotografia del desk per la pagina ARGO DESK Live"
    ).add_argument("--out", type=Path, default=Path("data/live"), help="cartella dei file")
    command("journal", cmd_journal, "il diario del desk: chi ha detto cosa e perché").add_argument(
        "-n", type=int, default=40, help="quante righe mostrare"
    )
    command("backtest", cmd_backtest, "le regole del desk rigiocate sullo storico").add_argument(
        "--days", type=int, default=30, help="giorni di storico"
    )
    command(
        "radar", cmd_radar, "punteggio di rischio di un token DEX (memecoin)", desk=False
    ).add_argument("address", help="contract address Solana o EVM")
    command("halt", cmd_halt, "blocca le nuove entrate")
    command("resume", cmd_resume, "riattiva il desk dopo un blocco")
    command("close-all", cmd_close_all, "vende tutte le posizioni del desk", trades=True)

    args = parser.parse_args(argv)
    _use_system_certificates()
    _never_crash_on_print()
    _keep_console_responsive()
    market = getattr(args, "market", None)
    try:
        args.handler(Settings(market=market) if market else Settings(), args)
    except MarketError as e:
        raise SystemExit(f"Dati di mercato non disponibili: {e}") from e
    except BrokerError as e:
        raise SystemExit(f"Exchange: {e}") from e


if __name__ == "__main__":
    main()
