# Scuola Cripto

La scuola di trading sulle criptovalute di ARGO, come l'ha progettata la biblioteca
(`trading-desk/research/biblioteca.md`, «Il progetto della scuola di agenti»). Ci sono otto
personaggi, tutti agenti IA:

| Chi | Cosa fa | Portafogli |
| --- | --- | --- |
| **Preside** | dirige la riunione, dà i voti, a fine mese assegna il rischio | nessuno |
| **Falco** | le rotture di volume a 4 ore: il desk dei perpetui | a regole e a giudizio |
| **Tartaruga** | il trend lento, su 1-16 settimane | a regole e a giudizio |
| **Spazzino** | compra le vendite forzate: RSI a 2 periodi nel verso del trend | a regole e a giudizio |
| **Ragioniere** | il carry sul funding, neutrale in dollari | a regole e a giudizio |
| **Guardiano** | il rischio: esposizione, allarmi, riduzioni scritte prima | nessuno |
| **Cronista** | calendario, notizie, politica, biblioteca | nessuno |
| **Scettico** | il revisore: al massimo 2 domande al giorno | nessuno |

I prezzi sono quelli veri dei contratti perpetui di BingX, sulle 36 monete della ricerca
del desk, senza memecoin. I soldi sono finti: 10.000 USDT per portafoglio.

La pagina **Scuola Cripto** mostra tutto:
- l'aula in 3D, in diretta durante le riunioni e in replica il resto del giorno;
- i portafogli, regole contro giudizio;
- il rischio, i quaderni, i verbali e le monete.

È qui: https://claude.ai/artifact/WEB5jaWNy37UBRKYuscQne. Il sorgente è in
[pagina/scuola-cripto.html](pagina/scuola-cripto.html).

Quattro attività programmate fanno girare la scuola, tutte con l'ora italiana:

| Attività | Quando | Cosa fa |
| --- | --- | --- |
| Scuola Cripto | ogni giorno alle 06:47 | la riunione del mattino ([PROCEDURA.md](PROCEDURA.md)) |
| Scuola Cripto · recupero | ogni giorno alle 13:17 | la riunione, solo se quella del mattino non c'è stata |
| Scuola Cripto · palestra | la domenica alle 11:13 | la palestra ([PALESTRA.md](PALESTRA.md)) |
| Scuola Cripto · sera | ogni giorno alle 20:41 | il controllo della sera ([SERA.md](SERA.md)) |

Le sessioni avviate dalle attività non possono spegnerle da sole: alla fine del trimestre
vanno spente a mano, e la pagina lo ricorda.

## Due portafogli per agente

Ogni agente con un portafoglio ne ha due, partiti insieme il 26/11/2026 (la sera prima c'è
la riunione di accoglienza, senza ordini):
- **Il portafoglio a regole.** Segue la strategia scritta ed esaminata nella biblioteca.
  Il codice lo rifà ogni giorno dall'inizio della scuola sui dati di BingX, quindi nessuno
  lo può toccare.
- **Il portafoglio a giudizio.** L'agente decide ogni mattina con la sua testa, dentro i
  limiti del motore:
  - lo stop è obbligatorio, tra l'1% e il 25% dal prezzo;
  - si rischia al massimo il 2% a posizione, costi compresi;
  - al massimo 4 posizioni, e tutte insieme valgono al massimo 3 volte il portafoglio.

La differenza tra i due misura la consapevolezza dell'agente: se il suo giudizio aggiunge
qualcosa alla regola, o se la cosa onesta è seguirla.

## Una giornata

Alle **06:47**, ora italiana, un'attività programmata avvia una sessione di Claude nel
cloud. La sessione segue [PROCEDURA.md](PROCEDURA.md):
1. il motore aggiorna i conti (stop, target, funding sulle candele orarie della notte),
   rifà i portafogli a regole, calcola il quadro delle monete e i numeri del rischio, e
   registra l'open interest di oggi;
2. il **Cronista** porta i fatti: calendario e al massimo 5 notizie, con fonte e ora;
3. **Falco, Tartaruga, Spazzino, Ragioniere e Guardiano** scrivono la loro posizione in
   privato, nello stesso momento, senza vedersi:
   - cosa dice la regola;
   - una previsione con la sua probabilità;
   - cosa farebbe cambiare idea;
   - gli ordini a giudizio;
4. lo **Scettico** fa al massimo 2 domande, e chi è chiamato risponde;
5. il motore esegue gli ordini a giudizio, o li respinge se escono dalle regole;
6. il **Preside** chiude in 5 righe e dà i voti.

Ogni personaggio tiene un quaderno con:
- le sue regole e i suoi errori;
- le previsioni, che il motore verifica sui prezzi veri;
- la calibrazione, cioè quanto dice di essere sicuro contro quanto ci prende;
- gli autovoti accanto ai voti del Preside.

Il **lunedì** c'è il consiglio di classe:
- la settimana di ciascuno, regole contro giudizio;
- l'ora delle notizie e una lettura della biblioteca;
- al massimo 2 ipotesi nuove per la lista d'esame.

Il **primo lunedì del mese** c'è lo scrutinio, con le pagelle. Il Preside decide quanto
rischio può prendere ogni portafoglio a giudizio: 0,5%, 1% o 2%.

Alle **13:17** una seconda attività programmata, «Scuola Cripto · recupero», rifà la
riunione solo se quella del mattino non c'è riuscita.

## Il controllo della sera

Ogni sera alle **20:41** il motore controlla se dalla riunione del mattino è successo
qualcosa di grosso ([SERA.md](SERA.md)). Gli allarmi sono scritti prima:
- BTC mosso del 7% o più;
- almeno 10 monete mosse del 10% o più;
- un portafoglio a giudizio giù del 4% o più;
- una cascata dell'open interest con BTC in calo.

Nelle sere tranquille la sessione scrive «tutto tranquillo» nella pagina e si ferma in
un minuto. Con un allarme c'è una riunione straordinaria breve: il bollettino del
Guardiano, cosa cambia per i quattro agenti con un portafoglio, eventuali ordini, e tre
righe del Preside.

## La palestra della domenica

Nella riunione le risposte vere arrivano piano: una previsione a 7 giorni si verifica dopo
7 giorni. Per allenarsi più in fretta, ogni **domenica alle 11:13** c'è la palestra
([PALESTRA.md](PALESTRA.md)).
- **I casi.** Falco, Tartaruga, Spazzino e Ragioniere ricevono 20 casi veri degli ultimi
  tre anni, metà del loro mestiere e metà a caso.
- **Cosa vedono.** Le ultime 30 candele e i numeri di quel giorno, senza moneta, senza
  data e con i prezzi riscalati a 100, così l'IA non può ricordarsi com'è finita.
- **Cosa decidono.** Per ogni caso: su o giù tra 7 giorni, con quale probabilità, e un
  piano con lo stop.
- **I voti.** Il motore guarda subito i 7 giorni dopo e dà i voti: la calibrazione delle
  probabilità e il risultato del piano in R. Gioca gli stessi casi anche con la regola
  scritta dell'agente, semplificata.
- **Dopo.** Ognuno legge i suoi errori e scrive una lezione, e una regola nuova solo se i
  numeri la sostengono. Lo Scettico controlla, e il consiglio del lunedì ne discute.

Nel quaderno di ogni agente ci sono due calibrazioni: quella della palestra e quella della
realtà. La palestra allena, ma l'esame vero resta il mercato di ogni giorno. Se dopo
qualche settimana la palestra non migliora le previsioni vere, si toglie.

Il primo trimestre va dal 26/11/2026 al 21/2/2027: [programma.md](programma.md).

## I file

| File | Cosa contiene |
| --- | --- |
| `data.py` | I prezzi, il funding e l'open interest di BingX, senza chiavi. |
| `rules.py` | I quattro portafogli a regole. |
| `judgment.py` | I quattro portafogli a giudizio, e la verifica delle previsioni. |
| `picture.py` | Il quadro delle monete e i numeri del Guardiano. |
| `gym.py` | La palestra: i casi anonimi del passato e i loro voti. |
| `school.py` | I comandi del motore. |
| `test_school.py` | Le prove del motore, senza rete. |
| `programma.md`, `programma.json` | Gli 88 giorni del trimestre, con le date. |
| `preside.md`, `agenti/*.md` | Chi sono i personaggi e come ragionano. |
| `PROCEDURA.md` | La riunione del mattino, passo per passo. |
| `PALESTRA.md` | La palestra della domenica, passo per passo. |
| `SERA.md` | Il controllo della sera e la riunione straordinaria. |

## Il motore

Gira con il Python del desk, perché i portafogli a regole usano il codice della ricerca.
Da `trading-desk/`:

```
uv sync --frozen
uv run --frozen python ../crypto-school/school.py mark STATO.json OI.json
uv run --frozen python ../crypto-school/school.py giorno STATO.json OI.json CARTELLA
uv run --frozen pytest ../crypto-school/test_school.py -q
```

Le altre istruzioni sono in cima a `school.py`.

**Perché BingX.** Bybit e Binance rifiutano le sessioni nel cloud per la loro posizione;
BingX risponde senza chiave. BingX non tiene la storia dell'open interest, quindi la
scuola la registra ogni mattina. Lo stato FRAGILE del Guardiano (esame E06) e l'idea dello
Spazzino sulle vendite forzate (esame E09) potranno usarla dopo qualche settimana.

## I limiti onesti

- **Gli agenti.** Non sono coscienti e non imparano da soli: ricordano solo quello che è
  scritto nei quaderni e nei verbali.
- **Il paper trading non è il conto vero.** Mancano lo slittamento dei crolli veri, gli
  ordini non eseguiti e il rischio dell'exchange.
- **Gli ordini a giudizio.** Si eseguono al prezzo del momento della riunione. Le posizioni
  si controllano sulle candele orarie, dalla prima ora intera dopo l'apertura.
- **L'abbonamento.** Le riunioni usano lo stesso abbonamento della scuola forex e dei desk.
  Gli agenti girano con il modello `sonnet` per consumare meno.
