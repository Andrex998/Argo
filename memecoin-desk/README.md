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
  `corto_tardi`). Le descrizioni di FILTRO v2 e CORTO tardi riportano il cambio.
- **18/11/2026, sera.** Su richiesta del proprietario, due **copie al 10% del wallet**:
  `filtro_10` (FILTRO v2 · size 10%) e `filtro_piccoli_10` (FILTRO v2 piccoli · size
  10%).
  - Hanno gli stessi parametri delle originali, tranne `params.sizing.pct_of_equity = 10`.
  - Ognuna parte con 1.000 $ finti: il totale della pagina live sale di 2.000 $, e non è
    un guadagno.
  - Comprano circa 100 $ alla volta invece di circa 50 $, quindi pagano un po' più di
    impatto nei costi simulati.
  - Sono bracci di misura, come CORTO largo: mostrano l'effetto di una size più grande.
    Il verdetto resta quello delle originali al 5,5%.
  - Per fermarle, come le altre strategie ferme, metti `params.sizing.pct_of_equity` a
    0: non comprano più e le posizioni aperte escono con le regole di sempre.
- **18/11/2026, sera, dopo le copie.** Su richiesta del proprietario, un **tetto alle
  posizioni aperte** sui wallet che non l'avevano. FILTRO v2 era arrivato a 36 posizioni
  aperte con la cassa a zero.
  - Il tetto tiene investita al massimo circa metà del wallet: 9 posizioni per FILTRO v2
    e FILTRO v2 piccoli (5,5% l'una), 5 per le due copie al 10%.
  - CORTO tardi aveva già il suo: 10 posizioni, e acquisti fermi sotto gli 850 $.
  - Usa `params.guard.max_open`, che `desk_commit_tick` già rispettava. Sopra il tetto
    il motore non compra e lo scrive in `desk_decisions` (`MAX_OPEN`). Le posizioni già
    aperte non si toccano: escono con le regole di sempre, e gli acquisti riprendono
    quando scendono sotto il tetto.
  - Per tornare indietro: `update desk_strategies set params = params - 'guard' where id
    in ('filtro', 'filtro_piccoli', 'filtro_10', 'filtro_piccoli_10');`
- **24/11/2026, mattina.** Su richiesta del proprietario, **fermati i quattro FILTRO**. Da
  1.000 $ finti l'uno erano scesi a:
  - FILTRO v2: 157 $;
  - FILTRO v2 piccoli: 158 $;
  - FILTRO v2 · size 10%: 697 $;
  - FILTRO v2 piccoli · size 10%: 116 $.

  Come le altre strategie ferme, hanno `params.sizing.pct_of_equity = 0` e
  `params.guard.halted = true`, con il motivo. Non comprano più. Le 27 posizioni aperte
  (circa 470 $) escono con le regole di sempre. Resta attivo solo il registro ombra, che
  misura il tasso di base del mercato.
  - Per tornare indietro, nel `params` di ognuna togli `halted` e `reason` dal `guard` e
    rimetti la misura di prima: 5,5 per `filtro` e `filtro_piccoli`, 10 per `filtro_10` e
    `filtro_piccoli_10`. Per esempio:
    `update desk_strategies set params = jsonb_set(params #- '{guard,halted}' #- '{guard,reason}', '{sizing,pct_of_equity}', '5.5') where id in ('filtro', 'filtro_piccoli');`

## Cartelle

- `edge-function/v1`: la funzione prima del 18/11.
- `edge-function/v2`: quella in uso, con il test che la confronta con la v1.
- `sql/prima-del-18-11-2026` e `sql/18-11-2026`: le funzioni SQL prima e dopo.
- `strategie/`: i parametri prima del cambio e lo script che li ripristina.
- `ROLLBACK.md`: come tornare indietro, passo per passo.
