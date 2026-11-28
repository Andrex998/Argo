# Sessione: 2026-11-28 — ricerca della domenica, studio degli eventi, dati del funding

**Branch:** claude/beautiful-feynman-6mv3m5
**Ultimo commit:** 17068a0 fix(crypto-school): the funding history is repaired or refused, never used with holes

Questa sessione continua quella salvata in
`.claude/sessioni/2026-11-28-stato-scuole-e-limiti-uso.md`: per il quadro generale (desk,
scuole, pagine, attività programmate) leggi anche quel file.

## Cosa stiamo costruendo

ARGO è il progetto di trading del proprietario. La Scuola Cripto è una classe di otto agenti
IA che si allenano con soldi finti su prezzi veri di BingX. Il proprietario vuole che gli
agenti ragionino in modo indipendente, facciano le loro ricerche e, solo dopo mesi di numeri
verificati, che il metodo diventi uno strumento per guadagnare davvero. La decisione sui
soldi veri resta sua.

In questa sessione: correzioni al campus, una giornata di ricerca settimanale per gli
agenti, uno strumento per misurare l'effetto delle notizie sui prezzi, e la correzione di un
difetto nei dati del funding.

## Cosa funziona (con le prove)

- **Pagina Scuola Cripto, versione 6, pubblicata e privata:**
  https://claude.ai/artifact/WEB5jaWNy37UBRKYuscQne
  - Quattro correzioni al campus (commit fa4759a):
    - la riga di stato non dice più «riunione in corso» senza un segnale di diretta;
    - aprendo la pagina a riunione iniziata gli agenti sono subito seduti (provato: dopo
      2,5 secondi tutti e otto fermi al tavolo);
    - i posti al bancone del caffè sono a 1,3 m;
    - ombra della visiera più leggera sul Guardiano.
  - Nuova sezione «La ricerca»: 5 controlli su 5 con un database finto, compreso testo
    ostile (non diventa codice né link).
- **Le prove della pagina ora sono nel repository:** `crypto-school/prove-pagina/`
  (`smoke.js`, `live.js`, `ricerca.js`). Si lanciano con `node`, dopo
  `npm i three@0.128.0 marked@4.3.0 dompurify@3.0.6` in quella cartella.
- **La ricerca della domenica è accesa:** attività «Scuola Cripto · ricerca»
  (trig_01SeFSGerXrvkwgWK1WZt457), ogni domenica alle 16:23 ora italiana, prima corsa il
  29/11. La procedura è `crypto-school/RICERCA.md`. È aggiunta all'elenco di fine trimestre
  (PROCEDURA.md §11, README, messaggio della riunione del mattino).
- **Lo studio degli eventi:** `crypto-school/eventi.py` e `eventi.json` (le decisioni della
  Fed dal 2023, dal sito della Fed). 6 prove passano.
- **Il conto sul passato:** `crypto-school/storia.py` rifà i quattro portafogli a regole
  sugli anni passati.
- **Il lettore del funding ripara o rifiuta i buchi:** `crypto-school/data.py`, 7 prove.
  Con i parametri della corsa di ogni giorno (ultimi 200 giorni) le 36 monete sono arrivate
  complete, senza errori, in 27 secondi.
- **Tutte le prove della scuola:** 56 su 56 con
  `cd trading-desk && uv run --frozen pytest ../crypto-school/ -q`.
  Le 317 del trading desk non sono state rilanciate: il desk non è stato toccato.

## I numeri trovati (da non citare senza queste avvertenze)

**Le quattro regole su due anni** (dal 28/11/2024, 10.000 USDT, costi della scuola, funding
riparato, senza XRP, ATOM, AAVE e FTM che hanno ancora buchi):

| Agente | Finale | Anno 1 | Anno 2 | Perdita massima | Operazioni |
| --- | --- | --- | --- | --- | --- |
| Falco | 11.542 | −5,9% | +22,7% | −22,7% | 245 |
| Tartaruga | 9.898 | −1,3% | +0,3% | −2,7% | non contate |
| Spazzino | 10.524 | +2,6% | +2,5% | −1,9% | 230 |
| Ragioniere | 12.070 | +25,3% | −3,7% | −22,7% | 300 |

Le parti del risultato: Spazzino prezzo +766, funding −12, costi −231; Ragioniere prezzo
+2.823, funding +756, costi −1.509.

- Con i dati bucati il Ragioniere risultava a 19.061: **quel +90% era in gran parte un
  errore dei dati**. All'utente era stato dato il +90% (con l'avvertenza che non
  convinceva) e poi la correzione, nella stessa chat.
- Anche a 12.070 il guadagno del Ragioniere viene quasi quattro volte più dal prezzo che dal
  funding. La biblioteca (E08, «Cosa la smentirebbe») dice che in quel caso è una scommessa
  di direzione travestita, e che un netto negativo dopo il primo anno la boccia: l'anno 2 è
  a −3,7%. L'esame E08 completo (3 anni) non è stato fatto.
- È un solo passato, e alcune scelte (lo stop al 12% del Falco) sono state fatte guardando
  questi dati.

**Lo studio degli eventi** (dal 2023, BTC, ETH, SOL; 27 confronti):
- dopo le decisioni della Fed (31 casi): leggermente peggio del normale, non distinguibile
  dal caso;
- dopo un crollo di BTC del 5% o più (32 casi): nessun rimbalzo affidabile;
- dopo un rialzo di BTC del 5% o più (46 casi): BTC a 7 giorni +2,9% contro +0,85%, p = 0,03.
  Su 27 confronti uno così capita anche per fortuna.

## Cosa NON ha funzionato (e perché)

- **L'endpoint del funding di BingX sulla storia vecchia:** la stessa richiesta dà 0 righe e
  poi 90, senza errore. Gli ultimi 6-7 mesi arrivano completi (8 prove su 8). Per questo
  alcune monete restano fuori dai conti sul passato anche dopo 6 tentativi.
- **Spostare il motore fuori da Claude** (l'idea proposta all'utente come «punto 1») è meno
  utile di quanto detto in chat. Motivi verificati nel codice:
  - i portafogli a regole si rifanno ogni giorno dall'inizio, quindi un giorno saltato non
    perde niente;
  - `mark` controlla stop e target su tutte le candele orarie dall'ultimo controllo;
  - il database della pagina si scrive solo con `ArtifactData`, cioè da una sessione di
    Claude.

  In un giorno saltato si perdono solo le decisioni degli agenti di quel giorno e la
  **fotografia dell'open interest**, che BingX non conserva.
- **Le inquadrature di spalle nel campus:** non toccate. Il codice cerca già il viso di chi
  parla; serve un caso preciso dall'utente.

## Cosa non è ancora stato provato

- **La prima corsa vera della ricerca della domenica** (29/11 alle 16:23) e quanto consuma.
- **L'effetto a schermo** del bancone del caffè e della faccia del Guardiano: cambiati nel
  codice, non guardati.
- **L'esame E08 completo** del Ragioniere (3 anni, ribilanciamento nei 7 giorni, costi doppi).
- **Un salvataggio giornaliero dell'open interest fuori da Claude** (per esempio sul PC
  dell'ufficio), per non perdere il dato nei giorni saltati.
- **I conti sul passato con più monete riparate:** rilanciare `storia.py` in un altro
  momento può recuperare XRP, ATOM, AAVE e FTM.

## Stato dei file

| File | Stato | Note |
|------|-------|------|
| crypto-school/pagina/scuola-cripto.html | finito | pubblicato v6; sezione «La ricerca», riga di stato corretta |
| crypto-school/pagina/campus/{life,people,world}.js | finito | pubblicati con la v5 |
| crypto-school/RICERCA.md | finito | la procedura della ricerca; mai girata dal vero |
| crypto-school/PROCEDURA.md | finito | il lunedì legge `ricerca/<ieri>`; otto attività a fine trimestre |
| crypto-school/data.py, test_data.py | finito | funding riparato o rifiutato, 7 prove |
| crypto-school/eventi.py, eventi.json, test_eventi.py | finito | 6 prove |
| crypto-school/storia.py | finito | senza prove proprie: usa le funzioni di `rules.py` |
| crypto-school/prove-pagina/ | finito | tre prove della pagina |
| trading-desk/, fx-school/, memecoin-desk/, argostudio/ | invariati | |

## Decisioni prese

- **Tutto resta in paper trading.** Nessun `DESK_MODE=live`, nessuna chiave, limiti di
  rischio invariati.
- **Una ricerca può cambiare il quaderno di un agente e proporre un'ipotesi, mai le regole o
  i limiti.** Il coraggio sta nelle idee, non nella dimensione degli ordini.
- **Le emozioni degli agenti sono la voce del personaggio** (`stato_d_animo`), come i
  pensieri del campus. All'utente è stato detto che non si può garantire che provino
  qualcosa.
- **Dati incompleti fermano i conti:** se un buco nel funding resta, il motore dà errore
  invece di calcolare. La riunione si fa lo stesso, senza ordini, come già previsto dalla
  procedura.
- **Niente lavori pesanti o multi-agente nei giorni di scuola** senza dire prima all'utente
  quanto pesano (regola della sessione precedente, rispettata qui: tutto fatto da una sola
  sessione).
- **OpenClaw:** l'utente ha chiesto se può servire. Risposta data: per ora no (vedi sotto).

## Problemi aperti e domande per l'utente

- **Quanto pesa la ricerca della domenica:** stima non misurata, tra una e due riunioni del
  mattino. Limiti: al massimo 26 ricerche sul web e 14 pagine lette. Se fa saltare il
  controllo della sera delle 20:41, abbassare i limiti o far ricercare tre agenti a turno.
- **Il Ragioniere:** va fatto l'esame E08 prima di fidarsi del suo portafoglio a regole.
- **Monetizzare con il prodotto** (la scuola come formazione o intrattenimento): proposto
  all'utente, nessuna decisione. Vendere segnali o consigli è un'attività regolata: serve un
  parere legale.
- **Crediti Higgsfield:** 0,98; rinnovo atteso intorno al 6/12, da confermare nell'app.
- **Non archiviare la chat vecchia** (session_01WVrQuMeJss5jp4rb7ivoVt): il promemoria del
  5/1/2027 è legato a quella.

## Prossimo passo esatto

Domenica 29/11, dopo le 17:30 italiane, controllare in modo leggero (solo letture con
`ArtifactData` e `list_triggers`) che siano riuscite: la riunione delle 06:47, la palestra
delle 11:13, il controllo della sera del 28/11 (`classe/sera`), il diario forex e la prima
ricerca (`ricerca/2026-11-29`). Guardare quanto è durata la corsa della ricerca e dirlo
all'utente in poche righe.

## Note su ambiente e configurazione

- **Modalità:** `DESK_MODE=paper`, mai `live` senza una richiesta esplicita in chat. I
  segreti stanno solo in `.env` (`ANTHROPIC_API_KEY`, `exchange_api_key`,
  `exchange_api_secret`: solo i nomi).
- **Le prove:**
  - `cd trading-desk && uv run --frozen pytest ../crypto-school/ -q` (56);
  - `cd trading-desk && uv run --frozen pytest` (317, non rilanciate oggi).
- **Gli strumenti nuovi,** da lanciare da `trading-desk/`:
  - `uv run --frozen python ../crypto-school/storia.py 2024-11-28 out.json`
  - `uv run --frozen python ../crypto-school/eventi.py ../crypto-school/eventi.json 2023-01-01 BTC ETH SOL`
- **Le attività programmate** (ora italiana): riunione 06:47; forex 08:23; sentinella 09:13 e
  21:13; palestra la domenica 11:13; recuperi 13:17 e 18:17; recupero forex 15:41; ricerca
  la domenica 16:23; sera 20:41; revisione il 2 del mese 10:23; promemoria fusione il 14/12.
- **Per ripubblicare la pagina:** `url`, la pagina, e nella mappa `files` solo i file
  cambiati; le capacità restano
  `{"db":{"rules":[{"path":"","read":"view","write":"owner"}]},"sample":{}}`.
- **Rete del container:** `cdnjs.cloudflare.com` e `jsdelivr` sono bloccati (le prove della
  pagina usano le librerie di `npm`); `open-api.bingx.com` e `www.federalreserve.gov`
  rispondono.
