# Salvataggio dell'open interest dal PC dell'ufficio

BingX non conserva la storia dell'open interest: quello che non si salva oggi è perso. La
scuola lo fotografa una volta al giorno, ma solo se la riunione riesce. Questa cartella lo
salva ogni ora dal PC dell'ufficio, senza Claude e senza usare l'abbonamento.

Non servono chiavi: legge solo prezzi pubblici. Non manda ordini.

## Come si usa

1. Copia tutta la cartella sul PC, dove vuoi (per esempio accanto alla cartella del desk).
2. Doppio clic su `SALVA-OI.bat`: deve scrivere «Salvato alle ...» e creare `dati/`.
3. Doppio clic su `PROGRAMMA-OI.bat`, una volta sola: da quel momento il PC salva una riga
   ogni ora, al minuto 7. Ogni ora compare per qualche secondo una finestra nera: è normale.
4. Per fermarlo: doppio clic su `FERMA-OI.bat`.

Funziona solo con il PC acceso e la sessione di Windows aperta.

## Cosa scrive

Un file al mese, `dati/oi-AAAA-MM.jsonl`, con una riga per ogni salvataggio: l'ora (UTC),
l'open interest in dollari e il prezzo di ogni moneta, e le monete senza dati quella volta.
Sono circa 1 MB al mese. Se BingX non risponde, non scrive la riga e annota il motivo in
`dati/errori.log`.

Questi file servono agli esami sul passato (lo Spazzino e la regola C del Falco). Per ora
restano sul PC: quando serviranno, si mandano a Claude.
