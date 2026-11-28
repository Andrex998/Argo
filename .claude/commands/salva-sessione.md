---
description: Salva lo stato del lavoro in un file dentro il repository, così una nuova chat può riprendere da dove questa si è fermata.
---

# Salva sessione

Adattato dal comando `save-session` di ECC (Everything Claude Code). A differenza
dell'originale, il file va nel repository e non in `~/.claude/`: le sessioni cloud partono
ogni volta da un container nuovo e quella cartella andrebbe persa.

## Quando usarlo

- Prima di chiudere una chat lunga o quando il contesto si sta riempiendo.
- Dopo aver risolto un problema complicato.
- Prima di passare il lavoro a un'altra chat.

## Cosa fare

1. Raccogli il contesto: file modificati (`git status`, `git diff`, `git log` recente),
   decisioni prese, errori incontrati, stato dei test.
2. Crea, se non esiste, la cartella `.claude/sessioni/`.
3. Scrivi `.claude/sessioni/AAAA-MM-GG-<argomento-breve>.md` con la data di oggi e
   un argomento di poche parole separate da trattini (es. `2026-11-26-risk-gate-perps.md`).
   Se esiste già un file con lo stesso nome, aggiungi `-2`, `-3`.
4. Compila tutte le sezioni qui sotto. Se una sezione è vuota scrivi "Niente".
5. **Niente segreti nel file**: nessuna chiave, token o valore del `.env`.
6. Fai commit del file (`docs: salva sessione <argomento>`) e push sul branch corrente.
7. Mostra all'utente il riassunto e il nome del file, e ricordagli che nella nuova chat
   basta scrivere `/riprendi-sessione`.

## Formato del file

```markdown
# Sessione: AAAA-MM-GG — <argomento>

**Branch:** <branch corrente>
**Ultimo commit:** <hash breve e messaggio>

## Cosa stiamo costruendo
Due o tre frasi sull'obiettivo, comprensibili da chi non ha letto la chat.

## Cosa funziona (con le prove)
- <cosa> — <come lo sappiamo: test passati, prova fatta, output>

## Cosa NON ha funzionato (e perché)
- <tentativo> — <motivo preciso, così non lo si riprova>

## Cosa non è ancora stato provato
- <idea>

## Stato dei file
| File | Stato | Note |
|------|-------|------|
| percorso/file.py | finito / a metà / da fare | ... |

## Decisioni prese
- <decisione> — <perché>

## Problemi aperti e domande per l'utente
- ...

## Prossimo passo esatto
Una sola azione concreta da cui la prossima chat deve partire.

## Note su ambiente e configurazione
Modalità del desk (paper/live), exchange, comandi per avviare e testare, variabili
d'ambiente usate (solo i nomi, mai i valori).
```
