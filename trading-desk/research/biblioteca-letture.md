# Le letture della biblioteca

Quello che hanno trovato gli otto lettori, ognuno nel suo campo, prima della sintesi del
Preside (`biblioteca.md`). Per ogni strategia ci sono le regole, le prove con le fonti, come
si comporta fuori campione e come fallisce. I lettori non hanno potuto aprire i PDF: i
numeri vengono da abstract ed estratti.

## 1. Trend following e momentum nel tempo (time-series momentum, medie mobili, Donchian/Turtle, volatility targeting, trend following sulle criptovalute)

Nota di metodo: in questa sessione WebFetch era bloccato dalla rete. Gli host aqr.com, pages.stern.nyu.edu, fairmodel.econ.yale.edu e alphaarchitect.com non si risolvevano, quindi non ho potuto aprire i PDF completi. Ho letto 18 fonti diverse tramite WebSearch, cioè abstract, pagine SSRN/arXiv/riviste ed estratti delle pagine dei gestori. Quando un numero viene solo da un riassunto di terzi lo dico. Le regole d'uscita esatte di Zarattini e i parametri delle Turtle vanno verificati aprendo i PDF.

1) Il trend following è tra le anomalie più documentate. AQR (Hurst, Ooi, Pedersen) ricostruisce dal 1880 una strategia su 67 mercati: segnali a 1, 3 e 12 mesi, ogni mercato pesato per la sua volatilità. Il risultato è positivo in modo costante per circa 110 anni e positivo in 8 delle 10 peggiori crisi del portafoglio 60/40. Ci sono stati però cali fino al 25% durati a lungo. Lo studio TSMOM di Moskowitz, Ooi e Pedersen su 58 future trova Sharpe di circa 1,2-1,3 con 12 mesi di lookback e 1 mese di tenuta, al lordo dei costi. Il trend dura circa un anno e poi si inverte in parte.

2) Il filtro scelto conta poco. Medie mobili incrociate e rendimento passato sono rappresentazioni equivalenti (Levine e Pedersen, 2016). Anche sulle cripto i profitti non dipendono dal tipo di media (Rozario et al.). Contano di più l'orizzonte, la dimensione della posizione legata alla volatilità e la diversificazione tra orizzonti e mercati.

3) Il volatility targeting riduce le code e i cali massimi su tutti gli asset. Migliora lo Sharpe solo sugli asset di rischio come azioni e credito, dove agisce l'effetto leva (Harvey et al., 60 asset dal 1926).

4) Il trend following ha periodi lunghi e brutti. Negli anni 2010 ha reso poco perché i mercati si muovevano meno (AQR, Babu et al.), non perché il trend fosse sparito. Nel 2022 l'indice SG Trend ha fatto +27%, il miglior anno dal 2000.

5) Le cripto. La momentum time-series a orizzonte giornaliero e settimanale è significativa (Liu e Tsyvinski) ed è più forte nei mercati rialzisti (Han, Kang, Ryu). Il rapporto tra prezzo e media mobile a 5-100 giorni prevede il rendimento giornaliero di BTC anche fuori campione (Detzel et al., Financial Management). Il trend following su BTC dal 2011 al 2019 ha avuto Sharpe tra 0,5 e 1,5, mentre l'intraday non era profittevole (Rozario et al.). Un insieme di canali di Donchian a più lookback, con posizioni scalate per volatilità, su un paniere delle 20 cripto più liquide dichiara Sharpe sopra 1,5 al netto dei costi (Zarattini, Pagani, Barbon, 2025). Il momentum cross-sectional sulle cripto è più debole e instabile (Grobys e Sapkota: non significativo 2014-2018).

6) Il trend following è soprattutto uno strumento per ridurre il rischio, non per battere sempre il comprato e tenuto. La regola dei 10 mesi di Faber resta poco sotto il buy and hold in rendimento con circa metà del calo massimo. Sulla media a 200 giorni di BTC 25 incroci al rialzo su 36 sono falliti entro 30 giorni, e la regola ha battuto il semplice possesso solo in pochi anni come il 2022.

Per il nostro desk: il sistema attuale (+108% con calo massimo del 13,5%, contro BTC +124% con cali molto più grandi) è coerente con questa letteratura. Rende un po' meno ma con molto meno rischio. Le prove più solide dicono di aggiungere un motore lento (giornaliero/settimanale) a più orizzonti e scalato per volatilità, che costa meno in commissioni e si diversifica col motore a 4 ore. Dicono anche di verificare se il lato short regge davvero, perché l'effetto è più forte nei mercati in salita.

### Momentum intraday di BTC: la prima mezz'ora predice l'ultima (Shen, Urquhart, Wang)

Priorità 1. Mercati: BTC.. Provabile con i nostri dati: no (Barre a 30 minuti o meno, che non abbiamo.).

Il rendimento dell'inizio della sessione predice quello della fine, perché qualcuno fornisce liquidità in ritardo. Su BTC la sessione è definita dal volume.

**Regole.** Non programmabile in modo fedele: servono barre a 30 minuti. Con le 4 ore si potrebbe provare solo un'approssimazione (il rendimento della prima candela di 4 ore della giornata UTC predice l'ultima), ma non sarebbe lo stesso esperimento.

**Prove.**

- [Shen, Urquhart, Wang - Bitcoin intraday time-series momentum (Financial Review 2022)](https://centaur.reading.ac.uk/100181/) (accademica): Il rendimento della prima mezz'ora predice in modo positivo quello dell'ultima mezz'ora, dentro e fuori campione. I guadagni sono maggiori nei periodi di discesa.
- [Rozario et al. - A Decade of Evidence of Trend Following Investing in Cryptocurrencies (arXiv 2009.12155)](https://arxiv.org/abs/2009.12155) (accademica): Il trend following intraday sulle cripto non era profittevole, a differenza di quello giornaliero.

**Fuori campione.** Effetto pubblicato nel 2022 e non verificato dopo. Le prove intraday sono in contrasto tra loro.

**Come fallisce.** Costi altissimi rispetto al vantaggio atteso, granularità dei dati insufficiente.

### Momentum time-series pesato per volume (Huang, Sangiorgi, Urquhart), settimanale long/short

Priorità 2. Mercati: Cripto liquide.. Provabile con i nostri dati: sì (Candele con volume, aggregate a settimana, e funding. Basta questo.).

Un rendimento accompagnato da volume alto contiene più informazione e meno rumore, quindi il trend è più affidabile. Le monete vincenti con volume alto continuano, le perdenti con volume alto continuano a scendere.

**Regole.** Ogni settimana (lunedì 00:00 UTC) calcolare per ogni moneta il rendimento a 1 settimana (variante 4 settimane). Long sulle monete con rendimento positivo e short su quelle con rendimento negativo, cioè segno time-series e non classifica. Il peso è proporzionale al volume in USDT della settimana, normalizzato fra i long e fra gli short, con massimo 20% per moneta. Tenere 1 settimana. Il dettaglio esatto della costruzione va verificato sul paper (SSRN 4825389).

**Prove.**

- [Huang, Sangiorgi, Urquhart - Cryptocurrency Volume-Weighted Time Series Momentum (SSRN 4825389)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4825389) (accademica): I portafogli winner-minus-loser pesati per volume dichiarano 0,94% al giorno con Sharpe annuo di 2,17. Battono le altre strategie TSMOM e non sono spiegati da mercato, size, momentum o wash trading.

**Fuori campione.** Nessuna replica indipendente trovata. Un rendimento di 0,94% al giorno con Sharpe 2,17 è un numero da trattare con molto sospetto finché non regge sui nostri dati con i nostri costi.

**Come fallisce.** Il volume delle altcoin può essere gonfiato. Rischio di crollo del momentum nei rimbalzi. Il lato short sulle piccole monete paga funding e salti violenti.

### Turtle System 2 adattato (rottura 55 giorni, uscita 20 giorni, stop 2N, unità all'1%)

Priorità 3. Mercati: Nati per future su materie prime, valute, obbligazioni e indici (anni 80). Da adattare a BTC e altcoin.. Provabile con i nostri dati: sì (Candele giornaliere OHLC dalle 4 ore. Basta questo.).

Rotture di massimi e minimi lunghi con dimensione legata alla volatilità (N, cioè l'ATR a 20 giorni). Si accettano molte piccole perdite per tenere i pochi trend enormi. È un sistema famoso e pubblico: serve soprattutto come riferimento per giudicare il nostro sistema.

**Regole.** Daily. N = ATR a 20 giorni (media esponenziale o semplice: le fonti non concordano, testare entrambe). Entrata long se la chiusura (o il massimo intraday) supera il massimo dei 55 giorni precedenti, short se rompe il minimo. Unità = 1% del capitale / (N x valore per punto). Piramidazione: aggiungere 1 unità ogni 0,5N a favore, massimo 4 unità. Stop a 2N dall'ultima entrata. Uscita long sul minimo dei 20 giorni, short sul massimo dei 20 giorni. Variante System 1: rottura a 20 giorni, uscita a 10 giorni, e il segnale si salta se la rottura precedente sarebbe stata vincente. Massimo complessivo 12 unità nello stesso verso su monete correlate. Parametri da riscontrare sul documento originale di originalturtles.org.

**Prove.**

- [The Original Turtle Trading Rules (OriginalTurtles.org, 2003, distribuito gratis dagli autori)](https://ritholtz.com/2005/05/turtle-rules-discipline-and-consistency-in-trading) (libro): Il documento originale è stato pubblicato gratuitamente nel 2003 (link a originalturtles.org/docs/turtlerules.pdf) e descrive due sistemi, S1 più rapido e aggressivo e S2. Non ho potuto aprire il PDF.
- [TheTurtleTrader - The Original Turtle Trading Rules Explained (sintesi)](https://www.theturtletrader.com/turtle-trading-rules/) (aneddotica): Rotture a 20 e 55 giorni, filtro su S1, N come ATR a 20 giorni, stop 2N, aggiunte ogni mezzo N, uscite a 10 e 20 giorni. Le fonti secondarie concordano sul nucleo delle regole.

**Fuori campione.** Successo documentato negli anni 80 solo in modo aneddotico (racconti di Faith e Covel). Non ho trovato test rigorosi fuori campione dopo il 2003 né sulle cripto. Va visto come confronto, non come promessa.

**Come fallisce.** Molte rotture false: tassi di vincita bassi, intorno al 30-40% o meno, e lunghe serie di perdite. La piramidazione su altcoin correlate concentra il rischio. Le rotture a 55 giorni sono rare in 3 anni di dati. I costi di slippage salgono sulle rotture affollate.

### Rottura del massimo a 10 o 20 giorni su BTC (Padysak-Vojtko / Quantpedia)

Priorità 3. Mercati: BTC (dati Gemini nello studio).. Provabile con i nostri dati: sì (BTC giornaliero dalle 4 ore. Basta questo.).

Dopo un nuovo massimo locale BTC tende a continuare (momentum di breve). Dopo un minimo locale comprare è pericoloso.

**Regole.** Daily su BTC. Long alla chiusura se oggi la chiusura è il massimo degli ultimi 10 giorni (variante 20 giorni). Tenere 1 giorno, poi rinnovare se la condizione è ancora vera, altrimenti uscire. Nessun short sui minimi: le fonti dicono che sui minimi la strategia è pericolosa, con cali oltre l'80%. Dimensione fissa oppure a volatilità obiettivo. Estensione da testare: la stessa regola su ETH e SOL.

**Prove.**

- [Quantpedia - Revisiting Trend-following and Mean-reversion Strategies in Bitcoin (Beluská, Vojtko 2024)](https://quantpedia.com/revisiting-trend-following-and-mean-reversion-strategies-in-bitcoin/) (pratico con backtest): Strategia long sui massimi a 10 giorni ancora viva ed efficace nel 2024. Il massimo a 10 giorni rende un po' meno di quello a 20 giorni ma vale comunque.
- [Quantpedia - Trend-following and Mean-reversion in Bitcoin](https://quantpedia.com/trend-following-and-mean-reversion-in-bitcoin/) (pratico con backtest): Forte momentum dopo i massimi locali a x giorni. Sui minimi locali le strategie sono pericolose, con cali oltre l'80%.

**Fuori campione.** Lo studio originale è dell'aprile 2022. La revisione del 2024 dice che regge, ma è degli stessi autori e non è una replica indipendente. Mancano le cifre esatte di rendimento e calo, che non ho trovato.

**Come fallisce.** Il segnale sta su un solo asset. Molte entrate e uscite, quindi costi alti con i nostri 0,31% andata e ritorno. Si sovrappone molto al nostro sistema a 4 ore.

### Filtro di regime su BTC: prezzo sopra o sotto la media mobile (giornaliera o settimanale)

Priorità 4. Mercati: BTC come interruttore per tutto il paniere cripto. Per Faber anche azioni, REIT e materie prime con la media a 10 mesi.. Provabile con i nostri dati: sì (Solo BTC giornaliero e settimanale ricavato dalle 4 ore, più il sistema attuale per il confronto.).

Il rapporto tra prezzo e media mobile riassume l'apprendimento graduale degli investitori su un asset con fondamentali difficili da valutare (modello di equilibrio di Detzel et al.). Usarlo come interruttore riduce l'esposizione nei mercati orso. Serve a togliere i cali grandi, non a guadagnare di più.

**Regole.** Calcolare su BTC giornaliero R_L = close / SMA_L per L in {20, 50, 100}. Regime = media dei tre segni (R_L > 1). Regime >= +1/3 permette solo long sulle altcoin, regime <= -1/3 permette solo short o resta flat (variante da confrontare), altrimenti flat o dimezzare il rischio. Variante settimanale: chiusura settimanale di BTC sopra la SMA a 20 settimane. Per ridurre i whipsaw: conferma su 2 chiusure consecutive, oppure banda del 2% intorno alla media. Confronto diretto con la regola attuale (BTC sale -> long, BTC scende -> short), tenendo fisso tutto il resto del sistema a 4 ore.

**Prove.**

- [Detzel, Liu, Strauss, Zhou, Zhu - Learning and predictability via technical analysis: Evidence from bitcoin and stocks with hard-to-value fundamentals (Financial Management 2021)](https://onlinelibrary.wiley.com/doi/epdf/10.1111/fima.12310) (accademica): I rapporti tra prezzo e media mobile (5-100 giorni) predicono i rendimenti giornalieri di BTC dentro e fuori campione. Una strategia long BTC sopra la media e in liquidità sotto ha valore economico.
- [Faber - A Quantitative Approach to Tactical Asset Allocation (rivisto dopo 10 anni)](https://allocatortraining.com/wp-content/uploads/2023/06/A-Quantitative-Approach-to-Tactical-Asset-Allocation.pdf) (pratico con backtest): La media a 10 mesi è una tecnica di riduzione del rischio più che di aumento del rendimento. Una ricostruzione indipendente su SPY dà 9,2% annuo contro 10,8% del buy and hold, ma calo massimo del 25,6% contro 55,2%.
- [Coinpaprika - Two Out of Three Crosses Fail. Here's What the 200-Day Line Is Good For.](https://coinpaprika.com/education/bitcoin-200-day-moving-average-backtest) (pratico con backtest): Dal 2014, 25 incroci al rialzo su 36 della media a 200 giorni di BTC sono tornati sotto entro 30 giorni. La regola ha ridotto il calo peggiore dall'83% al 65%, ma ha battuto il possesso solo in pochi anni come 2014-15, 2018 e 2022.

**Fuori campione.** Faber pubblica nel 2005, e il periodo 2006-2012 fuori campione ha confermato rischio minore e calo più piccolo. Detzel dichiara predicibilità fuori campione su BTC, ma su un campione precedente al 2020. Sulla media a 200 giorni di BTC dal 2019 al 2025 la regola ha reso meno del possesso in quasi tutti gli anni: utile come freno, non come motore.

**Come fallisce.** Mercati laterali intorno alla media (2021, 2024 e 2025 secondo Coinpaprika). Ritardo all'ingresso dopo un minimo a V. Le altcoin possono avere un ciclo proprio diverso da BTC. Il lato short attivato dal filtro paga le inversioni violente.

### Volatility targeting come strato sopra il sistema attuale

Priorità 4. Mercati: Asset di rischio: azioni, credito e probabilmente cripto. Beneficio sullo Sharpe trascurabile su obbligazioni, valute e materie prime.. Provabile con i nostri dati: sì (Equity del sistema attuale e candele di BTC. Basta questo.).

La volatilità è prevedibile nel breve (si raggruppa nel tempo), i rendimenti molto meno. Ridurre l'esposizione quando la volatilità sale taglia le code. Negli asset di rischio la volatilità alta tende a coincidere con i cali (effetto leva), quindi lo Sharpe migliora.

**Regole.** Tenere il sistema attuale a 4 ore com'è (rottura di volume, stop a 3 ATR, target 3R, trailing). Moltiplicare il rischio per operazione (oggi 1%) per k = clip(vol_obiettivo / vol_realizzata_portafoglio, 0,5, 1,5). vol_realizzata_portafoglio = deviazione standard EWMA (span 20 giorni) dei rendimenti giornalieri dell'equity, annualizzata. vol_obiettivo = mediana storica della vol del sistema (circa 15-20% annuo). Variante B: usare la volatilità a 30 giorni di BTC invece di quella dell'equity. Aggiornamento una volta al giorno. Misure di confronto: Sharpe, calo massimo, MAR (rendimento annuo diviso calo massimo), Calmar.

**Prove.**

- [Harvey, Hoyle, Korgaonkar, Rattray, Sargaison, Van Hemert - The Impact of Volatility Targeting (JPM 2018, Man Group)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf) (gestore o exchange): 60 asset dal 1926. Il targeting migliora lo Sharpe solo per gli asset di rischio, come le azioni USA (da 0,40 a 0,48-0,51), per effetto leva. Riduce le code e la volatilità della volatilità su tutti gli asset e il calo massimo dei portafogli bilanciati.
- [Chassang et al. - Managing a Crypto-Currency Portfolio via MinMax Drawdown Control](https://www.sylvainchassang.org/assets/papers/crypto_portfolio_management.pdf) (accademica): Su BTC sia il controllo della volatilità sia il controllo del drawdown migliorano molto il rapporto rischio/rendimento rispetto al possesso. Per avere drawdown bassi però il controllo di volatilità deve ridurre parecchio l'esposizione e perde rendimento. Cifre lette da una tabella non leggibile per intero.

**Fuori campione.** Prove ampie e di lungo periodo sugli asset tradizionali. Sulle cripto le prove sono poche, su campioni corti e senza costi realistici. Nessuno studio peer-reviewed specifico sul volatility targeting di BTC tra quelli trovati.

**Come fallisce.** Crolli improvvisi da volatilità bassa (gap): il targeting arriva tardi. Più turnover, quindi più costi. Riduce il rendimento assoluto se il mercato sale con volatilità alta, come nei rally delle altcoin.

### TSMOM multi-orizzonte giornaliero con volatility targeting sul paniere dei 36 perpetual

Priorità 5. Mercati: Futures su indici azionari, obbligazioni, valute e materie prime (prove centenarie). Cripto: BTC, ETH e paniere di altcoin liquide (prove 2011-2022, più deboli e su campioni corti).. Provabile con i nostri dati: sì (Candele giornaliere ricavate dalle 4 ore per le 36 monete, funding a 8 ore per il costo di mantenimento, commissioni e slippage già definite. Basta questo.).

Il prezzo incorpora le notizie lentamente (sotto-reazione), poi la folla insegue (effetto gregge). Chi copre il rischio paga un premio a chi si prende il rischio di direzione. Il risultato è che i rendimenti passati da 1 a 12 mesi predicono il segno dei rendimenti futuri. Sulle cripto l'orizzonte utile è più corto: settimane, non mesi. Scalare per la volatilità dà a ogni moneta lo stesso peso di rischio, così SOL o ORDI non dominano il portafoglio rispetto a BTC.

**Regole.** Dati: dalle candele a 4 ore costruire la chiusura giornaliera alle 00:00 UTC. Segnale per ogni moneta i: s_i = media dei segni di sign(close_t / close_{t-L} - 1) per L in {7, 14, 28, 56, 112} giorni, quindi un valore tra -1 e +1. Variante long-only: s_i = max(s_i, 0). Volatilità: sigma_i = deviazione standard EWMA (span 30 giorni) dei rendimenti giornalieri, annualizzata con sqrt(365). Dimensione: nozionale_i = capitale x s_i x (0,20 / N_attive) / sigma_i, con volatilità obiettivo del portafoglio intorno al 20% annuo (da tarare). Tetto: leva totale lorda 2x e massimo 25% del capitale su una sola moneta. Ribilanciamento una volta al giorno alle 00:00 UTC, solo se la nuova posizione differisce di oltre il 25% dalla vecchia (banda per ridurre il turnover). Uscita: nessuno stop fisso, la posizione si riduce o si inverte quando il segnale cambia. Stop di emergenza a 4 sigma giornaliere. Costi da includere: 0,055% per lato, slippage 0,1%, funding ogni 8 ore sulla posizione aperta. Variante settimanale: stessi passi con ribilanciamento il lunedì, per confrontare il turnover.

**Prove.**

- [Hurst, Ooi, Pedersen - A Century of Evidence on Trend-Following Investing (AQR, Journal of Portfolio Management 2017)](https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing) (accademica): Segnali a 1, 3 e 12 mesi su 67 mercati, positivi in modo costante dal 1880 per circa 110 anni. Positivi in 8 delle 10 peggiori crisi di un portafoglio 60/40. Cali fino al 25% (letto tramite estratti e sintesi).
- [Moskowitz, Ooi, Pedersen - Time Series Momentum (Journal of Financial Economics 2012), SSRN 2089463](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2089463) (accademica): 58 future liquidi. Il lookback di 12 mesi con 1 mese di tenuta dà Sharpe superiore a 1,2 (Quantpedia riporta 1,31, al lordo dei costi). Il trend persiste circa 12 mesi e poi si inverte in parte.
- [Liu, Tsyvinski - Risks and Returns of Cryptocurrency (NBER w24877)](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf) (accademica): Forte momentum time-series nelle cripto agli orizzonti giornaliero e settimanale. Anche le misure dell'attenzione degli investitori predicono i rendimenti.
- [Han, Kang, Ryu - Time-Series and Cross-Sectional Momentum in the Cryptocurrency Market (SSRN 4675565)](https://acfr.aut.ac.nz/__data/assets/pdf_file/0009/918729/Time_Series_and_Cross_Sectional_Momentum_in_the_Cryptocurrency_Market_with_IA.pdf) (accademica): Forte evidenza di momentum time-series nelle cripto con ipotesi realistiche, più marcato quando il mercato è rialzista. Non ho letto i dettagli dei lookback.
- [Baltas, Kosowski - Demystifying Time-Series Momentum Strategies (CME / SSRN 2140091)](https://www.cmegroup.com/education/files/demystifiing-time-series-momentum-strategies.pdf) (accademica): Stimatori di volatilità più efficienti e regole di trend migliori riducono il turnover di oltre un terzo senza peggiorare la performance in modo significativo. La debolezza dopo il 2008 viene dall'aumento delle correlazioni tra mercati, e una leva che tiene conto delle correlazioni la migliora.

**Fuori campione.** Lo studio AQR estende all'indietro (1880-1985) un effetto scoperto dopo, quindi è una prova fuori campione nel passato. Dopo la pubblicazione del 2012 il decennio 2010 è stato debole: secondo Babu et al. (AQR) la causa sono movimenti di mercato più piccoli, non la scomparsa dell'effetto. Nel 2022 l'indice SG Trend ha fatto +27,35%. Sulle cripto le prove coprono circa 2014-2022 e confermano il momentum time-series. Non ho trovato una verifica indipendente sul periodo 2023-2026, che è esattamente il nostro periodo di test.

**Come fallisce.** Mercati laterali con falsi segnali (whipsaw). Inversioni a V rapide come novembre 2022 (SG Trend oltre -6% nel mese). Le altcoin sono molto correlate fra loro, quindi la diversificazione vera è minore di quella che 36 monete fanno sembrare. Il lato short soffre nei rimbalzi violenti e paga funding nei mercati euforici. Con soli 3 anni di dati il campione copre circa un ciclo. Il paniere ha bias di sopravvivenza (le monete fallite non ci sono).

### Insieme di canali di Donchian a più lookback (stile Zarattini-Pagani-Barbon), long-only, scalato per volatilità

Priorità 5. Mercati: BTC e altcoin liquide (top 20 per liquidità).. Provabile con i nostri dati: sì (Candele giornaliere dalle 4 ore e volume per scegliere le monete più liquide. Basta questo.).

Una rottura dei massimi di N giorni segnala che domanda nuova ha assorbito tutta l'offerta di quel periodo. Combinare molti N evita di scommettere su un solo parametro (meno overfitting) e cattura trend di velocità diverse. Il long-only sfrutta il fatto che nelle cripto il momentum è più forte al rialzo.

**Regole.** Daily, alla chiusura delle 00:00 UTC. Per ogni L in {10, 20, 30, 60, 90, 150} giorni (L = 250 e 360 sono nell'articolo ma richiedono un anno di riscaldamento dati, quindi testarli solo come variante): sotto-segnale = 1 se la chiusura di oggi supera il massimo delle chiusure dei precedenti L giorni, e resta 1 finché la chiusura non scende sotto il punto medio del canale (max+min)/2 di L giorni. A quel punto torna a 0. Segnale moneta = media dei 6 sotto-segnali (da 0 a 1). Dimensione = segnale x capitale x (vol obiettivo per moneta) / sigma_i, con sigma_i EWMA 30 giorni. Paniere: tutte le 36 monete, oppure solo le 20 più liquide per volume a 30 giorni. Massimo 20% del capitale per moneta. Ribilanciamento giornaliero con banda del 20%. ATTENZIONE: la regola d'uscita sul punto medio è la mia lettura della sintesi CXO e va verificata sul PDF.

**Prove.**

- [Zarattini, Pagani, Barbon - Catching Crypto Trends; A Tactical Approach for Bitcoin and Altcoins (SSRN 5209907, Swiss Finance Institute RP 25-80)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5209907) (accademica): Insieme di modelli Donchian a più lookback combinati in un segnale, con dimensione basata sulla volatilità. Su un portafoglio rotazionale delle 20 cripto più liquide dichiara Sharpe sopra 1,5 e alpha annuo del 10,8% rispetto a BTC, al netto dei costi.
- [CXO Advisory - Crypto-asset Trend-following Strategies (sintesi dello studio)](https://www.cxoadvisory.com/technical-trading/crypto-asset-trend-following-strategies/) (pratico con backtest): Lookback di 5, 10, 20, 30, 60, 90, 150, 250 e 360 giorni su massimi/minimi delle chiusure e punti medi, con pesi uguali. Dati senza bias di sopravvivenza su 21.616 cripto da gennaio 2010 a marzo 2025. Costi testati: 0,10%, 0,25% e 0,50%.

**Fuori campione.** Lo studio è del 2025 e il suo campione arriva a marzo 2025. Non ho trovato replicazioni indipendenti. Una nota su GitHub (secondaria) segnala incoerenze tra alcune tabelle del paper (MAR 0,88 contro 1,15). Il nostro periodo da aprile 2025 a ottobre 2026 sarebbe un vero test fuori campione.

**Come fallisce.** Lookback lunghi con soli 3 anni di dati: pochi segnali e tanto riscaldamento. Costi più alti del caso base dello studio (noi circa 0,31% andata e ritorno). Il long-only resta fermo in liquidità nei mercati ribassisti e non guadagna. Altcoin con code di liquidità.

### Miti

- **Il golden cross (media a 50 che incrocia quella a 200) su Bitcoin ha il 100% di vincite: compra e vai (TikTok e video social).** Su BTC daily il segnale è apparso circa 7 volte dal 2010 e 5 sono state seguite da rialzi forti: campione troppo piccolo. A febbraio 2020 un golden cross è stato seguito da un crollo. Un test sistematico trova che il death cross ha fatto meglio del golden cross e che il vantaggio rispetto alla frequenza base (circa 49,9% di rialzi a 7 giorni) è di pochi punti. Le medie mobili sono indicatori in ritardo e lavorano su molti trade, non su un segnale magico.
- **Il trend following è morto (dopo gli anni 2010).** AQR scompone i rendimenti e trova che negli anni 2010 i mercati si erano mossi meno del solito. La capacità di catturare i trend e la diversificazione erano rimaste intatte. Nel 2022 l'indice SG Trend ha fatto +27,35%, il miglior anno dal 2000. Il trend following ha periodi lunghi e magri, ma non è sparito.
- **Il trend following su Bitcoin rende il 255% l'anno.** Il 255% è un risultato walk-forward con parametri ottimizzati per lo Sharpe, su un solo asset, nel periodo 2011-2019 in cui BTC era piccolo e saliva in modo enorme. Lo stesso studio riporta Sharpe tipici tra 0,5 e 1,5. Non è un rendimento da aspettarsi oggi.
- **La media mobile giusta (200 giorni, EMA invece di SMA, il numero magico di Fibonacci) è il segreto.** Levine e Pedersen dimostrano che medie mobili incrociate, rendimento passato e altri filtri lineari sono rappresentazioni equivalenti. Rozario et al. trovano profitti simili qualunque sia il tipo di media. Il vantaggio viene dall'orizzonte, dalla diversificazione e dalla gestione del rischio, non dalla formula.
- **Una regola di media mobile batte il comprato e tenuto in rendimento.** Faber stesso descrive la sua media a 10 mesi come riduzione del rischio, non aumento del rendimento: su SPY 9,2% contro 10,8%, ma calo massimo dimezzato. Sulla media a 200 giorni di BTC la regola ha reso meno del possesso in quasi tutti gli anni dal 2019 al 2025 tranne il 2022. Anche il nostro sistema (+108% contro +124% di BTC) segue questo schema: va giudicato sul rapporto rendimento/rischio.
- **Più veloce è meglio: scalping e trend intraday sulle cripto rendono di più.** Su cripto il trend following intraday non era profittevole (Rozario et al.). Man Group trova che i segnali veloci aiutano nelle crisi, ma il rendimento medio è più alto con velocità lente, che hanno anche meno turnover e costi. Con i nostri costi (circa 0,31% andata e ritorno) la velocità costa cara.
- **Il volatility targeting migliora sempre lo Sharpe.** Su 60 asset dal 1926 migliora lo Sharpe solo per gli asset di rischio come azioni e credito. Per obbligazioni, valute e materie prime il miglioramento è trascurabile. Quello che fa sempre è ridurre le code e i cali estremi.
- **Le regole delle Turtle trasformano chiunque in milionario: basta copiarle.** Le regole sono pubbliche dal 2003 e molto usate, quindi le rotture sono affollate. Il successo degli anni 80 è documentato in modo aneddotico, non con test fuori campione rigorosi. Il sistema ha bassi tassi di vincita e richiede di sopportare lunghe serie di perdite: la difficoltà vera è psicologica e di gestione del rischio.
- **Uno Sharpe di 2 o più in un paper sulle cripto è denaro sicuro.** Il momentum pesato per volume dichiara 0,94% al giorno e Sharpe 2,17 senza repliche indipendenti trovate. Grobys e Sapkota non trovano momentum cross-sectional significativo nel 2014-2018. I risultati sulle cripto cambiano molto con campione, monete scelte e costi. Ogni numero alto va rifatto con i propri costi.

### Da leggere

- [A Century of Evidence on Trend-Following Investing (Hurst, Ooi, Pedersen, AQR)](https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing): Trend a 1, 3 e 12 mesi su 67 mercati dal 1880. Costanza nei decenni, comportamento nelle crisi (sorriso rispetto al mercato azionario), cali fino al 25%, ruolo della diversificazione.
- [Time Series Momentum (Moskowitz, Ooi, Pedersen) - SSRN 2089463](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2089463): Definizione del segnale (segno del rendimento a 12 mesi), scalatura per volatilità, persistenza per circa un anno seguita da inversione parziale, spiegazioni comportamentali.
- [Which Trend Is Your Friend? (Levine, Pedersen) - versione CBS](https://research-api.cbs.dk/ws/portalfiles/portal/60084063/lasse_heje_pedersen_et_al_which_trend_is_your_friend_publishersversion.pdf): Medie mobili incrociate e momentum time-series sono la stessa cosa scritta in due modi. Si sceglie l'orizzonte, non la formula.
- [The Impact of Volatility Targeting (Harvey et al.)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf): Quando il targeting aiuta lo Sharpe (asset di rischio) e quando aiuta solo le code. Effetto leva e riduzione dei cali.
- [Demystifying Time-Series Momentum Strategies (Baltas, Kosowski) - CME](https://www.cmegroup.com/education/files/demystifiing-time-series-momentum-strategies.pdf): Stimatori di volatilità più efficienti e regole migliori riducono il turnover di oltre un terzo. Le correlazioni tra mercati spiegano la debolezza dopo il 2008.
- [You Can't Always Trend When You Want (Babu et al., AQR) - SSRN 3487134](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3487134): Scomporre i rendimenti del trend in dimensione dei movimenti, cattura e diversificazione. Gli anni magri vengono da mercati calmi.
- [A Decade of Evidence of Trend Following Investing in Cryptocurrencies (Rozario et al.) - arXiv 2009.12155](https://arxiv.org/abs/2009.12155): Medie SMA, EMA e DEMA su BTC 2011-2019. Sharpe tra 0,5 e 1,5, intraday non profittevole, risultati indipendenti dal tipo di media.
- [Risks and Returns of Cryptocurrency (Liu, Tsyvinski) - NBER w24877](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf): Momentum time-series nelle cripto a orizzonte giornaliero e settimanale. L'attenzione degli investitori predice i rendimenti.
- [Common Risk Factors in Cryptocurrency (Liu, Tsyvinski, Wu)](https://economics.yale.edu/sites/default/files/2022-10/LiuTsyvinskiWu2019%20COMMON%20RISK%20FACTORS.pdf): Tre fattori (mercato, size, momentum) spiegano i rendimenti trasversali delle cripto. Tabelle con momentum da 1 a 100 settimane.
- [Time-Series and Cross-Sectional Momentum in the Cryptocurrency Market (Han, Kang, Ryu)](https://acfr.aut.ac.nz/__data/assets/pdf_file/0009/918729/Time_Series_and_Cross_Sectional_Momentum_in_the_Cryptocurrency_Market_with_IA.pdf): Momentum time-series forte con ipotesi realistiche, più marcato nei mercati rialzisti. Utile per decidere se il lato short merita il rischio.
- [Catching Crypto Trends; A Tactical Approach for Bitcoin and Altcoins (Zarattini, Pagani, Barbon) - SSRN 5209907](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5209907): Insieme di canali di Donchian a più lookback e dimensione per volatilità su altcoin, con test di costi da 0,10% a 0,50% e dati senza bias di sopravvivenza.
- [The Original Turtle Trading Rules (OriginalTurtles.org, 2003)](http://www.originalturtles.org/docs/turtlerules.pdf): Regole complete: N, unità di rischio, rotture a 20 e 55 giorni, stop 2N, piramidazione, uscite. Pubblicato gratis dagli autori. Il link è quello citato da Ritholtz e non l'ho potuto aprire.
- [The Need for Speed in Trend-Following Strategies (Man Group)](https://www.man.com/insights/need-for-speed-trend-following): Velocità del trend: i segnali veloci danno più protezione nelle crisi, quelli lenti un rendimento medio più alto e meno turnover.
- [A Quantitative Approach to Tactical Asset Allocation (Faber), revisione dopo 10 anni](https://allocatortraining.com/wp-content/uploads/2023/06/A-Quantitative-Approach-to-Tactical-Asset-Allocation.pdf): La regola della media a 10 mesi riduce il rischio, non aumenta il rendimento. Esempio di verifica fuori campione dopo la pubblicazione.
- [The Science and Practice of Trend-Following Systems (Sepp, Lucic) - arXiv 2607.19497](https://arxiv.org/pdf/2607.19497): Quadro unificato dei sistemi di trend. Legame tra profitti, autocorrelazione e deriva nei rendimenti normalizzati per volatilità. Un trend può guadagnare anche con mean reversion di breve se l'autocorrelazione di lungo periodo è positiva. Letto solo l'abstract.

### Lezioni per gli agenti

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

## 2. Momentum e inversione tra le criptovalute (cross-section: monete più forti contro più deboli, inversione a breve, dimensione, liquidità, settori)

Limite di metodo: da questa sessione WebFetch non raggiunge nessun sito (nber.org, arxiv.org, cowles.yale.edu, acfr.aut.ac.nz, papers.ssrn.com non risolvono). Quindi non ho aperto i PDF. Ho letto circa 18 fonti attraverso gli estratti e i riassunti del motore di ricerca (abstract, frasi del testo, pagine SSRN, RePEc e Alpha Architect). Ogni numero qui sotto viene da quegli estratti. Va ricontrollato sul PDF quando qualcuno avrà abilitato questi domini nelle impostazioni di rete della sessione.

Cosa ho capito:
1) Il lavoro di riferimento, Liu, Tsyvinski e Wu (Journal of Finance 2022), spiega i rendimenti cross-section delle cripto con tre fattori: mercato, dimensione e momentum. Il momentum migliore guarda alle ultime 3 settimane e rende circa il 3% a settimana lordo, long-short tra quintili. I dati vanno dal 2014 al 2018 su migliaia di monete, molte piccole e illiquide.
2) Dopo la pubblicazione e dopo i costi, il quadro peggiora molto. Han e coautori (con commissioni, tick e slittamento reali di Binance futures) trovano un momentum trasversale debole o quasi assente, mentre quello temporale (time-series) è più forte. Arefev (2026) usa i perpetual USD-M di Binance dal 2020 al 2026: lo spread lordo J=1/K=1 è +0,573% a settimana, i costi realistici sono circa 0,40 punti a settimana e quello che resta netto non si distingue da zero. Grobys e coautori: tra le monete sopravvissute il momentum non c'è, e quando c'è subisce crolli violenti (dicembre 2020). Il fattore trend CTREND, dichiarato robusto ai costi, è stato rifatto da Wang e Pang (2026): netto -0,87% a settimana con costi di 30/40 punti base.
3) Il punto più utile per noi: il segno dell'effetto dipende da dimensione e liquidità. Le monete piccole e illiquide mostrano inversione (giornaliera e settimanale). Le monete grandi e liquide, come le nostre 36, mostrano invece momentum giornaliero e settimanale (Zaremba e coautori 2021; Fičura e Colak 2023, t=2,33; vicinanza al massimo di 1 settimana, t=4,93). L'inversione serve a chi fornisce liquidità ed è concentrata dove c'è poco volume (Bianchi, Babiak e Dickerson 2022).
4) Sui nostri 36 perpetual i costi pesano molto. Un giro completo costa 2 × (0,055% + 0,1%) = 0,31%. Un long-short settimanale che rinnova metà delle posizioni costa più o meno 0,3-0,4% a settimana, cioè quanto tutto il guadagno lordo trovato da Arefev. Per questo servono pochi scambi (tenere le posizioni più a lungo, bande di tolleranza) oppure usare il momentum relativo come filtro dentro il sistema attuale, non come strategia a sé.
5) Per la rotazione tra settori non ho trovato nessuna prova rigorosa, solo blog e note di exchange.

### Inversione a breve condizionata al volume basso (test di controllo)

Priorità 2. Mercati: 36 perpetual USDT di Binance; giornaliero ed esecuzione a 4 ore. Provabile con i nostri dati: sì (OHLCV a 4 ore (aggregate a giornaliere) e volume delle 36 monete.).

L'inversione a breve paga chi fornisce liquidità a chi vende in fretta, e il premio è più forte dove il volume è basso (Bianchi, Babiak e Dickerson). Sulle nostre monete grandi è probabile che non ci sia (Zaremba e coautori), ma va provato in modo condizionato: ribasso forte con volume normale o basso, e non con volume esploso, che segnala informazione nuova.

**Regole.** Alla chiusura di ogni giorno UTC calcola il rendimento giornaliero r e il rapporto V = volume del giorno / mediana del volume a 20 giorni. Segnale long: r nel 10% peggiore della cross-section, sotto -2 volte la vol30 giornaliera della moneta, e V minore di 1. Entrata all'apertura della candela 4h successiva; uscita dopo 24 ore oppure al recupero di metà del calo; stop a 2 ATR giornalieri. Rischio 0,5% per operazione, al massimo 3 posizioni insieme. Lo stesso, specchiato, per gli short (r nel 10% migliore e V minore di 1). Controllo: lo stesso segnale con V maggiore di 2 dovrebbe dare momentum e non inversione.

**Prove.**

- [Bianchi, Babiak, Dickerson - Trading volume and liquidity provision in cryptocurrency markets (Journal of Banking & Finance 2022; Riksbank WP 413)](https://www.riksbank.se/globalassets/media/rapporter/working-papers/2022/no.-413-trading-volume-and-liquidity-provision-in-cryptocurreny-markets.pdf) (accademica): I rendimenti della fornitura di liquidità, misurati come inversione a breve, sono concentrati nelle coppie con poca attività, più piccole, più volatili e meno liquide; l'interazione tra rendimento passato e volume ha valore predittivo.
- [Zaremba et al. - Up or down? (IRFA 2021)](https://ideas.repec.org/a/eee/finana/v78y2021ics1057521921002349.html) (accademica): Le monete con il rendimento dell'ultimo giorno basso battono quelle con il rendimento alto, ma l'effetto nasce dall'illiquidità; le monete grandi mostrano momentum giornaliero.
- [Dobrynskaya - Cryptocurrency Momentum and Reversal (Journal of Alternative Investments 2023)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3913263) (accademica): Su 2000 monete (2014-2020) c'è momentum fino a 2-4 settimane e inversione oltre 1 mese, guidata dai perdenti passati.

**Fuori campione.** Sulle monete grandi l'evidenza va contro l'inversione giornaliera e settimanale (Zaremba 2021; Fičura 2023). Shen, Urquhart e Wang (2020) avevano un fattore di inversione, ma Jia, Goodell e Shen (2022) trovano momentum e non inversione su un campione più recente. Ci si deve aspettare un risultato nullo o negativo: serve come controllo per capire su quale orizzonte le nostre monete invertono.

**Come fallisce.** Si compra un coltello che cade durante notizie vere (hack, delisting, sblocchi di token). Una tenuta breve con 0,31% per giro richiede rimbalzi grandi. Nelle capitolazioni di mercato tutte le monete scendono insieme, e il segnale diventa una scommessa sul mercato intero.

### Inversione a 1-3 mesi tra le monete (perdenti di lungo periodo)

Priorità 2. Mercati: 36 perpetual USDT di Binance; mensile. Provabile con i nostri dati: sì (Settimanali costruite dalle 4 ore delle 36 monete; funding.).

Dobrynskaya trova che il momentum delle cripto si trasforma in inversione dopo circa 1 mese, più in fretta che nelle azioni, e che l'inversione viene dai perdenti passati. Ribilanciando di rado i costi sono bassi.

**Regole.** Ogni 4 settimane, all'inizio del periodo, calcola il rendimento da t-12 settimane a t-4 settimane (saltando il mese più recente, che ha momentum). Long le 7 monete peggiori, short le 7 migliori, neutrale in dollari, peso 1/vol60, tenuta 4 settimane, costi e funding reali. Variante combinata: momentum a 3 settimane più questa inversione con peso 50/50, per vedere se le due cose si diversificano.

**Prove.**

- [Dobrynskaya - Cryptocurrency Momentum and Reversal (versione conferenza HSE)](https://conference.hse.ru/files/download_file_ex?hash=FAE0AB2DC7A67656E89A0B1CB27D8C7D&id=3B5EE9A5-0B18-458A-9458-B4ED0F6C6664) (accademica): Momentum fino a 2-4 settimane, inversione significativa oltre 1 mese; i rendimenti non sono spiegati dai fattori di rischio cripto standard.

**Fuori campione.** Non ho trovato replicazioni post-pubblicazione su monete grandi o su perpetual. Il campione 2014-2020 comprende molte monete piccole. Con 3 anni di dati abbiamo solo circa 36 ribilanciamenti mensili: la potenza statistica è molto bassa.

**Come fallisce.** I perdenti di lungo periodo spesso sono monete in declino strutturale (sblocchi di token, perdita di narrativa) che continuano a scendere. Con pochi ribilanciamenti il risultato dipende da 2-3 episodi. Pagare funding sugli short dei vincitori in fase rialzista costa.

### Rotazione tra settori (momentum di gruppo)

Priorità 2. Mercati: 36 perpetual USDT di Binance; settimanale. Provabile con i nostri dati: sì (OHLCV a 4 ore delle 36 monete più una mappa monete-settori fissata prima del test.).

L'idea popolare è che il capitale ruoti a ondate fra narrative (layer 1, layer 2, DeFi, AI, ecosistema Bitcoin) e che il settore più forte continui. Il momentum dei fattori nelle cripto viene dal momentum dei prezzi (Fieberg e coautori 2023), quindi un momentum di gruppo può avere senso, ma non ho trovato studi rigorosi.

**Regole.** Gruppi fissati prima del test, senza guardare i risultati. L1: BTC, ETH, SOL, AVAX, ADA, NEAR, APT, SUI, SEI, DOT, ATOM, ICP, HBAR, TRX, XRP, XLM, LTC, BCH, ETC, BNB, FTM. L2/scalabilità: ARB, OP, MATIC/POL, IMX, STX, TIA. DeFi: UNI, AAVE, LINK, INJ, RUNE. AI/compute/storage: RNDR, FIL, WLD. Ecosistema BTC: ORDI, STX. Ogni lunedì calcola il rendimento medio a 4 settimane di ciascun gruppo (pesi uguali, saltando l'ultimo giorno). Long le monete del gruppo migliore e short quelle del gruppo peggiore, neutrale in dollari, tenuta 2 settimane, costi e funding reali. In alternativa, usa il gruppo come filtro nel sistema attuale: long solo sulle monete dei 2 gruppi più forti.

**Prove.**

- [Fieberg, Liedtke, Metko, Zaremba - Cryptocurrency Factor Momentum (Quantitative Finance 2023)](https://ideas.repec.org/a/taf/quantf/v23y2023i12p1853-1869.html) (accademica): Nelle cripto il momentum dei fattori nasce dal momentum dei prezzi delle singole monete, che poi si trasferisce al livello del fattore.
- [Kaiko Research - correlazione altcoin/Bitcoin (Q1 2024)](https://www.kaiko.com/resources/altcoin-dominance-hits-4-month-high) (gestore o exchange): La correlazione a 60 giorni tra Bitcoin e altcoin è scesa ai minimi pluriennali nel Q1 2024, quindi c'è più spazio per differenze tra monete; il mercato resta però molto centrato su Bitcoin.

**Fuori campione.** Non ho trovato nessuna prova rigorosa né fuori campione. Ci sono solo note di exchange e blog (CF Benchmarks, KuCoin, Medium). Con 5 gruppi e 3 anni il rischio di trovare schemi casuali è alto.

**Come fallisce.** Le etichette di settore sono arbitrarie e ricostruite con il senno di poi. I gruppi piccoli (3-5 monete) fanno dipendere tutto da una moneta. Le narrative cambiano più in fretta della finestra di 4 settimane.

### Punteggio di trend multi-media (CTREND semplificato)

Priorità 2. Mercati: 36 perpetual USDT di Binance; settimanale. Provabile con i nostri dati: sì (Giornaliere delle 36 monete per almeno 100 giorni prima del primo segnale (quindi il test parte da circa marzo 2024).).

Fieberg e coautori combinano più indicatori tecnici (medie mobili di lunghezze diverse) in un unico punteggio trasversale. Ricalcolandolo di rado il ricambio scende. Wang e Pang mostrano però che i risultati dipendono dai tempi delle informazioni e dalle regole di costruzione.

**Regole.** Ogni lunedì, per ogni moneta, calcola close/MA(n) - 1 per n = 5, 10, 20, 50 e 100 giorni. Standardizza ogni misura nella cross-section (z-score) e fai la media: quello è lo score. Long le prime 7 e short le ultime 7, con banda fino a 12, pesi 1/vol30, tenuta minima 2 settimane, costi e funding reali. Usa solo dati disponibili alla chiusura precedente, per non guardare nel futuro.

**Prove.**

- [Fieberg et al. - A Trend Factor for the Cross Section of Cryptocurrency Returns (JFQA)](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4C1509ACBA33D5DCAF0AC24379148178/S0022109024000747a.pdf/trend_factor_for_the_cross_section_of_cryptocurrency_returns.pdf) (accademica): Gli autori dichiarano che il segnale CTREND sopravvive ai costi e persiste nelle monete grandi e liquide.
- [Wang, Pang - The Cryptocurrency Trend Factor Revisited (arXiv 2611.01951)](https://arxiv.org/abs/2611.01951) (accademica): Dopo le correzioni (tempi delle informazioni, costruzione del portafoglio, contabilità dei rendimenti) le 100 monete più grandi scendono a un lordo di 1,00% a settimana; il long-short netto con costi di 30/40 punti base è -0,87% a settimana. In una versione su Zenodo l'alfa non è più significativo.

**Fuori campione.** Contestato. La replicazione indipendente del 2026 trova il netto negativo con costi bassi. Da provare solo per confronto, con una disciplina rigida contro il look-ahead (guardare dati che al momento non c'erano).

**Come fallisce.** È molto sensibile ai dettagli di costruzione. Nei mercati laterali le medie si incrociano spesso. Ha alta correlazione con il momentum semplice.

### Vicinanza al massimo di 1 settimana (momentum delle grandi)

Priorità 3. Mercati: 36 perpetual USDT di Binance; settimanale. Provabile con i nostri dati: sì (Massimi e chiusure a 4 ore delle 36 monete; funding.).

Fičura e Colak trovano che, tra le monete grandi e liquide, la distanza dal massimo dell'ultima settimana predice rendimenti positivi (t=4,93), mentre tra le piccole li predice negativi. È una misura di ancoraggio: chi compra vicino ai massimi viene premiato quando la moneta è liquida.

**Regole.** Ogni lunedì alle 00:00 UTC calcola per ogni moneta D = close_settimana / massimo(high delle ultime 42 candele da 4 ore). Long le 7 con D più alto (le più vicine al massimo), short le 7 con D più basso. Tenuta 1 settimana; con la banda (esci solo fuori dalle prime o ultime 12) la tenuta diventa più lunga. Peso 1/vol30, neutrale in dollari, costi e funding come nella strategia precedente. Variante solo long: compra le prime 5 quando BTC è sopra la sua media a 20 giorni, altrimenti resta liquido.

**Prove.**

- [Fičura, Colak - Impact of Size and Volume on Cryptocurrency Momentum and Reversal (FFA WP VŠE 2023 / SSRN 4378429)](https://wp.ffu.vse.cz/pdfs/wps/2023/01/03.pdf) (accademica): L'inversione settimanale c'è solo nelle monete piccole e illiquide (t=-7,31); le grandi e liquide hanno momentum settimanale (t=2,33). La distanza dal massimo di 1 settimana predice positivamente i rendimenti delle grandi (t=4,93) e negativamente quelli delle piccole (t=-9,03).
- [Li, Urquhart, Wang, Zhang - MAX momentum in cryptocurrency markets (IRFA 2021)](https://centaur.reading.ac.uk/99101) (accademica): Effetto MAX momentum significativo: le monete con rendimenti estremi passati tendono a continuare (dettagli non verificati perché l'estratto era troncato).

**Fuori campione.** Non ho trovato replicazioni indipendenti dopo il 2023. Il lavoro è un working paper. Non sappiamo se l'effetto sopravviva a costi di circa 0,31% per giro completo. Da trattare come ipotesi.

**Come fallisce.** Si sovrappone molto al momentum a 3 settimane e alla rottura di volume già usata, quindi rischia di aggiungere poca informazione. Nelle fasi laterali le monete vicine al massimo fanno falsi breakout. Ha gli stessi problemi di costi e crolli del momentum classico.

### Momentum trasversale settimanale long-short a basso ricambio (3 settimane, pesato per volatilità, con bande)

Priorità 4. Mercati: 36 perpetual USDT di Binance, frequenza settimanale. Provabile con i nostri dati: sì (Giornaliere costruite dalle 4 ore delle 36 monete, funding ogni 8 ore, costi 0,055% più 0,1% per lato. Massimi e minimi a 4 ore per simulare le liquidazioni sugli short.).

Replica la scoperta di Liu-Tsyvinski-Wu limitandola a monete grandi, dove il momentum è più pulito (Fičura e Colak; Zaremba e coautori). Per sopravvivere ai costi bisogna tagliare il ricambio: tenere almeno 2 settimane e usare bande di tolleranza. Per ridurre i crolli si scala l'esposizione con la volatilità (Grobys e coautori).

**Regole.** Ribilanciamento ogni lunedì alle 00:00 UTC. Segnale: rendimento delle ultime 3 settimane saltando l'ultimo giorno. Universo: le 36 monete, togliendo quelle con meno di 60 giorni di storia. Entrata: long le prime 7, short le ultime 7. Banda: una moneta già in portafoglio esce solo se scende fuori dalle prime 12 (o sopra le ultime 12, per gli short). Peso di ogni moneta proporzionale a 1/vol30, con i due lati di uguale valore nominale (neutrale in dollari). Scala del portafoglio: obiettivo 20% di volatilità annua, stimata sui rendimenti giornalieri della strategia negli ultimi 60 giorni, con leva massima 1,5. Costo: 0,155% per lato su ogni variazione di peso, più il funding reale ogni 8 ore (lo paga chi è long quando è positivo). Varianti da provare: lookback 1, 2 e 4 settimane; tenuta 1 o 2 settimane; solo il lato long sopra BTC. Va riportato il guadagno lordo, i costi e il funding separati.

**Prove.**

- [Liu, Tsyvinski, Wu - Common Risk Factors in Cryptocurrency (pagina Alpha Architect e working paper)](https://alphaarchitect.com/factors-investing-in-cryptocurrency/) (accademica): Strategia momentum a costo zero intorno al 3% a settimana lordo; il momentum a 3 settimane è la misura principale.
- [Arefev - Cross-Sectional Momentum in Cryptocurrency: A Net-of-Costs Replication on Tradable Binance Perpetuals (2020-2026), SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7404139) (pratico con backtest): Spread lordo J=1/K=1 +0,573% a settimana, costi realistici circa 0,40 punti a settimana, netto non distinguibile da zero; in J=2/K=2 il segno cambia a seconda del giorno di ribilanciamento.
- [Han et al. - Time-Series and Cross-Sectional Momentum in the Cryptocurrency Market (working paper AUT)](https://acfr.aut.ac.nz/__data/assets/pdf_file/0009/918729/Time_Series_and_Cross_Sectional_Momentum_in_the_Cryptocurrency_Market_with_IA.pdf) (accademica): Con commissioni, tick e slittamento reali di Binance futures e le oscillazioni intra-periodo (liquidazioni) molti portafogli momentum vengono liquidati; il momentum trasversale è debole o quasi assente.
- [Grobys, Kolari et al. - Cryptocurrency momentum has (not) its moments (2025)](https://osuva.uwasa.fi/handle/10024/20018) (accademica): Sulle monete grandi il payoff medio è 0,90% a settimana ma non significativo; crolli violenti (dicembre 2020); la scalatura per volatilità aiuta in media ma non riduce in modo significativo il rischio di coda.
- [Castellanos Macias - From a 20.9-million-configuration trading system to cross-sectional momentum (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7085378) (pratico con backtest): Momentum trasversale neutrale al mercato positivo dopo i costi retail, con Sharpe 0,54, ma calo massimo -27,4%.

**Fuori campione.** Debole. Il dato originale (circa 3% a settimana) viene da un campione pre-2019 con molte monete piccole. Fuori campione, sui perpetual di Binance 2020-2026, il netto è circa zero (Arefev). Han trova poco o nulla. Grobys trova effetti dipendenti dal campione e assenti tra le monete sopravvissute. Un test pratico trova Sharpe 0,54 netto con calo del 27%. Ci si deve aspettare al massimo un vantaggio piccolo.

**Come fallisce.** I costi mangiano tutto se il ricambio è alto. Crolli del momentum quando il mercato si gira all'improvviso (i perdenti rimbalzano forte e gli short soffrono). Il funding sui long negli anni rialzisti pesa. Con solo 36 monete i quantili contano poche monete: rumore alto e risultati diversi a seconda del giorno di ribilanciamento (Arefev). Le liquidazioni intra-settimana sugli short non sono visibili in un backtest fatto solo sulle chiusure.

### Forza relativa come filtro del sistema attuale (scegliere le monete giuste per il breakout)

Priorità 5. Mercati: Le 36 perpetual USDT di Binance che abbiamo; segnale giornaliero, esecuzione a 4 ore. Provabile con i nostri dati: sì (Candele a 4 ore (da cui le giornaliere) delle 36 monete; il backtest del sistema attuale come base di confronto.).

Il nostro sistema sceglie già il lato con BTC. La letteratura dice che tra le monete grandi e liquide i vincitori delle ultime 2-4 settimane tendono a restare forti nel breve (pochi scambi seguono altri: herding). Usare la classifica di forza relativa solo come filtro non aggiunge operazioni né costi, e porta le operazioni sulle monete che hanno il vento a favore.

**Regole.** Ogni giorno alle 00:00 UTC calcola per ognuna delle 36 monete il rendimento delle ultime 21 giornate (costruite dalle candele a 4 ore), saltando l'ultimo giorno: R = close[t-1]/close[t-22]-1. Normalizzalo per la volatilità giornaliera a 30 giorni: score = R / vol30. Ordina le monete. Lato long (BTC in salita secondo la regola attuale): accetta i breakout di volume a 4 ore solo sulle monete nel terzo più alto della classifica (prime 12). Lato short: solo sulle monete nel terzo più basso (ultime 12). Tutto il resto resta com'è: stop a 3 ATR, target 3R, trailing, rischio 1%, filtro sull'open interest. Variante da confrontare: rendimento a 7 e a 28 giorni. Confronto da fare: stesso periodo, stessi costi, sistema con filtro contro sistema senza filtro, e il numero di operazioni scartate.

**Prove.**

- [Liu, Tsyvinski, Wu - Common Risk Factors in Cryptocurrency (Journal of Finance 2022; NBER w25882)](https://www.nber.org/papers/w25882) (accademica): Mercato, dimensione e momentum spiegano la cross-section; il momentum a 3 settimane dà lo spread maggiore, circa 3% a settimana lordo tra quintili (dato dagli estratti, campione 2014-2018).
- [Begušić, Kostanjčar - Momentum and liquidity in cryptocurrencies (arXiv 1904.00890)](https://arxiv.org/abs/1904.00890) (accademica): Momentum forte nelle cripto più liquide, coerente con l'herding; la strategia long-only 'vincitori liquidi' batte il portafoglio pesato per capitalizzazione.
- [Zaremba, Bilgin, Long, Mercik, Szczygielski - Up or down? Short-term reversal, momentum, and liquidity effects in cryptocurrency markets (IRFA 2021)](https://ideas.repec.org/a/eee/finana/v78y2021ics1057521921002349.html) (accademica): Su oltre 3600 monete l'inversione giornaliera viene dall'illiquidità; le monete più grandi e negoziabili mostrano invece momentum giornaliero.

**Fuori campione.** Come strategia autonoma il momentum trasversale non ha retto dopo la pubblicazione sui perpetual di Binance: Arefev 2020-2026 trova lordo +0,573% a settimana, netto non diverso da zero. Come filtro non ho trovato test pubblicati: è una nostra ipotesi da verificare. Il vantaggio è che non aumenta il numero di operazioni.

**Come fallisce.** Nei crolli collettivi la correlazione tra le monete sale e la classifica non conta più nulla. Quando la dispersione tra le monete crolla (su GitHub un autore segnala dispersione -38% dopo il 2022) il filtro diventa rumore. C'è rischio di sovra-ottimizzare la finestra (7/21/28 giorni): sceglierla prima e non ritoccarla. Con meno operazioni il campione diventa piccolo.

### Miti

- **Il momentum delle cripto è un fattore dimostrato che rende il 3% a settimana: basta comprare i vincitori e vendere i perdenti.** Il 3% è lordo, su dati 2014-2018 con migliaia di monete piccole e illiquide. Sui perpetual di Binance dal 2020 al 2026 lo spread lordo è circa 0,57% a settimana e i costi realistici circa 0,40 punti: il netto non si distingue da zero. Han trova il momentum trasversale debole dopo costi e liquidazioni.
- **Compra i perdenti della settimana scorsa: nelle cripto tutto torna indietro (inversione).** L'inversione settimanale e giornaliera c'è nelle monete piccole e illiquide. Nelle monete grandi e liquide, come le nostre 36, l'effetto è al contrario: momentum.
- **Le piccole cripto battono sempre le grandi (effetto dimensione), quindi conviene stare sulle small cap.** Il premio della dimensione è legato alla poca liquidità: MSCI trova che dimensione e bassa liquidità siano i fattori con il premio più netto. Ma quel premio vive dove i costi, lo slittamento e il rischio di delisting sono più alti, e non si può incassare con perpetual liquidi. Con il nostro universo di 36 monete grandi non si può nemmeno testare.
- **Un backtest long-short su dati CoinMarketCap con pesi uguali è quello che si guadagnerebbe davvero.** Ignora le oscillazioni dentro il periodo, che liquidano le posizioni a leva, i costi reali e le monete morte. Tra le monete sopravvissute il momentum non c'è, e il profitto compare solo dopo aver tagliato le osservazioni estreme.
- **Il fattore trend (CTREND) è robusto ai costi anche sulle monete grandi.** La replicazione indipendente del 2026 corregge i tempi delle informazioni e la costruzione: il netto con costi di 30/40 punti base diventa -0,87% a settimana.
- **Scalare il momentum per la volatilità elimina i crolli.** Aiuta in media, ma secondo Grobys e coautori non cambia in modo significativo il rischio di coda. Il crollo del dicembre 2020 resta un esempio di perdita estrema.
- **Video social del tipo 'compra le top gainer di oggi': la moneta che sale di più oggi continua domani.** Nella maggior parte delle cripto il rendimento di ieri predice un'inversione, non una continuazione. Nelle grandi c'è un piccolo momentum giornaliero, ma è troppo piccolo rispetto a 0,31% di costo per giro. Contenuti di questo tipo vanno letti come termometro dell'euforia della folla, non come prova.
- **La rotazione tra settori (AI, DeFi, layer 1) è un ciclo regolare e prevedibile.** Non ho trovato nessuno studio rigoroso o fuori campione. Ci sono solo note di exchange e blog, che descrivono il passato senza un test.

### Da leggere

- [Common Risk Factors in Cryptocurrency (Liu, Tsyvinski, Wu) - NBER w25882 / versione Yale](https://www.nber.org/papers/w25882): Modello a 3 fattori (mercato, dimensione, momentum); momentum a 3 settimane; quintili long-short; i caricamenti sul momentum sono transitori, quelli sulla dimensione più stabili. È la base di tutto, ma su un campione vecchio e con molte monete piccole.
- [Risks and Returns of Cryptocurrency (Liu, Tsyvinski) - NBER w24877](https://www.nber.org/papers/w24877): Momentum temporale forte; le misure di attenzione degli investitori predicono i rendimenti; le cripto non sono esposte ai fattori di azioni, valute e metalli.
- [Cross-Sectional Momentum in Cryptocurrency: A Net-of-Costs Replication on Tradable Binance Perpetuals (2020-2026) - Arefev, SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7404139): È il test più vicino al nostro universo: lordo +0,573% a settimana contro costi di 0,40 punti, netto circa zero; il risultato dipende dal giorno di ribilanciamento.
- [Time-Series and Cross-Sectional Momentum in the Cryptocurrency Market (Han et al., working paper AUT)](https://acfr.aut.ac.nz/__data/assets/pdf_file/0009/918729/Time_Series_and_Cross_Sectional_Momentum_in_the_Cryptocurrency_Market_with_IA.pdf): Come modellare costi e liquidazioni reali su Binance futures; il momentum temporale batte quello trasversale.
- [Impact of Size and Volume on Cryptocurrency Momentum and Reversal (Fičura, Colak) - FFA WP VŠE](https://wp.ffu.vse.cz/pdfs/wps/2023/01/03.pdf): Il segno dell'effetto dipende dalla dimensione: inversione nelle piccole, momentum nelle grandi; segnale 'distanza dal massimo di 1 settimana'.
- [Cryptocurrency Momentum and Reversal (Dobrynskaya) - SSRN 3913263](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3913263): Momentum fino a 2-4 settimane, poi inversione oltre 1 mese; l'inversione viene dai perdenti.
- [Trading volume and liquidity provision in cryptocurrency markets (Bianchi, Babiak, Dickerson) - Riksbank WP 413](https://www.riksbank.se/globalassets/media/rapporter/working-papers/2022/no.-413-trading-volume-and-liquidity-provision-in-cryptocurreny-markets.pdf): L'inversione a breve paga chi fornisce liquidità ed è forte dove il volume è basso; l'interazione tra rendimento passato e volume conta.
- [Momentum and liquidity in cryptocurrencies (Begušić, Kostanjčar) - arXiv 1904.00890](https://arxiv.org/abs/1904.00890): Momentum nelle monete più liquide (herding); premio di illiquidità tra i perdenti; ordinamento doppio momentum-liquidità.
- [The Cryptocurrency Trend Factor Revisited (Wang, Pang) - arXiv 2611.01951](https://arxiv.org/abs/2611.01951): Lezione di metodo: tempi delle informazioni, look-ahead e contabilità dei rendimenti possono cambiare il segno di un risultato pubblicato.
- [Cryptocurrency momentum has (not) its moments (Grobys, Kolari et al.) - archivio Università di Vaasa](https://osuva.uwasa.fi/handle/10024/20018): Crolli del momentum cripto; la scalatura per volatilità aiuta in media ma non sul rischio di coda.
- [Cryptocurrencies and momentum (Grobys, Sapkota, Economics Letters 2019) - archivio Università di Vaasa](https://osuva.uwasa.fi/handle/11111/2278): Risultato contrario: 143 monete dal 2014 al 2018, nessun payoff di momentum significativo.
- [Could Factors Have Explained Cryptocurrency Risk? (MSCI blog, 2021)](https://www.msci.com/research-and-insights/blog-post/could-factors-have-explained-cryptocurrency-risk): Un modello a 7 fattori spiega il 45% della varianza; dimensione e bassa liquidità hanno il premio più netto; il momentum è più debole.
- [Factors Investing in Cryptocurrency (Alpha Architect)](https://alphaarchitect.com/factors-investing-in-cryptocurrency/): Riassunto divulgativo di Liu-Tsyvinski-Wu: molte anomalie delle azioni esistono anche nelle cripto.
- [A Trend Factor for the Cross Section of Cryptocurrency Returns (Fieberg et al., JFQA)](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/4C1509ACBA33D5DCAF0AC24379148178/S0022109024000747a.pdf/trend_factor_for_the_cross_section_of_cryptocurrency_returns.pdf): Costruzione del punteggio CTREND da più medie mobili. PDF sul sito dell'editore: non ho potuto verificare se è ad accesso aperto, quindi lo segno come non confermato.

### Lezioni per gli agenti

1) Prima di fidarti di un effetto chiediti su quali monete è stato trovato. Quasi tutti i risultati forti (momentum al 3% a settimana, inversione settimanale, premio della dimensione) nascono da migliaia di monete piccole e illiquide prima del 2020. Le nostre 36 sono grandi e liquide: lì il breve tende al momentum, non all'inversione.
2) Fai i conti dei costi prima di quelli del guadagno. Sui nostri perpetual un giro completo costa circa 0,31%. Un long-short settimanale con ricambio di metà portafoglio costa 0,3-0,4% a settimana, quanto tutto il guadagno lordo trovato sui perpetual di Binance. Ogni strategia trasversale deve mostrare lordo, costi e funding come tre righe separate.
3) Riduci il ricambio prima di cercare segnali migliori: tenute di 2 settimane o più, bande di tolleranza (entri nelle prime 7, esci solo fuori dalle prime 12), pesi stabili.
4) Il momentum relativo funziona meglio come filtro che come motore. Usarlo per scegliere su quali monete prendere i breakout già decisi dal sistema non aggiunge costi.
5) Diffida dei risultati che dipendono da un dettaglio arbitrario, come il giorno del ribilanciamento, la finestra di 3 contro 4 settimane o il taglio degli estremi. Arefev mostra che il segno può girare cambiando il giorno di ribilanciamento: prova sempre tutte le fasi (lunedì, martedì, eccetera) e riporta la media.
6) Niente look-ahead: il segnale usa solo dati chiusi prima dell'entrata, saltando l'ultimo giorno. La replicazione di CTREND mostra quanto pesano i tempi delle informazioni.
7) Gli short sui perpetual hanno rischi che i backtest settimanali non vedono: rimbalzi violenti dei perdenti, liquidazioni intra-settimana, funding. Simula con i massimi e minimi a 4 ore, non solo con le chiusure settimanali.
8) Aspettati crolli del momentum quando il mercato si gira. La scalatura per volatilità aiuta in media ma non salva dalla coda: tieni un limite di perdita del portafoglio.
9) Con 36 monete e 3 anni hai circa 150 settimane: ogni variante provata in più aumenta la probabilità di un risultato casuale. Decidi le regole prima di guardare i risultati, tieni l'ultimo anno come verifica intoccabile e conta quante varianti hai provato.
10) Domande da farsi ogni volta: l'effetto è sulle grandi o sulle piccole? È lordo o netto? Regge dopo il 2021? Quanto ricambio produce? Chi sta dall'altra parte del trade e perché perde?
11) I contenuti social del tipo 'compra le top gainer' sono un segnale di euforia della folla, non una prova. Se la folla insegue le vincitrici, il rischio di inversione e di crolli del momentum sale.
12) Limite di questa ricerca: da questa sessione i siti degli articoli (nber.org, arxiv.org, cowles.yale.edu, acfr.aut.ac.nz, papers.ssrn.com) non erano raggiungibili. I numeri vengono dagli estratti del motore di ricerca e vanno verificati sui PDF prima di usarli come parametri definitivi.

## 3. Funding, carry e posizionamento sui derivati (perpetual cripto)

LIMITE DI METODO, da leggere per primo: in questa sessione il proxy di rete ha rifiutato l'apertura diretta di tutte le pagine di ricerca (arxiv.org, bis.org, ssrn.com, mdpi.com, kaiko.com, binance.com e altri). Per questo ho letto le fonti attraverso gli estratti testuali restituiti dalla ricerca web (abstract, frasi citate, tabelle riportate), non i PDF completi. Ogni numero qui sotto viene da quegli estratti e ha la sua fonte. Dove un dato non l'ho trovato, lo dico. Per leggere i testi interi bisogna abilitare quei domini nelle impostazioni di rete della sessione.

Cosa ho imparato:
1) Il carry sulle cripto (funding dei perpetual, oppure base tra future e spot) è stato enorme ed è reale. BIS WP 1087 (Schmeling, Schrimpf, Todorov) lo misura fino a 40-60% annuo. Non lo spiegano i tassi d'interesse ma la domanda di leva dei piccoli investitori che inseguono il trend, unita alla scarsità di capitale per l'arbitraggio. Un carry alto anticipa i crolli. È un premio per il rischio di crash, come nel carry valutario (Brunnermeier, Nagel, Pedersen).
2) Il carry si è ristretto molto. He, Manela, Ross e von Wachter misurano un calo delle deviazioni di circa l'11% all'anno; il loro arbitraggio su BTC rende il 64,8% nel 2021 e il 21,4% nel 2024. Borri e coautori (2025) trovano uno Sharpe del carry di 6,45 sul periodo 2020-2025, che scende a 4,06 dal 2024 e diventa negativo nel 2025 (dati fino a settembre 2025). Secondo BitMEX, nel terzo trimestre 2025 il funding di BTC è rimasto esattamente allo 0,01% per 8 ore (circa 11% annuo, il valore base della formula) per il 78% del tempo. Dopo il crollo del 10 ottobre 2025 il funding è sceso ancora: il rendimento di sUSDe è passato da cifre a due numeri a circa il 3-4%.
3) Il funding ha poco potere di previsione sul prezzo del singolo coin. Fulgur trova un R² di 0,003 sulle 8 ore. Una serie indipendente trova una correlazione di rango di -0,005 tra funding passato e rendimento a 7 giorni su circa 30 coin nel periodo 2023-2026. Ha più valore usato in sezione trasversale (long sui coin con funding basso, short su quelli con funding alto): uno Sharpe netto di circa 0,4 fuori campione, con un calo massimo del 35% fino a metà 2024. Ha valore anche come termometro del rischio di crollo.
4) I periodi di funding negativo per BTC sono stati seguiti da rendimenti a 30 giorni sopra la media (K33 e VanEck, citati dalla stampa). Però sono pochi episodi, legati alle fasi di mercato, e i test walk-forward amatoriali hanno intervalli di confidenza che comprendono lo zero.
5) Le liquidazioni a cascata sono cicli di vendite forzate amplificati da libri ordini sottili e dall'auto-deleveraging (ADL), che chiude anche le coperture. Il 10 ottobre 2025 sono stati liquidati circa 19 miliardi di dollari. Gli studi recenti mostrano un rimbalzo dopo le vendite forzate, che cresce con il volume forzato, ma anche che i crolli da notizia sono esogeni e non si prevedono.
6) Per l'open interest e il rapporto long/short non ho trovato prove rigorose che prevedano il prezzo. Ci sono solo regole empiriche non testate. Vanno trattati come filtri da verificare con il nostro backtest, non come verità.
Per noi la mossa più utile non è inseguire il carry, che ormai vale poco. È usare funding e open interest come termometro del rischio di crollo per il nostro sistema trend, e provare un carry neutrale in sezione trasversale sui 36 coin.

### Rapporto long/short dei top trader: estremi come segnale contrarian o di conferma

Priorità 2. Mercati: I 36 perpetual, 4 ore e settimanale.. Provabile con i nostri dati: sì (Rapporto long/short dei top trader e candele a 4 ore (disponibili).).

Se i grandi conti sono tutti da una parte, il carburante per proseguire è finito e il rischio di squeeze sale. Ipotesi alternativa: i top trader sono informati e vanno seguiti. Le prove non dicono quale delle due valga: va scoperto con i dati.

**Regole.** Per ogni coin, sulle 4 ore:
- z = z-score a 30 giorni (180 candele) del rapporto long/short dei top trader (posizioni).
Test 1, filtro sul sistema trend: nessun nuovo long se z > +2, nessun nuovo short se z < -2.
Test 2, sezione trasversale settimanale: long sui 7 coin con la variazione a 7 giorni del rapporto più bassa, short sui 7 con la più alta, lordo 1x, pesi di volatilità uguali, ribilanciamento il lunedì.
Test 3, segno opposto (seguire i top trader), per capire quale delle due ipotesi regge.
Correzione per test multipli: tre ipotesi, quindi soglia di significatività più severa.

**Prove.**

- [Coinstats - Crypto Long/Short Ratio](https://coinstats.app/derivatives/long-short-ratio/) (aneddotica): Il rapporto per numero di conti è dominato dai piccoli e si legge come contrarian. Il rapporto per posizioni dei top trader è un'altra misura e non va confuso con il primo.
- [BitPredict - Long Short Ratio Analysis notebook](https://bitpredict.ai/resources/notebooks/long_short_ratio_analysis) (aneddotica): Esiste un metodo pubblico (z-score e backtest contrarian sui dati Binance dei top trader), ma la ricerca non ha restituito risultati: nessuna prova.

**Fuori campione.** Non ho trovato alcuno studio rigoroso, né prima né dopo la pubblicazione, che mostri potere di previsione del rapporto long/short dei top trader. Affermazioni come 'sopra il 70% anticipa le correzioni' sono senza dati. Priorità bassa: va provato solo perché il dato lo abbiamo già.

**Come fallisce.** - Definizione opaca di 'top trader' da parte di Binance.
- Il rapporto può riflettere coperture.
- Alto rischio di rumore e di overfitting con tre ipotesi e soglie libere.

### Momentum del funding (variazione del funding come segnale in sezione trasversale, analogo al basis-momentum)

Priorità 2. Mercati: I 36 perpetual, settimanale.. Provabile con i nostri dati: sì (Funding a 8 ore e candele dei 36 coin (disponibili).).

Nelle materie prime la variazione della struttura dei future (basis-momentum) anticipa i rendimenti, perché misura squilibri tra domanda e offerta di contratti che speculatori e intermediari non riescono ad assorbire. Sulle cripto l'analogo è la variazione del funding: un funding che sale in fretta segnala domanda di leva in aumento. Presto Labs indica che la variazione del funding contiene informazione, più utile in sezione trasversale.

**Regole.** Ogni lunedì:
- dF = F7 (ultimi 21 funding) - F7 della settimana precedente.
- Ordinare i coin per dF. Testare entrambi i versi: momentum (long sul quintile con dF più alto, short sul quintile più basso) e inversione (il contrario).
- Lordo 1x, pesi di volatilità uguali, tenuta 1 settimana, costi pieni.
- Scegliere il verso con dati dal 2023-11 al 2025-04, poi verificarlo da 2025-05 a 2026-10 senza ritoccarlo (un solo test fuori campione).

**Prove.**

- [Boons, Prado - Basis-Momentum (Journal of Finance 2019)](https://ideas.repec.org/a/bla/jfinan/v74y2019i1p239-279.html) (accademica): La differenza di momentum tra il primo e il secondo contratto in scadenza anticipa i premi delle materie prime nel tempo e in sezione trasversale. Spiegazione: squilibri di domanda e offerta di future che speculatori e intermediari non assorbono.
- [Presto Labs - Can Funding Rate Predict Price Change? (PDF)](https://assets.ctfassets.net/m1hizt3hapq0/1iUG0SBdtu4882jpmOESS5/591636ed8ffbb1e000c85be6498cb835/Can_Funding_Rate_Predict_Price_Change.pdf) (gestore o exchange): Legame statisticamente significativo ma debole tra la variazione del funding e il prezzo successivo (circa 12,5% della variazione a 7 giorni). Utile in sezione trasversale. Il verso preciso non è chiaro negli estratti che ho letto.

**Fuori campione.** Sulle cripto non ho trovato uno studio fuori campione di questo segnale specifico. Il basis-momentum è solido sulle materie prime (dal 1959 in poi), ma il trasferimento alle cripto è un'ipotesi da verificare.

**Come fallisce.** - Verso del segnale incerto, quindi rischio di scegliere a posteriori.
- Il funding cambia anche per motivi meccanici (formula, limiti, cambi d'intervallo decisi dalla piazza).
- Turnover alto.

### Incasso del funding con tempismo (cash and carry: short perpetual e long spot solo quando il funding paga)

Priorità 3. Mercati: BTC, ETH, SOL perpetual USDT di Binance più il relativo spot. Orizzonte da settimane a mesi.. Provabile con i nostri dati: no (Prezzi spot (o indice) di BTC, ETH, SOL alla stessa frequenza, per misurare la base. Con i soli dati attuali si può fare solo un'approssimazione che assume base zero.).

Con funding positivo i long pagano gli short. Short sul perpetual e long sullo spot elimina la direzione e incassa il funding: è il premio pagato dai piccoli per la leva. Siccome oggi il funding sta quasi sempre al valore base dello 0,01% per 8 ore (circa 11% annuo) e i costi d'ingresso e d'uscita sono alti, conviene entrare solo quando il funding è nettamente sopra la base.

**Regole.** Calcolo del pareggio:
- 4 operazioni (spot dentro e fuori, perpetual dentro e fuori) x 0,155% = circa 0,62% di costi.
- Al valore base 0,01% per 8 ore = 0,03% al giorno servono circa 21 giorni per andare in pari.
Regole:
- Entrata: F7 annualizzato > 20% E l'ultimo funding regolato > 0,02%.
- Uscita: F7 annualizzato < 8%, oppure 3 funding negativi di fila.
- Coin: solo BTC, ETH, SOL (liquidità e assenza di rischio delisting).
- Dimensione: perpetual con leva al massimo 2x sul margine, per restare lontani dalla liquidazione della gamba short.
- Test approssimato con i nostri dati: profitti e perdite = somma dei funding incassati - 0,62% per ciclo, assumendo base zero (perpetual = spot). Su BTC ed ETH l'errore è piccolo; sugli altri no.
Riportare a parte quanto rende nei sottoperiodi 2024, 2025 e 2026.

**Prove.**

- [He, Manela, Ross, von Wachter - Fundamentals of Perpetual Futures (arXiv 2212.06888)](https://arxiv.org/abs/2212.06888) (accademica): Le deviazioni dal prezzo di non arbitraggio sono più grandi che nelle valute, si muovono insieme tra i coin e calano di circa l'11% l'anno. L'arbitraggio dà uno Sharpe di 1,8 con i costi di un piccolo investitore su BTC (fino a 3,5 senza commissioni). Rendimento su BTC: 64,81% nel 2021, 21,44% nel 2024. Le deviazioni si sono strette dopo l'introduzione del portfolio margin di Binance (aprile 2022). Non è senza rischio, perché manca una scadenza in cui chiudere sicuramente in profitto.
- [Borri, Liu, Tsyvinski, Wu - Cryptocurrency as an Investable Asset Class: Coming of Age (arXiv 2510.14435)](https://arxiv.org/html/2510.14435v1) (accademica): Carry cripto: Sharpe 6,45 nel 2020-2025, 4,06 dal 2024, negativo nel 2025 (dati fino al 6 settembre 2025). Il profitto viene soprattutto dal funding (media circa 8%, volatilità 0,8%).
- [BitMEX - The Anchor and the Ceiling (Q3 2025 derivatives report)](https://www.bitmex.com/blog/2025q3-derivatives-report) (gestore o exchange): Nel terzo trimestre 2025 il funding di BTC è rimasto esattamente allo 0,01% per il 78,19% del tempo (ETH 87,52%) ed è stato positivo oltre il 92% del tempo. La base fissa della formula fa da ancora; l'arbitraggio riporta in fretta i picchi verso di essa.
- [Christin, Routledge, Soska, Zetlin-Jones - The Crypto Carry Trade (working paper CMU)](https://www.andrew.cmu.edu/user/azj/files/CarryTrade.v1.0.pdf) (accademica): Sharpe nel campione di circa 10 (Tether carry) e 5,7 (coin carry). Profitti dovuti al disaccordo tra speculatori a leva e arbitraggisti con poco capitale, e ai limiti massimi del funding. Con funding molto più basso lo Sharpe scenderebbe al livello delle azioni (circa 0,3).
- [DL News - Ethena's USDe sheds 40% of supply as traders cool on risky crypto bets](https://www.dlnews.com/articles/defi/ethena-usde-supply-plummets-as-traders-cool-on-risky-crypto-bets/) (gestore o exchange): Dopo ottobre 2025 il funding è crollato, erodendo il carry. L'offerta di USDe è scesa da quasi 15 a circa 8,5 miliardi di dollari. Altre fonti riportano un rendimento di sUSDe sceso a circa il 3,5-3,9%.

**Fuori campione.** È la strategia che ha retto peggio dopo la pubblicazione. Il rendimento su BTC è passato dal 64,8% del 2021 al 21,4% del 2024 (He e coautori); lo Sharpe è diventato negativo nel 2025 (Borri e coautori). Secondo la serie Alpha Research, il trade sul livello del funding era compresso a circa +0,6% nel 2026 e non batte più la liquidità. Il valore base dello 0,01% per 8 ore (circa 11% annuo) resta, ma con 0,62% di costi per ciclo e il rischio della piazza conviene solo in fasi di euforia.

**Come fallisce.** - Il funding si inverte e diventa negativo.
- Liquidazione della gamba short in un rialzo improvviso.
- L'ADL chiude la copertura short e lascia scoperto il long spot (10 ottobre 2025).
- Fallimento o blocco dei prelievi della piazza (tipo FTX).
- Perdita di aggancio della stablecoin.
- Delisting.
- Senza dati spot non vediamo il rischio di base.

### Long nei periodi di funding negativo (capitolazione dei long)

Priorità 3. Mercati: BTC, eventualmente il paniere dei coin più grandi; giornaliero, tenuta circa 30 giorni.. Provabile con i nostri dati: sì (Funding a 8 ore di BTC e candele giornaliere (disponibili). Più storia (prima del 2023) renderebbe il test più serio.).

Quando la media del funding resta negativa per settimane, gli short pagano per stare short: c'è affollamento ribassista e paura. Se il prezzo non scende più, gli short devono ricoprirsi (squeeze) e la leva lunga è già stata pulita. È un contrarian sul posizionamento, non sul prezzo.

**Regole.** Su base giornaliera:
- Segnale: media a 30 giorni del funding di BTC (90 regolamenti) < 0. Variante: F7 di BTC nel 5° percentile della sua storia mobile a 365 giorni.
- Conferma: chiusura giornaliera sopra la minima degli ultimi 10 giorni (niente acquisti su un coltello che cade).
- Entrata: long BTC, oppure il paniere dei 10 coin più liquidi a pesi di volatilità uguale, alla chiusura del giorno di conferma.
- Rischio 1%, stop a 3 ATR giornalieri.
- Uscita: dopo 30 giorni, oppure se F7 torna sopra la base dello 0,01% e il prezzo chiude sotto la media a 20 giorni.
- Al massimo un'operazione per episodio.
Confrontare con ingressi casuali della stessa durata nello stesso periodo.

**Prove.**

- [The Block - Bitcoin hits longest negative funding streak this decade as K33 flags short squeeze risk](https://www.theblock.co/news/markets/2026-05-06-bitcoin-longest-negative-funding-streak-this-decade-k33-flags-short-squeeze-risk-400182) (gestore o exchange): Media a 30 giorni del funding negativa per 67 giorni di fila (2026). K33 riporta probabilità di guadagno dell'83-96% comprando in questi periodi, su orizzonti da 30 a 360 giorni, contro il 55-70% di date casuali dal 2018. Pochi episodi, nessun costo, nessun test fuori campione.
- [Ruby's Quant Journal - Day 16: Funding-Crowding Edge Survives Only in Panic Regimes (e follow-up walk-forward)](https://askrubyai.github.io/blog/posts/2026-02-26-funding-regime-filter/index.html) (pratico con backtest): Il ritorno verso la media del funding su BTC ed ETH perde forza nel tempo. Solo un filtro di panico ad alta volatilità tiene nel 2025 (+20,88 punti base per operazione contro -0,65). Il walk-forward ha un intervallo di confidenza che comprende lo zero; non si ripete su ETH. Un test successivo lo giudica 'NOT DEPLOYABLE'.
- [Fulgur Ventures - Bitcoin funding rates and price predictability (Medium)](https://medium.com/@fulgur.ventures/bitcoin-funding-rates-and-price-predictability-27ce95535af1) (pratico con backtest): Regressione del funding BitMEX sul rendimento delle 8 ore successive: relazione leggermente negativa, R² di 0,003. Quasi nessun potere a breve termine.

**Fuori campione.** Fuori campione non è dimostrata. Le statistiche favorevoli vengono da report di gestori citati dalla stampa (K33, VanEck: +11,5% medio a 30 giorni contro +4,5%) senza costi né test fuori campione. I test walk-forward indipendenti non sono significativi. Nel nostro periodo ci saranno pochissimi episodi (forse 1-3): il test sarà più descrittivo che statistico.

**Come fallisce.** - Nei mercati ribassisti veri il funding negativo può durare a lungo mentre il prezzo scende ancora (rischio di fase di mercato).
- Campione minuscolo.
- Il funding negativo è anche l'effetto di coperture istituzionali (short perpetual contro long spot o ETF), non solo di paura: il segnale si diluisce.

### Rimbalzo dopo lo svuotamento della leva (OI che crolla con il prezzo)

Priorità 3. Mercati: I 36 perpetual, 4 ore; più affidabile su BTC/ETH/SOL.. Provabile con i nostri dati: sì (OI e candele a 4 ore (disponibili). Meglio: dati di liquidazione per coin e candele a 1 ora o meno.).

Nelle cascate di liquidazione le vendite forzate escono a prezzi peggiori del giusto (concessione), e poi il prezzo recupera in parte. Il recupero cresce con il volume forzato. Un forte calo simultaneo di OI e prezzo in poche ore indica liquidazioni forzate, non vendite informate.

**Regole.** Sulle candele a 4 ore, per ogni coin:
- Segnale: OI in calo di almeno il 10% nelle ultime 6 candele (24 ore) E rendimento della candela o delle ultime 2 candele inferiore a -2,5 ATR(14) E funding dell'ultimo regolamento sceso rispetto alla media a 7 giorni.
- Entrata: long all'apertura della candela successiva, solo se la candela del segnale chiude nella metà superiore del suo range (assorbimento).
- Stop: sotto la minima della candela del segnale meno 0,5 ATR.
- Target: 1,5R, oppure uscita a tempo dopo 6 candele (24 ore).
- Rischio 0,5% per operazione, al massimo 3 posizioni insieme (eventi correlati).
- Variante BTC: niente entrate se il calo nasce da una notizia esogena; non programmabile, quindi da testare con e senza esclusione manuale degli eventi noti.

**Prove.**

- [Zhang, Wang - The Anatomy of Liquidation Cascades: Account-Level Evidence from a Transparent Perpetual Futures Market (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7718598) (accademica): Su 20 cascate di ETH su Hyperliquid, le vendite forzate escono con una concessione di prezzo, e la concessione e il recupero successivo crescono con il volume forzato. La distanza tra i livelli di liquidazione anticipa se la cascata si propaga.
- [Lim - Anatomy of a Crypto Cascade: Minute-Level Evidence from the October 2025 Crash (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6579278) (accademica): Su Binance e Bybit i future hanno guidato il crollo. Il prezzo di riferimento usato per le liquidazioni è sceso sotto sia lo spot sia i future, creando un circolo vizioso.
- [Measuring the engine of a liquidation cascade (arXiv 2608.03616)](https://arxiv.org/html/2608.03616) (accademica): La cascata di ottobre 2025 non si è avvicinata al punto critico: è stata un'ondata esogena concentrata all'inizio, con la maggior parte delle vendite forzate nei primi 30 minuti.
- [Amberdata/Kaiko - How $3.21B Vanished in 60 Seconds: October 2025 Crypto Crash Explained](https://blog.amberdata.io/how-3.21b-vanished-in-60-seconds-october-2025-crypto-crash-explained-through-7-charts) (gestore o exchange): L'OI totale è sceso di circa il 25% (altre fonti riportano -27,5% o -43% sui perpetual), con la profondità visibile del libro ordini crollata. Gli stessi dati che usiamo come proxy delle liquidazioni.

**Fuori campione.** Le prove sono recenti (2025-2026), su pochi eventi e in parte su Hyperliquid, non su Binance. Un lavoro preliminare dell'AEA 2026 trova invece un impatto di prezzo delle liquidazioni limitato. Non ho trovato un backtest pubblicato su Binance a 4 ore. È da costruire noi.

**Come fallisce.** - La cascata continua ('afferrare il coltello'): il 10 ottobre 2025 sui coin minori i cali sono stati estremi.
- Le candele a 4 ore sono grossolane: il rimbalzo può avvenire tutto dentro la candela del segnale.
- L'OI cala anche per chiusure volontarie, non solo per liquidazioni.
- Lo slittamento nei momenti di crollo è molto più alto dello 0,1% ipotizzato.

### Divergenza OI-prezzo come filtro di conferma (verifica del filtro attuale)

Priorità 3. Mercati: I 36 perpetual, 4 ore.. Provabile con i nostri dati: sì (OI, funding e candele a 4 ore (disponibili).).

Il nostro sistema usa già 'OI in crescita' come filtro. L'idea comune: prezzo e OI che salgono insieme indicano denaro nuovo che entra nel trend; un prezzo che sale con l'OI in calo indica short che si ricoprono, un movimento che si esaurisce. Il funding fa da arbitro: OI in crescita con funding molto alto indica leva affollata, non conferma sana.

**Regole.** Prova in tre bracci sul sistema attuale (stesso segnale di rottura, stop a 3 ATR, target 3R, rischio 1%):
(A) nessun filtro OI;
(B) filtro attuale: OI in crescita;
(C) filtro a tre stati:
- entrata solo se la variazione dell'OI a 24 ore (6 candele) è > 0 E E7 del coin non è nel quintile più alto (per i long) o più basso (per gli short);
- nessun long se il prezzo sale con l'OI in calo di oltre il 3% (ricopertura di short);
- nessun short se il prezzo scende con l'OI in calo di oltre il 3% (liquidazione di long già avvenuta).
Confrontare rendimento, calo massimo, numero di operazioni e attesa per operazione. Una differenza conta solo se si ripete in ognuno dei 3 anni.

**Prove.**

- [TradingView - Understanding crypto open interest](https://www.tradingview.com/support/solutions/43000762388-understanding-crypto-open-interest/) (aneddotica): Descrive la lettura combinata di OI, volume e funding; è una regola empirica, non un test.
- [Smart Money API - Open Interest Explained](https://smartmoneyapi.com/resources/education/open-interest-explained) (aneddotica): Dichiara un successo 'oltre il 70%' per le rotture con OI in crescita, senza campione, periodo né metodo: affermazione non verificabile.
- [Studio sulla volatilità dei future su Bitcoin (ScienceDirect, International Review of Financial Analysis 2023)](https://www.sciencedirect.com/science/article/abs/pii/S1057521923000133) (accademica): La volatilità di BTC sale con il volume inatteso dei future ma scende con l'OI inatteso nel lungo periodo: il legame OI-volatilità è più solido di quello OI-direzione.

**Fuori campione.** Non ho trovato prove rigorose che l'OI anticipi la direzione: solo regole empiriche e affermazioni senza dati. L'unica verifica possibile è il nostro test con i bracci sopra. Per ora il filtro attuale va trattato come un'ipotesi, non come un vantaggio dimostrato.

**Come fallisce.** - L'OI aggregato di Binance non comprende le altre piazze.
- L'OI cresce anche per coperture (short contro spot o ETF), non solo per scommesse direzionali.
- Filtri aggiunti riducono il numero di operazioni e aumentano il rischio di overfitting.

### Carry in sezione trasversale neutrale al mercato (long funding basso, short funding alto)

Priorità 4. Mercati: I 36 perpetual USDT di Binance, giornaliero/settimanale.. Provabile con i nostri dati: sì (Funding a 8 ore, candele a 4 ore e giornaliere dei 36 coin (disponibili). Per correggere il bias di sopravvivenza servirebbe anche la lista dei coin delistati.).

Il funding pagato da un coin misura quanto i long sono affollati e quanto pagano per la leva. Stare short sui coin con funding alto incassa quel premio; stare long su quelli con funding basso o negativo lo riceve o lo paga poco. Neutralizzare il mercato toglie la direzione e lascia il premio. Le prove dicono che il guadagno viene dall'incasso del funding più che dalla previsione del prezzo.

**Regole.** Ogni lunedì alle 00:00 UTC:
- Universo: coin con almeno 60 giorni di storia e volume medio sopra la mediana dell'universo.
- Segnale: F7 = media degli ultimi 21 funding regolati.
- Long sul quintile più basso di F7 (circa 7 coin), short sul quintile più alto (circa 7 coin).
- Pesi: inverso della volatilità giornaliera a 20 giorni, normalizzati a lordo 1x (0,5 long, 0,5 short), massimo 15% per coin.
- Ribilanciamento settimanale. Banda di non-scambio: si cambia un coin solo se esce dal terzile estremo, per ridurre il turnover.
- Profitti e perdite = variazione di prezzo + funding incassato o pagato ogni 8 ore - costi (0,055% + 0,1% per lato).
- Stop di portafoglio: se il calo dal massimo supera il 15%, esposizione dimezzata per 4 settimane.
- Esclusioni: nessuno short su coin con annuncio di delisting (vedi miti) o con funding al limite massimo per più di 3 regolamenti di fila (rischio di squeeze).
Misure: Sharpe netto, calo massimo, quota di profitto da funding contro quota da prezzo, turnover.

**Prove.**

- [Alpha Research, Paper 2 - Crypto Carry: the funding-rate cross-section (serie indipendente, bryanvine.github.io)](https://bryanvine.github.io/alpha-research/paper2.html) (pratico con backtest): Il fattore neutrale al dollaro (long funding basso, short funding alto) è un vantaggio modesto ma reale: Sharpe netto di circa 0,4 fuori campione (0,71 nel campione, 0,63 deflazionato), al netto di 6 punti base per lato. Calo massimo del 35% fino a metà 2024, poi positivo nel 2025-2026. Il guadagno viene dallo spread di funding; l'inversione dei long affollati è al massimo un leggero vento a favore. Correlazione di rango tra funding passato e rendimento a 7 giorni: -0,005, non significativa.
- [Alpha Research, Paper 6 - Finale](https://bryanvine.github.io/alpha-research/paper6.html) (pratico con backtest): Il carry da funding cripto è tra i pochi vantaggi che reggono ai costi, con Sharpe tra 0,39 e 0,53 insieme a trend cripto e carry valutario.
- [Presto Labs - Can Funding Rate Predict Price Change?](https://www.prestolabs.io/research/can-funding-rate-predict-price-change) (gestore o exchange): Le variazioni del funding spiegano circa il 12,5% della variazione di prezzo a 7 giorni. Prevedere il singolo coin è difficile; il dato è più utile in sezione trasversale su un paniere di coin. Il verso del legame non è chiaro negli estratti.
- [Koijen, Moskowitz, Pedersen, Vrugt - Carry (JFE 2018)](https://research-api.cbs.dk/ws/files/57294842/lasse_heje_pedersen_et_al_carry_acceptedmanuscript.pdf) (accademica): Il carry anticipa i rendimenti sia in sezione trasversale sia nel tempo in molte classi di attivi. Base teorica per usare il funding come carry.

**Fuori campione.** Secondo una sola fonte indipendente non replicata, il fattore regge fuori campione al netto dei costi (Sharpe netto di circa 0,4) nel periodo 2023-2026, quasi identico al nostro, ma con un calo del 35% fino a metà 2024. Su Hyperliquid, dopo il 2024, i movimenti di prezzo hanno cancellato l'incasso del funding (Robot Wealth): il risultato dipende dalla piazza. Attenzione: i nostri costi (0,155% per lato) sono molto più alti dei 6 punti base usati in quel test, e possono mangiare gran parte di uno Sharpe di 0,4.

**Come fallisce.** - Short squeeze sui coin con funding alto: spesso sono coin in forte trend rialzista, e il fattore va contro il momentum.
- Delisting: i funding più alti sono spesso coin in uscita (HackerNoon).
- Bias di sopravvivenza: i nostri 36 coin sono scelti oggi e sono i sopravvissuti (MATIC/POL, FTM, RNDR rinominati).
- Costi alti contro un vantaggio piccolo.
- Funding dei coin piccoli schiacciato ai limiti della formula: segnale saturo.

### Termometro del carry: filtro anti-crollo per il sistema trend esistente

Priorità 5. Mercati: Futures perpetual USDT di Binance: BTC per il segnale, il paniere dei 36 coin per il filtro sui singoli coin.. Provabile con i nostri dati: sì (Funding a 8 ore e OI dei 36 coin, candele a 4 ore (già disponibili). Utile ma non indispensabile: dati di liquidazione per misurare l'evento.).

Un funding alto e diffuso misura la leva dei piccoli che inseguono il trend. BIS WP 1087 mostra che un carry alto anticipa i crolli e coincide con protezioni dal crash più care. Come nel carry valutario, i crolli arrivano quando la leva si scioglie tutta insieme. Prima del 10 ottobre 2025 il funding di BTC era salito da circa il 10% a quasi il 30% annuo. Il nostro sistema va long quando BTC sale, cioè proprio quando il carry è caldo: questo filtro dovrebbe tagliare le perdite più grosse.

**Regole.** Dati: funding a 8 ore dei 36 coin, open interest (OI), candele a 4 ore e giornaliere. Ogni giorno alle 00:00 UTC, usando solo funding già regolati (nessun dato futuro):
- F7(coin) = media degli ultimi 21 funding; annualizzato = F7 x 3 x 365.
- Eccesso E7 = F7 - 0,01% (il valore base della formula Binance). Conta lo scostamento dalla base, non il livello.
- Indice del paniere CALDO = mediana di E7 sui coin disponibili.
- Segnale CALDO: CALDO sopra il suo 90° percentile mobile a 180 giorni E OI di BTC in crescita di oltre il 15% in 14 giorni. Varianti da provare: soglie 80/90/95 e 10/15/20%, niente altro, per evitare l'overfitting.
Azioni con segnale CALDO:
(a) nuovi long del sistema con rischio 0,5% invece dell'1%;
(b) trailing dei long aperti stretto da 3 a 2 ATR;
(c) nessun nuovo long sui coin con E7 nel quintile più alto.
Segnale FREDDO (CALDO < 0, cioè funding sotto la base): rischio dei nuovi short dimezzato, perché c'è rischio di short squeeze.
Il segnale si spegne quando CALDO scende sotto il 70° percentile.
Confronto con il sistema base: rendimento, calo massimo, Calmar, perdita nella finestra 6-12 ottobre 2025 e nei cali di aprile 2024 e agosto 2024. Costi 0,055% per lato più 0,1% di slittamento.

**Prove.**

- [Schmeling, Schrimpf, Todorov - Crypto carry, BIS Working Paper 1087 (poi CEPR DP20719, in uscita su Management Science)](https://www.bis.org/publ/work1087.htm) (accademica): Il carry (base future-spot) arriva al 40-60% annuo. Lo spiegano soprattutto la domanda di leva dei piccoli che inseguono il trend e la scarsità di capitale per l'arbitraggio, non i tassi. Un carry alto anticipa i crolli e sale insieme al prezzo delle protezioni dal crash (letto dagli estratti; testo completo non accessibile).
- [Brunnermeier, Nagel, Pedersen - Carry Trades and Currency Crashes (NBER Macroeconomics Annual 2008)](https://www.nber.org/papers/w14473) (accademica): Differenziali di carry alti anticipano un'asimmetria negativa: i crolli arrivano quando le posizioni carry si sciolgono tutte insieme, nelle fasi in cui la voglia di rischio e la liquidità calano.
- [FTI Consulting - Crypto Crash Oct 2025: Leverage Meets Liquidity](https://www.fticonsulting.com/insights/articles/crypto-crash-october-2025-leverage-met-liquidity) (gestore o exchange): Prima del crollo il funding era salito da circa il 10% a quasi il 30% annuo (6 ottobre). Leva alta e auto-deleveraging hanno trasformato il calo in una spirale di liquidazioni.
- [Koijen, Moskowitz, Pedersen, Vrugt - Carry (Journal of Financial Economics 2018)](https://www.nber.org/papers/w19325) (accademica): Il carry anticipa i rendimenti in tutte le classi di attivi, ma perde nelle recessioni e nei momenti di stress di liquidità e volatilità: è un premio per il rischio.

**Fuori campione.** Il legame tra carry alto e crolli è pubblicato dal 2023, e il 10 ottobre 2025 (dopo la pubblicazione) è andato nel verso previsto: funding salito a circa il 30% annuo, poi la più grande liquidazione della storia (circa 19 miliardi di dollari). Non ho trovato un backtest pubblico di questo filtro applicato a un sistema trend: va misurato da noi. Il nostro campione (novembre 2023 - ottobre 2026) contiene il boom del carry del 2024 (funding di BTC su Binance sopra il 100% annualizzato secondo CoinDesk, citato in ricerca) e la compressione dopo ottobre 2025: è un buon banco di prova.

**Come fallisce.** - Il carry può restare caldo per mesi mentre il prezzo sale (inizio 2024): il filtro costa rendimento nei rally.
- I crolli da notizia (dazi, hack) arrivano anche con funding normale (vedi arXiv 2607.27070: nessun segnale anticipatore negli shock da notizia).
- Pochi episodi estremi in 3 anni: rischio di adattare la soglia al singolo evento di ottobre 2025.
- Lo spostamento nel tempo dei funding (regolati ogni 8 ore) può introdurre dati futuri se allineato male alle candele a 4 ore.

### Miti

- **L'arbitraggio del funding (short perpetual più long spot) è reddito passivo senza rischio.** È neutrale al prezzo ma non è senza rischio. I rischi principali:
- il funding può invertirsi e diventare negativo;
- la gamba short può essere liquidata in un rialzo improvviso;
- l'auto-deleveraging ha chiuso le coperture short il 10 ottobre 2025, lasciando scoperta la gamba spot;
- la piazza può fallire o bloccare i prelievi;
- la stablecoin può perdere l'aggancio;
- c'è il rischio di base.
He e coautori sottolineano che manca una scadenza in cui chiudere sicuramente in profitto. Un rendimento da cifra singola a bassa doppia cifra paga poco per il rischio di insolvenza della piazza.
- **Il carry cripto rende con Sharpe da 6 a 10, basta incassarlo.** Quegli Sharpe sono nel campione e riguardano il periodo 2020-2023. Borri e coautori: Sharpe 6,45 su tutto il campione, 4,06 dal 2024, negativo nel 2025. He e coautori: rendimento su BTC dal 64,8% (2021) al 21,4% (2024), deviazioni in calo di circa l'11% l'anno. Nel terzo trimestre 2025 il funding di BTC era fermo al valore base dello 0,01% per il 78% del tempo.
- **Il funding annualizzato più alto della classifica è l'occasione migliore.** La cima della classifica per funding è spesso fatta di coin in delisting, il cui flusso di pagamenti termina a una data già annunciata (Binance chiude e regola d'ufficio le posizioni). Funding sopra il 100% annuo sono spesso trappole da short squeeze. È una selezione avversa.
- **Funding molto alto significa massimo vicino: vai short subito. Funding negativo significa minimo: compra subito.** Il funding spiega quasi nulla del prezzo a breve: R² di 0,003 sulle 8 ore, correlazione di rango di -0,005 con i rendimenti a 7 giorni su circa 30 coin nel 2023-2026. In certe fasi il funding estremo è momentum, non inversione. Il funding alto anticipa i crolli come rischio, non come data: può restare alto per mesi in un rally (inizio 2024). Gli episodi di funding negativo favorevoli sono pochi e non superano i test walk-forward.
- **Funding allo 0,01% per 8 ore significa che il mercato è a leva rialzista (i long pagano).** Lo 0,01% per 8 ore (circa 11% annuo) è il valore base fisso della formula di Binance e delle grandi piazze, non un segnale di sentiment. Il dato informativo è lo scostamento da quella base. Un agente che legge il livello invece dell'eccesso vedrà 'long affollati' per il 78-92% del tempo.
- **Rottura con open interest in crescita: successo oltre il 70%. Rapporto long/short sopra il 70%: correzione in arrivo.** Nessuna delle fonti che lo affermano riporta campione, periodo o metodo. Non ho trovato studi rigorosi che mostrino potere di previsione dell'OI o del rapporto long/short sulla direzione. La letteratura accademica trova legami più solidi tra OI e volatilità che tra OI e direzione.
- **Le mappe di calore delle liquidazioni permettono di prevedere le cascate.** Gli studi sulle cascate trovano segnali anticipatori in alcuni eventi ma non negli shock da notizia (dazi). Quella di ottobre 2025 è stata un'ondata esogena concentrata nei primi 30 minuti, non una reazione a catena interna prevedibile. Anche il prezzo di riferimento usato dalle piazze per liquidare può andare sotto spot e future, rendendo i livelli 'previsti' inaffidabili.
- **Il rendimento delle stablecoin 'delta neutral' (tipo sUSDe) è stabile e sicuro.** Viene dal funding, quindi segue le sue fasi. Dopo il crollo di ottobre 2025 il funding è sceso, il rendimento è sceso a circa il 3-4% e l'offerta di USDe è calata di circa il 40%. Con funding negativo il rendimento può andare a zero o sotto.
- **Funding allineato al contesto delle 4 ore 'governa' espansioni e compressioni del prezzo.** L'unico lavoro che lo sostiene (arXiv 2601.06084) è un quadro concettuale: negli estratti non ci sono né campione, né test, né risultati statistici. È un'ipotesi, non una prova.

### Da leggere

- [Crypto carry - Schmeling, Schrimpf, Todorov (BIS Working Paper 1087)](https://www.bis.org/publ/work1087.pdf): Il carry cripto (base o funding) arriva al 40-60% annuo. Lo spiegano la domanda di leva di chi insegue il trend e la scarsità di capitale per l'arbitraggio, non i tassi. Un carry alto anticipa i crolli: è un premio per il rischio di crash.
- [Fundamentals of Perpetual Futures - He, Manela, Ross, von Wachter (arXiv 2212.06888)](https://arxiv.org/abs/2212.06888): Prezzo teorico del perpetual e limiti di non arbitraggio con costi. Le deviazioni calano di circa l'11% l'anno e si muovono insieme tra i coin. Arbitraggio a scadenza casuale con Sharpe 1,8 con costi retail. Il rendimento su BTC è sceso dal 64,8% al 21,4% (2021-2024).
- [Perpetual Futures Pricing - Ackerer, Hugonnier, Jermann (arXiv 2310.11771; Mathematical Finance 2025)](https://arxiv.org/abs/2310.11771v2): Formula di non arbitraggio del perpetual e condizioni del funding per cui prezzo del perpetual e spot coincidono: serve a capire cosa misura davvero il funding.
- [Cryptocurrency as an Investable Asset Class: Coming of Age - Borri, Liu, Tsyvinski, Wu (arXiv 2510.14435)](https://arxiv.org/html/2510.14435v1): Il carry cripto vive di funding. Sharpe da 6,45 (2020-2025) a 4,06 (dal 2024) a negativo (2025): la prova numerica della compressione.
- [The Crypto Carry Trade - Christin, Routledge, Soska, Zetlin-Jones (CMU working paper)](https://www.andrew.cmu.edu/user/azj/files/CarryTrade.v1.0.pdf): Perché il carry esisteva: disaccordo tra speculatori a leva e arbitraggisti con poco capitale, più i limiti massimi del funding. Sharpe nel campione 5-10, che scenderebbe al livello delle azioni con funding basso.
- [Carry - Koijen, Moskowitz, Pedersen, Vrugt (manoscritto accettato, JFE 2018)](https://research-api.cbs.dk/ws/files/57294842/lasse_heje_pedersen_et_al_carry_acceptedmanuscript.pdf): Il carry anticipa i rendimenti in tutte le classi di attivi, ma perde in recessioni e stress di liquidità. Base teorica per trattare il funding come carry.
- [Carry Trades and Currency Crashes - Brunnermeier, Nagel, Pedersen (NBER w14473)](https://www.nber.org/papers/w14473): Il carry ha rischio di crollo (asimmetria negativa), dovuto allo scioglimento improvviso delle posizioni quando la liquidità sparisce. Lo stesso meccanismo delle cascate di liquidazione cripto.
- [Basis-Momentum - Boons, Prado (Journal of Finance 2019)](https://ideas.repec.org/a/bla/jfinan/v74y2019i1p239-279.html): La variazione della struttura dei future anticipa i rendimenti delle materie prime: modello per usare la variazione del funding come segnale. L'articolo pubblicato è a pagamento; una versione di lavoro è sul sito NBER.
- [The Anchor and the Ceiling: Understanding the Structure of Funding Rates - BitMEX Q3 2025 Derivatives Report](https://www.bitmex.com/blog/2025q3-derivatives-report): Il funding sta al valore base dello 0,01% per 8 ore per il 78% (BTC) e l'87% (ETH) del tempo, ed è positivo oltre il 92% del tempo. Va letto come scostamento dalla base.
- [Introduction to Binance Futures Funding Rates (Binance FAQ)](https://www.binance.com/en/support/faq/360033525031): Funding alle 00, 08 e 16 UTC, interesse base dello 0,01% per intervallo, limiti della formula. Necessario per allineare correttamente i dati ed evitare di usare dati futuri.
- [Alpha Research Paper 2 - Crypto Carry: the funding-rate cross-section (bryanvine.github.io)](https://bryanvine.github.io/alpha-research/paper2.html): Distinzione chiave: il trade sul livello del funding è esaurito; il fattore neutrale in sezione trasversale regge con circa 0,4 di Sharpe netto e un calo massimo del 35%. Fonte indipendente non verificata da altri.
- [The Anatomy of Liquidation Cascades: Account-Level Evidence from a Transparent Perpetual Futures Market - Zhang, Wang (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7718598): Le vendite forzate escono con una concessione di prezzo seguita da un recupero, entrambi crescenti con il volume forzato. Base per le strategie di rimbalzo dopo le liquidazioni.
- [Anatomy of a Crypto Cascade: Minute-Level Evidence from the October 2025 Crash - Lim (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6579278): I future hanno guidato il crollo; il prezzo di riferimento per le liquidazioni è sceso sotto spot e future, creando un circolo vizioso.
- [A systematic crypto trading strategy using perpetual futures (Coinbase Institutional)](https://www.coinbase.com/institutional/research-insights/research/trading-insights/perpetual-futures-trading-strategy): Esempio didattico di cash and carry su BTC: più lunga è la tenuta, più alto il rendimento annualizzato, perché i costi fissi si diluiscono. È un backtest ipotetico del 2022.
- [Can Funding Rate Predict Price Change? (Presto Labs)](https://www.prestolabs.io/research/can-funding-rate-predict-price-change): Il funding prevede poco il singolo coin ma ha più valore in sezione trasversale.
- [Funding rate arbitrage (Kraken Learn) e Funding rate arbitrage (Ledger Academy)](https://www.kraken.com/learn/futures-trading-funding-rate-arbitrage): Manuali didattici sui rischi del cash and carry: inversione del funding, liquidazione della gamba short, rischio di base, rischio della piazza.
- [Hyperliquid Carry Looks Trendy (Robot Wealth)](https://edgealchemy.robotwealth.com/p/hyperliquid-carry-looks-trendy): Lo stesso carry ha reso su Binance ma dopo il 2024 su Hyperliquid i movimenti di prezzo hanno cancellato il funding: va sempre separato il guadagno da funding da quello da prezzo. Possibile accesso parziale a pagamento.

### Lezioni per gli agenti

Come ragiona un trader di questa scuola:

1) Il carry è un pagamento per il rischio di crollo, non denaro gratis. Prima di incassarlo, chiediti chi te lo paga e perché. Di solito sono piccoli investitori a leva che inseguono il trend. Poi chiediti cosa succede quando la leva si scioglie tutta insieme.

2) Leggi lo scostamento, non il livello. Su Binance lo 0,01% per 8 ore (circa 11% annuo) è il valore base della formula. Il segnale è E = funding - 0,01%, confrontato con la sua storia (percentili mobili), non con soglie fisse prese dai social.

3) Separa sempre il risultato in due parti: guadagno dal funding e guadagno dal prezzo. Una strategia di carry che guadagna soprattutto dal prezzo è una scommessa direzionale travestita.

4) Calcola il punto di pareggio prima di entrare. Con 0,155% per lato e 4 operazioni, un cash and carry al valore base impiega circa 21 giorni solo per ripagare i costi.

5) Il carry si è compresso. Sharpe negativo nel 2025, deviazioni in calo di circa l'11% l'anno, rendimenti delle stablecoin 'delta neutral' scesi al 3-4% dopo ottobre 2025. Non costruire piani sui numeri del 2021 o del 2024. Verifica sempre per sottoperiodo (2024, 2025, 2026).

6) Usa il funding e l'OI più come termometro del rischio che come previsione del prezzo. Funding caldo e diffuso più OI in forte crescita: riduci la leva e stringi gli stop sui long del sistema trend. Funding negativo e diffuso: attenzione agli short, rischio di squeeze.

7) Preferisci la sezione trasversale al timing sul singolo coin. Il funding prevede quasi nulla sul singolo coin a breve termine (R² 0,003), ma l'ordinamento tra coin ha mostrato un vantaggio modesto (Sharpe netto circa 0,4).

8) Diffida dei funding estremi sui singoli coin. Controlla delisting, nuovi listing, limiti della formula e cambi dell'intervallo di funding. La cima della classifica è spesso selezione avversa.

9) Igiene dei dati:
- usa solo funding già regolati (00, 08, 16 UTC) allineati alla candela a 4 ore che segue, mai il funding stimato del periodo in corso;
- ricorda il bias di sopravvivenza dei 36 coin scelti oggi;
- non considerare un numero da report di gestore o da post social come prova finché non l'hai replicato.

10) Pochi eventi estremi decidono tutto: ottobre 2025, i picchi del 2024. Prova al massimo 2-3 soglie per regola, una sola verifica fuori campione, e dichiara quanti episodi reggono la conclusione. Se sono meno di 10, è un'osservazione, non una strategia.

11) Domande da farsi ogni giorno:
- Il funding medio del paniere è sopra o sotto la base? In quale percentile?
- L'OI cresce più del prezzo?
- Le coperture (ETF, basis trade) stanno entrando o uscendo?
- Se domani c'è una cascata, quale gamba delle mie posizioni viene chiusa per prima (liquidazione o ADL)?

12) Errori da evitare:
- chiamare 'senza rischio' un trade neutrale;
- inseguire l'APR più alto;
- leggere il rapporto long/short o l'OI come verità senza backtest;
- confondere una crescita dell'OI dovuta a coperture con una crescita dovuta a scommesse.

## 4. Sentiment, paura e avidità della folla (Fear & Greed, social, Google Trends, influencer, capitolazione, euforia) applicati alle cripto

Avvertenza sul metodo: in questa sessione WebFetch era bloccato per quasi tutti i siti (arxiv.org, ssrn, nber, springer, cfr-cologne). Ho letto le fonti attraverso abstract, schede bibliografiche (RePEc, EconPapers, IDEAS) ed estratti restituiti da WebSearch, non i PDF completi. I numeri riportati vengono da lì. Dove ho visto solo la sintesi di un terzo, lo dico.

Cosa ho imparato:
1) L'idea più diffusa, "compra la paura estrema e vendi l'avidità estrema", ha prove deboli. L'unico studio peer-reviewed sul Fear & Greed delle cripto (Cavalheiro, Vieira e Thue, 2024) copre solo un anno di dati settimanali. I backtest divulgativi battono il comprato-e-tenuto di poco (1.145% contro 1.046%, senza commissioni). Altre analisi trovano che l'avidità estrema è seguita da altri rialzi, quindi conta come momentum e non come segnale contrario. Shortare l'euforia è la parte più pericolosa.
2) L'attenzione (ricerche Google, numero di tweet, volume anomalo) spinge i prezzi su nel brevissimo, da 1 giorno a poche settimane, e poi spesso si inverte (Da, Engelberg e Gao; Maître, Pugachyov e Weigert; Liu e Tsyvinski). Molto spesso però è il prezzo a muovere l'attenzione e non il contrario (Urquhart 2018; Kristoufek 2013 trova un legame bidirezionale). Con Google Trends è facile ingannarsi con il data-snooping (Challet e Bel Hadj Ayed).
3) Nei derivati il sentiment più solido che abbiamo nei nostri dati è il funding/carry. Per BIS WP 1087 (Crypto carry) un carry alto prevede crolli. K33 riporta che i lunghi periodi di funding negativo sono stati seguiti da rendimenti migliori, ma solo su 6 episodi, e c'è una spiegazione alternativa: shortano i desk delta-neutrali, non gli orsi. Secondo la sintesi di un survey del 2025, il carry si è compresso dal 2024.
4) Seguire la folla dei social costa. Il 55% dei finfluencer di StockTwits è "antiskilled": seguirli rende -2,3% al mese, andargli contro +1,2% al mese fuori campione (azioni, non cripto). Il valore informativo di WallStreetBets è sparito dopo GameStop, quando il segnale è diventato popolare. L'ETF Inverse Cramer ha perso il 15% ed è stato chiuso.
5) Panico e capitolazione: dopo un giorno di movimento anomalo il prezzo tende a continuare nello stesso verso fino a fine giornata. Il rimbalzo esiste soprattutto sui perdenti, su orizzonti di settimane (Dobrynskaya), e le commissioni mangiano gran parte del vantaggio (Caporale e Plastun).

Conclusione pratica: con i nostri dati (OHLCV a 4 ore, funding, open interest, long/short dei top trader) il sentiment serve soprattutto come freno al rischio quando la folla è affollata dallo stesso lato e come filtro di regime. Come segnale d'ingresso autonomo vale poco. Fear & Greed di alternative.me, Google Trends e i dati social non sono nel nostro dataset: si possono solo approssimare con indicatori costruiti dal prezzo, oppure aggiungere in seguito.

### Contro i finfluencer 'antiskilled' e l'euforia dei social (solo con dati social, non disponibili)

Priorità 1. Mercati: Altcoin con forte presenza social; non BTC.. Provabile con i nostri dati: no (Serie storiche di post e sentiment da X/StockTwits/Reddit/TikTok per moneta, con filtro dei bot. Non sono nel nostro dataset.).

La maggior parte dei finfluencer insegue momentum di prezzo e sentiment: chi li segue perde. I pochi bravi fanno il contrario (positivi dopo i cali, negativi dopo i rialzi). Andare contro il consenso dei social più rumorosi ha reso fuori campione nelle azioni.

**Regole.** Richiede dati che non abbiamo (StockTwits, X, TikTok). Una versione futura: per ogni moneta, quota di post rialzisti degli account più seguiti negli ultimi 7 giorni; quando supera il 90° percentile di 1 anno e la moneta è salita più del 30% in 14 giorni, niente nuovi long per 2 settimane. Nessun short sulla base dei soli social. Nel frattempo si può usare solo come regola qualitativa per gli agenti: un trade suggerito dai social conta come segnale di folla, non come prova.

**Prove.**

- [Kakhbod, Kazempour, Livdan, Schuerhoff - Finfluencers (SSRN 4428232; versione pubblicata dagli autori)](https://www.akakhbod.com/uploads/1/3/9/6/13965273/finfluencers.pdf) (accademica): Oltre 29.000 finfluencer su StockTwits: 28% bravi, 16-17% senza abilità, 55-56% 'antiskilled'. Seguire gli antiskilled rende -2,3% al mese; andargli contro +1,2% al mese fuori campione. I peggiori hanno più follower e più influenza.
- [Bradley, Hanousek, Jame, Xiao - Place Your Bets? The Value of Investment Research on Reddit's Wallstreetbets, Review of Financial Studies 37(5) 2024](https://econpapers.repec.org/RePEc:oup:rfinst:v:37:y:2024:i:5:p:1409-1459.) (accademica): Prima di GameStop le analisi di WSB prevedevano i rendimenti. Dopo GameStop il potere predittivo è sparito, insieme a un'ondata di post su strategie di pressione sui prezzi: il segnale muore quando diventa popolare.
- [Kraaijeveld e De Smedt - The predictive power of public Twitter sentiment for forecasting cryptocurrency prices, JIFMIM 65 (2020)](https://core.ac.uk/download/391332344.pdf) (accademica): Il sentiment di Twitter ha un certo potere predittivo (Granger) per alcune cripto (EOS, LTC, ADA, XLM, TRX), ma circa il 14% degli account attivi nel mondo cripto sono bot.

**Fuori campione.** Il risultato contrarian sui finfluencer è fuori campione ma riguarda le azioni USA, non le cripto. Su WSB il segnale è morto dopo la pubblicità. Su Twitter cripto altri lavori (Ciganovic 2023, letto in sintesi) trovano che il sentiment non causa i rendimenti, semmai il contrario.

**Come fallisce.** Mancano i dati. I bot e le campagne pagate falsano il sentiment. Il segnale cambia con la composizione della folla (dopo GameStop). Il rischio legale e etico è alto se si passa dal leggere al manipolare: da escludere.

### Google Trends come termometro dell'euforia (solo con dati esterni)

Priorità 2. Mercati: BTC e mercato cripto nel complesso.. Provabile con i nostri dati: no (Serie Google Trends (SVI) settimanali o giornaliere; non sono nel dataset.).

Picchi di ricerche come 'bitcoin' o 'buy bitcoin' segnalano l'ingresso di nuova folla al dettaglio, tipico delle fasi finali di bolla. Gli studi però trovano soprattutto un legame bidirezionale: prezzo e attenzione si spingono a vicenda.

**Regole.** Non programmabile con i nostri dati. Versione futura: SVI settimanale di 'bitcoin' al 95° percentile di 3 anni e BTC sopra +50% in 90 giorni → solo riduzione del rischio long al 50% (mai short). Prima di usarlo, test contro parole a caso per escludere il data-snooping, come in Challet e Bel Hadj Ayed.

**Prove.**

- [Kristoufek - BitCoin meets Google Trends and Wikipedia, Scientific Reports 3 (2013)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3849639) (accademica): Correlazione 0,88 tra prezzo e Google Trends e 0,83 con Wikipedia. Il legame è bidirezionale e collegato a bolle e crolli.
- [Aslanidis, Bariviera, López - The link between Bitcoin and Google Trends attention (arXiv 2106.07104)](https://ar5iv.labs.arxiv.org/html/2106.07104) (accademica): Legame in entrambe le direzioni tra attenzione su Google Trends e rendimenti di BTC, con ritardi fino a 6 giorni, stabile nei sotto-periodi.
- [Challet e Bel Hadj Ayed - Predicting financial markets with Google Trends and not so random keywords (arXiv 1307.4643)](https://arxiv.org/abs/1307.4643) (accademica): Con un backtest serio, parole chiave finanziarie scelte a caso non prevedono più di parole su malattie o auto d'epoca. Funzionano solo parole scelte con criterio su asset adatti. Avverte sui bias dei backtest.

**Fuori campione.** Il legame è stato documentato fino al 2019-2021. Non ho trovato test fuori campione di una strategia basata su Google Trends sulle cripto dopo il 2021.

**Come fallisce.** Google ridimensiona i dati e cambia i campioni, quindi la storia non è stabile (data revision). Il segnale si muove in ritardo rispetto al prezzo. È facile sovra-adattare la scelta delle parole.

### Shock di attenzione: volume anomalo come proxy dell'attenzione della folla (spinta breve poi inversione)

Priorità 3. Mercati: I 36 perpetual, sezione trasversale giornaliera.. Provabile con i nostri dati: sì (Candele 4h aggregate in giornaliere (volume e prezzo) per tutte le 36 monete.).

Quando una moneta attira attenzione improvvisa, i piccoli investitori comprano ciò che vedono: il prezzo sale nel brevissimo e poi in parte torna indietro. Maître, Pugachyov e Weigert misurano l'attenzione anomala come log del numero di tweet di oggi meno la media dei 30 giorni precedenti. Non avendo i tweet usiamo la stessa formula sul volume, che negli studi è legato all'attenzione (Urquhart: volume e volatilità guidano l'attenzione del giorno dopo).

**Regole.** Ogni giorno alle 00 UTC: AV = log(volume del giorno) - media dei log-volumi dei 30 giorni precedenti, per ognuna delle 36 monete. Test 1 (spinta): long le 5 monete con AV più alto e rendimento del giorno positivo, tenute 1 giorno, rischio 0,5% ciascuna, stop 2 ATR. Test 2 (inversione): short le stesse monete dal giorno 3 al giorno 20 (circa 3 settimane), stop 3 ATR, neutralizzando BTC con long BTC di pari importo. Prima del test si calcola la turnover: con 0,31% di costo andata e ritorno il test 1 deve rendere più di 0,31% medio per trade. Si confronta con un'estrazione casuale di 5 monete.

**Prove.**

- [Maître, Pugachyov, Weigert - Twitter-Based (Social Media-Based) Attention and the Cross-Section of Cryptocurrency Returns, CFR WP 25-02 / Journal of Banking & Finance 178 (2025)](https://ideas.repec.org/p/zbw/cfrwps/311833.html) (accademica): Dati 2018-2022. L'attenzione anomala su Twitter è associata positivamente al rendimento dello stesso giorno e del giorno dopo. La prevedibilità viene dai tweet degli utenti, non dagli account ufficiali dei progetti. Una versione parla di canale di sovrareazione con rendimenti poi più bassi, ma non ho potuto verificarlo sul testo pubblicato.
- [Da, Engelberg, Gao - In Search of Attention, Journal of Finance 66(5) 2011](https://econpapers.repec.org/RePEc:bla:jfinan:v:66:y:2011:i:5:p:1461-1499) (accademica): L'indice di ricerche Google misura l'attenzione dei piccoli investitori. I titoli che la attirano hanno una pressione sui prezzi positiva e temporanea, seguita da inversione (sintesi di un lavoro successivo degli stessi autori), significativa soprattutto nei titoli piccoli.
- [Liu e Tsyvinski - Risks and Returns of Cryptocurrency, NBER WP 24877 / Review of Financial Studies](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf) (accademica): I rendimenti cripto non dipendono dai fattori di azioni e macro. Sono prevedibili con il momentum di serie storica e con l'attenzione degli investitori. Un'attenzione alta prevede rendimenti più alti, anche fuori campione, mentre l'attenzione negativa si associa a rendimenti più bassi.
- [Urquhart - What causes the attention of Bitcoin?, Economics Letters 166 (2018)](https://eprints.soton.ac.uk/417756) (accademica): Volatilità realizzata e volume guidano l'attenzione su Google del giorno dopo, ma l'attenzione non prevede né volatilità né volume. Anche i rendimenti con 2 giorni di ritardo informano le ricerche: spesso il prezzo guida l'attenzione e non il contrario.

**Fuori campione.** Liu e Tsyvinski riportano un effetto fuori campione per l'attenzione (fino al 2018). Lo studio su Twitter copre il 2018-2022. Nessun dato sul periodo 2023-2026 e nessun test che usi il volume al posto dei tweet: sui nostri dati è un'ipotesi da verificare. L'effetto di 1 giorno rischia di essere troppo piccolo per i nostri costi.

**Come fallisce.** Il volume anomalo non è solo attenzione: notizie vere, listing, sblocchi di token, liquidazioni. Con orizzonte di 1 giorno i costi probabilmente eliminano il vantaggio. Le monete con picchi di attenzione sono spesso le più rischiose e volatili.

### Rapporto long/short dei top trader agli estremi: contrarian o 'seguire i più grossi'? (test a due vie)

Priorità 3. Mercati: I 36 perpetual, separando le prime 10 per liquidità dalle altre.. Provabile con i nostri dati: sì (Rapporto long/short dei top trader, candele 4h, funding.).

Il rapporto di Binance misura la quota di conti tra il 20% più grande per margine che sono netti long o netti short. Non è un peso in valore. Due ipotesi opposte: (a) se sono tutti dallo stesso lato, il carburante per proseguire è finito (contrarian); (b) i conti grandi sono più informati (seguirli). Non ho trovato nessuno studio serio, quindi va provato senza preferenze.

**Regole.** zLS = z-score a 90 giorni del rapporto long/short dei top trader (dati 4h). Evento estremo: zLS > +2 oppure < -2, alla prima candela che supera la soglia, con almeno 5 giorni dall'ultimo evento sulla stessa moneta. Test A (contrarian): con zLS > +2 short, con zLS < -2 long. Test B (seguire): l'opposto. Entrata alla chiusura della candela 4h, stop 3 ATR, uscita dopo 12 candele (48 ore) o a 2R. Rischio 0,5%. Si misurano il rendimento medio a 12, 42 e 90 candele contro un'entrata casuale nella stessa moneta, e si controlla se il segnale aggiunge qualcosa oltre al funding (regressione con F7 come controllo).

**Prove.**

- [TradingView - Top trader long/short positions ratio (documentazione)](https://cn.tradingview.com/support/solutions/43000784532/) (gestore o exchange): Definisce il rapporto e quale lato domina. Non dice nulla sul potere predittivo.
- [Decentralised News - Long/short ratio analysis](https://sites.google.com/view/decentralised-news/home/longshort-ratio-analysis) (aneddotica): Dice che con il rapporto dei top trader sopra 2,8 BTC è sceso entro 48 ore nel 71% dei casi, con un calo medio del 4,3%. Non dà campione né metodo: numero NON verificato, da usare solo come ipotesi.
- [Dunbar e Owusu-Amoako (2023) - Predictability of crypto returns: The impact of trading behavior](https://digitalcommons.uncfsu.edu/college_business_economics/314) (accademica): Le posizioni nette short dei trader speculativi piccoli (dati di posizionamento sui future) sono un determinante forte e significativo dei rendimenti cripto. È un dato diverso dal nostro, ma conferma che il posizionamento della folla nei future contiene informazione.

**Fuori campione.** Nessuna prova pubblicata fuori campione sul rapporto di Binance. Tutto da scoprire sui nostri dati 2023-2026, dividendo il periodo in due metà.

**Come fallisce.** Il rapporto conta i conti, non i soldi: pochi conti enormi possono stare dal lato opposto. Binance può cambiare la definizione di 'top trader'. È molto correlato con funding e prezzo, quindi può non aggiungere nulla di nuovo. Testare due direzioni raddoppia il rischio di trovare un risultato per caso.

### Funding negativo prolungato su BTC: filtro rialzista di regime

Priorità 4. Mercati: BTC come segnale; applicazione a BTC ed ETH, poi al paniere delle 36.. Provabile con i nostri dati: sì (Funding ogni 8 ore e candele (giornaliere costruite dalle 4h).).

Se la folla paga per stare short da settimane, il pessimismo è diffuso e scontato nel prezzo, e gli short in perdita devono ricomprare (short squeeze). K33 riporta che comprare in questi regimi ha battuto le entrate casuali. Nel nostro sistema, dove BTC decide il lato, serve a permettere i long anche quando BTC è sotto la media ma la folla è già tutta corta.

**Regole.** Segnale: media mobile del funding BTC su 30 giorni (90 letture) < 0 per almeno 20 giorni consecutivi, e prezzo BTC sopra il minimo delle ultime 20 candele giornaliere (niente coltelli che cadono). Effetto A, come filtro: in questo regime si permettono segnali long del sistema anche se la regola 'BTC scende' li vieterebbe, con rischio 0,5%. Effetto B, come strategia autonoma: long BTC al primo close giornaliero in cui il regime si attiva, stop 3 ATR giornalieri, uscita dopo 30 giorni o quando la media a 30 giorni del funding torna sopra +0,01%; rischio 1%. Timeframe: giornaliero costruito dalle 4h.

**Prove.**

- [The Block su K33 Research - Bitcoin hits longest negative funding streak this decade (mag. 2026)](https://www.theblock.co/news/markets/2026-05-06-bitcoin-longest-negative-funding-streak-this-decade-k33-flags-short-squeeze-risk-400182) (gestore o exchange): Media a 30 giorni del funding BTC negativa per 67 giorni di fila. Secondo K33 comprare in questi regimi ha dato rendimenti mediani e medi da 1,84 a 6,27 volte quelli delle entrate casuali. In 6 regimi simili dal 2018 tutti positivi a 90 giorni (win rate 83-96% contro 55-75% casuale).
- [Stesso articolo, commento di Derek Lim (Caladan)](https://www.theblock.co/news/markets/2026-05-06-bitcoin-longest-negative-funding-streak-this-decade-k33-flags-short-squeeze-risk-400182) (pratico con backtest): Spiegazione alternativa: il funding negativo persistente riflette l'offerta di short da parte di desk delta-neutrali, non un pessimismo direzionale.
- [securities.io su Inan (2025), Predictability of Funding Rates](https://www.securities.io/bitcoin-funding-rates-forecasting-trading-costs/) (accademica): Il funding è in parte prevedibile, ma un trade può indovinare la direzione e perdere lo stesso per pagamenti di funding e commissioni.

**Fuori campione.** Solo 6 episodi dal 2018: statisticamente debolissimo. I numeri K33 vengono da un resoconto giornalistico e il periodo nella tabella sembrava confuso. Il nostro campione 2023-2026 contiene almeno l'episodio del 2026: è una sola osservazione, quindi il test va fatto anche sulle singole altcoin (36 serie) per avere più eventi.

**Come fallisce.** Nei bear market veri (2022) il funding negativo può durare e il prezzo continuare a scendere. Il campione è minuscolo. Il cambio di struttura (ETF, basis trade, desk neutrali) può aver reso il funding negativo 'normale' e non un segnale di paura.

### Capitolazione con flush della leva (rimbalzo dopo il panico)

Priorità 4. Mercati: I 36 perpetual; preferibilmente le prime 10 per liquidità, perché sulle piccole il rimbalzo è più forte ma lo slittamento reale è peggiore del nostro 0,1%.. Provabile con i nostri dati: sì (Candele 4h con volume, open interest e funding.).

Nel panico i venditori forzati (liquidazioni) vendono senza guardare il prezzo. Quando l'OI crolla insieme al prezzo con volume enorme, la leva è stata ripulita e la pressione di vendita forzata finisce. Le prove dicono però che il giorno stesso il movimento tende a continuare e che il rimbalzo esiste soprattutto sui perdenti su orizzonti di settimane. Quindi non si compra il coltello: si aspetta una conferma.

**Regole.** Evento di capitolazione su una moneta (candele 4h): rendimento delle ultime 6 candele (24h) <= -2,5 ATR giornalieri, volume delle ultime 6 candele >= 3 volte la media di 30 giorni, OI sceso di almeno il 10% in 24h, F7 sceso sotto 0 oppure funding dell'ultima lettura < 0. Entrata: long solo dopo una candela 4h che chiude sopra la metà del range della candela 4h più bassa dell'evento, entro 12 candele dall'evento; altrimenti si annulla. Stop: sotto il minimo dell'evento meno 0,5 ATR (4h). Uscita: target 3R oppure dopo 30 candele 4h (5 giorni) oppure trailing 3 ATR. Rischio 0,5% per operazione, massimo 3 capitolazioni aperte. Variante di mercato: se l'evento capita su almeno 15 delle 36 monete nella stessa finestra di 24h, si tratta come capitolazione di mercato e si opera su BTC ed ETH.

**Prove.**

- [Caporale e Plastun - Price overreactions in the cryptocurrency market, Journal of Economic Studies 2019 (CESifo WP 6861)](https://cesifo.org/DocDL/cesifo1_wp6861.pdf) (accademica): Dopo un giorno di movimento anomalo, il giorno dopo i movimenti sono più ampi del normale in entrambi i versi. Con i costi di transazione i rendimenti anomali diventano piccoli e non significativi.
- [Caporale e Plastun - Momentum effects in the cryptocurrency market after one-day abnormal returns (CESifo WP 7917)](https://econpapers.repec.org/RePEc:ces:ceswps:_7917) (accademica): Nel giorno del movimento anomalo il prezzo tende a continuare nella stessa direzione fino a fine giornata: comprare subito il crollo è controproducente.
- [Dobrynskaya - Cryptocurrency Momentum and Reversal, Journal of Alternative Investments 2023](https://publications.hse.ru/en/articles/811744977) (accademica): Momentum fino a circa 2 settimane, poi inversione da 4-6 settimane. L'inversione è guidata soprattutto dalle monete perdenti e non è spiegata dai fattori di rischio cripto standard.
- [Where does the criticality live? Early-warning signals ... seven crypto-perpetual liquidation cascades (arXiv 2607.27070)](https://arxiv.org/pdf/2607.27070) (accademica): Su 7 cascate di liquidazioni i segnali d'allarme si vedono nella leva e nel flusso d'ordini, non nel prezzo, ma l'inferenza non regge fuori campione.

**Fuori campione.** Gli studi di Caporale e Plastun usano 2013-2017 e trovano che con i costi il vantaggio quasi sparisce. Per Dobrynskaya i rendimenti cambiano molto nel tempo. Non ho trovato test pubblicati sulla combinazione prezzo + OI + funding. Le cifre su cosa succede dopo una capitolazione (per esempio 60-70% di probabilità di rialzo a 30-60 giorni) vengono da blog senza metodo e non vanno usate.

**Come fallisce.** Una capitolazione vera può essere solo il primo gradino di un bear market (2022). Pochi eventi per moneta: rischio di sovra-ottimizzare le soglie. Il costo di andata e ritorno, circa 0,31% con commissioni e slittamento, è alto rispetto ai rimbalzi di poche ore. Nei crolli reali lo slittamento è molto peggiore di 0,1%.

### Indice di paura e avidità costruito dal prezzo (proxy del Fear & Greed) come regolatore di dimensione, senza shortare l'euforia

Priorità 4. Mercati: BTC (indice e operazioni); come filtro di regime per tutte le 36 monete.. Provabile con i nostri dati: sì (Candele 4h di BTC e delle altre 35 monete, funding BTC. L'indice originale di alternative.me (gratuito via API) non è nel dataset: si potrebbe aggiungere per confronto.).

Il Fear & Greed di alternative.me pesa soprattutto volatilità (25%), momentum e volume (25%) e dominance di BTC (10%), più social e Google Trends. Circa il 60% si può ricostruire dai nostri dati. Le prove dicono che l'estrema paura è un'occasione modesta per accumulare gradualmente, mentre l'estrema avidità non è un segnale di short: le serie di avidità sono state seguite da altri rialzi. L'indice serve quindi a regolare quanto rischiare, non a girare la posizione.

**Regole.** Ogni giorno (dalle 4h), cinque componenti trasformate in percentile a 365 giorni (0-100): (1) volatilità realizzata BTC a 30 giorni rispetto alla media di 90, invertita (più volatilità = più paura); (2) BTC rispetto alla media a 30 e 90 giorni; (3) volume di BTC a 7 giorni rispetto ai 30; (4) proxy della dominance, cioè il rendimento a 30 giorni di BTC meno quello del paniere equipesato delle altre 35, invertito (BTC che batte le alt = paura); (5) F7 del funding BTC. Indice = media dei percentili. Regole: indice <= 20 per almeno 3 giorni → si apre un long BTC a piccoli passi, 0,25% del capitale al giorno finché resta sotto 20, massimo 5 tranche, uscita a indice >= 60 o stop 3 ATR giornalieri dal prezzo medio. Indice >= 80 → nessuno short contrario; per il sistema attuale si riduce il rischio per trade a 0,75% e si stringe il trailing a 2,5 ATR. Confronto obbligatorio con BTC comprato e tenuto (+124%) e con l'acquisto a rate (DCA) a giorni fissi.

**Prove.**

- [Cavalheiro, Vieira e Thue - The impact of investor greed and fear on cryptocurrency returns, Review of Behavioral Finance 16(5) 2024](https://econpapers.repec.org/RePEc:eme:rbfpps:rbf-08-2023-0224) (accademica): Su dati settimanali luglio 2022-giugno 2023 il Fear & Greed predice i rendimenti di BTC ed ETH e ha un legame di lungo periodo con essi. Il campione è di un solo anno e il risultato è sensibile al metodo.
- [Bitcoin Magazine - How a Bitcoin Fear and Greed Index trading strategy beats buy and hold](https://bitcoinmagazine.com/markets/how-a-bitcoin-fear-and-greed-index-trading-strategy-beats-buy-and-hold-investing) (pratico con backtest): Dal febbraio 2018: comprare l'1% del capitale con indice <= 20 e vendere l'1% con indice >= 80 ha reso 1.145% contro 1.046% del comprato-e-tenuto, senza commissioni e tasse. Funziona solo a piccoli passi, e gli estremi possono durare mesi.
- [MEXC News - analisi delle serie di sentiment a 7 giorni dal 2018](https://www.mexc.com/news/1197268) (pratico con backtest): Dopo serie di 7 giorni di avidità estrema il rendimento medio di BTC a 90 giorni è stato circa +149%, dopo la paura estrema circa +5%. Il campione è di 74 eventi. È una fonte singola non verificata, ma va contro la tesi contrarian sull'avidità.
- [Guide di Kraken e CryptoSlate sulla metodologia del Fear & Greed di alternative.me](https://www.kraken.com/learn/crypto-fear-greed-index) (gestore o exchange): Componenti: volatilità, momentum e volume, social, sondaggi (pare sospesi), dominance di BTC e Google Trends. I pesi indicati sono 25/25/15/15/10/10, ma vengono da guide di terzi e non dalla pagina ufficiale.

**Fuori campione.** Nessun test fuori campione serio trovato. Il vantaggio del backtest divulgativo è piccolo e le soglie sono state scelte a posteriori. Secondo Cryptorank il legame con il prezzo dello stesso giorno è circa 79%, quello con il giorno dopo circa 49%, cioè una moneta lanciata. Il nostro proxy è nuovo: va tarato con dati fino a fine 2024 e provato nel 2025-2026.

**Come fallisce.** L'indice segue il prezzo (è costruito dal prezzo), quindi rischia di essere un momentum mascherato. La paura estrema può durare mesi nei bear market. Ricostruire l'indice dagli stessi dati della strategia crea un rischio di circolarità. Il proxy della dominance sulle nostre 36 monete non coincide con la vera dominance di mercato.

### Freno anti-folla sul sistema attuale (funding + OI + long/short come termometro dell'affollamento)

Priorità 5. Mercati: I 36 perpetual USDT di Binance; regola applicata moneta per moneta più lo stesso calcolo su BTC come filtro di mercato.. Provabile con i nostri dati: sì (Funding ogni 8 ore, open interest, rapporto long/short dei top trader e candele 4h: tutti già nel dataset.).

Quando quasi tutti sono già long con leva (funding alto, open interest che sale in fretta, rapporto long/short alto), mancano compratori nuovi e c'è carburante per liquidazioni a cascata. Il BIS (Crypto carry) trova che un carry alto prevede crolli e che costa di più assicurarsi contro il crash. Il nostro sistema oggi chiede l'OI in crescita: una crescita fatta solo di leva affollata potrebbe essere proprio il momento peggiore per entrare. Il freno non cerca di indovinare il top. Riduce la dimensione quando la folla è sbilanciata.

**Regole.** Calcoli per ogni moneta a ogni candela da 4 ore: F7 = media del funding delle ultime 21 letture (7 giorni); zF = z-score di F7 sulla sua storia dei 90 giorni precedenti; dOI3 = variazione % dell'open interest in 3 giorni (18 candele); zLS = z-score a 90 giorni del rapporto long/short dei top trader. Punteggio di affollamento long: CL = numero di condizioni vere tra (zF > 2), (F7 > 0,03% per 8 ore), (dOI3 > +15%), (zLS > 2). Regola: per un nuovo segnale long del sistema attuale, con CL = 0-1 rischio 1%; con CL = 2 rischio 0,5%; con CL ≥ 3 nessuna entrata long. Simmetrico per gli short: CS conta (zF < -2), (F7 < -0,01%), (dOI3 > +15%), (zLS < -2). Sulle posizioni già aperte, con CL ≥ 3 il trailing passa da 3 a 2 ATR. Ricalcolo a ogni chiusura di candela 4h, solo con dati già disponibili (funding pubblicato, OI della candela chiusa). Da confrontare con il sistema base 2023-2026 (+108%, DD 13,5%): metriche rendimento, DD, numero di trade evitati e risultato medio dei trade che il freno avrebbe tolto.

**Prove.**

- [Schmeling, Schrimpf, Todorov - Crypto carry, BIS Working Paper 1087 (2023), poi CEPR DP 20719](https://www.bis.org/publications/working-paper-1087-crypto-carry) (accademica): Il carry cripto (spot long contro future short) è in media sopra il 10% annuo, a volte sopra il 40%. Un carry alto prevede crolli futuri del prezzo e si accompagna a un aumento del prezzo dell'assicurazione contro il crash.
- [Coinbase Institutional - A Primer on Perpetual Futures](https://www.coinbase.com/en-mx/institutional/research-insights/research/market-intelligence/a-primer-on-perpetual-futures) (gestore o exchange): Il funding è legato ai movimenti di prezzo di lungo periodo, ma le sue variazioni possono essere sottoprodotti del momentum, cioè in ritardo, più che indicatori in anticipo.
- [The Block - BTC perp accounts turn heavily long as Binance long/short ratio surges to 3.87 (nov. 2025)](https://www.theblock.co/news/ecosystems/2025-11-25-btc-perp-accounts-turn-heavily-long-as-binance-long-short-ratio-surges-to-3-87-380213) (aneddotica): In un singolo episodio i top trader di Binance erano molto short vicino al massimo storico e sono diventati molto long durante un calo di oltre il 35% in 45 giorni. È un aneddoto, non un test.

**Fuori campione.** Il risultato BIS copre BTC ed ETH su più anni, ma un survey del 2025 (arXiv 2510.14435, letto solo in sintesi) dice che il carry si è compresso molto dal 2024, quindi gli estremi saranno più rari nel nostro periodo 2023-2026. Per il long/short dei top trader non ho trovato nessun test serio. Sul nostro campione va trattato come ipotesi nuova: soglie scelte prima del test, poi verifica su dati divisi in 2023-24 (taratura) e 2025-26 (prova).

**Come fallisce.** Nei bull market forti funding alto e OI in salita durano mesi (nel febbraio 2021 il funding era sopra 0,1% in 18 intervalli su 42, eppure il picco è arrivato ad aprile). Il freno può tagliare i trade migliori. Le soglie z possono essere superate spesso sulle altcoin piccole, che sono molto rumorose. Il funding negativo può nascere da desk delta-neutrali e non da pessimismo.

### Miti

- **Quando il Fear & Greed è in avidità estrema bisogna vendere o andare short.** Le serie di avidità estrema sono state seguite in media da altri forti rialzi (secondo un'analisi, +149% a 90 giorni dopo 7 giorni di avidità estrema contro +5% dopo la paura estrema). Nei bull market l'euforia dura mesi. Il legame dell'indice con il giorno dopo è vicino al 50%. Al massimo l'avidità serve a ridurre la leva, non a girarsi short.
- **Comprare la paura estrema batte sempre il mercato.** Il backtest più citato batte il comprato-e-tenuto di poco (1.145% contro 1.046%), senza commissioni e tasse, con soglie scelte a posteriori, e solo comprando a piccoli passi. La paura estrema può durare mesi nei bear market. L'unico studio accademico copre un anno.
- **Il sentiment dei social anticipa il prezzo: se Twitter è rialzista, il prezzo salirà.** Spesso è il prezzo a muovere l'attenzione e il sentiment, non il contrario. Urquhart trova che volume e volatilità guidano l'attenzione del giorno dopo, mentre l'attenzione non prevede nulla. Altri studi trovano causalità dai rendimenti al sentiment di Twitter. Circa il 14% degli account cripto sono bot.
- **Basta trovare la parola giusta su Google Trends per prevedere il mercato.** Con un backtest serio, parole finanziarie scelte a caso non funzionano meglio di parole su malattie o videogiochi. I risultati 'miracolosi' nascono dal provare molte parole e tenere quella che ha funzionato (data-snooping).
- **Basta fare l'opposto di quello che dice un guru televisivo o un influencer famoso.** L'ETF Inverse Cramer, che faceva esattamente questo, ha perso il 15% ed è stato chiuso dopo circa 10 mesi. Lo studio sui finfluencer trova un vantaggio solo andando contro un gruppo specifico, identificato con dati sistematici su migliaia di account, e nelle azioni, non nelle cripto.
- **Funding negativo vuol dire short squeeze garantito.** Le prove si basano su 6 episodi dal 2018. Il funding negativo può nascere da desk delta-neutrali che offrono short, non da pessimismo. In casi recenti a una lettura negativa è seguito un +21% in 3 giorni, a una più profonda un -6,6% in 14 giorni.
- **Quando il rapporto long/short dei top trader supera 2,8 BTC scende nel 71% dei casi.** Il numero viene da un blog senza campione, periodo né metodo. Il rapporto conta i conti e non i soldi, come ricorda la stessa documentazione Binance. Non esiste uno studio serio che lo confermi: va testato.
- **I video di TikTok e YouTube che promettono rendimenti alti con 'la strategia segreta' sono una fonte di segnali.** Diverse analisi di settore trovano che dal 68% all'87% dei contenuti finanziari su TikTok sono fuorvianti, che i video cripto sono tra i più fuorvianti e che solo il 10% ha avvertenze sul rischio. Sono indicatori di euforia della folla, non prove.
- **Un tweet di un personaggio famoso (es. Musk) è un segnale da tradare.** Lo studio di Ante trova rendimenti anomali significativi, ma concentrati in minuti od ore (+8% in 5 minuti su DOGE), troppo veloci per candele a 4 ore. Alcuni tweet erano reazioni a movimenti già avvenuti. Lo stesso autore segnala il rischio di manipolazione.
- **Comprare subito il crollo del giorno è il modo migliore per sfruttare il panico.** Nel giorno del movimento anomalo il prezzo tende a continuare nello stesso verso fino a fine giornata. Il rimbalzo, quando c'è, arriva su orizzonti di settimane e soprattutto sui perdenti. I costi annullano gran parte del vantaggio di breve.

### Da leggere

- [Memoirs of Extraordinary Popular Delusions and the Madness of Crowds - Charles Mackay (1841)](https://www.gutenberg.org/ebooks/24518): Il classico sulle manie collettive (tulipani, Mississippi, Mare del Sud). La folla impazzisce in gruppo e rinsavisce uno alla volta. I meccanismi della bolla (storia nuova, ricchezza facile, imitazione) sono gli stessi delle cripto. Pubblico dominio.
- [The Crowd: A Study of the Popular Mind - Gustave Le Bon (1895)](https://www.gutenberg.org/ebooks/445): Nella folla l'individuo perde il giudizio critico e segue contagio e suggestione. Spiega perché il sentiment si autoalimenta e perché gli estremi durano più del previsto. Pubblico dominio (originale francese: Gutenberg #24007).
- [Investor Sentiment in the Stock Market - Baker e Wurgler, Journal of Economic Perspectives 2007](https://archive.nyu.edu/jspui/bitstream/2451/31359/2/wurgler_baker_investor_sentiment.pdf): Come si misura il sentiment 'dall'alto' (indici composti) e quali asset ne soffrono di più: quelli difficili da valutare e da shortare, cioè proprio le altcoin. Un sentiment alto precede rendimenti più bassi per questi asset.
- [Risks and Returns of Cryptocurrency - Liu e Tsyvinski, NBER WP 24877](https://www.nber.org/system/files/working_papers/w24877/w24877.pdf): Le cripto non rispondono ai fattori di azioni e macro. Momentum e attenzione degli investitori prevedono i rendimenti, anche fuori campione. Il punto di partenza accademico per i segnali di sentiment sulle cripto.
- [Crypto carry - Schmeling, Schrimpf, Todorov, BIS Working Paper 1087](https://www.bis.org/publications/working-paper-1087-crypto-carry): Funding e basis come misura dell'appetito per la leva della folla. Un carry alto prevede crolli. I differenziali di tasso tradizionali spiegano poco del carry cripto.
- [In Search of Attention - Da, Engelberg, Gao (versione degli autori)](https://rady.ucsd.edu/faculty/directory/engelberg/pub/portfolios/GOOGLE.pdf): Le ricerche su Google come misura dell'attenzione dei piccoli investitori: l'attenzione porta una spinta di prezzo temporanea, poi inversione. Il metodo dell''attenzione anomala' è riusabile con il volume.
- [Finfluencers - Kakhbod, Kazempour, Livdan, Schuerhoff (versione degli autori)](https://www.akakhbod.com/uploads/1/3/9/6/13965273/finfluencers.pdf): La maggior parte degli influencer finanziari ha abilità negativa e più follower. Andare contro di loro ha reso +1,2% al mese fuori campione. I bravi vanno contro il trend del sentiment.
- [Twitter-Based Attention and the Cross-Section of Cryptocurrency Returns - Maître, Pugachyov, Weigert (FoFI 2024)](http://wp.lancs.ac.uk/fofi2024/files/2024/04/FoFI-2024-148-Nikolay-Pugachyov.pdf): Misura pratica dell'attenzione anomala (log tweet di oggi meno la media dei 30 giorni) e il suo legame con i rendimenti delle cripto dello stesso giorno e del giorno dopo. Il segnale viene dagli utenti, non dagli account ufficiali.
- [BitCoin meets Google Trends and Wikipedia - Kristoufek, Scientific Reports 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3849639): Attenzione e prezzo di Bitcoin si alimentano a vicenda nelle bolle e nei crolli. Ottimo per capire il circolo della speculazione al dettaglio.
- [Predicting financial markets with Google Trends and not so random keywords - Challet e Bel Hadj Ayed](https://arxiv.org/abs/1307.4643): Lezione di metodo: come si inganna sé stessi con il data-snooping sulle parole chiave, e come fare un backtest serio dei segnali di attenzione.
- [What causes the attention of Bitcoin? - Urquhart, Economics Letters 2018 (preprint)](https://eprints.soton.ac.uk/417756/1/attention_bitcoin_3.pdf): Spesso è il mercato a guidare l'attenzione e non il contrario: prima di usare un segnale di sentiment bisogna verificare la direzione della causalità.
- [Price Overreactions in the Cryptocurrency Market - Caporale e Plastun (CESifo WP 6861)](https://cesifo.org/DocDL/cesifo1_wp6861.pdf): Cosa succede dopo giorni di panico o euforia anomali. I costi di transazione possono annullare le anomalie: un buon esempio di come valutare il rimbalzo dopo la capitolazione.
- [Fundamentals of Perpetual Futures - He, Manela, Ross, von Wachter (arXiv 2212.06888)](https://arxiv.org/pdf/2212.06888): Come funzionano funding e prezzo dei perpetual e perché si allontanano dallo spot. Base necessaria per leggere il funding come sentiment.

### Lezioni per gli agenti

Come ragiona un trader di sentiment serio:

1) Il sentiment è un termometro, non un volante. Gli serve per decidere quanto rischiare, quasi mai da che lato stare. La domanda da farsi prima di ogni trade: "La folla è già tutta dal mio lato? Chi resta per comprare (o vendere) dopo di me?" Se funding alto, OI in salita veloce e long/short estremo sono tutti dalla mia parte, dimezzo la dimensione o salto il trade.

2) Mai shortare l'euforia solo perché è euforia. Le prove dicono che l'avidità estrema è spesso seguita da altri rialzi. L'euforia si combatte con stop più stretti e meno leva, non con posizioni contrarie. Lo short contrarian si considera solo quando il prezzo stesso conferma la svolta (rottura sotto il minimo recente con OI che scende).

3) La paura si compra a rate, non tutta insieme. La paura estrema può durare mesi. Si entra a piccole tranche, si aspetta una candela di conferma dopo la capitolazione, e si accetta di non prendere il minimo esatto.

4) Chiedersi sempre chi causa chi. Molti indicatori di sentiment (Fear & Greed, Google Trends, attenzione sui social) sono in gran parte costruiti dal prezzo o lo seguono. Prima di fidarsi di un segnale, l'agente deve controllare che non sia solo un momentum travestito: lo confronta con un semplice segnale di prezzo e vede se aggiunge qualcosa.

5) Un segnale popolare muore. WallStreetBets ha perso il potere predittivo dopo GameStop, il carry cripto si è compresso dopo il 2024, l'ETF Inverse Cramer ha chiuso in perdita. Se un indicatore di sentiment è su tutti i video di TikTok, il suo vantaggio probabilmente si è già consumato. L'agente misura ogni mese se il segnale funziona ancora (rendimento medio per trade negli ultimi 6 mesi contro i 2 anni precedenti).

6) I social sono un dato sulla folla, non un consiglio. Quello che promettono TikTok e YouTube (rendimenti facili, segnali segreti) va registrato come misura di euforia. Più promesse ci sono, più la folla è avida. Mai copiarlo come idea di trade. Ricordare bot (circa il 14% degli account cripto) e contenuti pagati.

7) Contare i costi prima di innamorarsi. Con 0,055% di commissione per lato e 0,1% di slittamento, un'andata e ritorno costa circa 0,31%. I segnali di sentiment di 1 giorno raramente lo superano. Meglio orizzonti da giorni a settimane, oppure usare il sentiment come filtro sul sistema esistente.

8) Campioni piccoli, umiltà grande. Molte 'regole' di sentiment si basano su 6-74 episodi. L'agente dichiara sempre quanti eventi ha nel test, divide il periodo in taratura e prova, sceglie le soglie prima di guardare i risultati e non prova dieci varianti per tenere la migliore.

9) Mai passare dal leggere al manipolare. Studiare il panico altrui va bene. Crearlo (FUD organizzato, pump and dump, account falsi) è illegale ed escluso dalla scuola.

10) Domande quotidiane per il diario dell'agente: Qual è il funding medio a 7 giorni di BTC e delle alt rispetto alla sua storia? L'OI sale con il prezzo (trend sano) o sale mentre il prezzo è fermo (leva che si accumula)? C'è stata una capitolazione (crollo + volume + OI giù + funding negativo)? Il mio indice di paura e avidità costruito dal prezzo è agli estremi? Il mio prossimo trade va con la folla affollata o contro una folla già svuotata?

## 5. Ritorno alla media, volatilità e regimi (RSI a 2 periodi e Connors, bande di Bollinger, rotture e compressione di volatilità, filtri di regime, dimensione delle posizioni in base alla volatilità)

AVVISO SUL METODO: in questa sessione WebFetch era bloccato per ogni sito che ho provato (people.duke.edu, nber.org, substack.com, stockcharts.com: "host not allowed"). Per questo non ho potuto aprire i PDF completi. Tutte le prove qui sotto vengono dagli estratti e dai riassunti che WebSearch restituisce per ogni fonte (abstract, repository, recensioni). Ho letto circa 25 fonti diverse in questa forma. I numeri vanno quindi ricontrollati sul testo originale prima di prendere decisioni con soldi veri. Se si vuole leggere i testi completi, bisogna abilitare nelle impostazioni di rete della sessione almeno nber.org, papers.ssrn.com, arxiv.org e people.duke.edu.

COSA HO IMPARATO:
1) La prova più solida del campo non riguarda i segnali di ritorno alla media. Riguarda la gestione del rischio in base alla volatilità. Ridurre l'esposizione quando la volatilità sale abbassa le perdite estreme e la volatilità della volatilità (Harvey e altri, Man/Duke, oltre 60 attivi). Migliora lo Sharpe soprattutto sugli attivi rischiosi, cioè azioni e, per estensione, cripto: sulle azioni USA lo Sharpe passa da 0,40 a circa 0,48-0,51. Fuori campione però l'effetto è più debole di quanto si crede: secondo Cederburg e altri (JFE 2020) le versioni gestite battono quelle non gestite solo in 53 strategie su 103.
2) Il ritorno alla media di breve periodo esiste, ma sulle cripto grandi e liquide (proprio le nostre 36) la prova va più verso il momentum settimanale che verso l'inversione. Fičura (2023) trova inversione settimanale solo nelle monete piccole e illiquide e momentum in quelle grandi; oltre le 4 settimane c'è inversione anche nelle grandi. Dobrynskaya trova momentum fino a 2-4 settimane e inversione dopo circa 1 mese.
3) L'RSI(2) di Connors ha prove pubblicate quasi solo dall'autore stesso (sull'SPY). Le prove indipendenti su BTC giornaliero 2016-2025 sono negative dopo i costi.
4) Le bande di Bollinger come segnale semplice non battono il comprare e tenere (Lento e altri). La loro redditività è calata di circa il 50% dopo che sono diventate popolari (Fang, Jacobsen, Qin, JPM 2017).
5) La compressione di volatilità prevede movimenti più grandi ma non la loro direzione. Non ho trovato nessuno studio accademico solido sullo "squeeze".
6) Il ritorno alla media paga di più quando la volatilità è alta e la liquidità si ritira (Nagel, RFS 2012). È lo stesso stato in cui il momentum crolla (Daniel e Moskowitz).
7) Gli stop servono solo se i prezzi hanno momentum (Kaminski e Lo). Sulle cripto uno stop semplice ha migliorato lo Sharpe di portafogli a bassa volatilità (Kaya e Mostowfi).
8) Il nostro costo di andata e ritorno è circa 0,31% (2 x 0,055% di commissione più 2 x 0,1% di slittamento). Con questo costo le inversioni a frequenza alta (15 minuti o 4 ore) non sono sfruttabili: Kitron e Wengrowicz misurano un guadagno lordo di circa 1,3 punti base contro 5 di costo.
Conclusione per il desk: la prima cosa da provare è un "regolatore di volatilità e di regime" sopra il sistema attuale, non una nuova strategia di inversione. Le strategie di inversione vanno provate su orizzonti più lunghi (giornaliero o settimanale), con filtro di regime e dimensione ridotta.

### Scommessa contro le esagerazioni a 4 ore (flush di liquidazione)

Priorità 1. Mercati: 36 perpetual.. Provabile con i nostri dati: sì (Candele a 4 ore con volume; open interest.).

Dopo una candela enorme con volume altissimo e open interest in calo (posizioni chiuse a forza), il prezzo può essersi allontanato dal valore per mancanza di liquidità, e chi fornisce liquidità viene pagato (Nagel). L'idea è comprare la paura e vendere l'euforia.

**Regole.** 4 ore. Segnale: movimento della barra sopra 3 ATR(20), volume sopra 3 volte la media a 20 barre, open interest in calo di oltre il 5% nella barra. Entrata contro il movimento all'apertura della barra successiva. Uscita dopo 6 barre (24 ore) oppure al ritorno sulla media a 20 barre. Stop a 1,5 volte l'escursione della barra del segnale. Rischio 0,25-0,5%. Si accetta solo se il guadagno medio lordo supera chiaramente lo 0,31% di costo.

**Prove.**

- [Caporale e Plastun - Price overreactions in the cryptocurrency market (Journal of Economic Studies 2019)](https://emerald.com/insight/content/doi/10.1108/JES-09-2018-0310) (accademica): Dopo le esagerazioni ci sono schemi statistici, ma la strategia contraria non è redditizia e quella che segue il movimento non è diversa dal caso. Probabile causa: i costi.
- [Kitron e Wengrowicz - Short-horizon mean reversion in cryptocurrency markets: a matched cross-market measurement (arXiv 2608.21888)](https://arxiv.org/pdf/2608.21888) (accademica): Su 183 coppie Binance, il 90% mostra un'inversione significativa a 15 minuti, ma il guadagno lordo arriva a circa 1,3 punti base contro 5 di costo: non sfruttabile.
- [Wen, Bouri, Xu, Zhao - Intraday return predictability in the cryptocurrency markets: momentum, reversal, or both (NAJEF 2022)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4080253) (accademica): Dentro la giornata BTC ha sia momentum (investitori informati in ritardo) sia inversione (reazione eccessiva a informazioni non fondamentali). Lo schema cambia intorno ai salti di prezzo, alle riunioni FOMC e alla liquidità.

**Fuori campione.** Le prove dicono che l'inversione di breve periodo esiste ma non copre i costi a frequenza alta. Con i nostri costi (0,31%) la probabilità di successo è bassa. Va provata solo per chiudere la domanda una volta per tutte.

**Come fallisce.** Si compra dentro una cascata che continua. I costi superano il guadagno. Lo slittamento reale durante i flush è molto più alto dello 0,1% che usiamo nel test.

### RSI(2) di Connors adattato alle cripto (ritracciamento nel verso del trend)

Priorità 2. Mercati: BTC, ETH e le 10 monete più liquide per volume; poi tutte le 36 come prova di robustezza.. Provabile con i nostri dati: sì (Candele a 4 ore aggregate in giornaliere; BTC per il filtro.).

Dentro un trend rialzista, i cali bruschi di 1-3 giorni sono spesso vendite emotive o forzate, cioè chi fornisce liquidità viene pagato. Se il trend di fondo è sano il prezzo torna verso la media. Connors stesso dice che è una regola da mercato rialzista con un'entrata di ritorno alla media.

**Regole.** Timeframe giornaliero, costruito dalle 4 ore (chiusura alle 00:00 UTC). Condizioni LONG: chiusura sopra la media a 200 giorni (provare anche 100); BTC sopra la sua media a 100 giorni; regime laterale o neutro dal filtro di regime. Segnale: RSI(2) sotto 10 (provare 5, 10 e 15). Entrata all'apertura del giorno dopo. Uscita: chiusura sopra la media a 5 giorni, oppure RSI(2) sopra 70, oppure dopo 5 giorni. Stop di emergenza a 3 ATR(14) dal prezzo di entrata: su perpetual con leva serve contro la rovina, anche se nelle azioni Connors trova che gli stop peggiorino i risultati. Dimensione: rischio 0,5% del conto (metà del sistema attuale, perché l'asimmetria è negativa), calcolato sulla distanza dello stop. Massimo 5 posizioni insieme. SHORT a specchio solo se chiusura sotto la media a 200 giorni, BTC sotto la sua media e RSI(2) sopra 90. Variante 4 ore: RSI(2) sulle 4 ore con filtro media a 200 barre giornaliera. Va provata solo per confermare che i costi la distruggono.

**Prove.**

- [Connors Research Traders Journal (Volume 1): Does Mean Reversion Still Work?](https://tradingmarkets.com/?p=1593757) (gestore o exchange): Variante RSI(4) sotto 25 con SPY sopra la media a 200 giorni. 1993-2008: 85 trade, 88,24% vincenti, guadagno medio 1,50%. Dopo il 2009 dichiarano il 96,77% di vincenti. Sono dati dell'autore stesso, che vende la strategia.
- [CXO Advisory - A Few Notes on Short Term Trading Strategies That Work](https://cxoadvisory.com/technical-trading/a-few-notes-on-short-term-trading-strategies-that-work) (pratico con backtest): I test del libro usano 1995-2007, senza correzione per il data mining, senza prova fuori campione, senza costi né analisi dei cali.
- [Tickfloor - Does the Connors RSI(2) strategy work? Tested 2016-2025](https://tickfloor.com/research/claims/rsi2-mean-reversion) (pratico con backtest): Su BTC giornaliero, dopo i costi, il ritracciamento RSI(2) rende 43,2 punti all'anno meno del riferimento (60 trade). Nessuna versione supera il test.
- [tradingstrategies.work - RSI(2) Backtest](https://tradingstrategies.work/strategies/rsi2-mean-reversion) (pratico con backtest): Regole standard: BTC circa +5,7% annuo contro +19,1% del comprare e tenere. Batte il comprare e tenere su 0 coppie su 2.

**Fuori campione.** Sulle azioni USA (SPY) la logica sembra aver retto dopo la pubblicazione, ma la prova viene dall'autore stesso. Sulle cripto le prove indipendenti che ho trovato (BTC 2016-2025) sono negative dopo i costi. In più Fičura e Liu-Tsyvinski-Wu mostrano che le monete grandi hanno momentum settimanale, non inversione: la base teorica sulle nostre monete è debole. Aspettativa bassa.

**Come fallisce.** Nei crolli prolungati (maggio 2022, 10 ottobre 2025) compra mentre il prezzo cade ancora. Molti piccoli guadagni vengono cancellati da poche perdite grandi (asimmetria negativa). Il costo di 0,31% per andata e ritorno si mangia gran parte del guadagno medio. Il filtro a 200 giorni lascia il sistema fermo per mesi.

### Massimo e minimo a 10 giorni su BTC (Padysak e Vojtko)

Priorità 3. Mercati: BTC; poi ETH, SOL, BNB come prova di robustezza.. Provabile con i nostri dati: sì (Candele a 4 ore di BTC aggregate in giornaliere.).

BTC al massimo di 10 giorni tende a continuare, perché inseguire il prezzo e aggiornare le aspettative crea persistenza. Al minimo di 10 giorni tende a rimbalzare, per la reazione eccessiva e le vendite forzate. È un modo semplice per unire trend e ritorno alla media nello stesso attivo.

**Regole.** Giornaliero (da 4 ore). Gamba MAX: se la chiusura di oggi è uguale al massimo delle chiusure degli ultimi 10 giorni, si va long all'apertura successiva e si tiene 1 giorno (si rinnova se la condizione resta vera). Gamba MIN: se la chiusura è uguale al minimo dei 10 giorni, long per 1 giorno. Dimensione: volatilità puntata al 20-30% annuo, con leva massima 1,5. Va provata separatamente: MAX da sola, MIN da sola, MIN solo con BTC sopra la media a 200 giorni, MIN con stop di 2 ATR. Provare anche le finestre 20 e 50 giorni.

**Prove.**

- [Padysak e Vojtko - Seasonality, Trend-following, and Mean reversion in Bitcoin (SSRN 4081000, Quantpedia)](https://quantpedia.com/trend-following-and-mean-reversion-in-bitcoin/) (gestore o exchange): BTC prosegue quando è al massimo e rimbalza quando è al minimo. Le finestre più corte (10 giorni) funzionano meglio, su dati Gemini 2015-2022. La gamba MIN ha cali oltre l'80%. Non è dichiarato nessun test di robustezza della combinazione.
- [Quantbuffet - Mean-reversion and Trend-Following Based on MIN and MAX in BTC](https://www.quantbuffet.com/en/strategies/mean-reversion-and-trend-following-based-on-min-and-max-in-btc) (pratico con backtest): Regola: long al massimo o al minimo a 10 giorni, tenuta 1 giorno. Rendimento corretto per il rischio migliore del tenere passivamente.

**Fuori campione.** Il campione finisce a febbraio 2022. Il nostro periodo (novembre 2023 - ottobre 2026) è quasi tutto fuori campione: è un buon test vero. Numeri esatti non disponibili (le tabelle non erano negli estratti).

**Come fallisce.** La gamba MIN compra durante le cascate di vendite e ha cali oltre l'80%. Rinnovare ogni giorno costa (fino a 0,31% per ogni ciclo). La gamba MAX somiglia al nostro sistema di rottura, quindi aggiunge poca diversificazione.

### Compressione di volatilità come filtro della rottura (squeeze) invece che come segnale

Priorità 3. Mercati: 36 perpetual, 4 ore.. Provabile con i nostri dati: sì (Candele a 4 ore; i segnali del sistema attuale.).

La volatilità ritorna alla sua media: dopo una compressione lunga è più probabile un movimento ampio. Ma la compressione non dice in che direzione. Quindi non va usata come segnale da sola: va usata per scegliere quali rotture del sistema attuale prendere.

**Regole.** Timeframe 4 ore. Larghezza delle bande BBW = (banda alta - banda bassa) / media, con bande di Bollinger 20 e 2. Compressione = BBW nel 10% più basso delle ultime 180 barre (30 giorni). In alternativa: bande di Bollinger interamente dentro il canale di Keltner (20, 1,5 ATR) per almeno 6 barre. Regola: si prende la rottura di volume del sistema attuale solo se nelle ultime 12 barre c'è stata una compressione, e la direzione la decide sempre BTC. Il resto resta uguale: stop 3 ATR, obiettivo 3R, trailing. Test di controllo: rotture con compressione contro senza, con la stessa gestione. Variante da segnale puro: entrata sulla chiusura fuori dalla banda dopo compressione, stop alla banda opposta. Ci si aspetta che sia peggiore.

**Prove.**

- [Fang - Popularity versus Profitability: Evidence from Bollinger Bands (AUT working paper)](https://acfr.aut.ac.nz/__data/assets/pdf_file/0007/29896/100009-Popularity-vs-Profitability-BB-August-Final.pdf) (accademica): Le prove accademiche sulle bande sono miste. Nei test il metodo della rottura funziona meglio del metodo dello squeeze.
- [Daytradingtoolkit - Bollinger Band Squeeze Strategy: Rules and Real Odds](https://daytradingtoolkit.com/strategies/bollinger-band-squeeze-strategy) (pratico con backtest): Simulazione su 400.000 barre: dopo uno squeeze il movimento è circa 2 volte la larghezza delle bande, contro 1,1 normalmente. La direzione è quasi una moneta lanciata. Il 43% delle prime rotture rientra entro 3 barre. Nessuno studio solido pubblicato.
- [Larry Williams, volatility breakout (descrizione e nota dell'autore)](https://www.quantifiedstrategies.com/larry-williams-volatility-strategy/) (aneddotica): Regola: apertura più o meno k volte l'escursione del giorno prima. Lo stesso Williams ha scritto che non funziona più bene come prima. Non ho trovato test accademici su BTC.

**Fuori campione.** Non ho trovato nessuna prova fuori campione solida, né su azioni né su cripto. È un'ipotesi da verificare solo con i nostri dati.

**Come fallisce.** Molte false rotture (il 43% rientra subito). Pochi segnali dopo il filtro, quindi statistica povera. Le soglie dei percentili si sovra-adattano facilmente.

### Estremi di funding e posizionamento: scommessa contraria condizionata

Priorità 3. Mercati: BTC, ETH, SOL prima (le monete degli studi); poi le altre 33.. Provabile con i nostri dati: sì (Funding a 8 ore, open interest, rapporto long/short dei top trader, candele a 4 ore.).

Un funding estremo vuol dire che una parte del mercato è affollata e paga per tenere la leva. Quando il prezzo va contro di loro, le liquidazioni forzate spingono il ritorno alla media. Ma l'affollamento può durare a lungo, e l'effetto dipende dalla direzione della giornata. È un segnale di sentiment strutturato, non manipolazione.

**Regole.** Per ogni moneta: percentile del funding attuale rispetto agli ultimi 180 giorni (540 osservazioni). LONG CONTRARIO: funding nel 10% più basso, open interest salito di oltre il 10% in 3 giorni (corti che si accumulano) e rapporto long/short dei top trader sotto il suo 20° percentile. Entrata alla chiusura della barra a 4 ore successiva al fixing; uscita dopo 24 ore (6 barre) oppure stop a 2 ATR. SHORT CONTRARIO: funding nel 10% più alto e giornata in rialzo (secondo Shek gli estremi nei giorni di rialzo tornano indietro, quelli nei giorni di ribasso proseguono). Dimensione: rischio 0,5%. Da provare anche come filtro: non aprire long di rottura quando il funding è nel 5% più alto.

**Prove.**

- [Shek - Conditional Arbitrage Capacity: Evidence from Crypto Perpetual Funding Rates (SSRN preprint)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7520320) (accademica): 274 eventi estremi su BTC, ETH, SOL 2021-2026: nei giorni di rialzo tornano indietro di circa +1,88% in 24 ore, nei giorni di ribasso proseguono di circa -1,74%. L'effetto dipende dalla direzione.
- [Coincub - Perpetual Futures Funding Rates: 78% of a Quarter at 0.01%](https://coincub.com/blog/perpetual-futures-funding-rates-78-of-a-quarter-at-0-01/) (aneddotica): Un tasso può restare estremo per un intero trimestre senza che arrivi l'inversione: da solo è un segnale di tempismo debole.
- [Decrypt - Bitcoin's $81K rally comes amid 66-day negative funding streak (analisi K33)](https://decrypt.co/366768/bitcoins-81k-rally-comes-amid-66-day-negative-funding-streak-heres-why) (gestore o exchange): Secondo K33, chi ha comprato nei periodi di funding medio a 30 giorni negativo ha avuto il 83-96% di vincite, ma su orizzonti da 30 a 360 giorni.
- [Kaiko - Sell-Off Continues Following Liquidation Cascade](https://blog.kaiko.com/sell-off-continues-following-liquidation-cascade-cb1a90ad8443) (gestore o exchange): Dopo la cascata su ETH del settembre 2020 l'open interest è sceso del 18% e la vendita è continuata, senza rimbalzo immediato.

**Fuori campione.** Sono quasi tutti preprint o analisi di case di dati, con pochi eventi (274) e periodi che si sovrappongono al nostro. Non è replicato da altri. Un piccolo test su blog (197 osservazioni Binance) trova addirittura -0,48% dopo il funding molto negativo.

**Come fallisce.** L'affollamento si allarga prima di girare. Le cascate continuano (Kaiko 2020). Gli eventi sono pochi, quindi è facile vedere schemi nel rumore. Il funding è pubblicato ogni 8 ore: attenzione a non usare dati futuri nel backtest.

### Filtro di regime trend contro laterale per scegliere quale motore attivare

Priorità 4. Mercati: Il regime si calcola su BTC e si applica a tutte le 36 monete. Facoltativo: un regime per singola moneta.. Provabile con i nostri dati: sì (Candele a 4 ore di BTC aggregate in giornaliere; i trade del sistema attuale; i segnali delle strategie di ritorno alla media.).

Il momentum guadagna quando il mercato resta nello stesso stato e soffre ai cambi di stato. Il ritorno alla media fa l'opposto. Il comportamento di BTC cambia nel tempo: l'esponente di Hurst alterna fasi persistenti e fasi anti-persistenti. Un filtro che riconosce il regime decide quale logica usare e riduce le perdite di entrambe.

**Regole.** Calcolato su BTC giornaliero (costruito dalle 4 ore). A) Indice di efficienza di Kaufman a 20 giorni: ER = |chiusura oggi meno chiusura di 20 giorni fa| diviso la somma delle |variazioni giornaliere|. B) Posizione rispetto alla media a 100 giorni (Faber usa 10 mesi, circa 200 giorni; provare 50, 100 e 200). C) Rapporto di varianza VR(5) = varianza dei rendimenti a 5 giorni divisa per 5 volte la varianza dei rendimenti giornalieri, su 60 giorni. Regime TREND: ER sopra 0,30 oppure VR sopra 1,1, più il segno della media che dà il lato. Qui gira solo il sistema di rottura attuale. Regime LATERALE: ER sotto 0,20 e VR sotto 0,9. Qui il sistema di rottura dimezza il rischio e si accendono le strategie di ritorno alla media (RSI(2), punti 3 e 4). Zona grigia: rischio dimezzato per tutti. Le soglie vanno decise su una prima metà dei dati (nov 2023 - apr 2025) e verificate sulla seconda.

**Prove.**

- [Faber - A Quantitative Approach to Tactical Asset Allocation (SSRN 962461)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461) (accademica): La regola della media a 10 mesi, applicata anche fuori campione su altri mercati, riduce molto il calo massimo: -9,56% contro -46% nel portafoglio 1973-2011, secondo una fonte secondaria. Costi e tasse non sono inclusi.
- [Cheema, Nartea, Man (2017), citato in tesi e lavori sul TSMOM](https://thesis.eur.nl/pub/44390/Wisselink-NJ-483391-BA-thesis.pdf) (accademica): Il momentum sulle serie storiche funziona bene solo quando il mercato resta nello stesso stato e perde ai cambi di stato. Han, Kang e Ryu: sulle cripto il momentum è concentrato nei mercati rialzisti.
- [Garnier e Solna - Chaos and Order in the Bitcoin Market (arXiv 1809.08403) e The inefficiency of Bitcoin revisited (arXiv 1709.08090)](https://arxiv.org/abs/1809.08403) (accademica): L'esponente di Hurst di BTC cambia nel tempo: epoche persistenti si alternano a fasi quasi casuali. Dopo il 2014 il valore è vicino a 0,5.
- [Padysak e Vojtko - Seasonality, Trend-following, and Mean reversion in Bitcoin (SSRN 4081000)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4081000) (gestore o exchange): BTC tende a proseguire quando è sul massimo a 10 giorni e a rimbalzare quando è sul minimo. Quindi il comportamento dipende dallo stato del prezzo.

**Fuori campione.** Il filtro della media mobile di Faber ha retto in versioni aggiornate (2013 e 2018) sui mercati tradizionali. Non ho trovato una verifica fuori campione di filtri ER o VR sulle cripto. Va dimostrato con i nostri dati, con soglie fissate prima del test.

**Come fallisce.** Il regime si riconosce in ritardo: i cambi di stato veloci (crolli a V) colpiscono entrambi i motori. Le soglie si sovra-adattano facilmente. Con molte soglie i gradi di libertà diventano troppi per 3 anni di dati.

### Momentum settimanale e inversione mensile tra le 36 monete (sezione trasversale, neutrale al mercato)

Priorità 4. Mercati: 36 perpetual USDT di Binance. Timeframe settimanale e mensile.. Provabile con i nostri dati: sì (Candele a 4 ore e volumi delle 36 monete; funding a 8 ore per il costo di tenere le posizioni.).

Sulle monete grandi e liquide l'informazione arriva lentamente: i ritardatari comprano dopo, e così nasce il momentum a 1-4 settimane. Oltre il mese le esagerazioni si correggono (inversione). Inoltre l'inversione di breve periodo è un premio per chi fornisce liquidità: paga di più quando la volatilità è alta. Un portafoglio lungo e corto non dipende da dove va BTC, quindi diversifica il sistema attuale che dipende da BTC.

**Regole.** Ogni lunedì alle 00:00 UTC, con le candele a 4 ore aggregate in settimanali. Universo: le monete con volume medio sopra la mediana delle ultime 4 settimane (il volume fa da indicatore di liquidità, perché non abbiamo la capitalizzazione). Gamba MOMENTUM: rendimento delle ultime 1 e 2 settimane; si va long sul quintile migliore e short sul peggiore, a pesi uguali e corretti per la volatilità (peso proporzionale a 1 diviso la volatilità a 30 giorni). Si tiene 1 settimana. Gamba INVERSIONE: rendimento da 4 a 12 settimane fa (si salta l'ultima settimana); long sui perdenti peggiori e short sui vincenti migliori, si tiene 2-4 settimane. Variante Nagel: la gamba inversione si attiva o si raddoppia solo se la volatilità di BTC a 30 giorni è nel terzo più alto. Rischio: volatilità del portafoglio lungo e corto puntata al 15% annuo. Nel costo va incluso il funding delle due gambe.

**Prove.**

- [Fičura - Impact of size and volume on cryptocurrency momentum and reversal (FFA Working Papers 5:003, 2023)](https://wp.ffu.vse.cz/artkey/wps-202301-0003_impact-of-size-and-volume-on-cryptocurrency-momentum-and-reversal.php) (accademica): L'inversione settimanale vale solo per le monete piccole e illiquide (t = -7,31). Le monete grandi e liquide mostrano momentum settimanale (t = 2,33). Oltre le 4 settimane c'è inversione anche nelle grandi.
- [Dobrynskaya - Cryptocurrency Momentum and Reversal (SSRN 3913263, Journal of Alternative Investments 2023)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3913263) (accademica): Sulle 2.000 cripto più grandi, 2014-2020: momentum fino a 2-4 settimane, inversione significativa oltre 1 mese, guidata dai perdenti del passato.
- [Liu, Tsyvinski, Wu - Common Risk Factors in Cryptocurrency (Journal of Finance 2022, NBER WP 25882)](https://cowles.yale.edu/sites/default/files/2022-10/LiuTsyvinskiWu2019%20COMMON%20RISK%20FACTORS.pdf) (accademica): Mercato, dimensione e momentum spiegano i rendimenti trasversali. Il momentum a 1 settimana funziona meglio nelle monete grandi: sotto la mediana di dimensione il guadagno non è significativo (0,6% a settimana).
- [Nagel - Evaporating Liquidity (NBER WP 17653, RFS 2012)](https://www.nber.org/papers/w17653) (accademica): I rendimenti delle strategie di inversione di breve periodo sono un indicatore del guadagno di chi fornisce liquidità. Il VIX li prevede: rendimento atteso e Sharpe condizionato salgono molto nelle fasi di turbolenza.

**Fuori campione.** I campioni accademici finiscono nel 2018-2020. Fičura dice che i risultati sono robusti alle soglie. Non ho trovato una verifica dopo il 2021 né sulle perpetual. La variante Nagel è stata dimostrata sulle azioni, non sulle cripto.

**Come fallisce.** Con 36 monete i quintili sono di circa 7 monete: il rumore è alto. Ci sono strette sulle posizioni corte delle altcoin (short squeeze). Il funding può costare molto sulla gamba corta. Le monete cambiano nome o vengono tolte dal listino (MATIC diventato POL, FTM diventato S, RNDR diventato RENDER): attenzione al bias di sopravvivenza. Durante i crolli del momentum la gamba momentum perde (Daniel e Moskowitz).

### Regolatore di volatilità del portafoglio (volatility targeting) sopra il sistema attuale

Priorità 5. Mercati: Tutte le 36 perpetual; si applica al sistema esistente. Timeframe: segnali a 4 ore, ricalcolo giornaliero.. Provabile con i nostri dati: sì (Solo candele a 4 ore e i trade del sistema attuale. Opzionale: il funding per il costo di mantenimento.).

La volatilità si ripete a breve termine: oggi alta vuol dire domani probabilmente alta. I rendimenti attesi invece non salgono abbastanza da compensare. Tagliare l'esposizione quando la volatilità sale riduce le code sinistre e i crolli del momentum, che arrivano proprio negli stati di panico (alta volatilità dopo una discesa). Il motivo è comportamentale e di struttura: dopo i crolli scattano le liquidazioni forzate e la leva viene ridotta. È un miglioramento del rischio, non un nuovo segnale.

**Regole.** Dati: rendimenti a 4 ore di ogni moneta e del portafoglio. 1) Volatilità prevista: media mobile esponenziale (EWMA) dei rendimenti a 4 ore al quadrato, emivita da provare 30, 60 e 120 barre (5, 10 e 20 giorni). Si annualizza moltiplicando per la radice di 6x365. 2) Obiettivo di portafoglio: per esempio 25-30% annuo. Si confronta con il calo massimo attuale del 13,5%. 3) Ogni 6 barre (1 giorno) si calcola il moltiplicatore: obiettivo diviso per la volatilità realizzata del portafoglio delle posizioni aperte. Il moltiplicatore va tenuto tra 0,25 e 1,5. Si applica al rischio per operazione: 1% x moltiplicatore. 4) Stato di panico: se BTC chiude il giorno sotto la sua media a 50 giorni e la sua volatilità a 20 giorni è nel 20% più alto degli ultimi 365 giorni, il rischio per operazione passa a 0,5% (riprende Daniel e Moskowitz). 5) Per non pagare troppi costi si ribilancia solo se il moltiplicatore cambia di oltre il 20%. Confronto obbligatorio: sistema attuale con 1% fisso contro sistema con il moltiplicatore, sugli stessi segnali. Va notato che lo stop a 3 ATR con rischio 1% è già una dimensione per volatilità per singola operazione. Qui si aggiunge il livello del portafoglio e del regime.

**Prove.**

- [Harvey, Hoyle, Korgaonkar, Rattray, Sargaison, Van Hemert - The Impact of Volatility Targeting (Journal of Portfolio Management 2018, Man AHL / Duke)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf) (gestore o exchange): Su oltre 60 attivi la scalatura per volatilità riduce la probabilità di perdite estreme e la volatilità della volatilità. Sulle azioni USA lo Sharpe passa da 0,40 a circa 0,48-0,51 e la volatilità della volatilità da 4,6% a 1,8%. Su obbligazioni, valute e materie prime l'effetto sullo Sharpe è trascurabile. Letto tramite gli estratti della ricerca e la pagina Man; il PDF non era raggiungibile.
- [Moreira e Muir - Volatility Managed Portfolios (NBER WP 22208, Journal of Finance 2017)](https://www.nber.org/papers/w22208) (accademica): I portafogli che prendono meno rischio quando la volatilità è alta producono alpha grandi e Sharpe dei fattori più alti.
- [Cederburg, O'Doherty, Wang, Yan - On the Performance of Volatility-Managed Portfolios (JFE 2020)](https://www.lehigh.edu/~xuy219/research/COWY.pdf) (accademica): Le versioni costruibili in tempo reale (fuori campione) spesso hanno Sharpe più bassi delle versioni non gestite. Vincono in 53 casi su 103 e lo Sharpe migliora in modo costante solo in 8 strategie, concentrate in momentum, redditività e betting-against-beta. La causa è l'instabilità strutturale.
- [Daniel e Moskowitz - Momentum Crashes (NBER WP 20439, JFE 2016)](https://www.nber.org/papers/w20439) (accademica): I crolli del momentum avvengono negli stati di panico, dopo discese di mercato con volatilità alta, e sono in parte prevedibili. Una strategia dinamica che scala con media e varianza previste circa raddoppia lo Sharpe del momentum statico.
- [Habeli, Barakchian, Motavasseli - Adaptive Risk Allocation in Crypto Markets: Evaluating Volatility-Scaled Portfolios (SSRN 2024, preprint)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5090097) (accademica): Sulle cripto la scalatura per volatilità aumenta lo Sharpe, soprattutto nelle strategie momentum e nel portafoglio di mercato. Il beneficio regge anche con limiti stretti di leva. Non è ancora sottoposto a revisione.

**Fuori campione.** Sulle azioni l'effetto sul rischio di coda è robusto (Harvey e altri). L'aumento dello Sharpe fuori campione invece è fragile: Cederburg e altri trovano vittorie solo nel 51% dei casi, ma il momentum è tra le strategie dove funziona di più, e il nostro sistema è di tipo momentum. Sulle cripto esiste un solo preprint (Habeli e altri) e non ho visto i suoi numeri. Su BTC per ora non c'è una prova fuori campione sottoposta a revisione.

**Come fallisce.** Riduce l'esposizione dopo lo shock, quindi non protegge dal primo crollo improvviso (gap del 10 ottobre 2025). Può ridurre l'esposizione proprio prima dei forti rimbalzi. Ribilanciare spesso costa (0,31% per andata e ritorno). Se si ottimizzano emivita e obiettivo sui 3 anni si cade nel sovra-adattamento.

### Miti

- **RSI sotto 30 vuol dire comprare, sopra 70 vendere (regola tipica di TikTok e YouTube)** Usato da solo come segnale di acquisto dà risultati scarsi: spesso il prezzo continua a scendere. Su BTC anche la versione più studiata (RSI(2) con filtro di trend) perde contro il comprare e tenere dopo i costi nel 2016-2025. L'RSI funziona, quando funziona, solo dentro un filtro di trend e su mercati che ritornano davvero alla media.
- **Una strategia con il 90% di operazioni vincenti è una macchina da soldi** Le alte percentuali di vincita nel ritorno alla media nascono da uscite con piccoli guadagni e perdite rare ma grandi (asimmetria negativa). Molti risultati dichiarati vengono da pochi trade o da chi vende la strategia (per esempio il 96,77% dichiarato da Connors per sé). Contano l'aspettativa dopo i costi, il calo massimo e il numero di trade, non la percentuale di vincite.
- **Quando il prezzo tocca la banda di Bollinger inferiore bisogna comprare, perché il 95% del prezzo sta dentro le bande** I prezzi hanno code grasse, quindi la regola del 95% non vale. Usate in modo semplice, le bande non battono il comprare e tenere (Lento e altri). Dopo che sono diventate popolari la loro redditività è calata di circa il 50%, e negli USA non c'è più vantaggio dal 2002 circa (Fang, Jacobsen, Qin).
- **Lo squeeze delle bande ti dice dove esploderà il prezzo** La compressione prevede solo un movimento più ampio, non la direzione: in una simulazione su 400.000 barre la direzione era quasi una moneta lanciata e il 43% delle prime rotture rientrava entro 3 barre. Nessuno studio accademico solido conferma lo squeeze come segnale.
- **Mediare al ribasso, il martingala e i grid bot sono sicuri perché il prezzo torna sempre** Il martingala non crea nessun vantaggio sul prezzo: cambia solo quanto rischi dopo le perdite, e un trend persistente fa saltare il conto. I grid bot non sanno in che direzione va il trend. Lo dicono perfino gli exchange che vendono questi bot. Sulle perpetual con leva il prezzo che 'torna' può arrivare dopo la liquidazione.
- **Le cripto, come le azioni, ritornano alla media nel breve periodo: basta comprare chi è sceso di più questa settimana** Sulle monete grandi e liquide (come le nostre 36) i dati mostrano momentum settimanale. L'inversione settimanale vale per le monete piccole e illiquide. L'inversione delle grandi arriva solo oltre le 4 settimane.
- **Il volatility targeting migliora sempre lo Sharpe** Riduce in modo affidabile le code e la volatilità della volatilità. Ma lo Sharpe migliora soprattutto sugli attivi rischiosi, e fuori campione le versioni costruibili in tempo reale battono quelle non gestite solo in 53 strategie su 103. È uno strumento di rischio, non una fonte di alpha garantita.
- **Lo stop loss protegge sempre, oppure al contrario lo stop loss rovina sempre il ritorno alla media** Kaminski e Lo dimostrano che se i rendimenti sono casuali gli stop abbassano sempre il rendimento atteso, mentre aggiungono valore quando c'è momentum condizionato. Sulle cripto uno stop semplice ha migliorato lo Sharpe di portafogli a bassa volatilità (rapporto a campana con la soglia). Dipende dal processo dei prezzi e va misurato, ma con la leva uno stop di emergenza serve comunque contro la rovina.
- **Funding molto positivo vuol dire che il crollo è imminente, funding negativo vuol dire che il rimbalzo è sicuro** Il funding può restare estremo per un intero trimestre. La reazione dipende dalla direzione della giornata: gli estremi nei giorni di rialzo tornano indietro, quelli nei giorni di ribasso continuano. Le prove sono preprint con pochi eventi.
- **Le inversioni di brevissimo periodo (scalping) sulle cripto sono soldi facili perché statisticamente evidenti** L'inversione a 15 minuti è reale sul 90% delle coppie Binance, ma il guadagno lordo (circa 1,3 punti base) è sotto il costo (circa 5 punti base). Con i nostri costi (0,31% per andata e ritorno) è ancora peggio.
- **Una strategia famosa e pubblicata continua a funzionare uguale** Le bande di Bollinger hanno perso circa metà della redditività dopo il libro. Lo stesso Larry Williams ha scritto che il suo volatility breakout non funziona più bene come prima. I test di Connors non correggono per il data mining e non hanno prova fuori campione.

### Da leggere

- [The Impact of Volatility Targeting (Harvey, Hoyle, Korgaonkar, Rattray, Sargaison, Van Hemert)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf): Il volatility targeting riduce le code e la volatilità della volatilità su oltre 60 attivi. Migliora lo Sharpe solo sugli attivi rischiosi. È la base per regolare la dimensione delle posizioni.
- [Volatility Managed Portfolios (Moreira e Muir, NBER WP 22208)](https://www.nber.org/papers/w22208): Prendere meno rischio quando la volatilità è alta aumenta gli alpha e lo Sharpe dei fattori. È l'articolo che ha lanciato il tema.
- [On the Performance of Volatility-Managed Portfolios (Cederburg, O'Doherty, Wang, Yan)](https://www.lehigh.edu/~xuy219/research/COWY.pdf): Il controllo fuori campione: le strategie costruibili in tempo reale spesso non battono quelle non gestite. Funziona meglio sul momentum. Insegna a diffidare dei pesi ottimizzati a posteriori.
- [Momentum Crashes (Daniel e Moskowitz, NBER WP 20439)](https://www.nber.org/papers/w20439): I crolli del momentum arrivano negli stati di panico (dopo una discesa, con volatilità alta) e sono in parte prevedibili. Scalare l'esposizione dinamicamente circa raddoppia lo Sharpe.
- [Evaporating Liquidity (Nagel, NBER WP 17653)](https://www.nber.org/papers/w17653): Il ritorno alla media di breve periodo è un premio per chi fornisce liquidità. Paga di più quando la volatilità (VIX) è alta. Spiega quando conviene fare inversione.
- [When Do Stop-Loss Rules Stop Losses? (Kaminski e Lo)](https://dspace.mit.edu/handle/1721.1/114876): Gli stop aggiungono valore solo se i prezzi hanno momentum. Se i rendimenti sono casuali, il premio dello stop è sempre negativo.
- [A Quantitative Approach to Tactical Asset Allocation (Faber, SSRN 962461)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461): Un filtro di regime semplice (media a 10 mesi), verificato fuori campione su più mercati, riduce molto il calo massimo.
- [Common Risk Factors in Cryptocurrency (Liu, Tsyvinski, Wu)](https://cowles.yale.edu/sites/default/files/2022-10/LiuTsyvinskiWu2019%20COMMON%20RISK%20FACTORS.pdf): Tre fattori (mercato, dimensione, momentum) spiegano i rendimenti delle cripto. Il momentum a 1 settimana sta soprattutto nelle monete grandi.
- [Impact of size and volume on cryptocurrency momentum and reversal (Fičura)](https://quantitative.cz/wp-content/uploads/2023/09/impact_of_size_and_volume_on_cryptocurrency_momentum_and_reversal.pdf): Monete grandi e liquide: momentum settimanale. Monete piccole e illiquide: inversione settimanale. Oltre le 4 settimane: inversione per tutte.
- [Cryptocurrency Momentum and Reversal (Dobrynskaya, SSRN 3913263)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3913263): Momentum fino a 2-4 settimane, poi inversione dopo circa 1 mese, guidata dai perdenti. Il passaggio è molto più rapido che nelle azioni.
- [Seasonality, Trend-following, and Mean reversion in Bitcoin (Padysak e Vojtko, SSRN 4081000)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4081000): BTC prosegue sul massimo a 10 giorni e rimbalza sul minimo, ma la gamba sul minimo ha cali oltre l'80%.
- [Low-volatility strategies for highly liquid cryptocurrencies (Kaya e Mostowfi, Finance Research Letters)](https://digitalcollection.zhaw.ch/bitstream/11475/23853/3/2022_Kaya-Mostowfi_Low-volatility-strategies-cryptocurrencies_frl.pdf): Sulle cripto liquide, la bassa volatilità più uno stop semplice migliora lo Sharpe. Il rapporto tra soglia dello stop e Sharpe è a campana.
- [Price overreactions in the cryptocurrency market (Caporale e Plastun)](https://www.brunel.ac.uk/economics-finance-and-accounting/research/pdf/1801-Jan-GMC-Price-Overreactions-In-The-Cryptocurrency-Market.pdf): Le esagerazioni giornaliere esistono, ma scommettere contro di loro non è redditizio dopo i costi.
- [Short-horizon mean reversion in cryptocurrency markets: a matched cross-market measurement (Kitron e Wengrowicz, arXiv 2608.21888)](https://arxiv.org/pdf/2608.21888): Inversione a 15 minuti molto diffusa su Binance, ma il guadagno lordo (circa 1,3 punti base) è sotto i costi.
- [Catching Crypto Trends (Zarattini, Pagani, Barbon, Swiss Finance Institute RP 25-80)](https://concretumgroup.com/catching-crypto-trends-a-tactical-approach-for-bitcoin-and-altcoins/): Insieme di canali Donchian con dimensione per volatilità su BTC e altcoin. Riferimento per unire trend e controllo della volatilità (i numeri li ho visti solo in riassunti secondari).
- [Chaos and Order in the Bitcoin Market (Garnier e Solna, arXiv 1809.08403)](https://arxiv.org/abs/1809.08403): L'esponente di Hurst di BTC cambia per epoche. Il regime non è fisso, quindi serve un filtro dinamico.
- [A Few Notes on Short Term Trading Strategies That Work (CXO Advisory)](https://cxoadvisory.com/technical-trading/a-few-notes-on-short-term-trading-strategies-that-work): Recensione critica dei test di Connors e Alvarez: niente correzione per il data mining, niente prova fuori campione, niente costi.
- [Short Term Trading Strategies That Work (Connors e Alvarez) - NON gratuito](https://tradingmarkets.com/?p=679104): Il libro è a pagamento: legalmente gratis c'è solo l'estratto sul sito dell'editore. Le copie PDF complete che circolano sul web (mql5, thechartist ecc.) sembrano non autorizzate e non vanno usate. Regole chiave: comprare i ritracciamenti e non le rotture, solo sopra la media a 200 giorni.

### Lezioni per gli agenti

ABITUDINI DI UN TRADER DI QUESTA SCUOLA:
1) Prima il rischio, poi il segnale. Ogni giorno chiediti: quanta volatilità c'è adesso rispetto al solito, e la mia esposizione è adeguata? La prova più solida di tutto il campo è dimensionare per volatilità e ridurre negli stati di panico, non un indicatore magico.
2) Riconosci il regime prima di scegliere l'arma. Domanda fissa: BTC è in trend (efficienza alta, sopra la media, rapporto di varianza sopra 1) o in laterale? Il ritorno alla media si usa nel laterale e dentro il trend di fondo, mai contro un trend forte.
3) Chiediti sempre: chi mi sta pagando? Nel ritorno alla media vieni pagato per fornire liquidità a chi vende in preda al panico o è costretto a vendere (Nagel). Se non sai chi è il venditore forzato, probabilmente non c'è nessun vantaggio.
4) Conosci la tua moneta: sulle monete grandi e liquide l'orizzonte di 1-4 settimane è momentum, l'inversione vale oltre il mese o sulle monete piccole. Non portare sulle cripto regole nate sull'SPY senza verificarle.
5) Fai i conti con i costi prima di tutto: 0,31% per andata e ritorno. Se il guadagno medio lordo atteso di una strategia non supera almeno 3 volte i costi (circa 1%), scartala. Più il timeframe è breve, più i costi uccidono l'inversione.
6) Diffida delle percentuali di vincita. Guarda l'aspettativa per trade, la perdita peggiore, il calo massimo e il numero di trade (servono almeno 100 operazioni). Un'alta percentuale di vincite con perdite rare e grandi è il profilo di chi raccoglie monetine davanti a un rullo compressore.
7) Il ritorno alla media su perpetual con leva può distruggere il conto: mai mediare al ribasso, mai martingala, sempre uno stop di emergenza (anche largo, 3 ATR), un limite di tempo nella posizione e una dimensione dimezzata rispetto al trend following.
8) Separa i dati: decidi le soglie sulla prima metà (novembre 2023 - aprile 2025), verifica sulla seconda e non tornare a ritoccarle. Conta quanti parametri hai provato e annotali nel diario.
9) Le strategie pubblicate si consumano: dopo la pubblicazione aspettati circa metà del rendimento dichiarato (esempio delle bande di Bollinger).
10) Funding, open interest e rapporto long/short sono termometri dell'affollamento, non orologi: confermano una situazione ma non dicono quando gira. Usali come filtri (non aprire long nuovi con funding nel 5% più alto) più che come segnali.
11) Contenuti social: quando la folla su TikTok e YouTube promette "RSI 30 = 90% di vincite", trattalo come un segnale di sentiment e di affollamento, non come una prova.
DOMANDE DA FARSI PRIMA DI OGNI OPERAZIONE DI RITORNO ALLA MEDIA: In che regime sono? Il calo è dovuto a notizie vere (ribasso di fondo) o a liquidazioni senza notizie? Qual è la perdita se il crollo continua per altri 3 giorni? Il guadagno atteso supera i costi? Ho un'uscita a tempo?
ERRORI DA EVITARE: comprare il minimo durante una cascata di liquidazioni senza segni di esaurimento (open interest che smette di scendere, volume che cala); ottimizzare 5 parametri su 3 anni; credere ai numeri dichiarati da chi vende il metodo; scambiare la compressione per una previsione di direzione; aumentare la leva quando la volatilità è bassa senza un tetto.
NOTA PER IL DESK: questa lettura è stata fatta solo tramite gli estratti di WebSearch, perché WebFetch era bloccato in questa sessione. Prima di mettere soldi su un numero, un agente deve rileggere il PDF originale una volta abilitati nelle impostazioni di rete della sessione almeno nber.org, papers.ssrn.com, arxiv.org e people.duke.edu.

## 6. Macro, notizie e politica (FOMC, CPI, occupazione, dollaro, flussi ETF, stablecoin, regolamentazione, guerre e crisi) applicati a cripto e valute

Un avvertimento sul metodo prima di tutto. In questa sessione WebFetch e curl erano bloccati dalla rete per newyorkfed.org, bis.org, arxiv.org, ssrn.com, skidmore.edu e coindesk.com. Ho letto le fonti attraverso gli estratti che il motore di ricerca prende dalle pagine originali (circa 30 ricerche e più di 20 fonti diverse), non scaricando i PDF interi. Prima di mettere in produzione qualsiasi numero, va controllato sul testo originale. Per leggerli direttamente bisogna autorizzare quei domini nelle impostazioni di rete della sessione.

Cosa ho imparato:
(1) Nelle azioni i premi legati agli annunci sono reali e ben documentati. Savor e Wilson trovano 11,4 punti base nei giorni di annuncio contro 1,1 negli altri giorni. Il pre-FOMC drift di Lucca e Moench spiegava circa l'80% del premio azionario dal 1994. Il ciclo FOMC di Cieslak e colleghi concentra il premio nelle settimane pari. Però il drift pre-FOMC si è indebolito dopo la pubblicazione (Kurov, Wolfe e Gilbert: dal 2016).
(2) Le prove sulle cripto sono deboli e cambiano col periodo. Benigno e Rosa (NY Fed) trovano che bitcoin non risponde alle notizie macro, con l'eccezione del CPI. Smales e Block Scholes trovano una reazione negativa alle sorprese del CPI dal 2022. Corbet e colleghi trovano CPI e PIL non significativi e una reazione all'occupazione opposta a quella delle azioni. Pyo e Lee trovano circa +0,96% il giorno prima del FOMC e -1% il giorno stesso. Per il 2025 ci sono solo prove aneddotiche di cali nelle 48 ore dopo il FOMC (7 riunioni su 8).
(3) L'effetto più solido e utile non riguarda la direzione ma la volatilità. Attorno a CPI e FOMC la volatilità realizzata e quella implicita salgono (Kaiko, Volmex, Block Scholes) e poi calano quando l'incertezza si risolve. Nel cambio, i prezzi saltano subito sulla sorpresa (Andersen, Bollerslev, Diebold e Vega): non resta un drift facile da prendere dopo.
(4) I flussi degli ETF seguono il prezzo invece di anticiparlo. Secondo DWF la correlazione è 0,54 con i 5 giorni passati e 0,03 con i 5 giorni futuri. Le prove che i flussi prevedano i rendimenti sono deboli e dipendono da come si allineano gli orari.
(5) Le notizie di regolamentazione contano soprattutto quando cambiano lo status legale: i divieti e il trattamento come titoli fanno male, le leggi su misura fanno salire, i semplici avvertimenti non hanno effetto (Auer e Claessens, BIS).
(6) Le guerre e gli shock geopolitici non rendono bitcoin un rifugio: la correlazione con l'indice di rischio geopolitico è circa zero. Gli shock che arrivano fuori orario, con molta leva aperta, producono cascate di liquidazioni (10-11 ottobre 2025: circa 19 miliardi). Dopo le liquidazioni più grandi il rendimento medio a 30 giorni è stato più basso del normale (K33).

Per il nostro desk, quindi, la macro serve soprattutto come gestione del rischio attorno agli eventi in calendario e come filtro sulla fragilità della leva. Non è una fonte di segnali di direzione. Le poche idee di direzione (drift pre-FOMC, debolezza dopo il FOMC) hanno campioni piccoli: circa 24 riunioni FOMC e 36 CPI nel nostro periodo. Vanno trattate come ipotesi da smentire, non come vantaggi provati.

### Flussi degli ETF e offerta di stablecoin solo come contesto, non come segnale

Priorità 1. Mercati: BTC (ETF spot USA), mercato cripto nel suo insieme (stablecoin).. Provabile con i nostri dati: no (Flussi giornalieri degli ETF (per esempio Farside) e storico della capitalizzazione delle stablecoin: non li abbiamo.).

I flussi degli ETF spot su bitcoin seguono il prezzo: correlazione 0,54 con i 5 giorni prima e 0,03 con i 5 giorni dopo (DWF Labs); uscite di fondi in 7 dei 8 cali oltre il 15%. Gli studi che trovano un potere di previsione dipendono da come si allineano gli orari (Fabus e colleghi; Lim trova 53 punti base nello stesso giorno per 100 milioni, ma con effetti che poi rientrano). Per le stablecoin, Griffin e Shams hanno mostrato emissioni di Tether legate al rialzo del 2017 (manipolazione, non un segnale sano); studi più recenti trovano che dopo le emissioni BTC è sceso in media, e Coin Metrics spiega meno del 25% della crescita delle stablecoin. In breve: dati di contesto, non segnali di entrata.

**Regole.** Nessuna regola di entrata. Uso consentito: il cruscotto macro degli agenti mostra i flussi ETF a 5 giorni e la variazione a 30 giorni della capitalizzazione delle stablecoin solo come descrizione del regime. Divieto esplicito per gli agenti: aprire un'operazione perché 'ieri sono entrati X milioni negli ETF' o 'Tether ha emesso 1 miliardo'. Test eventuale, solo se i dati arrivano: regressione del rendimento di BTC del giorno t+1 sui flussi del giorno t, con orari allineati (fine sessione USA 21:00 UTC), confrontata con la regressione dei flussi sui rendimenti passati.

**Prove.**

- [DWF Labs tramite Cointelegraph, Bitcoin ETF flows follow bitcoin prices, don't predict them](https://cointelegraph.com/news/bitcoin-etf-flows-follow-price-trends-dwf-labs) (gestore o exchange): Su 694 giorni di borsa la correlazione dei flussi è 0,54 con i rendimenti dei 5 giorni prima e 0,03 con i 5 giorni dopo; uscite in 7 degli 8 cali oltre il 15%.
- [Fabus, Vartiak, Stalmasekova e Kicova, Spot Bitcoin ETF Flows and Bitcoin Returns: Timestamp Alignment and Asymmetric Feedback (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7545019) (accademica): Allineando gli orari, i rendimenti passati prevedono i flussi; i flussi passati prevedono i rendimenti solo in modo marginale; le conclusioni dipendono dalla convenzione sugli orari.
- [Lim, The Price Impact of Spot Bitcoin ETF Flows (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6592830) (accademica): Un flusso netto di 100 milioni è associato a +53 punti base nello stesso giorno; la causalità va nei due sensi e i singoli shock poi rientrano.
- [Griffin e Shams, Is Bitcoin Really Untethered?, Journal of Finance 2020](https://econpapers.repec.org/RePEc:bla:jfinan:v:75:y:2020:i:4:p:1913-1964) (accademica): I flussi di Tether del 2017 venivano da un solo soggetto, arrivavano dopo i cali e sotto le cifre tonde, ed erano legati a gran parte del rialzo: è un caso di manipolazione, non un segnale da replicare.
- [Ahmed e Aldasoro, Stablecoins and safe asset prices, BIS Working Paper 1270](https://www.bis.org/publ/work1270.htm) (accademica): Le stablecoin sono ormai grandi acquirenti di T-bill (40 miliardi nel 2024): un afflusso di 3,5 miliardi abbassa il rendimento del T-bill a 3 mesi di circa 0,7 punti base subito e fino a 4 punti base in 10 giorni; i deflussi pesano 2-3 volte di più.

**Fuori campione.** I risultati sui flussi degli ETF vengono da meno di 3 anni di dati (dal gennaio 2024) e gli studi non sono d'accordo tra loro. Il caso Tether 2017 è relativo a un periodo specifico. Non ho trovato test fuori campione che dimostrino un vantaggio.

**Come fallisce.** Usarli come segnale significa comprare dopo che il prezzo è già salito, con il rischio di farlo vicino a un massimo.

### Reazione al CPI: seguire o scommettere contro il primo movimento (test rigoroso dell'idea da TikTok 'trada il CPI')

Priorità 2. Mercati: BTC ed ETH, paniere delle 36 perpetual; in un secondo momento EURUSD per confronto.. Provabile con i nostri dati: no (Le nostre candele a 4 ore più il calendario storico delle date CPI (bls.gov, gratuito). Per misurare la sorpresa vera servirebbero anche le stime di consensus, che non abbiamo.).

La teoria (Andersen e colleghi) dice che il prezzo incorpora subito la sorpresa: dopo il salto non dovrebbe restare un drift. La volatilità invece resta alta. Sui social si promette che 'il CPI dà la direzione della settimana'. Il test serve a capire se nelle perpetual c'è una prosecuzione (sotto-reazione) o un ritorno (eccesso di reazione) dopo la candela del CPI. Smales e Block Scholes indicano una reazione negativa di BTC ai CPI più alti del previsto dal 2022: il segno della sorpresa conta, ma dopo il primo movimento potrebbe non esserci più niente da prendere.

**Regole.** Evento: candela a 4 ore delle 12:00-16:00 UTC nel giorno del CPI. Misura: R_ev = rendimento della candela diviso l'ATR(14). Variante SEGUI: se R_ev > +1, long alla chiusura; se R_ev < -1, short. Variante CONTRO: l'opposto. Uscita dopo 6 candele (24 ore) o con stop a 1,5 ATR; rischio 0,5%. Su BTC, ETH e sul paniere delle 36 coppie. Placebo: stessa regola sulla stessa fascia oraria dei giorni non CPI, per distinguere l'effetto CPI da quello dell'ora di apertura di Wall Street. Si tiene la variante solo se batte il placebo, se il risultato è positivo in almeno 2 dei 3 anni e se resta positivo con i costi raddoppiati.

**Prove.**

- [Smales (2024), Cryptocurrency as an alternative inflation hedge?, Accounting and Finance](https://ideas.repec.org/a/bla/acctfi/v64y2024i2p1589-1611.html) (accademica): Rendimenti delle cripto più bassi nei giorni di CPI e risposta negativa alle sorprese CPI (letto solo l'abstract).
- [Corbet, Larkin, Lucey, Meegan e Yarovaya (2020), The impact of macroeconomic news on Bitcoin returns, European Journal of Finance](https://eprints.soton.ac.uk/439058/1/The_impact_of_macroeconomic_news_on_Bitcoin_returns_2_.pdf) (accademica): Per CPI e PIL nessuna relazione significativa (periodo precedente); per occupazione e beni durevoli una notizia positiva abbassa BTC, al contrario delle azioni.
- [Andersen, Bollerslev, Diebold e Vega, NBER w8959](https://www.nber.org/system/files/working_papers/w8959/w8959.pdf) (accademica): Nel cambio il prezzo salta subito sulla sorpresa; solo la volatilità si adegua gradualmente.
- [Block Scholes, Is Bitcoin showing greater sensitivity to US CPI releases again](https://www.blockscholes.com/institutional-research/is-bitcoin-showing-greater-sensitivity-to-us-cpi-releases-again) (gestore o exchange): La sensibilità di BTC alle sorprese CPI cambia nel tempo: alta nel 2022-23, più bassa nel 2024-25, di nuovo in salita nel 2026.

**Fuori campione.** Non ho trovato prove pubblicate di un drift sfruttabile dopo il CPI nelle cripto. Gli studi cambiano conclusione da un periodo all'altro (Corbet: nessun effetto; Smales e Block Scholes: effetto dal 2022). Va considerata un'ipotesi probabilmente nulla.

**Come fallisce.** Con 36 eventi un risultato positivo è facilmente fortuna. La candela a 4 ore mescola il CPI con l'apertura di Wall Street (13:30-14:30 UTC). Senza le aspettative degli analisti (consensus) non si misura la sorpresa ma solo il movimento del prezzo.

### Ciclo FOMC a settimane pari applicato alle cripto (verifica di un effetto noto nelle azioni)

Priorità 2. Mercati: BTC, ETH, paniere delle 36 perpetual.. Provabile con i nostri dati: no (Le nostre candele (giornaliere ricavate dalle 4 ore) più il calendario storico delle date FOMC (federalreserve.gov, gratuito).).

Cieslak, Morse e Vissing-Jorgensen trovano che dal 1994 il premio azionario si concentra nelle settimane 0, 2, 4 e 6 dopo ogni FOMC (Sharpe 0,92 investendo solo nelle settimane pari, contro 0,45 sempre investiti). La spiegazione è un premio per le notizie della Fed, che arrivano più spesso in quelle settimane. Se le cripto sono diventate un 'asset che guarda la Fed' (ETF, correlazione con le azioni salita a 0,36 secondo il FMI), il pattern potrebbe comparire anche lì.

**Regole.** Giorno 0 = giorno del comunicato FOMC. Settimane del ciclo: settimana 0 = giorni da -1 a 3; settimana 2 = da 9 a 13; settimana 4 = da 19 a 23; settimana 6 = da 29 a 33 (giorni di borsa nel paper; da adattare ai giorni di calendario). Strategia di test: esposizione long BTC solo nelle settimane pari, flat nelle dispari, con ribilanciamento giornaliero alla candela 00:00 UTC. Come filtro: nel sistema attuale, rischio all'1% nelle settimane pari e allo 0,5% nelle dispari. Si confronta con il semplice comprare e tenere BTC, al netto dei costi.

**Prove.**

- [Cieslak, Morse e Vissing-Jorgensen, Stock Returns over the FOMC Cycle, Journal of Finance 2019 (versione di lavoro, Stern NYU)](https://stern.nyu.edu/sites/default/files/assets/documents/cycle_paper_cieslak_morse_vissing-jorgensen.pdf) (accademica): Dal 1994 al 2016 il premio azionario si guadagna tutto nelle settimane pari del ciclo FOMC; nelle dispari il rendimento medio è tra -0,09% e -0,18%; il pattern regge nei sottoperiodi e nelle borse estere.
- [IMF Blog, Crypto Prices Move More in Sync With Stocks, Posing New Risks (2022)](https://www.imf.org/en/blogs/articles/2022/01/11/crypto-prices-move-more-in-sync-with-stocks-posing-new-risks) (gestore o exchange): Correlazione giornaliera tra BTC e S&P 500 passata da 0,01 (2017-19) a 0,36 (2020-21); trasmissione degli shock in entrambe le direzioni.

**Fuori campione.** Nelle azioni l'effetto regge nei sottoperiodi fino al 2016. Non ho trovato nessuno studio che lo verifichi sulle cripto: è completamente da provare. Come altri effetti legati alla Fed, potrebbe essersi indebolito dopo la pubblicazione.

**Come fallisce.** I giorni di calendario delle cripto (7 su 7) non corrispondono ai giorni di borsa del paper. L'effetto potrebbe dipendere dall'era Greenspan e Bernanke. Ci sono solo circa 24 cicli. Il rumore delle cripto è molto più grande del possibile effetto.

### Classificatore delle notizie di regolamentazione per gli agenti che leggono le notizie

Priorità 2. Mercati: Token citati nella notizia (per esempio XRP per la causa SEC) e mercato intero per i divieti di grandi paesi.. Provabile con i nostri dati: no (Un archivio storico di notizie di regolamentazione con data e ora: non lo abbiamo. Si può iniziare a registrarlo da oggi e testarlo in futuro.).

Auer e Claessens (BIS) mostrano che il mercato reagisce soprattutto alle notizie sullo status legale: i divieti e il possibile trattamento come titoli fanno scendere i prezzi, i quadri legali su misura (leggi per cripto e ICO) li fanno salire, gli avvertimenti generici non hanno effetto visibile. Il motivo: le cripto dipendono da banche ed exchange regolati, quindi le regole nazionali contano. Serve agli agenti IA che leggono le notizie per non reagire al rumore.

**Regole.** Un agente che legge le notizie classifica ogni notizia di regolamentazione in una di 4 classi. (1) DIVIETO o trattamento come titolo / causa della SEC contro un token o un exchange: punteggio -2. (2) Regole antiriciclaggio o su exchange e banche: -1. (3) Legge o quadro su misura approvato, ETF approvato, chiarezza legale: +2. (4) Avvertimento, dichiarazione di un politico, consultazione: 0, cioè ignorare. Azione: se la classe è 1 o 3 e riguarda una giurisdizione principale (USA, UE, Cina, Corea), il punteggio si registra e il desk prende soltanto le operazioni nella stessa direzione sulle coin coinvolte per 3 giorni (per esempio con -2 non si aprono long sul token citato). Nessuna entrata basata solo sulla notizia. La classificazione va salvata con data e ora per testarla a posteriori.

**Prove.**

- [Auer e Claessens, Regulating cryptocurrencies: assessing market reactions, BIS Quarterly Review settembre 2018](https://www.bis.org/publ/qtrpdf/r_qt1809f.htm) (accademica): La reazione più forte riguarda lo status legale: divieti e trattamento come titoli negativi, quadri su misura positivi, avvertimenti senza effetto; i mercati sono separati per giurisdizione (premio coreano).
- [Versione CEPR / VoxEU dello stesso studio](https://cepr.org/article/regulating-cryptocurrencies-assessing-market-reactions) (accademica): Stessi risultati: la sola persuasione morale non frena la speculazione; contano le regole su chi dà accesso alle cripto (exchange, banche).

**Fuori campione.** Lo studio copre il periodo fino al 2018. L'aggiornamento CESifo del 2020 lo conferma con modifiche minime. Non ho trovato una verifica sistematica dopo il 2020. Episodi come l'approvazione degli ETF a gennaio 2024 (calo del 7-15% nei giorni dopo) mostrano che una notizia positiva molto attesa può già essere nel prezzo.

**Come fallisce.** Una notizia attesa da tempo è già nel prezzo (vendere sulla notizia). La classificazione di un modello linguistico può sbagliare. Non c'è uno storico di notizie con data e ora per testare la regola sul passato.

### Asimmetria attorno al FOMC su BTC: drift prima del comunicato, debolezza dopo (ipotesi da smentire)

Priorità 3. Mercati: BTC ed ETH perpetual; come estensione, il paniere delle 36 coppie pesato in parti uguali.. Provabile con i nostri dati: no (Le nostre candele a 4 ore di BTC ed ETH più il calendario storico delle date FOMC (pubblico e gratuito su federalreserve.gov, ma non tra i nostri dati).).

Nelle azioni il rendimento si concentrava nelle ore prima del FOMC, forse come premio per l'incertezza che si risolve (Lucca e Moench), ma l'effetto si è indebolito dopo la pubblicazione (Kurov e colleghi, dal 2016). Su bitcoin Pyo e Lee riportano circa +0,96% il giorno prima e -1% il giorno dell'annuncio. Una fonte di settore (Two Prime, riportata da CryptoSlate) indica un calo entro 48 ore in 7 delle 8 riunioni del 2025. Spiegazione possibile: chi è coperto o a leva riduce il rischio dopo l'evento, oppure il mercato si muove in anticipo e poi 'vende la notizia'. Le prove sono deboli e il campione è minuscolo.

**Regole.** Gamba 1 (prima): long BTC perpetual all'apertura della candela 00:00 UTC del giorno prima del FOMC; uscita all'apertura della candela 16:00 UTC del giorno del FOMC, quindi prima del comunicato. Stop a 2 ATR (ATR a 14 candele da 4 ore). Rischio 0,5% del capitale. Gamba 2 (dopo): short BTC all'apertura della candela successiva a quella del comunicato (20:00 UTC, o 00:00 UTC se d'inverno la conferenza sfora); uscita dopo 12 candele (48 ore) o allo stop a 2 ATR. Rischio 0,5%. Le due gambe si testano separatamente e anche filtrate per il lato deciso da BTC nel sistema attuale (prendere solo la gamba concorde con il trend). Verifica con un placebo: ripetere le stesse finestre su date a caso non FOMC e su giorni di CPI, per vedere se il risultato è davvero legato al FOMC. Commissione 0,055% per lato e slittamento 0,1% inclusi.

**Prove.**

- [Lucca e Moench, The Pre-FOMC Announcement Drift, NY Fed Staff Report 512 / Journal of Finance 2015](https://www.newyorkfed.org/research/staff_reports/sr512) (accademica): Rendimenti azionari anomali nelle ore prima dei FOMC programmati, pari a circa l'80% del premio azionario annuo dal 1994; nessun effetto su Treasury e valute.
- [Kurov, Wolfe e Gilbert, The Disappearing Pre-FOMC Announcement Drift, Finance Research Letters (2021)](https://ideas.repec.org/a/eee/finlet/v40y2021ics1544612320315956.html) (accademica): Dal gennaio 2016 il drift si è molto indebolito anche nelle riunioni con conferenza stampa; nelle altre era già sparito.
- [Pyo e Lee, Do FOMC and macroeconomic announcements affect Bitcoin prices?, Finance Research Letters 2020 (pagina ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S154461231930159X) (accademica): BTC circa +0,96% il giorno prima del FOMC e circa -1% il giorno dell'annuncio; dati giornalieri e periodo pre-ETF.
- [CryptoSlate, Bitcoin falling after Fed meetings is becoming systemic (marzo 2026), dati Two Prime](https://cryptoslate.com/bitcoin-traders-dump-coins-within-48-hours-of-fed-meetings-as-new-data-reveals-systematic-fomc-weakness/) (aneddotica): Calo entro 48 ore in 7 delle 8 riunioni FOMC del 2025 (tra circa -5% e -13%); secondo lo stesso articolo la tendenza al ribasso è più chiara dal 2024 e non vale per tutto il periodo 2020-2026.
- [Tesi di laurea della Lund University e tesi Nova (run.unl.pt) sul FOMC e bitcoin](https://run.unl.pt/server/api/core/bitstreams/a28b97c5-2eea-4448-96bb-db7526af22ed/content) (accademica): Risultati contrari: nella finestra [-2,-1] sale la volatilità ma non c'è un drift di prezzo; i rendimenti cumulati anomali sono quasi tutti non significativi.

**Fuori campione.** Nelle azioni l'effetto si è indebolito dopo la pubblicazione (2016 in poi). Su bitcoin i risultati sono contraddittori tra gli studi e cambiano segno da un periodo all'altro. Una fonte segnala che nell'era degli ETF l'effetto cambia segno; non l'ho potuta verificare. Nel nostro periodo ci sono circa 24 riunioni: troppo poche per una conclusione statistica forte.

**Come fallisce.** (1) Campione minuscolo: un solo FOMC con un movimento di +10% decide tutto. (2) Se il risultato si regge su una sola gamba o un solo anno (per esempio il 2025), è probabile rumore. (3) Se il mercato anticipa il pattern, il comportamento si sposta in avanti. (4) Ogni operazione paga circa 0,31% tra commissioni e slittamento per andata e ritorno, che si mangia gran parte di un vantaggio dell'1%.

### Protezione del fine settimana e delle ore fuori mercato contro gli shock politici

Priorità 3. Mercati: Tutte le 36 perpetual; impatto maggiore sulle altcoin a beta alto (SOL, SUI, WLD, ORDI, ecc.).. Provabile con i nostri dati: sì (Solo i nostri dati: candele a 4 ore, open interest e funding.).

Le cripto sono le uniche aperte quando le borse sono chiuse. Gli annunci politici del venerdì sera o del weekend (dazi del 10 ottobre 2025; attacchi in Medio Oriente nei weekend del 2024-2025) si scaricano su un mercato con meno liquidità e la stessa leva. La logica è la struttura del mercato (liquidità bassa e liquidazioni), non una previsione della direzione.

**Regole.** Finestra di rischio: dalla candela delle 20:00 UTC di venerdì alla candela delle 20:00 UTC di domenica. Se lo stato del 'Termometro della leva' è FRAGILE oppure l'OI_z di BTC è sopra 1,5: (a) nessuna nuova entrata sulle altcoin nella finestra; (b) le posizioni aperte con guadagno sotto +1R vengono dimezzate alla chiusura della candela 16:00-20:00 UTC di venerdì; (c) quelle con guadagno sopra +1R mettono lo stop a pareggio. Fuori dallo stato FRAGILE il weekend si opera normalmente. Confronto da fare: rendimento e calo massimo del sistema attuale con e senza la regola, e distribuzione delle perdite peggiori (le 10 peggiori singole operazioni).

**Prove.**

- [CoinGecko Learn, October 10 crypto crash explained](https://www.coingecko.com/learn/october-10-crypto-crash-explained) (aneddotica): Il crollo è partito venerdì sera dopo l'annuncio dei dazi al 100% sulla Cina, fatto a mercati USA chiusi; liquidazioni stimate intorno ai 19 miliardi tra il 10 e l'11 ottobre.
- [WisdomTree, Is bitcoin a safe haven asset in a geopolitically uncertain world (ottobre 2024)](https://www.wisdomtree.com/dk/insights/blog/is-bitcoin-a-safe-haven-asset-in-a-geopolitically-uncertain-world) (gestore o exchange): Correlazione circa -0,03 tra bitcoin e l'indice di rischio geopolitico di Caldara e Iacoviello (2014-2024); in alcuni eventi (invasione dell'Ucraina) BTC è sceso il giorno stesso e non ha recuperato entro 30 giorni.
- [Bitwise tramite Scalable Capital, Is Bitcoin digital gold?](https://it.scalable.capital/en/finances-stock-market/is-bitcoin-digital-gold) (gestore o exchange): Sui 20 picchi di rischio geopolitico più grandi dal 2010, in media BTC è salito nei 50 giorni successivi. Lo shock iniziale è quindi un rischio di breve periodo, non una tendenza.

**Fuori campione.** Non ci sono studi sistematici; le prove sono episodi. Che gli eventi del weekend siano più dannosi va verificato sui nostri dati: confrontare la distribuzione dei rendimenti delle candele del weekend con quella dei giorni feriali, nelle code oltre 3 ATR, separando le fasi con leva alta da quelle con leva bassa.

**Come fallisce.** Anche nei weekend ci sono forti rialzi che si perderebbero. Molti shock arrivano in giorni feriali. Se la regola scatta troppo spesso, riduce soltanto l'esposizione e quindi il rendimento.

### Termometro della leva: ridurre il rischio quando open interest e funding segnalano fragilità (prima degli shock)

Priorità 4. Mercati: Perpetual Binance di tutte le 36 coppie; utile soprattutto per le altcoin a beta alto.. Provabile con i nostri dati: sì (Solo i nostri dati: candele a 4 ore, open interest, funding a 8 ore e rapporto long/short dei top trader per le 36 coppie.).

Gli shock macro e politici diventano crolli quando c'è molta leva aperta. Il 10-11 ottobre 2025 un annuncio di dazi del venerdì sera, a borsa USA chiusa, ha causato circa 19 miliardi di liquidazioni e un forte calo dell'open interest; nei giorni prima l'open interest era salito (da circa 38 a oltre 47 miliardi secondo un analista). Il motivo è strutturale: le liquidazioni forzate vendono in automatico e si alimentano a vicenda. Il filtro non prevede la notizia, ma riduce il danno quando arriva.

**Regole.** Dati: open interest (OI), funding a 8 ore e rapporto long/short dei top trader, per ogni coppia e per BTC. Indicatori: OI_z = z-score dell'OI aggregato delle 36 coppie (o di BTC) sulle ultime 90 giornate di candele a 4 ore; dOI_7g = variazione percentuale dell'OI in 7 giorni; funding_7g = media del funding degli ultimi 21 pagamenti. Stato FRAGILE se dOI_7g è nel decile più alto della storia passata (solo finestra che avanza, nessun dato futuro), funding_7g è sopra il suo 80° percentile e il rapporto long/short dei top trader è sopra il suo 80° percentile. Se lo stato è FRAGILE: rischio per operazione allo 0,5%, niente nuovi long sulle altcoin, trailing più stretto (2 ATR invece di 3) sulle posizioni long aperte. Se l'OI aggregato scende più del 15% in 24 ore insieme a un calo del prezzo di BTC superiore all'8% (cascata in corso): nessuna nuova entrata, né long né short, per 2 giorni (12 candele). Lo stato FRAGILE finisce quando dOI_7g torna sotto la mediana. Le soglie vanno fissate con la finestra che avanza e poi tenute ferme.

**Prove.**

- [The Block, Crypto liquidations near $10 billion in historic drawdown following Trump's 100% tariffs on China (ottobre 2025)](https://www.theblock.co/post/374266/crypto-liquidations-near-10-billion-in-historic-drawdown-following-trumps-100-tariffs-on-china) (aneddotica): Liquidazioni record dopo l'annuncio dei dazi arrivato venerdì a borsa chiusa; altre fonti parlano di 19 miliardi e di un forte calo dell'open interest (stime diverse tra i fornitori).
- [CoinShares, Billions in liquidations: what happened?](https://etp.coinshares.com/insights/knowledge/billions-in-liquidations-what-happened/) (gestore o exchange): Il dato ufficiale delle liquidazioni è probabilmente sottostimato; secondo Amberdata l'OI dei futures è passato da 175 a 125 miliardi in meno di un giorno.
- [K33 Research tramite The Block, What's next after crypto's largest long liquidation event since February?](https://www.theblock.co/post/372115/whats-next-after-cryptos-fourth-largest-long-liquidation-event-of-2025) (pratico con backtest): Nei 30 giorni dopo il 5% di liquidazioni più grandi di ogni anno BTC ha reso in media lo 0,78%, contro il 5,9% di un periodo normale di 30 giorni; circa un quarto dei casi è stato un minimo locale, il quarto peggiore ha perso il 6%.
- [BeInCrypto, Bitcoin's Most Dangerous Setups Formed Days Before October 10 Crash](https://beincrypto.com/liquidation-cascade-onchain-technical-analysis/) (aneddotica): Racconta che OI e leva erano saliti nei giorni prima del crollo del 10 ottobre. Analisi a posteriori su un solo evento.

**Fuori campione.** Non ho trovato uno studio accademico fuori campione su questo filtro preciso. Le prove sono un singolo evento estremo (ottobre 2025) e la statistica K33 sulle settimane dopo le liquidazioni (solo BTC, dati incompleti per Binance e OKX). Il nostro periodo 2023-2026 contiene diverse cascate (agosto 2024, febbraio 2025, aprile 2025 Liberation Day, ottobre 2025), quindi si può testare, ma con pochi eventi.

**Come fallisce.** (1) Le soglie per percentile possono essere ottimizzate troppo sul passato. (2) Nei mercati rialzisti forti OI e funding restano alti per mesi: il filtro riduce i guadagni. (3) Il rapporto long/short dei top trader di Binance non rappresenta tutto il mercato. (4) Nella cascata del 10 ottobre il crollo è stato in poche ore: un filtro su candele a 4 ore può intervenire tardi.

### Scudo eventi: niente nuove entrate e rischio ridotto attorno a CPI, FOMC e NFP (filtro da aggiungere al sistema attuale)

Priorità 5. Mercati: Tutte le perpetual USDT, soprattutto BTC ed ETH; le altcoin seguono BTC con beta più alto. Adatto anche alle coppie in dollari del forex.. Provabile con i nostri dati: no (Le nostre candele a 4 ore bastano per eseguire il test, ma serve in più il calendario storico delle date di CPI, NFP e FOMC. È pubblico e gratuito (bls.gov e federalreserve.gov), ma oggi non è tra i nostri dati.).

Attorno agli annunci in calendario la volatilità realizzata di bitcoin sale molto: Kaiko ha misurato più volatilità nelle 6 ore prima e dopo il CPI, e Volmex trova salti grandi del BVIV nell'ora del CPI e della decisione Fed. Le sorprese fanno saltare il prezzo subito (Andersen e colleghi sul cambio), quindi uno stop a 3 ATR calcolato sulla volatilità normale può essere superato da un salto o eseguito con forte slittamento. Una rottura di volume nella candela dell'annuncio è spesso rumore causato dall'evento, non l'inizio di un trend. Non è un premio da incassare: è un modo per evitare perdite stupide, cioè gestione del rischio basata sulla struttura del mercato.

**Regole.** Calendario: date e ore ufficiali di CPI (BLS, 8:30 ET), NFP (BLS, primo venerdì del mese, 8:30 ET) e decisione FOMC (federalreserve.gov, 14:00 ET, conferenza stampa alle 14:30 ET). In UTC il CPI e l'NFP cadono nella candela a 4 ore delle 12:00-16:00. Il comunicato FOMC cade nella candela 16:00-20:00; d'inverno la conferenza può proseguire nella candela 20:00-24:00. Regola A (blocco): nessuna nuova entrata su segnali generati dalla candela prima dell'evento, dalla candela dell'evento e, per il FOMC, anche dalla candela successiva. Regola B (rischio dimezzato): nelle 24 ore dopo l'evento il rischio per operazione passa dall'1% allo 0,5%. Regola C (posizioni aperte): se una posizione aperta non ha ancora raggiunto almeno +1R, alla chiusura della candela prima dell'evento si chiude metà posizione, oppure si porta lo stop a pareggio se il guadagno è sopra +1R. Si applica a tutte le 36 coppie, sul timeframe a 4 ore. Test: confrontare il sistema attuale con e senza scudo per rendimento, calo massimo, numero di operazioni perse in un'unica candela oltre 1,5R e slittamento medio stimato. Varianti da provare separatamente: solo FOMC, solo CPI, tutti e tre.

**Prove.**

- [Kaiko Research tramite CoinDesk (2023): Bitcoin tends to become more volatile around monthly US inflation readings](https://hotfix.coindesk.com/markets/2023/05/10/bitcoin-tends-to-become-more-volatile-around-monthly-us-inflation-readings-kaiko) (gestore o exchange): Volatilità intraday di BTC più alta nelle 6 ore prima e dopo il dato CPI, in modo costante nei mesi osservati. Letto solo attraverso l'estratto di ricerca: la pagina non era raggiungibile.
- [Volmex Labs (2024), Macroeconomic Announcements Fuel Volatility: An In-Depth Analysis](https://volmex.finance/Macroeconomic Announcements Fuel Volatility An In-Depth Analysis.pdf) (gestore o exchange): Regressione su candele di 1 ora: il CPI e la decisione Fed aumentano molto la volatilità di BTC e del BVIV (escursione del BVIV +104,3 punti nell'ora del CPI e +103,0 nell'ora della Fed); dopo l'annuncio il BVIV tende a scendere. Lo studio è fatto dall'emittente dell'indice.
- [Benigno e Rosa, The Bitcoin–Macro Disconnect, NY Fed Staff Report 1052 (2023), e il post su Liberty Street Economics](https://libertystreeteconomics.newyorkfed.org/2023/02/is-there-a-bitcoin-macro-disconnect/) (accademica): Studio di evento intraday: bitcoin non reagisce in modo significativo alle notizie macro e monetarie, tranne il CPI.
- [Block Scholes, Is Bitcoin showing greater sensitivity to US CPI releases again (luglio 2026)](https://www.blockscholes.com/institutional-research/is-bitcoin-showing-greater-sensitivity-to-us-cpi-releases-again) (gestore o exchange): Regressione mobile su 12 pubblicazioni: la sensibilità di BTC alle sorprese CPI è di nuovo in salita, come nel 2022-23, mentre quella ai payroll è calata (R² dei payroll al 59% a giugno 2024).
- [Andersen, Bollerslev, Diebold e Vega, Micro Effects of Macro Announcements, NBER w8959 / American Economic Review 2003](https://www.nber.org/papers/w8959) (accademica): Nel cambio, le sorprese producono salti immediati della media; la volatilità si adegua più lentamente; le notizie negative pesano più di quelle positive.
- [CME Group, How FX and equities trade economic data sets (2025)](https://www.cmegroup.com/insights/economic-research/2025/how-fx-equities-trade-economic-data-sets.html) (gestore o exchange): Nel primo minuto dopo un NFP con sorpresa di una deviazione standard i futures sulle valute passano da circa 1.704 a circa 19.836 contratti. Per le valute l'NFP muove più del CPI; le azioni reagiscono di più all'inflazione.

**Fuori campione.** Come filtro di rischio non dipende da una pubblicazione da sfruttare: l'aumento di volatilità attorno agli annunci è osservato nel cambio dagli anni '90 (Andersen e colleghi) e nelle cripto in vari periodi (Kaiko 2023, Volmex 2024, Block Scholes 2026). La forza però cambia nel tempo: dal 2024 al 2025 il CPI ha contato meno e i payroll di più (Block Scholes). Non ho trovato un backtest pubblicato di questo filtro sulle perpetual: va misurato da noi.

**Come fallisce.** (1) Si perdono le rotture vere che partono proprio dall'annuncio: un cambio di regime della Fed può iniziare quel giorno. (2) Gli shock non in calendario (dazi, guerre, hack) non sono coperti. (3) Le date vanno gestite con cura: ora legale USA, riunioni straordinarie, pubblicazioni rinviate (es. shutdown). (4) Con circa 24 FOMC e 36 CPI, la differenza tra le due versioni può essere solo rumore: usare il bootstrap sulle operazioni.

### Miti

- **Bitcoin protegge dall'inflazione: se il CPI esce alto, bitcoin sale.** Dal 2022 la reazione media di BTC a un CPI più alto del previsto è negativa: un'inflazione alta significa tassi più alti più a lungo, quindi meno liquidità. In periodi precedenti la relazione era nulla.
- **Bitcoin è l'oro digitale: nelle guerre e nelle crisi sale.** La correlazione con l'indice di rischio geopolitico è circa zero (-0,03 tra il 2014 e il 2024). In eventi come l'invasione dell'Ucraina BTC è sceso il giorno stesso. Gli shock del weekend con molta leva aperta causano crolli (10 ottobre 2025). Il rialzo medio a 50 giorni trovato da Bitwise non protegge dal calo dei primi giorni.
- **Gli ingressi negli ETF di oggi dicono dove andrà bitcoin domani.** I flussi seguono il prezzo: correlazione 0,54 con i 5 giorni passati e 0,03 con i 5 futuri. Le prove di previsione sono marginali e dipendono dall'allineamento degli orari.
- **Tether stampa un miliardo, quindi arriva il pump.** Lo studio più famoso (Griffin e Shams) descrive una manipolazione del 2017, non un segnale da sfruttare. Studi più recenti trovano BTC in media più basso subito dopo le emissioni, e i modelli di Coin Metrics spiegano meno del 25% della crescita delle stablecoin.
- **Il drift prima del FOMC sono soldi gratis: compra prima della Fed.** Era vero nelle azioni fino a circa il 2015, ma si è indebolito dopo la pubblicazione (dal 2016). Sulle cripto gli studi si contraddicono e negli ultimi anni prevale la debolezza attorno al FOMC.
- **Da TikTok e YouTube: 'entra appena esce il dato CPI o NFP, la direzione è sicura'.** Il prezzo incorpora la sorpresa in pochi secondi o minuti. Nel minuto dopo un NFP i contratti scambiati sui futures delle valute si moltiplicano per più di dieci: gli algoritmi arrivano prima. Il trader privato entra dopo il salto, con spread larghi e slittamento, e poi la volatilità resta alta in entrambe le direzioni.
- **Dopo una grande cascata di liquidazioni il fondo è fatto: compra subito.** Secondo K33, nei 30 giorni dopo il 5% di liquidazioni più grandi BTC ha reso in media lo 0,78% contro il 5,9% di un periodo normale: solo un quarto dei casi è stato un minimo, il quarto peggiore ha perso un altro 6%.
- **Bitcoin se ne frega della macro (oppure, il contrario: bitcoin si muove solo per la Fed).** Sono sbagliate tutte e due. La sensibilità cambia col periodo: quasi nulla nel campione della NY Fed (tranne il CPI); forte con il CPI nel 2022-23, poi con i payroll nel 2024, di nuovo con il CPI nel 2026. Va misurata di continuo, non data per scontata.
- **Gli avvertimenti delle autorità ('le cripto sono rischiose') fanno crollare il mercato.** Gli avvertimenti generici non hanno un effetto visibile sui prezzi. Contano solo le notizie che cambiano lo status legale: divieti, trattamento come titoli, quadri legali su misura.
- **Compra la voce, vendi la notizia: funziona sempre.** Ci sono episodi famosi (approvazione degli ETF a gennaio 2024: calo del 7-15% nei primi giorni, misure diverse a seconda della fonte), ma nessuno studio sistematico che lo dimostri come regola. Sono racconti scelti a posteriori.

### Da leggere

- [The Pre-FOMC Announcement Drift (Lucca e Moench, NY Fed Staff Report 512)](https://www.newyorkfed.org/research/staff_reports/sr512): Come si misura un effetto legato a un annuncio in calendario; i rendimenti si concentrano prima del FOMC nelle azioni, non nelle valute né nei Treasury.
- [The Disappearing Pre-FOMC Announcement Drift (Kurov, Wolfe e Gilbert, working paper)](https://www.skidmore.edu/economics/documents/KurovWolfeGilbert-TheDisappearingPre-FOMC-Announce-Drift-200914.pdf): Gli effetti pubblicati si indeboliscono: dal 2016 il drift è molto più debole. È la lezione sul decadimento dopo la pubblicazione.
- [How Much Do Investors Care About Macroeconomic Risk? (Savor e Wilson, bozza Wharton)](https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Draft20111128p_edited.pdf): Premio nei giorni di annuncio (11,4 contro 1,1 punti base): l'incertezza in calendario viene pagata come rischio.
- [Stock Returns over the FOMC Cycle (Cieslak, Morse e Vissing-Jorgensen, versione di lavoro)](https://stern.nyu.edu/sites/default/files/assets/documents/cycle_paper_cieslak_morse_vissing-jorgensen.pdf): Il premio si concentra nelle settimane pari del ciclo FOMC; esempio di effetto di calendario con una spiegazione economica.
- [Micro Effects of Macro Announcements: Real-Time Price Discovery in Foreign Exchange (Andersen, Bollerslev, Diebold e Vega, NBER w8959)](https://www.nber.org/papers/w8959): Nel cambio i prezzi saltano subito sulla sorpresa, la volatilità si adegua lentamente, le notizie negative pesano di più. È la base per qualsiasi regola sulle notizie nel forex.
- [The Bitcoin–Macro Disconnect (Benigno e Rosa, NY Fed SR 1052) e il post su Liberty Street Economics](https://libertystreeteconomics.newyorkfed.org/2023/02/is-there-a-bitcoin-macro-disconnect/): Studio di evento intraday su BTC: nessuna reazione significativa alle notizie macro tranne il CPI.
- [The impact of macroeconomic news on Bitcoin returns (Corbet e colleghi, preprint Southampton)](https://eprints.soton.ac.uk/439058/1/The_impact_of_macroeconomic_news_on_Bitcoin_returns_2_.pdf): BTC reagisce a occupazione e beni durevoli in senso opposto alle azioni; CPI e PIL non significativi in quel periodo.
- [Regulating cryptocurrencies: assessing market reactions (Auer e Claessens, BIS Quarterly Review 2018)](https://www.bis.org/publ/qtrpdf/r_qt1809f.htm): Come classificare le notizie di regolamentazione: lo status legale conta, gli avvertimenti no.
- [Stablecoins and safe asset prices (Ahmed e Aldasoro, BIS Working Paper 1270)](https://www.bis.org/publ/work1270.htm): Le stablecoin sono legate al mercato dei T-bill; i deflussi pesano 2-3 volte più degli afflussi. Collega le cripto ai tassi a breve.
- [Crypto Prices Move More in Sync With Stocks, Posing New Risks (Blog del FMI, 2022)](https://www.imf.org/en/blogs/articles/2022/01/11/crypto-prices-move-more-in-sync-with-stocks-posing-new-risks): La correlazione BTC-S&P 500 è salita da 0,01 a 0,36: nelle crisi le cripto si comportano come asset rischiosi, non come rifugio.
- [Macroeconomic Announcements Fuel Volatility: An In-Depth Analysis (Volmex Labs)](https://volmex.finance/Macroeconomic Announcements Fuel Volatility An In-Depth Analysis.pdf): Effetto di CPI e Fed sulla volatilità realizzata e implicita di BTC su candele di 1 ora; la volatilità implicita cala dopo l'evento.
- [How FX and equities trade economic data sets (CME Group, 2025)](https://www.cmegroup.com/insights/economic-research/2025/how-fx-equities-trade-economic-data-sets.html): Quali dati muovono di più le valute (NFP, poi vendite al dettaglio, poi CPI) e quanto si concentrano i volumi nel primo minuto.
- [Is Bitcoin showing greater sensitivity to US CPI releases again (Block Scholes, 2026)](https://www.blockscholes.com/institutional-research/is-bitcoin-showing-greater-sensitivity-to-us-cpi-releases-again): Una regressione mobile su 12 pubblicazioni per misurare in tempo reale a quale dato macro il mercato sta guardando.
- [Is Bitcoin Really Untethered? (Griffin e Shams, scheda e abstract su SSRN)](https://papers.ssrn.com/abstract=3195066): Come si riconosce e si documenta una manipolazione con i dati on-chain; perché non confondere l'emissione di stablecoin con una domanda vera.

### Lezioni per gli agenti

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

## 7. Gestione del rischio, dimensione delle posizioni e psicologia (con protocollo anti-autoinganno per la scuola di agenti)

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

### Verifica dello stop-loss secondo Kaminski-Lo (stop solo dove c'è persistenza)

Priorità 3. Mercati: I 36 perpetual, su timeframe a 4 ore e giornaliero.. Provabile con i nostri dati: sì (Candele a 4 ore e simulazione del sistema attuale con parametri di stop diversi.).

Uno stop-loss toglie capitale da un attivo. Se i rendimenti sono una passeggiata casuale, questo riduce il rendimento atteso senza benefici. Lo stop aggiunge valore solo se dopo una perdita le perdite tendono a continuare (momentum o regimi). Va quindi provato con i dati quale stop serve davvero e su quali coin.

**Regole.** 1) Su ciascun coin misura l'autocorrelazione dei rendimenti a 4 ore e giornalieri per i ritardi 1-6, e il rendimento medio nei 5 giorni successivi a una perdita del 10% in 5 giorni.
2) Confronta il sistema attuale con stop a 2, 3, 4 e 5 ATR e senza stop, con uscita solo a tempo (per esempio 20 barre) o a trailing.
3) Misura sotto stop: rendimento medio nei periodi 'fermati' contro quello che sarebbe stato tenendo la posizione. Lo stop è utile se mediamente si evita una perdita, al netto dei costi.
4) Usa lo stop solo sui gruppi di coin o nei regimi (per esempio BTC sotto la media a 50 giorni) in cui il punto 3 è positivo fuori campione.

Registra tutte le varianti per il DSR.

**Prove.**

- [Kaminski e Lo, When do stop-loss rules stop losses?, Journal of Financial Markets 18, 2014](https://dspace.mit.edu/bitstream/handle/1721.1/114876/Lo_When%20Do%20Stop-Loss.pdf) (accademica): Con rendimenti a passeggiata casuale, le regole di stop 0/1 riducono il rendimento atteso. Con momentum o regimi possono aggiungere valore. Sulle azioni USA 1950-2004, con i titoli di stato come rifugio, certe regole hanno aggiunto circa 50-100 punti base al mese nei periodi di stop, grazie alla 'fuga verso la qualità'. Letto tramite estratti.

**Fuori campione.** Sulle azioni il risultato dipende dalla presenza di momentum condizionato dopo le perdite. Sulle cripto non ho prove lette in questa sessione. Nota: nei perpetual non esiste un rifugio con rendimento come i titoli di stato, quindi il beneficio può essere minore.

**Come fallisce.** - Stop troppo stretti, falciati dal rumore e dallo slittamento dello 0,1%.
- Salti oltre lo stop.
- Scegliere la distanza in ATR migliore su 3 anni porta a overfitting.
- Nei rimbalzi a V lo stop vende sul minimo.

### Riduzione del rischio guidata dal calo del capitale (drawdown control)

Priorità 3. Mercati: Portafoglio del sistema attuale sui 36 perpetual.. Provabile con i nostri dati: sì (Curva del capitale del backtest del sistema attuale.).

Ridurre la dimensione quando il capitale è in calo limita la profondità del calo massimo. Se le prestazioni della strategia sono persistenti (i periodi brutti seguono periodi brutti), riduce anche le perdite. Se non lo sono, rallenta solo la ripresa. È la versione 'per strategia' del principio di Kaminski-Lo.

**Regole.** - DD = calo attuale dal massimo del capitale; soglia massima tollerata D = 20%.
- Rischio per operazione = 1% × max(0,25, 1 − DD/D). Per esempio: con calo del 10% il rischio è 0,5%; dal 15% in su è 0,25%.
- Ripristino graduale quando il capitale recupera.

Prima di adottarla:
- verifica se i rendimenti a 20 operazioni del sistema hanno autocorrelazione positiva;
- se non ce l'hanno, la regola probabilmente costa rendimento senza vantaggi;
- confronta con rischio fisso su calo massimo, tempo di recupero e rendimento finale.

**Prove.**

- [Kaminski e Lo, When do stop-loss rules stop losses?, 2014 (stesso principio applicato alla curva del capitale)](https://dspace.mit.edu/handle/1721.1/114876) (accademica): Uscire dopo le perdite conviene solo se c'è persistenza dei rendimenti. Senza persistenza riduce il rendimento atteso. Le prove specifiche sul controllo del calo (Grossman e Zhou) NON sono state lette in questa sessione.
- [MacLean, Thorp, Ziemba 2010](https://www.stat.berkeley.edu/~aldous/157/Papers/Good_Bad_Kelly.pdf) (accademica): La frazione di Kelly scambia crescita con sicurezza contro i cali. La riduzione dinamica della frazione è una variante di questo compromesso. Letto tramite estratti.

**Fuori campione.** Non verificato in questa sessione, né sulle cripto né altrove.

**Come fallisce.** - Riduce il rischio proprio prima della ripresa, rallentando l'uscita dal calo.
- Se la strategia ha davvero smesso di funzionare, rallenta l'emorragia ma non la ferma: serve anche la regola di sospensione con Kelly ≤ 0.

### Frazione di Kelly ricavata dai risultati fuori campione del sistema

Priorità 4. Mercati: I 36 perpetual, applicato a qualunque strategia con almeno 100 operazioni di storico.. Provabile con i nostri dati: sì (Lista delle operazioni del backtest del sistema attuale (in R), calcolata sui dati a 4 ore esistenti.).

Kelly massimizza la crescita a lungo termine, ma richiede di conoscere il vantaggio, e il vantaggio stimato è quasi sempre gonfiato. Puntare troppo fa più danni che puntare poco. Usare una frazione (da 1/4 a 1/2) del Kelly stimato solo su operazioni fuori campione dà una dimensione legata al vantaggio reale. Quando il vantaggio misurato scende a zero, la strategia si spegne da sola.

**Regole.** Per ogni strategia, sulle ultime M ≥ 100 operazioni chiuse fuori campione:
- p = percentuale di operazioni vincenti;
- b = vincita media in R / perdita media in R;
- Kelly binario f* = p − (1−p)/b, espresso come frazione del capitale messa a rischio fino allo stop.

Dimensione:
- rischio per operazione = clip(0,25 × f*, 0, 2%);
- se f* ≤ 0: rischio 0, cioè strategia sospesa, e si riattiva quando il valore di 100 operazioni simulate torna positivo;
- per prudenza, usa il limite inferiore dell'intervallo di confidenza di p (per esempio Wilson al 90%) invece di p.

Variante continua, per portafogli: f = (μ − r)/σ² sui rendimenti giornalieri della strategia, poi 1/4 di quel valore.

Confronto sui 36 coin: rischio fisso 1% contro frazione di Kelly, misurando crescita, calo massimo e tempo sott'acqua.

**Prove.**

- [Thorp, The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market (2006)](https://gwern.net/doc/statistics/decision/2006-thorp.pdf) (accademica): Kelly massimizza la crescita attesa del logaritmo del capitale. Thorp motiva la frazione di Kelly con la tendenza a sovrastimare la propria probabilità di vincita, e mostra che puntare troppo fa più danni che puntare poco. Da fonti secondarie collegate: a Kelly pieno la probabilità di scendere a una frazione x del capitale è circa x; mezzo Kelly dà circa il 75% della crescita massima. Letto tramite estratti: i numeri vanno verificati sulle pagine 28-29 dell'originale.
- [MacLean, Thorp, Ziemba, Long-term capital growth: the good and bad properties of the Kelly and fractional Kelly capital growth criteria, Quantitative Finance 10(7), 2010](https://www.stat.berkeley.edu/~aldous/157/Papers/Good_Bad_Kelly.pdf) (accademica): Riassunto delle proprietà buone e cattive. Kelly massimizza la crescita a lungo termine ma è molto volatile; la frazione di Kelly scambia crescita con sicurezza, e il punto giusto dipende dall'avversione al rischio. Letto tramite estratti.

**Fuori campione.** La matematica di Kelly non decade. Il rischio è nella stima del vantaggio: le stime in campione lo sovrastimano, e per questo vanno usate solo operazioni fuori campione e una frazione. Sulle cripto non ho prove lette in questa sessione: va provato sui nostri dati.

**Come fallisce.** - Vantaggio che cambia di regime (le ultime 100 operazioni non rappresentano le prossime).
- Code grasse e salti oltre lo stop (la perdita reale supera 1R).
- Posizioni correlate trattate come indipendenti, che portano a un Kelly effettivo molto più alto.
- Campioni piccoli.

### Tetto al rischio totale aperto che tiene conto della correlazione con BTC

Priorità 4. Mercati: I 36 perpetual, nel portafoglio del sistema attuale.. Provabile con i nostri dati: sì (Candele a 4 ore (aggregate in giornaliere) per le correlazioni; lista delle posizioni aperte dal backtest.).

Il sistema attuale rischia l'1% per operazione su 36 coin, e lato e direzione sono decisi da BTC. In un crollo le altcoin si muovono quasi insieme a BTC. Dieci posizioni da 1% diventano quindi circa una sola scommessa da 10% su BTC, peggiorata da slittamento e salti oltre lo stop. Limitare il rischio aggregato misurato in 'scommesse equivalenti' riduce il calo massimo senza toccare il segnale.

**Regole.** Ogni giorno:
- correlazione dei rendimenti giornalieri a 60 giorni tra le posizioni aperte;
- rischio effettivo = sqrt(wᵀ C w), dove w è il vettore dei rischi in % per posizione (1% ciascuno) e C la matrice di correlazione.

Regole:
- nuova entrata consentita solo se il rischio effettivo dopo l'entrata è ≤ 3% (da provare 2%, 3%, 4%, 5% e registrare TUTTE le prove per il DSR);
- in alternativa più semplice: massimo K = 4 posizioni nello stesso verso, oppure rischio totale nominale ≤ 5%;
- se il tetto è pieno, entra solo se il nuovo segnale ha un volume relativo maggiore della posizione più debole, che allora viene chiusa.

Misura: calo massimo, peggior giorno e peggior settimana prima e dopo.

**Prove.**

- [Harvey et al., The Impact of Volatility Targeting, JPM 2018 (Man Group)](https://www.man.com/insights/the-impact-of-volatility-targeting) (gestore o exchange): Prova solo indiretta: controllare il rischio a livello di portafoglio riduce le code sinistre. NON ho letto in questa sessione una fonte che dimostri specificamente il tetto al rischio correlato nelle cripto. La regola nasce dalla logica (posizioni correlate equivalgono a una sola scommessa) e dalla pratica dei gestori, e va dimostrata con il nostro backtest.

**Fuori campione.** Non dimostrato da fonti lette in questa sessione. È un controllo strutturale, non un segnale: non dovrebbe decadere con la pubblicazione. Va però verificato che non tagli proprio le operazioni migliori nei trend forti, dove tutto sale insieme.

**Come fallisce.** - Nei trend forti molti segnali vengono scartati, con meno rendimento rispetto al sistema base.
- Le correlazioni misurate in calma sottostimano quelle durante i crolli, quando vanno quasi a 1 (usare una correlazione minima di 0,7 in stress).
- Ottimizzare il valore del tetto sullo stesso campione è un rischio di overfitting.

### Rischio per operazione scalato sulla volatilità (volatility targeting applicato al sistema attuale)

Priorità 5. Mercati: Tutti i 36 perpetual USDT di Binance, su timeframe giornaliero e a 4 ore.. Provabile con i nostri dati: sì (Candele a 4 ore già disponibili, aggregate in giornaliere. Nient'altro.).

Le fasi di alta volatilità non pagano proporzionalmente di più. Ridurre l'esposizione quando la volatilità recente è alta e aumentarla quando è bassa rende la volatilità del portafoglio più stabile e riduce le perdite estreme. Le perdite peggiori tendono infatti ad arrivare quando la volatilità è già alta, cioè proprio quando un portafoglio a volatilità obiettivo ha un'esposizione piccola. È un meccanismo di struttura del rischio, non un segnale di previsione.

**Regole.** Timeframe di calcolo: giornaliero, costruito dalle 4 ore.

Variante A (per operazione):
- volatilità realizzata del singolo coin = deviazione standard dei rendimenti giornalieri degli ultimi 20 giorni, annualizzata con radice di 365;
- volatilità di riferimento = mediana della stessa misura su tutto lo storico disponibile fino a quel giorno, senza look-ahead;
- rischio per operazione = 1% × clip(vol_rif / vol_coin, 0,5, 1,5);
- lo stop resta a 3 ATR; la quantità = rischio in dollari / (3 ATR).

Variante B (a livello di portafoglio, ricalcolo giornaliero):
- volatilità obiettivo del portafoglio = per esempio 20% annuo;
- stima la volatilità del portafoglio aperto con le covarianze dei rendimenti giornalieri degli ultimi 60 giorni;
- scala tutte le dimensioni di un fattore k = min(1,5, 20% / vol_stimata), aggiornato una volta al giorno.

Uscite: identiche al sistema attuale (3R, trailing).

Confronto da fare, con commissione 0,055% per lato e slittamento 0,1%:
- sistema base contro A e contro B;
- metriche: rendimento, calo massimo, Sharpe, perdita media nel 5% peggiore dei giorni, MAR (rendimento annuo / calo massimo);
- separatamente per gli anni 2023-24, 2025 e 2026.

**Prove.**

- [Moreira e Muir, Volatility-Managed Portfolios, Journal of Finance 72(4), 2017](https://amoreira2.github.io/alan-moreira.github.io/VolPortfolios_published.pdf) (accademica): Scalando i rendimenti mensili per l'inverso della varianza realizzata del mese precedente si ottengono questi risultati. Sul mercato azionario: alpha del 4,9% e Sharpe circa +25%. Sui fattori (value, momentum, profittabilità, BAB, carry valutario): Sharpe da +50% a +100%. Motivo dichiarato: i cambi di volatilità non sono compensati da cambi proporzionali del rendimento atteso. Letto tramite estratti di ricerca.
- [Harvey, Hoyle, Korgaonkar, Rattray, Sargaison, Van Hemert, The Impact of Volatility Targeting, Journal of Portfolio Management 45(1), 2018 (Man Group)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf) (gestore o exchange): Test su più di 60 attivi con dati giornalieri dal 1926. Il volatility targeting riduce la probabilità di rendimenti estremi e la volatilità della volatilità in tutte le classi. Migliora lo Sharpe di azioni, credito e portafogli bilanciati o risk parity. Su obbligazioni, valute e materie prime l'effetto sullo Sharpe è trascurabile. Letto tramite estratti di ricerca e la pagina Man Group.
- [Cederburg, O'Doherty, Wang, Yan, On the performance of volatility-managed portfolios, Journal of Financial Economics 138, 2020](https://www.lehigh.edu/~xuy219/research/COWY.pdf) (accademica): Su 103 strategie azionarie, le versioni fuori campione e in tempo reale tipicamente NON battono le versioni non scalate. La versione gestita vince in 53 casi su 103 e solo 8 hanno uno Sharpe stabilmente più alto. Causa indicata: l'instabilità delle regressioni. Il beneficio resta su momentum, profittabilità e BAB. Letto tramite estratti di ricerca.

**Fuori campione.** Misto:
- Fuori campione sulle azioni (Cederburg et al. 2020) il guadagno di Sharpe in gran parte sparisce.
- La riduzione delle code sinistre (Harvey et al. 2018) è il risultato più robusto su più di 60 attivi e quasi un secolo di dati.
- Sulle criptovalute non ho letto prove specifiche in questa sessione. Nei risultati c'era una pagina Man Group, 'Crypto. Too Hot to Handle?', ma non l'ho letta.

Il nostro test sui 3 anni sarà quindi esso stesso la prova fuori campione per le cripto. Aspettativa onesta: calo massimo e code minori; rendimento non necessariamente maggiore.

**Come fallisce.** - Salti improvvisi dopo periodi calmi (la volatilità bassa porta a esposizione alta proprio prima del crollo).
- Rotazione eccessiva, con costi che mangiano il beneficio se si ricalcola troppo spesso.
- Finestre di stima troppo corte.
- Leva implicita alta sui coin che sembrano calmi ma sono illiquidi.

### Protocollo anti-autoinganno: Deflated Sharpe Ratio, PBO con CSCV e soglia t > 3 per ogni idea della scuola

Priorità 5. Mercati: Qualunque strategia della scuola: si applica al processo di ricerca, non a un mercato.. Provabile con i nostri dati: sì (Le serie di rendimento giornaliere di tutte le varianti provate (generate dai backtest sui dati esistenti) e il registro delle prove.).

Se si provano N varianti, la migliore avrà uno Sharpe alto anche se nessuna ha un vantaggio reale: lo Sharpe massimo atteso cresce con N. Correggere per il numero di prove, l'asimmetria, le code grasse e la lunghezza del campione distingue le scoperte vere dai colpi di fortuna. Per una scuola di agenti che genera centinaia di idee è la regola più importante di tutte.

**Regole.** Ogni agente registra in un registro condiviso OGNI variante provata, non solo la migliore. Per promuovere una strategia servono tutte queste condizioni.

1) Deflated Sharpe Ratio ≥ 0,95.
- SR* = sqrt(Var[SR tra le prove]) × ((1−γ)·Φ⁻¹(1−1/N) + γ·Φ⁻¹(1−1/(N·e))), con γ ≈ 0,5772 e N = numero di prove registrate.
- DSR = Φ((SR − SR*)·sqrt(T−1) / sqrt(1 − asimmetria·SR + ((curtosi−1)/4)·SR²)).
- SR e T vanno misurati sulla stessa frequenza (per esempio giornaliera).

2) PBO < 0,2 con CSCV.
- Dividi la matrice dei rendimenti delle N varianti in S = 16 blocchi temporali.
- Per ogni combinazione di metà blocchi in campione e metà fuori, prendi la variante migliore in campione e guarda il suo rango fuori campione.
- PBO = frazione delle combinazioni in cui finisce sotto la mediana.

3) Statistica t del rendimento medio per operazione > 3.

4) Le regole si congelano prima dell'ultimo blocco di dati: per esempio gli ultimi 6 mesi del 2026 si toccano una volta sola.

5) La strategia deve battere il sistema attuale e BTC comprato e tenuto al netto dei costi (0,055% + 0,1%).

**Prove.**

- [Bailey e López de Prado, The Deflated Sharpe Ratio, Journal of Portfolio Management 40(5), 2014](https://papers.ssrn.com/abstract=2460551) (accademica): Il DSR corregge lo Sharpe per selezione tra più prove, overfitting del backtest, lunghezza del campione e non-normalità. Lo Sharpe massimo tra molte prove ha una distribuzione diversa da quella di una prova scelta a caso, e da qui nasce il bias di selezione. Letto tramite estratti di ricerca. La formula riportata nelle regole è quella standard del paper: va verificata sul testo.
- [Bailey, Borwein, López de Prado, Zhu, The Probability of Backtest Overfitting, Journal of Computational Finance, 2017](https://escholarship.org/content/qt4w1110bb/qt4w1110bb.pdf) (accademica): Le tecniche classiche come la tenuta fuori di un solo campione (hold-out) sono inaffidabili per i backtest di investimento. La CSCV è un metodo non parametrico, indipendente dal modello, che stima la PBO con errori piccoli. Letto tramite estratti di ricerca.
- [Harvey, Liu, Zhu, ...and the Cross-Section of Expected Returns, Review of Financial Studies 29(1), 2016](https://nber.org/papers/w20592) (accademica): Visto l'esteso data mining, un nuovo fattore deve superare t > 3,0 invece di 2,0. La conclusione è che la maggior parte delle scoperte dichiarate in economia finanziaria è probabilmente falsa. Letto tramite estratti di ricerca.

**Fuori campione.** È un metodo statistico, non una strategia: non decade dopo la pubblicazione. La soglia t > 3 nasce proprio dall'osservazione che molti fattori pubblicati non reggono. Sulle cripto vale a maggior ragione: il campione è di soli 3 anni, i coin sono molto correlati tra loro e le varianti provate sono molte.

**Come fallisce.** - Non registrare le prove fallite (allora N è sottostimato e il DSR è troppo ottimista).
- Riusare più volte lo stesso campione finale.
- Varianti quasi identiche contate come indipendenti, o viceversa.
- 3 anni di dati con un solo grande regime rialzista possono non bastare comunque.

### Miti

- **Puntare tanto, a Kelly pieno o di più, fa crescere il conto più in fretta.** Oltre Kelly la crescita a lungo termine diminuisce e il rischio di rovina sale. Già a Kelly pieno c'è circa il 50% di probabilità di dimezzare il capitale prima o poi. Poiché il vantaggio si sovrastima, il Kelly 'pieno' stimato è in realtà spesso oltre Kelly.
- **Lo stop-loss protegge sempre e migliora sempre i risultati.** Se i rendimenti sono una passeggiata casuale, lo stop riduce il rendimento atteso: si esce da un attivo che in media rende di più. Aiuta solo con persistenza (momentum o regimi), che va dimostrata sui dati.
- **Un backtest con Sharpe alto dimostra che la strategia funziona.** Su molte varianti provate, la migliore ha uno Sharpe alto per puro caso. Va corretto per il numero di prove (DSR), stimata la probabilità di overfitting (PBO) e richiesto t > 3. Il semplice hold-out non basta.
- **Il volatility targeting aumenta sempre il rendimento e lo Sharpe.** Riduce stabilmente le code sinistre, ma lo Sharpe migliora soprattutto sugli attivi rischiosi. Fuori campione e in tempo reale su 103 strategie azionarie il guadagno è spesso nullo: solo 8 avevano uno Sharpe stabilmente più alto.
- **Rischiando l'1% per operazione non posso perdere più di qualche punto in un giorno.** Con molte posizioni nello stesso verso su altcoin molto correlate a BTC, 10 posizioni da 1% equivalgono a una scommessa di quasi 10%. In più, salti e slittamento portano la perdita oltre 1R. Il rischio va misurato sul portafoglio, non per singola operazione.
- **Una strategia pubblicata o famosa continua a rendere come nei test originali.** I fattori pubblicati sono selezionati da un enorme data mining e molti non reggono (da qui la soglia t > 3). Il caso del volatility management mostra un risultato brillante in campione che si sgonfia in tempo reale. Nota: l'articolo di McLean e Pontiff sul calo dei rendimenti dopo la pubblicazione NON l'ho letto in questa sessione, quindi non ne cito i numeri.
- **Social (TikTok, X, Telegram): 'rischia il 10-20% a operazione per far crescere un conto piccolo', 'strategia vincente al 90%'.** Una percentuale di vincite alta non dice nulla senza il rapporto vincita/perdita e i costi. Rischi del 10-20% sono molte volte oltre qualunque frazione di Kelly ragionevole, e portano alla rovina con alta probabilità anche con un vantaggio reale. Non ho letto contenuti social in questa sessione: la frase descrive un tipo di promessa da trattare come segnale di euforia, non come prova.

### Da leggere

- [The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market (Edward O. Thorp, 2006)](https://gwern.net/doc/statistics/decision/2006-thorp.pdf): Matematica di Kelly per scommesse e azioni (f = (μ−r)/σ²). Perché la frazione di Kelly: il vantaggio si sovrastima e puntare troppo fa più danni che puntare poco. Nota: è una copia ospitata da gwern.net di un paper che circola liberamente, non il sito dell'editore; se serve certezza sulla licenza, usare la versione del volume World Scientific.
- [Good and bad properties of the Kelly criterion (MacLean, Thorp, Ziemba)](https://www.stat.berkeley.edu/~aldous/157/Papers/Good_Bad_Kelly.pdf): Elenco ragionato di pregi (crescita massima, nessuna rovina in teoria) e difetti (volatilità enorme, cali profondi, lentezza) di Kelly e della frazione di Kelly. La scelta della frazione dipende dall'avversione al rischio.
- [Volatility-Managed Portfolios (Moreira e Muir, versione pubblicata dal sito dell'autore)](https://amoreira2.github.io/alan-moreira.github.io/VolPortfolios_published.pdf): Scalare per l'inverso della varianza recente aumenta lo Sharpe di molti fattori in campione, perché il rendimento atteso non sale in proporzione alla volatilità.
- [On the performance of volatility-managed portfolios (Cederburg, O'Doherty, Wang, Yan)](https://www.lehigh.edu/~xuy219/research/COWY.pdf): La replica fuori campione: su 103 strategie il beneficio in tempo reale è debole. È la lezione su come un risultato famoso si sgonfia.
- [The Impact of Volatility Targeting (Harvey et al., Man Group)](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf): Più di 60 attivi dal 1926: il volatility targeting taglia le code sinistre ovunque e migliora lo Sharpe sugli attivi rischiosi. Riassunto divulgativo: https://www.man.com/insights/the-impact-of-volatility-targeting
- [When Do Stop-Loss Rules Stop Losses? (Kaminski e Lo)](https://dspace.mit.edu/bitstream/handle/1721.1/114876/Lo_When%20Do%20Stop-Loss.pdf): Cornice formale per valutare uno stop: aiuta solo se c'è persistenza dei rendimenti; con la passeggiata casuale toglie rendimento.
- [The Deflated Sharpe Ratio (Bailey e López de Prado)](https://papers.ssrn.com/abstract=2460551): Come correggere lo Sharpe per numero di prove, non-normalità e lunghezza del campione. Lettura obbligatoria per chiunque confronti molte varianti.
- [The Probability of Backtest Overfitting (Bailey, Borwein, López de Prado, Zhu)](https://escholarship.org/content/qt4w1110bb/qt4w1110bb.pdf): Metodo CSCV per stimare la probabilità che la variante migliore in campione sia sotto la mediana fuori campione. Il semplice hold-out non basta.
- [...and the Cross-Section of Expected Returns (Harvey, Liu, Zhu)](https://nber.org/papers/w20592): Con centinaia di fattori provati, la soglia di significatività deve salire a t > 3; la maggior parte delle scoperte pubblicate è probabilmente falsa.

### Lezioni per gli agenti

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

## 8. Stagionalità, microstruttura e dati on-chain delle criptovalute

ATTENZIONE: in questa sessione non ho potuto leggere nessuna fonte, quindi questo rapporto NON rispetta la soglia di 10 fonti lette. Ci sono stati due blocchi. (1) Il budget di ricerca web del turno era già finito: è condiviso fra tutti gli agenti dello sciame (200 ricerche) e ogni WebSearch ha risposto 'budget esaurito'. (2) WebFetch non arriva ai siti: arxiv.org, quantpedia.com e www.nber.org hanno dato 'host non risolto', perché sono fuori dai domini permessi della sessione. Come indicato dall'errore, mi sono fermato dopo tre siti. Nel progetto non ci sono fonti né dati di prezzo salvati: /home/user/Argo/trading-desk/data contiene solo il database del paper trading, e /home/user/Argo/fx-school contiene solo il programma della scuola forex. Per non inventare niente: tutte le tecniche qui sotto sono IPOTESI DA PROVARE, scritte in modo che si possano programmare, e nessuna ha prove allegate (evidence vuota). Le priorità dipendono solo da due cose: se si possono provare con i nostri dati e quanto costa provarle. Non dicono nulla su quanto le tecniche siano provate. Due cose si possono già dire con un semplice conto, senza bisogno di fonti. Prima: con commissione 0,055% per lato e slittamento 0,1%, un'operazione andata e ritorno costa circa 0,3% o più; una stagionalità oraria o settimanale deve battere questa soglia per ogni operazione, quindi conviene usarla come filtro del sistema attuale e non come motore a sé. Seconda: i nostri dati (novembre 2023 - ottobre 2026) contengono un solo halving (aprile 2024) e nessun dato on-chain, quindi i cicli dell'halving e indicatori come MVRV o flussi verso gli exchange non si possono provare con quello che abbiamo. Per rifare questo lavoro bene servono: (a) un nuovo turno con budget di ricerca, oppure un aumento di CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION; (b) permettere nelle impostazioni di rete della sessione almeno arxiv.org, www.nber.org, quantpedia.com, papers.ssrn.com e i siti di ricerca di Glassnode, Kaiko, CME e Binance Research.

### Valutazione on-chain (MVRV, flussi verso gli exchange, riserve)

Priorità 1. Mercati: BTC ed ETH (dove i dati on-chain sono più completi). Provabile con i nostri dati: no (Serie giornaliere MVRV, flussi netti e riserve sugli exchange di un fornitore (per esempio Glassnode, CryptoQuant): NON le abbiamo).

Ipotesi, non verificata in questa sessione: MVRV confronta il valore di mercato con il prezzo medio a cui le monete sono state spostate l'ultima volta (realized value). Valori molto alti vorrebbero dire che molti detentori sono in forte guadagno e sono tentati di vendere. Grandi afflussi verso gli exchange vorrebbero dire che qualcuno si prepara a vendere. È un racconto diffuso, ma qui non ho prove lette sulla sua forza fuori campione.

**Regole.** Non si può programmare con i nostri dati. Se in futuro si acquistassero i dati: usare MVRV di BTC su scala giornaliera solo come regolatore della dimensione, per esempio rischio dimezzato per i long quando MVRV è nel 10% più alto della sua storia, con soglie decise solo su dati passati e senza guardare avanti.

**Fuori campione.** Non verificato: nessuna fonte letta. Con pochi cicli di mercato completi nella storia di BTC, ogni soglia rischia di essere adattata a posteriori.

**Come fallisce.** Pochissimi cicli. I fornitori ricalcolano le serie a posteriori (rischio di usare informazioni del futuro). Gli ETF e i custodi raggruppano molte monete in pochi indirizzi e cambiano il significato dei flussi.

### Ciclo dell'halving

Priorità 1. Mercati: BTC. Provabile con i nostri dati: no (Storia di BTC dal 2010 (non l'abbiamo nel nostro dataset)).

Racconto molto diffuso, non verificato in questa sessione: il dimezzamento della ricompensa ai miner riduce le nuove monete emesse e dovrebbe portare a un rialzo nei 12-18 mesi successivi. Il problema di fondo è che ci sono solo 4 halving nella storia (2012, 2016, 2020, 2024): troppo pochi per qualsiasi conclusione statistica.

**Regole.** Non si può provare con i nostri dati: c'è un solo halving (aprile 2024) nel campione nov 2023 - ott 2026. Al massimo si può fare una descrizione (il rendimento di BTC nei 6, 12 e 18 mesi dopo aprile 2024), ma non è un test.

**Fuori campione.** Non verificabile: un solo evento nei nostri dati; 4 eventi in tutta la storia.

**Come fallisce.** Campione minimo. L'halving è noto a tutti con anni di anticipo, quindi dovrebbe essere già nei prezzi. Altri fattori (tassi, liquidità globale, ETF) si sovrappongono negli stessi periodi.

### Fine e inizio mese (turn of the month)

Priorità 2. Mercati: BTC ed ETH (dove arrivano i flussi istituzionali); poi tutte le 36 per controllo. Provabile con i nostri dati: sì (Candele a 4 ore e giornaliere (le abbiamo)).

Ipotesi presa in prestito dalle azioni e non verificata in questa sessione sulle cripto: a fine mese entrano flussi di denaro regolari (stipendi, piani di accumulo, ribilanciamenti dei fondi e degli ETF) che spingono i prezzi tra l'ultimo giorno del mese e i primi giorni del mese dopo.

**Regole.** Segnale: calendario. Entrata: long BTC alla chiusura della candela delle 20:00 UTC del penultimo giorno del mese. Uscita: chiusura del 3° giorno del mese dopo. Dimensione: rischio 1% con stop a 3 ATR giornalieri. Confronto: tenere BTC negli stessi giorni contro gli altri giorni, e il rendimento per operazione contro i costi (circa 0,31% andata e ritorno). Variante: usarlo solo come filtro, cioè permettere i long del sistema attuale anche quando BTC è debole, ma solo in quella finestra.

**Fuori campione.** Non verificato: nessuna fonte letta. Ci sono solo circa 36 fine mese nel nostro campione, quindi il potere statistico è molto basso.

**Come fallisce.** Il campione è piccolo. L'effetto preso dalle azioni potrebbe non esistere sulle cripto, che sono aperte 24 ore su 24, 7 giorni su 7. Anche un risultato positivo potrebbe dipendere da 2 o 3 mesi eccezionali.

### Finestra attorno al pagamento del funding (00, 08, 16 UTC)

Priorità 2. Mercati: Tutte e 36 le perpetual. Provabile con i nostri dati: sì (Funding a 8 ore con orario esatto e candele a 4 ore (le abbiamo)).

Ipotesi di microstruttura, non verificata in questa sessione: chi è dal lato che paga il funding può chiudere poco prima del pagamento e riaprire subito dopo. Questo creerebbe una piccola spinta del prezzo prima del pagamento, nel verso che riduce lo squilibrio (giù se il funding è positivo).

**Regole.** Le candele a 4 ore che finiscono alle 00, 08 e 16 UTC sono quelle prima del pagamento. Misurare il loro rendimento medio quando il funding precedente è > 0,03% contro quando è < 0, e confrontarlo con le candele che finiscono alle 04, 12 e 20 UTC. Se c'è un effetto stabile in entrambe le metà del campione, usarlo solo come filtro del momento di entrata (rimandare un'entrata long di una candela se la candela successiva precede un pagamento con funding alto). Nessuna operazione da sola, a causa dei costi.

**Fuori campione.** Non verificato: nessuna fonte letta.

**Come fallisce.** L'effetto, se esiste, è probabilmente più piccolo dello slittamento dello 0,1%. La granularità di 4 ore non permette di isolare i minuti vicini al pagamento. Alcune monete su Binance hanno avuto intervalli di funding diversi da 8 ore: va controllato nei dati.

### Scadenze dei derivati (opzioni e future trimestrali) come filtro di rischio

Priorità 2. Mercati: BTC ed ETH (le opzioni cripto sono concentrate su queste due). Provabile con i nostri dati: sì (Candele a 4 ore e calendario delle scadenze (calcolabile). L'open interest delle opzioni non lo abbiamo.).

Ipotesi, non verificata in questa sessione: alle scadenze mensili e trimestrali delle opzioni e dei future cripto (di solito l'ultimo venerdì del mese, alle 08:00 UTC, per le opzioni su Deribit) chi vende e chi compra opzioni copre le proprie posizioni. Questo potrebbe tenere il prezzo vicino ai livelli con molte opzioni aperte prima della scadenza, e liberare movimento dopo. La racconta molto la folla ('max pain'), ma qui non ho prove lette.

**Regole.** Definire la finestra di scadenza come l'ultimo venerdì del mese, dalle 00:00 alle 12:00 UTC, più le 48 ore dopo. Misurare l'ampiezza media delle candele a 4 ore e la percentuale di rotture riuscite del sistema dentro e fuori dalla finestra. Se le rotture falliscono di più nelle 48 ore prima della scadenza, bloccare le nuove entrate in quel periodo. Nessuna regola di direzione basata sul 'max pain', perché non abbiamo i dati sulle opzioni.

**Fuori campione.** Non verificato: nessuna fonte letta. Ci sono circa 36 scadenze mensili e 12 trimestrali nel campione, quindi poco potere statistico.

**Come fallisce.** Non abbiamo l'open interest delle opzioni né il 'max pain', quindi si prova solo l'effetto del calendario. La data esatta della scadenza dipende dalla piattaforma e va verificata. Il campione è piccolo.

### Filtro ora del giorno (fasce di 4 ore UTC)

Priorità 3. Mercati: Tutte e 36 le perpetual USDT; prima BTC ed ETH, che sono le più liquide. Provabile con i nostri dati: sì (Candele a 4 ore OHLCV (le abbiamo)).

Ipotesi, non verificata in questa sessione: in fasce orarie diverse sono attivi partecipanti diversi (Asia, Europa, Stati Uniti), con diversa liquidità e volatilità, e questo potrebbe dare rendimenti medi diversi per fascia. Se l'effetto esiste, il motivo sarebbe nella struttura del mercato (chi è sveglio e chi scambia), non in un premio per il rischio, quindi può sparire appena viene sfruttato.

**Regole.** Dati: candele a 4 ore di Binance in UTC (fasce 00, 04, 08, 12, 16, 20). Passo 1: nella prima metà del campione (nov 2023 - apr 2025) calcolare per ogni moneta e per ogni fascia il rendimento medio e la statistica t. Passo 2: tenere solo le fasce con |t| > 3, per correggere le tante prove (6 fasce x 36 monete = 216 test), e con lo stesso segno su almeno 2/3 delle monete. Passo 3: nella seconda metà (mag 2025 - ott 2026) usare quelle fasce solo come filtro del sistema attuale, cioè non aprire nuove entrate nelle fasce con rendimento medio contrario al lato deciso da BTC. Nessuna operazione da sola, perché il costo di andata e ritorno (circa 0,31%) supera quasi sicuramente il rendimento medio di una singola candela di 4 ore. Dimensione: quella del sistema attuale (rischio 1%). Confronto: rendimento, calo massimo e numero di operazioni del sistema con e senza filtro.

**Fuori campione.** Non verificato: nessuna fonte letta in questa sessione. Va misurato con il nostro test diviso in due metà, come descritto nelle regole.

**Come fallisce.** Con 216 test, qualche fascia esce 'significativa' per puro caso. La risoluzione di 4 ore è troppo grossa per vedere effetti di una singola ora. I mercati cambiano orari, per esempio con l'ora legale negli Stati Uniti e in Europa e con l'arrivo degli ETF. L'effetto può essere più piccolo dei costi.

### Filtro fine settimana / giorno della settimana

Priorità 3. Mercati: Tutte le 36 perpetual, con risultati separati per BTC, ETH e le altre. Provabile con i nostri dati: sì (Candele a 4 ore, da trasformare in giornaliere (le abbiamo)).

Ipotesi, non verificata in questa sessione: nel fine settimana le borse tradizionali e i desk istituzionali sono chiusi, quindi la liquidità è più bassa. Questo potrebbe dare rotture meno affidabili (falsi segnali) o movimenti diversi il lunedì.

**Regole.** Costruire candele giornaliere dalle 4 ore, con il giorno in UTC. Misurare, per giorno della settimana: rendimento medio, ampiezza media (massimo meno minimo diviso chiusura) e percentuale di rotture di volume del sistema attuale che arrivano a 3R. Prova A (filtro): nessuna nuova entrata da sabato 00:00 a domenica 24:00 UTC. Prova B: rischio dimezzato (0,5%) nel fine settimana. Uscite e trailing restano uguali. Dividere il campione in due metà come sopra, e adottare il filtro solo se migliora il rapporto rendimento/calo massimo in entrambe le metà.

**Fuori campione.** Non verificato: nessuna fonte letta. Da misurare con il nostro test diviso in due metà.

**Come fallisce.** Ci sono pochi fine settimana (circa 155 in 3 anni), quindi molto rumore. Le notizie del fine settimana (eventi politici, hack) producono salti rari ma grandi che falsano le medie. Filtrare il fine settimana può far perdere proprio i movimenti forti.

### Rapporto long/short dei top trader come segnale di posizionamento

Priorità 3. Mercati: Tutte e 36 le perpetual. Provabile con i nostri dati: sì (Rapporto long/short dei top trader e candele a 4 ore (le abbiamo)).

Ipotesi, non verificata in questa sessione: il rapporto long/short dei top trader di Binance misura il posizionamento. Non si sa a priori se vada seguito (i top trader sono informati) o se vada usato al contrario (quando è estremo, la posizione è affollata). Il test deve decidere quale delle due ipotesi regge.

**Regole.** Calcolare il percentile del rapporto long/short di ogni moneta sugli ultimi 60 giorni. Prova 'segui': permettere long del sistema solo se il percentile > 50 e short solo se < 50. Prova 'contro': bloccare i long se il percentile > 90 e gli short se < 10. Confrontare le due prove con il sistema di base sulle due metà del campione. Scegliere la versione solo sulla prima metà e controllarla sulla seconda.

**Fuori campione.** Non verificato: nessuna fonte letta.

**Come fallisce.** Provare due ipotesi opposte e tenere quella che vince sulla prima metà rende obbligatorio il controllo sulla seconda metà. Binance può cambiare la definizione di 'top trader'. Il dato può essere molto correlato al funding: misurare se aggiunge qualcosa di nuovo.

### Funding estremo come segnale di affollamento (contrarian o filtro)

Priorità 4. Mercati: Tutte e 36 le perpetual; attese più forti sulle monete piccole dove la leva è più affollata (ORDI, WLD, TIA, SEI, SUI ecc.). Provabile con i nostri dati: sì (Funding a 8 ore e candele a 4 ore (le abbiamo)).

Ipotesi di microstruttura, non verificata in questa sessione: un funding molto alto vuol dire che i long a leva pagano molto per restare aperti, quindi il posizionamento è affollato da un lato. Basta poco per far scattare liquidazioni a catena nel verso opposto. Il motivo sarebbe nel comportamento umano (eccesso di fiducia, leva) e nella struttura del mercato (liquidazioni forzate).

**Regole.** Segnale: funding a 8 ore. Calcolare il punteggio z del funding di ogni moneta sugli ultimi 90 giorni (270 osservazioni). Filtro (prova principale): non aprire long del sistema attuale se z > +2, e non aprire short se z < -2. Variante contrarian (prova secondaria): se z > +2.5 e il prezzo chiude la candela di 4 ore sotto il minimo delle 3 candele precedenti, aprire short; stop a 3 ATR(14) a 4 ore, obiettivo 2R, uscita forzata dopo 6 candele (24 ore). Il contrario per z < -2.5. Rischio 0,5% per operazione. Contare nel risultato anche il funding pagato o incassato mentre la posizione è aperta.

**Fuori campione.** Non verificato: nessuna fonte letta. Da misurare con il test diviso in due metà, separando i periodi di mercato in salita e in discesa.

**Come fallisce.** In una tendenza forte il funding resta alto per settimane e il segnale contrarian perde ripetutamente. I punteggi z dipendono dalla finestra scelta. Funding e prezzo possono cambiare struttura dopo eventi come la quotazione degli ETF o modifiche al tetto del funding di Binance.

### Open interest e prezzo: flush delle liquidazioni

Priorità 4. Mercati: Tutte e 36 le perpetual. Provabile con i nostri dati: sì (Open interest e candele a 4 ore (le abbiamo)).

Ipotesi di microstruttura, non verificata in questa sessione: se l'open interest crolla mentre il prezzo cade forte, molte posizioni a leva sono state chiuse per forza (liquidazioni). Le vendite forzate non portano informazioni sul valore, quindi il prezzo potrebbe tornare indietro in parte. Al contrario, un open interest che cresce con il prezzo conferma la tendenza (il sistema attuale già usa un filtro simile).

**Regole.** Segnale su candela a 4 ore: variazione dell'open interest in 4 ore inferiore a -8% e rendimento della candela inferiore a -2 ATR(14). Entrata: long all'apertura della candela successiva, solo se BTC non è in calo di oltre il 5% nelle ultime 24 ore (per evitare i crolli di tutto il mercato). Uscita: obiettivo al punto medio della candela del segnale, oppure dopo 3 candele (12 ore). Stop: 1,5 ATR sotto il minimo della candela del segnale. Rischio 0,5%. Specchio per gli short: open interest -8% con candela > +2 ATR (squeeze degli short). Le soglie -8% e 2 ATR vanno scelte solo sulla prima metà del campione.

**Fuori campione.** Non verificato: nessuna fonte letta. Da misurare con il test diviso in due metà.

**Come fallisce.** In un crollo vero (hack, fallimento di un exchange) le liquidazioni continuano a ondate e il rimbalzo non arriva. L'open interest a 4 ore può non cogliere le liquidazioni dentro la candela. I segnali sono pochi per moneta.

### Miti

- **Il ciclo dell'halving garantisce un rialzo di BTC 12-18 mesi dopo** Errore di ragionamento, non verificato con fonti in questa sessione: 4 eventi in tutta la storia non bastano per nessuna conclusione statistica. L'halving è noto con anni di anticipo, quindi in un mercato efficiente dovrebbe essere già nel prezzo. Nello stesso periodo agiscono altri fattori (tassi, ETF, liquidità).
- **Il 'gap' del future CME su BTC si richiude sempre** Errore di ragionamento, non verificato con fonti: senza un limite di tempo, quasi ogni livello di prezzo viene prima o poi rivisitato, quindi la frase non si può smentire e non serve per fare trading. Contano solo il tempo, la percentuale di chiusura entro N giorni e il costo dell'attesa, che chi la ripete di solito non dice.
- **Il prezzo va verso il 'max pain' delle opzioni alla scadenza** Non dimostrato in questa sessione. La spiegazione richiede che chi vende opzioni coperte possa e voglia spostare il prezzo, il che non è scontato. Inoltre senza dati sulle opzioni non possiamo né provarlo né usarlo. Va trattato come racconto finché non c'è una prova misurata.
- **Un indicatore on-chain (MVRV, flussi verso gli exchange) indica con precisione il massimo o il minimo del ciclo** Errore di metodo: le soglie sono quasi sempre scelte guardando i pochi cicli passati (adattamento a posteriori), e alcuni fornitori ricalcolano le serie dopo. Con 3 o 4 cicli completi qualunque soglia sembra perfetta a posteriori.
- **Basta trovare l'ora o il giorno migliore e operare solo lì per guadagnare** Errore di conto, verificabile con i nostri costi: un'operazione andata e ritorno costa circa 0,31% (0,055% x 2 di commissione più 0,1% di slittamento x 2). Un vantaggio stagionale medio per candela di 4 ore è in genere molto più piccolo. Inoltre provare decine di fasce e monete produce falsi vantaggi per caso.

### Da leggere

- [Fundamentals of Perpetual Futures (He, Manela, Ross, von Wachter)](https://arxiv.org/abs/2212.06888): NON LETTA in questa sessione: il sito arxiv.org non era raggiungibile dalla rete della sessione. Da leggere quando la rete lo permette, per capire come funziona il funding e quanto il prezzo delle perpetual si allontana dal prezzo spot. Non uso nessun suo risultato in questo rapporto.
- [Risks and Returns of Cryptocurrency (Liu, Tsyvinski) - NBER Working Paper 24877](https://www.nber.org/papers/w24877): NON LETTA in questa sessione: il sito www.nber.org non era raggiungibile. Non so se il PDF sia gratuito per tutti, quindi lo segno come non verificato. Da leggere per capire quali fattori (momentum, attenzione degli investitori, attività di rete) sono stati provati sui rendimenti cripto. Non uso nessun suo risultato in questo rapporto.

### Lezioni per gli agenti

1) Prima di tutto la soglia dei costi: con 0,055% per lato e 0,1% di slittamento, un'operazione andata e ritorno costa circa 0,31%. Ogni pattern di calendario o di microstruttura deve battere questa soglia per ogni operazione; se no, si usa solo come filtro del sistema attuale (bloccare o ridurre entrate), mai come motore a sé. 2) Correggere per le tante prove: 6 fasce orarie x 7 giorni x 36 monete fanno centinaia di test, e qualcuno uscirà 'significativo' per caso. Chiedere |t| > 3, coerenza su più monete e stesso segno in entrambe le metà del campione (nov 2023 - apr 2025 per scegliere, mag 2025 - ott 2026 per controllare). 3) Chiedersi sempre PERCHÉ dovrebbe funzionare: chi perde soldi dall'altra parte? Può essere un flusso forzato (liquidazioni, ribilanciamenti), un comportamento umano (leva eccessiva, affollamento) o un premio per un rischio. Se non c'è una risposta, è probabilmente rumore. 4) Distinguere ciò che si può provare con i nostri dati (fasce orarie, giorni, fine mese, funding, open interest, rapporto long/short) da ciò che non si può provare (MVRV, flussi on-chain, halving: un solo evento nel campione). Per i secondi dire chiaramente 'non verificabile', senza credere al racconto. 5) Confrontare sempre con due riferimenti: il sistema attuale (+108%, calo massimo 13,5%) e BTC comprato e tenuto (+124%). Un filtro vale se migliora il rapporto rendimento/calo massimo in entrambe le metà del campione, non se alza il rendimento solo in una. 6) Controllare i dati prima delle idee: orari in UTC, cambi di nome e di contratto (MATIC/POL, RNDR, FTM), intervalli di funding diversi da 8 ore su alcune monete, buchi nelle serie. 7) Usare TikTok, X e YouTube solo come termometro di cosa crede la folla: un pattern di cui parlano tutti è o già nel prezzo o un mito. 8) Onestà sul proprio sapere: questo rapporto è stato scritto senza fonti lette (ricerca web e rete bloccate). Un agente della scuola non deve trasformare un'ipotesi in una certezza solo perché è scritta in modo preciso.
