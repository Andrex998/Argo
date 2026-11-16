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
| `desk run` | Giro completo ogni ora, controllo delle posizioni ogni minuto |
| `desk status` | Equity, posizioni, risultati, spesa stimata per gli analisti |
| `desk journal` | Chi ha detto cosa e perché |
| `desk backtest` | Le regole rigiocate sullo storico, con commissioni e slippage |
| `desk halt` / `desk resume` | Blocca o riattiva le nuove entrate |
| `desk close-all` | Vende tutte le posizioni del desk |

Tutte le impostazioni sono in `.env.example`, con il loro significato.

## Le regole di rischio

- Ogni operazione rischia l'1% del capitale: la size deriva dalla distanza dello stop.
- Massimo 10% del capitale per posizione, 50% investito in totale, 5 posizioni.
- Lo stop sta a 2 ATR dall'entrata. A +1R sale a pareggio; raggiunto il target (2R)
  segue il prezzo a distanza di 1R, così i vincenti possono correre.
- Persa il 3% in un giorno: niente nuove entrate fino al giorno dopo.
- Sceso del 15% dal picco: il desk si ferma finché non lanci `desk resume`.
- Dopo un'uscita in perdita, quel mercato resta escluso per 12 ore.

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

- Logica di Scout, Charts, Risk, uscite, contabilità e backtest: coperta da test
  automatici (`uv run pytest`) su mercati sintetici.
- Chiamate a Claude e ordini reali: testati contro controfigure che imitano l'SDK e
  l'exchange, **non** contro i servizi veri. Il primo giro con una chiave Anthropic e i
  primi ordini live vanno seguiti a vista, con capitale minimo.

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
