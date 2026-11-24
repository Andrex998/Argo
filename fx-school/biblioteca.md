# Biblioteca della scuola

La sintesi di otto lettori che hanno studiato le ricerche serie sul trading. È stata scritta
soprattutto per il desk delle cripto di ARGO, ma le leggi generali valgono anche per valute,
oro e argento: qui c'è solo quella parte. Dove un esempio parla di cripto, il Preside lo
traduce o lo lascia stare. I numeri vengono da abstract ed estratti degli studi: prima di
usarli come regola, si apre la fonte originale.

Non serve leggerla tutta ogni giorno: si leggono le sezioni che servono alla lezione.

1. Le leggi generali
2. Trend e momentum: cosa dicono i dati
3. Notizie, banche centrali e politica
4. Rischio, dimensione e psicologia
5. Tre strumenti che valgono anche qui
6. Come si esamina una strategia
7. Come si discute, e i limiti onesti degli agenti
8. I miti da bandire
9. Da leggere

## 1. Le leggi generali

COSA REGGE DAVVERO
1) Seguire il trend su orizzonti da settimane a mesi, con la dimensione legata alla volatilità e su molti mercati. È la prova più lunga che esista: dal 1880, su decine di mercati, con uno Sharpe intorno a 1,2 lordo nei future diversificati. Ma vive di pochi trend grandi. Ha anni piatti e cali del 20-25%, e rende soprattutto quando i mercati si muovono molto. Serve più a evitare i grandi crolli che a battere chi compra e tiene.
2) Gestire la dimensione. Ridurre l'esposizione quando la volatilità sale taglia le perdite estreme quasi ovunque (oltre 60 mercati dal 1926). È la cosa più solida della biblioteca. Non garantisce più rendimento: garantisce code più piccole.
3) Il carry, cioè incassare il funding. È un premio vero, ma è il compenso per assicurare gli altri contro i crolli: si guadagna poco e spesso, si perde tanto e di rado. Sulle cripto è stato enorme fino al 2024; nel 2025 il suo Sharpe è diventato negativo.

TRE LEGGI CHE VALGONO OVUNQUE
- I costi decidono. Con lo 0,31% per andata e ritorno, ogni operazione deve guadagnare in media molto di più. Più si opera, più si regala.
- Ogni vantaggio pubblicato si consuma. Le bande di Bollinger hanno perso circa metà della redditività dopo essere diventate famose. Il rialzo prima delle riunioni della Fed si è quasi spento dopo il 2016.
- Chi prova cento varianti trova sempre un backtest bellissimo per caso. La difesa non è l'intelligenza, è il metodo: decidere prima, contare le prove, verificare una volta sola.

ASPETTATIVE ONESTE
Un buon sistema sulle cripto può puntare a uno Sharpe netto tra 0,5 e 1, con cali del 15-25% e mesi senza guadagni. Chi promette Sharpe sopra 2, il 90% di vincite o il 10% al mese sbaglia i conti o vende qualcosa.

GLI AGENTI IA
Non hanno un vantaggio segreto sul mercato. Possono dare quattro cose: disciplina (regole applicate senza paura né avidità), conti fatti bene, memoria scritta e la pazienza di bocciare le idee prima che costino. Una scuola che boccia l'80-90% delle idee sta funzionando.

## 2. Trend e momentum: cosa dicono i dati

Nota di metodo: in questa sessione WebFetch era bloccato dalla rete. Gli host aqr.com, pages.stern.nyu.edu, fairmodel.econ.yale.edu e alphaarchitect.com non si risolvevano, quindi non ho potuto aprire i PDF completi. Ho letto 18 fonti diverse tramite WebSearch, cioè abstract, pagine SSRN/arXiv/riviste ed estratti delle pagine dei gestori. Quando un numero viene solo da un riassunto di terzi lo dico. Le regole d'uscita esatte di Zarattini e i parametri delle Turtle vanno verificati aprendo i PDF.

1) Il trend following è tra le anomalie più documentate. AQR (Hurst, Ooi, Pedersen) ricostruisce dal 1880 una strategia su 67 mercati: segnali a 1, 3 e 12 mesi, ogni mercato pesato per la sua volatilità. Il risultato è positivo in modo costante per circa 110 anni e positivo in 8 delle 10 peggiori crisi del portafoglio 60/40. Ci sono stati però cali fino al 25% durati a lungo. Lo studio TSMOM di Moskowitz, Ooi e Pedersen su 58 future trova Sharpe di circa 1,2-1,3 con 12 mesi di lookback e 1 mese di tenuta, al lordo dei costi. Il trend dura circa un anno e poi si inverte in parte.

2) Il filtro scelto conta poco. Medie mobili incrociate e rendimento passato sono rappresentazioni equivalenti (Levine e Pedersen, 2016). Anche sulle cripto i profitti non dipendono dal tipo di media (Rozario et al.). Contano di più l'orizzonte, la dimensione della posizione legata alla volatilità e la diversificazione tra orizzonti e mercati.

3) Il volatility targeting riduce le code e i cali massimi su tutti gli asset. Migliora lo Sharpe solo sugli asset di rischio come azioni e credito, dove agisce l'effetto leva (Harvey et al., 60 asset dal 1926).

4) Il trend following ha periodi lunghi e brutti. Negli anni 2010 ha reso poco perché i mercati si muovevano meno (AQR, Babu et al.), non perché il trend fosse sparito. Nel 2022 l'indice SG Trend ha fatto +27%, il miglior anno dal 2000.

5) Le cripto. La momentum time-series a orizzonte giornaliero e settimanale è significativa (Liu e Tsyvinski) ed è più forte nei mercati rialzisti (Han, Kang, Ryu). Il rapporto tra prezzo e media mobile a 5-100 giorni prevede il rendimento giornaliero di BTC anche fuori campione (Detzel et al., Financial Management). Il trend following su BTC dal 2011 al 2019 ha avuto Sharpe tra 0,5 e 1,5, mentre l'intraday non era profittevole (Rozario et al.). Un insieme di canali di Donchian a più lookback, con posizioni scalate per volatilità, su un paniere delle 20 cripto più liquide dichiara Sharpe sopra 1,5 al netto dei costi (Zarattini, Pagani, Barbon, 2025). Il momentum cross-sectional sulle cripto è più debole e instabile (Grobys e Sapkota: non significativo 2014-2018).

6) Il trend following è soprattutto uno strumento per ridurre il rischio, non per battere sempre il comprato e tenuto. La regola dei 10 mesi di Faber resta poco sotto il buy and hold in rendimento con circa metà del calo massimo. Sulla media a 200 giorni di BTC 25 incroci al rialzo su 36 sono falliti entro 30 giorni, e la regola ha battuto il semplice possesso solo in pochi anni come il 2022.

Per il nostro desk: il sistema attuale (+108% con calo massimo del 13,5%, contro BTC +124% con cali molto più grandi) è coerente con questa letteratura. Rende un po' meno ma con molto meno rischio. Le prove più solide dicono di aggiungere un motore lento (giornaliero/settimanale) a più orizzonti e scalato per volatilità, che costa meno in commissioni e si diversifica col motore a 4 ore. Dicono anche di verificare se il lato short regge davvero, perché l'effetto è più forte nei mercati in salita.

**Lezioni per gli agenti.**

Come ragiona un trader di questa scuola:

1) Non prevede, segue. La domanda non è "dove andrà BTC", ma "qual è il segno del rendimento su 1, 2, 4, 8 e 16 settimane, e quanto rischio metto per unità di volatilità". Ogni opinione su politica e notizie conta solo se si vede nei prezzi: il trend è il modo in cui il mercato digerisce lentamente le notizie.

2) Usa insiemi, non parametri magici. Molti lookback e più mercati con lo stesso peso di rischio. Se un risultato regge solo con L = 37 è overfitting. Medie e momentum sono equivalenti (Levine e Pedersen), quindi non si discute di EMA contro SMA, si discute di orizzonte e costi.

3) La dimensione della posizione è metà della strategia. Si scala ogni posizione per la volatilità (ATR o EWMA), si fissa un tetto alla leva totale e si ricorda che le altcoin sono molto correlate: 36 monete non sono 36 scommesse indipendenti.

4) Prima di tutto i costi. Con 0,055% per lato più 0,1% di slippage un andata e ritorno costa circa 0,31%. Va calcolato il turnover di ogni variante. I segnali giornalieri o settimanali con banda di ribilanciamento spesso battono quelli a 4 ore al netto. Nel calcolo vanno messi anche i funding.

5) Il lato short va dimostrato, non assunto. Il momentum cripto è più forte nei mercati in salita (Han, Kang, Ryu). Va confrontato long-only contro long/short e controllato quanto rende e quanto costa in funding il lato short del nostro sistema, dove BTC decide il lato.

6) Il trend following si giudica con la metrica giusta: Sharpe, calo massimo, MAR/Calmar, durata dei periodi sotto il massimo. Battere BTC in rendimento non è l'obiettivo. +108% con calo massimo del 13,5% contro +124% con cali molto più profondi può essere un risultato migliore.

7) Diffidenza verso i numeri alti. Uno Sharpe sopra 2 o un 255% annuo vanno ricalcolati sui nostri dati con i nostri costi. Bisogna chiedersi sempre: parametri ottimizzati? Fuori campione? Dopo la pubblicazione? Bias di sopravvivenza? Il nostro paniere contiene solo monete sopravvissute, con ticker cambiati come MATIC/POL, RNDR e FTM: questo gonfia i risultati long.

8) Pochi anni non bastano. Tre anni sono circa un ciclo. Servono walk-forward (stimare su 12-18 mesi e testare sui successivi), test su sottogruppi di monete, rimescolamento delle date e ritardo di un giorno nelle esecuzioni per controllare la robustezza.

9) Accetta lunghe serie di perdite. Le Turtle vincono meno della metà delle volte, il trend following ha avuto un decennio magro e tutto il guadagno viene da pochi grandi trend. Un agente che cambia regole dopo 5 perdite distrugge la strategia. Rivedere le idee sì, ma solo con prove statistiche su campioni ampi, non dopo una settimana brutta.

10) Combina orizzonti diversi. Un motore veloce (il nostro a 4 ore) e uno lento (giornaliero o settimanale multi-orizzonte) si diversificano. Man trova che il veloce protegge meglio nelle crisi e il lento rende di più in media.

11) Distingui prova da folla. TikTok e i video sul golden cross servono come termometro del sentiment: quando tutti parlano dello stesso incrocio, le rotture sono affollate e lo slippage aumenta. Non sono una prova.

12) Mai manipolare. Niente pump and dump, spoofing o FUD organizzato: sono illegali e fuori da questa scuola. Il vantaggio del trend following viene dalla pazienza e dalla gestione del rischio, non dall'inganno.

Nota pratica: il WebFetch di questa sessione era bloccato, quindi le fonti sono state lette tramite abstract ed estratti di ricerca. Per verificare le regole esatte (uscite di Zarattini, parametri delle Turtle, tabelle di Han et al.) bisogna permettere nelle impostazioni di rete della sessione gli host aqr.com, pages.stern.nyu.edu, papers.ssrn.com e arxiv.org, e rileggere i PDF.

## 3. Notizie, banche centrali e politica

Un avvertimento sul metodo prima di tutto. In questa sessione WebFetch e curl erano bloccati dalla rete per newyorkfed.org, bis.org, arxiv.org, ssrn.com, skidmore.edu e coindesk.com. Ho letto le fonti attraverso gli estratti che il motore di ricerca prende dalle pagine originali (circa 30 ricerche e più di 20 fonti diverse), non scaricando i PDF interi. Prima di mettere in produzione qualsiasi numero, va controllato sul testo originale. Per leggerli direttamente bisogna autorizzare quei domini nelle impostazioni di rete della sessione.

Cosa ho imparato:
(1) Nelle azioni i premi legati agli annunci sono reali e ben documentati. Savor e Wilson trovano 11,4 punti base nei giorni di annuncio contro 1,1 negli altri giorni. Il pre-FOMC drift di Lucca e Moench spiegava circa l'80% del premio azionario dal 1994. Il ciclo FOMC di Cieslak e colleghi concentra il premio nelle settimane pari. Però il drift pre-FOMC si è indebolito dopo la pubblicazione (Kurov, Wolfe e Gilbert: dal 2016).
(2) Le prove sulle cripto sono deboli e cambiano col periodo. Benigno e Rosa (NY Fed) trovano che bitcoin non risponde alle notizie macro, con l'eccezione del CPI. Smales e Block Scholes trovano una reazione negativa alle sorprese del CPI dal 2022. Corbet e colleghi trovano CPI e PIL non significativi e una reazione all'occupazione opposta a quella delle azioni. Pyo e Lee trovano circa +0,96% il giorno prima del FOMC e -1% il giorno stesso. Per il 2025 ci sono solo prove aneddotiche di cali nelle 48 ore dopo il FOMC (7 riunioni su 8).
(3) L'effetto più solido e utile non riguarda la direzione ma la volatilità. Attorno a CPI e FOMC la volatilità realizzata e quella implicita salgono (Kaiko, Volmex, Block Scholes) e poi calano quando l'incertezza si risolve. Nel cambio, i prezzi saltano subito sulla sorpresa (Andersen, Bollerslev, Diebold e Vega): non resta un drift facile da prendere dopo.
(4) I flussi degli ETF seguono il prezzo invece di anticiparlo. Secondo DWF la correlazione è 0,54 con i 5 giorni passati e 0,03 con i 5 giorni futuri. Le prove che i flussi prevedano i rendimenti sono deboli e dipendono da come si allineano gli orari.
(5) Le notizie di regolamentazione contano soprattutto quando cambiano lo status legale: i divieti e il trattamento come titoli fanno male, le leggi su misura fanno salire, i semplici avvertimenti non hanno effetto (Auer e Claessens, BIS).
(6) Le guerre e gli shock geopolitici non rendono bitcoin un rifugio: la correlazione con l'indice di rischio geopolitico è circa zero. Gli shock che arrivano fuori orario, con molta leva aperta, producono cascate di liquidazioni (10-11 ottobre 2025: circa 19 miliardi). Dopo le liquidazioni più grandi il rendimento medio a 30 giorni è stato più basso del normale (K33).

Per il nostro desk, quindi, la macro serve soprattutto come gestione del rischio attorno agli eventi in calendario e come filtro sulla fragilità della leva. Non è una fonte di segnali di direzione. Le poche idee di direzione (drift pre-FOMC, debolezza dopo il FOMC) hanno campioni piccoli: circa 24 riunioni FOMC e 36 CPI nel nostro periodo. Vanno trattate come ipotesi da smentire, non come vantaggi provati.

**Lezioni per gli agenti.**

Come ragiona un trader di questa scuola:

1. Il calendario prima di tutto. Ogni mattina l'agente controlla se nelle prossime 48 ore ci sono CPI, NFP, FOMC (con conferenza stampa), discorsi del presidente della Fed, scadenze politiche (dazi, elezioni, decisioni della SEC). Gli orari vanno sempre convertiti in UTC, tenendo conto dell'ora legale USA: CPI e NFP alle 12:30 o 13:30 UTC, FOMC alle 18:00 o 19:00 UTC.

2. La macro decide quanto rischiare, non da che parte andare. Prima di un evento la domanda non è 'salirà o scenderà?' ma 'se il prezzo salta di 3 ATR contro di me, quanto perdo e posso permettermelo?'. Si riduce la dimensione, non si cerca di indovinare.

3. Separare la sorpresa dal dato. Il mercato reagisce alla differenza tra il dato e le attese, non al dato in sé. Senza le attese degli analisti (consensus) l'agente non deve raccontarsi storie sul perché il prezzo si è mosso.

4. Il prezzo è più veloce di te. Dopo l'annuncio il primo salto è già finito prima che un agente a 4 ore possa reagire. Non inseguire la candela dell'evento: aspettare la chiusura della candela successiva e trattare quella dell'evento come rumore, a meno che i test dicano il contrario.

5. La sensibilità ai dati macro cambia. Ogni mese l'agente aggiorna la domanda 'a cosa sta guardando il mercato adesso?' (CPI, payroll, dazi, ETF) con una regressione mobile sugli ultimi 12 eventi, come fa Block Scholes. Una regola valida nel 2022 può non valere nel 2026.

6. La leva è la benzina, la notizia è il fiammifero. Prima di uno shock contano l'open interest, il funding e l'affollamento sui long. Il venerdì sera e il weekend, con leva alta, sono i momenti più pericolosi. L'agente deve chiedersi: chi sarebbe costretto a vendere se arriva una brutta notizia?

7. Non comprare dopo una cascata di liquidazioni solo perché 'è sceso tanto': i dati di K33 dicono che in media il mese dopo è più debole del normale. Aspettare che OI e funding si stabilizzino.

8. Flussi degli ETF, emissioni di stablecoin e titoli tipo 'arrivano gli istituzionali' sono descrizioni di quello che è già successo. Non si apre un'operazione su questi dati.

9. Sulle notizie di regolamentazione: reagire solo a quelle che cambiano lo status legale (divieti, cause sui titoli, leggi approvate). Ignorare gli avvertimenti, le dichiarazioni e le voci. Una notizia positiva attesa da mesi (come gli ETF) può già essere nel prezzo.

10. Disciplina statistica: con 24 riunioni FOMC e 36 CPI ogni risultato va verificato con un placebo (stesse ore in giorni senza eventi), con il bootstrap e con i costi raddoppiati. Un effetto che vive su un solo anno o un solo evento è rumore. Se una regola nasce da TikTok o da un articolo di settore, parte con il peso di una voce di corridoio, non di una prova.

11. Ogni effetto pubblicato si indebolisce: il drift pre-FOMC è sparito nelle azioni dopo il 2016. L'agente deve tenere un registro dei risultati fuori campione per ogni regola e spegnerla quando il vantaggio sparisce, senza affezionarsi.

12. Mai manipolazione: niente annunci falsi, niente FUD organizzato, niente spoofing. Il caso Tether 2017 si studia per riconoscere la manipolazione e difendersene, non per imitarla.

Errori da evitare: confondere la correlazione del giorno con una causa; usare le date degli eventi con un fuso orario sbagliato; testare sullo stesso periodo in cui si sono scelte le soglie; considerare bitcoin un rifugio nelle crisi; aumentare la dimensione prima di un evento 'perché sono sicuro del dato'.

## 4. Rischio, dimensione e psicologia

Limiti di questa lettura, da sapere prima di usarla:
- In questa sessione la lettura diretta delle pagine era bloccata dal proxy. Erano bloccati WebFetch e curl verso ssrn.com, arxiv.org, nber.org, wikipedia.org, escholarship.org e math.ucla.edu.
- Il budget di ricerca web si è esaurito dopo 9 ricerche.
- Le 9 fonti qui sotto le ho quindi lette tramite gli estratti e gli abstract che restituisce il motore di ricerca, non per intero. Ogni numero citato viene da quegli estratti. Restano da verificare sul testo completo, che si trova agli URL indicati.
- Seykota, Van Tharp, Mark Douglas, il diario di trading e Grossman-Zhou NON sono stati letti in questa sessione. Su di loro non riporto prove.
- Per arrivare alle 10 fonti richieste bisogna sbloccare quei domini, oppure fare una nuova sessione con budget di ricerca.

Cosa ho imparato:
1) La dimensione della posizione conta quanto il segnale. Kelly (Thorp; MacLean-Thorp-Ziemba) massimizza la crescita del logaritmo del capitale. A Kelly pieno, però, la probabilità di scendere prima o poi a una frazione x del capitale è circa x: c'è circa il 50% di probabilità di dimezzarsi. Puntare più di Kelly fa più danni che puntare meno. Mezzo Kelly tiene circa il 75% della crescita con molta meno variabilità. Poiché il vantaggio stimato è quasi sempre sovrastimato, si usa una frazione di Kelly.
2) Il volatility targeting (Moreira-Muir 2017; Harvey et al. 2018, Man Group) riduce le code sinistre in tutte le classi di attivo. Migliora lo Sharpe soprattutto degli attivi rischiosi. Fuori campione, però, il guadagno di Sharpe non è garantito (Cederburg et al. 2020). La riduzione delle code è il beneficio più solido.
3) Lo stop-loss aggiunge valore solo se i rendimenti hanno persistenza (momentum o regimi). In un mercato a passeggiata casuale riduce il rendimento atteso (Kaminski-Lo 2014). Va quindi verificato con i dati, non dato per scontato.
4) Una scuola di agenti che prova molte varianti produrrà per forza backtest falsamente brillanti. Le difese sono:
   - Deflated Sharpe Ratio: corregge per il numero di prove, la non-normalità e la lunghezza del campione.
   - Probabilità di overfitting del backtest (PBO) con la convalida incrociata combinatoria (CSCV).
   - Soglia t > 3 invece di 2 (Harvey-Liu-Zhu: la maggior parte delle scoperte finanziarie pubblicate è probabilmente falsa).

Confronto con il nostro sistema (+108% con calo massimo 13,5%, contro +124% di BTC comprato e tenuto): il guadagno più probabile non è un nuovo segnale. È una dimensione più intelligente:
- volatilità obiettivo;
- tetto al rischio totale aperto, che conti la forte correlazione delle altcoin con BTC;
- frazione di Kelly ricavata dai risultati fuori campione;
- tutto validato con DSR e PBO sul numero REALE di varianti provate.

**Lezioni per gli agenti.**

Come ragiona un agente di questa scuola (rischio prima del rendimento).

1) Prima domanda sempre: 'quanto posso perdere e con quale probabilità?', non 'quanto posso guadagnare?'. La dimensione decide la sopravvivenza; il segnale decide solo il segno.

2) Aspettativa prima di tutto. Per ogni strategia calcola E[R] = p·vincita media − (1−p)·perdita media, in R e al netto di 0,055% + 0,1% per lato. Una percentuale di vincite alta senza questo calcolo non significa nulla.

3) Dimensione ricavata dai dati fuori campione:
- frazione di Kelly (da 1/4 a 1/2) stimata sulle ultime 100 o più operazioni fuori campione;
- limite massimo per operazione;
- strategia sospesa se il Kelly stimato è ≤ 0.
Mai aumentare il rischio dopo una serie di vincite per 'sensazione'.

4) Conta le scommesse vere, non le posizioni. Le altcoin sono quasi tutte BTC travestito: prima di aprire, chiediti quanto vale il rischio aperto se tutto si muove insieme a BTC. Usa un tetto al rischio correlato.

5) Scala con la volatilità e aspettati soprattutto meno code, non più rendimento.

6) Non dare per buono lo stop: verifica se il mercato ha persistenza (Kaminski-Lo). Se non c'è, lo stop costa.

7) Anti-autoinganno, obbligatorio per la scuola:
- registra OGNI variante provata, anche quelle fallite, in un registro condiviso;
- calcola il DSR con N = numero reale di prove e la PBO con CSCV;
- chiedi t > 3;
- congela le regole prima dell'ultimo blocco di dati e toccalo una volta sola;
- non riottimizzare dopo aver visto il risultato fuori campione.
Quando due agenti 'scoprono' la stessa cosa sugli stessi dati, non è una conferma indipendente: è la stessa prova contata due volte.

8) Diffida dei risultati famosi. Il volatility management era brillante in campione e debole in tempo reale. Ogni idea letta in un libro o in un paper va ritestata sui nostri 36 coin, con costi, e confrontata con due riferimenti: il sistema attuale (+108%, calo massimo 13,5%) e BTC comprato e tenuto (+124%).

9) Misure da riportare sempre:
- rendimento, calo massimo, MAR, Sharpe e DSR;
- peggior giorno e peggior settimana;
- tempo sott'acqua;
- numero di operazioni;
- risultati separati per anno o regime.

10) Social come termometro: quando TikTok o X promettono rischi del 10% a operazione o vincite al 90%, consideralo un segnale di euforia della folla, non un metodo.

11) Onestà: se una cosa non è dimostrata, l'agente lo dice. In questa lettura non ho studiato Seykota, Van Tharp, Mark Douglas, il diario di trading né il controllo del calo di Grossman e Zhou, perché la rete era bloccata e il budget di ricerca esaurito. Vanno assegnati a un nuovo lettore con accesso ai domini ssrn.com, arxiv.org, nber.org e wikipedia.org.

## 5. Tre strumenti che valgono anche qui

Sono pensati per un paniere di cripto: per la scuola contano l'idea e le prove. Le regole
esatte, con i parametri delle cripto, sono nella biblioteca completa del desk
(`trading-desk/research/biblioteca.md`).

### E02 · Trend lento multi-orizzonte sul paniere (segno del rendimento e canali di Donchian)

Famiglia: Trend following lento (momentum nel tempo). Forza delle prove: **B buona**.

Il prezzo assorbe le notizie lentamente e poi la folla insegue. Per questo il segno del rendimento passato, su settimane e mesi, prevede il segno di quello futuro. È la regola con più prove al mondo, ma vive di pochi trend grandi e ha anni piatti. Per noi conta per un motivo pratico: il sistema a 4 ore ha preso poco dei rialzi degli anni 1 e 2. Un motore lento, con la dimensione legata alla volatilità, tiene le posizioni dentro i trend lunghi, opera poco (quindi costa poco) e dovrebbe essere poco correlato al 4 ore.

**Fonti principali.** Hurst, Ooi, Pedersen 2017 (trend dal 1880 su 67 mercati, cali fino al 25%); Moskowitz, Ooi, Pedersen 2012; Levine e Pedersen 2016 (medie e rendimenti passati sono la stessa informazione); Liu e Tsyvinski (momentum nel tempo a orizzonte giornaliero e settimanale nelle cripto); Han, Kang, Ryu (più forte nei rialzi); Detzel et al. 2021; Rozario et al. (Sharpe 0,5-1,5 su BTC 2011-2019); Zarattini, Pagani, Barbon 2025, SSRN 5209907 (Donchian a più orizzonti sulle cripto, Sharpe dichiarato sopra 1,5, nessuna replica). I campioni cripto sono corti: per questo il voto è B e non A.

**Cosa la smentirebbe.** Se la media delle tre varianti è negativa al netto di costi e funding negli anni 2 e 3, oppure se la combinazione con E01 (a rischio uguale) non ha un MAR più alto di E01 da solo, il trend lento non serve sulle nostre monete in questo periodo. Se il risultato sparisce togliendo la moneta migliore, era fortuna su una moneta. Se T2 regge solo prima di aprile 2025 (periodo già coperto dal paper) e non dopo, il paper non si replica.

**Ruolo atteso.** Motore principale lento e diversificazione rispetto al 4 ore (copre gli anni di rialzo)

### E03 · Volatilità obiettivo (regolatore della dimensione)

Famiglia: Gestione del rischio: dimensione per volatilità. Forza delle prove: **A forte**.

La volatilità di domani somiglia a quella di oggi; i rendimenti no. Ridurre l'esposizione quando la volatilità sale taglia le perdite estreme in quasi tutti i mercati: è la prova più solida della biblioteca. Non promette più rendimento, promette code più piccole. Sul sistema a 4 ore l'effetto sarà piccolo, perché lo stop a 3 ATR dimensiona già per volatilità. Sul portafoglio della scuola, con più motori insieme, conta di più.

**Fonti principali.** Harvey et al. 2018 (oltre 60 mercati dal 1926: meno code ovunque, Sharpe migliore solo sugli attivi rischiosi); Moreira e Muir 2017; Cederburg et al. 2020 (fuori campione lo Sharpe migliora solo in 53 strategie su 103: il voto A vale per le code, non per il rendimento); Daniel e Moskowitz 2016 (i crolli del momentum arrivano dopo i cali con volatilità alta); Habeli et al. 2024 (preprint sulle cripto).

**Cosa la smentirebbe.** Se, a parità di esposizione media, calo massimo, settimana peggiore e 5% dei giorni peggiori non migliorano in nessuno dei due anni di verifica, oppure se il MAR peggiora in entrambi, la volatilità obiettivo non serve sulle nostre monete. Su E01 da solo un effetto piccolo è atteso: il giudizio vero è sul portafoglio con più motori.

**Ruolo atteso.** Dimensione: meno code e calo massimo, non più rendimento

### E05 · Tetto al rischio correlato

Famiglia: Gestione del rischio: correlazione. Forza delle prove: **C debole**.

Con BTC che decide il lato, le posizioni aperte vanno quasi sempre nello stesso verso. Nei crolli, poi, le altcoin si muovono insieme a BTC: cinque posizioni da 1% sono quasi una scommessa sola da 4-5%. Il tetto misura il rischio vero del portafoglio e blocca le nuove entrate quando è pieno.

**Fonti principali.** Harvey et al. 2018 (controllare il rischio del portafoglio taglia le code: prova indiretta). Nessuna prova specifica sulle cripto letta dai lettori. Logica della correlazione nei crolli: le altcoin seguono BTC. Ricerca del desk: oggi c'è un limite di 5 posizioni, tutte nello stesso verso di BTC.

**Cosa la smentirebbe.** Se, a parità di esposizione media, calo massimo e settimana peggiore non migliorano più del placebo che scarta a caso gli stessi segnali, il tetto equivale solo a fare meno operazioni. Se taglia soprattutto le operazioni migliori dei trend forti (guadagno perso maggiore del calo evitato), è bocciato.

**Ruolo atteso.** Dimensione

## 6. Come si esamina una strategia

Il protocollo d'esame della biblioteca. Le convenzioni su candele a 4 ore, commissioni e
funding sono del desk delle cripto: nella scuola valgono i costi e le candele del motore.
Il metodo (regole scritte prima, un periodo per scegliere e uno mai visto per
verificare, il confronto con il caso) vale uguale.

PROTOCOLLO D'ESAME. Vale per tutti, compreso il sistema attuale.

0) CONVENZIONI COMUNI
- Ore in UTC. La candela giornaliera è fatta dalle 6 candele 4h dalle 00:00 alle 24:00. La settimana parte lunedì alle 00:00.
- Il segnale si calcola alla chiusura di una candela e si esegue all'apertura della candela dopo. Mai sulla stessa candela.
- Costi: 0,055% di commissione + 0,1% di slittamento per lato, su ogni cambio di posizione (0,31% andata e ritorno). Il funding reale si paga o si incassa a ogni regolamento, su ogni posizione aperta.
- Funding, OI e rapporto long/short si usano solo dopo che sono stati pubblicati:
  - il funding regolato alle 08:00 vale dalla candela che apre alle 08:00;
  - OI e long/short si prendono con l'ultima lettura prima della chiusura, come fa già derivs.py con la lettura delle hh:55;
  - l'OI si misura in monete, non in dollari. Altrimenti un calo di prezzo sembra un calo di posizioni.
- Se nella stessa candela si toccano sia lo stop sia il target, vince lo stop. Nelle candele con escursione oltre 3 ATR lo slittamento sugli stop è triplo (0,3%).
- Una posizione non supera l'1% del volume in USDT della candela d'entrata.

1) IGIENE DEI DATI, PRIMA DI OGNI TEST
- Buchi e doppioni nelle candele.
- Cuciture MATIC→POL, FTM→S, RNDR→RENDER (STITCH in perps.py): controllare le date.
- Monete con funding ogni 4 ore.
- Date di quotazione delle monete giovani (TIA, ORDI, SEI e altre).
- Le 36 monete sono quelle sopravvissute fino a oggi, quindi i risultati long sono gonfiati. Va scritto in ogni rapporto.

2) SCHEDA D'ESAME SCRITTA PRIMA DI VEDERE I RISULTATI
La scheda contiene: l'ipotesi; chi paga e perché; regole esatte; parametri; varianti (al massimo 4); misure; soglie di promozione; cosa la smentirebbe. Si salva in git con la data. Ogni ritocco fatto dopo aver visto un risultato è una prova nuova e si conta.

3) DIVISIONE DEL TEMPO
- Anno 1 (nov 2023 – ott 2024) = palestra. Solo qui si sceglie tra le varianti dichiarate. Attenzione: è un anno di forte rialzo e tende a premiare il lato long.
- Anni 2 e 3 (nov 2024 – ott 2025; nov 2025 – ott 2026) = verifica, una volta sola, con le regole congelate. I due anni si riportano separati: il 2 è di rialzo, il 3 di ribasso.
- Strategie lente, che usano l'anno 1 quasi solo per scaldare le medie: non si sceglie. Si verificano tutte le varianti dichiarate e il voto va alla loro media, non alla migliore.
- Parametri presi dalla letteratura senza ritocchi: si riporta anche il periodo intero, ma il voto resta sugli anni 2 e 3. Per una regola presa da un paper conta come verifica solo il periodo che il paper non copre (per Zarattini: da aprile 2025).
- Una volta aperti, gli anni 2 e 3 sono «bruciati» per quella famiglia. Una variante nata guardando quei risultati si giudica solo in avanti.
- Il sistema attuale è stato rifinito guardando tutti e 3 gli anni (filtro C, tetto dello stop al 12%). Per lui non esiste più un fuori campione storico pulito. Si fanno smontaggi e placebo, ma la prova vera è il paper trading dei prossimi mesi.

4) REGISTRO DELLE PROVE
Ogni variante eseguita va nel registro, anche se fallita e anche se l'ha fatta un altro agente, con data, regole e risultato. Si parte da quelle già fatte nella ricerca del desk: almeno 18 sui perpetui e 16 combinazioni di regole sullo spot. Budget della prima ondata: al massimo 60 varianti nuove in tutto.

5) PROVE DI ROBUSTEZZA (tutte obbligatorie)
- Costi doppi (0,62% andata e ritorno) e una candela di ritardo in più.
- Senza le 2 operazioni migliori (per le strategie a portafoglio: senza le 2 settimane migliori): ogni anno di verifica deve restare sopra zero.
- Senza la moneta migliore; e BTC con ETH da soli contro le altre 34.
- Vicini dei parametri (±20-25%): ci vuole un altopiano, non un picco isolato.
- Lato long e lato short separati. Risultati per anno e per stato di BTC (rialzo, ribasso, laterale).
- Strategie settimanali: tutti e 7 i giorni di ribilanciamento, riportando la media.
- Placebo, cioè la stessa strategia con entrate a caso: stessa frequenza, stesso lato, stessa gestione, 1.000 simulazioni. Per un filtro, il placebo toglie a caso la stessa quota di operazioni. La strategia deve stare sopra il 95° percentile del placebo; per i filtri basta il 90°.
- Strati di rischio: confronto a parità di esposizione media. Ridurre l'esposizione riduce sempre il calo, quindi non è un merito.

6) STATISTICA, SPIEGATA SEMPLICE
- Bootstrap a blocchi di 20 giorni: si rimescolano i rendimenti a blocchi per vedere quanto il risultato può cambiare per caso. Si riporta l'intervallo al 90%.
- Sharpe «sgonfiato» (Deflated Sharpe Ratio, DSR): è la probabilità che lo Sharpe sia vero e non solo il più fortunato di N prove. N viene dal registro.
- Con 5 varianti o più si calcola la probabilità di sovra-adattamento (PBO, metodo CSCV a 16 blocchi): deve stare sotto 0,2.
- La soglia dipende da quanto è forte la prova esterna. Con 2 anni di verifica, anche una strategia vera con Sharpe 1 fatica a superare una soglia severa.
  - Strategie con prove A o B: DSR ≥ 0,90 e t ≥ 1,3 (t misura quante volte il risultato supera il suo errore).
  - Strategie con prove C o D: DSR ≥ 0,95 e t ≥ 2.
  - Idee nate guardando i nostri dati: t ≥ 3 su un periodo non usato per trovarle, altrimenti solo verifica in avanti.
- Campione minimo: 100 operazioni o 30 eventi in giorni diversi. Sotto questa soglia è un'osservazione, non una strategia.

7) METRO DI PARAGONE, SEMPRE
- Confronti: BTC comprato e tenuto (+124%); il sistema attuale (+108,5%, calo 13,5%; anno per anno +11,2%, +14,8%, +63,4%); la liquidità; per le strategie neutrali al mercato, lo zero.
- Misure:
  - rendimento annuo e calo massimo;
  - MAR (rendimento annuo diviso calo massimo) e Sharpe;
  - settimana peggiore e tempo passato sotto il massimo;
  - numero di operazioni e R medio (guadagno medio in multipli del rischio);
  - costi e funding pagati;
  - correlazione con il sistema attuale.

8) VOTO
- Promossa: positiva in entrambi gli anni di verifica con costi doppi; passa le prove del punto 5 e le soglie del punto 6; migliora il MAR del fondo della scuola o aggiunge un flusso poco correlato (correlazione sotto 0,5). Va in tirocinio.
- Rimandata: positiva ma sotto una soglia statistica. Resta in paper al 25% del rischio, senza nuove varianti, e si giudica in avanti.
- Bocciata: negativa, oppure dipende da 2 operazioni o da una moneta. Va in biblioteca con il motivo e si ripropone solo con un'ipotesi nuova.

9) ESAME IN AVANTI (PAPER TRADING)
- Ogni promossa corre almeno 3 mesi e 50 operazioni (13 settimane per le settimanali) prima di avere il rischio pieno.
- Deve restare nella banda attesa:
  - rendimento cumulato sopra il 5° percentile del bootstrap della verifica, per lo stesso numero di operazioni;
  - calo non oltre 1,5 volte quello della verifica.
- Ogni mese lo Scettico confronta le operazioni in paper con quelle che il replay avrebbe fatto negli stessi giorni: segnali, prezzi, operazioni mancate. Confronta anche Bybit (che il desk legge) con Binance (su cui si fa la ricerca).
- Tre mesi servono a scoprire gli errori grossolani, non a dimostrare un vantaggio.

## 7. Come si discute, e i limiti onesti degli agenti

### Come si discute

Scopo: pensare meglio, non decidere il lato. La direzione la decidono le regole scritte. Il dibattito produce previsioni, ipotesi e domande.

1) Posizioni in privato. Prima di vedere gli altri, ogni agente scrive 3 righe in una chiamata separata: cosa dice oggi la sua regola, quanto è sicuro (una probabilità), cosa gli farebbe cambiare idea. Così non si copiano a vicenda.

2) Fatti prima delle opinioni. Il Cronista presenta calendario e notizie, ognuna con l'etichetta: fatto (fonte e ora), interpretazione, previsione (con probabilità). Le voci senza fonte si scrivono come «non verificata». La politica entra solo per i suoi effetti misurabili: tassi, dazi, regole e guerre contano per volatilità, liquidità e status legale. Niente tifo.

3) Un giro solo di risposte. Ogni agente legge la sua posizione. Chi critica un altro deve prima riassumere l'argomento migliore dell'altro, poi portare un numero o una prova.

4) Lo Scettico fa al massimo 2 domande del tipo: quale numero, quale prova, quante prove. Se tutti sono d'accordo, deve sostenere il contrario.

5) Cosa si può decidere. Niente cambia una posizione fuori dalle regole. Il dibattito può produrre solo tre cose:
- previsioni nel registro, con probabilità e data di verifica;
- ipotesi per la biblioteca, con la loro scheda d'esame;
- la richiesta al Guardiano di applicare una riduzione già prevista dalle regole.

6) Il Preside chiude in 5 righe: decisioni, ipotesi accettate, una domanda per il giorno dopo. Tutto va nel verbale con la data.

7) Limiti: al massimo 2 giri e un tempo fisso. Nelle conclusioni nessuna frase senza numero o fonte.

Nel consiglio del lunedì c'è in più «l'ora delle notizie». Il Cronista porta un tema (per esempio dazi, Fed, una nuova legge). Ogni agente dice come cambierebbe il rischio della sua strategia, non la direzione, e lascia una previsione verificabile.

### I limiti onesti

- Gli agenti non sono coscienti. Non provano paura né avidità e non «capiscono» il mercato. Sono lo stesso modello linguistico con istruzioni diverse, e il loro disaccordo è in parte recitato. La diversità vera sta nelle regole e nei dati a cui ognuno è legato, e nel fatto che le loro posizioni si scrivono in chiamate separate.
- Non imparano da soli: tra una sessione e l'altra ricordano solo quello che è scritto nei file. Anche il Preside è un modello: le decisioni importanti (soldi veri, cambi di rotta) restano del proprietario.
- Un modello linguistico può inventare numeri, fonti e spiegazioni convincenti dopo i fatti. Per questo nessun numero entra in una decisione se non è calcolato dal codice sui nostri dati, e ogni fonte citata va aperta.
- Non abbiamo prove che leggere notizie con un modello dia un vantaggio sul nostro orizzonte e con i nostri costi. Le notizie servono a capire e a registrare, non a fare trading, finché i numeri non dicono il contrario.
- Nessun risultato è garantito. Anche le strategie migliori hanno anni piatti e cali del 20-25%. Tre anni sono circa un ciclo: per molte idee non bastano per una prova forte. Le 36 monete sono quelle sopravvissute, quindi il passato sembra più bello del vero.
- Il paper trading non è il conto vero. Mancano lo slittamento dei crolli veri, gli ordini non eseguiti, il rischio dell'exchange (come FTX), i blocchi dell'API e le emozioni. Il rischio psicologico vero resta l'umano che spegne il sistema nel momento peggiore o lo forza.
- L'abbonamento ha limiti settimanali, condivisi con il desk, la scuola forex e gli altri usi del proprietario. Le chiamate vanno razionate: un agente senza novità non consuma; il modello leggero basta per le note quotidiane, il più forte serve solo per consiglio e scrutinio. Trading e controlli del rischio sono codice e devono funzionare anche quando l'IA non c'è.
- Rete: in questa sessione i lettori non hanno aperto i PDF. Alcuni numeri vanno verificati, e alcune analisi richiedono di abilitare domini nelle impostazioni di rete.
- Etica e legge: niente manipolazione, niente notizie false, niente pump and dump, niente spoofing. Non è consulenza finanziaria: sono soldi finti. Il passaggio a soldi veri è una decisione solo del proprietario, e prima va verificato quale exchange offre i perpetui a un privato in Italia.

## 8. I miti da bandire

- Mito: gli indicatori magici dei social (golden cross, RSI sotto 30 vuol dire compra, banda di Bollinger toccata vuol dire compra, il numero di Fibonacci giusto). Perché è falso: le medie mobili arrivano in ritardo e il golden cross su BTC si conta su circa 7 casi. RSI e bande, usati da soli, non battono chi compra e tiene. Medie diverse e rendimento passato sono la stessa informazione scritta in modi diversi (Levine e Pedersen). Le bande hanno perso circa metà della redditività dopo essere diventate famose.
- Mito: una strategia che vince il 90% delle volte è una miniera. Perché è falso: spesso sono tante piccole vincite e poche perdite enormi. Contano l'attesa per operazione dopo i costi, il calo massimo e il numero di operazioni (almeno 100).
- Mito: uno Sharpe sopra 2 in un paper, in un backtest o in un video vuol dire soldi sicuri. Perché è falso: va rifatto sui nostri dati, con i nostri costi e contando le prove. Il momentum pesato per volume (Sharpe 2,17) non ha repliche. Il fattore CTREND è diventato negativo nella replica indipendente.
- Mito: il totale dei 3 anni dice tutto. Perché è falso: il nostro +108,5% è +11%, +15% e +63% anno per anno. Senza l'anno 3 sarebbe circa +28% in due anni. Si guarda sempre anno per anno, per lato e senza le 2 operazioni migliori.
- Mito: un backtest bello è una prova anche se i parametri sono stati scelti sugli stessi dati. Perché è falso: è un allenamento, non un esame. Chi prova molte varianti ne trova sempre una vincente per caso.
- Mito: il momentum tra le cripto rende il 3% a settimana, basta comprare le vincenti e vendere le perdenti. Perché è falso: quel numero era lordo, su migliaia di monete piccole prima del 2019. Sui perpetual di Binance 2020-2026 il guadagno lordo è circa pari ai costi (Arefev).
- Mito: nelle cripto tutto torna indietro, quindi conviene comprare i perdenti della settimana. Perché è falso: vale per le monete piccole e illiquide. Sulle grandi come le nostre, da 1 a 4 settimane prevale il momentum (Fičura; Zaremba).
- Mito: più veloce è meglio (scalping, 15 minuti). Perché è falso: l'inversione a 15 minuti esiste, ma rende circa 1,3 punti base contro 5 di costo. Il trend intraday sulle cripto non era profittevole. Con lo 0,31% per giro la velocità costa.
- Mito: il cash and carry sul funding è reddito passivo senza rischio. Perché è falso: è un premio per il rischio di crollo. Il funding può girarsi, la gamba short può essere liquidata, l'exchange può chiudere le posizioni d'ufficio (ADL, 10 ottobre 2025) o fallire. E dal 2025 il premio si è quasi esaurito.
- Mito: funding allo 0,01% vuol dire long affollati; funding altissimo vuol dire massimo vicino; funding negativo vuol dire squeeze garantito; il funding più alto della classifica è l'affare migliore. Perché è falso: lo 0,01% è il valore base della formula. Il funding spiega quasi nulla del prezzo a breve (R² 0,003) e può restare estremo per mesi. I casi di funding negativo favorevoli sono solo 6. In cima alla classifica ci sono spesso monete in delisting.
- Mito: il rapporto long/short dei conti o dei top trader dice dove va il prezzo. Perché è falso: nessuno studio serio lo conferma. Nella nostra ricerca, usato come filtro, ha peggiorato i risultati: +46,1% andando contro la folla e +29,9% seguendo i grandi trader, contro +51,3% senza filtro.
- Mito: con avidità estrema si va short, con paura estrema si compra tutto subito. Perché è falso: l'avidità estrema è stata spesso seguita da altri rialzi, e la paura può durare mesi. Al massimo si riduce la leva, o si compra a piccole rate.
- Mito: i social e gli influencer anticipano il prezzo, oppure basta fare il contrario. Perché è falso: spesso è il prezzo che muove l'attenzione. Circa il 14% degli account cripto sono bot. L'ETF «contro Cramer» ha perso ed è stato chiuso. I contenuti finanziari di TikTok sono in gran parte fuorvianti. Servono a misurare l'euforia della folla, non come prova.
- Mito: entra appena esce il CPI o l'NFP, la direzione è sicura. Perché è falso: il prezzo incorpora la sorpresa in pochi secondi, e noi arriviamo dopo il salto con più slittamento. Le notizie macro spostano soprattutto la volatilità.
- Mito: Bitcoin protegge dall'inflazione ed è oro digitale nelle guerre. Perché è falso: dal 2022 ha reagito male ai CPI alti. La sua correlazione con il rischio geopolitico è circa zero. Gli shock del fine settimana con molta leva aperta portano crolli.
- Mito: i flussi ETF di oggi e le emissioni di Tether dicono dove andrà BTC domani. Perché è falso: i flussi seguono il prezzo (correlazione 0,54 con il passato, 0,03 con il futuro). Il caso Tether del 2017 era manipolazione, non un segnale.
- Mito: dopo una grande cascata di liquidazioni il fondo è fatto, quindi si compra subito. Perché è falso: nel giorno del crollo il movimento tende a continuare. Secondo K33, il mese dopo le liquidazioni più grandi è stato in media più debole del normale.
- Mito: lo stop protegge sempre (oppure, al contrario, lo stop rovina sempre). Perché è falso: lo stop aiuta solo se i rendimenti hanno persistenza, e va misurato (Kaminski e Lo). Con la leva serve comunque uno stop di emergenza.
- Mito: mediare al ribasso, la martingala e i grid bot sono sicuri perché il prezzo torna. Perché è falso: non creano nessun vantaggio. Un trend lungo fa saltare il conto, e con la leva si viene liquidati prima che il prezzo torni.
- Mito: puntare di più fa crescere più in fretta (Kelly pieno, 10-20% a operazione). Perché è falso: oltre il Kelly la crescita scende e il rischio di rovina sale. Già a Kelly pieno c'è circa il 50% di probabilità di dimezzare il conto prima o poi. In più il vantaggio stimato è quasi sempre gonfiato.
- Mito: rischiare l'1% su 10 altcoin vuol dire rischiare l'1%. Perché è falso: nei crolli le altcoin si muovono insieme a BTC. Dieci posizioni da 1% sono quasi una scommessa sola da diversi punti percentuali.
- Mito: halving, gap del CME, max pain e indicatori on-chain danno date e livelli sicuri. Perché è falso: gli halving sono solo 4 in tutta la storia. Una frase senza limite di tempo non si può smentire. Le soglie on-chain sono scelte guardando 3-4 cicli.
- Mito: il trend following è morto (oppure, al contrario, batte sempre chi compra e tiene). Perché è falso: negli anni 2010 i mercati si muovevano poco, e nel 2022 l'indice SG Trend ha fatto +27%. Ha anni magri ma non è sparito. Serve soprattutto a ridurre i crolli, non a battere sempre il mercato.
- Mito: una strategia famosa rende come nel libro. Perché è falso: dopo la pubblicazione rende meno. Esempi: le bande di Bollinger; il rialzo prima delle riunioni della Fed, sparito dal 2016; il breakout di Larry Williams, che lui stesso ha detto non funzionare più come prima.
- Mito: la volatilità obiettivo aumenta sempre il rendimento. Perché è falso: taglia le code, ma lo Sharpe migliora solo a volte (53 strategie su 103 fuori campione).
- Mito: gli agenti IA capiscono il mercato, sono coscienti o imparano da soli. Perché è falso: sono lo stesso modello con istruzioni diverse e ricordano solo ciò che è scritto. Possono inventare numeri e spiegazioni convincenti. Valgono quanto il metodo che li tiene a bada.
- Mito: battere BTC in rendimento è l'unico obiettivo. Perché è falso: contano il rendimento per unità di rischio e il calo massimo che si riesce davvero a sopportare senza spegnere il sistema.

## 9. Da leggere

- Bailey e López de Prado, The Deflated Sharpe Ratio (2014). https://papers.ssrn.com/abstract=2460551 Come correggere lo Sharpe per il numero di prove: lettura obbligatoria per lo Scettico.
- Bailey, Borwein, López de Prado, Zhu, The Probability of Backtest Overfitting. https://escholarship.org/content/qt4w1110bb/qt4w1110bb.pdf Il metodo CSCV per capire se la variante migliore è solo fortunata.
- Harvey, Liu, Zhu, ...and the Cross-Section of Expected Returns (NBER w20592). https://www.nber.org/papers/w20592 Perché con tante prove la soglia va alzata a t > 3.
- Hurst, Ooi, Pedersen, A Century of Evidence on Trend-Following Investing (AQR). https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing Il trend dal 1880: costanza, comportamento nelle crisi, cali fino al 25%.
- Moskowitz, Ooi, Pedersen, Time Series Momentum. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2089463 Il segnale di base del trend e la dimensione per volatilità.
- Levine e Pedersen, Which Trend Is Your Friend? https://research-api.cbs.dk/ws/portalfiles/portal/60084063/lasse_heje_pedersen_et_al_which_trend_is_your_friend_publishersversion.pdf Medie mobili e rendimenti passati sono la stessa cosa: si sceglie l'orizzonte, non la formula.
- Harvey et al., The Impact of Volatility Targeting (Man Group). https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf Cosa fa davvero la volatilità obiettivo: meno code ovunque, Sharpe migliore solo a volte.
- Cederburg, O'Doherty, Wang, Yan, On the Performance of Volatility-Managed Portfolios. https://www.lehigh.edu/~xuy219/research/COWY.pdf La replica fuori campione: come si sgonfia un risultato famoso.
- Daniel e Moskowitz, Momentum Crashes (NBER w20439). https://www.nber.org/papers/w20439 Quando e perché il momentum crolla, e come ridurre l'esposizione negli stati di panico.
- Kaminski e Lo, When Do Stop-Loss Rules Stop Losses? https://dspace.mit.edu/handle/1721.1/114876 Quando lo stop aiuta e quando costa.
- MacLean, Thorp, Ziemba, Good and bad properties of the Kelly criterion. https://www.stat.berkeley.edu/~aldous/157/Papers/Good_Bad_Kelly.pdf Perché si usa solo una frazione del Kelly.
- Liu e Tsyvinski, Risks and Returns of Cryptocurrency (NBER w24877). https://www.nber.org/system/files/working_papers/w24877/w24877.pdf Momentum nel tempo e attenzione degli investitori sulle cripto.
- Liu, Tsyvinski, Wu, Common Risk Factors in Cryptocurrency (NBER w25882). https://www.nber.org/papers/w25882 Mercato, dimensione e momentum tra le monete. Attenzione: campione vecchio, monete piccole.
- Fičura e Colak, Impact of Size and Volume on Cryptocurrency Momentum and Reversal. https://wp.ffu.vse.cz/pdfs/wps/2023/01/03.pdf Momentum nelle monete grandi, inversione nelle piccole: il segno dipende dalla dimensione.
- Zarattini, Pagani, Barbon, Catching Crypto Trends (SSRN 5209907). https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5209907 Canali di Donchian a più orizzonti sulle cripto, con i costi. È la base di E02-T2.
- Arefev, Cross-Sectional Momentum in Cryptocurrency: a net-of-costs replication on Binance perpetuals, SSRN, da verificare. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7404139 Il test più vicino al nostro universo: netto circa zero.
- Schmeling, Schrimpf, Todorov, Crypto carry (BIS WP 1087). https://www.bis.org/publ/work1087.htm Perché il funding alto misura la leva della folla e anticipa i crolli.
- He, Manela, Ross, von Wachter, Fundamentals of Perpetual Futures. https://arxiv.org/abs/2212.06888 Come funzionano funding e prezzo dei perpetual, e quanto si è ristretto l'arbitraggio.
- Koijen, Moskowitz, Pedersen, Vrugt, Carry. https://research-api.cbs.dk/ws/files/57294842/lasse_heje_pedersen_et_al_carry_acceptedmanuscript.pdf Il carry in tutti i mercati, e perché perde nelle crisi.
- Nagel, Evaporating Liquidity (NBER w17653). https://www.nber.org/papers/w17653 Il ritorno alla media come compenso per chi fornisce liquidità, più alto nella turbolenza.
- Auer e Claessens, Regulating cryptocurrencies: assessing market reactions (BIS 2018). https://www.bis.org/publ/qtrpdf/r_qt1809f.htm Quali notizie di regolamentazione contano davvero: per il Cronista.
- Benigno e Rosa, Is There a Bitcoin-Macro Disconnect? (NY Fed). https://libertystreeteconomics.newyorkfed.org/2023/02/is-there-a-bitcoin-macro-disconnect/ Quanto poco BTC reagisce alle notizie macro, CPI a parte.
- Kakhbod, Kazempour, Livdan, Schuerhoff, Finfluencers. https://www.akakhbod.com/uploads/1/3/9/6/13965273/finfluencers.pdf Perché seguire gli influencer finanziari costa.
- Mackay, Extraordinary Popular Delusions and the Madness of Crowds (1841, pubblico dominio). https://www.gutenberg.org/ebooks/24518 Le manie della folla di sempre: utile per riconoscere l'euforia.
- Binance, Introduction to Binance Futures Funding Rates. https://www.binance.com/en/support/faq/360033525031 Orari e valore base del funding: serve per allineare bene i dati.
