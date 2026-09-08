# ARGO Drive — Albania

Navigatore per un viaggio in auto in Albania: **dove vuoi andare** (ricerca,
percorso, indicazioni vocali svolta per svolta, orario di arrivo, ricalcolo se
sbagli strada) e **cosa hai intorno mentre guidi** (limite della strada che stai
percorrendo, aree vietate alle auto, autovelox, dossi, passaggi a livello, fondo
dissestato).

App statica: HTML + CSS + JavaScript a moduli. Nessun build step, nessun account,
nessun server. La mappa gira su **MapLibre GL** con tile vettoriali e uno stile
scritto su misura: ruota con la marcia, si inclina, alza gli edifici in volume.
La libreria è vendorizzata in `vendor/`, così l'app si apre anche senza rete.

---

## Cosa fa davvero "in tempo reale"

| In tempo reale, sì | Da dove arriva |
|---|---|
| Posizione, rotta e velocità | GPS del telefono (`watchPosition`) |
| Ricerca di luoghi e indirizzi | Photon (OpenStreetMap), Nominatim come riserva |
| Percorso, indicazioni e orario di arrivo | OSRM pubblico (profilo auto) |
| Ricalcolo quando esci dal percorso | confronto continuo posizione/tracciato |
| Limite della strada che stai percorrendo | `maxspeed` OpenStreetMap + map matching sulla geometria stradale |
| Allarme superamento del limite (voce + schermo rosso) | confronto continuo velocità/limite con tolleranza regolabile |
| Aree pedonali, strade vietate ai veicoli, LEZ | tag OSM `highway=pedestrian`, `motor_vehicle=no`, `boundary=low_emission_zone` |
| Autovelox, dossi, passaggi a livello, sbarre | nodi OSM entro il raggio dati |
| Strade sterrate o dissestate | tag OSM `surface`, `smoothness`, `tracktype` |
| Le tue segnalazioni e quelle importate dal gruppo | file JSON locale |

La mappa sotto è vettoriale (OpenFreeMap, schema OpenMapTiles) con uno stile
disegnato per la guida: gerarchia stradale leggibile in corsa, palette giorno e
notte che si alternano da sole, edifici in 3D quando la camera si inclina,
cielo e orizzonte nella vista in marcia.

**Quello che questa app non può fare, e nessuna app onesta senza backend può fare:**
non esiste un feed pubblico e gratuito di traffico, incidenti e pattuglie in tempo
reale per l'Albania. Gli orari di arrivo sono quindi calcolati sulla velocità
libera delle strade, corretti con l'andatura che stai davvero tenendo: **non
sanno nulla della coda che hai davanti**. Waze e Google hanno reti di utenti proprietarie e chiuse.
Al posto di fingere, qui trovi le **segnalazioni manuali**: le crei con un tocco,
restano sul telefono, e le esporti in un file JSON che chi viaggia con te può
importare. Vera collaborazione, senza server e senza raccontarti una favola.

**Sulle ZTL:** in Albania non esiste la ZTL italiana con telecamere e varchi.
I divieti reali sono aree pedonali (Sheshi Skënderbej, Rruga Murat Toptani,
il Pazari i Ri a Tirana; i centri storici di Berat, Gjirokastër e Krujë),
sensi unici, e chiusure temporanee per eventi. L'app li mostra in rosso quando
sono mappati in OSM, e in cerchio tratteggiato quando sono voci curate a mano
(etichettate *indicativo*: verifica sempre la segnaletica).

---

## Metterla in strada, adesso

L'app ha bisogno di **HTTPS**: senza contesto sicuro nessun browser dà la
posizione, e da un file locale o da un IP di rete (`http://192.168…`) il GPS
resta spento. Serve quindi un indirizzo pubblico: si ottiene con una
impostazione sola, e il repository è già pronto per riceverla.

**Dal telefono, un minuto** (via più corta, nessuna Action di mezzo):

1. Repository su GitHub → **Settings → Pages**
2. *Source*: **Deploy from a branch**
3. *Branch*: `claude/real-time-map-ztl-speed-limits-ck84k7`, cartella **`/ (root)`** → **Save**
4. Aspetta un minuto e apri
   **https://andrex998.github.io/Argo/argo-drive/**
5. **Installala**: su iPhone, Safari → *Condividi* → *Aggiungi a Home*; su
   Android, Chrome → *⋮* → *Installa app*. Da lì parte a schermo intero, con la
   sua icona, e continua a funzionare in galleria o senza campo.

*Via alternativa, con pubblicazione automatica a ogni push:* in **Settings →
Pages** scegli *Source: **GitHub Actions***, poi in **Actions** premi *Re-run
jobs* sull'ultima esecuzione di *Pubblica ARGO Drive*. L'indirizzo diventa
`https://andrex998.github.io/Argo/` (senza `/argo-drive/`). Attenzione: se il
branch da pubblicare non è quello predefinito del repository, va anche
autorizzato in **Settings → Environments → github-pages → Deployment branches**.

> **Vercel**, se preferisci: nuovo progetto sullo stesso repository, *Root
> Directory* `argo-drive`, *Framework Preset* **Other**. La configurazione degli
> header è già in `argo-drive/vercel.json`. Da riga di comando:
> `vercel --cwd argo-drive`.
>
> **Netlify**: trascina la cartella `argo-drive` su
> [app.netlify.com/drop](https://app.netlify.com/drop).

**Per svilupparci sopra**: `npm start` serve la cartella su
`http://localhost:4173`, che il browser considera sicuro.

Al primo avvio tocca **Avvia**: l'app chiede la posizione, sblocca l'audio degli
avvisi e tiene acceso lo schermo. Concedi il permesso di posizione **"Mentre usi
l'app"** e, su iPhone, tieni Safari in primo piano mentre guidi: in background
iOS sospende il GPS delle pagine web.

## Navigare

1. Tocca **Dove vuoi andare?** in alto.
2. Scrivi un luogo o un indirizzo, oppure usa le pastiglie: benzina, parcheggio,
   mangiare, dormire, farmacia, ospedale, bancomat, officina, spesa. Le categorie
   cercano entro 5 km e ordinano per distanza reale.
3. Puoi anche **tenere premuto un punto sulla mappa**: l'app scopre che cos'è e
   lo propone come destinazione.
4. Scegli fra i percorsi proposti (durata e distanza sono sulle pastiglie), poi
   **Avvia navigazione**.
5. In marcia: scheda blu in alto con la manovra e la distanza, "poi" con la
   manovra successiva, barra in basso con orario di arrivo, tempo e chilometri
   che mancano, e **Esci** per interrompere.

Gli annunci vocali arrivano a 500, 200 e 100 metri dalla svolta in città, e a
2 km, 1 km, 500 e 200 metri fuori città — perché a 90 all'ora cento metri sono
quattro secondi. Se esci dal percorso l'app se ne accorge dopo quattro secondi
(non al primo scarto del GPS), lo dice e ricalcola.

**Salva luogo** mette la destinazione fra i preferiti, che compaiono in cima alla
ricerca la volta dopo. **Condividi arrivo** manda a chi ti aspetta un messaggio
con l'orario previsto e il punto sulla mappa.

## In auto

1. Telefono sul supporto, **prima** di partire. Poi non lo tocchi più.
2. Tocca **Avvia**: l'app chiede la posizione, sblocca l'audio e tiene acceso lo schermo.
3. Guarda la strada. Gli avvisi arrivano a voce, in italiano, ~10 secondi prima
   dell'ostacolo e solo se è **davanti a te** (cono di ±55° sulla tua rotta).

Come leggere lo schermo in mezzo secondo:

- **Cerchio a sinistra nella scheda in basso** — la tua velocità. Diventa rossa e
  pulsa se superi il limite.
- **Disco a destra** — il limite. Bordo **pieno** = valore letto da OSM. Bordo
  **tratteggiato** = valore *presunto* dal tipo di strada e dalle regole albanesi
  (40 in città, 80 fuori, 90 sulle interurbane principali, 110 in autostrada).
  Trattino = strada non agganciata.
- **Al centro** — nome della strada agganciata e provenienza del limite. La strada
  agganciata è evidenziata in blu sulla mappa: se il blu è sulla parallela, il
  limite mostrato non è il tuo.
- **Schede in alto** — allerte, con distanza. Al massimo due: la terza, in marcia,
  non la legge nessuno.
- **Rosso sulla mappa** — vietato alle auto. **Ambra tratteggiata** — fondo
  dissestato o strada di montagna. **Cerchi tratteggiati** — punti curati, indicativi.
- **Chip in alto** — precisione GPS e stato dei dati (`OSM` / `in cache` / `non disponibili`).

Comandi, tutti a destra sotto il pollice: **bussola** (compare quando la mappa è
ruotata, riporta il nord in alto), **3D**, **voce**, **centra**.

L'inseguimento si comporta come su un navigatore: qualunque gesto sulla mappa
(trascinamento, rotazione a due dita, zoom) lo sospende, e **in marcia riprende da
solo dopo 12 secondi** che non tocchi più nulla. Da fermo resta dove l'hai lasciato:
se stai guardando la mappa parcheggiato, nessuno te la sposta.

Il pannello in basso si trascina come in qualunque app di mappe: **scheda di guida**
→ **metà** (elenco "vicino a te", segnalazioni, livelli, info) → **tutto**. Sopra i
12 km/h torna da solo alla scheda di guida: in marcia lo schermo serve alla mappa.
Per segnalare un punto diverso da dove sei, **tieni premuto** sulla mappa.

---

## Impostazioni che contano

- **Tolleranza** `0 / +5 / +10 km/h` — quanto sopra il limite prima che l'app protesti.
- **Raggio dati** `600 m / 900 m / 1,5 km` — in città 600–900 m bastano e la
  richiesta è più leggera; in extraurbano metti 1,5 km, perché a 90 km/h consumi
  un chilometro in 40 secondi. Le query vengono già centrate ~15 secondi *davanti*
  a te lungo la rotta, non sulla tua posizione.
- **Mappa** — `Auto` segue l'ora (chiara di giorno, scura dopo le 19), oppure
  giorno/notte fissi e satellite.
- **Orientamento** — `Verso di marcia` (la mappa ruota con te, camera inclinata,
  come un navigatore) oppure `Nord in alto`.
- **Edifici in 3D** — volumi sopra i 15 di zoom; spegnili se il telefono soffre.
- **Vibrazione** — un colpo sugli avvisi, due sui divieti: si sente anche con la
  radio alta.
- **Schermo sempre acceso** — Wake Lock, dove il browser lo supporta.

---

## Da dove vengono i dati

**Limiti, divieti, aree, autovelox e dossi**: [OpenStreetMap](https://www.openstreetmap.org/copyright)
via [Overpass API](https://overpass-api.de/), interrogata intorno a te mentre guidi
(tre mirror in rotazione, al massimo una richiesta ogni 25 secondi, con backoff se
rispondono male).

**Mappa disegnata**: tile vettoriali [OpenFreeMap](https://openfreemap.org/)
(schema OpenMapTiles), stile in `js/style.js`. Se il servizio vettoriale non
risponde, l'app passa da sola a tile raster (OpenStreetMap di giorno, CARTO di
notte); il satellite è Esri. Un dettaglio che costa caro se ignorato: **se i
caratteri delle etichette non si scaricano, MapLibre non fallisce solo i testi,
fallisce il tile intero e la mappa resta bianca**. Per questo l'app sonda prima
l'endpoint dei caratteri e, se non risponde, disegna la mappa senza nomi invece
di non disegnarla affatto.

I dati OSM sono collaborativi e **possono essere incompleti o superati**: in
Albania la copertura dei `maxspeed` è discreta sulle strade principali e scarsa
nelle vie minori — da qui il disco tratteggiato per i limiti presunti.

**Privacy**: non c'è un server ARGO. La posizione resta nel telefono; l'unica
cosa che esce sono le coordinate arrotondate a 5 decimali inviate a Overpass per
scaricare la mappa della zona. Segnalazioni e impostazioni stanno in `localStorage`.

---

## Architettura

```
argo-drive/
├── index.html              guscio: scheda di guida, pannello, FAB, avvio
├── styles.css              superfici, temi chiaro/scuro, semantica di sicurezza
├── sw.js                   service worker: guscio in precache, tile in cache runtime
├── manifest.webmanifest    installabile come app
└── js/
    ├── app.js              controller: GPS → dati → allerte → schermo, tick a 1 Hz
    ├── geo.js              haversine, rotte, proiezione locale, punto→polilinea, punto-in-poligono
    ├── osm.js              query Overpass, modello compatto, cache LRU, map matching
    ├── rules-albania.js    limiti di default, parsing maxspeed, verdetti di accesso, punti curati
    ├── alerts.js           prossimità, eccesso di velocità, voce italiana, elenco "vicino a te"
    ├── reports.js          segnalazioni locali con scadenza, export/import JSON
    ├── router.js           percorso via OSRM e manovre tradotte in italiano
    ├── search.js           ricerca luoghi, categorie, preferiti e destinazioni recenti
    ├── guidance.js         guida svolta per svolta: aggancio, annunci, ricalcolo, arrivo
    ├── style.js            stile mappa: palette giorno/notte, gerarchia stradale, 3D, cielo
    ├── map.js              MapLibre: camera course-up, puck, overlay, fallback raster
    └── ui.js               DOM, pannello trascinabile, impostazioni persistenti
```

Due cicli separati apposta: ogni fix GPS aggiorna posizione, velocità e camera
(il GPS a volte manda cinque fix al secondo, a volte uno ogni dieci), mentre un
tick a 1 Hz rifà il map matching, rivaluta le allerte e ridisegna la scheda.

Tre cadute morbide, tutte silenziose per chi guida: tile vettoriali → raster,
etichette → mappa muta, Overpass → cache locale. Nessuna di queste lascia lo
schermo vuoto.

Le segnalazioni importate da un file arrivano da fuori, quindi vengono ripulite
prima di entrare: tipo verificato, coordinate nei limiti terrestri, nota tagliata,
data plausibile.

Il colore resta quello di ARGO — un solo accento blu su superfici neutre — con
una deroga dichiarata: rosso e ambra esistono solo come verdetti di sicurezza
(divieto, pericolo, eccesso di velocità), mai come decorazione.

---

## Test

```bash
npm install
CHROMIUM_PATH=/percorso/a/chromium npm test    # CHROMIUM_PATH è opzionale
```

Tre suite Playwright con GPS simulato, Overpass finto e **tile vettoriali
sintetiche generate in locale** (`tests/fixtures/tileserver.mjs`), così lo stile
viene verificato davvero e non solo compilato. Sono **asserzioni**, non stampe:
`npm test` esce con errore se qualcosa si rompe (136 controlli).

- `tests/drive.test.mjs` — tragitto a Tirana a 75 km/h su strada con limite 40:
  verifica tachimetro, disco del limite, rotta ricavata dagli spostamenti,
  allerte di prossimità (autovelox, dosso, passaggio a livello, area pedonale),
  frasi pronunciate, numero di richieste Overpass e stato "segnale GPS perso".
- `tests/offline.test.mjs` — persistenza impostazioni, segnalazione con pressione
  prolungata, export, fallback sulla cache con Overpass irraggiungibile,
  apertura dell'app completamente offline.
- `tests/deploy.test.mjs` — l'app servita da un sottopercorso come su GitHub
  Pages: nessun file mancante nel precache o fra le icone, service worker con
  l'ambito giusto, avvio senza tile e riapertura senza rete.
- `tests/guidance.test.mjs` — puro Node, senza browser: percorso sintetico
  percorso da un veicolo simulato, con aggancio al tracciato, annunci alle soglie
  giuste una volta sola, riconoscimento del fuori percorso e arrivo.
- `tests/navigate.test.mjs` — il giro completo: ricerca, anteprima con percorsi
  alternativi, avvio, scheda manovra, barra dell'arrivo, avanzamento sulla mappa,
  deviazione con ricalcolo, arrivo, ricerca per categoria.
- `tests/design.test.mjs` — stile vettoriale valido e caricato, camera che ruota
  con la rotta e si inclina, cambio tema giorno/notte con gli overlay e i livelli
  spenti che sopravvivono al ricaricamento dello stile, 3D on/off, bussola,
  pannello trascinabile, pressione prolungata **mentre la camera insegue**,
  satellite che resiste al guardiano del vettoriale e al riavvio, gesti che
  sospendono l'inseguimento e ripresa automatica in marcia.
  Salva gli screenshot in `/tmp/design-*.png`.

---

## Limiti noti

- Il map matching è geometrico: su svincoli sovrapposti o strade parallele a meno
  di 15 metri può agganciare quella sbagliata. Per questo la strada agganciata è
  evidenziata: se non è la tua, il limite non è il tuo.
- La mappa vettoriale vuole WebGL: su telefoni molto vecchi conviene spegnere il
  3D. Senza WebGL l'app non parte.
- Nessun dato di traffico: i tempi non tengono conto delle code, e il percorso
  "più rapido" è il più rapido a strade libere.
- Il calcolo del percorso passa da istanze pubbliche di OSRM: sono gratuite ma
  senza garanzie: se sono sature, l'app lo dice invece di restare in attesa.
- Nessuna indicazione di corsia né vista degli svincoli: quelle richiedono dati
  che OpenStreetMap non ha ovunque.
- Gli autovelox mappati in OSM sono quelli fissi e noti: non aspettarti i mobili.
- I limiti presunti sono regole generali per automobili: i neopatentati hanno
  soglie più basse e la segnaletica locale prevale sempre.
- Le voci curate sono cerchi disegnati a mano su punti noti, non confini legali.

## Avvertenza

Strumento di supporto alla guida, non un'autorità. Non solleva da nessun obbligo
di legge e non garantisce l'esattezza dei dati. **Guarda la strada, non lo schermo.**
Emergenze in Albania: **112**.
