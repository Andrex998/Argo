# La biblioteca di ARGO

Otto lettori hanno studiato fonti pubbliche serie sul trading (studi accademici, ricerche di
gestori, dati), poi un Preside ha scritto questa sintesi per il desk delle cripto: cosa regge,
cosa no, e in che ordine esaminare le idee. Le letture complete dei lettori, con tutte le
fonti, sono in `biblioteca-letture.md`. I lettori non hanno potuto aprire i PDF (la rete
li bloccava): i numeri della letteratura vengono da abstract ed estratti e vanno
ricontrollati prima di diventare parametri.

## Il verdetto

In breve: nel trading sistematico si guadagna in pochi modi documentati. Quasi sempre succede perché ci si prende un rischio che altri non vogliono, oppure perché si spende meno degli altri in costi ed errori. Il resto è rumore, costi o storie.

COSA REGGE DAVVERO
1) Seguire il trend su orizzonti da settimane a mesi, con la dimensione legata alla volatilità e su molti mercati. È la prova più lunga che esista: dal 1880, su decine di mercati, con uno Sharpe intorno a 1,2 lordo nei future diversificati. Ma vive di pochi trend grandi. Ha anni piatti e cali del 20-25%, e rende soprattutto quando i mercati si muovono molto. Serve più a evitare i grandi crolli che a battere chi compra e tiene.
2) Gestire la dimensione. Ridurre l'esposizione quando la volatilità sale taglia le perdite estreme quasi ovunque (oltre 60 mercati dal 1926). È la cosa più solida della biblioteca. Non garantisce più rendimento: garantisce code più piccole.
3) Il carry, cioè incassare il funding. È un premio vero, ma è il compenso per assicurare gli altri contro i crolli: si guadagna poco e spesso, si perde tanto e di rado. Sulle cripto è stato enorme fino al 2024; nel 2025 il suo Sharpe è diventato negativo.

COSA SULLE CRIPTO È DEBOLE O SPARISCE DOPO I COSTI
- Il momentum tra monete (comprare le più forti, vendere le più deboli). Sui perpetual di Binance 2020-2026 il guadagno lordo è circa uguale ai costi.
- Il ritorno alla media a breve (RSI, bande, comprare il crollo del giorno). Esiste soprattutto nelle monete piccole e illiquide. Sulle nostre 36, da 1 a 4 settimane prevale il momentum. A 4 ore e meno il vantaggio è più piccolo dei costi.
- Sentiment, social, Fear & Greed, flussi ETF e notizie macro. Spiegano bene il passato e quasi nulla del futuro alla nostra scala. Le notizie spostano soprattutto la volatilità, non la direzione. Funding, open interest e rapporto long/short misurano il rischio, ma non dicono quando il prezzo girerà.
- Calendario, halving, dati on-chain: nessuna prova letta, oppure impossibile da provare con i nostri dati.

TRE LEGGI CHE VALGONO OVUNQUE
- I costi decidono. Con lo 0,31% per andata e ritorno, ogni operazione deve guadagnare in media molto di più. Più si opera, più si regala.
- Ogni vantaggio pubblicato si consuma. Le bande di Bollinger hanno perso circa metà della redditività dopo essere diventate famose. Il rialzo prima delle riunioni della Fed si è quasi spento dopo il 2016.
- Chi prova cento varianti trova sempre un backtest bellissimo per caso. La difesa non è l'intelligenza, è il metodo: decidere prima, contare le prove, verificare una volta sola.

ASPETTATIVE ONESTE
Un buon sistema sulle cripto può puntare a uno Sharpe netto tra 0,5 e 1, con cali del 15-25% e mesi senza guadagni. Chi promette Sharpe sopra 2, il 90% di vincite o il 10% al mese sbaglia i conti o vende qualcosa.

IL NOSTRO SISTEMA (file /home/user/Argo/trading-desk/research/riskier.json, perps.json, derivs.json, walk.json)
Sui 3 anni ha fatto +108,5% con un calo massimo del 13,5%. Sembra ottimo, ma anno per anno è +11,2% (BTC +103%), +14,8% (BTC +56%) e +63,4% (BTC −29%).
- Nei primi due anni ha fatto circa +28% in tutto, mentre BTC faceva +216%. Il resto viene dall'anno di ribasso.
- Senza le 2 operazioni migliori, gli anni 1 e 2 fanno +1,3% e +2,8%: quasi zero.
- Su 1.000 dollari, il lato short ha reso +41, −67 e +335 dollari nei tre anni.
- Nello spot, la regola scelta guardando solo l'anno 1 ha poi fatto circa +7% l'anno nei due anni dopo. È un piccolo vantaggio vero fuori campione, non +36% l'anno.

La ricerca del desk fa già molte cose giuste: regole fissate prima di guardare, scelta sull'anno 1, risultati senza le 2 operazioni migliori, funding e costi veri. Ma il risultato dipende da un solo anno di ribasso e da scelte fatte guardando tutti e tre gli anni (filtro sull'open interest, tetto dello stop al 12%). Oggi è un'ipotesi promettente, non una prova.

Le domande da chiudere prima di tutto:
- Il vantaggio è nella rottura, o solo nell'andare dietro a BTC?
- Il desk vero, che legge Bybit, fa le stesse operazioni del backtest, che usa Binance?

Il buco evidente sono gli anni di rialzo. Un motore lento di trend è il candidato naturale per coprirlo. Per questo l'ordine degli esami è:
1) esaminare quello che abbiamo;
2) aggiungere il pezzo che manca (il trend lento);
3) gli strati di rischio;
4) i filtri;
5) i motori di diversificazione e i controlli.

GLI AGENTI IA
Non hanno un vantaggio segreto sul mercato. Possono dare quattro cose: disciplina (regole applicate senza paura né avidità), conti fatti bene, memoria scritta e la pazienza di bocciare le idee prima che costino. Una scuola che boccia l'80-90% delle idee sta funzionando.

Nota: i lettori non hanno potuto aprire i PDF perché la rete era bloccata, e quello della stagionalità non ha letto nessuna fonte. I numeri della letteratura vengono da abstract ed estratti: vanno ricontrollati prima di diventare parametri.

## Il programma d'esame

### E01 · Esame di riparazione del sistema attuale (rottura di volume a 4 ore, lato deciso da BTC)

Famiglia: Trend a breve: rottura di volume (sistema in uso). Forza delle prove: **C debole**.

È il nostro motore e il metro di paragone di tutto. Il +108,5% in 3 anni nasconde un fatto: anno per anno ha fatto +11,2%, +14,8% e +63,4%, mentre BTC faceva +103%, +56% e −29%. Senza le 2 operazioni migliori gli anni 1 e 2 sono quasi a zero (+1,3% e +2,8%). Su 1.000 dollari, il lato short ha reso +41, −67 e +335 dollari. Domande d'esame: (1) il vantaggio sta nella rottura di volume, o solo nello stare dalla parte di BTC, soprattutto short nell'anno di ribasso? (2) Il desk vero fa le stesse operazioni del backtest?

**Regole esatte.**

Base B0: il replay del desk dei perpetui che ha dato +108,5% (codice congelato con hash git). Regole: picco di volume a 4 ore nel verso del trend; chiusura oltre il massimo (o sotto il minimo) delle 20 candele precedenti; long solo con BTC in salita, short solo con BTC in discesa; stop 3 ATR(14) con tetto 8%; target 3R; trailing; rischio 1% allo stop; regola C (OI cresciuto nelle 24 ore); al massimo 5 posizioni; misura piena. Esecuzione all'apertura della candela dopo il segnale; 0,055% di commissione e 0,1% di slittamento per lato; funding reale.
Smontaggi, uno alla volta (servono a capire, non a scegliere):
- B1 senza regola C;
- B2 solo long;
- B3 solo short;
- B4 tetto dello stop al 12% (regole in uso dal 21/11/2026);
- B5 una candela di ritardo in più;
- B6 costi doppi.
Placebo P1, la prova chiave: per ogni operazione vera, un'entrata a caso nello stesso mese, su una moneta a caso tra quelle disponibili, nel lato permesso da BTC in quel momento, con la stessa gestione (stop, target, trailing, rischio). 1.000 simulazioni.
Placebo P2: togliere a caso la stessa quota di operazioni che toglie la regola C (circa 13%). 1.000 simulazioni.
Risultati per anno, per lato e per stato di BTC: rendimento, calo, MAR, R medio con intervallo bootstrap, numero di operazioni, costi, funding.
Superato se:
- B0 sta sopra il 95° percentile di P1 sui 3 anni e in almeno 2 anni su 3;
- resta positivo in ogni anno sia con B5 sia con B6;
- la regola C resta solo se batte il 90° percentile di P2.
La prova finale è il paper trading in avanti (punto 9 del protocollo).

**Fonti principali.** Ricerca del desk: /home/user/Argo/trading-desk/research/riskier.json, perps.json, derivs.json (regole fissate prima: la C aiuta poco ma in tutti e 3 gli anni; 'contro la folla' e 'con i grandi trader' peggiorano), walk.json (nello spot la regola scelta sull'anno 1 ha fatto circa +7% l'anno nei due anni dopo). Letteratura: Rozario et al., arXiv 2009.12155 (sulle cripto il trend giornaliero funziona, quello intraday no); Han, Kang e Ryu (momentum cripto più forte nei rialzi: lo short va dimostrato); Kaminski e Lo 2014 (lo stop serve solo se c'è persistenza).

**Cosa la smentirebbe.** Se B0 non batte il placebo P1, la rottura non aggiunge nulla allo stare dalla parte di BTC: meglio un filtro di regime semplice (E04). Se il lato short è positivo solo nell'anno 3, è stata una scommessa sul ribasso del 2026, non un vantaggio. Se costi doppi o una candela di ritardo azzerano gli anni 1 e 2, il margine è troppo sottile per la realtà. Se in 3 mesi di paper trading su Bybit i segnali o i risultati escono dalla banda attesa, il backtest non descrive il desk vero.

**Ruolo atteso.** Motore principale da confermare e metro di paragone per tutte le altre

**Esito (24/11/2026, `research/placebo.py`).**
- **P1, sui tre anni:** le operazioni vere battono tutte le 1.000 serie a caso, sia con
  lo stop all'8% sia con quello al 12%. Rendono +0,31 R e +0,22 R a operazione, contro
  circa +0,08 R delle entrate a caso negli stessi mesi.
- **P1, anno per anno:**
  - B0 (stop all'8%) batte l'81%, l'86% e il 99,9%: oltre il 95% in un anno solo, quindi
    **non passa**;
  - B4 (stop al 12%) batte l'82%, il 96% e il 100%: **passa**, ma lo stop al 12% è stato
    scelto sui dati.
- **P2:** la regola C batte il 96,5% e il 96,9% delle rimozioni a caso, quindi resta.
- **B5 e B6** restano positivi in ogni anno.

### E02 · Trend lento multi-orizzonte sul paniere (segno del rendimento e canali di Donchian)

Famiglia: Trend following lento (momentum nel tempo). Forza delle prove: **B buona**.

Il prezzo assorbe le notizie lentamente e poi la folla insegue. Per questo il segno del rendimento passato, su settimane e mesi, prevede il segno di quello futuro. È la regola con più prove al mondo, ma vive di pochi trend grandi e ha anni piatti. Per noi conta per un motivo pratico: il sistema a 4 ore ha preso poco dei rialzi degli anni 1 e 2. Un motore lento, con la dimensione legata alla volatilità, tiene le posizioni dentro i trend lunghi, opera poco (quindi costa poco) e dovrebbe essere poco correlato al 4 ore.

**Regole esatte.**

Giornaliero: decisione alla chiusura delle 00:00 UTC, esecuzione all'apertura della candela 4h delle 00:00. Universo: monete con almeno 120 giorni di storia.
T1 (segno del rendimento): s = media di segno(close_oggi / close_{oggi−L} − 1) per L = 7, 14, 28, 56, 112 giorni (da −1 a +1).
T2 (canali di Donchian, stile Zarattini): per L = 10, 20, 30, 60, 90, 150 giorni c'è un sotto-segnale. Passa a 1 quando la chiusura supera il massimo delle chiusure dei L giorni precedenti. Torna a 0 quando la chiusura scende sotto il punto medio del canale ((massimo + minimo) / 2 degli stessi L giorni). s = media dei 6 sotto-segnali (da 0 a 1). La regola d'uscita va controllata sul PDF prima del test.
Varianti dichiarate: T1 solo long (s = max(s, 0)); T1 long e short; T2 solo long.
Riferimento, che non si sceglie: Turtle Sistema 2 giornaliero (entrata sulla rottura dei 55 giorni, uscita sui 20 giorni, stop 2N con N = ATR a 20 giorni, rischio 1%, niente aggiunte, short a specchio).
Dimensione: peso della moneta = s × (0,20 / N) / vol30. N = monete disponibili quel giorno; vol30 = volatilità annualizzata dei rendimenti giornalieri degli ultimi 30 giorni. Così ogni moneta riceve la stessa quota di rischio.
Tetti: 20% del capitale su una moneta, leva lorda 1,5×. Si ribilancia solo se il nuovo peso differisce dal vecchio di oltre il 25%.
Uscita: nessuno stop fisso, si esce quando il segnale cambia. Stop di emergenza a 4 volte la volatilità giornaliera.
Costi e funding pieni: nei rialzi i long pagano il funding, che alla base vale circa l'11% l'anno sul nozionale.
L'anno 1 serve quasi tutto a scaldare le medie, quindi non si sceglie. Si verificano tutte e tre le varianti sugli anni 2 e 3 e il voto va alla loro media. Si riporta anche la combinazione con E01, con lo stesso rischio a ciascuno.

**Fonti principali.** Hurst, Ooi, Pedersen 2017 (trend dal 1880 su 67 mercati, cali fino al 25%); Moskowitz, Ooi, Pedersen 2012; Levine e Pedersen 2016 (medie e rendimenti passati sono la stessa informazione); Liu e Tsyvinski (momentum nel tempo a orizzonte giornaliero e settimanale nelle cripto); Han, Kang, Ryu (più forte nei rialzi); Detzel et al. 2021; Rozario et al. (Sharpe 0,5-1,5 su BTC 2011-2019); Zarattini, Pagani, Barbon 2025, SSRN 5209907 (Donchian a più orizzonti sulle cripto, Sharpe dichiarato sopra 1,5, nessuna replica). I campioni cripto sono corti: per questo il voto è B e non A.

**Cosa la smentirebbe.** Se la media delle tre varianti è negativa al netto di costi e funding negli anni 2 e 3, oppure se la combinazione con E01 (a rischio uguale) non ha un MAR più alto di E01 da solo, il trend lento non serve sulle nostre monete in questo periodo. Se il risultato sparisce togliendo la moneta migliore, era fortuna su una moneta. Se T2 regge solo prima di aprile 2025 (periodo già coperto dal paper) e non dopo, il paper non si replica.

**Ruolo atteso.** Motore principale lento e diversificazione rispetto al 4 ore (copre gli anni di rialzo)

**Esito (24/11/2026, `research/trend.py`).** Anni 2 e 3, dopo costi e funding:
- **Le tre varianti:** T1 long e short +1,1%, T1 solo long +3,6%, T2 solo long +2,6%. La
  media è +2,4%, con un'esposizione media del 6-14%.
- **Accanto a E01 a rischio uguale:** MAR 1,6 contro 3,47 di E01 da solo (correlazione
  0,51). **Non passa.**
- **Senza XLM**, la moneta migliore, le varianti restano positive.
- **T2:** +4,5% prima di aprile 2025, -1,8% dopo. Lo studio non si replica.
- **Turtle S2:** cali del 48-55%.

### E03 · Volatilità obiettivo (regolatore della dimensione)

Famiglia: Gestione del rischio: dimensione per volatilità. Forza delle prove: **A forte**.

La volatilità di domani somiglia a quella di oggi; i rendimenti no. Ridurre l'esposizione quando la volatilità sale taglia le perdite estreme in quasi tutti i mercati: è la prova più solida della biblioteca. Non promette più rendimento, promette code più piccole. Sul sistema a 4 ore l'effetto sarà piccolo, perché lo stop a 3 ATR dimensiona già per volatilità. Sul portafoglio della scuola, con più motori insieme, conta di più.

**Regole esatte.**

Si applica in quest'ordine: a E01, al portafoglio E01 + E02, al fondo della scuola. Non cambia i segnali, solo la dimensione delle nuove posizioni.
V1 (portafoglio): ogni giorno alle 00:00 UTC si calcola k = obiettivo / vol_stimata, limitato tra 0,25 e 1,5.
- vol_stimata = deviazione standard EWMA (emivita 10 giorni) dei rendimenti giornalieri della curva del capitale, annualizzata con √365.
- Obiettivo = mediana della stessa misura nell'anno 1, fissata una volta. Per il fondo della scuola: 15% l'anno.
- Rischio delle nuove operazioni = 1% × k. Le posizioni aperte non si toccano (niente costi in più).
V2 = V1 più lo stato di panico: se BTC chiude sotto la sua media a 50 giorni e la sua volatilità a 20 giorni è nel 20% più alto degli ultimi 365 giorni, il rischio delle nuove operazioni si dimezza ancora.
Confronto onesto: contro la stessa strategia a rischio fisso, scelto in modo da avere la stessa esposizione media.
Misure: calo massimo, settimana peggiore, media del 5% dei giorni peggiori, MAR.

**Fonti principali.** Harvey et al. 2018 (oltre 60 mercati dal 1926: meno code ovunque, Sharpe migliore solo sugli attivi rischiosi); Moreira e Muir 2017; Cederburg et al. 2020 (fuori campione lo Sharpe migliora solo in 53 strategie su 103: il voto A vale per le code, non per il rendimento); Daniel e Moskowitz 2016 (i crolli del momentum arrivano dopo i cali con volatilità alta); Habeli et al. 2024 (preprint sulle cripto).

**Cosa la smentirebbe.** Se, a parità di esposizione media, calo massimo, settimana peggiore e 5% dei giorni peggiori non migliorano in nessuno dei due anni di verifica, oppure se il MAR peggiora in entrambi, la volatilità obiettivo non serve sulle nostre monete. Su E01 da solo un effetto piccolo è atteso: il giudizio vero è sul portafoglio con più motori.

**Ruolo atteso.** Dimensione: meno code e calo massimo, non più rendimento

**Esito (25/11/2026, `research/risk_layers.py`).** **Passa.** Il confronto è a parità
di esposizione media, sui tre anni:
- V1 fa +191% contro +142% del rischio fisso, con un calo massimo del 12,9% contro il 13,5%
  e un MAR di 3,30 contro 2,54;
- V2 fa +191% contro +140% (calo 12,9% contro 13,4%, MAR 3,31 contro 2,54).

Negli anni 2 e 3 V2 migliora le perdite estreme e il MAR in entrambi. V1 migliora il MAR
nel 2, non nel 3.

### E04 · Filtro di regime BTC a tre stati, con riferimento minimo

Famiglia: Regime e filtri di trend. Forza delle prove: **B buona**.

Il nostro sistema usa già BTC per decidere il lato, ma con due soli stati. Nell'anno 2, in pieno rialzo, gli short hanno perso 67 dollari su 1.000: probabilmente la regola cambiava lato troppo spesso. Una zona neutra, cioè né long né short quando BTC è indeciso, dovrebbe togliere i falsi cambi. Il rapporto tra prezzo e media mobile prevede i rendimenti di BTC anche fuori campione. Vicino alla media, però, dà molti falsi segnali: serve una conferma.

**Regole esatte.**

Su BTC giornaliero (chiusura 00:00 UTC). Voto = quante tra le medie semplici a 20, 50 e 100 giorni stanno sotto la chiusura (da 0 a 3).
- RIALZO se il voto è 3;
- RIBASSO se il voto è 0;
- NEUTRO se è 1 o 2.
Lo stato cambia solo dopo 2 chiusure di fila nel nuovo stato.
Varianti su E01:
- R1: RIALZO → solo long; RIBASSO → solo short; NEUTRO → nessuna nuova entrata.
- R2: come R1, ma in NEUTRO rischio 0,5% nel verso della media a 50.
- R3: chiusura settimanale di BTC sopra o sotto la media a 20 settimane (due stati, cambio al lunedì).
- R4: R1 più un controllo di lateralità. Indice di efficienza a 20 giorni = |chiusura di oggi − chiusura di 20 giorni fa| / somma delle |variazioni giornaliere|. Se è sotto 0,20, lo stato è NEUTRO comunque.
Riferimento minimo M, da riportare sempre: long BTC 1× in RIALZO, liquidità negli altri stati.
Confronto con la regola di lato attuale (B0 di E01) e con BTC comprato e tenuto. Scelta tra R1-R4 sull'anno 1, verifica sugli anni 2 e 3.

**Fonti principali.** Detzel, Liu, Strauss, Zhou, Zhu, Financial Management 2021 (il rapporto prezzo/media a 5-100 giorni prevede BTC anche fuori campione); Faber (media a 10 mesi: meno calo, non più rendimento, confermato dopo la pubblicazione); Coinpaprika (25 incroci su 36 della media a 200 giorni falliti entro 30 giorni: servono conferme); Garnier e Solna (il comportamento di BTC cambia per epoche). Ricerca del desk: perdita degli short nell'anno 2.

**Cosa la smentirebbe.** Se nessuna variante batte la regola di lato attuale per MAR negli anni 2 e 3, o se la zona neutra toglie più guadagno di quanto tolga calo, resta la regola attuale. Se il riferimento minimo M ha un MAR migliore di E01 negli anni di verifica, la complessità del 4 ore non si ripaga.

**Ruolo atteso.** Filtro (lato e zona neutra) e riferimento minimo per tutta la scuola

### E05 · Tetto al rischio correlato

Famiglia: Gestione del rischio: correlazione. Forza delle prove: **C debole**.

Con BTC che decide il lato, le posizioni aperte vanno quasi sempre nello stesso verso. Nei crolli, poi, le altcoin si muovono insieme a BTC: cinque posizioni da 1% sono quasi una scommessa sola da 4-5%. Il tetto misura il rischio vero del portafoglio e blocca le nuove entrate quando è pieno.

**Regole esatte.**

Si applica a E01 e poi al fondo della scuola. A ogni nuovo segnale:
- matrice di correlazione C dei rendimenti giornalieri degli ultimi 60 giorni tra le monete aperte e quella nuova;
- ogni correlazione fuori dalla diagonale si porta ad almeno 0,6, perché nei crolli salgono;
- w = rischi delle posizioni in % del capitale, con segno (+ long, − short);
- rischio effettivo = √(wᵀ C w).
La nuova entrata passa solo se il rischio effettivo dopo l'entrata resta ≤ 3%. Altrimenti il segnale si scarta, senza sostituzioni a scelta. Con 1% a posizione vuol dire al massimo 3 posizioni nello stesso verso.
Variante semplice S: al massimo 3 posizioni nello stesso verso.
Vicini per vedere l'altopiano (non per scegliere): 2,5% e 3,5%.
Placebo: scartare a caso la stessa quota di segnali, 1.000 simulazioni. Confronto a parità di esposizione media.

**Fonti principali.** Harvey et al. 2018 (controllare il rischio del portafoglio taglia le code: prova indiretta). Nessuna prova specifica sulle cripto letta dai lettori. Logica della correlazione nei crolli: le altcoin seguono BTC. Ricerca del desk: oggi c'è un limite di 5 posizioni, tutte nello stesso verso di BTC.

**Cosa la smentirebbe.** Se, a parità di esposizione media, calo massimo e settimana peggiore non migliorano più del placebo che scarta a caso gli stessi segnali, il tetto equivale solo a fare meno operazioni. Se taglia soprattutto le operazioni migliori dei trend forti (guadagno perso maggiore del calo evitato), è bocciato.

**Ruolo atteso.** Dimensione

**Esito (25/11/2026, `research/risk_layers.py`).** **Non passa, per un soffio.** Il tetto
al 3% scarta il 37% dei segnali.
- **Contro le 1.000 serie che scartano a caso:** batte il 99,9% sul calo massimo e il
  100% sulla settimana peggiore.
- **Contro il desk senza tetto alla stessa esposizione:** perde 0,9 punti di rendimento e
  ne risparmia 0,7 di calo (MAR 2,61 contro 2,45).
- **Le varianti:** S fa peggio (MAR 2,18 contro 2,46). Al 2,5% e al 3,5% i rendimenti sono
  +71% e +103%.

### E06 · Freno anti-affollamento (funding in eccesso + open interest di mercato)

Famiglia: Funding e posizionamento (leva della folla). Forza delle prove: **C debole**.

Un funding alto e diffuso misura la leva dei piccoli che inseguono il trend. Per la BIS un carry alto anticipa i crolli: è il carburante delle liquidazioni a cascata, come a ottobre 2025. Non dice quando arriverà il crollo, quindi non è un segnale di entrata: è un freno sulla dimensione. Attenzione: nella ricerca del desk un filtro simile per singola moneta (saltare i rialzi quando il funding è affollato) non ha aiutato (+49,8% contro +51,3%). Qui si prova la versione di mercato, come riduzione del rischio. Se fallisce, si chiude.

**Regole esatte.**

Ogni giorno alle 00:00 UTC, solo con funding già regolati.
- Per ogni moneta F7 = somma dei funding degli ultimi 7 giorni / 21. Vale anche per le monete con funding ogni 4 ore.
- Eccesso E7 = F7 − 0,01%, il valore base della formula.
- CALDO = mediana di E7 tra le monete disponibili.
- dOI14 = variazione % in 14 giorni dell'OI di BTC, misurato in BTC e non in dollari, per togliere l'effetto del prezzo.
Stato FRAGILE: CALDO sopra il suo 90° percentile dei 180 giorni precedenti E dOI14 > +15%. Finisce quando CALDO scende sotto il 70° percentile.
In FRAGILE:
- nuovi long di E01 a rischio 0,5%;
- nessun nuovo long sulle monete con E7 nel quinto più alto;
- trailing dei long aperti stretto da 3 a 2 ATR.
Variante F (freddo): CALDO sotto zero per 7 giorni di fila → nuovi short a rischio 0,5%, per il rischio di squeeze.
Variante W: in FRAGILE, nessuna nuova entrata sulle altcoin dal venerdì 20:00 alla domenica 20:00 UTC.
Soglie: si sceglie sull'anno 1 tra percentile 80 o 90 e dOI14 10% o 20%. Se l'anno 1 ha meno di 3 periodi FRAGILE non si sceglie e si tengono 90 e 15%.
Placebo: le stesse riduzioni in giorni scelti a caso, con la stessa frequenza.
Misura in più: rendimento medio e caduta peggiore di BTC e del paniere nei 30 giorni dopo l'inizio di ogni stato FRAGILE, contro i giorni normali.

**Fonti principali.** Schmeling, Schrimpf, Todorov, BIS WP 1087: il carry cripto alto anticipa i crolli e nasce dalla leva di chi insegue il trend. La prova è buona per il legame, debole per l'uso come freno. Brunnermeier, Nagel, Pedersen 2008 (carry e crolli); BitMEX, rapporto Q3 2025 (funding fermo alla base il 78% del tempo: conta l'eccesso, non il livello); FTI Consulting sul 10 ottobre 2025 (un episodio). Ricerca del desk: perps.json (filtro di affollamento per moneta senza beneficio) e derivs.json (filtri sul rapporto long/short peggiori).

**Cosa la smentirebbe.** Il freno è bocciato in tre casi: (1) nei due anni di verifica i periodi FRAGILE non sono seguiti da rendimenti peggiori o da cadute più grandi dei giorni normali, e il freno non migliora il MAR più del placebo; (2) taglia soprattutto le operazioni migliori; (3) con meno di 5 periodi FRAGILE distinti il risultato è solo un'osservazione.

**Ruolo atteso.** Filtro sulla dimensione nei periodi di leva affollata

### E07 · Forza relativa tra le monete (prima filtro, poi motore)

Famiglia: Momentum tra le monete (cross-section). Forza delle prove: **C debole**.

Tra le monete grandi e liquide come le nostre, chi è salito di più nelle ultime 2-4 settimane tende a restare forte per un po', per il gregge e l'informazione lenta. L'inversione settimanale vale invece per le monete piccole. Come motore a sé, sui perpetual di Binance 2020-2026 il guadagno lordo è circa uguale ai costi. Per questo si prova prima come filtro, che non aggiunge operazioni né costi.

**Regole esatte.**

Ogni giorno alle 00:00 UTC, per ogni moneta: R21 = close di ieri / close di 22 giorni fa − 1 (si salta l'ultimo giorno); punteggio = R21 / vol30. Si fa la classifica delle monete disponibili.
A (filtro su E01): i long di E01 passano solo sulle monete nel terzo più alto della classifica, gli short solo nel terzo più basso. Il resto di E01 non cambia. Vicini per l'altopiano: 14 e 28 giorni. Placebo: scartare a caso la stessa quota di segnali.
B (motore autonomo, si prova solo se A passa):
- ogni settimana, rendimento delle ultime 3 settimane saltando l'ultimo giorno;
- long le prime 7, short le ultime 7;
- chi è già in portafoglio esce solo se lascia le prime (o le ultime) 12;
- pesi proporzionali a 1/vol30, neutrale in dollari;
- volatilità obiettivo 15% l'anno, stimata su 60 giorni; leva lorda massima 1,5×.
Si prova col ribilanciamento in ciascuno dei 7 giorni e si riporta la media. Righe separate: guadagno lordo, costi, funding. Il movimento peggiore contro ogni short si controlla con i massimi delle candele 4h.

**Fonti principali.** Liu, Tsyvinski, Wu (JF 2022: momentum a 3 settimane, lordo, su monete piccole, 2014-2018); Fičura e Colak 2023 (monete grandi: momentum settimanale; piccole: inversione); Zaremba et al. 2021; Begušić e Kostanjčar; Arefev, SSRN 7404139 (perpetual Binance 2020-2026: lordo +0,57% a settimana, costi circa 0,40, netto circa zero); Grobys et al. (crolli del momentum).

**Cosa la smentirebbe.** A: se il R medio delle operazioni rimaste non migliora più del placebo. B: se il netto medio sui 7 giorni di ribilanciamento è zero o negativo negli anni 2 e 3 (come ha trovato Arefev sui perpetual di Binance), o se il segno cambia col giorno di ribilanciamento.

**Ruolo atteso.** Filtro (A); diversificazione solo se passa (B)

### E08 · Carry trasversale da funding (neutrale al mercato)

Famiglia: Carry da funding. Forza delle prove: **C debole**.

Chi è long su una moneta con funding alto paga per la leva. Stare short sulle monete con funding alto e long su quelle con funding basso incassa questo premio, senza scommettere sulla direzione del mercato. È un premio vero, ma è un'assicurazione contro i crolli venduta ad altri: si guadagna poco e spesso, si perde molto e di rado. Il carry si è ristretto molto dal 2024. I nostri costi (0,155% per lato) sono molto più alti di quelli dei test pubblicati.

**Regole esatte.**

Ogni lunedì alle 00:00 UTC.
- Universo: monete con almeno 60 giorni di storia e volume medio a 30 giorni sopra la mediana delle 36.
- F7 = somma dei funding degli ultimi 7 giorni.
- Long sul quinto dell'universo con F7 più basso, short sul quinto con F7 più alto (almeno 3 per lato).
- Pesi proporzionali a 1/vol20; esposizione lorda 1× (0,5 long, 0,5 short); massimo 15% per moneta.
- Banda: una moneta esce solo se lascia il terzo estremo.
- Nessuno short su una moneta con funding al tetto della formula per 3 regolamenti di fila.
Risultato = prezzo + funding incassato o pagato − costi, con righe separate per funding, prezzo e costi.
Stop di portafoglio: calo oltre il 15% dal massimo → esposizione dimezzata per 4 settimane.
Si prova col ribilanciamento in ciascuno dei 7 giorni e si riporta la media.

**Fonti principali.** Koijen, Moskowitz, Pedersen, Vrugt 2018 (il carry funziona in tutte le classi di attivi, ma perde nelle crisi); Schmeling et al., BIS WP 1087; He, Manela, Ross, von Wachter, arXiv 2212.06888 (deviazioni in calo di circa l'11% l'anno); Borri et al., arXiv 2510.14435 (Sharpe del carry negativo nel 2025); Alpha Research paper 2, fonte indipendente non replicata (Sharpe netto circa 0,4 con costi di 6 punti base per lato, calo 35%).

**Cosa la smentirebbe.** La strategia è bocciata se: il netto (prezzo + funding − costi) è zero o negativo negli anni 2 e 3; oppure crolla con costi doppi; oppure il guadagno viene quasi tutto dal prezzo e non dal funding (allora è una scommessa di direzione travestita). Se rende solo nel 2024 e non dopo, il premio si è esaurito, come dicono Borri et al.

**Ruolo atteso.** Diversificazione neutrale al mercato

### E09 · Rimbalzo dopo lo svuotamento della leva (capitolazione)

Famiglia: Ritorno alla media dopo vendite forzate (microstruttura). Forza delle prove: **C debole**.

Nelle cascate di liquidazione chi è costretto a vendere vende a prezzi peggiori del giusto, e chi compra da lui viene pagato. Un crollo del prezzo con l'open interest che crolla insieme segnala vendite forzate, non notizie. Le prove dicono però due cose contrarie: nel giorno del crollo il movimento tende a continuare, e il mese dopo le grandi liquidazioni è stato in media più debole. Per questo si entra solo dopo una conferma, con posizioni piccole e uscita a tempo.

**Regole esatte.**

Candele 4h, per ogni moneta. C'è un evento quando succedono insieme quattro cose:
1) rendimento delle ultime 6 candele (24 ore) ≤ −2,5 volte l'ATR(14) giornaliero;
2) OI della moneta, misurato in monete, sceso di almeno il 10% nelle stesse 24 ore;
3) volume delle 24 ore ≥ 2 volte la media giornaliera dei 30 giorni prima;
4) funding dell'ultimo giorno sotto la media dei 7 giorni.
Conferma: una candela 4h che chiude sopra la metà dell'escursione della candela più bassa dell'evento, entro 12 candele. Altrimenti l'evento si annulla.
Entrata all'apertura della candela dopo la conferma. Stop: minimo dell'evento meno 0,5 ATR(14) a 4h. Uscita: target 2R, oppure dopo 18 candele (3 giorni). Variante: uscita a tempo dopo 6 candele.
Rischio 0,5%; al massimo 3 posizioni insieme; al massimo un evento per moneta ogni 5 giorni. Se l'evento colpisce almeno 15 monete nelle stesse 24 ore (crollo di mercato), si opera solo su BTC ed ETH.
Placebo: stessi cali di prezzo ma con OI stabile (tra −3% e +3%), stessa gestione.

**Fonti principali.** Zhang e Wang, SSRN: le vendite forzate escono con uno sconto seguito da un recupero, che crescono col volume forzato (20 cascate su Hyperliquid). Nagel 2012: il ritorno alla media paga chi fornisce liquidità, di più nella turbolenza. Caporale e Plastun: nel giorno del movimento anomalo il prezzo continua, e con i costi l'anomalia sparisce. K33, via The Block: 30 giorni dopo le liquidazioni più grandi +0,78% in media, contro +5,9% normale.

**Cosa la smentirebbe.** Con meno di 30 eventi in giorni diversi negli anni 2 e 3 è solo un'osservazione. Se il R medio netto è zero o negativo, o non batte il placebo con lo stesso calo ma senza svuotamento dell'OI, la leva svuotata non dà un rimbalzo sfruttabile a 4 ore.

**Ruolo atteso.** Diversificazione: piccolo motore contrarian

### E10 · RSI a 2 periodi nel verso del trend (controllo del ritorno alla media)

Famiglia: Ritorno alla media a breve. Forza delle prove: **D aneddotica**.

È l'idea di ritorno alla media più famosa (Connors): dentro un trend, si compra dopo 1-3 giorni di calo brusco. Le prove contro sono tre. Le prove pubblicate vengono quasi solo dall'autore e sulle azioni. I test indipendenti su BTC 2016-2025 sono negativi dopo i costi. Sulle monete grandi, a breve, prevale il momentum e non l'inversione. La mettiamo agli esami per chiudere la domanda: se fallisce, entra nella lista dei miti.

**Regole esatte.**

Giornaliero. Universo: BTC, ETH e le 10 monete con più volume nei 30 giorni prima, ricalcolate ogni mese.
Long se: chiusura sopra la propria media a 100 giorni; BTC sopra la sua media a 100 giorni; RSI(2) sotto 10. Entrata all'apertura del giorno dopo.
Uscita alla prima tra: chiusura sopra la media a 5 giorni; RSI(2) sopra 70; 5 giorni passati.
Stop di emergenza a 3 ATR(14) giornalieri. Rischio 0,5%, al massimo 5 posizioni.
Short a specchio: chiusura sotto la media a 100, BTC sotto la sua media a 100, RSI(2) sopra 90.
Vicini per l'altopiano: soglie 5 e 15. Variante: solo long.

**Fonti principali.** Connors Research (dati dell'autore su SPY); CXO Advisory (critica: niente fuori campione, niente costi); Tickfloor (BTC 2016-2025: negativo dopo i costi); Fičura 2023 e Zaremba et al. 2021 (sulle monete grandi, a breve c'è momentum, non inversione).

**Cosa la smentirebbe.** Se il R medio netto (con 0,31% di costi per giro) è zero o negativo negli anni 2 e 3, o se dipende dalle 2 operazioni migliori, il ritorno alla media di 1-3 giorni non esiste sulle nostre monete grandi: la regola va tra i miti.

**Ruolo atteso.** Controllo (prova di un mito); diversificazione solo se passa

### E11 · Trend lento su valute, oro e argento (le regole di E02 su un'altra classe di attivi)

Famiglia: Trend lento (momentum nel tempo). Forza delle prove: **A forte in letteratura, da verificare sui nostri dati**.

Scritto il 25/11/2026, prima di guardare i dati, per la fusione del 4/1/2027 tra la scuola forex e la scuola cripto. Se passa, diventa il portafoglio a regole del Macro e del Tecnico quando entrano nella Scuola Cripto. Se non passa, i due entrano con il solo portafoglio a giudizio.

Il trend nel tempo è la strategia più documentata della biblioteca su valute e materie prime: Moskowitz, Ooi e Pedersen 2012; Hurst, Ooi e Pedersen 2017, un secolo di dati. Dopo il 2010 sulle valute è stato più debole. Questo esame non sceglie niente sui dati: usa le regole di E02, già scritte, su mercati nuovi.

**Regole esatte.**

- **I mercati.** I 9 della scuola forex: EUR/USD, GBP/USD, AUD/USD, NZD/USD, USD/JPY, USD/CHF, USD/CAD, XAU/USD e SLV (al posto dell'argento).
- **I dati.** Candele giornaliere di Twelve Data, la stessa fonte della scuola: fino a 5.000 giorni di borsa per mercato.
- **Il segnale.** s = la media dei segni dei rendimenti a 5, 10, 20, 40 e 80 giorni di borsa (1, 2, 4, 8 e 16 settimane), da -1 a +1. Long e short: sulle valute uno short è il long dell'altra moneta.
- **I pesi.** Peso di un mercato = s × (0,10 / N) / vol60, dove N è il numero di mercati con 120 giorni di storia e vol60 la volatilità annua degli ultimi 60 rendimenti giornalieri.
- **I limiti.** Al massimo 0,5 volte il capitale su un mercato e 3 volte in tutto.
- **Quando si decide.** Ogni venerdì alla chiusura, con esecuzione alla chiusura stessa. Un peso cambia solo se il nuovo si allontana di oltre il 25% da quello tenuto.
- **I costi.** Su ogni cambio, gli spread della scuola forex (`MARKETS` in `fx-school/school.py`) più uno slittamento uguale allo spread. Gli interessi del rollover sono esclusi e vanno dichiarati come limite.

**Il placebo.** 1.000 serie con gli stessi pesi in valore assoluto e i segni del segnale estratti a caso ogni venerdì.

**Superato se:**
1. **Il rendimento.** Dopo i costi, su tutto il periodo, lo Sharpe è almeno 0,3 ed è positivo in almeno il 60% degli anni solari completi.
2. **Il placebo.** Lo Sharpe batte il 95° percentile del placebo.
3. **Senza il mercato migliore.** Il rendimento resta positivo.
4. **Gli ultimi 5 anni.** Il rendimento resta positivo anche lì.

Basta un criterio mancato per non passare.

**Cosa la smentirebbe.** Ognuno dei criteri mancati è una smentita. In particolare: un risultato che vive solo prima del 2010 o di un mercato solo, oppure che non batte i segni a caso, dice che il trend qui è solo una storia dei libri.

**Ruolo atteso.** Portafoglio a regole del Macro e del Tecnico nella Scuola Cripto, dopo la fusione.

**Esito (25/11/2026, `research/fx_trend.py`).** **Non passa: manca tutti e quattro i
criteri.** Dal 6/7/2007 al 24/11/2026, dopo i costi, perde il 17,3% (-1,0% l'anno), con
una volatilità del 4,5% e un calo massimo del 26,5%.
- **Il rendimento:** Sharpe -0,19, contro almeno 0,3. Anni solari positivi: 8 su 18
  (2008-2025), contro almeno 11. Fino al 2010 fa +5,4% (Sharpe 0,26), dal 2011 -21,6%.
- **Il placebo:** batte l'89,8% delle 1.000 serie con segni a caso, sotto il 95%. Le serie
  a caso girano di segno più spesso e pagano in media 2.690 $ di costi; prima dei costi lo
  Sharpe è +0,03 e ne batte il 55,5%. Qui il segno del trend non vale più di una moneta.
- **Senza EUR/USD**, il mercato migliore (+278 $), perde il 20,6%.
- **Gli ultimi 5 anni** (dal 25/11/2021): -1,7%.
- **I costi:** 1.793 $ su 10.000 $ in 19 anni. I pesi cambiano 6.052 volte, 2.271 delle
  quali girando di segno: 25 volte il capitale l'anno.

È la smentita prevista dalla scheda: guadagna solo prima del 2010 e non batte i segni a
caso.

I limiti:
- niente interessi del rollover;
- SLV al posto dell'argento;
- 5.000 candele per mercato: i dati partono dal 2007 per SLV e l'oro e da febbraio-maggio
  2008 per le valute. Fino a marzo 2008 il portafoglio è solo SLV, e ha tutti e 9 i
  mercati dal 31/10/2008. Il campione cade quasi tutto dopo il 2010, il periodo che la
  scheda già dava più debole sulle valute;
- errori nei dati di Twelve Data. EUR/USD 2008 ha 7 candele con giorno e mese scambiati (i
  prezzi del 2-12 agosto stanno all'8 di altri mesi). EUR/USD dal 2011 al 2022 e GBP/USD
  dal 2011 al 2024 hanno quasi sempre la chiusura uguale all'apertura, cioè il prezzo di
  inizio giornata. Dal 2024-2025 le valute hanno anche candele di sabato e domenica, tolte
  perché la regola conta i giorni di borsa. Toccano pochi giorni o l'ora del prezzo:
  difficile che cambino un risultato così lontano dalle soglie.

## Il protocollo d'esame

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

## Il progetto della scuola di agenti

### Gli agenti

- {"name": "Falco: il cacciatore di rotture (il desk dei perpetui di oggi)", "persona": "Rapido, disciplinato, di poche parole. Pensa in R (multipli del rischio), non in previsioni: «La regola dice di entrare? Quanto rischio? Dov'è lo stop?». Non discute con il mercato. Difetti da tenere d'occhio: scambiare per bravura il fatto di andare dietro a BTC, e innamorarsi dell'anno 3.", "strategies": "E01 (in esame di riparazione). Se promossi, aggiunge i filtri E04 (regime a tre stati) ed E07-A (forza relativa). La dimensione gliela danno E03, E05 ed E06 attraverso il Guardiano. Riusa Scout, Charts ed Executor del desk.", "thinking_time": "Il codice decide a ogni chiusura di candela 4h (6 volte al giorno), senza IA. L'agente parla una volta al giorno nella riunione del mattino, in 5 righe: cosa ha fatto il codice, cosa si aspettava, una cosa che lo preoccupa. Parla poi una volta a settimana nel consiglio. Nessun intervento a mano tra una candela e l'altra.", "wallet_rules": "Continua a girare con le regole del desk dei perpetui (soldi finti):\n- rischio 1% allo stop, moltiplicato per il fattore del Guardiano (tra 0,25 e 1,5);\n- al massimo 5 posizioni;\n- posizioni insieme fino a 1,5 volte il capitale, al massimo x3 su una;\n- perdita giornaliera massima 3%;\n- fermo al 15% di calo dal massimo;\n- se E05 passa, rischio correlato massimo 3%.\nFinché E01 non è promosso del tutto, nel fondo della scuola pesa al massimo il 25% del rischio. Gira accanto a un gemello «solo regole», per misurare se gli analisti IA tolgono più operazioni cattive che buone.\nCalo oltre 1,5 volte quello della verifica: rischio dimezzato e revisione. Oltre 2 volte: sospeso."}
- {"name": "Tartaruga: il trend lento", "persona": "Paziente, umile, quasi noiosa. «Non so dove andrà il prezzo; so da che parte va su 1, 2, 4, 8 e 16 settimane.» Accetta molte piccole perdite per pochi trend grandi. Non cambia idea per una notizia: la notizia conta quando si vede nei prezzi. Il suo difetto è la lentezza nei mercati che girano in fretta (crolli a V).", "strategies": "E02 (segno del rendimento e canali di Donchian a più orizzonti). Tiene sempre accanto il riferimento minimo M di E04 (BTC sopra la media, altrimenti liquidità), per ricordare a tutti quanto vale la soluzione più semplice.", "thinking_time": "Il codice calcola una volta al giorno, alla chiusura delle 00:00 UTC. L'agente parla solo se un peso cambia di oltre il 25%, e nel consiglio del lunedì. Riflette poco e di rado, ed è la sua forza: ogni intervento in più costa commissioni ed errori.", "wallet_rules": "10.000 USDT virtuali.\n- Volatilità obiettivo 20% l'anno; peso di ogni moneta proporzionale a 1/volatilità.\n- Massimo 20% del capitale su una moneta; leva lorda massima 1,5×.\n- Nessuno stop fisso (si esce quando il segnale cambia); stop di emergenza a 4 volte la volatilità giornaliera.\n- Ribilancia solo oltre la banda del 25%.\nCali fino al 25% sono attesi e non fanno cambiare le regole. Scatta solo la revisione, oltre 1,5 volte il calo della verifica."}
- {"name": "Guardiano: il responsabile del rischio", "persona": "Pessimista di mestiere. Prima domanda: «Cosa succede se tutto va contro di noi insieme, stanotte, di sabato?». Conta le scommesse vere, non le posizioni: dieci altcoin long sono quasi una scommessa sola su BTC. Legge il funding come un termometro della leva altrui. Non sceglie mai la direzione: può solo ridurre.", "strategies": "E03 (volatilità obiettivo), E05 (tetto al rischio correlato), E06 (freno anti-affollamento). Calcola ogni giorno il rischio del fondo combinato della scuola. Eredita il Risk del desk.", "thinking_time": "Il codice controlla il rischio prima di ogni nuova entrata e a ogni regolamento del funding (00, 08, 16 UTC). L'agente scrive un bollettino di 5 righe ogni mattina. Manda un allarme solo quando scatta lo stato FRAGILE o una cascata (OI totale −15% in 24 ore con BTC −8%).", "wallet_rules": "Nessun wallet direzionale. Si giudica con i gemelli: ogni strategia gira in due copie, con e senza le sue regole. Il suo voto è la differenza tra le due copie in MAR, calo massimo e settimana peggiore, a parità di esposizione media. Può ridurre la dimensione o bloccare nuove entrate solo con regole scritte prima. Non può aprire né chiudere posizioni per opinione."}
- {"name": "Ragioniere: il contabile del carry", "persona": "Contabile pignolo. «Chi mi paga, e perché?» Separa sempre tre righe: guadagno dal funding, guadagno dal prezzo, costi. Diffida di ogni rendimento alto: un funding da record di solito è una trappola (squeeze, delisting). Sa che il carry è un'assicurazione contro i crolli venduta ad altri.", "strategies": "E08 (carry trasversale neutrale al mercato). Passa al Guardiano le misure di funding in eccesso per E06.", "thinking_time": "Il codice aggiorna i conti dopo ogni regolamento (3 volte al giorno) e ribilancia il lunedì alle 00:00 UTC. L'agente parla una volta a settimana con il rapporto a tre righe. Parla in più solo se il funding medio del paniere va sotto zero o sopra il 90° percentile.", "wallet_rules": "10.000 USDT virtuali, neutrale in dollari.\n- Esposizione lorda 1× (metà long, metà short), massimo 15% su una moneta.\n- Nessuno short su monete con funding al tetto per 3 regolamenti di fila.\n- Calo oltre il 15% dal massimo: esposizione dimezzata per 4 settimane.\n- Calo oltre 1,5 volte quello della verifica: revisione."}
- {"name": "Selezionatore: lo scout della forza relativa", "persona": "Comparativo. Non chiede «sale?», chiede «sale più degli altri, a parità di rischio?». Sa che con 36 monete i gruppi sono piccoli e che il risultato può cambiare segno col giorno del ribilanciamento. Per questo prova sempre tutti i giorni e diffida delle vittorie di misura.", "strategies": "E07: A come filtro per il Falco; B come portafoglio long-short a basso ricambio, solo se A passa.", "thinking_time": "Il codice rifà la classifica ogni giorno alle 00:00 UTC. L'agente parla nel consiglio del lunedì. In più, solo se la dispersione tra le monete tocca i minimi o i massimi dell'anno: allora il filtro diventa rumore, oppure diventa importante.", "wallet_rules": "A: nessun wallet, si giudica con i gemelli sul Falco.\nB: 10.000 USDT virtuali, neutrale in dollari.\n- Volatilità obiettivo 15%, leva lorda massima 1,5×.\n- Banda di uscita: si esce solo fuori dalle prime o dalle ultime 12.\n- Massimo 15% su una moneta."}
- {"name": "Spazzino: il compratore delle vendite forzate", "persona": "Freddo nel panico, ma sospettoso. Sa di essere pagato solo quando compra da chi è costretto a vendere, non da chi vende perché sa qualcosa. Regole d'oro: mai il coltello che cade, mai mediare al ribasso, mai martingala. Aspetta la conferma, entra piccolo, esce a tempo.", "strategies": "E09 (rimbalzo dopo lo svuotamento della leva) ed E10 (RSI a 2 periodi nel verso del trend, come controllo).", "thinking_time": "Il codice lo sveglia solo quando scatta un evento. L'agente scrive una scheda per ogni evento: cosa è successo, se era nelle regole, che notizie registrava il Cronista (hack, delisting, sblocchi di token). Commenta anche nel consiglio del lunedì. Per il resto tace.", "wallet_rules": "10.000 USDT virtuali.\n- Rischio 0,5% per operazione, metà del Falco: il ritorno alla media ha perdite rare ma grandi.\n- Al massimo 3 posizioni insieme.\n- Uscita a tempo obbligatoria; nessuna aggiunta a una posizione in perdita.\n- Nei crolli di tutto il mercato (15 monete o più insieme), solo BTC ed ETH."}
- {"name": "Cronista: notizie, politica, macro e biblioteca", "persona": "Curioso e narratore, ma obbligato ai numeri. Separa sempre tre cose: il fatto (con fonte e ora), l'interpretazione, la previsione (con una probabilità). Parla di politica solo per gli effetti misurabili sui mercati, senza tifo. Conosce i miti: le notizie spostano soprattutto la volatilità, i flussi ETF seguono il prezzo, gli avvertimenti delle autorità contano meno dei cambi di status legale. Eredita News e Sentiment del desk.", "strategies": "Nessuna strategia d'esame nella prima ondata, perché notizie e calendario non sono nei nostri dati. Compiti:\n- calendario degli eventi (CPI, NFP, FOMC, scadenze politiche e regolatorie);\n- registro delle notizie con data e ora, divise nelle classi di Auer e Claessens: divieto o trattamento da titolo; regole su exchange e banche; legge su misura; semplice avvertimento;\n- registro delle previsioni;\n- una lettura a settimana dalla biblioteca, con al massimo 2 ipotesi nuove.\nPrepara i dati per la seconda ondata (scudo eventi).", "thinking_time": "Briefing al mattino prima della riunione (al massimo 5 notizie). Un controllo serale, solo se è successo qualcosa di grosso. Una lettura a settimana. È l'agente che consuma più abbonamento, quindi ha un tetto fisso di ricerche al giorno.", "wallet_rules": "Nessun wallet finché non dimostra di saper prevedere. Ogni giorno scrive 2-3 previsioni verificabili con una probabilità (per esempio «BTC chiuderà la settimana sopra il prezzo di oggi: 55%»). Dopo 100 previsioni si calcola il punteggio di Brier, che misura l'errore delle probabilità, e lo si confronta con la frequenza storica. Solo se è migliore in modo stabile può proporre un'ipotesi d'esame basata sulle notizie. Le sue opinioni non cambiano mai una posizione aperta."}
- {"name": "Scettico: il revisore", "persona": "Pignolo e un po' antipatico, per mestiere. Ha studiato Bailey e López de Prado, Harvey, Liu e Zhu, Kaminski e Lo. Cerca dati dal futuro, prove non contate, risultati che dipendono da due operazioni o da una moneta. Domande fisse: «Quante varianti avete provato?», «Regge con costi doppi?», «Batte il placebo?», «E senza la moneta migliore?». Se tutti sono d'accordo, deve sostenere il contrario. Eredita lo Skeptic del desk.", "strategies": "Nessuna. Custodisce il protocollo d'esame e il registro delle prove. Calcola DSR, PBO, placebo e bootstrap. Fa la riconciliazione mensile tra paper trading e backtest.", "thinking_time": "Su richiesta, ogni volta che qualcuno chiede una promozione. Ogni settimana rifà a mano i conti di 3 operazioni scelte a caso. Allo scrutinio mensile fa una revisione completa.", "wallet_rules": "Nessun wallet. Si giudica sugli errori trovati e confermati (dati dal futuro, bug, prove non contate) e sui falsi allarmi. Può bloccare una promozione se manca una prova del protocollo. Non può bloccare una bocciatura."}

### Il Preside

Il Preside è il super agente, ma non fa trading. Decide chi studia cosa, chi passa, chi viene bocciato e quanto rischio riceve ciascuno.

COSA HA STUDIATO
- I rapporti degli 8 lettori e i file della ricerca del desk.
- Trend: Hurst, Ooi e Pedersen; Moskowitz, Ooi e Pedersen; Levine e Pedersen.
- Rischio: Harvey et al.; Moreira e Muir; Cederburg et al.; Daniel e Moskowitz; Kaminski e Lo; il Kelly di Thorp e di MacLean, Thorp e Ziemba.
- Carry: Koijen et al.; BIS WP 1087; He et al.
- Metodo: Bailey e López de Prado; Harvey, Liu e Zhu.

COME GIUDICA
Prima il ragionamento, poi la disciplina (regole rispettate, stop, dimensione), per ultimo il risultato: un buon trade può perdere e uno cattivo può vincere. Il risultato si giudica solo contro l'atteso (la banda del backtest) e con numeri decisi prima.
Le sue domande fisse:
- «Chi paga e perché?»
- «Come lo sai?»
- «Cosa ti farebbe cambiare idea?»
- «Il mercato lo sa già?»
- «Quante prove hai fatto?»
- «Regge senza le 2 operazioni migliori e con costi doppi?»

COME SPINGE A RAGIONARE
In modo socratico, senza dare risposte pronte.
- Mette contro gli agenti che ragionano all'opposto: Tartaruga contro Spazzino, Cronista contro Scettico.
- Chiede a ciascuno l'argomento migliore contro la propria tesi.
- Fa girare il ruolo dell'avvocato del diavolo.
- Premia chi boccia una propria idea con un test pulito («bocciatura onorevole») quanto chi ne fa promuovere una.
- Vieta nelle conclusioni le frasi senza numero o fonte.

COME ASSEGNA IL CAPITALE
Assegna rischio, non soldi. Il fondo combinato della scuola punta a una volatilità del 15% l'anno, da confermare col proprietario.
- Quote per livello: biblioteca 0; tirocinio 25% del rischio standard della strategia; titolare 100%.
- Nessun agente supera il 40% del rischio totale. Il 30% resta in riserva per le nuove promozioni.
- Le quote cambiano solo allo scrutinio mensile, mai dopo una settimana bella o brutta.
- Dopo almeno 100 operazioni in avanti (26 settimane per le strategie settimanali), il rischio di una strategia non supera un quarto del Kelly. Il Kelly si calcola sul limite basso dell'intervallo di confidenza. Se quel Kelly è zero o negativo, la strategia si sospende.
- A parità di risultati preferisce la strategia meno correlata con quelle già titolari.

COSA NON FA
Non cambia regole a metà mese. Non scavalca i tagli del Guardiano. Non promuove senza il via dello Scettico. Non tocca soldi veri: quella decisione è solo del proprietario. Ha un tasto di arresto: se i dati sono rotti o c'è un bug, ferma la scuola.

### La giornata

Orari UTC; in Italia è un'ora in più d'inverno, due d'estate.

OGNI 4 ORE (00, 04, 08, 12, 16, 20)
Il codice chiude la candela, aggiorna prezzi, OI e rapporto long/short, controlla stop e target. Il Falco cerca rotture. Nessuna IA.

ALLE 00, 08 E 16
Il codice registra i funding regolati e il Ragioniere aggiorna i conti.

OGNI GIORNO
- 00:05: controllo dei dati (buchi, orari, valori strani). Se i dati sono rotti, nessuna nuova entrata finché non si sistemano.
- 00:10: il codice calcola i segnali giornalieri (Tartaruga, Selezionatore, regime di BTC) e gli strati del Guardiano (volatilità, tetto, stato FRAGILE).
- 00:15: ordini in paper.
- 05:30: il Cronista prepara il briefing: calendario del giorno e al massimo 5 notizie. Ogni notizia ha fonte, ora ed etichetta (fatto, interpretazione, previsione).
- 06:00 (le 07:00 in Italia d'inverno): riunione del mattino, al massimo 20 minuti, con il protocollo del dibattito. Il Preside chiude in 5 righe. L'orario è prima della scuola forex delle 08:23 italiane, per non sommare i consumi dell'abbonamento.
- Durante il giorno nessuno interviene a mano. Il Guardiano manda un allarme solo se scatta uno stato scritto nelle regole (FRAGILE, cascata). Lo Spazzino si sveglia solo sugli eventi.
- 20:00: diario. Per ogni agente 3 righe generate dai dati: cosa ha fatto, cosa si aspettava, se ha rispettato le regole. Un agente senza novità non consuma: la sua riga la scrive il codice. Il Cronista aggiunge una nota solo se c'è stata una notizia grossa.

OGNI LUNEDÌ
Alle 00:00 ribilanciano le strategie settimanali. Alle 06:00 c'è il consiglio di classe, più lungo:
- risultati della settimana contro i gemelli e il placebo;
- punteggio delle previsioni;
- una lettura dalla biblioteca;
- al massimo 2 ipotesi nuove;
- autopsie delle perdite grandi.

IL PRIMO LUNEDÌ DEL MESE
Scrutinio: promozioni, bocciature, quote di rischio, riconciliazione tra paper e backtest.

OGNI TRE MESI
Sessione d'esame per le ipotesi in lista d'attesa.

MODALITÀ RISPARMIO
Se l'abbonamento è vicino al limite saltano riunione, diario e consiglio. Il codice continua a operare e il Guardiano continua i controlli, perché sono codice. Nessuna decisione dipende dalla disponibilità dell'IA.

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

### Come si impara

Gli agenti non imparano da soli: il modello non cambia tra una sessione e l'altra. Imparano solo da quello che scriviamo e misuriamo.

1) Memoria. Tutto sta in file versionati con git: biblioteca (schede delle ipotesi), registro delle prove, risultati, verbali, diari, registro delle previsioni, istruzioni di ogni agente con numero di versione. A ogni sessione l'agente legge prima la sua scheda personale breve: strategie, voti, errori passati, domande aperte.

2) Livelli misurati.
- Biblioteca: è solo un'idea.
- Esame scritto: backtest con il protocollo.
- Tirocinio: paper in avanti al 25% del rischio, per almeno 3 mesi e 50 operazioni (13 settimane per le strategie settimanali).
- Titolare: rischio pieno deciso dal Preside.
- Veterano: 12 mesi da titolare dentro la banda attesa. Solo allora il proprietario può valutare soldi veri, ed è una decisione sua.

3) Promozioni e bocciature con numeri decisi prima. Una strategia scende di livello in tre casi:
- il calo supera 1,5 volte quello della verifica;
- il rendimento cumulato scende sotto il 5° percentile della banda attesa;
- il limite alto dell'intervallo di confidenza del R medio delle ultime 50 operazioni va sotto zero.
Dopo due discese torna in biblioteca, con un'autopsia scritta.

4) Il merito è il confronto con l'atteso, non il guadagno. Perdere dentro la banda attesa vuol dire fare il proprio lavoro. Guadagnare fuori dalle regole porta a un richiamo.

5) Bocciatura onorevole. Chi smonta una propria ipotesi con un test pulito riceve nel registro lo stesso credito di chi ne fa promuovere una. Bocciare l'80-90% delle idee è normale.

6) Nuove ipotesi. Ogni settimana il Cronista porta una lettura e al massimo 2 ipotesi. Lo Scettico controlla che siano provabili con i nostri dati e che non siano doppioni. Il Preside ne ammette al massimo 4 al mese (budget di prove).

7) Caccia agli schemi. Gli agenti possono cercare schemi ricorrenti nei dati: ore, giorni, eventi, combinazioni. Ma uno schema trovato guardando i dati è un'ipotesi «minata». Serve t ≥ 3 su un periodo non usato per trovarlo; altrimenti si verifica solo in avanti.

8) Autopsia. Ogni perdita oltre 2R, o oltre il 3% del wallet in un giorno, ha una scheda con tre domande: era nelle regole? era dentro la distribuzione attesa? c'era un errore di dati o di codice?

9) Gemelli. Ogni filtro, ogni strato di rischio e ogni intervento degli analisti IA si misura con una copia della strategia senza di esso. Così si sa se gli analisti tolgono più operazioni cattive che buone.

10) Istruzioni degli agenti. Si cambiano solo allo scrutinio mensile, con un motivo scritto e un nuovo numero di versione. Mai dopo una giornata brutta.

11) Previsioni. Le previsioni di tutti si valutano col punteggio di Brier. Chi non batte la frequenza storica non usa le sue previsioni per proporre operazioni.

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

## I miti da bandire

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

## Da leggere

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

## I primi passi

- Fissare la base. Congelare in git (con l'hash) le regole del desk dei perpetui. B0 = la versione che ha dato +108,5%, con tetto dello stop all'8%. B4 = quella in uso dal 21/11/2026, con tetto al 12%.
- Aprire il registro delle prove, per esempio /home/user/Argo/trading-desk/research/registro.csv, e inserire subito le prove già fatte: i 5 modi in perps.json, le 5 regole in derivs.json, le 8 varianti in riskier.json e le 16 combinazioni di regole in walk.json. È il N di partenza per lo Sharpe sgonfiato.
- Controllare i dati: buchi e doppioni; le date delle cuciture MATIC→POL, FTM→S e RNDR→RENDER (STITCH in perps.py); le monete con funding ogni 4 ore; le date di quotazione; l'OI misurato in monete e non in dollari. Verificare anche che ogni script usi la commissione dello 0,055% e lo slittamento dello 0,1% per lato: oggi perps.py ha lo 0,05% di commissione di default.
- Costruire un banco d'esame comune, per esempio research/exam.py, che ogni strategia usa. Deve gestire: esecuzione alla candela dopo; costi e funding; stop prima del target nella stessa candela; risultati per anno, lato e stato di BTC; le prove senza le 2 operazioni migliori e senza la moneta migliore; costi doppi; ritardo; placebo; bootstrap a blocchi; Sharpe sgonfiato con il N del registro. Prima di usarlo, deve rifare esattamente i numeri di riskier.json.
- Primo esame: E01 con il placebo P1, cioè entrate a caso con lo stesso lato di BTC. È la domanda più importante della scuola: il guadagno viene dalla rottura o solo dal lato di BTC? Poi gli smontaggi da B1 a B6.
- Riconciliazione con la realtà, da fare sul PC dove gira il desk, perché il database di questo progetto è vuoto. Confrontare le operazioni del paper trading dei perpetui (data/desk-paper-perps.db) con quelle che il replay avrebbe fatto negli stessi giorni. Misurare anche quante rotture coincidono tra Bybit, che il desk legge, e Binance, su cui si fa la ricerca.
- Chiedere al proprietario quanto calo è disposto a sopportare senza spegnere tutto. Da lì si fissa la volatilità obiettivo del fondo della scuola. Proposta: 15% l'anno, con cali attesi fino al 20-25%.
- Secondo esame: E02 (trend lento). Poi E03 (volatilità obiettivo) sul portafoglio E01 + E02. Dopo, uno alla volta e solo quando l'esame precedente è chiuso: E04, E05, E06 ed E07-A; poi E08 ed E09; per ultimo E10.
- Raccogliere i dati ogni giorno. L'API di Binance dà solo la storia recente di OI e rapporto long/short (circa 30 giorni). Bisogna salvare ogni giorno anche gli archivi di data.binance.vision (metrics, funding, candele), come fa derivs.py. Così il paper trading usa gli stessi dati della ricerca.
- Costruire la scuola a piccoli passi, sul modello di /home/user/Argo/fx-school (preside.md, un file per allievo, il programma, un motore che fa rispettare le regole), per esempio in /home/user/Argo/crypto-school. All'inizio servono solo: Falco (il desk di oggi), Guardiano (il Risk di oggi), Scettico (lo Skeptic di oggi), Preside, e il Cronista solo per registrare notizie e previsioni. Gli altri agenti entrano quando la loro strategia passa l'esame scritto.
- Misurare nella prima settimana quanto abbonamento consuma la routine (riunione, diario, consiglio), sommata al desk e alla scuola forex. Poi fissare un tetto e attivare la modalità risparmio, in cui il codice opera senza IA.
- Verificare le fonti chiave. Abilitare nelle impostazioni di rete della sessione arxiv.org, papers.ssrn.com, nber.org, bis.org, aqr.com e people.duke.edu. Rileggere almeno: la regola d'uscita di Zarattini (E02), le regole originali delle Turtle, Arefev (E07) e il BIS WP 1087 (E06).
- Lista d'attesa per la seconda ondata, da aprire solo dopo aver chiuso la prima. Candidati: lo scudo eventi attorno a CPI, NFP e FOMC (serve aggiungere il calendario ufficiale delle date, l'unico dato in più proposto); la compressione di volatilità come filtro delle rotture; l'inversione lenta a 4-12 settimane; il momentum pesato per volume; la stagionalità (ore, giorni, fine mese, scadenze), solo con soglia t ≥ 3. Non provabili con i nostri dati: on-chain, halving, social, Google Trends, flussi ETF, cash and carry (servono i prezzi spot).
