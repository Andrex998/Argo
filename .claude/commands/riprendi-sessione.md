---
description: Legge l'ultimo file di sessione salvato con /salva-sessione e riparte da dove il lavoro si era fermato.
---

# Riprendi sessione

Adattato dal comando `resume-session` di ECC (Everything Claude Code).

## Uso

```text
/riprendi-sessione                  # l'ultimo file in .claude/sessioni/
/riprendi-sessione 2026-11-26       # i file di quella data
/riprendi-sessione risk-gate        # il file più recente che contiene quella parola nel nome
```

## Cosa fare

1. Cerca i file in `.claude/sessioni/`. Se la cartella è vuota o manca, controlla prima
   gli altri branch remoti recenti (`git fetch` del branch, poi `git ls-tree` di
   `.claude/sessioni/`), perché la sessione potrebbe essere stata salvata su un altro branch.
   Se non trovi niente, dillo all'utente e suggerisci `/salva-sessione` alla fine della prossima chat.
2. Scegli il file in base all'argomento (data o parola); senza argomento prendi quello
   con la data più recente nel nome.
3. Leggi tutto il file.
4. Controlla che il branch e l'ultimo commit indicati esistano ancora e segnala
   all'utente se nel frattempo sono arrivati commit nuovi.
5. Rispondi con un riassunto breve:
   - su cosa si stava lavorando;
   - cosa funziona e cosa no;
   - problemi aperti e domande rimaste;
   - il prossimo passo indicato nel file.
6. **Non iniziare a lavorare da solo**: chiedi all'utente se procedere con il prossimo
   passo o se vuole fare altro.
