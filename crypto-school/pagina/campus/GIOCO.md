# Il livello "videogioco" del campus · `campus/gioco.js`

`Campus.gioco` aggiunge al campus l'aspetto di un videogioco, con le immagini fatte con
Higgsfield (`arte/`, vedi `arte/IMMAGINI.md`). Non cambia la vita degli agenti, i dati o
i portafogli: legge `Campus.data`, `derive`, `life` e `render`, e chiama solo
`Campus.ui.follow(key)` e `Campus.render.setCameraMode("regia")`.

## Che cosa fa

| Parte | Che cosa vede il proprietario |
| --- | --- |
| **Schermata del titolo** | All'apertura della pagina: la copertina che si muove piano, polvere dorata, raggi di sole, lo stemma, «Scuola Cripto», gli 8 personaggi in due file e il menu. Mostra anche il giorno di scuola, il tema, i giorni alla laurea e il fondo comune, presi dai dati veri. Il menu ha cinque voci: Entra nel campus, Modalità cinema, I personaggi, Il registro, Musica. Si usa con mouse, tocco o tastiera (frecce, Invio, Esc). |
| **I personaggi** | Una scheda per ognuno con figura intera, stemma della casa, motto e chi è (da `agenti/*.md`). Ci sono anche i numeri veri: cosa fa adesso e l'umore, i portafogli a giudizio e a regole, le posizioni, i voti del Preside, le previsioni e il Brier, la previsione aperta, l'ultima lezione. Il pulsante «Segui …» porta la telecamera su di lui. Si sfoglia con le frecce o con un trascinamento sul telefono. |
| **Modalità cinema** | Il campus a schermo intero con le bande nere. In alto a sinistra compare il nome della stanza inquadrata e l'ora di Roma. In basso scorrono i sottotitoli con il ritratto di chi parla, presi dal feed di `life`: riunioni, repliche, chiacchiere, pensieri, «Fateli parlare». La telecamera resta in regia. Esc o «Esci dal cinema» per uscire. Dove lo schermo intero non c'è (iPhone), la scena copre la finestra. |
| **Cartelli dei momenti** | Quando la scuola cambia modo (vita, notte, riunione, diretta, replica, allarme, palestra) compare un titolo centrale per 4 secondi, al massimo uno ogni 9. |
| **Stendardi delle case** | 8 stendardi di stoffa nel cortile, sui due lati lunghi, ognuno con lo stemma della sua casa. Si leggono da tutte e due le facce e si muovono al vento (più lentamente con la grafica bassa, fermi con «riduci il movimento»). |
| **Musica** | Spenta all'inizio. È una musica lenta (accordi la-, fa, do, sol e qualche campanella) fatta nel browser, senza file audio. |

## Come si collega alla pagina

```html
<script src="campus/ui.js"></script>
<script src="campus/gioco.js"></script>
<script>window.Campus && Campus.gioco && Campus.gioco.start();</script>
```

`start()` va chiamato prima di `Campus.boot`: mette la barra dei pulsanti sopra la scena
(Menu, I personaggi, Modalità cinema, Musica) e apre la schermata del titolo.
`start({ title: false })` la salta.

Nella pubblicazione, oltre a `campus/*.js`, vanno nella mappa `files` le immagini di
`arte/*.webp` con lo stesso percorso.

## Regole rispettate

- **Dominio:** classi `cp-g-`, un solo `<style id="cp-style-gioco">`, nessun nuovo token
  `:root`. Il testo dei dati entra solo con `textContent`, o con `U.esc` dove si usa
  `innerHTML`.
- **3D:** 8 stoffe e 32 piccoli pezzi (pali, basi, traverse, puntali), aggiunti nel gruppo
  `gioco:stendardi` e tolti se il 3D si perde. Le texture sono `CanvasTexture` sRGB.
- **Accessibilità:** dialoghi `aria-modal` con il fuoco intrappolato, pulsanti con
  `aria-pressed`, schede con `role="tab"`. Con «riduci il movimento» niente animazioni.
- **Onestà:** il piede della copertina dice che i soldi sono finti; i numeri vengono solo
  da `derive` e `life.mind`, e dove mancano la scheda lo dice.

## Prove

`cs/gioco-test/run.js` (nella cartella di lavoro della sessione) usa lo stesso ambiente
delle prove della pagina e controlla sei cose:
1. su computer: titolo, scheda, ingresso, cartello, 8 stendardi;
2. il cinema con i sottotitoli;
3. sul telefono in tema scuro: titolo, scheda, «Segui», cinema, nessuno scorrimento
   orizzontale;
4. con «riduci il movimento»;
5. la musica;
6. gli stendardi da vicino.
