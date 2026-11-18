# ArgoDesk su Freqtrade

Questa cartella contiene la strategia del nostro desk, **solo le regole** (senza gli analisti AI), riscritta per [Freqtrade](https://www.freqtrade.io), un programma open source molto diffuso per il trading automatico di criptovalute. Serve a tre cose:

1. **Controllare il nostro backtester** con un secondo motore, scritto da altri, sugli stessi tre anni di dati.
2. **Provare la strategia sul PC di casa in dry-run**: Freqtrade segue il mercato vero di Kraken ma simula gli ordini, con 1000 dollari finti.
3. **Più avanti, eventualmente, operare dal vivo** con lo stop-loss appoggiato direttamente su Kraken, invece di controllarlo noi una volta al minuto.

> **Per ora è tutto solo su carta.** Nella configurazione `dry_run` è `true`: Freqtrade non tocca soldi veri. Non serve, e non va scritta in nessun file, alcuna chiave API.

## Cosa c'è nella cartella

| File | A cosa serve |
|---|---|
| `user_data/strategies/ArgoDesk.py` | La strategia, regola per regola come nel desk. |
| `config.paper.json` | La prova su carta: Kraken, 1000 USD finti, al massimo 5 posizioni, candele da 4 ore, le 40 coppie in dollari più scambiate (come il desk). |
| `config.backtest.json` | Da aggiungere per il backtest: le 39 monete del test "U2" e una commissione dello 0,5%. |
| `tools/download_history.py` | Scarica tre anni di candele dall'archivio pubblico di Binance. |
| `docker-compose.yml` | Avvia il dry-run con Docker. |

## Le regole, in breve

Ogni 4 ore, appena si chiude una candela, la strategia guarda le 40 coppie in dollari più scambiate su Kraken (escluse stablecoin e valute).

**Quando entra.** Servono tutte queste condizioni insieme:
- il volume delle ultime 3 candele è almeno il doppio di quello delle 48 precedenti, e il prezzo sale;
- il trend è al rialzo: prezzo sopra la media EMA50 e EMA20 sopra EMA50;
- l'RSI non supera 80;
- la chiusura supera il massimo delle 20 candele precedenti;
- non c'è una resistenza entro 1R sopra il prezzo;
- lo stop (3 volte l'ATR, almeno l'1,5% del prezzo) non supera l'8%;
- le commissioni non superano un terzo del rischio;
- anche BTC è in trend al rialzo.

Se più monete sono pronte insieme, passa prima quella con il volume più anomalo.

**Quanto compra.** Perderebbe l'1% del capitale se scattasse lo stop. Non mette però più del 10% del capitale in una posizione e più del 50% in tutte. Con le regole attuali vale sempre il limite del 10%.

**Quando esce:**
- allo stop iniziale;
- a +1R lo stop sale al prezzo d'entrata più le commissioni;
- raggiunto il target (3R), lo stop segue il prezzo a 1R di distanza;
- dopo 72 ore chiude, se non è almeno a +0,5R.

**Quando si ferma:**
- niente nuove entrate se nella giornata si è perso il 3%;
- niente nuove entrate se il capitale è sceso del 15% dal suo massimo;
- dopo un'uscita in perdita, 12 ore di pausa su quella moneta.

## Come lanciare un backtest

Il backtest usa tre anni di candele da 4 ore di Binance: Kraken ne fornisce solo le ultime 720. Le monete vengono registrate con i nomi delle coppie in dollari di Kraken. Le monete cambiate di nome sono unite al loro nome nuovo: MATIC è diventata POL, FTM è diventata S e RNDR è diventata RENDER. ORDI manca perché Kraken non la quota; nel nostro backtester non ha mai fatto operazioni, quindi i risultati non cambiano.

**Con Docker** (vedi sotto come installarlo), dalla cartella `freqtrade`:

```
docker compose run --rm --entrypoint python freqtrade tools/download_history.py
docker compose run --rm freqtrade backtesting --config config.paper.json --config config.backtest.json --timerange 20231101-20261101
```

**Con Python**, dalla cartella `freqtrade`:

```
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install freqtrade==2026.10
.venv\Scripts\python tools\download_history.py
.venv\Scripts\freqtrade backtesting --config config.paper.json --config config.backtest.json --timerange 20231101-20261101
```

Per un solo anno basta cambiare il periodo:
- primo anno: `--timerange 20231101-20241101`;
- secondo anno: `--timerange 20241101-20251101`;
- terzo anno: `--timerange 20251101-20261101`.

Nel riepilogo finale contano soprattutto queste righe:
- `Total profit %`: il rendimento;
- `Win%`: la quota di operazioni chiuse in guadagno;
- `Profit factor`: i guadagni divisi per le perdite;
- `Max % of account underwater`: il drawdown massimo.

Freqtrade calcola il drawdown solo sulle operazioni chiuse. Il nostro desk lo calcola anche sulle posizioni aperte, quindi i due numeri non coincidono (vedi sotto).

## Come avviare il dry-run su Windows

**Consiglio Docker.** È il metodo che gli sviluppatori di Freqtrade raccomandano su Windows: il bot gira in un ambiente isolato, con la versione esatta che abbiamo provato (2026.10), e riparte da solo quando si riaccende il PC.

1. Installa **Docker Desktop** per Windows da docker.com e riavvia il PC se lo chiede. Aprilo una volta e aspetta che dica che il motore è attivo. In *Settings → General* attiva l'avvio automatico all'accesso.
2. Copia la cartella `freqtrade` sul PC, per esempio in Documenti.
3. Apri la cartella in Esplora file. Clicca sulla barra dell'indirizzo, scrivi `cmd` e premi Invio: si apre un terminale già nella cartella.
4. Avvia il bot:
   ```
   docker compose up -d
   ```
   La prima volta scarica Freqtrade (circa 300 MB).
5. Per vedere cosa fa:
   ```
   docker compose logs -f
   ```
   Con Ctrl+C smetti di guardare; il bot continua a girare.
6. Per fermarlo:
   ```
   docker compose down
   ```
   Per riavviarlo, di nuovo `docker compose up -d`.

Le operazioni simulate restano nel file `user_data/tradesv3.dryrun.sqlite`, il diario in `user_data/logs/freqtrade.log`. Per vedere l'elenco delle operazioni:

```
docker compose run --rm freqtrade show-trades --db-url sqlite:////freqtrade/user_data/tradesv3.dryrun.sqlite
```

**Alternativa senza Docker.** Installa Python 3.12 da python.org, spuntando "Add python.exe to PATH". Poi, nella cartella `freqtrade`, esegui le prime due righe della sezione "Con Python" qui sopra, e infine:

```
.venv\Scripts\freqtrade trade --config config.paper.json --db-url sqlite:///user_data/tradesv3.dryrun.sqlite
```

Funziona, ma la finestra deve restare aperta. Se una libreria non si installa, su Windows servono passaggi in più.

**Quando lavora il bot.** Decide solo subito dopo la chiusura di ogni candela da 4 ore: alle 1, 5, 9, 13, 17 e 21 ora italiana d'inverno, un'ora dopo d'estate. Compra solo nei 15 minuti dopo la chiusura, come il desk. Il PC deve essere acceso e collegato. Se dorme, quel giro salta e le posizioni aperte non vengono seguite: in dry-run non costa nulla.

## Confronto con il nostro backtester (U2, commissione 0,4% più 0,1% di slippage)

Abbiamo fatto girare entrambi i motori sulle stesse candele Binance del test U2. Il nostro backtester è stato rilanciato come in `longbt/full.py`, con le regole attuali (stop a 3 ATR). In ogni cella il primo numero è il nostro desk, il secondo è Freqtrade.

| Periodo | Operazioni | Rendimento | Vincenti | Profit factor | Drawdown massimo |
|---|---|---|---|---|---|
| nov 2023 → nov 2024 | 94 / 94 | +3,87% / +3,70% | 29,8% / 29,8% | 1,16 / 1,16 | 7,80% / 7,82% |
| nov 2024 → nov 2025 | 75 / 75 | +10,56% / +10,47% | 33,3% / 33,3% | 1,53 / 1,52 | 7,71% / 7,74% |
| nov 2025 → nov 2026 | 87 / 87 | +11,09% / +10,87% | 31,0% / 31,0% | 1,46 / 1,45 | 11,04% / 11,14% |
| **tre anni** | **256 / 256** | **+27,56% / +27,01%** | **31,2% / 31,2%** | **1,38 / 1,37** | **11,45% / 11,57%** |

**Quante operazioni sono identiche.** Contiamo identica un'operazione con stessa moneta, stessa candela d'entrata e stessa candela d'uscita:
- primo anno: 93 su 94;
- secondo anno: 75 su 75;
- terzo anno: 87 su 87;
- tre anni: 255 su 256.

Sulle operazioni identiche il risultato differisce di pochi centesimi. Freqtrade esce allo stop arrotondato al prezzo minimo quotato. Esce per tempo all'apertura della candela successiva, non alla chiusura. E conta lo slippage dentro la commissione.

Il drawdown in tabella è misurato per entrambi come fa il desk, a ogni chiusura di candela e con le posizioni aperte. Il drawdown che stampa Freqtrade, solo sulle operazioni chiuse, è più basso: 5,1%, 6,1%, 8,7% e 9,8%.

**L'unica operazione diversa, con la sua conseguenza:**
- **OP, 7 febbraio 2024: solo nel nostro desk** (+1,72 USD). Oggi Kraken accetta ordini da almeno 45 OP. Ai prezzi di febbraio 2024 sono circa 140 dollari, 157 con il margine che Freqtrade aggiunge: più della nostra posizione, 98 dollari. Freqtrade quindi rinuncia. Il nostro backtester non conosce i minimi d'ordine dell'exchange.
- **UNI, 9 febbraio 2024: solo in Freqtrade** (+1,11 USD). È la conseguenza della prima. Nel desk i 5 posti erano tutti occupati, perché OP era ancora aperta, e UNI non è stata nemmeno valutata. In Freqtrade c'era un posto libero.

**Per arrivare a questo risultato la strategia corregge quattro abitudini di Freqtrade**, che altrimenti cambierebbero le operazioni:
- **Stop e massimo della candela.** Nel backtest Freqtrade alza lo stop con il massimo di una candela e poi controlla il minimo della stessa candela; il desk fa il contrario. E se il minimo è già sotto il vecchio stop, Freqtrade non alza nemmeno quello che il desk aveva già alzato. Esempio senza correzione: UNI del 16 giugno 2026 sarebbe uscita a 3,395 invece di 3,534.
- **Arrotondamento dello stop.** Freqtrade arrotonda lo stop per eccesso al prezzo minimo quotato, quindi scatta un soffio prima. Esempio senza correzione: ARB del 19 agosto 2026 sarebbe uscita tre candele prima, con +13,6 USD invece di +22,6; anche RUNE e STX sarebbero uscite in anticipo.
- **Uscita per tempo.** Freqtrade vende all'apertura successiva, dopo aver già deciso i nuovi acquisti; il desk vende alla chiusura e riusa subito posto e liquidità. Senza correzione mancavano BTC del 9 novembre 2023, ATOM del 24 agosto 2024 e FTM del 17 aprile 2026.
- **Ordine delle monete.** Freqtrade chiede l'importo moneta per moneta, nell'ordine della sua lista; il desk le serve in ordine di volume anomalo. Conta quando il limite del 50% si fa stretto.

Anche gli indicatori (EMA, RSI, ATR) sono calcolati come nel desk, sulle ultime 200 candele. Su tre anni le 569 occasioni d'entrata trovate dai due motori coincidono una per una.

## Cosa non è ancora identico al desk

Nel backtest:
- **ORDI** manca, perché Kraken non la quota. Per U2 non cambia nulla.
- **Minimi d'ordine.** Freqtrade applica i minimi di oggi di Kraken, espressi in monete, anche ai prezzi del passato: è il caso di OP.
- **Slippage.** È conteggiato nella commissione (0,5% a lato) invece che sul prezzo. I livelli di stop e target sono comunque calcolati dal prezzo con lo slippage, come nel desk.
- **Stop.** È arrotondato al prezzo minimo quotato (per difetto, così scatta sugli stessi prezzi del desk).
- **Uscita per tempo.** Avviene all'apertura della candela successiva: è lo stesso istante della chiusura, il prezzo di solito coincide.
- **Candele mancanti.** Freqtrade le riempie con candele piatte a volume zero, il desk le salta. Nei nostri dati succede solo nei cambi di nome di POL, S e RENDER, senza effetti.
- **Monete appena quotate.** Freqtrade aspetta 200 candele (circa 33 giorni) prima di usarle, il desk 60 (10 giorni).
- **Posizioni aperte a fine test.** Freqtrade le chiude all'ultima apertura, il desk le valuta. In questi test non ce n'erano.

In dry-run e dal vivo:
- **Analisti AI.** Non ci sono: Freqtrade replica il desk in modalità "solo regole".
- **Valore del conto.** Per dimensioni e limiti è calcolato alle chiusure delle candele, non ai prezzi di ogni minuto.
- **Dopo un riavvio.** Il massimo del capitale viene ricostruito dalle sole operazioni chiuse, e la perdita della giornata riparte da zero. Non c'è un comando come `desk resume`: per fermare i nuovi acquisti si usano i comandi di Freqtrade.
- **Stop.** Il bot lo controlla ogni pochi secondi (il desk ogni minuto). È già impostato anche come ordine su Kraken (`stoploss_on_exchange`); in dry-run Freqtrade lo simula.
- **Prezzi d'esecuzione.** In dry-run gli ordini a mercato sono eseguiti sul libro ordini vero di Kraken, con lo slippage reale, più la commissione dello 0,4%.
- **Elenco delle monete.** Si aggiorna ogni 30 minuti; stablecoin e valute sono escluse come nel desk.
- **Senza candela di BTC.** Se BTC non ha una candela, Freqtrade usa la precedente per il filtro di mercato, mentre il desk salta il filtro. Nei dati non è mai successo.
- **Altri pezzi del desk.** La simulazione con leva, la dashboard e il diario del desk non sono stati portati.

## Prima del live (non ora)

Il passaggio al live non è attivo e non va fatto adesso. Quando lo decideremo:
- le chiavi di Kraken non andranno mai scritte in questi file;
- andrà fissato il capitale che il bot può usare (`available_capital`);
- lo stop su Kraken è già impostato nella configurazione.
