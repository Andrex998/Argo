# Test

Adattato dalle regole di testing di ECC (Everything Claude Code), versione leggera per Argo.

## Quando i test sono obbligatori

Prima di modificare la logica che decide o esegue un'operazione (`trading-desk/desk/`:
segnali, risk gate, dimensione delle posizioni, leva, stop-loss, backtest, live):

1. Scrivi o aggiorna un test che descrive il comportamento voluto.
2. Fai la modifica.
3. Lancia i test: `cd trading-desk && uv run pytest` (oppure `python -m pytest` se `uv` non c'è).
4. Non dichiarare il lavoro finito se un test fallisce: dillo all'utente con l'errore.

Per la grafica (`argostudio/`), i testi delle scuole e le pagine non serve un test per
ogni modifica: basta verificare che il progetto si avvii o compili.

## Come scrivere i test

- Nomi che descrivono il comportamento: `test_rifiuta_ordine_sopra_il_capitale`,
  non `test_order_2`.
- Struttura in tre parti: prepara i dati, esegui, controlla il risultato.
- Niente chiamate reali agli exchange o all'API Anthropic nei test: usa dati finti
  o i file di riferimento in `trading-desk/tests/`.
- Se un test fallisce, correggi il codice, non il test, a meno che sia il test a essere sbagliato:
  in quel caso spiega perché.
