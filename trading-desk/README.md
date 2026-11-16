# Trading Desk

Un desk di trading crypto spot fatto di più agenti: alcuni sono codice, altri sono
modelli Claude. Scansiona i mercati più liquidi di un exchange, discute ogni occasione
e, se supera tutti i controlli, compra e gestisce l'uscita. Parte in **paper trading**:
prezzi veri, soldi finti.

Non è una macchina per fare soldi. Nessuno dei numeri che girano sui social
("$89 → $68.024") è riproducibile, e la maggior parte dei bot retail perde. Quello che
questo progetto ti dà è un sistema che puoi leggere, misurare con un backtest e far
girare a rischio zero finché i numeri non ti convincono.

## Chi siede al desk

| Agente | Cosa fa | Chi decide |
|---|---|---|
| **Scout** | Trova i mercati con volume anomalo e prezzo in salita | codice |
| **Charts** | Legge il trend e fissa entrata, stop e target | codice |
| **News** | Cerca sul web perché il mercato si sta muovendo | Claude + ricerca web |
| **Sentiment** | Distingue interesse reale da hype | Claude + ricerca web |
| **Skeptic** | Deve dare tre motivi concreti per non comprare | Claude |
| **Chief** | Risponde alle obiezioni e decide BUY, WAIT o SKIP | Claude |
| **Risk** | Dimensiona, riduce o blocca ogni operazione | codice |
| **Executor** | Compra, sposta lo stop, vende | codice |

```
Scout → Charts → Risk (controllo preventivo) → News + Sentiment → Skeptic → Chief → Risk → Executor
```

Tre scelte di progetto contano più delle altre:

- **I numeri li fa il codice.** Livelli, size e stop sono calcolati, non stimati da un
  modello. Gli stessi calcoli girano dal vivo e nel backtest.
- **Gli analisti giudicano, non toccano soldi.** Il BUY del Chief è una richiesta.
  Viene annullato se un'obiezione seria dello Skeptic resta senza risposta o se la
  fiducia è sotto soglia, e poi passa comunque dal Risk.
- **Il Risk ha l'ultima parola.** È codice: nessun prompt e nessuna pagina web letta
  dagli analisti può fargli superare i limiti.

## Per iniziare

Serve [uv](https://docs.astral.sh/uv/).

```bash
cd trading-desk
uv sync
cp .env.example .env        # facoltativo: i default sono già in paper trading

uv run desk scan            # cosa vedono ora Scout e Charts
uv run desk backtest --days 30
uv run desk run --rules-only   # desk in continuo, senza analisti LLM, soldi finti
```

Per accendere gli analisti metti `ANTHROPIC_API_KEY` in `.env` e lancia `uv run desk run`.

| Comando | A cosa serve |
|---|---|
| `desk scan` | Fotografia del mercato, senza operare |
| `desk cycle` | Un solo giro completo del desk |
| `desk run` | Giro completo a ogni chiusura di candela, controllo delle posizioni ogni minuto |
| `desk status` | Equity, posizioni, risultati, spesa stimata per gli analisti |
| `desk journal` | Chi ha detto cosa e perché |
| `desk backtest` | Le regole rigiocate sullo storico, con commissioni e slippage |
| `desk halt` / `desk resume` | Blocca o riattiva le nuove entrate |
| `desk close-all` | Vende tutte le posizioni del desk |

Tutte le impostazioni sono in `.env.example`, con il loro significato. I default
puntano a Kraken con coppie in USD e commissione taker dello 0,4%: è la configurazione
su cui il desk è stato provato con dati reali. Su Kraken le coppie in EUR abbastanza
liquide sono una decina, quelle in USD una quarantina. Per un altro exchange cambia
`DESK_EXCHANGE`, `DESK_QUOTE` e `DESK_FEE_RATE`.

## Le regole di rischio

- Ogni operazione rischia l'1% del capitale: la size deriva dalla distanza dello stop.
- Massimo 10% del capitale per posizione, 50% investito in totale, 5 posizioni.
- Lo stop sta a 2 ATR dall'entrata. A +1R sale a pareggio; raggiunto il target (2R)
  segue il prezzo a distanza di 1R, così i vincenti possono correre.
- Persa il 3% in un giorno: niente nuove entrate fino al giorno dopo.
- Sceso del 15% dal picco: il desk si ferma finché non lanci `desk resume`.
- Dopo un'uscita in perdita, quel mercato resta escluso per 12 ore.
- Niente operazioni in cui commissioni e slippage superano un terzo del rischio: con
  uno stop stretto su un exchange caro si perde anche avendo ragione.
- Niente nuovi acquisti mentre BTC è in trend ribassista.

## Cosa dice il backtest

Solo regole (Scout, Charts, Risk, uscite), senza analisti, su dati reali di Kraken,
40 mercati in USD, commissione 0,4% e slippage 0,1% per lato. Misurato il 16/11/2026.

| Candele | Periodo | Desk | BTC tenuto fermo | Operazioni | Vincenti | Drawdown max |
|---|---|---|---|---|---|---|
| 1h | 30 giorni | −6,8% | −19,9% | 33 | 12% | 7,4% |
| 4h | 120 giorni | +13,5% | +0,8% | 85 | 38% | 8,7% |

Come leggerli:

- Sono due campioni piccoli che si contraddicono. Non dimostrano che il desk guadagna,
  e nemmeno che su 4h funziona: è un solo periodo.
- L'universo è quello dei mercati più liquidi **oggi**, quindi contiene già i vincitori
  del periodo. I numeri sono ottimistici.
- La prima versione, senza i due filtri su costi e trend di mercato, sullo stesso mese
  a 1h perdeva il 10,4%, più di metà in commissioni. I filtri sono stati aggiunti dopo
  aver visto quel risultato: riducono il danno, non creano un vantaggio.
- Gli analisti LLM non sono nel backtest. Possono solo scartare operazioni che le
  regole farebbero: se migliorano o peggiorano il risultato lo dirà il paper trading.

Rifallo tu con `uv run desk backtest --days 30` (per le candele a 4 ore:
`DESK_TIMEFRAME=4h uv run desk backtest --days 120`). Kraken fornisce al massimo 720
candele di storico per mercato.

## Quanto costano gli analisti

Ogni mercato discusso richiede quattro chiamate a Claude, due con ricerca web. Con il
modello di default è, a stima, nell'ordine di qualche decimo di dollaro a discussione: su un
conto piccolo può costare più di quanto il desk guadagna. Per questo gli analisti
vedono solo i mercati che hanno già superato Scout, Charts e Risk, al massimo
`DESK_MAX_CANDIDATES` per ciclo, e non ridiscutono lo stesso mercato per
`DESK_REANALYZE_HOURS` ore. `desk status` mostra la spesa stimata accanto al risultato.
Puoi cambiare modello con `DESK_MODEL`.

## Passare ai soldi veri

Fallo solo dopo settimane di paper trading con risultati che capisci.

1. Sull'exchange crea una chiave API con il **solo permesso di trading spot**. Prelievi
   disattivati, e se l'exchange lo permette limita la chiave al tuo indirizzo IP.
2. In `.env`: `DESK_MODE=live`, le chiavi `DESK_EXCHANGE_API_*`, e in `DESK_CAPITAL` una
   cifra che puoi permetterti di perdere per intero. Il desk tiene una contabilità
   propria e usa solo quel capitale, anche se sul conto c'è di più.
3. Lancia `uv run desk run --live`. Servono entrambe le cose, `DESK_MODE=live` e `--live`.

Limiti da conoscere prima:

- **Gli stop li gestisce il desk, non l'exchange.** Se il processo si ferma o perde la
  connessione, le posizioni restano aperte senza protezione. Deve girare su una
  macchina sempre accesa.
- Gli ordini sono a mercato: su coppie poco liquide lo slippage reale può superare
  quello simulato.
- Il desk compra soltanto (spot long). In un mercato che scende resta quasi sempre fermo.

## Cosa è stato verificato

- **Logica** di Scout, Charts, Risk, uscite, contabilità e backtest: test automatici
  (`uv run pytest`) su mercati sintetici.
- **Dati reali su Kraken**: scansione, ciclo completo in paper trading, loop continuo,
  blocco e riattivazione, backtest. Alcune operazioni del backtest sono state
  ricontrollate a mano sulle candele.
- **Binance**: non provato. L'ambiente di sviluppo non può raggiungerlo per un blocco
  geografico; il codice è lo stesso, ma il primo `desk scan` va guardato.
- **Chiamate a Claude e ordini reali**: provati solo contro controfigure che imitano
  l'SDK e l'exchange, mai contro i servizi veri. Il primo giro con una chiave Anthropic
  e i primi ordini live vanno seguiti a vista, con capitale minimo. Se un analista
  fallisce, il motivo compare nel diario e il desk non compra.

## Struttura

```
desk/
  agents/scout.py     volume anomalo
  agents/charts.py    trend, entrata, stop, target
  agents/analysts.py  prompt di News, Sentiment, Skeptic, Chief e regola del dibattito
  agents/llm.py       accesso a Claude con risposta strutturata
  risk.py             limiti, dimensionamento, regole di uscita
  broker.py           esecuzione simulata e reale (ccxt)
  market.py           dati di mercato (ccxt)
  desk.py             orchestrazione di un ciclo
  backtest.py         le stesse regole sullo storico
  store.py            SQLite: cassa, posizioni, operazioni, diario
  cli.py              i comandi
```
