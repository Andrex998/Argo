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

Il modo più semplice: fai doppio clic su `start.bat` (Windows) oppure lancia `./start.sh`
(Mac, Linux). Installa quello che serve, avvia il desk in paper trading e apre la
dashboard nel browser. `start.sh` è stato provato; `start.bat` no, perché il progetto
è stato sviluppato su Linux.

A mano serve [uv](https://docs.astral.sh/uv/).

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
| `desk run` | Giro completo a ogni chiusura di candela, controllo delle posizioni ogni minuto. Con `--dashboard` avvia anche la pagina web |
| `desk dashboard` | La pagina web con gli agenti in diretta. Con `--demo` mostra una sessione dimostrativa |
| `desk status` | Equity, posizioni, risultati, spesa stimata per gli analisti |
| `desk journal` | Chi ha detto cosa e perché |
| `desk backtest` | Le regole rigiocate sullo storico, con commissioni e slippage |
| `desk radar <indirizzo>` | Punteggio di rischio di un token DEX (memecoin) |
| `desk halt` / `desk resume` | Blocca o riattiva le nuove entrate |
| `desk close-all` | Vende tutte le posizioni del desk |

Tutte le impostazioni sono in `.env.example`, con il loro significato.

## La dashboard

![La dashboard durante una sessione demo](docs/dashboard.png)

`uv run desk run --dashboard --open` avvia il desk e apre `http://127.0.0.1:8787`. Se
quella porta è occupata, o riservata da Windows (succede con WSL, Docker o Hyper-V), la
dashboard ne prende un'altra e il browser si apre comunque sull'indirizzo giusto. Gira un
solo desk alla volta: se lo riavvii mentre è già acceso, ti apre la dashboard di quello
che sta girando invece di partire una seconda volta. La pagina si aggiorna da sola ogni
due secondi e mostra:

- **Gli agenti**: chi ha parlato per ultimo e chi sta lavorando in questo momento
  ("cerca cosa ha mosso il prezzo", "risponde alle obiezioni e decide").
- **La conversazione**: una discussione per ogni mercato, con le obiezioni dello
  Skeptic e sotto, una per una, le risposte del Chief: respinta o concessa.
- **Il conto**: equity, andamento, posizioni aperte rispetto a stop e target, e quanto
  di ogni limite di rischio è già usato.

Per vederla muoversi senza aspettare il mercato: `uv run desk dashboard --demo --open`.
La demo fa girare il desk vero (Scout, Charts, Risk, uscite) su cinque mercati
inventati, con analisti che leggono battute preparate. È marcata come demo in ogni
schermata, e i suoi risultati non dicono nulla su quelli reali.

La pagina è di sola lettura: non ha pulsanti né indirizzi che inviano ordini o cambiano
impostazioni. Non carica nulla da altri siti. Ascolta solo sul tuo computer; per aprirla
da un altro dispositivo della stessa rete aggiungi `--host 0.0.0.0`, sapendo che chiunque
su quella rete potrà vedere il conto.

## Quale piattaforma

Il desk parla con gli exchange attraverso [ccxt](https://github.com/ccxt/ccxt): per
cambiare piattaforma bastano tre righe in `.env`. Se sbagli valuta, `desk scan` ti
elenca quelle quotate sull'exchange.

| Piattaforma | `.env` | Stato |
|---|---|---|
| Kraken | `DESK_EXCHANGE=kraken` `DESK_QUOTE=USD` `DESK_FEE_RATE=0.004` | Provato con dati reali. È il default. |
| BingX | `DESK_EXCHANGE=bingx` `DESK_QUOTE=USDT` `DESK_FEE_RATE=0.001` | Provato con dati reali. |
| Bybit EU (residenti UE) | `DESK_EXCHANGE=bybiteu` `DESK_QUOTE=USDC` | Non provato: blocca per posizione il server di sviluppo. Quota in USDC ed EUR. |
| Bybit globale | `DESK_EXCHANGE=bybit` `DESK_QUOTE=USDT` | Non provato, stesso motivo. |
| Phantom | — | Non supportato: vedi sotto. |
| FOMO | — | Non automatizzabile: non risulta un'API pubblica. |

In `DESK_FEE_RATE` va la commissione taker spot del tuo conto: quella indicata per
BingX è un'ipotesi da verificare.

**Bybit e Bybit EU sono conti diversi.** Chi risiede nell'UE opera su bybit.eu, con
chiavi API proprie che non funzionano su bybit.com e viceversa.

**Phantom è un wallet, non un exchange.** Non ha un'API a cui un bot si collega: per
operare da solo il bot dovrebbe tenere la chiave privata del wallet e scambiare
on-chain. Questo strato non esiste nel progetto. Se un giorno lo aggiungi, usa un
wallet nuovo creato apposta, con dentro solo la cifra che accetti di perdere: mai la
chiave o la frase di recupero del wallet principale.

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

Solo regole (Scout, Charts, Risk, uscite), senza analisti, su dati reali. Kraken: 40
mercati in USD, commissione 0,4%. BingX: 27 mercati in USDT, commissione ipotizzata
0,1%. Slippage 0,1% per lato. Misurato il 16/11/2026.

| Exchange, candele | Periodo | Desk | BTC tenuto fermo | Operazioni | Vincenti | Drawdown max |
|---|---|---|---|---|---|---|
| Kraken, 1h | 30 giorni | −6,8% | −19,9% | 33 | 12% | 7,4% |
| Kraken, 4h | 120 giorni | +13,5% | +0,8% | 85 | 38% | 8,7% |
| BingX, 1h | 120 giorni | +1,2% | +2,1% | 200 | 27% | 11,5% |

Come leggerli:

- Il campione più grande, 200 operazioni su BingX, chiude in pari: guadagno medio per
  operazione zero. È la lettura più onesta delle regole da sole: non perdono e non
  hanno un vantaggio. I due campioni Kraken sono piccoli e si contraddicono.
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

## Radar: il filtro per le memecoin

`desk radar <contract address>` è il motore di ARGO // RADAR portato in Python. Legge
DexScreener e, per Solana, RugCheck, e dà un punteggio da 0 a 100 con la stessa regola
dell'originale: il dato che manca non si inventa, vale zero.

- 40 punti on-chain (volume, liquidità, pressione in acquisto, momentum, età).
- 20 punti di sicurezza. Mint o freeze authority attive, LP bloccata sotto il 50% o
  top 10 wallet oltre il 40% fanno fallire il gate: punteggio limitato a 15.
- 40 punti social e crescita degli holder non sono verificabili in automatico, quindi
  una scansione senza input manuali arriva al massimo a 56.
- Su token EVM la sicurezza non è verificata e il punteggio è limitato a 49.

I punteggi coincidono con quelli del motore JavaScript originale su dodici casi di
riferimento (`tests/radar_reference.json`), con una differenza voluta: il conto del
pool di liquidità non viene contato tra i top holder. Sui lanci recenti il pool o la
bonding curve detiene gran parte della supply, e l'originale lo leggeva come una
balena facendo fallire il gate su quasi tutti i token nuovi.

Due limiti: è tarato sui lanci recenti (su token maturi con liquidità concentrata,
come BONK, il gate LP dà "EVITARE"), e **non è collegato al trading**. Il desk opera
solo su exchange centralizzati: comprare token on-chain richiede una chiave privata
sulla macchina e uno strato di esecuzione che qui non esiste.

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
- **Dati reali su Kraken e BingX**: scansione e backtest su entrambi; su Kraken anche
  ciclo completo in paper trading, loop continuo, blocco e riattivazione. Alcune operazioni del backtest sono state
  ricontrollate a mano sulle candele.
- **Radar**: provato su token reali Solana ed EVM attraverso DexScreener e RugCheck.
- **Dashboard**: provata in un browser vero, su schermo grande e su telefono, tema
  chiaro e scuro, con la sessione demo e con il desk su dati reali di Kraken.
- **Bybit, Bybit EU e Binance**: non provati. Rifiutano le connessioni dal server di
  sviluppo per posizione geografica; il codice è lo stesso, ma il primo `desk scan` dal
  tuo computer va guardato.
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
  radar.py            punteggio di rischio per token DEX
  dashboard.py        server locale di sola lettura
  dashboard.html      la pagina
  demo.py             sessione dimostrativa per la dashboard
  store.py            SQLite: cassa, posizioni, operazioni, diario
  cli.py              i comandi
```
