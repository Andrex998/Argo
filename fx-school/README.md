# Mini Scuola Forex

Una scuola privata con due soli allievi, il **Macro** e il **Tecnico**, e un **Preside**.
Gli allievi sono agenti IA e studiano per sei settimane di fila, dal 24/11/2026 al
4/1/2027, cosa muove le valute, l'oro e l'argento. Ognuno ha un wallet di 10.000 $ finti
e opera su prezzi veri:
- sette coppie di valute: EUR/USD, GBP/USD, AUD/USD, NZD/USD, USD/JPY, USD/CHF, USD/CAD;
- l'oro, XAU/USD;
- l'argento, attraverso l'ETF SLV, che contiene argento fisico. XAG/USD non è nel piano
  gratuito dei dati.

Il registro, i wallet, le lezioni, le discussioni e i voti si vedono nella pagina
**Mini Scuola Forex**: https://claude.ai/artifact/QtyCJLLCpSXNeRFUFjM4qs

In cima alla pagina c'è **l'aula in 3D**, con il Preside, il Macro e il Tecnico come
personaggi:
- camminano tra la cattedra, i banchi, la biblioteca e il terminale del motore;
- si siedono, leggono, scrivono alla lavagna e parlano in fumetti, con le loro parole del
  diario;
- accanto all'aula scorre la conversazione completa.

Durante la lezione del mattino l'aula va **in diretta**: la sessione scrive a ogni passo
cosa sta facendo, nel documento `live/ora`. Il resto del giorno l'aula rimette in scena la
giornata scelta nel registro. Il sorgente della pagina è in
[pagina/scuola-forex.html](pagina/scuola-forex.html).

## Una giornata

Ogni giorno alle 08:23, ora italiana, un'attività programmata avvia una sessione di Claude
nel cloud. La sessione segue [PROCEDURA.md](PROCEDURA.md):
1. il motore aggiorna i conti con le candele orarie della notte;
2. il Preside fa la lezione del giorno, secondo il [programma](programma.md);
3. i due allievi, due agenti separati con la loro personalità ([allievi/](allievi/)),
   studiano fonti serie, analizzano i fattori del giorno e si rispondono a turno;
4. propongono le operazioni, e il motore le esegue o le respinge secondo le regole;
5. il Preside dà il giudizio e i voti.

Alle 15:41 una seconda attività programmata, "Mini Scuola Forex · recupero", controlla il
diario del giorno. Fa la giornata solo se quella del mattino non c'è riuscita, per
esempio perché era finito il limite d'uso dell'abbonamento; altrimenti si ferma subito.

Ogni giorno ha il suo ritmo:
- **dal lunedì al venerdì** si opera;
- **il sabato** c'è l'interrogazione;
- **la domenica** il compito scritto e la pagella;
- **a fine corso** l'esame e il diploma.

## I file

| File | Cosa contiene |
| --- | --- |
| `school.py` | Il motore. Solo Python 3, senza pacchetti: prezzi, conti, regole. |
| `test_school.py` | Le prove del motore, senza rete. |
| `programma.md`, `programma.json` | I 42 giorni, con le date: la stessa cosa per le persone e per la pagina. |
| `preside.md`, `allievi/macro.md`, `allievi/tecnico.md` | Chi sono il Preside e i due allievi, e come ragionano. |
| `PROCEDURA.md` | La routine che la sessione di ogni mattina segue passo per passo. |
| `biblioteca.md` | La sintesi di otto lettori sulle ricerche serie di trading, per il Preside. |

## Il motore

Si lancia da questa cartella:

```
python3 school.py new stato.json                  una scuola nuova, due wallet da 10.000 $
python3 school.py mark stato.json                 prezzi di adesso, stop e target sulle candele orarie
python3 school.py picture                         il quadro giornaliero di ogni mercato
python3 school.py execute stato.json ordini.json  gli ordini degli allievi, a quei prezzi
python3 school.py history "EUR/USD" 500           candele giornaliere, per i compiti
```

I prezzi vengono da Twelve Data. Il piano gratuito permette 8 mercati al minuto e 800 al
giorno: una giornata di scuola ne usa circa 25. La chiave è salvata nell'ambiente cloud
"argo" e la aggiunge il proxy di rete: non è mai nel codice né nella chat.

## Le regole del wallet

Le fa rispettare il motore:
- ogni operazione ha uno stop obbligatorio;
- il rischio di un'operazione va dall'1% del capitale (di norma) al 2% (massimo);
- al massimo 4 posizioni aperte, una per mercato;
- la leva massima è 10 volte il capitale;
- su ogni operazione si paga lo spread;
- stop e target si controllano su ogni candela oraria: se il prezzo apre oltre il livello,
  si esce al prezzo d'apertura;
- sabato, domenica, Natale e Capodanno niente operazioni;
- un ordine su SLV aspetta l'apertura di New York.

## Costi e come fermarla

Ogni giornata usa l'abbonamento Claude, come i desk di trading: il primo giorno è durato
dieci minuti. Per fermare la scuola basta spegnere su claude.ai le due attività
programmate, "Mini Scuola Forex" e "Mini Scuola Forex · recupero", oppure chiederlo a
Claude. Dopo il diploma del 4/1/2027 vanno spente a mano, perché le sessioni della scuola
non hanno lo strumento per farlo: dal 5 gennaio la pagina lo ricorda, e le sessioni che
partono ancora si fermano subito.

## Prove

Dalla cartella principale del repository: `trading-desk/.venv/bin/python -m pytest fx-school -q`.
