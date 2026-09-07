# ARGO Drive — Albania

Mappa di guida in tempo reale per un viaggio in auto in Albania: **dove sei**,
**a che velocità vai**, **qual è il limite della strada che stai percorrendo**,
**quali aree sono vietate alle auto** e **cosa hai davanti** (autovelox, dossi,
passaggi a livello, fondo dissestato, divieti di accesso).

App statica: HTML + CSS + JavaScript a moduli. Nessun build step, nessun account,
nessun server. Leaflet è vendorizzato in `vendor/`, così l'app si apre anche
quando la rete non c'è.

---

## Cosa fa davvero "in tempo reale"

| In tempo reale, sì | Da dove arriva |
|---|---|
| Posizione, rotta e velocità | GPS del telefono (`watchPosition`) |
| Limite della strada che stai percorrendo | `maxspeed` OpenStreetMap + map matching sulla geometria stradale |
| Allarme superamento del limite (voce + schermo rosso) | confronto continuo velocità/limite con tolleranza regolabile |
| Aree pedonali, strade vietate ai veicoli, LEZ | tag OSM `highway=pedestrian`, `motor_vehicle=no`, `boundary=low_emission_zone` |
| Autovelox, dossi, passaggi a livello, sbarre | nodi OSM entro il raggio dati |
| Strade sterrate o dissestate | tag OSM `surface`, `smoothness`, `tracktype` |
| Le tue segnalazioni e quelle importate dal gruppo | file JSON locale |

**Quello che questa app non può fare, e nessuna app onesta senza backend può fare:**
non esiste un feed pubblico e gratuito di traffico, incidenti e pattuglie in tempo
reale per l'Albania. Waze e Google hanno reti di utenti proprietarie e chiuse.
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

## Metterla in strada

Serve **HTTPS**: senza un contesto sicuro i browser non danno la posizione.
Da un IP di rete locale (`http://192.168…`) il GPS resta spento.

**GitHub Pages** — la via più corta:

1. su GitHub → *Settings* → *Pages*
2. *Source*: Deploy from a branch → branch `claude/real-time-map-ztl-speed-limits-ck84k7`, cartella `/ (root)`
3. apri `https://<utente>.github.io/<repo>/argo-drive/` dal telefono
4. Safari: *Condividi* → *Aggiungi a Home*; Chrome: *⋮* → *Installa app*

**Vercel**: `vercel --cwd argo-drive` (sito statico, nessuna configurazione).

**In locale, per svilupparci**: `npm start` (serve la cartella su
`http://localhost:4173`, che il browser considera sicuro).

Installandola dalla schermata Home parte a schermo intero e continua a funzionare
in galleria o senza campo: il service worker tiene in cache il guscio dell'app e
le tile già viste, e i dati stradali della zona restano in `localStorage` per una
settimana.

---

## In auto

1. Telefono sul supporto, **prima** di partire. Poi non lo tocchi più.
2. Tocca **Avvia**: l'app chiede la posizione, sblocca l'audio e tiene acceso lo schermo.
3. Guarda la strada. Gli avvisi arrivano a voce, in italiano, ~10 secondi prima
   dell'ostacolo e solo se è **davanti a te** (cono di ±55° sulla tua rotta).

Come leggere lo schermo in mezzo secondo:

- **Numero grande a sinistra** — la tua velocità. Diventa rosso e pulsa se superi il limite.
- **Disco bianco a destra** — il limite. Bordo **pieno** = valore letto da OSM.
  Bordo **tratteggiato** = valore *presunto* dal tipo di strada e dalle regole
  albanesi (40 in città, 80 fuori, 90 sulle interurbane principali, 110 in autostrada).
  Trattino = strada non agganciata.
- **Riga sotto** — nome della strada agganciata e provenienza del limite. La strada
  agganciata è anche evidenziata in blu sulla mappa: se il blu è sulla parallela,
  il limite mostrato non è il tuo.
- **Rosso sulla mappa** — vietato alle auto. **Ambra tratteggiata** — fondo
  dissestato o strada di montagna. **Cerchi tratteggiati** — punti curati, indicativi.
- **Pill in alto** — precisione GPS e stato dei dati (`OSM` / `in cache` / `non disponibili`).

Pulsanti: **Segnala** (o tieni premuto un punto sulla mappa per segnalare lì),
**Livelli** (cosa vedere, tema mappa, tolleranza, raggio dati, unità),
**Centra** (torna a inseguire la tua posizione: si disattiva da solo se trascini la mappa),
**Voce** (silenzia tutto).

---

## Impostazioni che contano

- **Tolleranza** `0 / +5 / +10 km/h` — quanto sopra il limite prima che l'app protesti.
- **Raggio dati** `600 m / 900 m / 1,5 km` — in città 600–900 m bastano e la
  richiesta è più leggera; in extraurbano metti 1,5 km, perché a 90 km/h consumi
  un chilometro in 40 secondi. Le query vengono già centrate ~15 secondi *davanti*
  a te lungo la rotta, non sulla tua posizione.
- **Tema mappa** — scura (default, la meno stancante di notte), chiara, satellite.
- **Schermo sempre acceso** — Wake Lock, dove il browser lo supporta.

---

## Da dove vengono i dati

[OpenStreetMap](https://www.openstreetmap.org/copyright) via [Overpass API](https://overpass-api.de/),
interrogata intorno a te mentre guidi (tre mirror in rotazione, al massimo una
richiesta ogni 25 secondi, con backoff se rispondono male). Tile mappa: CARTO,
OpenStreetMap o Esri a seconda del tema scelto.

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
├── index.html              guscio: HUD, dock, pannelli, gate iniziale
├── styles.css              palette ARGO (void/obsidian/voltage) + semantica di sicurezza
├── sw.js                   service worker: guscio in precache, tile in cache runtime
├── manifest.webmanifest    installabile come app
└── js/
    ├── app.js              controller: GPS → dati → allerte → schermo, tick a 1 Hz
    ├── geo.js              haversine, rotte, proiezione locale, punto→polilinea, punto-in-poligono
    ├── osm.js              query Overpass, modello compatto, cache LRU, map matching
    ├── rules-albania.js    limiti di default, parsing maxspeed, verdetti di accesso, punti curati
    ├── alerts.js           prossimità, eccesso di velocità, voce italiana e toni
    ├── reports.js          segnalazioni locali con scadenza, export/import JSON
    ├── map.js              livelli Leaflet, marker, evidenziazione della strada agganciata
    └── ui.js               DOM, impostazioni persistenti, pannelli
```

Due cicli separati apposta: ogni fix GPS aggiorna posizione e velocità (il GPS
a volte manda cinque fix al secondo, a volte uno ogni dieci), mentre un tick a
1 Hz rifà il map matching e rivaluta le allerte.

Il colore segue il brand ARGO — void, obsidian, voltage `#3B8EFF` — con una
deroga dichiarata: rosso e ambra esistono solo come verdetti di sicurezza
(divieto, pericolo, eccesso di velocità), mai come decorazione.

---

## Test

```bash
npm install
CHROMIUM_PATH=/percorso/a/chromium npm test    # CHROMIUM_PATH è opzionale
```

Due suite Playwright con GPS simulato e Overpass finto:

- `tests/drive.test.mjs` — tragitto a Tirana a 75 km/h su strada con limite 40:
  verifica tachimetro, disco del limite, rotta ricavata dagli spostamenti,
  allerte di prossimità (autovelox, dosso, passaggio a livello, area pedonale),
  frasi pronunciate, numero di richieste Overpass e stato "segnale GPS perso".
- `tests/offline.test.mjs` — persistenza impostazioni, segnalazione con pressione
  prolungata, export, fallback sulla cache con Overpass irraggiungibile,
  apertura dell'app completamente offline.

---

## Limiti noti

- Il map matching è geometrico: su svincoli sovrapposti o strade parallele a meno
  di 15 metri può agganciare quella sbagliata. Per questo la strada agganciata è
  evidenziata: se non è la tua, il limite non è il tuo.
- Niente calcolo di percorso: è un cruscotto, non un navigatore. Usalo accanto a
  Google Maps o Organic Maps se ti serve la rotta.
- Gli autovelox mappati in OSM sono quelli fissi e noti: non aspettarti i mobili.
- I limiti presunti sono regole generali per automobili: i neopatentati hanno
  soglie più basse e la segnaletica locale prevale sempre.
- Le voci curate sono cerchi disegnati a mano su punti noti, non confini legali.

## Avvertenza

Strumento di supporto alla guida, non un'autorità. Non solleva da nessun obbligo
di legge e non garantisce l'esattezza dei dati. **Guarda la strada, non lo schermo.**
Emergenze in Albania: **112**.
