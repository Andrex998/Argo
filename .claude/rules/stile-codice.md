# Stile del codice

Adattato dalle regole di stile di ECC (Everything Claude Code), versione leggera per Argo.

- Preferisci la soluzione più semplice che funziona. Niente astrazioni, opzioni o
  funzioni "per il futuro" finché non servono davvero.
- File piccoli e con un solo scopo: oltre le 800 righe valuta di dividerli.
  Funzioni brevi, con nomi che dicono cosa fanno.
- Numeri con un significato (soglie, percentuali, tempi) in costanti o nella
  configurazione, non sparsi nel codice.
- Gestisci sempre gli errori: niente `except: pass` o errori ignorati in silenzio.
  Nei messaggi all'utente usa parole chiare, nei log metti il dettaglio tecnico.
- Python: segui la configurazione `ruff` in `trading-desk/pyproject.toml`
  (righe da massimo 100 caratteri).
- Riusa quello che esiste già nel progetto prima di scrivere una funzione nuova.
