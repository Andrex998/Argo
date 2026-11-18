# Sistema memecoin (Supabase)

Il sistema memecoin in paper trading che gira nel cloud, nel progetto Supabase
`argo-desk`. Soldi finti su prezzi veri: nessun ordine reale.

## Come gira

- Ogni minuto pg_cron chiama la funzione edge `argo-desk` (cartella `edge-function/`):
  cerca token nuovi, li filtra, dà un punteggio e decide.
- Le funzioni SQL `desk_*` (cartella `sql/`) registrano acquisti e vendite. Le uscite
  rapide (stop e take profit) girano ogni 15 secondi.
- Ogni strategia ha un suo conto da 1.000 $ nella tabella `desk_strategies`. Il registro
  ombra (100.000 $ virtuali) compra un po' di tutto e serve solo da confronto.

## Cosa è cambiato il 18/11/2026

- **Conti corretti.** Un'uscita con un prezzo anomalo non paga più costi gonfiati e non
  conta come vincita. Un token sospetto chiuso per uscita a tempo vale zero.
- **Tre filtri nuovi**, solo per le strategie che li chiedono nei parametri. Vengono
  scartati i token:
  - con i 10 portafogli più grandi sotto il 15% del totale, perché sono spesso dati falsi;
  - con il 90% o più di acquisti nell'ultima ora, perché spesso non si possono rivendere;
  - con un punteggio sopra 85, perché nei dati i punteggi più alti perdevano di più.
- **Due strategie nuove**, con quei filtri:
  - FILTRO v2;
  - FILTRO v2 piccoli, per token con meno di 3 ore e sotto i 30.000 $ di capitalizzazione.
- **Strategie fermate:** piccoli, corto e corto_largo. Non comprano più; le loro posizioni
  aperte escono con le regole di sempre.

Lo storico non è stato riscritto: le correzioni valgono da quel momento in poi.

## Cambi successivi

- **18/11/2026, pomeriggio.** Su richiesta del proprietario, ogni acquisto dei wallet
  attivi (FILTRO v2, FILTRO v2 piccoli, CORTO tardi) passa dal 2% (CORTO tardi: 1%)
  al **5,5% del wallet**, circa 55 $ su un wallet da 1.000 $. La misura segue il wallet:
  cresce se il wallet cresce e cala se cala. Le strategie ferme restano a 0. Per tornare
  indietro, in `desk_strategies`, rimetti `params.sizing.pct_of_equity` a 2 (1 per
  `corto_tardi`).

## Cartelle

- `edge-function/v1`: la funzione prima del 18/11.
- `edge-function/v2`: quella in uso, con il test che la confronta con la v1.
- `sql/prima-del-18-11-2026` e `sql/18-11-2026`: le funzioni SQL prima e dopo.
- `strategie/`: i parametri prima del cambio e lo script che li ripristina.
- `ROLLBACK.md`: come tornare indietro, passo per passo.
