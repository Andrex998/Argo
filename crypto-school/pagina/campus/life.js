/* Scuola Cripto · campus/life.js · Campus.life (contract v1.0, §5.4).
   The brain of the campus. It runs each agent's day on Rome's clock and overrides it with what
   really happens: the live meeting (live/ora), the replay of a day's minutes (a port of the old
   classroom's dayScript), the evening alarm meeting, the Sunday gym and the contests. In between,
   the agents choose what to do by personality and by the school's real numbers, meet and talk
   with lines built only from the data, think with lines from their own notebooks, and act out
   the dialogs the owner asks Claude for («Fateli parlare»). It owns no DOM: it commands
   Campus.people, reserves Campus.world's anchors, feeds the director (life:focus) and the feed. */
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.life) return;
  const U = C.util, bus = C.bus, D = C.derive;
  const KEYS = C.KEYS, TR = C.TRADERS, GR = C.GRADED, NM = C.NAMES;
  const obj = U.obj, arr = U.arr, isNum = U.isNum, PI = Math.PI;
  const full = (v) => (obj(v) && Object.keys(v).length ? v : null);
  const has = (list, x) => list.indexOf(x) >= 0;

  // ---- names, articles, the Italian of the agents ------------------------------------------------
  const ART = C.ARTICLE;
  const PREP = { di: { il: "del", la: "della", lo: "dello" }, a: { il: "al", la: "alla", lo: "allo" } };
  const nm = (k) => NM[k] || k;
  const the = (k) => `${ART[k] || "il"} ${nm(k)}`;
  const The = (k) => U.cap(the(k));
  const di = (k) => `${PREP.di[ART[k]] || "del"} ${nm(k)}`;
  const fem = (k) => ART[k] === "la";
  const gx = (k, m, f) => (fem(k) ? f : m);
  const theList = (ks) => U.listIt(ks.map(the));
  const ROOM_IN = { presidenza: "in presidenza", riunione: "in sala riunioni", trading: "in sala trading", biblioteca: "in biblioteca", mensa: "in mensa", palestra: "in palestra", portico: "sotto il portico", cortile: "in cortile", corridoio: "nel corridoio" };
  const roomIn = (r) => ROOM_IN[r] || (r && r.startsWith("dorm_") ? "in camera" : "nel campus");

  // ---- the fixed tables of the contract ---------------------------------------------------------------
  const RIGHE = ["Cosa abbiamo imparato", "Le previsioni nel registro", "Le ipotesi per la lista d'esame", "La richiesta al Guardiano", "La domanda per domani"];
  const SERA_RIGHE = ["Cosa è successo", "Cosa si è deciso", "Cosa guardare domattina"];
  const CONSTANTS = [10000, 80000, 8, 4, 36, 180, 100, 365, 20, 1, 2, 3, 10, 2027, 21, 6, 47, 11, 13, 41, 88];
  const ROLE = {
    preside: "Dirige la riunione e dà i voti. Allo scrutinio decide quanto rischio può prendere ognuno.",
    falco: "Le rotture di volume sulle candele a 4 ore: il desk dei perpetui.",
    tartaruga: "Il trend lento, da 1 a 16 settimane. Paziente, quasi noiosa.",
    spazzino: "Compra le vendite forzate: RSI a 2 periodi nel verso del trend.",
    ragioniere: "Il carry sul funding, neutrale in dollari: prezzo, funding e costi separati.",
    guardiano: "Il rischio: esposizione, allarmi e riduzioni scritte prima.",
    cronista: "Calendario, notizie, politica e biblioteca. Separa il fatto dall'opinione.",
    scettico: "Il revisore: al massimo 2 domande al giorno, ognuna con un numero.",
  };
  // Appendix D.4: indole, voce, difetto
  const PERSONA = {
    preside: ["socratico, severo ma giusto: prima il ragionamento, poi la disciplina, per ultimo il risultato", "domande brevi: «Chi paga, e perché?», «Come lo sai?», «Cosa ti farebbe cambiare idea?»; vieta le frasi senza un numero o una fonte", "a volte parla troppo da professore"],
    falco: ["rapido, disciplinato, di poche parole; pensa in R, multipli del rischio", "frasi corte: «La regola dice di entrare? Quanto rischio? Dov'è lo stop?»", "scambiare per bravura l'andare dietro a BTC"],
    tartaruga: ["paziente, umile, quasi noiosa; segue il trend lento da 1 a 16 settimane", "parla poco e piano; ricorda il valore della soluzione più semplice", "la lentezza nei crolli a V, e la noia che spinge a fare qualcosa"],
    spazzino: ["freddo nel panico ma sospettoso; compra da chi è costretto a vendere", "«Mai il coltello che cade», «Chi vende, e perché?»", "vedere vendite forzate in ogni ribasso"],
    ragioniere: ["contabile pignolo: separa funding, prezzo e costi", "«Chi mi paga, e perché?»; conti precisi, niente rendimenti promessi", "guardare solo il funding e dimenticare il prezzo"],
    guardiano: ["pessimista di mestiere; conta le scommesse vere, non le posizioni", "«Cosa succede se tutto va contro di noi insieme, stanotte, di sabato?»; pochi allarmi, sempre con un numero", "vedere un crollo dietro ogni angolo"],
    cronista: ["curioso e narratore, ma obbligato ai numeri; separa fatto, interpretazione e previsione", "cita sempre fonte e ora; mai «è sceso perché…» senza una fonte", "trovare dopo i fatti una spiegazione per ogni movimento"],
    scettico: ["pignolo e un po' antipatico per mestiere; sostiene il contrario se tutti sono d'accordo", "«Quante varianti avete provato?», «Regge con costi doppi?», «Quale numero, quale prova?»", "fare domande per il gusto di farle"],
  };
  const TOPICS = [
    ["libero", "quello che vogliono, partendo dai fatti di oggi"], ["mercato", "il mercato di oggi e le loro posizioni"],
    ["obiettivo", "l'obiettivo comune: il fondo, la squadra e la tesi della laurea"], ["gara", "la gara della scuola e come sta andando"],
    ["errori", "gli errori che ripetono e cosa hanno imparato"],
  ];
  const TOPIC_LABEL = Object.fromEntries(TOPICS);
  const GESTI = ["talk", "gesture", "think", "listen", "drink"];
  const MODE_TXT = { vita: "La giornata del campus, adesso", notte: "È notte: dormono quasi tutti", riunione: "La riunione del mattino", palestra: "La palestra della domenica" };

  // ---- the day (Appendix A) -------------------------------------------------------------------------
  const WAKE = { preside: 365, falco: 360, tartaruga: 380, spazzino: 370, ragioniere: 360, guardiano: 355, cronista: 375, scettico: 380 };
  const BED = { preside: 1370, falco: 1420, tartaruga: 1335, spazzino: 1400, ragioniere: 1360, guardiano: 1390, cronista: 1430, scettico: 1410 };
  const SPEED = { preside: 1.05, falco: 1.55, tartaruga: 0.85, spazzino: 1.25, ragioniere: 1.15, guardiano: 1.2, cronista: 1.35, scettico: 1.1 };
  const BLOCK_LABEL = { notte: "la notte", sveglia: "la sveglia", caffe: "il caffè", riunione: "la riunione del mattino", lavoro: "il lavoro", pranzo: "il pranzo", cena: "la cena", controllo: "il controllo della sera", serata: "la serata", palestra: "la palestra della domenica" };
  const GYM = ["falco", "tartaruga", "spazzino", "ragioniere", "scettico", "preside"];
  const SERA_CAST = ["guardiano", "falco", "tartaruga", "spazzino", "ragioniere", "preside"];
  const jitter = new Map();
  function times(k, date) {
    const id = k + "|" + date;
    let t = jitter.get(id);
    if (!t) { const r = U.rng(id); t = { wake: WAKE[k] + Math.round((r() * 2 - 1) * 8), bed: BED[k] + Math.round((r() * 2 - 1) * 8) }; jitter.set(id, t); }
    return t;
  }
  function schoolDay(date) {
    if (date < "2026-11-25" || date > C.GRADUATION) return false;
    const g = arr(obj(C.data.programma) && C.data.programma.giorni).find((x) => x && x.data === date);
    return g ? g.tipo !== "accoglienza" : date >= C.SCHOOL_START;
  }
  function blockOf(k, r) {
    const m = r.minutes, t = times(k, r.date);
    if (m >= t.bed || m < t.wake) return "notte";
    if (m < t.wake + 12) return "sveglia";
    if (m < 400) return "caffe";
    if (m < 460) return schoolDay(r.date) ? "riunione" : "lavoro";
    if (r.weekday === 0 && m >= 665 && m < 750 && has(GYM, k)) return "palestra";
    if (m < 765) return "lavoro";
    if (m < 825) return "pranzo";
    if (m < 1170) return "lavoro";
    if (m < 1235) return "cena";
    if (m < 1260) return "controllo";
    return "serata";
  }
  function schedule() {
    const r = U.rome(), B = [["notte", 0, 365], ["sveglia", 365, 377], ["caffe", 377, 400], [schoolDay(r.date) ? "riunione" : "lavoro", 400, 460]];
    if (r.weekday === 0) B.push(["lavoro", 460, 665], ["palestra", 665, 750], ["lavoro", 750, 765]); else B.push(["lavoro", 460, 765]);
    B.push(["pranzo", 765, 825], ["lavoro", 825, 1170], ["cena", 1170, 1235], ["controllo", 1235, 1260], ["serata", 1260, 1395], ["notte", 1395, 1440]);
    const out = [];
    for (const [block, from, to] of B) { const p = out[out.length - 1]; if (p && p.block === block) p.to = to; else out.push({ from, to, block, label: BLOCK_LABEL[block] }); }
    return out;
  }

  // ---- activities (Appendix B.1): label, anchor patterns (@ = the agent), state, duration (0 = the block), interruptible
  const ACT = {
    dormire: ["dorme", ["dorm_@.bed"], "sleep", 0, 0], prepararsi: ["si prepara", ["dorm_@.spot"], "idle", 0, 0],
    caffe: ["prende un caffè", ["mensa.counter.*", "mensa.seat.*"], "drink", [60, 150], 1], pasto: ["mangia in mensa", ["mensa.seat.*"], "drink", 0, 1],
    terminale: ["al terminale", ["trading.desk.@"], "type", [90, 180], 0], prezzi: ["guarda i prezzi", ["trading.wall.*"], "think", [45, 90], 1],
    rischio: ["controlla il rischio", ["trading.desk.guardiano"], "type", [90, 180], 0], notizie: ["legge le notizie", ["trading.desk.cronista"], "read", [90, 180], 0],
    studio: ["studia in biblioteca", ["biblioteca.table.*"], "read", [90, 180], 0], lettura: ["legge in poltrona", ["biblioteca.armchair.*"], "read", [90, 180], 1],
    scaffale: ["cerca un libro", ["biblioteca.shelf.*"], "read", [45, 75], 1], passeggiata: ["passeggia in cortile", ["cortile.spot.*"], "idle", [60, 120], 1],
    panchina: ["riflette in cortile", ["cortile.bench.*"], "think", [60, 150], 1], fontana: ["guarda la fontana", ["cortile.fountain"], "think", [45, 75], 1],
    ronda: ["fa la ronda", ["portico.spot.*"], "idle", [90, 150], 1], ufficio: ["lavora in presidenza", ["presidenza.desk"], "write", [90, 180], 0],
    finestra: ["pensa alla finestra", ["presidenza.window"], "think", [45, 75], 0], quaderno: ["scrive nel quaderno", ["dorm_@.desk"], "write", [90, 180], 0],
    esercizi: ["fa esercizi in palestra", ["palestra.spot.*"], "gesture", [60, 120], 1], visita: ["va a trovare", [], "idle", [0, 0], 1],
    gara: ["guarda la classifica della gara", ["trading.gara.*"], "think", [60, 120], 1],
    riunione: ["alla riunione", ["riunione.seat.@"], "listen", 0, 0], attesa: ["aspetta la riunione", ["riunione.seat.@"], "sit", 0, 1],
    palestra_casi: ["risolve i casi della palestra", ["palestra.desk.@"], "think", 0, 0], palestra_guida: ["guida la palestra", ["palestra.board"], "talk", 0, 0],
    palestra_scettico: ["ascolta la palestra", ["palestra.stand.scettico"], "listen", 0, 0], sera: ["alla riunione della sera", ["riunione.seat.@"], "listen", 0, 0],
    festa: ["festeggia la gara", ["cortile.spot.*"], "gesture", 0, 0], incontro: ["parla con", [], "talk", 0, 0], dialogo: ["dialogo con", [], "talk", 0, 0],
  };
  const COLS = ["terminale", "prezzi", "rischio", "notizie", "studio", "lettura", "scaffale", "passeggiata", "panchina", "fontana", "ronda", "ufficio", "finestra", "quaderno", "esercizi", "caffe", "visita"];
  const BASE = {
    preside: [0, 0.3, 0, 0, 0.5, 0.4, 0.3, 0.6, 0.3, 0.2, 0.4, 2.0, 0.6, 0.3, 0, 0.5, 1.0],
    falco: [2.2, 1.2, 0, 0, 0.4, 0.2, 0.2, 0.3, 0.2, 0.1, 0, 0, 0, 0.4, 0.8, 0.9, 0.2],
    tartaruga: [0.8, 0.4, 0, 0, 1.4, 1.6, 0.6, 1.2, 1.0, 0.6, 0, 0, 0, 0.6, 0, 0.4, 0.1],
    spazzino: [1.8, 1.0, 0, 0, 0.5, 0.3, 0.2, 0.5, 0.4, 0.2, 0, 0, 0, 0.4, 0.6, 0.8, 0.2],
    ragioniere: [2.0, 0.8, 0, 0, 0.8, 0.4, 0.6, 0.2, 0.2, 0.1, 0, 0, 0, 0.8, 0, 0.5, 0.2],
    guardiano: [0, 0.6, 2.0, 0, 0.3, 0.2, 0.1, 0.3, 0.2, 0.1, 1.6, 0, 0, 0.3, 0.4, 0.6, 0.6],
    cronista: [0, 0.6, 0, 2.0, 0.8, 0.6, 0.6, 0.4, 0.3, 0.2, 0, 0, 0, 0.6, 0, 0.9, 1.0],
    scettico: [0, 0.4, 0, 0, 1.8, 1.0, 0.8, 0.4, 0.6, 0.3, 0, 0, 0, 0.6, 0, 0.4, 1.2],
  };
  const ACT_ROOM = { terminale: "trading", prezzi: "trading", rischio: "trading", notizie: "trading", gara: "trading", studio: "biblioteca", lettura: "biblioteca", scaffale: "biblioteca", passeggiata: "cortile", panchina: "cortile", fontana: "cortile", ronda: "portico", ufficio: "presidenza", finestra: "presidenza", esercizi: "palestra", caffe: "mensa" };
  const PACE = { riunione: 1.15, sera: 1.15, attesa: 1.1, palestra_casi: 1.1, palestra_guida: 1.05, dormire: 0.9, quaderno: 0.95, passeggiata: 0.8, ronda: 0.9, fontana: 0.9, panchina: 0.9 };
  const OWN_DESK = ["terminale", "rischio", "notizie", "ufficio"];
  const QUIET_CHAT = ["lettura", "studio", "quaderno", "panchina", "fontana", "passeggiata", "caffe", "visita"];
  const WORK = ["terminale", "prezzi", "rischio", "notizie", "ufficio", "ronda"];
  const AFF = { "preside|scettico": 1.3, "preside|tartaruga": 1.2, "spazzino|tartaruga": 1.4, "cronista|scettico": 1.4, "falco|guardiano": 1.3, "guardiano|ragioniere": 1.2, "ragioniere|spazzino": 1.1, "falco|tartaruga": 1.2, "falco|spazzino": 1.1 };
  const pairId = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const aff = (a, b) => AFF[pairId(a, b)] || 1;
  const INTEREST = {
    preside: { obiettivo: 3, voti: 2, calibrazione: 2, laurea: 2 }, falco: { portafoglio: 3, mercato: 2, gara: 2 },
    tartaruga: { mercato: 2, lezione: 2, obiettivo: 1.5 }, spazzino: { mercato: 2, portafoglio: 2, errore: 1.5 },
    ragioniere: { portafoglio: 3, rischio: 1.5 }, guardiano: { rischio: 3, allarme: 3, semaforo: 2 },
    cronista: { notizia: 3, mercato: 2 }, scettico: { calibrazione: 3, previsione: 2, errore: 2 },
  };

  // ---- numbers: the token rule of Appendix D.3, and a guard for every page-built line -------------------------
  const TOK = /[−-]?\d[\d.,]*/g;
  function nrm(tok) {
    let t = String(tok).replace(/[.,]+$/, "").replace(/^[−-]/, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    return parseFloat(t);
  }
  const decOf = (tok) => { let t = String(tok).replace(/[.,]+$/, "").replace(/^[−-]/, ""); if (t.includes(",")) return (t.split(",")[1] || "").length; if (/^\d{1,3}(\.\d{3})+$/.test(t)) return 0; return (t.split(".")[1] || "").length; };
  const toks = (s) => String(s || "").match(TOK) || [];
  const CONSTSET = new Set(CONSTANTS);
  // the allowed numbers of a text (DATI): [{v, d}]
  const allowedOf = (text) => toks(text).map((t) => ({ v: nrm(t), d: decOf(t) })).filter((x) => Number.isFinite(x.v));
  const roundTo = (v, d) => { const p = Math.pow(10, d); return Math.round(v * p) / p; };
  function numberOk(tok, allowed) {
    const v = nrm(tok);
    if (!Number.isFinite(v)) return true;
    if (CONSTSET.has(v)) return true;
    for (const a of allowed) {
      if (Math.abs(v - a.v) < 1e-9) return true;
      for (let k = 1; k <= 2 && a.d - k >= 0; k++) if (Math.abs(v - roundTo(a.v, a.d - k)) < 1e-9) return true;
    }
    return false;
  }
  const textNumbersOk = (text, allowed) => toks(text).every((t) => numberOk(t, allowed));
  // Claude's lines are checked harder: the sign counts (−, + or a loss or gain word just before the
  // number), only the DATI numbers count (no free constants), and promises or price calls are dropped
  const STOK = /[−+-]?\d[\d.,]*/g;
  const NEG_W = /(?:perd\w*|in rosso|indietro|sotto di)\s+(?:di\s+|circa\s+)?$/i, POS_W = /(?:guadagn\w*|in attivo|avanti|sopra di)\s+(?:di\s+|circa\s+)?$/i;
  const PROMISE = /garantit|guadagner|sicuro guadagno|raddoppi|triplic|ricchi|croller|crolla\b|esploder|volerà|salirà|scenderà|arriverà a|andrà a/i;
  function signedOf(text) {
    const s = String(text || ""), out = [];
    for (const m of s.matchAll(STOK)) {
      let t = m[0];
      // a hyphen right after a digit or a letter is a range or a date, not a minus
      if (t[0] === "-" && m.index > 0 && /[\p{L}\d]/u.test(s[m.index - 1])) t = t.slice(1);
      const plus = t[0] === "+", v = nrm(plus ? t.slice(1) : t);
      if (!Number.isFinite(v)) continue;
      const pre = s.slice(Math.max(0, m.index - 24), m.index);
      out.push({ v, d: decOf(plus ? t.slice(1) : t), sg: /^[−-]/.test(t) ? -1 : plus ? 1 : NEG_W.test(pre) ? -1 : POS_W.test(pre) ? 1 : 0 });
    }
    return out;
  }
  const sameMag = (x, a) => Math.abs(x.v - a.v) < 1e-9 || [1, 2].some((k) => a.d - k >= 0 && Math.abs(x.v - roundTo(a.v, a.d - k)) < 1e-9);
  const talkNumbersOk = (text, allowed) => !PROMISE.test(text) && signedOf(text).every((x) => allowed.some((a) => sameMag(x, a) && (x.sg === 0 || x.sg === (a.sg || 1))));
  const BAD = /undefined|NaN|null|\[object|—/;
  // page-built lines: every number token must have come out of a formatter in this very line
  let REG = new Set();
  const f = (s) => { for (const t of toks(s)) REG.add(nrm(t)); return s; };
  const q = (s, max = 140) => f(U.plain(s, max));
  // Italian elision before numbers read with a vowel: «l'80%», «all'1%», «dell'11%»
  const ELI = { il: "l'", al: "all'", del: "dell'", dal: "dall'", nel: "nell'" };
  const elide = (t) => String(t).replace(/\b(il|al|del|dal|nel) ((?:8\d{0,2}|11|1)(?:,\d+)?%)/g, (m, w, n) => ELI[w] + n);
  const lineOk = (text) => !!text && !BAD.test(text) && toks(text).every((t) => { const v = nrm(t); return !Number.isFinite(v) || REG.has(v) || CONSTSET.has(v); });

  // ---- state ----------------------------------------------------------------------------------------
  const L = {};
  let ctx = null, inited = false, T = 0, acc = 0, secAcc = 0, moodAcc = 99, lastSim = 0, instantMode = false, instantOnce = false;
  let R = Math.random, fid = 0, followKey = null, ownClock = false, jumpPending = false, pErr = 0, sErr = 0, lastActFocus = -1e9;
  const A = {};
  for (const k of KEYS) A[k] = { key: k, act: null, hist: [], pos: { x: 0, z: 0 }, cmd: 0, arrived: true, cmdT: 0, deadline: 0, enc: null, lock: null, cool: 0, mood: "sereno", moodLabel: "sereno", moodWhy: "", speakUntil: 0, thinkUntil: 0, nextThought: 0, lastThought: [], walkSince: 0, block: null, night: null };
  const has3d = () => !!(ctx && ctx.has3d && C.people && C.people.ready);
  const P = (fn, ...args) => {
    if (!has3d()) return null;
    try { const g = C.people[fn]; return typeof g === "function" ? g.apply(C.people, args) : null; } catch (e) { if (pErr++ < 3) console.warn("Campus life: people." + fn, e); return null; }
  };
  const W = () => C.world || null;
  const anchorOf = (id) => { const w = W(); return id && typeof id === "string" && w && w.anchor ? w.anchor(id) : null; };
  const surf = (fn, ...args) => {
    const s = W() && W().surfaces;
    if (!s || typeof s[fn] !== "function") return;
    try { s[fn](...args); } catch (e) { if (sErr++ < 3) console.warn("Campus life: surfaces." + fn, e); }
  };
  const nowText = () => U.utcText(C.clock.now());
  const rnd = (a, b) => a + (b - a) * R();
  const focus = (req) => bus.emit("life:focus", req);
  const instant = () => instantMode || instantOnce;
  function setClock(date, rate) { ownClock = true; try { C.clock.setOverride(date, rate); } finally { ownClock = false; } }

  function posOf(k) {
    if (has3d()) { const p = P("positionOf", k); if (p && isNum(p.x) && isNum(p.z)) return p; }
    return A[k].pos;
  }
  const dist = (p, q2) => Math.hypot(p.x - q2.x, p.z - q2.z);
  const roomOf = (k) => { const p = posOf(k), w = W(); return (w && w.roomAt && w.roomAt(p.x, p.z)) || (A[k].act && A[k].act.room) || null; };
  const roomName = (id) => { const w = W(); const r = w && arr(w.rooms).find((x) => x.id === id); return r ? r.name : ""; };

  // ---- the feed (§5.4.8) -------------------------------------------------------------------------------
  const feedList = [];
  // `ordered`: an older entry (the last meeting's closing lines, seeded when "ultimo" arrives) goes in
  // its place by time, so it never lands below today's live or chat lines
  function feed(e, ordered) {
    const entry = { id: "f" + ++fid, at: nowText(), who: "preside", to: null, kind: "chiacchiera", label: "", text: "", room: null, source: null, step: null, date: null, ...e };
    entry.text = U.plain(entry.text, 400);
    if (!entry.text) return null;
    let i = feedList.length;
    if (ordered) while (i > 0 && String(feedList[i - 1].at) > String(entry.at)) i--;
    feedList.splice(i, 0, entry);
    while (feedList.length > 200) feedList.shift();
    bus.emit("life:feed", { entry });
    return entry;
  }

  // ---- moving people ------------------------------------------------------------------------------------
  function move(k, to, state, opts = {}) {
    const a = A[k], an = typeof to === "string" ? anchorOf(to) : to;
    const from = posOf(k);
    if (an) a.pos = { x: an.x, z: an.z };
    a.arrived = true;
    if (!has3d() || !to) return;
    if (opts.instant || instant()) { a.cmd = 0; P("place", k, to, state); if (opts.lookAt) P("lookAt", k, opts.lookAt); return; }
    a.cmd = P("command", k, { to, state, lookAt: opts.lookAt === undefined ? null : opts.lookAt, speed: opts.speed || 1 }) || 0;
    if (!a.cmd) return;
    a.arrived = false;
    a.cmdT = T;
    a.walkSince = T;
    const d = an ? dist(from, an) : 10;
    a.deadline = T + 12 + (d * 1.8) / (SPEED[k] * (opts.speed || 1));
  }
  function place(k, to, state) {
    const an = typeof to === "string" ? anchorOf(to) : to;
    if (an) A[k].pos = { x: an.x, z: an.z };
    A[k].arrived = true;
    P("place", k, to, state);
  }
  function setState(k, s) { if (has(KEYS, k)) P("setState", k, s); }
  function lookAt(k, target) { if (has(KEYS, k)) P("lookAt", k, target); }
  function say(k, line) {
    const ms = line.ms || U.sayMs(line.text);
    if (has(KEYS, k)) A[k].speakUntil = T + ms / 1000;
    P("say", k, { ...line, ms });
  }
  function hushAll() { for (const k of [...KEYS, "motore"]) P("hush", k); for (const k of KEYS) A[k].speakUntil = 0; }
  function release(k) { const a = A[k]; if (a.act && a.act.anchor && W() && W().release) W().release(a.act.anchor, k); }
  function setAct(k, act) {
    const a = A[k];
    a.act = { since: nowText(), sinceMs: C.clock.now().getTime(), until: Infinity, ...act };
    a.hist = [act.id, ...a.hist.filter((x) => x !== act.id)].slice(0, 2);
    P("setTag", k, { act: a.act.label });
    bus.emit("life:activity", { key: k, activity: act.id, label: a.act.label, room: a.act.room, since: a.act.since });
  }
  const labelNow = (k) => { const a = A[k]; return a.enc ? a.enc.label[k] : a.act ? a.act.label : ""; };

  // ---- anchors for an activity ------------------------------------------------------------------------------
  function candidates(k, pattern) {
    const w = W();
    if (!w || !w.anchors) return [];
    const p = pattern.replace("@", k);
    if (!p.endsWith("*")) { const an = w.anchor(p); return an ? [an] : []; }
    const pre = p.slice(0, -1);
    return Object.values(w.anchors).filter((an) => an.id.startsWith(pre) && (!an.owner || an.owner === k) && (!w.occupant(an.id) || w.occupant(an.id) === k));
  }
  function pickAnchor(k, id, patterns) {
    const here = posOf(k), w = W();
    for (const pat of patterns) {
      let list = candidates(k, pat);
      if (!list.length) continue;
      if (list.length > 1) {
        const ws = list.map((an) => {
          let wt = 1 / (1 + dist(here, an) / 12);
          if (an.owner === k) wt *= 4;
          if (an.room === "mensa" && an.kind === "seat") {
            const t = an.id.split(".")[2];
            const mates = KEYS.filter((o) => o !== k && A[o].act && A[o].act.anchor && A[o].act.anchor.startsWith("mensa.seat." + t + "."));
            wt *= 1 + mates.reduce((s, o) => s + aff(k, o), 0) * 1.4;
          }
          if (id === "passeggiata" || id === "ronda") wt = 1;
          return [an, wt * (0.6 + R())];
        });
        ws.sort((x, y) => y[1] - x[1]);
        list = ws.map((x) => x[0]);
      }
      for (const an of list) if (!w || !w.reserve || w.reserve(an.id, k)) return an;
    }
    return null;
  }

  // start an activity: reserve its anchor, release the old one, command the person
  function start(k, id, o = {}) {
    const a = A[k], def = ACT[id];
    if (!def) return false;
    if (id === "visita") return startVisit(k, o.target);
    let an = o.anchor ? anchorOf(o.anchor) : null;
    if (o.anchor) {
      if (!an) return false;
      if (W() && W().reserve && !W().reserve(an.id, k, !!o.force) && (!a.act || a.act.anchor !== an.id)) return false;
    } else {
      const pats = o.patterns || def[1];
      if (pats.length) { an = pickAnchor(k, id, pats); if (!an) return false; }
    }
    if (a.act && a.act.anchor && (!an || a.act.anchor !== an.id) && W() && W().release) W().release(a.act.anchor, k);
    const st = o.state || def[2];
    const dur = def[3] ? rnd(def[3][0], def[3][1]) : Infinity;
    let loop = null;
    if ((id === "passeggiata" || id === "ronda") && an) {
      const n = +an.id.split(".").pop(), len = id === "ronda" ? 8 : 3 + Math.floor(R() * 2), room = an.room;
      loop = { ids: Array.from({ length: len }, (_, i) => `${room}.spot.${((n - 1 + i) % 8) + 1}`), i: 0, pause: 0 };
    }
    setAct(k, { id, label: o.label || def[0], anchor: an ? an.id : null, state: st, room: an ? an.room : roomOf(k), dur, fixed: !!o.fixed, interrupt: !!def[4], loop, target: null });
    if (an) move(k, an.id, st, { speed: o.speed || PACE[id] || 1, instant: o.instant });
    if (a.arrived) arrive(k);
    if (o.focus !== false && T - lastActFocus > 14 && (id === "esercizi" || id === "fontana" || id === "passeggiata" || id === "prezzi" || id === "gara" || id === "panchina")) {
      lastActFocus = T;
      focus({ keys: [k], room: an ? an.room : null, priority: 0, holdS: 6, reason: id });
    }
    return true;
  }
  function arrive(k) {
    const a = A[k], act = a.act;
    a.arrived = true;
    if (!act) return;
    if (act.until === Infinity && isNum(act.dur) && act.dur !== Infinity) act.until = T + act.dur;
    if (act.loop) act.loop.pause = T + rnd(3, 7);
  }
  function stopAct(k) { const a = A[k]; release(k); a.act = null; }

  // ---- data-driven modifiers and targets (Appendix B.1) -----------------------------------------------------
  let MODS = null;
  const WKEY = /\b(falco|tartaruga|spazzino|ragioniere)_(giudizio|regole)\b/;
  const ult = () => obj(C.data.ultimo);
  const alarms = () => { const u = ult(); return arr(u && obj(u.rischio) && u.rischio.allarmi).filter((x) => typeof x === "string" && x.trim()); };
  const alarmTarget = (s) => { const m = WKEY.exec(String(s || "")); return m ? m[1] : null; };
  function mods() {
    if (MODS && MODS.v === C.data.version) return MODS;
    const u = ult(), quadro = u && obj(u.quadro), mon = (quadro && obj(quadro.monete)) || {}, mk = (quadro && obj(quadro.mercato)) || {};
    let breakout = 0, extremes = 0;
    for (const c of Object.values(mon)) {
      if (!obj(c)) continue;
      if ((isNum(c.da_max20_pct) && Math.abs(c.da_max20_pct) < 2) || (isNum(c.da_min20_pct) && Math.abs(c.da_min20_pct) < 2)) breakout++;
      if (isNum(c.rsi2) && (c.rsi2 < 10 || c.rsi2 > 90)) extremes++;
    }
    const al = alarms();
    // the scettico seeks the most over-confident agent, else a trader whose judgment "toglie"
    let over = null, best = 0.0001;
    for (const k of KEYS) { const c = D.calibration(k); if (c && c.n >= 3 && isNum(c.eccesso_di_sicurezza) && c.eccesso_di_sicurezza > best) { best = c.eccesso_di_sicurezza; over = k; } }
    if (!over) { const g = obj(C.data.semaforo) && obj(C.data.semaforo.giudizio_contro_regola); if (g) over = TR.find((k) => obj(g[k]) && g[k].verdetto === "toglie") || null; }
    let low = null, lowD = 99;
    for (const k of GR) { const v = D.votes(k), d = v && obj(v.preside) && U.toNum(v.preside.disciplina); if (isNum(d) && d < lowD) { lowD = d; low = k; } }
    MODS = { v: C.data.version, breakout, extremes, calm: isNum(mk.sopra_media50_pct) && mk.sopra_media50_pct < 20, alarms: al.length, alarmK: al.length ? alarmTarget(al[0]) : null, over, low, lowD };
    return MODS;
  }
  function contest() { return D.contests().find((c) => c.open) || null; }
  function recentContest() {
    const c = D.contests()[0];
    if (!c) return null;
    if (c.open) return c;
    const end = c.scadenza ? c.scadenza.getTime() : 0;
    return c.doc.finita === true && C.clock.real().getTime() - end < 2 * 86400000 ? c : null;
  }
  // place: equal results share it (tied says so)
  function ranking(c) {
    const cl = (c && obj(c.situazione) && obj(c.situazione.classifica)) || {};
    const ks = KEYS.filter((k) => obj(cl[k]) && isNum(cl[k].risultato)).sort((x, y) => cl[y].risultato - cl[x].risultato || KEYS.indexOf(x) - KEYS.indexOf(y));
    return ks.map((k) => ({ k, ...cl[k], place: ks.filter((x) => cl[x].risultato > cl[k].risultato).length, tied: ks.some((x) => x !== k && cl[x].risultato === cl[k].risultato) }));
  }
  const placeTxt = (x) => rankWord(x.k, x.place) + (x.tied ? " a pari merito" : "");
  const contestName = (id) => { const m = /^notte-(\d{4}-\d{2}-\d{2})$/.exec(String(id)); return m ? "della notte del " + f(U.dm(m[1])) : q(String(id), 40); };
  const awake = (k) => A[k].act && A[k].act.id !== "dormire";
  const free = (k) => !A[k].lock && !A[k].enc;
  const inDorm = (k) => { const r = roomOf(k); return !r || r.startsWith("dorm_"); };

  // ---- the free choice of an activity (§5.4.4) ---------------------------------------------------------------
  function visitTarget(k) {
    const M = mods(), ok = (t) => t && t !== k && awake(t) && free(t) && !inDorm(t) && A[t].act && A[t].act.id !== "visita";
    if (k === "scettico") return ok(M.over) ? M.over : null;
    if (k === "guardiano") return ok(M.alarmK) ? M.alarmK : null;
    if (k === "preside") return ok(M.low) ? M.low : null;
    const pool = KEYS.filter(ok);
    if (!pool.length) return null;
    return U.weighted(R, pool.map((t) => [t, aff(k, t)]));
  }
  function choose(k) {
    const r = U.rome(), blk = blockOf(k, r), M = mods(), row = BASE[k], w = D.wallet(k), open = contest();
    const pairs = [];
    const here = (o) => o !== k && !A[o].pending && A[o].act && A[o].act.id !== "dormire" && A[o].act.room;
    const used = new Set(KEYS.filter(here).map((o) => A[o].act.room));
    let target = null;
    COLS.forEach((id, i) => {
      let wt = row[i];
      if (!wt) return;
      if (id === "terminale" && w && w.positions > 0) wt *= 2;
      if (k === "falco" && (id === "terminale" || id === "prezzi")) wt *= Math.min(2, 1 + 0.25 * M.breakout);
      if (k === "spazzino" && id === "terminale") wt *= Math.min(3, 1 + 0.2 * M.extremes);
      if (k === "ragioniere" && id === "terminale" && r.weekday === 1) wt *= 2;
      if (k === "tartaruga" && M.calm && (id === "lettura" || id === "passeggiata")) wt *= 1.3;
      if (k === "guardiano") { if (M.alarms > 0 && id === "rischio") wt *= 3; if (M.alarms > 0 && id === "visita") wt *= 2; if (!M.alarms && id === "ronda") wt *= 1.5; }
      if (k === "cronista" && id === "notizie" && r.minutes < 600) wt *= 2;
      if (id === "visita") {
        target = visitTarget(k);
        if (!target) return;
        if (k === "scettico" || (k === "preside" && M.lowD <= 6)) wt *= 1.5;
      }
      if (blk === "serata" || blk === "controllo") wt *= has(QUIET_CHAT, id) ? 1.5 : has(WORK, id) ? 0.3 : 1;
      // the last half hour before bed: back to their own room, to write the day in the notebook
      if (blk === "serata" && r.minutes >= times(k, r.date).bed - 30) wt *= id === "quaderno" ? 4 : 0.6;
      if (has(A[k].hist, id)) wt *= 0.4;
      // a busy room is a little less tempting, an empty one a little more: the campus stays spread out
      const room = ACT_ROOM[id];
      if (room) {
        const n = KEYS.filter((o) => here(o) && A[o].act.room === room).length;
        wt *= OWN_DESK.includes(id) ? 1 / (1 + 0.3 * n) : n === 0 ? 1.5 : 1 / (1 + 0.6 * n);
        if (used.size < 4 && !used.has(room)) wt *= 4;
      }
      pairs.push([id, wt * (0.7 + 0.6 * R())]);
    });
    if (open && has(TR, k)) pairs.push(["gara", 0.4 * 1.5 * (has(A[k].hist, "gara") ? 0.4 : 1) * (0.7 + 0.6 * R())]);
    for (let n = 0; n < 6 && pairs.length; n++) {
      const id = U.weighted(R, pairs);
      if (!id) break;
      if (start(k, id, { target })) return true;
      pairs.splice(pairs.findIndex((p) => p[0] === id), 1);
    }
    return start(k, "passeggiata") || start(k, "quaderno");
  }

  // ---- visits: the seeker walks to the target and starts an encounter -------------------------------------------
  function startVisit(k, target) {
    if (!target || !A[target]) return false;
    release(k);
    setAct(k, { id: "visita", label: "va a trovare " + the(target), anchor: null, state: "idle", room: roomOf(target), dur: Infinity, fixed: false, interrupt: true, loop: null, target, wait: 0, goal: null, give: T + 120 });
    visitStep(k);
    return true;
  }
  function visitStep(k) {
    const a = A[k], act = a.act, t = act.target;
    if (!awake(t) || A[t].lock || inDorm(t) || T > act.give) { stopAct(k); return; }
    const tp = posOf(t), me = posOf(k);
    if (dist(tp, me) <= 1.6 || (!has3d() && roomOf(t) === roomOf(k))) {
      if (!act.wait) { act.wait = T + 30; P("stop", k); lookAt(k, t); setState(k, "idle"); a.arrived = true; }
      if (interruptible(t) && !A[t].enc && encs.length < 2) { if (startEncounter(k, t, visitTopics(k, t))) return; }
      if (T > act.wait) stopAct(k);
      return;
    }
    if (!has3d()) { a.pos = { x: tp.x, z: tp.z }; act.room = roomOf(t); return; }
    if ((!act.goal || dist(act.goal, tp) > 1.2 || (a.arrived && dist(me, tp) > 1.6)) && T >= (act.retry || 0)) {
      act.retry = T + 3;
      act.goal = { x: tp.x, z: tp.z };
      const pt = frontPoint(t, me);
      move(k, pt, "idle", { lookAt: t });
    }
  }
  function visitTopics(k, t) {
    if (k === "scettico") return ["calibrazione", "previsione", "errore", "voti"];
    if (k === "guardiano") return ["allarme", "rischio", "semaforo"];
    if (k === "preside") return ["voti", "calibrazione", "obiettivo", "lezione"];
    if (k === "cronista") return ["intervista"];
    return null;
  }
  // a point 1.1 m from the fixed agent, on the side of the mover, on a walkable floor
  function frontPoint(fixed, moverPos) {
    const w = W(), fp = posOf(fixed), an = A[fixed].act && A[fixed].arrived ? anchorOf(A[fixed].act.anchor) : null;
    let base = fp;
    if (an && an.posture !== "stand" && isNum(an.ax)) {
      const dx = an.ax - an.x, dz = an.az - an.z, d = Math.hypot(dx, dz) || 1;
      base = { x: an.ax + (dx / d) * 0.55, z: an.az + (dz / d) * 0.55 };
      if (!w || !w.roomAt || w.roomAt(base.x, base.z)) return { x: base.x, z: base.z, face: Math.atan2(fp.x - base.x, fp.z - base.z) };
      base = { x: an.ax, z: an.az };
    }
    const ang0 = Math.atan2(moverPos.x - fp.x, moverPos.z - fp.z);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, PI]) {
      const ang = ang0 + off, p = { x: fp.x + Math.sin(ang) * 1.1, z: fp.z + Math.cos(ang) * 1.1 };
      if (w && w.roomAt && !w.roomAt(p.x, p.z)) continue;
      if (w && w.clear && !w.clear(fp, p)) continue;
      return { x: p.x, z: p.z, face: Math.atan2(fp.x - p.x, fp.z - p.z) };
    }
    return { x: base.x, z: base.z, face: Math.atan2(fp.x - base.x, fp.z - base.z) };
  }

  // ---- the chiacchiera: topics, templates and lines built only from the data (Appendix E) ------------------------------
  const pick = (list) => list[Math.floor(R() * list.length) % Math.max(1, list.length)];
  const lastOf = (xs) => (xs.length ? xs[xs.length - 1] : null);
  const mem = (k) => obj(C.data.memoria[k]);
  const sgnWord = (v, plus, minus) => (v >= 0 ? plus : minus);
  const rankWord = (k, i) => (fem(k) ? ["prima", "seconda", "terza", "quarta", "quinta"] : ["primo", "secondo", "terzo", "quarto", "quinto"])[i] || "";
  function errorOf(k) { const m = mem(k); const e = arr(m && m.errori).filter((x) => obj(x) && x.testo && isNum(U.toNum(x.volte)) && U.toNum(x.volte) >= 2); return e.length ? e.reduce((p, x) => (U.toNum(x.volte) > U.toNum(p.volte) ? x : p)) : null; }
  function gymOf(k) { const m = mem(k), s = arr(m && obj(m.palestra) && m.palestra.sessioni).filter(obj); return lastOf(s); }
  function semOf(k) { const s = obj(C.data.semaforo), p = s && obj(s.portafogli); return p && obj(p[k + "_giudizio"]) && p[k + "_giudizio"].colore ? p[k + "_giudizio"] : null; }
  function marketOf() { const u = ult(), m = u && obj(u.quadro) && obj(u.quadro.mercato), mb = m && obj(m.btc), px = D.prices().BTC; return isNum(px) && mb ? { px, mb, btc: obj(u.quadro.monete) && obj(u.quadro.monete.BTC) } : null; }
  function newsOf() { const u = ult(), n = u && obj(u.briefing) && arr(u.briefing.notizie).filter((x) => obj(x) && x.testo)[0]; return n || null; }
  function fundOf() { const r = ult() && obj(ult().rischio) && obj(ult().rischio.fondo); return r && isNum(r.netta_beta_pct) ? r : null; }
  function myContest(k) { const c = recentContest(); if (!c) return null; const rk = ranking(c); const i = rk.findIndex((x) => x.k === k); return i < 0 ? null : { c, rk, i, me: rk[i] }; }
  const posTxt = (k) => {
    const g = obj(C.data.giudizio), w = g && obj(g.wallets) && obj(g.wallets[k]);
    return arr(w && w.positions).filter((p) => obj(p) && p.symbol).map((p) => `${p.symbol} ${p.side || ""}`.trim());
  };

  // each topic: can(opener, other) → data or null; open[] and reply[] → (c) => text | null; persona lines win when present
  const CLOSE = {
    preside: ["Portalo alla riunione di domani.", "Bene. Scrivilo nel quaderno.", "Ricorda: si vince in squadra."],
    falco: ["Regola, rischio, stop. Il resto è rumore.", "Torno al terminale.", "Poche parole: lo scrivo."],
    tartaruga: ["Piano piano. Ci vediamo dopo.", "Vado a rileggere il quaderno.", "Senza fretta, come sempre."],
    spazzino: ["Io aspetto chi è costretto a vendere.", "Mai il coltello che cade.", "Torno a guardare i ribassi."],
    ragioniere: ["Lo annoto. I conti si chiudono stasera.", "Prezzo, funding e costi: separati.", "Chi mi paga, e perché? Ci penso."],
    guardiano: ["Ricorda: lo stop si scrive prima.", "Io intanto controllo il rischio.", "Speriamo di non sentirci stanotte."],
    cronista: ["Lo segno nel taccuino, con l'ora.", "Prima il fatto, poi l'opinione.", "Ottimo: è un fatto, non un'opinione."],
    scettico: ["Allora portami un numero, domani.", "Vedremo se regge con costi doppi.", "Una prova, non un'opinione."],
  };
  const BYE = ["A dopo.", "Ci vediamo alla riunione.", "Torno al lavoro.", "D'accordo. A più tardi."];
  const alarmTxt = (s, max) => { const t = U.plain(U.human(s), max), m = /^([A-ZÀ-Ü]{3,}):\s*(.*)$/s.exec(t); return f(m ? `${m[1]}: ${m[2]}` : t); };
  const calSide = (c) => { const e = c.cal && c.cal.eccesso_di_sicurezza; return !isNum(e) ? 0 : e > 0.05 ? 1 : e < -0.05 ? -1 : 0; };
  const TOPIC = {
    saluto: {
      label: null,
      can: () => ({}),
      open: {
        _: [(c) => c.hour < 12 ? `Buongiorno, ${nm(c.b)}.` : c.hour >= 18 ? `Buonasera, ${nm(c.b)}.` : `Ciao, ${nm(c.b)}. Come va il lavoro?`, (c) => `${nm(c.b)}, hai un minuto?`, (c) => `Ehi, ${nm(c.b)}: che si dice oggi?`],
        preside: [(c) => `${nm(c.b)}, come procede il lavoro?`], falco: [(c) => `${nm(c.b)}. Tutto in ordine?`], tartaruga: [(c) => `Ciao, ${nm(c.b)}. Piano piano, come sempre?`],
        spazzino: [(c) => `${nm(c.b)}. Tutto tranquillo, o qualcuno vende per forza?`], ragioniere: [(c) => `${nm(c.b)}, tutto in ordine con i conti?`], guardiano: [(c) => `${nm(c.b)}, tutto sotto controllo?`],
        cronista: [(c) => `${nm(c.b)}, novità per il mio taccuino?`], scettico: [(c) => `${nm(c.b)}, oggi mi porti una prova o solo opinioni?`],
      },
      reply: {
        _: [() => "Bene, grazie. Ho appena riletto il quaderno.", () => "Tutto in ordine. Ci vediamo alla riunione.", () => "Si lavora. Il fondo comune è di tutti."],
        preside: [() => "Bene. Prima il ragionamento, poi la disciplina."], falco: [() => "Regola, rischio, stop. Tutto in ordine."], tartaruga: [() => "Piano, ma avanti. Ho riletto il quaderno."],
        spazzino: [() => "Aspetto chi è costretto a vendere. Il resto è rumore."], ragioniere: [() => "I conti si fanno a fine giornata, non prima."], guardiano: [() => "Per ora sì. Chiedimelo stanotte."],
        cronista: [() => "Prima il fatto, poi l'opinione. Ti dico appena ho la fonte."], scettico: [() => "Dipende: quale prova hai?"],
      },
    },
    portafoglio: {
      label: "Il portafoglio",
      can: (a) => { const w = D.wallet(a); return w && isNum(w.gap) && isNum(w.judg) && isNum(w.rules) ? { w } : null; },
      open: {
        _: [(c) => `A giudizio sono a ${f(U.fmt(c.w.judg, 2))} USDT, la mia regola a ${f(U.fmt(c.w.rules, 2))}: ${sgnWord(c.w.gap, "aggiungo", "tolgo")} ${f(U.fmt(Math.abs(c.w.gap), 2))} USDT.`,
          (c) => isNum(c.w.pnlPct) ? `Dall'inizio sono a ${f(U.pct(c.w.pnlPct))} a giudizio. La regola sta a ${f(U.fmt(c.w.rules, 2))} USDT.` : null,
          (c) => `Il mio giudizio contro la regola: ${f(U.fmt(c.w.gap, 2, true))} USDT.`],
        falco: [(c) => `Il mio giudizio fa ${f(U.fmt(c.w.gap, 2, true))} USDT sulla regola. Ma quanto è solo BTC che scende?`],
        tartaruga: [(c) => `La mia regola è a ${f(U.fmt(c.w.rules, 2))}. Io a giudizio ${f(U.fmt(c.w.judg, 2))}: niente fretta.`],
        spazzino: [(c) => c.w.gap < 0 ? `Il mio giudizio perde ${f(U.fmt(-c.w.gap, 2))} USDT contro la regola. La cosa onesta è seguirla.` : `Il mio giudizio batte la regola di ${f(U.fmt(c.w.gap, 2))} USDT. Ma chi ha venduto, e perché?`],
        ragioniere: [(c) => `Conti alla mano: giudizio ${f(U.fmt(c.w.judg, 2))}, regola ${f(U.fmt(c.w.rules, 2))}, differenza ${f(U.fmt(c.w.gap, 2, true))} USDT.`],
      },
      reply: {
        _: [(c) => { const w = D.wallet(c.b); return w && isNum(w.judg) && isNum(w.rules) ? `Io a giudizio sono a ${f(U.fmt(w.judg, 2))} USDT, la regola a ${f(U.fmt(w.rules, 2))}.` : null; },
          () => "Il giudizio deve battere la regola per settimane, non per un giorno.", () => "Conta il fondo comune: il tuo e il mio insieme."],
        tartaruga: [(c) => { const w = D.wallet(c.b); return w && isNum(w.rules) ? `Io resto lenta: la mia regola è a ${f(U.fmt(w.rules, 2))}.` : null; }],
        scettico: [(c) => `${f(U.fmt(Math.abs(c.w.gap), 2))} USDT? Quante varianti hai provato prima di crederci?`, () => "Regge con costi doppi?"],
        preside: [() => "E il ragionamento? Il risultato viene per ultimo.", () => "Chi paga, e perché?"],
        guardiano: [() => "Bene. Ma quanto rischi stanotte, se va tutto contro?"], ragioniere: [() => "Separa il prezzo dai costi, prima di festeggiare."],
        cronista: [(c) => `Lo scrivo come fatto: ${f(U.fmt(c.w.gap, 2, true))} USDT, dai conti del motore.`], falco: [() => "Dov'è lo stop? Il resto viene dopo."],
      },
    },
    previsione: {
      label: "La previsione",
      can: (a) => { const p = D.openPrediction(a); return p && p.mercato && p.direzione && isNum(U.toNum(p.livello)) && isNum(U.toNum(p.probabilita)) ? { p } : null; },
      open: {
        _: [(c) => `Ho in registro ${f(U.predText(c.p))}.`, (c) => `La mia previsione aperta: ${c.p.mercato} ${c.p.direzione} ${f(U.level(c.p.livello))}, al ${f(U.prob(c.p.probabilita))}.`,
          (c) => c.p.scadenza ? `Il motore verifica la mia previsione il ${f(U.dm(c.p.scadenza))}: ${c.p.mercato} ${c.p.direzione} ${f(U.level(c.p.livello))}.` : null],
        falco: [(c) => `Ho detto ${f(U.predText(c.p))}. Se sbaglio, lo vedrà il motore.`],
        cronista: [(c) => `Previsione, non fatto: ${f(U.predText(c.p))}.`],
      },
      reply: {
        _: [(c) => `Vedremo${c.p.scadenza ? " il " + f(U.dm(c.p.scadenza)) : ""}: decidono i numeri.`, () => "La segno anch'io nel registro.",
          (c) => { const p = D.openPrediction(c.b); return p && p.mercato && isNum(U.toNum(p.livello)) ? `Io ho detto ${f(U.predText(p))}.` : null; }],
        scettico: [(c) => `Al ${f(U.prob(c.p.probabilita))}? Quale prova?`, () => "Quale numero ti farebbe cambiare idea?"],
        preside: [() => "Cosa ti farebbe cambiare idea?"], guardiano: [() => "E se va contro, quanto costa al fondo?"], tartaruga: [() => "Una previsione è una scommessa. Io guardo il trend."],
      },
    },
    calibrazione: {
      label: "La calibrazione",
      can: (a, b) => { if (a !== "scettico" && a !== "preside") return null; const c = D.calibration(b); return c && c.n >= 3 && isNum(c.sicurezza_media) && isNum(c.successi) ? { cal: c } : null; },
      open: {
        _: [(c) => `${nm(c.b)}, dici in media il ${f(U.prob(c.cal.sicurezza_media))} e ci prendi il ${f(U.prob(c.cal.successi))}.`],
        scettico: [(c) => isNum(c.cal.brier) ? `${nm(c.b)}, ${f(String(c.cal.n))} previsioni verificate, Brier ${f(U.fmt(c.cal.brier, 3))}. Quale numero mi convince?` : null,
          (c) => isNum(c.cal.eccesso_di_sicurezza) && c.cal.eccesso_di_sicurezza > 0 ? `${nm(c.b)}, sei troppo sicur${gx(c.b, "o", "a")} di ${f(String(Math.round(c.cal.eccesso_di_sicurezza * 100)))} punti: dici il ${f(U.prob(c.cal.sicurezza_media))}, ci prendi il ${f(U.prob(c.cal.successi))}.` : null],
        preside: [(c) => isNum(c.cal.brier) ? `${nm(c.b)}, la tua calibrazione: Brier ${f(U.fmt(c.cal.brier, 3))} su ${f(String(c.cal.n))} previsioni.` : null],
      },
      reply: {
        _: [(c) => calSide(c) > 0 ? "Lo so: abbasso le probabilità." : calSide(c) < 0 ? "Allora sono troppo prudente: posso alzarle un po'." : "Bene: le probabilità tornano.",
          (c) => calSide(c) > 0 ? "Hai ragione: dove mi sento sicuro, esagero." : calSide(c) < 0 ? "Meglio prudente che troppo sicuro. Ma lo correggo." : "Lo tengo così, allora.",
          () => "Lo scrivo nel quaderno, accanto alle previsioni."],
        falco: [(c) => calSide(c) > 0 ? "Lo so. Meno sicurezza, stessi stop." : "Stessi stop, stesse regole. Il resto lo dice il motore."],
        tartaruga: [(c) => calSide(c) > 0 ? "Sono lenta anche a correggermi, ma lo faccio." : "Piano: i numeri dicono che va bene così."],
        spazzino: [(c) => calSide(c) > 0 ? "Giusto. Non ogni ribasso è una vendita forzata." : "Allora la paura degli altri la leggo bene."],
        ragioniere: [() => "Corretto: rifaccio i conti delle mie probabilità."], guardiano: [() => "Meglio scoprirlo qui che con i soldi del fondo."],
      },
    },
    errore: {
      label: "L'errore che torna",
      can: (a) => { const e = errorOf(a); return e ? { e } : null; },
      open: {
        _: [(c) => `Il mio errore che torna: «${q(c.e.testo, 120)}», già ${f(String(U.toNum(c.e.volte)))} volte.`, (c) => `Lo rifaccio ancora: «${q(c.e.testo, 120)}». ${f(String(U.toNum(c.e.volte)))} volte, ormai.`,
          (c) => `Devo dirtelo: il mio errore «${q(c.e.testo, 120)}» è tornato.`],
        preside: [(c) => `Anch'io sbaglio: «${q(c.e.testo, 120)}», ${f(String(U.toNum(c.e.volte)))} volte.`],
      },
      reply: {
        _: [() => "Almeno l'hai scritto: è il primo passo.", () => "Un errore scritto si può correggere.", () => "Trasformalo in una regola, allora."],
        scettico: [(c) => `${f(String(U.toNum(c.e.volte)))} volte non è un caso. Cosa cambi domani?`], preside: [() => "Scrivilo come regola, non come scusa."], tartaruga: [() => "Piano: un errore alla volta."],
      },
    },
    lezione: {
      label: "La lezione",
      can: (a) => { const l = D.lesson(a); return l ? { l } : null; },
      open: {
        _: [(c) => `Ho scritto nel quaderno: «${q(c.l.testo, 130)}»`, (c) => c.l.data ? `La mia ultima lezione, del ${f(U.dm(c.l.data))}: «${q(c.l.testo, 120)}»` : null, (c) => `Oggi ho imparato questo: «${q(c.l.testo, 130)}»`],
      },
      reply: {
        _: [() => "Me la segno anch'io.", () => "Giusto. Si impara in squadra.", () => "Questa vale per tutti e otto."],
        preside: [() => "Bene: portala alla riunione, serve a tutti."], scettico: [() => "E quale numero la prova?"], cronista: [() => "La cito nel briefing, con la data."],
      },
    },
    mercato: {
      label: "Il mercato",
      can: (a) => (has(["falco", "spazzino", "tartaruga", "cronista"], a) ? marketOf() : null),
      open: {
        _: [(c) => isNum(c.mb.da_media200_pct) ? `BTC è a ${f(U.price(c.px))}, ${f(U.pct(c.mb.da_media200_pct))} dalla media a 200 giorni.` : `BTC è a ${f(U.price(c.px))}.`,
          (c) => isNum(c.mb.vol20_annua_pct) ? `BTC a ${f(U.price(c.px))}, volatilità a 20 giorni ${f(U.pct(c.mb.vol20_annua_pct, 1, false))} l'anno.` : null,
          (c) => isNum(c.mb.da_media50_pct) ? `BTC sta ${f(U.pct(c.mb.da_media50_pct))} dalla media a 50 giorni.` : null],
        tartaruga: [(c) => isNum(c.mb.da_media50_pct) ? `BTC è ${f(U.pct(c.mb.da_media50_pct))} dalla media a 50 giorni: il trend lento è ${c.mb.da_media50_pct < 0 ? "ancora giù" : "su"}.` : null],
        falco: [(c) => c.btc && isNum(c.btc.da_max20_pct) ? `BTC a ${f(U.price(c.px))}, ${f(U.pct(c.btc.da_max20_pct))} dal massimo a 20 giorni. Aspetto la rottura giusta.` : null],
        spazzino: [(c) => c.btc && isNum(c.btc.rsi2) ? `BTC a ${f(U.price(c.px))}, RSI a 2 periodi a ${f(U.small(c.btc.rsi2))}: ${c.btc.rsi2 < 10 ? "qui qualcuno è costretto a vendere" : c.btc.rsi2 > 90 ? "troppo caldo, aspetto" : "niente di forzato"}.` : null],
        cronista: [(c) => { const at = obj(C.data.giudizio) && C.data.giudizio.prices_at; return at ? `Fatto: BTC a ${f(U.price(c.px))} USDT, prezzi di BingX delle ${f(U.romeClock(U.utc(at)))}.` : null; }],
      },
      reply: {
        _: [() => "Un prezzo da solo non dice niente: rispetto a cosa?", () => "Lo guardo, ma decide la regola.", () => "Bene. E cosa cambia per il fondo?"],
        falco: [() => "La regola dice di entrare? Se no, sto fermo."], tartaruga: [() => "Un giorno non cambia un trend di settimane."], spazzino: [() => "Mai il coltello che cade."],
        guardiano: [() => "E se scende ancora stanotte, tutti insieme?"], scettico: [() => "Rispetto a cosa? Dammi il confronto."], ragioniere: [() => "Il prezzo è una cosa, il funding un'altra."],
        preside: [() => "Come lo sai, e da che fonte?"], cronista: [() => "Lo scrivo con la fonte: BingX, con l'ora."],
      },
    },
    rischio: {
      label: "Il rischio",
      can: (a) => (a === "guardiano" ? (fundOf() ? { F: fundOf() } : null) : null),
      open: {
        _: [(c) => `Il fondo è esposto ${f(U.pct(c.F.netta_beta_pct, 1))} netto su BTC, pesato per il beta.`,
          (c) => isNum(c.F.lorda_pct) ? `Esposizione lorda del fondo: ${f(U.pct(c.F.lorda_pct, 1, false))}. Netta, pesata per il beta: ${f(U.pct(c.F.netta_beta_pct, 1))}.` : null,
          (c) => `Cosa succede se tutto va contro di noi insieme, stanotte? Il fondo è a ${f(U.pct(c.F.netta_beta_pct, 1))} netto su BTC.`],
      },
      reply: {
        _: [() => "Lo terrò a mente prima del prossimo ordine.", () => "Il rischio si scrive prima, non dopo.", () => "Allora niente ordini di fretta."],
        ragioniere: [() => "Netto vuol dire che i lati si compensano. I costi no."], falco: [() => "Il mio rischio è allo stop. Lo so in R."], scettico: [() => "Netto rispetto a quale scenario?"],
      },
    },
    allarme: {
      label: "L'allarme",
      can: (a, b) => { if (a !== "guardiano") return null; const al = alarms(); const x = al.find((s) => alarmTarget(s) === b); return x ? { al: x, n: al.length } : null; },
      open: {
        _: [(c) => `${nm(c.b)}, c'è un allarme ${alarmTxt(c.al, 150)}`, (c) => `${nm(c.b)}, il mio allarme di oggi riguarda te: ${alarmTxt(c.al, 140)}`, (c) => `${nm(c.b)}, leggi qui, allarme ${alarmTxt(c.al, 130)} È un allarme, non un divieto.`],
      },
      reply: {
        _: [() => "Lo vedo. Ne parliamo alla riunione.", () => "Ricevuto. Lo scrivo nel quaderno.", () => "Hai ragione a segnalarlo."],
        falco: [(c) => { const w = D.wallet("falco"); return w && w.positions ? `Lo so: ho ${f(String(w.positions))} posizioni aperte. Riduco se la regola lo chiede.` : null; }],
      },
    },
    semaforo: {
      label: "Il semaforo",
      can: (a, b) => { const k = has(TR, a) ? a : a === "guardiano" && has(TR, b) ? b : null; const s = k && semOf(k); return s ? { k, s } : null; },
      open: {
        _: [(c) => isNum(c.s.giorni) ? `${c.k === c.a ? "Il mio semaforo" : nm(c.b) + ", il tuo semaforo"} è ${c.s.colore}: ${f(String(c.s.giorni))} giorni su 180.` : null,
          (c) => isNum(c.s.operazioni) ? `${c.k === c.a ? "Il mio portafoglio a giudizio" : nm(c.b) + ", il tuo portafoglio a giudizio"} ha il semaforo ${c.s.colore}, con ${f(String(c.s.operazioni))} operazioni su 100.` : null,
          (c) => c.s.colore === "grigio" ? `${c.k === c.a ? "Semaforo grigio per me" : "Semaforo grigio per te, " + nm(c.b)}: è ancora presto, servono 180 giorni.` : `${c.k === c.a ? "Il mio semaforo" : "Il tuo semaforo"} è ${c.s.colore}.`],
      },
      reply: {
        _: [(c) => c.s.colore === "grigio" ? "Grigio vuol dire troppo presto, non male." : "Il colore conta più di un giorno buono.", () => "Ci vogliono 365 giorni di verde per una prova vera.", () => "Il verde si guadagna piano."],
        scettico: [(c) => isNum(c.s.operazioni) ? `Con ${f(String(c.s.operazioni))} operazioni non si giudica niente.` : null],
      },
    },
    gara: {
      label: "La gara",
      can: (a) => (has(TR, a) ? myContest(a) : null),
      open: {
        _: [(c) => c.c.opening ? `All'apertura della gara contano solo i costi: io parto da ${f(U.fmt(c.me.risultato, 2, true))} USDT.` : c.c.open ? `Nella gara sono ${placeTxt(c.me)} su ${f(String(c.rk.length))}, con ${f(U.fmt(c.me.risultato, 2, true))} USDT.` : c.c.doc.finita ? `La gara ${contestName(c.c.id)} è finita: ho chiuso con ${f(U.fmt(c.me.risultato, 2, true))} USDT.` : null,
          (c) => { const st = obj(c.c.doc.stato), w = st && obj(st.wallets) && obj(st.wallets[c.a]), p = w && (arr(w.positions)[0] || arr(w.closed)[0]); return obj(p) && p.symbol ? `In gara ho ${p.symbol} ${p.side || ""}: ${f(U.fmt(c.me.risultato, 2, true))} USDT${c.c.opening ? " all'apertura, solo i costi" : c.c.open ? " per ora" : ""}.` : null; },
          (c) => c.c.open && !c.c.opening && c.me.place > 0 ? `In gara ${the(c.rk[0].k)} è davanti, con ${f(U.fmt(c.rk[0].risultato, 2, true))} USDT. Io ${f(U.fmt(c.me.risultato, 2, true))}.` : null],
        falco: [(c) => isNum(c.c.leva) ? `Gara a leva ${f(String(c.c.leva))}: ${c.c.opening ? "i conti veri arrivano alla chiusura" : "sono " + placeTxt(c.me)}. Con quella leva lo stop è tutto.` : null],
      },
      reply: {
        _: [(c) => { const m = myContest(c.b); return !m ? null : m.c.opening ? `Io parto da ${f(U.fmt(m.me.risultato, 2, true))} USDT: per ora contano solo i costi.` : `Io sono ${placeTxt(m.me)}, con ${f(U.fmt(m.me.risultato, 2, true))} USDT.`; }, () => "Una gara è un esercizio: conta il fondo comune.", () => "Vediamo i conti del Preside, alla fine."],
        preside: [() => "Una gara è un esercizio, non lo scopo: conta il fondo comune."], guardiano: [(c) => isNum(c.c.leva) ? `Con leva ${f(String(c.c.leva))}, guarda la liquidazione prima del target.` : null],
      },
    },
    obiettivo: {
      label: "L'obiettivo comune",
      can: () => { const F = D.fund(); return F && isNum(F.capitale) ? { F } : null; },
      open: {
        _: [(c) => `Il fondo comune è a ${f(U.pct(c.F.pct))} dall'inizio. Conta quello, non il singolo.`, (c) => `Diviso tra tutti e 8, il fondo fa ${f(U.fmt(c.F.quota, 2))} USDT a testa.`,
          (c) => `Il fondo comune è a ${f(U.fmt(c.F.capitale, 2))} USDT su 80.000. Si vince in squadra.`],
        preside: [(c) => `Il fondo comune è a ${f(U.fmt(c.F.capitale, 2))} USDT su 80.000: si vince in squadra.`],
      },
      reply: {
        _: [() => "D'accordo: tutto si divide tra tutti.", () => "Allora porto il mio errore alla riunione: serve a tutti.", () => "In squadra. Anche quando perdo io."],
        scettico: [(c) => `E quanto di quel ${f(U.pct(c.F.pct))} viene dal caso?`], guardiano: [() => "Il fondo si difende prima di tutto: niente salti in una notte."],
      },
    },
    laurea: {
      label: "La laurea",
      can: () => { const g = D.graduation(); return obj(C.data.programma) && g && isNum(g.days) && g.days > 0 ? { g } : null; },
      open: {
        _: [(c) => `Mancano ${f(String(c.g.days))} giorni alla laurea: la tesi la scegliamo insieme.`, (c) => `${f(String(c.g.days))} giorni al 21 febbraio. Hai già un'idea per la tesi?`,
          (c) => obj(c.g.tesi) && c.g.tesi.nome ? `La tesi della classe è «${q(c.g.tesi.nome, 80)}».` : `Tra ${f(String(c.g.days))} giorni la tesi: una tecnica sola, con le prove migliori.`],
        preside: [(c) => `Tra ${f(String(c.g.days))} giorni la tesi: una tecnica sola, quella con le prove migliori.`],
      },
      reply: {
        _: [() => "Una tecnica sola, con le prove migliori.", () => "Quella che il semaforo dice verde, se arriva.", () => "La sceglieremo insieme, con i numeri."],
        tartaruga: [() => "La più semplice che funziona, magari."], scettico: [() => "Quella che regge con costi doppi."], falco: [() => "Quella con lo stop scritto prima."],
        ragioniere: [() => "Quella che paga dopo i costi."], spazzino: [() => "Quella che compra la paura degli altri."], guardiano: [() => "Quella che non ci fa saltare in una notte."], cronista: [() => "Quella che regge alle notizie."],
      },
    },
    voti: {
      label: "I voti",
      can: (a) => { if (!has(GR, a)) return null; const v = D.votes(a), p = v && obj(v.preside); return p && isNum(U.toNum(p.ragionamento)) && isNum(U.toNum(p.disciplina)) ? { v, p, s: obj(v.auto) } : null; },
      open: {
        _: [(c) => c.s && isNum(U.toNum(c.s.ragionamento)) && isNum(U.toNum(c.s.disciplina)) ? `Il Preside mi ha dato ${f(U.small(c.p.ragionamento))} e ${f(U.small(c.p.disciplina))}; io mi ero dato ${f(U.small(c.s.ragionamento))} e ${f(U.small(c.s.disciplina))}.` : null,
          (c) => `Ultimi voti: ragionamento ${f(U.small(c.p.ragionamento))}, disciplina ${f(U.small(c.p.disciplina))}.`,
          (c) => c.s && isNum(U.toNum(c.s.disciplina)) ? `Mi sono dato ${f(U.small(c.s.disciplina))} in disciplina, il Preside ${f(U.small(c.p.disciplina))}.` : null],
      },
      reply: {
        _: [() => "Il prossimo lo alzi con i numeri.", () => "Severo ma giusto.", () => "Conta il ragionamento, più del risultato."],
        preside: [() => "Il voto premia il ragionamento, non il risultato."], scettico: [() => "E il tuo voto quale prova ha?"],
      },
    },
    palestra: {
      label: "La palestra",
      can: (a) => { if (!has(TR, a)) return null; const s = gymOf(a); return s && (isNum(s.brier) || isNum(s.r_totale)) ? { s } : null; },
      open: {
        _: [(c) => isNum(c.s.brier) && isNum(c.s.r_totale) ? `In palestra ho fatto Brier ${f(U.fmt(c.s.brier, 3))} e ${f(U.fmt(c.s.r_totale, 1, true))} R.` : null,
          (c) => isNum(c.s.giuste_pct) ? `In palestra ci ho preso il ${f(U.small(c.s.giuste_pct))}% delle volte.` : null,
          (c) => isNum(c.s.r_totale) && isNum(c.s.r_totale_regola) ? `In palestra: ${f(U.fmt(c.s.r_totale, 1, true))} R io, ${f(U.fmt(c.s.r_totale_regola, 1, true))} R la regola, sugli stessi casi.` : null],
      },
      reply: {
        _: [() => "Domenica prossima si rifà.", () => "Il Brier più basso è il migliore: guardalo.", () => "In palestra si sbaglia in fretta, per fortuna."],
        scettico: [() => "Sui casi del tuo mestiere o su quelli a caso?"], preside: [() => "La palestra serve a sbagliare in fretta, non a vincere."],
      },
    },
    notizia: {
      label: "La notizia",
      can: (a) => (a === "cronista" && newsOf() ? { n: newsOf() } : null),
      open: {
        _: [(c) => `Fatto: ${q(c.n.testo, 140).replace(/[.!?]$/, "")}${c.n.fonte ? ` (${q(c.n.fonte, 40)}${c.n.ora && U.romeTime(c.n.ora) ? ", " + f(U.romeTime(c.n.ora)) : ""})` : ""}.`,
          (c) => `Ultima notizia${c.n.etichetta ? ", " + q(c.n.etichetta, 30) : ""}: ${U.lowerFirst(q(c.n.testo, 140))}`, (c) => c.n.fonte ? `Dal briefing: ${q(c.n.testo, 130)} Fonte: ${q(c.n.fonte, 40)}.` : null],
      },
      reply: {
        _: [() => "È un fatto o un'interpretazione?", () => "Grazie. Lo tengo a mente.", () => "Una notizia non è un trend."],
        falco: [() => "E cosa cambia per il mio stop?"], spazzino: [() => "Chi vende, e perché?"], tartaruga: [() => "Una notizia non è un trend."], ragioniere: [() => "Chi mi paga, e perché?"],
        guardiano: [() => "E se succede stanotte?"], preside: [() => "Come lo sai? Qual è la fonte?"], scettico: [() => "È un fatto o un'interpretazione? Dammi l'ora."],
      },
    },
    intervista: {
      label: "L'intervista", ordered: true,
      can: (a, b) => (a === "cronista" ? { asks: true } : null),
      open: { _: [(c) => `${nm(c.b)}, una domanda per il mio taccuino: cosa ti dicono i numeri, oggi?`, (c) => `${nm(c.b)}, un fatto per il briefing di domani?`, (c) => `${nm(c.b)}, intervista lampo: cosa hai imparato?`] },
      reply: {
        _: [(c) => { const w = D.wallet(c.b); return w && isNum(w.gap) ? `Il fatto è questo: a giudizio ${f(U.fmt(w.judg, 2))} USDT, contro la regola ${f(U.fmt(w.gap, 2, true))}.` : null; },
          (c) => { const l = D.lesson(c.b); return l ? `Ho scritto nel quaderno: «${q(l.testo, 120)}»` : null; },
          (c) => { const p = D.openPrediction(c.b); return p && p.mercato && isNum(U.toNum(p.livello)) ? `Ho in registro ${f(U.predText(p))}. È una previsione, non un fatto.` : null; },
          () => "Oggi niente di nuovo: scrivi che i numeri sono fermi."],
      },
    },
  };
  const TOPIC_IDS = Object.keys(TOPIC);
  function listFor(table, k) { return [...(table[k] || []), ...(table[k] || []), ...(table._ || [])]; }
  // build one exchange; force = {topic, opener, oi} for _templates
  function chat(a, b, prefer, force) {
    const hour = U.rome().hh;
    const opts = [];
    for (const [o, l] of [[a, b], [b, a]]) {
      for (const id of force ? [force.topic] : TOPIC_IDS) {
        if (prefer && !has(prefer, id) && id !== "saluto") continue;
        if (id === "intervista" && !(prefer && has(prefer, "intervista")) && !force) continue;
        const data = TOPIC[id].can(o, l);
        if (!data) continue;
        let wt = id === "saluto" ? 0.35 : (INTEREST[o] && INTEREST[o][id]) || 1;
        if (prefer && has(prefer, id)) wt *= 6;
        if (recentTopics.includes(o + ":" + id)) wt *= 0.25;
        if (id !== "saluto" && recentTopics.slice(0, 3).some((x) => x.endsWith(":" + id))) wt *= 0.3;
        opts.push([{ o, l, id, data }, wt]);
      }
    }
    if (force) { const ch = opts.find((x) => x[0].o === force.opener); return ch ? buildLines(ch[0], hour, force) : null; }
    for (let tries = 0; tries < 6 && opts.length; tries++) {
      const ch = U.weighted(R, opts);
      if (!ch) return null;
      const out = buildLines(ch, hour, null);
      if (out) {
        recentTopics.unshift(ch.o + ":" + ch.id);
        recentTopics.length = Math.min(recentTopics.length, 24);
        return out;
      }
      opts.splice(opts.findIndex((x) => x[0] === ch), 1);
    }
    return null;
  }
  const recentTopics = [];
  function buildLines({ o, l, id, data }, hour, force) {
    const tp = TOPIC[id], c = { a: o, b: l, hour, ...data };
    const mk = (fn) => { REG = new Set(); let s = null; try { s = fn(c); } catch (e) { s = null; } s = s && elide(s); return s && lineOk(s) ? s : null; };
    const opens = force ? [(tp.open[o] || [])[force.oi] || (tp.open._ || [])[force.oi - (tp.open[o] || []).length]].filter(Boolean) : listFor(tp.open, o);
    let first = null;
    for (const fn of force ? opens : shuffle(opens)) { first = mk(fn); if (first) break; }
    if (!first) return null;
    let second = null;
    for (const fn of tp.ordered ? listFor(tp.reply, l) : shuffle(listFor(tp.reply, l))) { second = mk(fn); if (second && second !== first) break; second = null; }
    if (!second) return null;
    const lines = [{ who: o, to: l, text: first }, { who: l, to: o, text: second }];
    if (R() < 0.55) { const t3 = mk(() => (id === "saluto" ? pick(BYE) : pick(CLOSE[o] || CLOSE.preside))); if (t3) lines.push({ who: o, to: l, text: t3 }); if (lines.length === 3 && id !== "saluto" && R() < 0.4) lines.push({ who: l, to: o, text: pick(BYE) }); }
    return { topic: id, label: tp.label, lines };
  }
  function shuffle(xs) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---- encounters (§5.4.5) -------------------------------------------------------------------------------
  const encs = [];
  const pairCool = new Map();
  let lastEncStart = -1e9, encId = 0;
  const seatedNow = (k) => { const a = A[k]; const an = a.act && a.arrived && anchorOf(a.act.anchor); return !!(an && an.posture !== "stand"); };
  const walking = (k) => has3d() && (!A[k].arrived || !!P("isBusy", k));
  function interruptible(k) {
    const a = A[k];
    if (a.enc || a.lock || !a.act || a.act.id === "dormire" || a.speakUntil > T) return false;
    if (a.act.loop || a.act.id === "visita") return true;
    return walking(k) || !!a.act.interrupt;
  }
  // no invented chatter while a meeting is live or replayed: the official lines have the room
  const encOk = (k, r) => L.mode === "vita" || (!has(["replica", "riunione", "diretta"], L.mode) && !liveDirective(k) && has(["pranzo", "cena", "controllo", "serata", "caffe"], blockOf(k, r)));
  function checkEncounters(step) {
    if (encs.length >= 2 || T - lastEncStart < 10) return;
    const r = U.rome();
    const ks = KEYS.filter((k) => interruptible(k) && A[k].cool <= T && encOk(k, r));
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const x = ks[i], y = ks[j];
      if ((pairCool.get(pairId(x, y)) || 0) > T) continue;
      const near = has3d() ? dist(posOf(x), posOf(y)) <= 2.4 : roomOf(x) === roomOf(y) && !!roomOf(x);
      if (!near) continue;
      if (R() < 0.12 * aff(x, y) * step) { if (startEncounter(x, y)) return; }
    }
  }
  function startEncounter(a, b, prefer) {
    if (A[a].enc || A[b].enc || encs.length >= 2) return false;
    const ex = chat(a, b, prefer);
    if (!ex) return false;
    const room = roomOf(a) || roomOf(b);
    const label = ex.label || "Incontro " + roomIn(room);
    const enc = { id: ++encId, a, b, topic: ex.topic, feedLabel: label, lines: ex.lines, i: -1, t: 0, dur: 0, phase: "talk", room, label: { [a]: "parla con " + the(b), [b]: "parla con " + the(a) }, until: T + 10 };
    A[a].enc = A[b].enc = enc;
    encs.push(enc);
    lastEncStart = T;
    if (has3d()) {
      const sa = seatedNow(a), sb = seatedNow(b);
      for (const k of [a, b]) if (walking(k)) P("stop", k);
      if (!(sa && sb)) {
        const mover = sb ? a : b, fixed = mover === a ? b : a;
        if (dist(posOf(a), posOf(b)) > 1.6 || walking(mover)) {
          const pt = frontPoint(fixed, posOf(mover));
          move(mover, pt, "idle", { lookAt: fixed });
          enc.phase = "approach";
          enc.mover = mover;
        }
      }
      lookAt(a, b); lookAt(b, a);
    }
    for (const k of [a, b]) { P("setTag", k, { act: enc.label[k] }); bus.emit("life:activity", { key: k, activity: "incontro", label: enc.label[k], room, since: nowText() }); }
    bus.emit("life:encounter", { keys: [a, b], topic: ex.topic, state: "start", room });
    focus({ keys: [a, b], room, priority: 2, holdS: ex.lines.reduce((s, x) => s + U.sayMs(x.text) / 1000 + 0.4, 1), reason: "incontro" });
    return true;
  }
  function stepEncounter(enc, dt) {
    enc.t += dt;
    if (enc.phase === "approach") {
      const m = A[enc.mover];
      if (m.arrived || enc.t > 8) { if (!m.arrived) place(enc.mover, frontPoint(enc.mover === enc.a ? enc.b : enc.a, posOf(enc.mover)), "idle"); enc.phase = "talk"; enc.t = 0; lookAt(enc.a, enc.b); lookAt(enc.b, enc.a); }
      return;
    }
    if (enc.i >= 0 && enc.t < enc.dur) return;
    if (enc.i >= 0) P("hush", enc.lines[enc.i].who);
    enc.i++;
    enc.t = 0;
    if (enc.i >= enc.lines.length) { endEncounter(enc); return; }
    const ln = enc.lines[enc.i], ms = U.sayMs(ln.text);
    enc.dur = ms / 1000 + 0.4;
    const st = has(["preside", "guardiano", "scettico", "falco"], ln.who) && R() < 0.35 && !seatedNow(ln.who) ? "gesture" : "talk";
    say(ln.who, { text: ln.text, label: enc.feedLabel, kind: "chiacchiera", to: ln.to, ms });
    setState(ln.who, st);
    setState(ln.to, "listen");
    feed({ who: ln.who, to: ln.to, kind: "chiacchiera", label: enc.feedLabel, text: ln.text, room: enc.room });
    if (enc.i > 0) focus({ keys: [ln.who, ln.to], room: enc.room, priority: 2, holdS: ms / 1000 + 0.5, reason: "incontro" });
  }
  function endEncounter(enc, quiet) {
    const i = encs.indexOf(enc);
    if (i >= 0) encs.splice(i, 1);
    pairCool.set(pairId(enc.a, enc.b), T + 240);
    for (const k of [enc.a, enc.b]) {
      const a = A[k];
      if (a.enc !== enc) continue;
      a.enc = null;
      a.cool = T + 45;
      if (quiet) continue;
      lookAt(k, null);
      resume(k);
    }
    bus.emit("life:encounter", { keys: [enc.a, enc.b], topic: enc.topic, state: "end", room: enc.room });
  }
  function resume(k) {
    const a = A[k], act = a.act;
    if (!act) return;
    if (act.id === "visita") { stopAct(k); return; }
    P("setTag", k, { act: act.label });
    bus.emit("life:activity", { key: k, activity: act.id, label: act.label, room: act.room, since: act.since });
    if (act.loop) { act.loop.pause = T + 1; return; }
    if (act.anchor) {
      const an = anchorOf(act.anchor), p = posOf(k);
      if (an && dist(p, an) > 0.35 && has3d()) move(k, act.anchor, act.state, {});
      else { setState(k, act.state); a.arrived = true; }
    }
    if (isNum(act.until) && act.until !== Infinity) act.until = Math.max(act.until, T + 15);
  }

  // ---- thoughts (§5.4.6) -------------------------------------------------------------------------------------
  function thoughtFor(k) {
    const m = mem(k), out = [];
    for (const l of arr(m && m.lezioni).filter((x) => obj(x) && x.testo).slice(-5)) out.push([U.plain(l.testo, 140), "dal quaderno"]);
    for (const r of arr(m && m.regole).filter((x) => obj(x) && x.testo)) out.push([U.plain(r.testo, 140), "una mia regola"]);
    for (const e of arr(m && m.errori).filter((x) => obj(x) && x.testo && U.toNum(x.volte) >= 2)) out.push([U.plain(`Un errore che ripeto: ${U.plain(e.testo, 100)} (${U.toNum(e.volte)} volte)`, 140), "dal quaderno"]);
    const u = ult();
    if (u) {
      const rif = k === "preside" ? u.riflessione_preside : k === "scettico" ? obj(u.scettico) && u.scettico.riflessione : k === "cronista" ? obj(u.briefing) && u.briefing.riflessione : obj(u.posizioni) && obj(u.posizioni[k]) && u.posizioni[k].riflessione;
      if (typeof rif === "string" && rif.trim()) out.push([U.plain(rif, 140), "dal verbale del " + U.dm(u.data)]);
    }
    const p = D.openPrediction(k);
    if (p && p.mercato && isNum(U.toNum(p.livello))) out.push([elide("Ho detto: " + U.predText(p) + "."), "dal quaderno"]);
    const fresh = out.filter((x) => x[0] && !BAD.test(x[0]) && !A[k].lastThought.includes(x[0]));
    return fresh.length ? pick(fresh) : null;
  }
  let thoughtAcc = 0;
  function checkThoughts(step) {
    if (L.mode === "replica" || L.mode === "diretta") return;
    thoughtAcc += step;
    if (thoughtAcc < 20) return;
    thoughtAcc = 0;
    if (R() >= 0.3 * (followKey ? 1.6 : 1)) return;
    const clouds = KEYS.filter((k) => A[k].thinkUntil > T).length;
    if (clouds >= (followKey ? 2 : 1)) return;
    for (const k of followKey ? [followKey, ...shuffle(KEYS.filter((x) => x !== followKey))] : shuffle(KEYS)) {
      const a = A[k];
      if (!a.act || a.act.id === "dormire" || a.enc || (a.lock && a.lock !== "sera") || a.speakUntil > T || a.thinkUntil > T || T < a.nextThought) continue;
      const st = a.act.state;
      const alone = !KEYS.some((o) => o !== k && (has3d() ? dist(posOf(o), posOf(k)) < 2.4 : roomOf(o) === roomOf(k)));
      const walkingAlone = (walking(k) || a.act.loop) && T - a.walkSince > 20 && alone;
      const ok = has(["read", "think", "write"], st) || (alone && seatedNow(k)) || walkingAlone;
      if (!ok) continue;
      const th = thoughtFor(k);
      if (!th) continue;
      const [text, source] = th, ms = U.clamp(U.sayMs(text) + 1500, 5000, 12000);
      a.thinkUntil = T + ms / 1000;
      a.nextThought = T + 180;
      a.lastThought = [text, ...a.lastThought].slice(0, 3);
      P("think", k, { text, source, ms });
      feed({ who: k, kind: "pensiero", label: "pensa", text, room: roomOf(k), source });
      bus.emit("life:thought", { key: k, text, source });
      focus({ keys: [k], room: roomOf(k), priority: 1, holdS: ms / 1000, reason: "pensa" });
      return;
    }
  }

  // ---- moods (Appendix B.2) -----------------------------------------------------------------------------------
  function moodOf(k, r) {
    const late = r.minutes >= 1320 || (blockOf(k, r) === "notte" && A[k].act && A[k].act.id !== "dormire");
    const sleepy = ["assonnato", `sono le ${U.romeClock(C.clock.now())}`];
    if (has(TR, k)) {
      const w = D.wallet(k);
      const al = alarms().some((s) => alarmTarget(s) === k);
      const pnl = w && isNum(w.pnlPct) ? w.pnlPct : null, why = pnl !== null ? `a giudizio ${U.pct(pnl)} dall'inizio` : "";
      if ((pnl !== null && pnl <= -3) || al) return ["teso", al ? (why ? why + ", con un allarme del Guardiano" : "un allarme del Guardiano sul suo portafoglio") : why];
      if (late) return sleepy;
      if (pnl !== null && pnl <= -1) return ["preoccupato", why];
      if (pnl !== null && pnl >= 1) return ["contento", why];
      if (w && w.positions > 0) return ["concentrato", `${w.positions} ${w.positions === 1 ? "posizione aperta" : "posizioni aperte"} a giudizio`];
      return ["sereno", why || "i portafogli non hanno ancora numeri"];
    }
    if (late) return sleepy;
    if (k === "guardiano") { const n = alarms().length; return [n >= 2 ? "teso" : n === 1 ? "concentrato" : "sereno", n ? `${n} ${n === 1 ? "allarme" : "allarmi"} oggi` : "nessun allarme oggi"]; }
    if (k === "cronista") {
      const u = ult(), n = arr(u && obj(u.briefing) && u.briefing.notizie).filter(obj).length;
      return [A[k].act && A[k].act.id === "notizie" ? "concentrato" : "curioso", n ? `${n} ${n === 1 ? "notizia" : "notizie"} nel briefing` : "aspetta le notizie di domattina"];
    }
    if (k === "scettico") {
      const M = mods(), c = M.over && D.calibration(M.over);
      return ["dubbioso", c && isNum(c.sicurezza_media) && isNum(c.successi) ? elide(`${the(M.over)} dice il ${U.prob(c.sicurezza_media)} e ci prende il ${U.prob(c.successi)}`) : "nessuna calibrazione da controllare, per ora"];
    }
    const M = mods();
    if (M.low && M.lowD <= 6) return ["severo", `${the(M.low)} ha ${M.lowD} in disciplina`];
    return ["sereno", M.low ? `la disciplina più bassa è ${M.lowD}` : "nessun voto ancora"];
  }
  function updateMoods() {
    const r = U.rome();
    for (const k of KEYS) {
      const [mood, why] = moodOf(k, r), a = A[k];
      if (mood === a.mood && why === a.moodWhy) continue;
      const changed = mood !== a.mood;
      a.mood = mood; a.moodLabel = mood; a.moodWhy = why;
      if (changed) P("setMood", k, mood);
      bus.emit("life:mood", { key: k, mood, label: mood, why });
    }
  }

  // ---- the replay: a port of the old classroom's dayScript (§5.4.3) ---------------------------------------------------
  const whoOf = (id) => String(id || "").split("-")[0];
  function scriptBuilder() {
    const B = [], items = [];
    const say2 = (who, text, label, to) => { if (!text) return; items.push({ who, text, label, to: to || null, step: B.length }); B.push({ kind: "say", who, text, label, to: to || null, item: items.length - 1 }); };
    const go = (...moves) => B.push({ kind: "go", moves });
    const board = (...lines) => B.push({ kind: "board", lines });
    const screen = (events, title) => B.push({ kind: "screen", events, title });
    return { B, items, say: say2, go, board, screen };
  }
  const evTxt = (e) => `${NM[e.wallet] || e.wallet || ""}, ${U.shortEvent(e)}`;
  function seraPart(E, s) {
    const EP = obj(E.posizioni) || {};
    const motivi = arr(E.motivi).filter(Boolean).map((x) => U.plain(U.human(x), 120));
    s.board("La riunione della sera", motivi[0] || "");
    s.screen(arr(E.eventi_notte).filter(obj), "LA SERA");
    s.go(["guardiano", "stand"]);
    s.say("guardiano", motivi.length ? "Allarme: " + motivi.join(" · ") : "Il controllo della sera ha suonato.", "La sera");
    const EG = obj(EP.guardiano);
    if (EG && EG.bollettino) s.say("guardiano", U.plain(EG.bollettino, 240), "Il bollettino della sera");
    s.go(["guardiano", "seat"]);
    for (const w of TR) {
      const x = obj(EP[w]);
      if (!x) continue;
      s.go([w, "stand"]);
      s.say(w, U.plain(x.intervento, 220), "La sera");
      const os = arr(x.ordini).filter(obj);
      s.say(w, os.length ? "I miei ordini: " + os.map(U.orderText).join(" · ") : "Stasera nessun ordine.", "Gli ordini della sera");
      s.go([w, "seat"]);
    }
    const eo = arr(E.eventi_ordini).filter(obj);
    s.screen(eo, "LA SERA");
    s.say("motore", eo.length ? eo.map(evTxt).join(" · ") : "Stasera nessun ordine da eseguire.", "Gli ordini della sera");
    s.go(["preside", "stand"]);
    arr(E.chiusura).filter(Boolean).forEach((r, i) => s.say("preside", U.plain(r, 220), SERA_RIGHE[i] || `Riga ${i + 1}`));
    s.go(["preside", "seat"]);
  }
  function dayScript(d, g) {
    const s = scriptBuilder(), { B, say: sy, go, board, screen } = s;
    const Pz = obj(d.posizioni) || {};
    const n = d.giorno ?? (g && g.giorno) ?? "";
    const welcome = (d.tipo || (g && g.tipo)) === "accoglienza";
    const theme = d.tema || (g && g.tema) || "";
    B.push({ kind: "reset" });
    board(`Riunione ${n} · ${U.longDay(d.data || (g && g.data))}`, U.plain(d.titolo || theme, 110));
    screen(null, "");
    go(["preside", "board"]);
    sy("preside", `Riunione ${n}${d.titolo ? ": " + U.plain(d.titolo, 110) : ""}.${theme ? " Il tema è " + U.lowerFirst(U.plain(theme, 150)) + "." : ""}`, "Apre la riunione");
    go(["preside", "stand"]);
    const night = arr(d.eventi_notte).filter(obj);
    screen(night, "DALLA NOTTE");
    sy("motore", night.length ? "Nella notte: " + night.map(evTxt).join(" · ") : "Nella notte nessuna posizione è arrivata allo stop o al target.", "La notte");
    const ver = arr(d.previsioni_verificate).filter(obj);
    if (ver.length) sy("motore", "Previsioni verificate: " + ver.map((x) => `${NM[whoOf(x.id)] || ""} ${x.mercato} ${x.direzione} ${U.level(x.livello)} al ${U.prob(x.probabilita)}, ${x.esito ? "giusta" : "sbagliata"}`).join(" · "), "Previsioni verificate");
    const Bf = obj(d.briefing) || {};
    const top = arr(Bf.notizie).filter(obj)[0];
    board("Il briefing del Cronista", top ? U.plain(top.testo, 100) : U.plain(Bf.testo, 100));
    go(["cronista", "board"], ["preside", "seat"]);
    if (welcome && Bf.chi_sono) sy("cronista", U.plain(Bf.chi_sono, 220), "Si presenta");
    sy("cronista", U.plain(Bf.testo, 230), "Il briefing");
    if (top) sy("cronista", `${U.cap(top.etichetta || "notizia")}: ${U.plain(top.testo, 170)}${top.fonte ? ` (${top.fonte}${top.ora ? ", " + U.whenTxt(top.ora) : ""})` : ""}`, "La notizia");
    go(["cronista", "seat"]);
    board("Le posizioni", "scritte in privato, senza vedersi");
    for (const w of TR) {
      const x = obj(Pz[w]) || {};
      if (!Object.keys(x).length) continue;
      go([w, "stand"]);
      if (welcome && x.chi_sono) sy(w, U.plain(x.chi_sono, 220), "Si presenta");
      sy(w, U.plain(x.regola, 210), "La regola");
      const p0 = arr(x.previsioni).filter(obj)[0];
      if (p0) sy(w, "Prevedo " + U.predText(p0) + ".", "La previsione principale");
      sy(w, U.plain(x.intervento, 230), "Intervento");
      const orders = Array.isArray(x.ordini_iniziali) ? x.ordini_iniziali.filter(obj) : arr(x.ordini);
      sy(w, orders.length ? "I miei ordini: " + orders.map(U.orderText).join(" · ") : welcome ? "Oggi è l'accoglienza: niente ordini." : "Oggi nessun ordine: resto fermo.", "Ordini");
      go([w, "seat"]);
    }
    const G = obj(Pz.guardiano) || {};
    if (Object.keys(G).length) {
      go(["guardiano", "stand"]);
      if (welcome && G.chi_sono) sy("guardiano", U.plain(G.chi_sono, 220), "Si presenta");
      sy("guardiano", U.plain(G.bollettino, 240), "Il bollettino");
      const al = arr(G.allarmi).length ? arr(G.allarmi) : arr(d.rischio && d.rischio.allarmi);
      sy("guardiano", al.length ? "Allarmi: " + al.map((x) => U.plain(U.human(x), 140)).join(" · ") : "Oggi nessun allarme.", "Gli allarmi");
      go(["guardiano", "seat"]);
    }
    const Sc = obj(d.scettico) || {};
    const qs = arr(Sc.domande).filter(obj);
    if (qs.length || Sc.contrario) {
      board("Le domande dello Scettico", qs.length ? `${qs.length} ${qs.length === 1 ? "domanda" : "domande"}, ognuna con un numero` : "");
      go(["scettico", "stand"]);
      if (welcome && Sc.chi_sono) sy("scettico", U.plain(Sc.chi_sono, 220), "Si presenta");
      qs.forEach((x, i) => sy("scettico", NM[x.a] ? `${NM[x.a]}, ${U.lowerFirst(U.plain(x.testo, 210))}` : U.plain(x.testo, 210), `Domanda ${i + 1}`, x.a));
      sy("scettico", U.plain(Sc.contrario, 230), "Il contrario");
      go(["scettico", "seat"]);
    }
    const changedSaid = new Set();
    for (const x of qs) {
      if (!x.risposta || !NM[x.a] || x.a === "motore") continue;
      go([x.a, "stand"]);
      sy(x.a, U.plain(x.risposta, 230), "Risponde allo Scettico", "scettico");
      const qa = obj(Pz[x.a]);
      if (qa && !changedSaid.has(x.a) && Array.isArray(qa.ordini_iniziali) && JSON.stringify(qa.ordini_iniziali) !== JSON.stringify(arr(qa.ordini))) {
        changedSaid.add(x.a);
        const now = arr(qa.ordini).filter(obj);
        sy(x.a, now.length ? "Cambio i miei ordini: " + now.map(U.orderText).join(" · ") : "Ritiro i miei ordini: oggi resto fermo.", "Cambia gli ordini");
      }
      go([x.a, "seat"]);
    }
    const ev = arr(d.eventi_ordini).filter(obj);
    board("Gli ordini a giudizio", ev.length ? "il motore li esegue, o li respinge se escono dalle regole" : "");
    screen(ev, "ORDINI");
    sy("motore", ev.length ? ev.map(evTxt).join(" · ") : welcome ? "All'accoglienza nessun ordine da eseguire." : "Oggi nessun ordine da eseguire.", "Gli ordini");
    const Cz = obj(d.chiusura) || {};
    board("La chiusura del Preside", U.plain(d.titolo || theme, 100));
    go(["preside", "stand"]);
    arr(Cz.righe).filter(Boolean).forEach((r, i) => sy("preside", U.plain(r, 220), RIGHE[i] || `Riga ${i + 1}`));
    if (obj(Cz.voti)) {
      B.push({ kind: "grade", voti: Cz.voti });
      sy("preside", "I voti: " + GR.filter((w) => obj(Cz.voti[w])).map((w) => `${NM[w]} ${Cz.voti[w].ragionamento ?? "?"} e ${Cz.voti[w].disciplina ?? "?"}`).join(", ") + ".", "I voti");
    }
    if (obj(d.consiglio) && d.consiglio.testo) sy("preside", U.plain(d.consiglio.testo, 240), "Il consiglio");
    if (obj(d.scrutinio) && d.scrutinio.testo) {
      if (obj(d.scrutinio.pagella)) B.push({ kind: "grade", voti: d.scrutinio.pagella });
      sy("preside", U.plain(d.scrutinio.testo, 240), "Lo scrutinio");
    }
    if (obj(d.fine) && d.fine.testo) sy("preside", U.plain(d.fine.testo, 240), "Il bilancio");
    go(["preside", "seat"]);
    const E = full(d.sera);
    if (E) seraPart(E, s);
    B.push({ kind: "idle", s: 20 });
    return { beats: B, items: s.items };
  }
  function spotAnchor(who, spot) {
    if (spot === "seat") return [`riunione.seat.${who}`, "listen"];
    if (spot === "stand") return [`riunione.stand.${who}`, "stand"];
    if (spot === "board") return who === "preside" ? ["riunione.board.preside", "write"] : ["riunione.board.guest", "gesture"];
    if (spot === "shelf") return ["riunione.shelf", "read"];
    return [`riunione.seat.${who}`, "listen"];
  }
  // the beat runner: one replay (all eight) or the evening alarm's beats (the six of the sera)
  let rep = null, sera = null, replayWait = null;
  function castMove(run, who, spot, inst) {
    if (!has(run.cast, who)) return;
    const [id, st] = spotAnchor(who, spot), a = A[who];
    if (a.act && a.act.anchor && a.act.anchor !== id && W() && W().release) W().release(a.act.anchor, who);
    if (W() && W().reserve) W().reserve(id, who, true);
    const an = anchorOf(id);
    a.act = { ...(a.act || {}), id: run.actId, label: run.actLabel, anchor: id, state: st, room: "riunione", until: Infinity, loop: null };
    run.spot[who] = st;
    if (inst) place(who, id, st); else move(who, id, st, { speed: 1.2 });
    if (!an) A[who].arrived = true;
  }
  function gradesOn(voti) { for (const k of GR) { const v = voti && obj(voti[k]); P("setTag", k, { grades: v ? { ragionamento: v.ragionamento, disciplina: v.disciplina } : null }); } }
  function beatStart(run, b) {
    b.t = 0; b.rt = 0;
    if (b.kind === "reset") {
      for (const k of run.cast) castMove(run, k, "seat", false);
      gradesOn(null);
      surf("board", ["Scuola Cripto"], 1);
      run.phase = "raduno";
      focus({ room: "riunione", priority: 2, holdS: 8, shot: "wide", reason: "raduno" });
    } else if (b.kind === "go") {
      for (const [who, spot] of b.moves) castMove(run, who, spot, false);
    } else if (b.kind === "say") {
      const ms = U.sayMs(b.text), sp = run.speed;
      say(b.who, { text: b.text, label: b.label, kind: "ufficiale", to: b.to || undefined, ms: Math.round(ms / sp), cps: 42 * sp });
      if (has(KEYS, b.who)) setState(b.who, b.who === "preside" && run.spot.preside === "write" ? "write" : "talk");
      for (const k of run.cast) if (k !== b.who) { setState(k, "listen"); lookAt(k, b.who === "motore" ? "riunione.screen" : b.who); }
      if (run.feedLive) feed({ who: b.who, to: b.to, kind: "ufficiale", label: b.label, text: b.text, room: "riunione", source: run.source, date: run.date });
      focus({ keys: [b.who, b.to].filter(Boolean), room: "riunione", priority: 3, holdS: ms / 1000 / sp, reason: "riunione" });
      run.speaking = b.who;
      if (run.phase === "raduno") run.phase = "battute";
    } else if (b.kind === "board") {
      surf("board", b.lines, ctx && ctx.reduceMotion ? 1 : 0);
      b.drawn = 0;
    } else if (b.kind === "screen") surf("motore", b.events, b.title);
    else if (b.kind === "grade") gradesOn(b.voti);
    else if (b.kind === "idle") run.phase = "fine";
    if (b.kind !== "reset" && run.phase === "raduno") run.phase = "battute";
  }
  function beatDone(run, b) {
    if (b.kind === "reset") return run.cast.every((k) => A[k].arrived) || b.rt > 20;
    if (b.kind === "go") return b.moves.every(([who]) => !has(run.cast, who) || A[who].arrived) || b.t > 16;
    if (b.kind === "say") return b.t >= U.sayMs(b.text) / 1000;
    if (b.kind === "board") return b.t >= 1.6;
    if (b.kind === "idle") return b.t >= b.s;
    if (b.kind === "screen" || b.kind === "grade") return b.t >= 0.5;
    return true;
  }
  function beatEnd(run, b) {
    if (b.kind === "reset") for (const k of run.cast) if (!A[k].arrived) place(k, `riunione.seat.${k}`, "listen");
    if (b.kind === "go") for (const [who, spot] of b.moves) if (has(run.cast, who) && !A[who].arrived) place(who, spotAnchor(who, spot)[0], spotAnchor(who, spot)[1]);
    if (b.kind === "say") { P("hush", b.who); if (has(KEYS, b.who)) { setState(b.who, run.spot[b.who] || "listen"); A[b.who].speakUntil = 0; } for (const k of run.cast) lookAt(k, null); run.speaking = null; }
    if (b.kind === "board") surf("board", b.lines, 1);
  }
  const beatNeed = (b) => (b.kind === "say" ? U.sayMs(b.text) / 1000 : b.kind === "board" ? 1.6 : b.kind === "idle" ? b.s : b.kind === "screen" || b.kind === "grade" ? 0.5 : null);
  function runBeats(run, dt) {
    if (!run.playing) return;
    // the time left over by a beat that ends inside this frame goes to the next one, so speed 4 is exactly 4× shorter
    let carry = dt * run.speed, carryReal = dt;
    for (let guard = 0; guard < 80; guard++) {
      const b = run.beats[run.step];
      if (!b) { run.onEnd(run); return; }
      if (!b.started) { b.started = true; beatStart(run, b); if (run.onStep) run.onStep(run); }
      b.t += carry; b.rt += carryReal; carry = 0; carryReal = 0;
      if (b.kind === "board" && !(ctx && ctx.reduceMotion) && b.t < 1.4 && b.t - b.drawn > 1 / 15) { b.drawn = b.t; surf("board", b.lines, Math.min(1, b.t / 1.4)); }
      if (!beatDone(run, b)) return;
      const need = beatNeed(b);
      if (need !== null) { carry = Math.max(0, b.t - need); carryReal = carry / run.speed; }
      beatEnd(run, b);
      run.step += 1;
    }
  }
  function settle(run, index) {
    hushAll();
    for (const b of run.beats) b.started = false;
    for (const k of run.cast) castMove(run, k, "seat", true);
    gradesOn(null);
    surf("board", ["Scuola Cripto"], 1);
    surf("motore", null, "");
    for (let i = 0; i < index && i < run.beats.length; i++) {
      const b = run.beats[i];
      if (b.kind === "go") for (const [who, spot] of b.moves) castMove(run, who, spot, true);
      else if (b.kind === "board") surf("board", b.lines, 1);
      else if (b.kind === "screen") surf("motore", b.events, b.title);
      else if (b.kind === "grade") gradesOn(b.voti);
    }
    for (const k of run.cast) setState(k, run.spot[k] || "listen");
    run.step = Math.max(0, Math.min(index, run.beats.length - 1));
    run.phase = run.step === 0 ? "raduno" : run.beats[run.step].kind === "idle" ? "fine" : "battute";
  }
  function emitReplay(state, extra) { bus.emit("life:replay", { state, date: rep ? rep.date : extra && extra.date, step: rep ? rep.step : 0, total: rep ? rep.beats.length : 0, ...(extra || {}) }); }
  function syncReplayState() { L.replayState = rep ? { date: rep.date, step: rep.step, total: rep.beats.length, playing: rep.playing, speed: rep.speed, phase: rep.phase } : null; }
  function stopAll() {
    for (const e of encs.slice()) endEncounter(e, true);
    if (scene) endScene(scene, true);
    hushAll();
    for (const k of KEYS) { P("unthink", k); A[k].thinkUntil = 0; }
  }
  function replay(date, opts = {}) {
    if (!U.isoDay(date)) return false;
    if (U.liveNow(C.data.live)) return false;
    const d = C.data.verbali && C.data.verbali[date];
    // another day was picked: the running replay ends, so the campus and the page show the same day
    if (rep && rep.date !== date && !obj(d)) stopReplay();
    if (d === null) { emitReplay("error", { date, step: 0, total: 0 }); return false; }
    if (talkRun) cancelTalk();
    if (d === undefined) {
      replayWait = { date, until: Date.now() + 10000, opts };
      emitReplay("loading", { date, step: 0, total: 0 });
      return true;
    }
    replayWait = null;
    startReplay(date, d, opts);
    return true;
  }
  function startReplay(date, d, opts) {
    if (rep) endReplay(false);
    stopAll();
    if (sera) sera = null;
    const g = arr(obj(C.data.programma) && C.data.programma.giorni).find((x) => x && x.data === date) || null;
    const { beats, items } = dayScript(d, g);
    rep = { kind: "replica", date, beats, step: 0, playing: opts.autostart !== false, speed: 1, phase: "raduno", cast: KEYS.slice(), spot: {}, actId: "riunione", actLabel: "alla riunione", feedLive: false, source: "verbale del " + U.dm(date) };
    rep.onStep = () => { syncReplayState(); emitReplay("step"); };
    rep.onEnd = () => stopReplay();
    for (const k of KEYS) { A[k].lock = "replica"; A[k].enc = null; }
    setClock(U.utc(d.mercati_ora) || U.romeDate(date, 407), 1);
    lastSim = C.clock.now().getTime();
    // the feed keeps one copy of a day's replay: drop an older one, then append every line with its beat
    for (let i = feedList.length - 1; i >= 0; i--) if (feedList[i].date === date && feedList[i].step !== null) feedList.splice(i, 1);
    syncReplayState();
    setMode("replica", replayDetail());
    const at = nowText();
    for (const it of items) feed({ who: it.who, to: it.to, kind: "ufficiale", label: it.label, text: it.text, room: "riunione", source: rep.source, step: it.step, date, at });
    for (const k of KEYS) { release(k); A[k].act = null; }
    for (const k of KEYS) setAct(k, { id: "riunione", label: "alla riunione", anchor: null, state: "listen", room: "riunione", dur: Infinity, fixed: true, interrupt: false, loop: null });
    emitReplay("start");
  }
  const replayDetail = () => `Replica della riunione di ${U.longDay(rep ? rep.date : "")}, con le loro parole`;
  function endReplay(emit) {
    if (!rep) return;
    hushAll();
    gradesOn(null);
    for (const k of KEYS) { release(k); A[k].lock = null; A[k].act = null; }
    const date = rep.date;
    rep = null;
    syncReplayState();
    setClock(null);
    lastSim = C.clock.now().getTime();
    boardDefault();
    surf("motore", null, "");
    if (emit) bus.emit("life:replay", { state: "end", date, step: 0, total: 0 });
  }
  function stopReplay() {
    replayWait = null;
    if (!rep) return;
    endReplay(true);
    evalMode(true);
  }
  function replayControl(o = {}) {
    if (!rep) return;
    if (o.restart) settle(rep, 0);
    if (o.playing !== undefined) rep.playing = !!o.playing;
    if (o.speed && has([1, 2, 4], +o.speed)) rep.speed = +o.speed;
    syncReplayState();
    emitReplay("step");
  }
  function replayJump(step) {
    if (!rep || !isNum(step)) return;
    settle(rep, Math.round(step));
    syncReplayState();
    emitReplay("step");
  }
  function boardDefault() {
    const u = ult();
    if (u && u.data) {
      const g = arr(obj(C.data.programma) && C.data.programma.giorni).find((x) => x && x.data === u.data);
      const n = u.giorno ?? (g && g.giorno);
      surf("board", [`Riunione ${n ?? ""} · ${U.longDay(u.data)}`.replace("Riunione  ·", "Riunione ·"), U.plain(u.titolo || u.tema || "", 110)].filter(Boolean), 1);
    } else surf("board", ["Scuola Cripto"], 1);
  }

  // ---- the evening alarm (§5.4.2 emergenza) ---------------------------------------------------------------------
  const seraPlayed = new Set();
  function seraDoc(date) {
    const u = ult(), v = C.data.verbali && C.data.verbali[date];
    return (u && u.data === date && full(u.sera)) || (obj(v) && full(v.sera)) || null;
  }
  const seraRead = new Set();
  function seraStep(r) {
    if (sera) return;
    const E = seraDoc(r.date), S = obj(C.data.sera);
    const motivi = arr(S && S.motivi).filter(Boolean).map((x) => U.plain(U.human(x), 120));
    if (E && !seraPlayed.has(r.date)) {
      seraPlayed.add(r.date);
      if (scene && scene.kind === "allarme") endScene(scene, true);
      const s = scriptBuilder();
      seraPart(E, s);
      sera = { kind: "sera", date: r.date, beats: [{ kind: "reset" }, ...s.B], step: 0, playing: true, speed: 1, phase: "raduno", cast: SERA_CAST.slice(), spot: {}, actId: "sera", actLabel: ACT.sera[0], feedLive: true, source: "verbale del " + U.dm(r.date) };
      sera.onEnd = () => { for (const k of sera.cast) { if (A[k].lock === "sera") A[k].lock = null; setState(k, "think"); } sera = null; };
      for (const k of sera.cast) { stopEnc(k); A[k].lock = "sera"; }
      surf("board", ["La riunione della sera", motivi[0] || ""], 1);
      focus({ room: "riunione", priority: 2, holdS: 10, shot: "wide", reason: "emergenza" });
      return;
    }
    // no minutes of the evening yet (or not arrived): the Guardiano reads the real motives at the board, once
    if (E || seraRead.has(r.date) || C.data.ultimo === undefined || !motivi.length || scene) return;
    seraRead.add(r.date);
    surf("board", ["La riunione della sera", motivi[0]], 1);
    const lines = motivi.map((m) => ({ who: "guardiano", to: null, text: "Allarme: " + m + ".", kind: "chiacchiera", label: "La sera" }));
    sceneStart({ kind: "allarme", cast: ["guardiano"], spots: { guardiano: "riunione.board.guest" }, states: { guardiano: "gesture" }, lines, actId: "sera", actLabel: "legge gli allarmi", gap: 2, room: "riunione", keep: true });
  }
  function stopEnc(k) { if (A[k].enc) endEncounter(A[k].enc, false); }

  // ---- group scenes: the contest gathering, the winner's party, the alarm, the Claude dialog ---------------------------------
  let scene = null;
  function sceneStart(o) {
    if (scene) endScene(scene, true);
    const sc = { ...o, i: -1, t: 0, dur: 0, phase: "walk", walkT: 0, holdT: 0 };
    scene = sc;
    for (const k of sc.cast) {
      stopEnc(k);
      A[k].lock = sc.kind;
      const to = sc.spots[k];
      release(k);
      if (typeof to === "string" && W() && W().reserve) W().reserve(to, k, true);
      const an = typeof to === "string" ? anchorOf(to) : to;
      setAct(k, { id: sc.actId, label: sc.actLabel, anchor: typeof to === "string" ? to : null, state: sc.states[k] || "listen", room: (an && an.room) || sc.room || roomOf(k), dur: Infinity, fixed: true, interrupt: false, loop: null });
      if (to) move(k, to, sc.states[k] || "listen", { speed: 1.15, lookAt: sc.look && sc.look[k] });
    }
    if (sc.onWalk) sc.onWalk(sc);
    return sc;
  }
  function stepScene(sc, dt) {
    sc.t += dt;
    if (sc.phase === "walk") {
      sc.walkT += dt;
      if (!sc.cast.every((k) => A[k].arrived) && sc.walkT < 20) return;
      for (const k of sc.cast) if (!A[k].arrived && sc.spots[k]) place(k, sc.spots[k], sc.states[k] || "listen");
      for (const k of sc.cast) if (sc.look && sc.look[k]) lookAt(k, sc.look[k]);
      sc.phase = "play"; sc.t = 0; sc.i = -1; sc.dur = 0;
      if (sc.onPlay) sc.onPlay(sc);
      return;
    }
    if (sc.phase === "play") {
      if (sc.i >= 0 && sc.t < sc.dur) return;
      if (sc.i >= 0) P("hush", sc.lines[sc.i].who);
      sc.i++; sc.t = 0;
      if (sc.i >= sc.lines.length) { sc.phase = "hold"; sc.t = 0; return; }
      const ln = sc.lines[sc.i], ms = U.sayMs(ln.text);
      sc.dur = ms / 1000 + (sc.gap || 0.4);
      say(ln.who, { text: ln.text, label: ln.label, kind: ln.kind, to: ln.to || undefined, ms });
      setState(ln.who, ln.state || "talk");
      for (const k of sc.cast) if (k !== ln.who) { setState(k, "listen"); lookAt(k, ln.who); }
      if (ln.to) lookAt(ln.who, ln.to);
      feed({ who: ln.who, to: ln.to || null, kind: ln.kind, label: ln.label, text: ln.text, room: roomOf(ln.who) || sc.room || null, source: ln.source || null });
      focus({ keys: [ln.who, ln.to].filter((x) => x && x !== "tutti"), room: roomOf(ln.who) || sc.room, priority: ln.kind === "claude" ? 3 : 2, holdS: sc.dur, reason: sc.kind });
      if (sc.onLine) sc.onLine(sc, ln);
      return;
    }
    if (sc.phase === "hold") {
      if (sc.t < (sc.hold || 0)) { if (sc.onHold) sc.onHold(sc); return; }
      endScene(sc, false);
    }
  }
  function endScene(sc, aborted) {
    if (scene === sc) scene = null;
    for (const k of sc.cast) if (A[k].lock === sc.kind) {
      A[k].lock = null;
      lookAt(k, null);
      if (aborted) P("hush", k);
      if (!sc.keep) { release(k); A[k].act = null; } else setState(k, "listen");
    }
    if (sc.done) sc.done(sc, aborted);
  }

  // the contest: the four traders gather at the scoreboard every 8-15 minutes while a contest is open
  let gatherAt = 0;
  function contestStep() {
    const c = contest();
    if (!c || L.mode !== "vita" || scene) return;
    if (!gatherAt) { gatherAt = T + rnd(480, 900); return; }
    if (T < gatherAt) return;
    gatherAt = T + rnd(480, 900);
    const r = U.rome();
    const cast = TR.filter((k) => awake(k) && free(k) && !inDorm(k) && has(["lavoro", "serata", "controllo"], blockOf(k, r)));
    if (cast.length < 2) return;
    const rk = ranking(c), lines = [];
    const order = rk.filter((x) => has(cast, x.k));
    order.forEach((x, n) => {
      REG = new Set();
      const res = f(U.fmt(x.risultato, 2, true)), tot = f(String(rk.length)), pl = placeTxt(x);
      const t = c.opening ? (n === 0 ? `All'apertura della gara contano solo i costi: io parto da ${res} USDT.` : `Io parto da ${res} USDT. I conti veri alla chiusura.`)
        : n === 0 ? pick([`Nella gara sono ${pl} su ${tot}, con ${res} USDT.`, `Classifica della gara: sono ${pl}, con ${res} USDT.`])
          : pick([`Io sono ${pl}, con ${res} USDT.`, `${U.cap(pl)} io: ${res} USDT.`, `Io ${pl}, ${res} USDT. Vediamo a fine gara.`]);
      if (lineOk(t)) lines.push({ who: x.k, to: n ? order[0].k : null, text: t, kind: "chiacchiera", label: "La gara", state: n === 0 ? "gesture" : "talk" });
    });
    if (lines.length < 2) return;
    const closer = order[order.length - 1].k;
    lines.push({ who: closer === "falco" ? "falco" : order[0].k, to: null, text: closer === "falco" ? "Con questa leva lo stop è tutto." : "Una gara è un esercizio: conta il fondo comune.", kind: "chiacchiera", label: "La gara", state: "talk" });
    const spots = {}, states = {};
    cast.forEach((k, i) => { spots[k] = `trading.gara.${i + 1}`; states[k] = "think"; });
    sceneStart({ kind: "gara", cast, spots, states, lines, actId: "gara", actLabel: ACT.gara[0], room: "trading", hold: 3 });
    focus({ keys: cast, room: "trading", priority: 2, holdS: 20, reason: "gara" });
  }
  // the winner's party, once per finished contest (the owner's browser remembers it)
  const partyDone = new Set();
  function partyStep() {
    if (scene || L.mode !== "vita") return;
    const r = U.rome();
    if (r.minutes < 480 || r.minutes > 1290) return;
    for (const c of D.contests()) {
      const sit = c.situazione, win = sit && sit.vincitore;
      if (c.doc.finita !== true || !has(TR, win) || partyDone.has(c.id)) continue;
      partyDone.add(c.id);
      const key = "cp-gara-festa-" + c.id;
      let seen = false;
      try { seen = !!window.localStorage.getItem(key); } catch (e) { seen = false; }
      if (seen) continue;
      const cast = [win, ...TR.filter((k) => k !== win), "preside"].filter((k) => awake(k) && free(k) && blockOf(k, r) !== "notte");
      if (!has(cast, win)) continue;
      const spots = {}, states = {}, look = {};
      const f0 = anchorOf("cortile.fountain") || { x: 0, z: 0 };
      const ring = Object.values((W() && W().anchors) || {}).filter((an) => an.id.startsWith("cortile.spot.")).sort((x, y) => dist(x, f0) - dist(y, f0));
      cast.forEach((k, i) => { spots[k] = k === win ? "cortile.fountain" : ring[i - 1] ? ring[i - 1].id : null; states[k] = k === win ? "gesture" : "listen"; look[k] = k === win ? null : win; });
      const lines = [];
      const rk = ranking(c), me = rk.find((x) => x.k === win);
      REG = new Set();
      const t1 = me ? `Ho vinto la gara ${contestName(c.id)} con ${f(U.fmt(me.risultato, 2, true))} USDT.${isNum(sit.premio) && sit.premio ? " Il premio: " + f(U.fmt(sit.premio, 2, true)) + " USDT finti." : ""}` : "";
      if (t1 && lineOk(t1)) lines.push({ who: win, to: null, text: t1, kind: "chiacchiera", label: "La festa della gara", state: "gesture" });
      const com = typeof c.doc.commento === "string" && c.doc.commento.trim() ? c.doc.commento : null;
      if (com) lines.push({ who: "preside", to: win, text: U.plain(com, 400), kind: "ufficiale", label: "La festa della gara", source: "gara " + contestName(c.id), state: "talk" });
      sceneStart({ kind: "festa", cast, spots, states, look, lines, actId: "festa", actLabel: ACT.festa[0], room: "cortile", hold: 40, onHold: (sc) => { if (Math.floor(sc.t) % 4 === 0) for (const k of sc.cast) if (k !== win) setState(k, R() < 0.5 ? "gesture" : "listen"); }, gap: 0.6 });
      focus({ keys: cast, room: "cortile", priority: 2, holdS: 40, reason: "festa" });
      try { window.localStorage.setItem(key, "1"); } catch (e) { /* private window */ }
      return;
    }
  }

  // ---- the live meeting (§5.4.2 diretta): a port of liveScript and liveMoves ---------------------------------------------
  const liveSeen = new Set();
  let liveKey = "", liveBoardKey = "";
  const liveTitle = (Lv) => (Lv.fase === "palestra" ? "La palestra · in diretta" : Lv.fase === "sera" ? "La sera · in diretta" : `Riunione ${Lv.giorno ?? ""} · in diretta`);
  function liveMoves(fase, who) {
    const m = Object.fromEntries(KEYS.map((w) => [w, "seat"]));
    if (fase === "inizio") m.preside = "board";
    if (has(["motore", "ordini", "chiusura", "posizioni", "palestra", "sera"], fase)) m.preside = "stand";
    if (fase === "briefing") m.cronista = "shelf";
    if (fase === "domande") m.scettico = "stand";
    if (has(["posizioni", "risposte", "palestra", "sera"], fase) && has(GR, who)) m[who] = "stand";
    return m;
  }
  function liveSync() {
    const Lv = U.liveNow(C.data.live);
    if (!Lv) return;
    const log = arr(Lv.log).filter(obj).length ? arr(Lv.log).filter(obj) : [Lv];
    for (const e of log) {
      const key = `${e.ora}|${e.attore}|${e.testo}`;
      if (liveSeen.has(key)) continue;
      liveSeen.add(key);
      feed({ who: NM[e.attore] ? e.attore : "preside", kind: "ufficiale", label: C.FASE[e.fase] || "", text: String(e.testo || ""), at: String(e.ora || nowText()), room: e.fase === "palestra" ? "palestra" : "riunione", source: "in diretta" });
    }
    const last = log[log.length - 1];
    const who = NM[Lv.attore] ? Lv.attore : "preside";
    const bk = `${Lv.fase}|${Lv.giorno}`;
    if (bk !== liveBoardKey) {
      liveBoardKey = bk;
      surf("board", [liveTitle(Lv), Lv.fase === "palestra" ? "20 casi dal passato per ognuno" : Lv.fase === "sera" ? "il controllo della sera ha suonato" : U.cap(C.FASE[Lv.fase] || Lv.fase || "")], 1);
      surf("motore", null, Lv.fase === "ordini" ? "ESEGUO GLI ORDINI" : Lv.fase === "motore" ? "FACCIO I CONTI" : Lv.fase === "palestra" ? "LA PALESTRA" : Lv.fase === "sera" ? "LA SERA" : "");
      if (Lv.fase === "palestra") surf("palestra", ["La palestra · in diretta", "20 casi dal passato per ognuno"]);
    }
    const key = `${last.ora}|${last.attore}|${last.testo}`;
    if (key !== liveKey) {
      liveKey = key;
      const text = U.plain(Lv.testo, 200) || "…";
      say(who, { text, label: C.FASE[Lv.fase] || "in diretta", kind: "ufficiale", ms: U.sayMs(text) });
      if (has(KEYS, who)) setState(who, "talk");
      for (const k of KEYS) if (k !== who && liveDirective(k)) lookAt(k, who === "motore" ? "riunione.screen" : who);
      const room = Lv.fase === "palestra" ? "palestra" : "riunione";
      focus({ keys: [who], room, priority: 3, holdS: U.sayMs(text) / 1000, reason: "diretta" });
    }
  }
  function liveDirective(k) {
    const Lv = U.liveNow(C.data.live);
    if (!Lv) return null;
    const who = NM[Lv.attore] ? Lv.attore : "preside", fase = Lv.fase;
    if (fase === "palestra") {
      if (has(TR, k)) return { id: "palestra_casi", anchor: `palestra.desk.${k}`, state: "think" };
      if (k === "preside") return { id: "palestra_guida", anchor: "palestra.board", state: who === "preside" ? "talk" : "gesture" };
      if (k === "scettico") return { id: "palestra_scettico", anchor: "palestra.stand.scettico", state: "listen" };
      return null;
    }
    if (fase === "sera" && !has(SERA_CAST, k)) return null;
    const [anchor, state] = spotAnchor(k, liveMoves(fase, who)[k]);
    return { id: "riunione", anchor, state: k === who ? "talk" : state, force: anchor.startsWith("riunione.board") || anchor === "riunione.shelf" };
  }

  // ---- the Sunday gym (§5.4.2 palestra) ---------------------------------------------------------------------------------
  let gymDrip = { date: "", i: 0, next: 0, list: null }, gymBoard = false;
  function gymStep(r) {
    if (!gymBoard) { gymBoard = true; surf("palestra", ["La palestra", "20 casi dal passato per ognuno"]); focus({ room: "palestra", priority: 2, holdS: 10, shot: "wide", reason: "palestra" }); }
    const doc = obj(C.data.palestre && C.data.palestre[r.date]);
    if (!doc) return;
    if (gymDrip.date !== r.date) {
      const list = [];
      const ag = obj(doc.agenti) || {};
      for (const k of TR) { const x = obj(ag[k]); if (x && typeof x.lezione === "string" && x.lezione.trim()) list.push({ who: k, text: x.lezione, label: "La lezione della palestra" }); }
      for (const k of TR) { const x = obj(ag[k]), nr = x && obj(x.nuova_regola); if (nr && nr.testo) list.push({ who: k, text: "Nuova regola: " + nr.testo, label: "La regola nuova" }); }
      const sc = obj(doc.scettico);
      if (sc && sc.testo) list.push({ who: "scettico", text: sc.testo, label: "Lo Scettico in palestra" });
      gymDrip = { date: r.date, i: 0, next: T + 4, list };
    }
    if (T < gymDrip.next || gymDrip.i >= gymDrip.list.length) return;
    const it = gymDrip.list[gymDrip.i++];
    gymDrip.next = T + 20;
    const text = U.plain(it.text, 240);
    say(it.who, { text, label: it.label, kind: "ufficiale" });
    setState(it.who, it.who === "scettico" ? "talk" : "write");
    feed({ who: it.who, kind: "ufficiale", label: it.label, text: it.text, room: "palestra", source: "palestra del " + U.dm(r.date) });
    focus({ keys: [it.who], room: "palestra", priority: 2, holdS: U.sayMs(text) / 1000, reason: "palestra" });
  }

  // ---- the mode (§5.4.2) -------------------------------------------------------------------------------------------------
  let waitLine = "";
  function meetingDone(date) {
    const v = C.data.verbali && C.data.verbali[date], u = ult();
    return !!((obj(v) && v.stato) || (u && u.data === date && u.stato));
  }
  function emergencyNow(r) { const S = obj(C.data.sera); return !!(S && S.allarme === true && S.data === r.date && r.minutes >= 1241 && r.minutes < 1350); }
  function computeMode(r) {
    const Lv = U.liveNow(C.data.live);
    if (Lv) return ["diretta", `In diretta · ${C.FASE[Lv.fase] || Lv.fase || ""} · aggiornata alle ${U.romeTime(Lv.ora)}`];
    if (rep) return ["replica", replayDetail()];
    if (emergencyNow(r)) { const S = obj(C.data.sera), m = arr(S.motivi).filter(Boolean)[0]; return ["emergenza", "Riunione straordinaria della sera" + (m ? ": " + U.plain(U.human(m), 120) : "")]; }
    if (r.weekday === 0 && r.minutes >= 665 && r.minutes < 750) return ["palestra", MODE_TXT.palestra];
    if (r.minutes >= 400 && r.minutes < 460 && schoolDay(r.date) && !meetingDone(r.date)) return ["riunione", r.minutes < 407 ? "Aspettano la riunione delle 06:47" : MODE_TXT.riunione];
    if (KEYS.filter((k) => blockOf(k, r) === "notte").length >= 5) return ["notte", MODE_TXT.notte];
    return ["vita", MODE_TXT.vita];
  }
  function setMode(mode, detail) {
    if (mode === L.mode && detail === L.modeDetail) return false;
    const prev = L.mode;
    L.mode = mode;
    L.modeDetail = detail;
    bus.emit("life:mode", { mode, detail });
    if (mode !== prev) onModeChange(prev, mode);
    return true;
  }
  function onModeChange(prev, mode) {
    // a live meeting wins over a replay: the replay ends, so the clock and the seats are the live ones
    if (mode === "diretta" && (rep || replayWait)) { replayWait = null; if (rep) endReplay(true); }
    if (prev === "palestra") { gymBoard = false; surf("palestra", null); }
    if (prev === "emergenza") { if (sera) { for (const k of sera.cast) if (A[k].lock === "sera") A[k].lock = null; sera = null; } if (scene && scene.kind === "allarme") endScene(scene, true); boardDefault(); }
    if (prev === "diretta") { liveBoardKey = ""; boardDefault(); surf("motore", null, ""); if (C.data.live && C.data.live.fase === "palestra") surf("palestra", null); }
    if (prev === "riunione") boardDefault();
    if (mode === "riunione") {
      const t = D.today();
      surf("board", [t ? `Riunione ${t.giorno ?? ""} · ${U.longDay(t.data)}` : "La riunione del mattino", t ? U.plain(t.tema || "", 110) : ""].filter(Boolean), 1);
      focus({ room: "riunione", priority: 2, holdS: 8, shot: "wide", reason: "riunione" });
    }
    if (mode === "diretta" || mode === "replica" || mode === "riunione" || mode === "emergenza" || mode === "palestra") for (const e of encs.slice()) endEncounter(e, false);
    if ((mode === "diretta" || mode === "replica") && scene) endScene(scene, true);
    if (mode === "vita" && prev && prev !== "vita") focus({ shot: "campus", priority: 1, holdS: 6, reason: "vita" });
  }
  function evalMode(force) {
    const r = U.rome();
    const [mode, detail] = computeMode(r);
    const changed = setMode(mode, detail);
    if (mode === "emergenza") seraStep(r);
    if (mode === "palestra") gymStep(r);
    if (mode === "riunione" && waitLine !== r.date && r.minutes >= 400) {
      waitLine = r.date;
      REG = new Set();
      sayLater = { who: "preside", text: "Aspettiamo l'inizio della riunione.", at: T + 6 };
    }
    return changed || force;
  }
  let sayLater = null;

  // ---- the planner: what each agent should be doing now ------------------------------------------------------------------
  function directive(k, r) {
    const mode = L.mode, blk = blockOf(k, r), a = A[k];
    if (mode === "diretta") { const d = liveDirective(k); if (d) return { ...d, fixed: true }; }
    if (mode === "emergenza" && has(SERA_CAST, k)) return { id: "sera", anchor: `riunione.seat.${k}`, state: "listen", fixed: true };
    if (mode === "palestra") {
      if (has(TR, k)) return { id: "palestra_casi", anchor: `palestra.desk.${k}`, state: R() < 0.5 ? "think" : "write", fixed: true };
      if (k === "preside") return { id: "palestra_guida", anchor: "palestra.board", state: "talk", fixed: true };
      if (k === "scettico") return { id: "palestra_scettico", anchor: "palestra.stand.scettico", state: "listen", fixed: true };
    }
    if (mode === "riunione") return r.minutes < 407 ? { id: "attesa", anchor: `riunione.seat.${k}`, state: "sit", fixed: true } : { id: "riunione", anchor: `riunione.seat.${k}`, state: "listen", fixed: true };
    if (blk === "notte") {
      if (a.night && T < a.night.until && a.night.started) return { id: "gara", label: "guarda la gara, di notte", fixed: true, keep: true };
      return { id: "dormire", anchor: `dorm_${k}.bed`, state: "sleep", fixed: true };
    }
    if (blk === "sveglia") return { id: "prepararsi", anchor: `dorm_${k}.spot`, state: "idle", fixed: true };
    if (blk === "caffe") return { id: "caffe", fixed: true, keep: true };
    if (blk === "pranzo" && k === "tartaruga") return { id: "pasto", patterns: ["cortile.bench.*", "mensa.seat.*"], label: "mangia in cortile", fixed: true, keep: true };
    if (blk === "pranzo" || blk === "cena") return { id: "pasto", fixed: true, keep: true };
    if (blk === "controllo" && k === "guardiano") return { id: "rischio", anchor: "trading.desk.guardiano", state: "type", fixed: true };
    return null;
  }
  function plan(r) {
    // who is about to choose this tick does not count as being anywhere yet
    for (const k of KEYS) { const a = A[k], blk = blockOf(k, r); a.pending = !a.lock && !a.enc && (blk !== a.block || a.replan || !a.act || a.act.fixed || T >= a.act.until); }
    for (const k of KEYS) {
      const a = A[k];
      if (a.lock || a.enc) continue;
      const blk = blockOf(k, r);
      if (blk !== a.block) { a.block = blk; a.replan = true; }
      if (!a.arrived && has3d() && T > a.deadline && a.act) { if (a.act.anchor) place(k, a.act.anchor, a.act.state); a.arrived = true; arrive(k); }
      nightContest(k, r, blk);
      const dir = directive(k, r);
      if (dir) {
        const same = a.act && a.act.id === dir.id && (dir.keep || !dir.anchor || a.act.anchor === dir.anchor);
        if (!same) { if (!start(k, dir.id, dir) && dir.id !== "dormire") { if (!a.act || a.act.fixed) choose(k); } }
        else if (dir.state && a.act.state !== dir.state && a.arrived && dir.id === "riunione") { a.act.state = dir.state; setState(k, dir.state); }
        else if (L.mode !== "diretta" && dir.id !== "dormire") vary(k);
        a.replan = false;
        a.pending = false;
        continue;
      }
      if (!a.act || a.act.fixed || a.replan || T >= a.act.until) { a.replan = false; choose(k); a.pending = false; continue; }
      progress(k);
    }
  }
  // inside a long activity the body does not freeze: another state the anchor allows, a glance at a neighbour
  function vary(k) {
    const a = A[k], act = a.act, an = act && a.arrived && anchorOf(act.anchor);
    if (!an || act.loop || a.speakUntil > T || a.thinkUntil > T || !has3d()) return;
    if (!act.vary) { act.vary = T + rnd(12, 25); return; }
    if (T < act.vary) return;
    act.vary = T + rnd(12, 28);
    const near = KEYS.filter((o) => o !== k && !A[o].lock && dist(posOf(o), posOf(k)) < 2.6);
    const opts = arr(an.states).filter((x) => x !== "talk" && x !== "listen" && x !== "sleep" && (an.posture !== "stand" || x !== "sit"));
    const st = R() < 0.55 || !opts.length ? act.state : pick(opts);
    setState(k, st);
    lookAt(k, near.length && R() < 0.4 ? pick(near) : null);
  }
  function progress(k) {
    const a = A[k], act = a.act;
    if (!act) return;
    vary(k);
    if (act.id === "visita") { visitStep(k); return; }
    if (act.loop && a.arrived && T >= act.loop.pause) {
      const lp = act.loop;
      lp.i++;
      if (lp.i >= lp.ids.length) { act.until = T; return; }
      const id = lp.ids[lp.i];
      if (W() && W().occupant && W().occupant(id) && W().occupant(id) !== k) { lp.pause = T; return; }
      if (act.anchor && W() && W().release) W().release(act.anchor, k);
      if (W() && W().reserve) W().reserve(id, k);
      act.anchor = id;
      const an = anchorOf(id);
      if (an) act.room = an.room;
      move(k, id, R() < 0.3 ? "think" : "idle", {});
      if (a.arrived) arrive(k);
    }
  }
  function nightContest(k, r, blk) {
    const a = A[k];
    if (!has(TR, k) || blk !== "notte" || L.mode !== "notte") { a.night = null; return; }
    const c = contest();
    if (!c || !c.scadenza || c.scadenza.getTime() - C.clock.real().getTime() > 12 * 3600000) { a.night = null; return; }
    const hourKey = `${k}|${r.date}|${r.hh}`;
    if (!a.night || a.night.key !== hourKey) {
      const rr = U.rng(hourKey);
      a.night = rr() < 0.25 ? { key: hourKey, at: Math.floor(rr() * 50), until: Infinity, started: false } : { key: hourKey, at: 99, started: false };
    }
    if (!a.night.started && r.mm >= a.night.at && a.night.at < 99) { a.night.started = true; a.night.until = T + rnd(180, 360); }
  }

  // ---- Fateli parlare (§5.4.9, Appendix D) --------------------------------------------------------------------------------
  let talkRun = null;
  function dati(keys, topic) {
    const out = [], now = C.clock.now(), r = U.rome(now);
    out.push(`Oggi è ${U.longDay(r.date)}, a Roma sono le ${U.romeClock(now)}.`);
    for (const k of keys) {
      const w = D.wallet(k);
      if (w && isNum(w.judg)) out.push(`${nm(k)}: a giudizio ${U.fmt(w.judg, 2)} USDT${isNum(w.pnlPct) ? ` (${U.pct(w.pnlPct)})` : ""}${isNum(w.rules) ? `, la sua regola ${U.fmt(w.rules, 2)} USDT` : ""}${isNum(w.gap) ? `, differenza ${U.fmt(w.gap, 2, true)} USDT` : ""}.`);
      if ((topic === "mercato" || topic === "libero") && has(TR, k)) { const ps = posTxt(k); if (ps.length) out.push(`Posizioni aperte ${di(k)} a giudizio: ${ps.join(", ")}.`); }
    }
    for (const k of keys) {
      const l = D.lesson(k);
      const unq = (t, n) => U.plain(t, n).replace(/\.$/, "");
      if (l) out.push(`Ultima lezione ${di(k)}: «${unq(l.testo, 200)}».`);
      const p = D.openPrediction(k);
      if (p && p.mercato && isNum(U.toNum(p.livello))) out.push(`Previsione aperta ${di(k)}: ${U.predText(p)}.`);
      const c = D.calibration(k);
      if (c && isNum(c.sicurezza_media) && isNum(c.successi)) out.push(`Calibrazione ${di(k)}: dice in media il ${U.prob(c.sicurezza_media)} e ci prende il ${U.prob(c.successi)}, su ${c.n} previsioni.`);
      const v = D.votes(k), pv = v && obj(v.preside);
      if (pv && isNum(U.toNum(pv.ragionamento)) && isNum(U.toNum(pv.disciplina))) out.push(`Ultimi voti ${di(k)}: ragionamento ${U.small(pv.ragionamento)}, disciplina ${U.small(pv.disciplina)}.`);
      if (topic === "errori" || topic === "libero") { const e = errorOf(k); if (e) out.push(`Errore che torna ${di(k)}: «${unq(e.testo, 140)}» (${U.toNum(e.volte)} volte).`); }
    }
    const px = D.prices(), at = obj(C.data.giudizio) && C.data.giudizio.prices_at;
    const pl = (c) => (isNum(px[c]) ? `${c}: ${U.price(px[c])} USDT${at ? ` (${U.romeTime(at)})` : ""}.` : "");
    out.push(pl("BTC"));
    if (topic === "mercato") out.push(pl("ETH"), pl("SOL"));
    out.push("Ognuno è partito con 10.000 USDT finti: 80.000 in tutto, per 88 giorni di scuola.");
    const F = D.fund(), g = D.graduation();
    if (F && isNum(F.capitale)) out.push(`Il fondo comune: ${U.fmt(F.capitale, 2)} USDT su 80.000 (${U.pct(F.pct)}). Mancano ${g.days} giorni alla laurea.`);
    else out.push(`Mancano ${g.days} giorni alla laurea.`);
    const al = alarms().filter((s) => has(keys, "guardiano") || has(keys, alarmTarget(s))).slice(0, 2);
    if (al.length) out.push(`Allarmi del Guardiano oggi: ${al.map((s) => U.plain(U.human(s), 160)).join(" · ")}`);
    const cs = D.contests()[0];
    if (cs) {
      const rk = ranking(cs), mine = rk.filter((x) => has(keys, x.k));
      const parts = mine.map((x) => `${nm(x.k)} ${U.usd(x.risultato, true)} (${rankWord(x.k, rk.indexOf(x))} su ${rk.length})`);
      out.push(`La gara ${contestName(cs.id)}${cs.open ? " (aperta)" : cs.doc.finita ? " (finita)" : " (chiusa, in attesa dei conti)"}${parts.length ? ": " + parts.join(", ") : ""}${cs.scadenza ? (cs.open ? `; si chiude ${U.romeTime(cs.scadenza)}` : `; si è chiusa ${U.romeTime(cs.scadenza)}`) : ""}.`);
    }
    const u = ult();
    if (u && u.data && (u.titolo || u.tema)) out.push(`L'ultima riunione (${U.dm(u.data)}): «${U.plain(u.titolo || u.tema, 160).replace(/\.$/, "")}».`);
    return out.filter((x) => x && !BAD.test(x)).map((x) => "- " + elide(x));
  }
  function buildTalkPrompt(keys, topic) {
    keys = arr(keys).filter((k, i, xs) => has(KEYS, k) && xs.indexOf(k) === i);
    const label = TOPIC_LABEL[topic] || TOPIC_LABEL.libero;
    const persone = keys.map((k) => {
      const [indole, voce, difetto] = PERSONA[k];
      return `- ${nm(k)} (${k}): ${ROLE[k].replace(/\.$/, "")}. ${U.cap(indole)}. Come parla: ${voce}. Il suo difetto: ${difetto}. Oggi è ${fem(k) ? A[k].mood.replace(/o$/, "a") : A[k].mood}${A[k].moodWhy ? ` (${elide(A[k].moodWhy)})` : ""}.`;
    });
    const D5 = dati(keys, topic);
    const prompt = [
      `Sei lo sceneggiatore della Scuola Cripto, una scuola privata di trading con soldi finti: otto agenti di intelligenza artificiale studiano le criptovalute sui prezzi veri di BingX. Scrivi un breve dialogo tra ${theList(keys)}, in italiano semplice.`,
      "", `L'argomento: ${label}.`, "", "Chi parla:", ...persone, "",
      "I fatti di oggi (DATI). Sono gli unici numeri che puoi usare:", ...D5, "",
      "Le regole:",
      "1. Da 6 a 10 battute, alternate; ognuno parla almeno una volta; ogni battuta al massimo 200 caratteri.",
      "2. Usa solo i numeri scritti nei DATI, scritti come lì. Se un numero non c'è, parla senza numeri.",
      "3. Niente notizie, prezzi o fatti inventati. Niente promesse di guadagno. Niente soldi veri.",
      "4. Sono agenti di intelligenza artificiale: non dicono di essere coscienti e non fingono emozioni umane forti.",
      "5. Lavorano in squadra: l'obiettivo comune è il fondo degli 8 portafogli e la tesi da scegliere insieme per la laurea del 21/2/2027.",
      "6. Ognuno resta nel suo carattere.", "",
      "Rispondi solo con un oggetto JSON, senza altro testo:",
      `{"titolo": "al massimo 60 caratteri", "battute": [{"chi": "${keys[0] || "preside"}", "a": "${keys[1] || "tutti"}", "testo": "…", "gesto": "talk"}]}`,
      `"chi" e "a" sono chiavi tra: ${keys.join(", ")}; "a" può essere "tutti". "gesto" è uno tra talk, gesture, think, listen, drink.`,
    ].join("\n");
    const numbers = [];
    for (const t of toks(D5.join("\n"))) { const v = nrm(t); if (Number.isFinite(v)) numbers.push(String(v)); }
    const allowed = [...signedOf(D5.join("\n")), ...signedOf(persone.join("\n")), ...signedOf(label)];
    return { prompt, numbers, allowed };
  }
  function validateTalk(res, keys, allowed) {
    const raw = obj(res) && Array.isArray(res.battute) ? res.battute : null;
    if (!raw) return { code: "invalid_json", lines: [] };
    const lines = [];
    for (const b of raw) {
      if (!obj(b) || !has(keys, b.chi) || typeof b.testo !== "string" || !b.testo.trim()) continue;
      if (b.a !== undefined && b.a !== null && b.a !== "tutti" && !has(keys, b.a)) continue;
      const testo = U.plain(b.testo, 240);
      if (!testo || !talkNumbersOk(testo, allowed)) continue;
      lines.push({ chi: b.chi, a: has(keys, b.a) && b.a !== b.chi ? b.a : b.a === "tutti" ? "tutti" : null, testo, gesto: has(GESTI, b.gesto) ? b.gesto : "talk" });
    }
    let titolo = typeof res.titolo === "string" ? U.plain(res.titolo, 60) : "";
    if (!titolo || !talkNumbersOk(titolo, allowed)) titolo = "Dialogo";
    return { lines: lines.slice(0, 10), titolo, code: lines.length < 2 ? "numeri" : null };
  }
  // a standing circle round a point, every spot on a walkable floor; two people stand 1,1 m apart
  function circleAt(c, n) {
    const w = W(), r = n === 2 ? 0.55 : 0.85, out = [];
    for (let rot = 0; rot < 6 && out.length < n; rot++) {
      out.length = 0;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 2 * PI + rot * 0.5, p = { x: c.x + Math.sin(ang) * r, z: c.z + Math.cos(ang) * r };
        if (w && w.roomAt && !w.roomAt(p.x, p.z)) break;
        if (w && w.clear && !w.clear(c, p)) break;
        out.push({ x: p.x, z: p.z, face: Math.atan2(c.x - p.x, c.z - p.z) });
      }
    }
    return out.length === n ? out : null;
  }
  // free chat anchors close enough to seat the whole group together (everyone within 3,2 m)
  function seatGroup(list, keys) {
    const w = W(), n = keys.length;
    list = list.filter((an) => !an.owner && (!w || !w.occupant || !w.occupant(an.id) || has(keys, w.occupant(an.id))));
    const c = keys.reduce((s2, k) => { const p = posOf(k); return { x: s2.x + p.x / n, z: s2.z + p.z / n }; }, { x: 0, z: 0 });
    let best = null, bestD = Infinity;
    for (const seed of list) {
      const g = list.slice().sort((x, y) => dist(x, seed) - dist(y, seed)).slice(0, n);
      if (g.length < n || g.some((x) => g.some((y) => dist(x, y) > 3.2))) continue;
      const d = dist(seed, c);
      if (d < bestD) { bestD = d; best = g; }
    }
    return best ? best.map((an) => an.id) : null;
  }
  function venueFor(keys) {
    const r = U.rome(), blk = blockOf("preside", r), rooms = keys.map(roomOf), w = W();
    const same = rooms.every((x) => x && x === rooms[0]) && !rooms[0].startsWith("dorm_") && rooms[0] !== "corridoio" ? rooms[0] : null;
    const all = w && w.anchors ? Object.values(w.anchors) : [];
    if (same) {
      const g = seatGroup(all.filter((an) => an.room === same && has(an.tags || [], "chat")), keys);
      if (g) return g;
      const c = circleAt(posOf(keys[0]), keys.length);
      if (c) return c;
    }
    const kind = has(["pranzo", "cena", "controllo", "serata", "caffe"], blk) ? "mensa.seat." : blk === "notte" || L.mode === "notte" ? "biblioteca.armchair." : "cortile.bench.";
    const g = seatGroup(all.filter((an) => an.id.startsWith(kind)), keys);
    if (g) return g;
    // by day in the garden: a standing circle just outside the fountain's ring of paths
    const base = kind === "cortile.bench." ? all.filter((an) => an.id.startsWith("cortile.spot.")) : all.filter((an) => an.id.startsWith(kind));
    for (const an of base.sort((x, y) => dist(x, posOf(keys[0])) - dist(y, posOf(keys[0])))) {
      const out = Math.hypot(an.x, an.z) > 0.5 && kind === "cortile.bench." ? { x: an.x * 1.35, z: an.z * 1.35 } : { x: an.ax ?? an.x, z: an.az ?? an.z };
      const c = circleAt(out, keys.length);
      if (c) return c;
    }
    const p0 = posOf(keys[0]);
    return keys.map((k, i) => { if (!i) return { x: p0.x, z: p0.z }; const ang = (i / keys.length) * 2 * PI; return { x: p0.x + Math.sin(ang) * 1.1, z: p0.z + Math.cos(ang) * 1.1, face: ang + PI }; });
  }
  function talkEmit(state, extra) { bus.emit("life:talk", { state, keys: talkRun ? talkRun.keys.slice() : [], ...(extra || {}) }); }
  async function talk(keys, topic, opts = {}) {
    if (!ctx || !ctx.sample) return { ok: false, code: "not_granted" };
    const ks = arr(keys).filter((k, i, xs) => has(KEYS, k) && xs.indexOf(k) === i);
    if (ks.length < 2 || ks.length > 4 || ks.length !== arr(keys).length || !TOPIC_LABEL[topic]) return { ok: false, code: "invalid" };
    if (L.mode === "diretta" || L.mode === "replica" || talkRun || ks.some((k) => A[k].lock === "sera" || A[k].lock === "replica")) return { ok: false, code: "busy" };
    if (topic === "gara" && !D.contests().length) return { ok: false, code: "invalid" };
    const { prompt, allowed } = buildTalkPrompt(ks, topic);
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const run = (talkRun = { keys: ks, ctl, cancelled: false, resolve: null });
    L.talkState = "thinking";
    talkEmit("thinking");
    let res;
    try {
      res = await ctx.sample.json(prompt, { modelTier: "default", ...(ctl ? { signal: ctl.signal } : {}), ...(opts.fresh ? { cache: false } : {}) });
    } catch (e) {
      const code = run.cancelled ? "cancelled" : (e && e.code) || "upstream_error";
      return talkFail(run, code);
    }
    if (run.cancelled || talkRun !== run) return talkFail(run, "cancelled");
    if (L.mode === "diretta" || L.mode === "replica") return talkFail(run, "busy");
    const v = validateTalk(res, ks, allowed);
    if (v.code) return talkFail(run, v.code);
    return new Promise((resolve) => {
      run.resolve = resolve;
      const venue = venueFor(ks), spots = {}, states = {};
      ks.forEach((k, i) => { spots[k] = venue[i]; states[k] = "listen"; });
      const label = "dialogo con " + theList(ks.length > 1 ? ks : ks);
      L.talkState = "walking";
      talkEmit("walking");
      const lines = v.lines.map((b) => ({ who: b.chi, to: b.a && b.a !== "tutti" ? b.a : null, text: b.testo, kind: "claude", label: v.titolo, source: "dialogo chiesto da te", state: b.gesto === "listen" ? "talk" : b.gesto }));
      const sc = sceneStart({ kind: "dialogo", cast: ks, spots, states, lines, actId: "dialogo", actLabel: label, room: null, hold: 1, gap: 0.4 });
      for (const k of ks) { A[k].act.label = "dialogo con " + theList(ks.filter((x) => x !== k)); P("setTag", k, { act: A[k].act.label }); }
      sc.look = Object.fromEntries(ks.map((k, i) => [k, ks[(i + 1) % ks.length]]));
      sc.onPlay = () => { L.talkState = "playing"; talkEmit("playing"); };
      sc.done = (s, aborted) => {
        if (talkRun === run) talkRun = null;
        L.talkState = "idle";
        if (aborted) { talkEmit("error", { code: "cancelled", keys: ks }); resolve({ ok: false, code: "cancelled" }); return; }
        bus.emit("life:talk", { state: "done", keys: ks, lines: lines.length });
        resolve({ ok: true, lines: lines.length });
      };
    });
  }
  function talkFail(run, code) {
    if (talkRun === run) talkRun = null;
    L.talkState = "idle";
    bus.emit("life:talk", { state: "error", keys: run.keys.slice(), code });
    return { ok: false, code };
  }
  function cancelTalk() {
    const run = talkRun;
    if (!run) return;
    run.cancelled = true;
    if (run.ctl) { try { run.ctl.abort(); } catch (e) { /* already done */ } }
    if (scene && scene.kind === "dialogo") endScene(scene, true);
  }

  // ---- status, where, mind -------------------------------------------------------------------------------------------------
  function where(k) {
    if (!A[k]) return null;
    const a = A[k], p = posOf(k), w = W();
    const room = (w && w.roomAt && w.roomAt(p.x, p.z)) || (a.act && a.act.room) || null;
    return { x: p.x, z: p.z, room, anchor: a.arrived && a.act ? a.act.anchor || null : null };
  }
  function status() {
    return KEYS.map((k) => {
      const a = A[k], wh = where(k), act = a.act;
      const st = (has3d() && P("stateOf", k)) || (a.speakUntil > T ? "talk" : act ? act.state : "idle");
      return { key: k, name: nm(k), state: st, activity: a.enc ? "incontro" : act ? act.id : "", label: labelNow(k), room: wh ? wh.room : null, roomName: wh && wh.room ? roomName(wh.room) : "", since: act ? act.since : null, mood: a.mood, moodLabel: a.moodLabel, moodWhy: a.moodWhy, speaking: a.speakUntil > T };
    });
  }
  function mind(k) {
    const s = status().find((x) => x.key === k);
    if (!s) return null;
    const c = D.calibration(k);
    return { ...s, wallet: D.wallet(k), lezione: D.lesson(k), previsione: D.openPrediction(k), calibrazione: c ? { n: c.n, brier: c.brier, eccesso: c.eccesso_di_sicurezza } : null, voti: D.votes(k) };
  }

  // ---- the feed seeding, data changes ------------------------------------------------------------------------------------------
  const seeded = new Set();
  function seedFeed() {
    const u = ult();
    if (!u || !u.data || seeded.has(u.data)) return;
    seeded.add(u.data);
    const righe = arr(obj(u.chiusura) && u.chiusura.righe).filter((x) => typeof x === "string" && x.trim());
    righe.forEach((t, i) => feed({ who: "preside", kind: "ufficiale", label: RIGHE[i] || `Riga ${i + 1}`, text: t, at: u.scritto || nowText(), room: "riunione", source: "verbale del " + U.dm(u.data) }, true));
  }
  function onData(keys) {
    MODS = null;
    if (keys.includes("ultimo")) { seedFeed(); if (L.mode === "vita" || L.mode === "notte") boardDefault(); }
    if (replayWait && (keys.includes("verbali") || keys.includes("ultimo"))) {
      const d = C.data.verbali && C.data.verbali[replayWait.date];
      if (d === null) { const dt = replayWait.date; replayWait = null; bus.emit("life:replay", { state: "error", date: dt, step: 0, total: 0 }); }
      else if (obj(d)) { const w = replayWait; replayWait = null; if (!U.liveNow(C.data.live)) startReplay(w.date, d, w.opts); }
    }
    if (keys.includes("live")) { evalMode(); liveSync(); }
    updateMoods();
  }
  function replaceAll() {
    for (const k of KEYS) {
      const a = A[k];
      if (a.act && a.act.anchor) place(k, a.act.anchor, a.act.state);
      a.arrived = true;
      arrive(k);
    }
  }

  // ---- the loop ------------------------------------------------------------------------------------------------------------------
  function think(step) {
    const r = U.rome();
    secAcc += step;
    if (secAcc >= 1 || !L.mode) { secAcc = 0; evalMode(); if (L.mode === "diretta") liveSync(); }
    if (jumpPending) { jumpPending = false; instantOnce = true; for (const k of KEYS) A[k].replan = true; }
    if (replayWait && Date.now() > replayWait.until) {
      const w = replayWait;
      if (w.late) replayWait = null;
      else { w.late = true; w.until = Date.now() + 60000; bus.emit("life:replay", { state: "error", date: w.date, step: 0, total: 0, slow: true }); }
    }
    plan(r);
    instantOnce = false;
    if (sayLater && T >= sayLater.at) {
      const s = sayLater; sayLater = null;
      if (L.mode === "riunione") { say(s.who, { text: s.text, label: "In attesa", kind: "chiacchiera" }); feed({ who: s.who, kind: "chiacchiera", label: "In attesa", text: s.text, room: "riunione" }); focus({ keys: [s.who], room: "riunione", priority: 1, holdS: 4, reason: "attesa" }); }
    }
    checkEncounters(step);
    checkThoughts(step);
    contestStep();
    partyStep();
    moodAcc += step;
    if (moodAcc >= 30) { moodAcc = 0; updateMoods(); }
  }
  // the brain runs on real elapsed time (the frame dt is capped at 0.1 s, slow frames would slow it down and
  // put it out of step with the bubbles, which people times in real milliseconds)
  let lastP = 0;
  function update(dt) {
    if (!inited) return;
    const p = performance.now(), real = lastP ? (p - lastP) / 1000 : dt || 0;
    lastP = p;
    step(Math.max(0, Math.min(real, 1)));
  }
  function step(dt) {
    T += dt;
    const sim = C.clock.now().getTime();
    if (lastSim && Math.abs(sim - lastSim - dt * 1000) > 90000) jumpPending = true;
    lastSim = sim;
    if (rep) { runBeats(rep, dt); syncReplayState(); }
    if (sera) runBeats(sera, dt);
    for (const e of encs.slice()) stepEncounter(e, dt);
    if (scene) stepScene(scene, dt);
    acc += dt;
    if (acc >= 0.25) { const s = acc; acc = 0; think(s); }
  }
  function init(c) {
    if (inited) return;
    ctx = c || C.ctx;
    inited = true;
    R = U.rng("life|" + U.rome().date);
    for (const k of KEYS) { const an = anchorOf(`dorm_${k}.spot`); if (an) A[k].pos = { x: an.x, z: an.z }; }
    bus.on("data:change", ({ keys }) => onData(keys || []));
    bus.on("people:arrived", ({ key, id }) => { const a = A[key]; if (a && id && id === a.cmd && !a.arrived) arrive(key); });
    bus.on("campus:visibility", ({ visible, hiddenFor }) => { if (visible && hiddenFor > 20) { replaceAll(); jumpPending = true; } });
    bus.on("campus:degraded", () => { if (!has3d()) for (const k of KEYS) { const a = A[k], an = a.act && anchorOf(a.act.anchor); if (an) a.pos = { x: an.x, z: an.z }; a.arrived = true; } });
    bus.on("ui:follow", ({ key }) => { followKey = key || null; });
    bus.on("clock:override", () => { if (!ownClock) jumpPending = true; });
    lastSim = C.clock.now().getTime();
    instantOnce = true;
    seedFeed();
    updateMoods();
    think(0.25);
    if (L.mode === "vita" || L.mode === "notte") boardDefault();
  }

  // ---- test hooks ------------------------------------------------------------------------------------------------------------------
  function advance(seconds, dt = 0.5) {
    instantMode = true;
    try {
      let left = Math.max(0, +seconds || 0);
      while (left > 1e-9) {
        const s = Math.min(dt, left);
        left -= s;
        setClock(new Date(C.clock.now().getTime() + s * 1000), 0);
        lastSim = C.clock.now().getTime() - s * 1000;
        step(s);
      }
    } finally {
      instantMode = false;
      setClock(C.clock.now(), 1);
      lastSim = C.clock.now().getTime();
      lastP = performance.now();
    }
  }
  function templates() {
    const out = [];
    const tryOne = (id, o, oi) => {
      for (const l of KEYS) {
        if (l === o) continue;
        const ex = chat(o, l, null, { topic: id, opener: o, oi });
        if (ex) return { topic: id, who: o, lines: ex.lines.map((x) => x.text) };
      }
      return null;
    };
    for (const id of TOPIC_IDS) {
      const tp = TOPIC[id];
      for (const o of Object.keys(tp.open)) {
        if (o === "_") continue;
        tp.open[o].forEach((_, oi) => { const g = tryOne(id, o, oi); if (g) out.push(g); });
      }
      (tp.open._ || []).forEach((_, gi) => {
        for (const o of KEYS) { const g = tryOne(id, o, (tp.open[o] || []).length + gi); if (g) { out.push(g); return; } }
      });
    }
    return out;
  }

  Object.assign(L, {
    init, update, mode: null, modeDetail: "Carico il campus…",
    status, where, mind, feed: feedList, schedule, block: () => { const m = U.rome().minutes; return schedule().find((b) => m >= b.from && m < b.to) || null; },
    replayState: null, talkState: "idle", CONSTANTS: CONSTANTS.slice(),
    replay, replayControl, replayJump, stopReplay, talk, cancelTalk,
    buildTalkPrompt: (keys, topic) => { const { prompt, numbers } = buildTalkPrompt(keys, topic); return { prompt, numbers }; },
    _advance: advance, _templates: templates,
    _pure: { dayScript, nrm, numberOk, textNumbersOk, talkNumbersOk, signedOf, allowedOf, blockOf, times, schoolDay, validateTalk, chat, moodOf },
  });
  Object.defineProperty(L, "talkTopics", {
    enumerable: true,
    get: () => TOPICS.map(([id, label]) => ({ id, label, enabled: id === "mercato" ? Object.keys(D.prices()).length > 0 : id === "gara" ? D.contests().length > 0 : id === "errori" ? KEYS.some((k) => { const m = mem(k); return arr(m && m.errori).length > 0 || arr(m && m.lezioni).length > 0; }) : true })),
  });
  C.life = L;
})();
