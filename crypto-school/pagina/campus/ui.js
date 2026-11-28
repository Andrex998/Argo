/* Scuola Cripto · campus/ui.js · Campus.ui (contract v1.0, §5.5).
   Everything the owner touches: the live line, the HUD over the stage (Rome clock, camera
   modes, graphics quality, minimap, replay bar, «La mente» follow card, the no-3D plan),
   the side panel (what they say, what they do, «Fateli parlare») and the player layer
   (the season, the careers, the owner's challenges, the contests). Plain Italian, the
   page's tokens, values from the database only through textContent. */
(() => {
"use strict";
const C = window.Campus;
if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
if (C.ui) return;
const U = C.util, bus = C.bus, D = C.derive;
const KEYS = C.KEYS, NM = C.NAMES;
const L = () => C.life, R = () => C.render, P = () => C.people, Wd = () => C.world;
const has3d = () => !!(C.ctx && C.ctx.has3d);
const safe = (fn, dflt) => { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { console.warn("Campus ui:", e); return dflt; } };
const obj = U.obj, arr = U.arr, isNum = U.isNum;

// ---- fixed Italian texts (Appendix F)
const NO3D = "Qui il campus non si vede in 3D: questo dispositivo non mostra la grafica 3D. Ecco la piantina, con chi c'è in ogni stanza.";
const PAUSE3D = "La grafica 3D è in pausa: torna da sola. Intanto ecco la piantina, con chi c'è in ogni stanza.";
const WAIT = "Il campus si sta preparando…";
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
const LEGEND = [
  ["ufficiale", "Ufficiale", "parole scritte dagli agenti nei verbali, in diretta o in palestra."],
  ["chiacchiera", "Chiacchiera", "frase costruita dalla pagina con i numeri veri."],
  ["pensiero", "Pensiero", "dal loro quaderno."],
  ["claude", "Dialogo generato da Claude", "chiesto da te con «Fateli parlare»."],
];
const TALK_ERR = {
  rate_limited: "Troppe richieste a Claude: riprova tra un po'.",
  refused: "Claude non ha scritto questo dialogo. Prova con un altro argomento.",
  invalid_json: "La risposta non era nel formato giusto. Riprova.",
  empty_completion: "Claude non ha scritto niente. Riprova.",
  session_expired: "Accedi di nuovo a claude.ai e riprova.",
  numeri: "Claude ha usato numeri che non sono nei dati: non lo mostro. Riprova.",
  busy: "Aspetta: c'è già un dialogo, oppure la diretta o la replica.",
};
const TALK_OTHER = "Qualcosa non ha funzionato. Riprova.";
const TALK_OFF = (code) => ["not_granted", "sampling_disabled", "not_declared"].includes(code) || /^capability_/.test(String(code || ""));
const COST = "Usa il tuo account Claude: ogni dialogo consuma un po' del tuo utilizzo. I numeri che dicono vengono solo dai dati della scuola.";
const propErr = (code) => code === "invalid_argument" ? "La proposta non è valida: controlla il testo."
  : code === "quota_exceeded" ? "Il database della scuola è pieno: non posso salvare altre proposte."
  : code === "revoked" || code === "not_granted" || /^capability_/.test(String(code || "")) ? "Da questa visita non posso scrivere nel database."
  : "Non sono riuscito a salvarla: riprova tra poco.";
const TIPI = [["studio", "Uno studio"], ["previsioni", "Delle previsioni"], ["gara", "Una gara"], ["altro", "Altro"]];
const STATO_P = { nuova: "in attesa del Preside", accettata: "accettata", rifiutata: "rifiutata", fatta: "fatta" };
const TOPIC_WHY = { mercato: "servono i prezzi di BingX", gara: "non c'è ancora nessuna gara", errori: "i quaderni non hanno ancora errori o lezioni" };
const QN = { auto: "automatica", high: "alta", medium: "media", low: "bassa" };
const QORDER = ["auto", "high", "medium", "low"];
const WD = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const TABS = [["dialoghi", "Cosa si dicono"], ["attivita", "Cosa fanno"], ["parlare", "Fateli parlare"]];
const SHORT = { presidenza: "Presidenza", riunione: "Riunioni", trading: "Trading", biblioteca: "Biblioteca", mensa: "Mensa", palestra: "Palestra", cortile: "Cortile" };
const INI = { preside: "Pr", falco: "Fa", tartaruga: "Ta", spazzino: "Sp", ragioniere: "Ra", guardiano: "Gu", cronista: "Cr", scettico: "Sc" };

// ---- careers and medals (Appendix E.4)
const LEVELS = [["Matricola", 0], ["Apprendista", 150], ["Praticante", 400], ["Analista", 800], ["Trader junior", 1400], ["Trader", 2200], ["Trader senior", 3200], ["Laureando", 4400]];
// [id, name, rule, traders only]
const MEDALS = [
  ["prima_riunione", "Prima riunione", "ha partecipato a una riunione", 0],
  ["dieci_riunioni", "Dieci riunioni", "ha partecipato a 10 riunioni", 0],
  ["mano_ferma", "Mano ferma", "disciplina 9 o più in 3 riunioni di fila", 0],
  ["previsione_centrata", "Previsione centrata", "almeno una previsione verificata giusta", 0],
  ["ben_calibrato", "Ben calibrato", "almeno 10 previsioni verificate e un eccesso di sicurezza entro 5 punti", 0],
  ["errore_ammesso", "Errore ammesso", "ha scritto un suo errore nel quaderno", 0],
  ["regola_nuova", "Regola nuova", "ha scritto una regola nuova dal 26/11 in poi", 0],
  ["meglio_del_caso", "Meglio del caso", "nell'ultima palestra un Brier sotto 0,25", 1],
  ["giudizio_aggiunge", "Il giudizio aggiunge", "il motore dice che il suo giudizio aggiunge alla regola", 1],
  ["vincitore_gara", "Vincitore della gara", "ha vinto una gara", 1],
  ["semaforo_verde", "Semaforo verde", "il portafoglio a giudizio è verde", 1],
  ["laurea", "Laurea", "ha votato la tesi della classe nell'ultimo giorno", 0],
];

// ---- icons: static markup only
const ICON = {
  sun: '<circle cx="12" cy="12" r="4.3" fill="currentColor" stroke="none"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/>',
  dusk: '<path d="M6.5 16.5a5.5 5.5 0 0 1 11 0z" fill="currentColor" stroke="none"/><path d="M3 16.5h18M7 20h10M12 5.5v2.2M5.3 8.8l1.5 1.5M18.7 8.8l-1.5 1.5"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" fill="currentColor" stroke="none"/><path d="M16.5 4.2v2.6M15.2 5.5h2.6" stroke-width="1.4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="M6 14.5l6-6 6 6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>',
  spark: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" fill="currentColor" stroke="none"/>',
  prima_riunione: '<path d="M6 21V4M6 4h11l-2.6 4L17 12H6"/>',
  dieci_riunioni: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M9 3.5v4M15 3.5v4M9 15l2 2 4-4"/>',
  mano_ferma: '<path d="M8 13V7a1.5 1.5 0 0 1 3 0v5M11 11V5.5a1.5 1.5 0 0 1 3 0V11M14 11V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-.4A5.6 5.6 0 0 1 6 17.3L4.4 14a1.4 1.4 0 0 1 2.4-1.5L8 14"/>',
  previsione_centrata: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  ben_calibrato: '<path d="M12 4v16M7.5 20h9M5 7h14M5 7l-3 6.2a3 3 0 0 0 6 0zM19 7l-3 6.2a3 3 0 0 0 6 0z"/>',
  errore_ammesso: '<path d="M4.5 19.5 5.6 15 16 4.6l3.4 3.4L9 18.4zM14 6.6l3.4 3.4"/>',
  regola_nuova: '<path d="M5 4.5h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17.5a3 3 0 0 1 3-3h10M11.5 6.8v5M9 9.3h5"/>',
  meglio_del_caso: '<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="8.6" cy="8.6" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.3" fill="currentColor"/>',
  giudizio_aggiunge: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  vincitore_gara: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H4.6a3.2 3.2 0 0 0 3.6 4.2M16 6h3.4a3.2 3.2 0 0 1-3.6 4.2M12 13.5V17M8.5 20.5h7M9.8 17h4.4"/>',
  semaforo_verde: '<rect x="8" y="2.5" width="8" height="19" rx="3.2"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="2" fill="currentColor"/>',
  laurea: '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6.5 11.5v4.6c3 2.4 8 2.4 11 0v-4.6M22 9.5v5.5"/>',
};
const icon = (name, cls) => {
  const s = document.createElement("span");
  s.className = "cp-u-ic" + (cls ? " " + cls : "");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ""}</svg>`;
  return s;
};

// ---- DOM helpers: strings always become text nodes
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (tag === "button") e.type = "button";
  if (a) for (const k of Object.keys(a)) {
    const v = a[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat(4)) if (c != null && c !== false && c !== "") e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const setText = (el, t) => { const s = String(t ?? ""); if (el && el.textContent !== s) el.textContent = s; };
const show = (el, on) => { if (el && el.hidden === !!on) el.hidden = !on; };
const okKey = (k) => (KEYS.includes(k) || k === "motore" ? k : "motore");
const nameOf = (k) => NM[k] || String(k || "");
const withArt = (k) => (C.ARTICLE[k] ? C.ARTICLE[k] + " " : "") + nameOf(k);
const dot = (k) => h("i", { class: "dot k-" + okKey(k), "aria-hidden": "true" });
const pad2 = (n) => String(n).padStart(2, "0");
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const sig = (v) => { try { return JSON.stringify(v); } catch (e) { return String(Math.random()); } };
const sinceTxt = (s) => {
  const d = isNum(s) ? new Date(s) : U.utc(s);
  if (!d) return "";
  const m = Math.max(0, Math.floor((C.clock.now().getTime() - d.getTime()) / 60000));
  return m < 1 ? "da poco" : m < 60 ? `da ${m} min` : `da ${Math.floor(m / 60)} h ${m % 60} min`;
};

// ---- state
let ctx = null, inited = false, slots = {};
let followKey = null, camMode = "regia", planOn = false, lost = false, noLife = false, compact = false, narrow = false;
let tabCur = "dialoghi", capsSeen = 0, talkBlocked = false;
let talk = { state: "idle", code: null, keys: null, topic: null };
const talkSel = new Set();
let propState = "wait", saving = false, replayMsg = null, replayMsgT = 0;
const tm = { clock: 9, map: 9, act: 0, half: 9, plan: 9 };
const el = {};
let careersCache = null, careersVer = -1;
let mqNarrow = null;

// ---- careers, medals, season
const finished = (c) => !!(c && c.doc && (c.doc.finita === true || obj(c.doc.situazione_finale) || (obj(c.doc.situazione) && c.doc.situazione.finita === true)));
const winnerOf = (c) => (c && c.situazione && KEYS.includes(c.situazione.vincitore) ? c.situazione.vincitore : null);
function careers() {
  if (careersCache && careersVer === C.data.version) return careersCache;
  const held = D.held().filter((g) => g.stato === "completo");
  const done = D.contests().filter(finished);
  const sem = obj(C.data.semaforo) || {};
  const tesi = D.graduation().tesi;
  const votes = tesi && (obj(tesi.voti_della_classe) || arr(tesi.voti_della_classe));
  const out = {};
  for (const k of C.GRADED) {
    const m = obj(C.data.memoria[k]) || {};
    const trader = C.TRADERS.includes(k);
    let votiSum = 0, run = 0, best = 0;
    const days = held.filter((g) => obj(g.voti) && obj(g.voti[k]));
    for (const g of days) {
      const r = U.toNum(g.voti[k].ragionamento), d = U.toNum(g.voti[k].disciplina);
      votiSum += (r || 0) + (d || 0);
      run = d !== null && d >= 9 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const ver = arr(m.previsioni).filter((p) => obj(p) && p.stato === "verificata");
    const giuste = ver.filter((p) => p.esito === 1 || p.esito === true).length;
    const sbagliate = ver.filter((p) => p.esito === 0 || p.esito === false).length;
    const regole = arr(m.regole).length, errori = arr(m.errori).length;
    const sess = arr(obj(m.palestra) && m.palestra.sessioni).filter(obj);
    const gare = done.filter((c) => obj(c.doc.stato) && obj(c.doc.stato.wallets) && c.doc.stato.wallets[k]).length;
    const vittorie = done.filter((c) => winnerOf(c) === k).length;
    const xp = 10 * days.length + votiSum + 15 * giuste + 5 * sbagliate + 10 * regole + 5 * errori + 20 * sess.length + 30 * gare + 50 * vittorie;
    let lv = 0;
    for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i][1]) lv = i;
    const cal = obj(m.calibrazione);
    const lastGym = sess.slice().sort((a, b) => (String(a.data) < String(b.data) ? -1 : 1)).pop();
    const g = obj(sem.giudizio_contro_regola) && obj(sem.giudizio_contro_regola[k]);
    const light = obj(sem.portafogli) && obj(sem.portafogli[k + "_giudizio"]);
    const voted = votes && (Array.isArray(votes) ? votes.some((v) => obj(v) && (v.chi === k || v.agente === k || v.key === k)) : votes[k] != null);
    const has = {
      prima_riunione: days.length >= 1,
      dieci_riunioni: days.length >= 10,
      mano_ferma: best >= 3,
      previsione_centrata: giuste >= 1,
      ben_calibrato: giuste + sbagliate >= 10 && !!cal && isNum(cal.eccesso_di_sicurezza) && Math.abs(cal.eccesso_di_sicurezza) <= 0.05,
      errore_ammesso: errori >= 1,
      regola_nuova: arr(m.regole).some((r) => obj(r) && U.isoDay(r.dal) && r.dal.slice(0, 10) >= C.SCHOOL_START),
      meglio_del_caso: trader && !!lastGym && isNum(lastGym.brier) && lastGym.brier < 0.25,
      giudizio_aggiunge: trader && !!g && g.verdetto === "aggiunge",
      vincitore_gara: trader && vittorie >= 1,
      semaforo_verde: trader && !!light && light.colore === "verde",
      laurea: !!voted,
    };
    out[k] = {
      xp, level: lv + 1, levelName: LEVELS[lv][0], next: lv + 1 < LEVELS.length ? LEVELS[lv + 1][1] : null, base: LEVELS[lv][1],
      medals: MEDALS.filter(([id]) => has[id]).map(([id]) => id),
      parts: { presenze: days.length, votiSum, giuste, sbagliate, regole, errori, palestre: sess.length, gare, vittorie },
    };
  }
  careersCache = out; careersVer = C.data.version;
  return out;
}
const publicCareers = () => {
  const c = careers(), o = {};
  for (const k of Object.keys(c)) o[k] = { xp: c[k].xp, level: c[k].level, levelName: c[k].levelName, next: c[k].next, medals: c[k].medals.slice() };
  return o;
};
const presideMeetings = () => D.held().filter((g) => g.stato === "completo").length;
const ledTxt = (n) => (n ? `ha guidato ${n} ${n === 1 ? "riunione" : "riunioni"}` : "la prima riunione completa deve ancora arrivare");
// the season runs on the real date, also while a replay moves the campus clock to a past day
function realGrad() {
  const g = D.graduation(), today = U.rome(C.clock.real()).date;
  const t = arr(obj(C.data.programma) && C.data.programma.giorni).find((x) => obj(x) && x.data === today) || null;
  return { ...g, today, days: Math.max(0, U.daysBetween(today, C.GRADUATION)), giorno: t && isNum(t.giorno) ? t.giorno : null };
}
// the careers count meetings and notebooks: before those arrive, zeros would look like real numbers
const careersReady = () => !!(C.data.got.classe && C.data.got.memoria);
const careersWait = () => (C.data.unavailable ? "Le carriere compaiono quando apri la pagina da claude.ai." : "Carico le carriere dai dati della scuola…");
function season() {
  const f = D.fund(), g = realGrad();
  return { capitale: f ? f.capitale : null, pct: f ? f.pct : null, quota: f ? f.quota : null, giorno: g.giorno, totale: g.totale, days: g.days, tesi: g.tesi || null };
}

// ---- tokens for the canvases
let tok = null, tokAt = -1e9;
function tokens() {
  const now = performance.now();
  if (tok && now - tokAt < 2000) return tok;
  const cs = getComputedStyle(document.documentElement), g = (n, d) => cs.getPropertyValue(n).trim() || d;
  const paper = g("--paper", "#fbfbf8");
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(paper);
  const lum = m ? (0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16)) / 255 : 1;
  tok = {
    paper, sheet: g("--sheet", "#fff"), wash: g("--wash", "#eef2f8"), rule: g("--rule", "#d6dde8"), ink: g("--ink", "#15233a"),
    ink2: g("--ink-2", "#47526a"), muted: g("--muted", "#677085"), grid: g("--grid", "#e7edf5"), head: g("--font-head", "sans-serif"), dark: lum < 0.4, c: {},
  };
  for (const k of KEYS) tok.c[k] = U.cssColor(k);
  tokAt = now;
  return tok;
}

// ---- the style sheet (injected once)
const CSS = `
.cp-u[hidden],.cp-u [hidden]{display:none!important}
.cp-u,.cp-u *{box-sizing:border-box}
.cp-u{font-family:var(--font-head);color:var(--ink)}
.cp-u button{font:inherit;color:inherit;cursor:pointer}
.cp-u button:disabled{cursor:default;opacity:.5}
.cp-u-ic{display:inline-grid;place-items:center;width:18px;height:18px;flex:none}
.cp-u-ic svg{width:100%;height:100%;display:block}
.cp-u-glass{background:var(--sheet);border:1px solid var(--rule);box-shadow:0 8px 24px rgba(8,14,24,.22),0 1px 2px rgba(8,14,24,.12)}
@supports (background:color-mix(in srgb,red 50%,blue)){.cp-u-glass{background:color-mix(in srgb,var(--sheet) 82%,transparent);border-color:color-mix(in srgb,var(--rule) 70%,transparent);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4)}}
.cp-u-livetext{min-width:0}
.cp-u-hud{position:absolute;inset:0;pointer-events:none;font-size:.86rem}
.cp-u-hud .cp-u-glass,.cp-u-hud button,.cp-u-hud canvas,.cp-u-hud .cp-u-plan{pointer-events:auto}
.cp-u-top{position:absolute;left:10px;right:10px;top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;justify-content:space-between;pointer-events:none}
.cp-u-ctl{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center;margin-left:auto}
.cp-u-clock{display:flex;align-items:center;gap:9px;padding:6px 13px 6px 9px;border-radius:14px;min-height:40px;max-width:100%}
.cp-u-clock .cp-u-ic{width:24px;height:24px;color:var(--amber)}
.cp-u-clock[data-phase=notte] .cp-u-ic{color:var(--focus)}
.cp-u-clock[data-phase=alba] .cp-u-ic,.cp-u-clock[data-phase=tramonto] .cp-u-ic{color:var(--c-spazzino)}
.cp-u-clock b{font:600 .95rem/1.15 var(--font-num);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.cp-u-clock small{display:flex;gap:6px;align-items:center;font-size:.74rem;line-height:1.2;color:var(--ink-2);white-space:nowrap}
.cp-u-rep{font:600 .64rem/1 var(--font-head);letter-spacing:.08em;text-transform:uppercase;color:var(--pen);border:1px solid var(--pen);border-radius:4px;padding:2px 4px}
.cp-u-seg{display:inline-flex;padding:3px;border-radius:999px;gap:2px}
.cp-u-seg button{min-height:36px;min-width:44px;padding:0 13px;border:0;border-radius:999px;background:transparent;font-weight:600;font-size:.84rem;letter-spacing:.01em;transition:background .18s,color .18s}
.cp-u-seg button:hover{background:var(--wash)}
.cp-u-seg button[aria-pressed=true]{background:var(--ink);color:var(--paper);box-shadow:0 2px 8px rgba(0,0,0,.25)}
.cp-u-qual{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 13px;border-radius:999px;font-size:.8rem;color:var(--ink-2)}
.cp-u-qual:hover{color:var(--ink)}
.cp-u-picker{position:absolute;right:10px;top:62px;width:min(330px,calc(100% - 20px));border-radius:14px;padding:10px;display:grid;gap:8px;z-index:3}
.cp-u-picker p{font-size:.8rem;color:var(--ink-2);font-weight:600}
.cp-u-chips{display:flex;flex-wrap:wrap;gap:6px}
.cp-u-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--rule);background:var(--sheet);font-size:.84rem;font-weight:600}
.cp-u-chip:hover{border-color:var(--who,var(--ink-2))}
.cp-u-chip[aria-pressed=true]{background:var(--who);border-color:var(--who);color:#fff}
.cp-u-chip[aria-pressed=true] .dot{background:#fff}
.cp-u-mind-desk{position:absolute;right:10px;top:62px;width:300px;max-height:calc(100% - 140px);display:flex;pointer-events:none}
.cp-u-mind-desk>.cp-u-mind{pointer-events:auto;max-height:100%;overflow:auto;overscroll-behavior:contain}
.cp-u-mind{border-radius:14px;padding:12px 14px 14px;display:grid;gap:10px;width:100%;border-top:3px solid var(--who);align-content:start}
.cp-u-mind-side .cp-u-mind{border-radius:0;border-width:0 0 1px;box-shadow:none;border-top:3px solid var(--who);background:var(--sheet)}
.cp-u-mhd{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start}
.cp-u .cp-u-ava{width:40px;height:40px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;font:700 .95rem/1 var(--font-head);color:#fff;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.45),transparent 55%),var(--who);box-shadow:0 0 0 2px var(--sheet),0 0 0 4px var(--who),0 4px 12px rgba(0,0,0,.25)}
.cp-u-mhd h3{font-size:1.08rem;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.cp-u-mhd h3 small{font:600 .66rem/1 var(--font-head);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.cp-u-mhd p{font-size:.78rem;color:var(--ink-2);line-height:1.35;margin-top:2px}
.cp-u-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--rule);background:var(--sheet);display:grid;place-items:center}
.cp-u-x:hover{border-color:var(--ink-2)}
.cp-u-min[aria-expanded=false] svg{transform:rotate(180deg)}
.cp-u-ms{display:grid;gap:3px;padding:0}
.cp-u-ms+.cp-u-ms{border-top:1px solid color-mix(in srgb,var(--rule) 70%,transparent);padding-top:9px}
.cp-u-ms h4{font-size:.64rem;letter-spacing:.1em}
.cp-u-ms>p,.cp-u-ms>div{font-size:.86rem;line-height:1.4;color:var(--ink);overflow-wrap:anywhere}
.cp-u-ms .cp-u-read{font-family:var(--font-read);font-style:italic;color:var(--ink-2)}
.cp-u-ms .num{font-size:.84rem}
.cp-u-wal{display:grid;gap:2px}
.cp-u-wal p{white-space:normal}
.cp-u-wal p>span:first-child{display:inline-block;min-width:76px;color:var(--ink-2);font-size:.8rem}
.cp-u-wal b{font-weight:600}
.cp-u-mood{display:inline-block;font-size:.72rem;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid var(--who,var(--rule));margin-right:6px;white-space:nowrap}
.cp-u-mood[data-mood=teso]{border-color:var(--loss);color:var(--loss)}
.cp-u-mood[data-mood=preoccupato]{border-color:var(--amber);color:var(--amber)}
.cp-u-mood[data-mood=contento]{border-color:var(--gain);color:var(--gain)}
.cp-u-pen{font:700 1.2rem/1 var(--font-hand);color:var(--pen);margin:0 2px}
.cp-u-pen.self{color:var(--ink-2)}
.cp-u-xp{height:8px;border-radius:999px;background:var(--wash);overflow:hidden;border:1px solid var(--rule)}
.cp-u-xp i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--who) 70%,var(--sheet)),var(--who));box-shadow:0 0 10px var(--who)}
.cp-u-bottom{position:absolute;left:10px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;pointer-events:none}
.cp-u-map{border-radius:14px;padding:4px;display:grid;gap:2px;justify-items:start}
.cp-u-maptoggle{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border:0;background:transparent;font-weight:600;font-size:.78rem;color:var(--ink-2);border-radius:10px}
.cp-u-maptoggle:hover{color:var(--ink)}
.cp-u-minimap{display:block;border-radius:10px;cursor:pointer;touch-action:manipulation}
.cp-u-replay{margin-left:auto;border-radius:16px;padding:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end;max-width:100%}
.cp-u-rday{display:flex;align-items:center;gap:4px;flex:1 1 250px;min-width:0}
.cp-u-replay .cp-u-rinfo{display:grid;gap:3px;padding:0 6px;min-width:0;flex:1}
.cp-u-rinfo b{font-size:.8rem}
.cp-u-rinfo span{font-size:.72rem;color:var(--ink-2)}
.cp-u-prog{height:4px;border-radius:999px;background:var(--wash);overflow:hidden}
.cp-u-prog i{display:block;height:100%;background:var(--pen)}
.cp-u-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;min-width:36px;padding:0 12px;border-radius:999px;border:1px solid var(--rule);background:var(--sheet);font-weight:600;font-size:.8rem;white-space:nowrap}
.cp-u-btn:hover:not(:disabled){border-color:var(--ink-2)}
.cp-u-btn.strong{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.cp-u-btn .cp-u-ic{width:15px;height:15px}
.cp-u-plan{display:grid;gap:12px;padding:14px;background:var(--paper);min-height:100%}
.cp-u-plan-note{font-size:.95rem;color:var(--ink-2);max-width:62ch;padding:10px 14px;border-left:3px solid var(--pen);background:var(--sheet);border-radius:0 10px 10px 0}
.cp-u-plan-cv{width:100%;display:block;border-radius:12px;background:var(--sheet);border:1px solid var(--rule)}
.cp-u-plan-legend{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px 14px;font-size:.84rem}
.cp-u-plan-legend li{display:flex;gap:7px;align-items:baseline;min-width:0}
.cp-u-plan-legend b{white-space:nowrap}
.cp-u-plan-legend span{color:var(--ink-2);overflow-wrap:anywhere}
.cp-stage.cp-no3d{height:auto;min-height:360px;background:var(--paper)}
.cp-stage.cp-no3d .cp-r-veil{display:none}
.cp-stage.cp-no3d>.cp-hud{position:relative;inset:auto;pointer-events:auto}
.cp-u-hud.cp-u-no3d{position:relative;inset:auto;display:grid;gap:0;pointer-events:auto}
.cp-u-hud.cp-u-no3d .cp-u-top{position:static;padding:10px 10px 0}
.cp-u-hud.cp-u-no3d .cp-u-bottom{position:static;padding:0 10px 10px}
.cp-u-hud.cp-u-compact .cp-u-clock small:not(.rep),.cp-u-hud.cp-u-compact .cp-u-clock .cp-u-where{display:none}
.cp-u-hud.cp-u-compact .cp-u-clock{padding:4px 10px 4px 7px;min-height:38px;gap:6px}
.cp-u-hud.cp-u-compact .cp-u-qt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.cp-u-hud.cp-u-compact .cp-u-qual{padding:0;width:42px;justify-content:center}
.cp-u-hud.cp-u-compact .cp-u-seg button{padding:0 10px;font-size:.8rem}
.cp-u-hud.cp-u-compact .cp-u-picker{top:58px}
.cp-u-hud.cp-u-compact .cp-u-top{flex-wrap:nowrap;gap:6px;left:8px;right:8px;top:8px}
.cp-u-hud.cp-u-compact .cp-u-ctl{flex-wrap:nowrap;gap:4px}
.cp-u-hud.cp-u-compact .cp-u-clock{min-width:0;flex:0 1 auto;overflow:hidden}
.cp-u-hud.cp-u-compact .cp-u-clock .cp-u-ic{display:none}
.cp-u-hud.cp-u-compact .cp-u-seg button{min-height:34px;min-width:0;padding:0 8px;font-size:.76rem}
.cp-u-hud.cp-u-compact .cp-u-qual{width:38px;min-height:40px}
.cp-u-replay.cp-u-rmini{flex-wrap:nowrap;padding:4px;gap:4px;position:relative;border-radius:14px}
.cp-u-rmini .cp-u-rday{flex:1 1 auto}
.cp-u-rmini .cp-u-rinfo b{font-size:.74rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-u-rmini .cp-u-rinfo span{font-size:.68rem}
.cp-u-rmini .cp-u-btn{padding:0 10px}
.cp-u-rmore{position:absolute;right:0;bottom:calc(100% + 6px);display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:14px;align-items:stretch}
.cp-u-side{display:flex;flex-direction:column;flex:1;min-height:0;font-size:.9rem}
.cp-u-tabs{display:flex;gap:2px;padding:6px 6px 0;border-bottom:1px solid var(--rule);flex:none}
.cp-u-tabs button{flex:1 1 0;min-width:0;min-height:42px;padding:6px 6px 9px;border:0;background:transparent;font-weight:600;font-size:.84rem;color:var(--muted);border-bottom:3px solid transparent;border-radius:8px 8px 0 0;line-height:1.15}
.cp-u-tabs button:hover{color:var(--ink);background:var(--wash)}
.cp-u-tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--ink)}
.cp-u-panel{flex:1;min-height:0;display:flex;flex-direction:column}
.cp-u-wait{padding:18px 14px;color:var(--muted)}
.cp-u-feedwrap{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.cp-u-feed{list-style:none;margin:0;padding:6px;overflow-y:auto;flex:1;min-height:0;position:relative;overscroll-behavior:contain}
.cp-u-msg{border-radius:10px}
.cp-u-msg .cp-u-mb{box-shadow:inset 2px 0 0 color-mix(in srgb,var(--who,var(--rule)) 45%,transparent)}
.cp-u-mb{display:grid;gap:3px;width:100%;text-align:left;padding:8px 9px;border:0;border-radius:10px;background:transparent;color:var(--ink)}
button.cp-u-mb:hover{background:var(--wash)}
.cp-u-msg[data-kind=claude] .cp-u-mb{background:linear-gradient(90deg,color-mix(in srgb,var(--focus) 9%,transparent),transparent 70%)}
.cp-u-msg[data-state=next]{opacity:.45}
.cp-u-msg[data-state=now] .cp-u-mb{background:var(--wash);box-shadow:inset 3px 0 0 var(--who,var(--rule))}
.cp-u-mh{display:flex;align-items:center;gap:6px;font-size:.76rem;flex-wrap:wrap;color:var(--muted)}
.cp-u-mh b{color:var(--ink);font-size:.82rem}
.cp-u-mh time{font-family:var(--font-num);font-size:.72rem}
.cp-u-mt{font:.9rem/1.45 var(--font-read);overflow-wrap:anywhere}
.cp-u-msg[data-kind=pensiero] .cp-u-mt{font-style:italic;color:var(--ink-2)}
.cp-u-kind{display:inline-flex;align-items:center;gap:3px;font:600 .62rem/1.3 var(--font-head);letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:4px;border:1px solid var(--rule);color:var(--ink-2);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.cp-u-kind-ufficiale{border-color:var(--ink-2);color:var(--ink)}
.cp-u-kind-chiacchiera{border-style:dashed}
.cp-u-kind-pensiero{border-style:dotted;font-style:italic}
.cp-u-kind-claude{border-color:var(--focus);color:var(--focus)}
.cp-u-kind-claude .cp-u-ic{width:10px;height:10px}
.cp-u-newchip{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);min-height:36px;padding:0 14px;border-radius:999px;border:0;background:var(--ink);color:var(--paper);font-weight:600;font-size:.8rem;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.cp-u-empty{padding:16px 14px;color:var(--muted)}
.cp-u-legend{flex:none;border-top:1px solid var(--rule);padding:4px 10px 6px;font-size:.74rem;color:var(--muted);line-height:1.4}
.cp-u-legend summary{display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:36px;font-size:.74rem;color:var(--muted)}
.cp-u-legend summary>span:last-child{margin-left:auto;text-decoration:underline dotted}
.cp-u-legend p{margin-top:3px}
.cp-u-legend b{color:var(--ink-2)}
.cp-u-acts{list-style:none;margin:0;padding:6px;overflow-y:auto;flex:1;min-height:0}
.cp-u-act{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;width:100%;text-align:left;padding:9px 10px;border:0;border-radius:10px;background:transparent;align-items:center}
.cp-u-act:hover{background:var(--wash)}
.cp-u-act[aria-pressed=true]{background:var(--wash);box-shadow:inset 3px 0 0 var(--who)}
.cp-u-act .whom{font-size:.88rem}
.cp-u-act .cp-u-al{grid-column:1;font-size:.86rem;color:var(--ink);overflow-wrap:anywhere}
.cp-u-act .cp-u-ar{grid-column:1;font-size:.74rem;color:var(--muted)}
.cp-u-act .cp-u-mood{grid-column:2;grid-row:1/span 3;justify-self:end;margin:0}
.cp-u-act.dim{opacity:.5}
.cp-u-talk{padding:12px 14px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1;min-height:0}
.cp-u-talk>*{flex:none}
.cp-u-talk>.cp-u-primary{align-self:flex-start}
.cp-u-talk>p{font-size:.86rem;color:var(--ink-2);line-height:1.45}
.cp-u-lab{display:grid;gap:5px;font-size:.8rem;font-weight:600;color:var(--ink-2)}
.cp-u-select,.cp-u-input,.cp-u-ta{font:inherit;font-size:.9rem;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:8px 10px;min-height:40px;width:100%;max-width:100%}
.cp-u-ta{font-family:var(--font-read);resize:vertical;min-height:96px;line-height:1.45}
.cp-u-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border-radius:999px;border:0;font-weight:700;font-size:.92rem;letter-spacing:.01em;color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--pen) 88%,#fff),var(--pen));box-shadow:0 6px 16px color-mix(in srgb,var(--pen) 35%,transparent);justify-self:start}
.cp-u-primary:hover:not(:disabled){filter:brightness(1.06)}
.cp-u-primary:disabled{opacity:.45;box-shadow:none}
.cp-u-status{font-size:.88rem;display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:1.2em}
.cp-u-status.err{color:var(--loss)}
.cp-u-note{font-size:.76rem;color:var(--muted);line-height:1.45}
.cp-u-spin{width:14px;height:14px;border-radius:50%;border:2px solid var(--rule);border-top-color:var(--focus);animation:cp-u-spin .9s linear infinite;flex:none}
@keyframes cp-u-spin{to{transform:rotate(360deg)}}
.cp-u-player{display:grid;gap:16px;min-width:0}
.cp-u-sheet h3{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cp-u-sheet h3 .cp-u-ic{width:22px;height:22px;color:var(--pen)}
.cp-u-sub{font-size:.88rem;color:var(--ink-2);max-width:72ch}
.cp-u-season{background:radial-gradient(120% 140% at 100% 0%,color-mix(in srgb,var(--pen) 7%,transparent),transparent 55%),var(--sheet)}
.cp-u-stats{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);gap:14px}
.cp-u-stat{display:grid;gap:6px;align-content:start;padding:12px 14px;border-radius:12px;background:var(--wash);min-width:0}
.cp-u-stat h4{font-size:.66rem}
.cp-u-big{font-size:.95rem;color:var(--ink-2);line-height:1.35}
.cp-u-big b{display:block;font:500 clamp(1.45rem,3.2vw,1.9rem)/1.1 var(--font-num);letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.cp-u-fundbar{position:relative;height:12px;border-radius:999px;background:var(--sheet);border:1px solid var(--rule);overflow:hidden}
.cp-u-fundbar i{position:absolute;top:0;bottom:0}
.cp-u-fundbar i.g{background:linear-gradient(90deg,color-mix(in srgb,var(--gain) 45%,transparent),var(--gain))}
.cp-u-fundbar i.l{background:linear-gradient(270deg,color-mix(in srgb,var(--loss) 45%,transparent),var(--loss))}
.cp-u-fundbar s{position:absolute;left:50%;top:-1px;bottom:-1px;width:2px;margin-left:-1px;background:var(--ink)}
.cp-u-ticks{display:flex;justify-content:space-between;font:.7rem var(--font-num);color:var(--muted)}
.cp-u-road{display:grid;gap:10px}
.cp-u-track{position:relative;height:46px;margin:0 8px}
.cp-u-rail{position:absolute;left:0;right:0;top:10px;height:10px;border-radius:999px;background:var(--wash);border:1px solid var(--rule)}
.cp-u-rail i{position:absolute;left:0;top:0;bottom:0;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--pen) 40%,var(--sheet)),var(--pen))}
.cp-u-mk{position:absolute;top:4px;transform:translateX(-50%);display:grid;justify-items:center;gap:3px;font:.68rem/1 var(--font-num);color:var(--muted);white-space:nowrap}
.cp-u-mk i{width:14px;height:14px;transform:rotate(45deg);border-radius:3px;background:var(--sheet);border:2px solid var(--ink-2)}
.cp-u-mk.past i{background:var(--ink-2)}
.cp-u-mk.fine i{width:20px;height:20px;transform:none;border-radius:50%;margin-top:-3px;border-color:var(--pen);display:grid;place-items:center}
.cp-u-mk.fine i .cp-u-ic{width:12px;height:12px;color:var(--pen)}
.cp-u-mk span{margin-top:2px}
.cp-u-you{position:absolute;top:2px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:var(--pen);border:3px solid var(--sheet);box-shadow:0 0 0 2px var(--pen),0 4px 12px rgba(0,0,0,.25)}
.cp-u-tesi{font-size:.98rem}
.cp-u-tesi b{font-weight:700}
.cp-u-src{font-size:.78rem;color:var(--muted)}
.cp-u-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.cp-u-card{border:1px solid var(--rule);border-radius:14px;padding:12px 14px;display:grid;gap:9px;align-content:start;min-width:0;background:linear-gradient(180deg,color-mix(in srgb,var(--who) 9%,transparent),transparent 46%),var(--sheet);position:relative;overflow:hidden}
.cp-u-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--who)}
.cp-u-ch{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
.cp-u-ch h4{font:700 1rem/1.15 var(--font-head);letter-spacing:0;text-transform:none;color:var(--ink)}
.cp-u-ch p{font-size:.8rem;color:var(--ink-2)}
.cp-u-lv{display:grid;place-items:center;min-width:42px;height:46px;padding:0 4px;font:700 1.15rem/1 var(--font-num);color:#fff;background:var(--who);clip-path:polygon(50% 0,100% 18%,100% 74%,50% 100%,0 74%,0 18%);text-shadow:0 1px 2px rgba(0,0,0,.35)}
.cp-u-lv>span{display:grid;justify-items:center;line-height:1}
.cp-u-lv small{display:block;font:700 .48rem/1 var(--font-head);letter-spacing:.12em;text-transform:uppercase;margin-bottom:2px;opacity:.9}
.cp-u-xpt{display:flex;justify-content:space-between;gap:8px;font-size:.76rem;color:var(--ink-2)}
.cp-u-xpt b{font-family:var(--font-num);font-weight:600;color:var(--ink)}
.cp-u-medals{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}
.cp-u-medal{aspect-ratio:1;min-width:36px;min-height:36px;width:100%;border-radius:50%;border:1.5px dashed var(--rule);background:transparent;display:grid;place-items:center;color:var(--muted);padding:0;position:relative}
.cp-u-medal .cp-u-ic{width:56%;height:56%;opacity:.55}
.cp-u-medal.on{border:2px solid var(--who);color:#fff;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),transparent 50%),var(--who);box-shadow:0 0 0 2px var(--sheet) inset,0 3px 10px color-mix(in srgb,var(--who) 45%,transparent)}
.cp-u-medal.on .cp-u-ic{opacity:1}
.cp-u-medal.na{opacity:.35;border-style:dotted}
.cp-u-medal[aria-expanded=true]{outline:2px solid var(--ink);outline-offset:2px}
.cp-u-minfo{font-size:.78rem;color:var(--ink-2);min-height:2.4em;line-height:1.35}
.cp-u-minfo b{color:var(--ink)}
.cp-u-pres{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--rule);border-radius:14px;background:linear-gradient(90deg,color-mix(in srgb,var(--c-preside) 10%,transparent),transparent 60%)}
.cp-u-how ul{margin:0;padding-left:1.2em;display:grid;gap:3px;font-size:.86rem;color:var(--ink-2)}
.cp-u-how p{font-size:.86rem;color:var(--ink-2);margin:6px 0}
.cp-u-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
.cp-u-form{display:grid;gap:10px;align-content:start}
.cp-u-form fieldset{border:0;margin:0;padding:0;display:grid;gap:6px;min-width:0}
.cp-u-form legend{font-size:.8rem;font-weight:600;color:var(--ink-2);padding:0;margin-bottom:6px}
.cp-u-radios{display:flex;flex-wrap:wrap;gap:6px}
.cp-u-radio{position:relative;display:inline-flex}
.cp-u-radio input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.cp-u-radio span{display:inline-flex;align-items:center;min-height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--rule);font-size:.84rem;font-weight:600;background:var(--paper)}
.cp-u-radio input:checked+span{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.cp-u-radio input:focus-visible+span{outline:2px solid var(--focus);outline-offset:2px}
.cp-u-radio input:disabled+span{opacity:.5}
.cp-u-row2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:10px}
.cp-u-count{font:.72rem var(--font-num);color:var(--muted);justify-self:end;margin-top:-6px}
.cp-u-pmsg{font-size:.86rem;min-height:1.2em}
.cp-u-pmsg.ok{color:var(--gain);font-weight:600}
.cp-u-pmsg.err{color:var(--loss)}
.cp-u-plist{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.cp-u-prop{border:1px solid var(--rule);border-radius:12px;padding:10px 12px;display:grid;gap:6px;background:var(--paper)}
.cp-u-ph{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.76rem;color:var(--muted)}
.cp-u-st{font:600 .66rem/1.3 var(--font-head);letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;border:1px solid var(--rule);color:var(--ink-2)}
.cp-u-st.nuova{border-color:var(--amber);color:var(--amber)}
.cp-u-st.accettata,.cp-u-st.fatta{border-color:var(--gain);color:var(--gain)}
.cp-u-st.rifiutata{border-color:var(--loss);color:var(--loss)}
.cp-u-st.aperta{border-color:var(--focus);color:var(--focus)}
.cp-u-pt{font-family:var(--font-read);font-size:.96rem;overflow-wrap:anywhere}
.cp-u-reply{border-left:3px solid var(--c-preside);padding:4px 0 4px 10px;font-size:.88rem;white-space:pre-line;overflow-wrap:anywhere;color:var(--ink-2)}
.cp-u-reply b{color:var(--c-preside)}
.cp-u-garas{display:grid;gap:14px}
.cp-u-gara{border:1px solid var(--rule);border-radius:14px;padding:12px 14px;display:grid;gap:10px;background:var(--paper)}
.cp-u-gh{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between}
.cp-u-gh h4{font:700 1.02rem/1.2 var(--font-head);text-transform:none;letter-spacing:0;color:var(--ink)}
.cp-u-gm{font-size:.84rem;color:var(--ink-2)}
.cp-u-rank{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cp-u-rk{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:10px;background:var(--sheet);border:1px solid var(--rule)}
.cp-u-rank:not(.opening) .cp-u-rk:first-child{border-color:var(--amber);box-shadow:inset 3px 0 0 var(--amber)}
.cp-u-pos{font:700 1rem/1 var(--font-num);color:var(--muted);text-align:center}
.cp-u-rank:not(.opening) .cp-u-rk:first-child .cp-u-pos{color:var(--amber)}
.cp-u-rm{display:grid;gap:2px;min-width:0}
.cp-u-rm small{font-size:.76rem;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.cp-u-rr{display:grid;justify-items:end;gap:3px}
.cp-u-rr b{font:600 .95rem var(--font-num);white-space:nowrap}
.cp-u-win{font-size:.95rem;font-weight:600;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--amber) 14%,transparent);border:1px solid var(--amber)}
.cp-u-words{font-size:.88rem;white-space:pre-line;overflow-wrap:anywhere;color:var(--ink-2);font-family:var(--font-read);line-height:1.5}
@media (max-width:900px){
.cp-u-feed{max-height:min(62vh,460px)}
.cp-u-acts{max-height:none}
.cp-u-stats{grid-template-columns:minmax(0,1fr)}
.cp-u-two{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:600px){
.cp-u-rday{flex-basis:100%}
.cp-u-replay{justify-content:flex-start}
.cp-u-row2{grid-template-columns:minmax(0,1fr)}
.cp-u-cards{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){.cp-u *,.cp-u{transition:none!important;animation:none!important}}
.cp-u.cp-u-rmo *,.cp-u.cp-u-rmo{transition:none!important;animation:none!important}
`;

// ---- build: the live line
let liveSig = "";
function renderLive() {
  const s = slots.live;
  if (!s) return;
  const l = L(), mode = !noLife && l ? l.mode : null;
  const text = !noLife && l ? String(l.modeDetail || WAIT) : WAIT;
  const k = mode + "|" + text;
  if (k === liveSig) return;
  liveSig = k;
  s.textContent = "";
  if (mode === "diretta") s.append(h("span", { class: "live-dot", "aria-hidden": "true" }));
  s.append(h("span", { class: "cp-u-livetext", text }));
  labelCanvas();
}
function labelCanvas() {
  const cv = C.ctx && C.ctx.canvas;
  if (!cv) return;
  const l = L(), detail = !noLife && l && l.modeDetail ? String(l.modeDetail) : "";
  const t = "Il campus della Scuola Cripto in 3D: gli otto agenti nelle loro stanze." + (detail ? " " + detail + "." : "") + (followKey ? " Segui " + withArt(followKey) + "." : "");
  if (cv.getAttribute("aria-label") !== t) cv.setAttribute("aria-label", t);
}

// ---- build: the HUD
function buildHud() {
  const hud = slots.hud;
  hud.textContent = "";
  el.clockIc = h("span");
  el.clockT = h("b");
  el.clockD = h("span", { class: "cp-u-where" });
  el.clockB = h("small");
  el.clock = h("div", { class: "cp-u-clock cp-u-glass", "data-phase": "giorno" }, el.clockIc, h("div", null, h("div", { style: "display:flex;gap:7px;align-items:baseline" }, el.clockT, el.clockD), el.clockB));
  el.cam = {};
  el.seg = h("div", { class: "cp-u-seg cp-u-glass", role: "group", "aria-label": "La camera" },
    [["regia", "Regia", "La regia sceglie da sola le inquadrature"], ["libera", "Libera", "Giri e avvicini la camera con il dito o il mouse"], ["segui", "Segui", "Scegli un agente da seguire"]]
      .map(([m, t, tt]) => (el.cam[m] = h("button", { "aria-pressed": m === "regia" ? "true" : "false", "data-mode": m, title: tt, onclick: () => onCam(m) }, t))));
  el.cam.segui.setAttribute("aria-haspopup", "true");
  el.cam.segui.setAttribute("aria-expanded", "false");
  el.qt = h("span", { class: "cp-u-qt" });
  el.qual = h("button", { class: "cp-u-qual cp-u-glass", onclick: cycleQuality }, icon("sliders"), el.qt);
  el.ctl = h("div", { class: "cp-u-ctl" }, el.seg, el.qual);
  el.top = h("div", { class: "cp-u-top" }, el.clock, el.ctl);
  el.picker = h("div", { class: "cp-u-picker cp-u-glass", role: "group", "aria-label": "Chi vuoi seguire?", hidden: true },
    h("p", { text: "Chi vuoi seguire? Vedi dove va e cosa ha in mente." }),
    h("div", { class: "cp-u-chips" }, KEYS.map((k) => h("button", { class: "cp-u-chip k-" + k, "data-key": k, onclick: () => { closePicker(); follow(k); } }, dot(k), NM[k]))));
  el.mindDesk = h("div", { class: "cp-u-mind-desk" });
  el.planCv = h("canvas", { class: "cp-u-plan-cv", role: "img", "aria-label": "La piantina del campus con gli otto agenti" });
  el.planLeg = h("ul", { class: "cp-u-plan-legend", "aria-label": "Dove sono" });
  el.plan = h("div", { class: "cp-u-plan", hidden: true }, h("p", { class: "cp-u-plan-note", text: NO3D }), el.planCv, el.planLeg);
  el.planCv.addEventListener("click", (e) => onMapClick(e, el.planCv, true));
  el.mapBtn = h("button", { class: "cp-u-maptoggle", "aria-expanded": "true", onclick: () => setMapOpen(!mapOpen) }, icon("map"), h("span", { text: "Mappa" }));
  el.mapCv = h("canvas", { class: "cp-u-minimap", role: "img", "aria-label": "La mappa del campus: tocca un agente per seguirlo, o una stanza per inquadrarla" });
  el.mapCv.addEventListener("click", (e) => onMapClick(e, el.mapCv, false));
  el.map = h("div", { class: "cp-u-map cp-u-glass" }, el.mapBtn, el.mapCv);
  el.replay = h("div", { class: "cp-u-replay cp-u-glass", role: "group", "aria-label": "La replica", hidden: true });
  el.bottom = h("div", { class: "cp-u-bottom" }, el.map, el.replay);
  el.hud = h("div", { class: "cp-u cp-u-hud" + (ctx.reduceMotion ? " cp-u-rmo" : "") }, el.top, el.picker, el.plan, el.mindDesk, el.bottom);
  hud.append(el.hud);
  setMapOpen(window.innerWidth >= 600);
}

function renderClock() {
  const now = C.clock.now(), r = U.rome(now), l = noLife ? null : L();
  const rep = !!(l && l.mode === "replica") || C.clock.overridden;
  let phase = has3d() && R() && R().sky && R().sky.phase;
  if (!phase) { const s = U.sun(now); phase = s.altDeg >= 6 ? "giorno" : s.altDeg <= -8 ? "notte" : s.azDeg < 180 ? "alba" : "tramonto"; }
  const b = l && typeof l.block === "function" ? safe(() => l.block(), null) : null;
  setText(el.clockT, `Roma ${pad2(r.hh)}:${pad2(r.mm)}`);
  setText(el.clockD, `· ${WD[r.weekday]} ${U.dm(r.date)}`);
  const bt = rep ? "" : b && b.label ? U.cap(String(b.label)) : "";
  const k = (rep ? "R" : "") + bt;
  if (el.clockB.dataset.k !== k) {
    el.clockB.dataset.k = k;
    el.clockB.textContent = "";
    if (rep) el.clockB.append(h("span", { class: "cp-u-rep", text: "replica" }), h("span", { class: "cp-u-where", text: "l'ora della riunione" }));
    else if (bt) el.clockB.append(bt);
  }
  show(el.clockB, rep || !!bt);
  el.clockB.classList.toggle("rep", rep);
  if (el.clock.dataset.phase !== phase || !el.clockIc.firstChild) {
    el.clock.dataset.phase = phase;
    const ic = icon(phase === "notte" ? "moon" : phase === "giorno" ? "sun" : "dusk");
    el.clockIc.replaceWith(ic);
    el.clockIc = ic;
    el.clock.title = { giorno: "È giorno a Roma", notte: "È notte a Roma", alba: "L'alba a Roma", tramonto: "Il tramonto a Roma" }[phase] || "";
  }
}

// camera modes, quality, the agent picker
function onCam(m) {
  if (m === "segui") { el.picker.hidden ? openPicker() : closePicker(); return; }
  closePicker();
  if (followKey) stopFollowLocal();
  const r = R();
  if (r && r.setCameraMode && has3d()) safe(() => r.setCameraMode(m));
  else { camMode = m; renderCam(); }
}
function renderCam() {
  for (const m of Object.keys(el.cam || {})) el.cam[m].setAttribute("aria-pressed", String(camMode === m));
}
function openPicker() {
  el.picker.hidden = false;
  el.cam.segui.setAttribute("aria-expanded", "true");
  for (const b of el.picker.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.key === followKey));
  const first = el.picker.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}
function closePicker() {
  if (!el.picker || el.picker.hidden) return;
  el.picker.hidden = true;
  el.cam.segui.setAttribute("aria-expanded", "false");
}
function cycleQuality() {
  const r = R();
  if (!r || typeof r.setQuality !== "function") return;
  const i = QORDER.indexOf(r.qualityMode || "auto");
  safe(() => r.setQuality(QORDER[(i + 1) % QORDER.length]));
  renderQuality();
}
function renderQuality() {
  const r = R();
  if (!r || !el.qt) return;
  const m = QN[r.qualityMode] ? r.qualityMode : "auto";
  const t = m === "auto" ? `Grafica: automatica (${QN[r.quality] || "media"})` : `Grafica: ${QN[m]}`;
  setText(el.qt, t);
  if (el.qual.getAttribute("aria-label") !== t) { el.qual.setAttribute("aria-label", t); el.qual.title = t + ". Tocca per cambiare."; }
}

// ---- the minimap and the plan
let mapOpen = true, mapDots = [], planDots = [], mapGeo = null, planGeo = null, camV = null;
function setMapOpen(v) {
  mapOpen = !!v;
  el.mapBtn.setAttribute("aria-expanded", String(mapOpen));
  el.mapCv.hidden = !mapOpen;
  if (mapOpen) drawMinimap();
}
const mm = () => { const w = Wd(); return w && typeof w.minimap === "function" ? safe(() => w.minimap(), null) : null; };
function fillOf(kind, t) {
  return kind === "interno" ? t.wash : kind === "passaggio" ? t.paper : kind === "esterno" ? (t.dark ? "#2f4a2a" : "#a8c79a") : t.sheet;
}
// draws the campus plan on a canvas of w × h CSS px; big = the no-3D plan (names, initials)
function drawMap(cv, w, hh, big) {
  const data = mm();
  if (!cv || !data || w < 20 || hh < 20) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(w * dpr), H = Math.round(hh * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = w + "px"; cv.style.height = hh + "px"; }
  const g = cv.getContext("2d");
  if (!g) return null;
  const t = tokens();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, hh);
  const [x0, z0, x1, z1] = data.bounds || [-24, -20, 24, 20];
  const pad = big ? 10 : 5;
  const s = Math.min((w - 2 * pad) / (x1 - x0), (hh - 2 * pad) / (z1 - z0));
  const ox = (w - (x1 - x0) * s) / 2, oz = (hh - (z1 - z0) * s) / 2;
  const X = (x) => ox + (x - x0) * s, Z = (z) => oz + (z - z0) * s;
  // the ground around the building, then the floors
  g.fillStyle = t.dark ? "#1f2d26" : "#dfe8d6";
  rr(g, X(x0) - 3, Z(z0) - 3, (x1 - x0) * s + 6, (z1 - z0) * s + 6, 6); g.fill();
  for (const r of arr(data.rooms)) {
    g.fillStyle = fillOf(r.kind, t);
    for (const q of arr(r.rects)) g.fillRect(X(q[0]), Z(q[1]), (q[2] - q[0]) * s, (q[3] - q[1]) * s);
    const ow = r.kind === "dormitorio" ? r.owner || String(r.id).replace(/^dorm_/, "") : null;
    if (ow && t.c[ow]) { g.fillStyle = t.c[ow]; g.globalAlpha = t.dark ? 0.17 : 0.15; for (const q of arr(r.rects)) g.fillRect(X(q[0]), Z(q[1]), (q[2] - q[0]) * s, (q[3] - q[1]) * s); g.globalAlpha = 1; }
  }
  // the garden: gravel cross and the fountain
  g.fillStyle = t.dark ? "#3c5a35" : "#c9dcbc";
  g.fillRect(X(-0.9), Z(-7), 1.8 * s, 14 * s); g.fillRect(X(-11), Z(-0.9), 22 * s, 1.8 * s);
  g.beginPath(); g.arc(X(0), Z(0), Math.max(2.5, 1.6 * s), 0, 7); g.fillStyle = t.dark ? "#3d6d8f" : "#8cc3e6"; g.fill();
  // walls
  g.lineWidth = big ? 2 : 1.25;
  g.strokeStyle = t.dark ? t.muted : t.ink2;
  g.globalAlpha = big ? 0.55 : 0.5;
  for (const r of arr(data.rooms)) {
    if (r.id === "portico" || r.kind === "esterno") continue;
    for (const q of arr(r.rects)) g.strokeRect(X(q[0]), Z(q[1]), (q[2] - q[0]) * s, (q[3] - q[1]) * s);
  }
  g.globalAlpha = 1;
  // the openings, as gaps in the walls
  g.strokeStyle = t.paper; g.lineWidth = big ? 3 : 2;
  for (const d of arr(data.doors)) {
    g.beginPath();
    if (d.axis === "x") { g.moveTo(X(d.x - d.w / 2), Z(d.z)); g.lineTo(X(d.x + d.w / 2), Z(d.z)); }
    else { g.moveTo(X(d.x), Z(d.z - d.w / 2)); g.lineTo(X(d.x), Z(d.z + d.w / 2)); }
    g.stroke();
  }
  // the room names
  if (big || w >= 180) {
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const r of arr(data.rooms)) {
      const q = arr(r.rects)[0];
      if (!q) continue;
      let name = null, col = t.ink2;
      if (SHORT[r.id]) name = big ? String(r.name || SHORT[r.id]) : SHORT[r.id];
      else if (big && r.kind === "dormitorio") { const k = r.owner || String(r.id).replace(/^dorm_/, ""); name = nameOf(k); col = t.c[k] || t.ink2; }
      if (!name) continue;
      const cw = (q[2] - q[0]) * s - 4;
      let fs = big ? Math.min(13, Math.max(8, s * 0.95)) : 8.5;
      g.font = `600 ${fs}px ${t.head}`;
      while (g.measureText(name).width > cw && fs > 6.5) { fs -= 0.5; g.font = `600 ${fs}px ${t.head}`; }
      if (g.measureText(name).width > cw) { if (!SHORT[r.id] || name === SHORT[r.id]) continue; name = SHORT[r.id]; if (g.measureText(name).width > cw) continue; }
      const cy = r.kind === "dormitorio" ? Z(q[3]) - fs : r.id === "cortile" ? Z(q[1]) + fs * 0.9 + 2 : Z(q[1]) + fs * 0.9 + 2;
      g.fillStyle = col; g.globalAlpha = 0.85;
      g.fillText(name, (X(q[0]) + X(q[2])) / 2, cy);
      g.globalAlpha = 1;
    }
  }
  // the camera wedge
  const cam = has3d() && R() && R().camera;
  if (cam && !big && window.THREE) {
    if (!camV) camV = new window.THREE.Vector3();
    cam.getWorldDirection(camV);
    const a = Math.atan2(camV.x, camV.z), cx = U.clamp(X(cam.position.x), 6, w - 6), cz = U.clamp(Z(cam.position.z), 6, hh - 6);
    const L1 = 15, sp = 0.42;
    g.beginPath(); g.moveTo(cx, cz);
    g.lineTo(cx + Math.sin(a - sp) * L1, cz + Math.cos(a - sp) * L1);
    g.lineTo(cx + Math.sin(a + sp) * L1, cz + Math.cos(a + sp) * L1);
    g.closePath();
    g.fillStyle = t.dark ? "rgba(255,255,255,.22)" : "rgba(21,35,58,.18)"; g.fill();
    g.beginPath(); g.arc(cx, cz, 2.6, 0, 7); g.fillStyle = t.ink; g.fill();
  }
  // the agents: dots pushed apart where they overlap, a soft glow, a ring on the followed one and on who speaks
  const dots = [], l = noLife ? null : L();
  const r0 = big ? Math.max(7, Math.min(11, s * 0.75)) : 3.5;
  if (l && typeof l.where === "function") {
    const st = typeof l.status === "function" ? arr(safe(() => l.status(), [])) : [];
    for (const k of KEYS) {
      const p = safe(() => l.where(k), null);
      if (p && isNum(p.x) && isNum(p.z)) dots.push({ k, x: X(p.x), y: Z(p.z), talk: st.some((x) => obj(x) && x.key === k && x.speaking) });
    }
    const min = 2 * r0 + (big ? 2 : 1);
    for (let it = 0; it < 6; it++) for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
      const A = dots[i], B = dots[j], dx = B.x - A.x || 0.01 * (j - i), dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const m = (min - d) / 2 / (d || 1);
      A.x -= dx * m; A.y -= dy * m; B.x += dx * m; B.y += dy * m;
    }
    const pulse = ctx.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 260);
    dots.sort((a, b) => (a.k === followKey) - (b.k === followKey));
    for (const d of dots) {
      const c = t.c[d.k];
      if (d.k === followKey || d.talk) {
        g.beginPath(); g.arc(d.x, d.y, r0 + (big ? 4 : 2.5) + (d.k === followKey ? pulse * 2 : 0), 0, 7);
        g.strokeStyle = c; g.globalAlpha = d.k === followKey ? 1 : 0.55; g.lineWidth = d.k === followKey ? 2 : 1.4; g.stroke(); g.globalAlpha = 1;
      }
      g.save(); g.shadowColor = c; g.shadowBlur = big ? 8 : 5;
      g.beginPath(); g.arc(d.x, d.y, r0, 0, 7); g.fillStyle = c; g.fill(); g.restore();
      g.lineWidth = big ? 2 : 1.3; g.strokeStyle = t.sheet; g.stroke();
      if (big) {
        g.fillStyle = "#fff"; g.font = `700 ${Math.round(r0 * 0.95)}px ${t.head}`;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(INI[d.k], d.x, d.y + 0.5);
      }
    }
  }
  return { dots, X, Z, s, ox, oz, x0, z0 };
}
function rr(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawMinimap() {
  if (!el.mapCv || planOn || !mapOpen || el.map.hidden) return;
  const [w, hh] = compact ? [132, 110] : [200, 167];
  const geo = drawMap(el.mapCv, w, hh, false);
  if (geo) { mapGeo = geo; mapDots = geo.dots; }
}
function drawPlan() {
  if (!planOn || !el.planCv) return;
  const w = Math.max(200, Math.min(el.plan.clientWidth - 28, 760));
  const geo = drawMap(el.planCv, w, Math.round(w * 0.8), true);
  if (geo) { planGeo = geo; planDots = geo.dots; }
}
function onMapClick(e, cv, big) {
  const geo = big ? planGeo : mapGeo, dots = big ? planDots : mapDots;
  if (!geo) return;
  const rect = cv.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bd = big ? 14 : 8;
  for (const d of dots) { const dd = Math.hypot(d.x - x, d.y - y); if (dd <= bd) { bd = dd; best = d.k; } }
  if (best) { follow(best); return; }
  if (big || !has3d()) return;
  const wx = geo.x0 + (x - geo.ox) / geo.s, wz = geo.z0 + (y - geo.oz) / geo.s;
  const w = Wd(), room = w && typeof w.roomAt === "function" ? safe(() => w.roomAt(wx, wz), null) : null;
  if (!room) return;
  const r = R();
  if (!r) return;
  if (followKey) stopFollowLocal();
  safe(() => { r.setCameraMode("regia"); r.focus({ room, priority: 2, shot: "wide", reason: "mappa" }); });
}
const planLegRows = {};
function renderPlanLegend() {
  if (!planOn) return;
  const l = noLife ? null : L();
  const st = l && typeof l.status === "function" ? safe(() => l.status(), []) : [];
  for (const k of KEYS) {
    let row = planLegRows[k];
    if (!row) {
      row = planLegRows[k] = { li: null, txt: h("span") };
      row.li = h("li", { class: "k-" + k }, dot(k), h("b", { text: NM[k] }), row.txt);
      el.planLeg.append(row.li);
    }
    const s = st.find((x) => x && x.key === k);
    const tx = s ? [s.label, s.roomName ? "in " + s.roomName : ""].filter(Boolean).join(" · ") : "";
    setText(row.txt, tx);
  }
}
function setPlan(on) {
  on = !!on;
  if (on === planOn && el.hud) return;
  planOn = on;
  const stage = C.ctx && C.ctx.stage;
  if (stage) stage.classList.toggle("cp-no3d", on);
  el.hud.classList.toggle("cp-u-no3d", on);
  show(el.plan, on);
  show(el.ctl, !on);
  show(el.map, !on);
  // a lost GPU context is a pause, not a device without 3D
  const note = el.plan.querySelector(".cp-u-plan-note");
  if (note) note.textContent = lost && C.ctx && C.ctx.has3d ? PAUSE3D : NO3D;
  if (on) { closePicker(); renderPlanLegend(); requestAnimationFrame(drawPlan); }
  placeMind();
}
const planWanted = () => !(C.ctx && C.ctx.has3d) || lost;

// ---- the replay bar
let repSig = "", repMore = false;
function renderReplay() {
  if (!el.replay) return;
  const l = noLife ? null : L();
  const mode = l ? l.mode : null, rs = l && obj(l.replayState);
  const now = performance.now();
  if (replayMsg && now > replayMsgT) replayMsg = null;
  let m = null;
  if (mode === "replica" && rs) {
    const held = D.held().map((g) => g.data);
    const prev = held.filter((d) => d < rs.date).pop() || null, next = held.find((d) => d > rs.date) || null;
    m = { k: "rep", date: rs.date, step: rs.step, total: rs.total, playing: rs.playing !== false, speed: rs.speed || 1, phase: rs.phase, prev, next };
  } else if (replayMsg) m = { k: "msg", text: replayMsg };
  else if (["vita", "notte", "riunione"].includes(mode) && obj(C.data.ultimo) && U.isoDay(C.data.ultimoData)) m = { k: "rev", date: C.data.ultimoData };
  const sg = sig([m, compact, repMore]);
  if (sg === repSig) return;
  repSig = sg;
  const box = el.replay;
  box.classList.toggle("cp-u-rmini", compact && !!m && m.k === "rep");
  if (!m) { box.hidden = true; box.textContent = ""; return; }
  const keep = box.contains(document.activeElement) ? document.activeElement.dataset.act : null;
  box.textContent = "";
  box.hidden = false;
  if (m.k === "msg") box.append(h("span", { class: "cp-u-rinfo" }, h("b", { text: m.text })));
  else if (m.k === "rev") {
    box.append(h("button", { class: "cp-u-btn strong", "data-act": "rev", onclick: () => select(m.date) }, icon("play"), "Rivedi la riunione di " + U.longDay(m.date)));
  } else {
    const tot = isNum(m.total) && m.total > 0 ? m.total : 0, st = isNum(m.step) ? Math.min(m.step + 1, tot) : 0;
    const pct = tot ? Math.round((st / tot) * 100) : 0;
    const stopB = h("button", { class: "cp-u-btn strong", "data-act": "stop", onclick: () => { repMore = false; const lf = L(); if (lf && lf.stopReplay) safe(() => lf.stopReplay()); renderReplay(); } }, "Torna al presente");
    const speedB = h("button", { class: "cp-u-btn", "data-act": "speed", title: "Cambia la velocità", onclick: () => ctl({ speed: m.speed === 1 ? 2 : m.speed === 2 ? 4 : 1 }) }, `Velocità ${m.speed}×`);
    const restartB = h("button", { class: "cp-u-btn", "data-act": "restart", onclick: () => ctl({ restart: true }) }, "Da capo");
    const playB = h("button", { class: "cp-u-btn", "data-act": "play", "aria-pressed": String(!m.playing), "aria-label": m.playing ? "Pausa" : "Riprendi", title: m.playing ? "Pausa" : "Riprendi", onclick: () => ctl({ playing: !m.playing }) }, icon(m.playing ? "pause" : "play"), compact ? null : m.playing ? "Pausa" : "Riprendi");
    box.append(h("span", { class: "cp-u-rday" },
      h("button", { class: "cp-u-btn", "data-act": "prev", "aria-label": "La riunione prima", title: "La riunione prima", disabled: !m.prev, onclick: () => m.prev && select(m.prev) }, "‹"),
      h("span", { class: "cp-u-rinfo" },
        h("b", { text: "Replica di " + U.longDay(m.date) }),
        h("span", { text: m.phase === "raduno" ? "Si siedono al tavolo" : m.phase === "fine" ? "La riunione è finita" : tot ? `Battuta ${st} di ${tot}` : "" }),
        h("span", { class: "cp-u-prog" }, h("i", { style: `width:${pct}%` }))),
      h("button", { class: "cp-u-btn", "data-act": "next", "aria-label": "La riunione dopo", title: "La riunione dopo", disabled: !m.next, onclick: () => m.next && select(m.next) }, "›")), playB);
    // on a narrow stage one row: the rest behind «⋯»
    if (compact) {
      box.append(h("button", { class: "cp-u-btn", "data-act": "more", "aria-expanded": String(repMore), "aria-label": "Altri comandi della replica", title: "Velocità, da capo, torna al presente", onclick: () => { repMore = !repMore; renderReplay(); } }, "⋯"));
      if (repMore) box.append(h("div", { class: "cp-u-rmore cp-u-glass" }, speedB, restartB, stopB));
    } else box.append(speedB, restartB, stopB);
  }
  if (keep) { const b = box.querySelector(`[data-act="${keep}"]`); if (b && !b.disabled) b.focus({ preventScroll: true }); }
}
function ctl(o) { const l = L(); if (l && l.replayControl) safe(() => l.replayControl(o)); renderReplay(); }
function select(date) {
  const g = window.CampusGlue;
  if (g && typeof g.select === "function") safe(() => g.select(date));
  else { const l = L(); if (l && l.replay) safe(() => l.replay(date)); }
  setTimeout(renderReplay, 0);
}

// ---- follow and the «La mente» card
function follow(key) {
  const k = KEYS.includes(key) ? key : null;
  closePicker();
  if (k === followKey) { if (k && has3d() && camMode !== "segui") safe(() => R().setCameraMode("segui", { key: k })); return; }
  followKey = k;
  if (has3d()) {
    const r = R(), p = P();
    if (r && r.setCameraMode) safe(() => r.setCameraMode(k ? "segui" : "regia", k ? { key: k } : undefined));
    if (p && p.ready && p.setHighlight) safe(() => p.setHighlight(k));
  } else { camMode = k ? "segui" : "regia"; renderCam(); }
  afterFollow();
}
function stopFollowLocal() {
  if (!followKey) return;
  followKey = null;
  const p = P();
  if (has3d() && p && p.ready && p.setHighlight) safe(() => p.setHighlight(null));
  afterFollow();
}
function afterFollow() {
  mindSig = "";
  buildMind();
  renderActs();
  labelCanvas();
  drawMinimap();
  bus.emit("ui:follow", { key: followKey });
}
let mindEl = null, mindBody = null, mindKey = null, mindSig = "", mindMin = false;
function buildMind() {
  if (mindEl) { mindEl.remove(); mindEl = null; }
  mindKey = followKey;
  if (!followKey) return;
  const k = followKey;
  mindBody = h("div", { class: "cp-u-mbody", style: "display:grid;gap:10px" });
  mindEl = h("article", { class: "cp-u-mind cp-u-glass k-" + k, "aria-label": "La mente di " + withArt(k) },
    h("div", { class: "cp-u-mhd" },
      h("span", { class: "cp-u-ava", "aria-hidden": "true", text: NM[k].slice(0, 1) }),
      h("div", null, h("h3", null, h("small", { text: "La mente" }), NM[k]), h("p", { text: ROLE[k] || "" })),
      h("span", { style: "display:flex;gap:6px" },
        h("button", { class: "cp-u-x cp-u-min", "aria-label": "Riduci la scheda", title: "Riduci o apri la scheda", "aria-expanded": String(!mindMin), onclick: (e) => { mindMin = !mindMin; e.currentTarget.setAttribute("aria-expanded", String(!mindMin)); show(mindBody, !mindMin); } }, icon("chev")),
        h("button", { class: "cp-u-x", "aria-label": "Smetti di seguire", title: "Smetti di seguire", onclick: () => follow(null) }, icon("x")))),
    mindBody);
  show(mindBody, !mindMin);
  placeMind();
  renderMind();
}
function placeMind() {
  if (!mindEl) return;
  const host = narrow || planOn ? el.mindSide : el.mindDesk;
  if (host && mindEl.parentNode !== host) host.append(mindEl);
}
function mindOf(k) {
  const l = noLife ? null : L();
  const m = l && typeof l.mind === "function" ? safe(() => l.mind(k), null) : null;
  if (m) return m;
  const c = D.calibration(k);
  return { key: k, wallet: D.wallet(k), lezione: D.lesson(k), previsione: D.openPrediction(k), calibrazione: c ? { n: c.n, brier: c.brier, eccesso: c.eccesso_di_sicurezza } : null, voti: D.votes(k) };
}
function mindModel(k) {
  const m = mindOf(k) || {}, out = [];
  const now = [m.label ? U.cap(String(m.label)) : "", m.roomName || "", sinceTxt(m.since)].filter(Boolean);
  if (now.length) out.push(["Adesso", "t", now.join(" · ")]);
  if (m.moodLabel) out.push(["Umore", "mood", [String(m.mood || ""), String(m.moodLabel), U.plain(m.moodWhy || "", 160)]]);
  let data = 0;
  const w = m.wallet !== undefined ? m.wallet : D.wallet(k);
  if (obj(w)) {
    const p = [], ud = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
    if (isNum(w.judg)) p.push(["a giudizio", `${U.fmt(w.judg)} USDT`, isNum(w.pnlPct) ? `(${U.pct(w.pnlPct)})` : "", ud(w.pnlPct)]);
    if (isNum(w.rules)) p.push(["la regola", `${U.fmt(w.rules)} USDT`]);
    if (isNum(w.gap)) p.push(["differenza", `${U.fmt(w.gap, 2, true)} USDT`, "", "", ud(w.gap)]);
    const gw = obj(C.data.giudizio) && obj(C.data.giudizio.wallets) && obj(C.data.giudizio.wallets[k]);
    const pos = arr(gw && gw.positions).filter((x) => obj(x) && x.symbol).map((x) => `${x.symbol} ${x.side || ""}`.trim());
    if (pos.length) p.push(["aperte", pos.join(", ")]);
    if (p.length > (pos.length ? 1 : 0)) { out.push(["Portafoglio", "num", p]); data++; }
  }
  const les = obj(m.lezione) ? m.lezione : null;
  if (les && les.testo) { out.push(["L'ultima lezione", "read", U.plain(les.testo, 220) + (U.isoDay(les.data) ? ` (${U.dm(les.data)})` : "")]); data++; }
  const pr = obj(m.previsione) ? m.previsione : null;
  if (pr && pr.mercato && pr.direzione) { out.push(["La previsione aperta", "t", U.predText(pr)]); data++; }
  const cal = D.calibration(k);
  if (cal) {
    const a = [isNum(cal.brier) ? `Brier ${U.fmt(cal.brier, 2)} su ${cal.n} previsioni` : `${cal.n} previsioni verificate`];
    if (isNum(cal.sicurezza_media) && isNum(cal.successi)) a.push(`dice il ${U.prob(cal.sicurezza_media)} e ci prende il ${U.prob(cal.successi)}`);
    out.push(["Calibrazione", "t", a.join("; ")]);
    data++;
  }
  const v = obj(m.voti) ? m.voti : D.votes(k);
  if (v && (obj(v.preside) || obj(v.auto))) { out.push(["I voti", "votes", v]); data++; }
  if (!careersReady()) out.push(["Carriera", "t", careersWait()]);
  else if (C.GRADED.includes(k)) {
    const c = careers()[k];
    if (c) out.push(["Carriera", "career", c]);
  } else out.push(["Carriera", "t", U.cap(ledTxt(presideMeetings()))]);
  if (!data) out.push(["", "empty", C.data.got.memoria ? "Il suo quaderno è ancora vuoto." : C.data.unavailable ? "Il quaderno compare quando apri la pagina da claude.ai." : "Carico il quaderno…"]);
  return out;
}
function renderMind() {
  if (!mindEl || !followKey) return;
  if (mindKey !== followKey) { buildMind(); return; }
  const model = mindModel(followKey), sg = sig(model);
  if (sg === mindSig) return;
  mindSig = sg;
  mindBody.textContent = "";
  for (const [title, kind, val] of model) {
    let body;
    if (kind === "mood") body = h("p", null, h("span", { class: "cp-u-mood", "data-mood": val[0], text: val[1] }), val[2]);
    else if (kind === "num") body = h("div", { class: "cp-u-wal" }, val.map(([a, b, c, cc, bc]) => h("p", null, h("span", { text: a }), " ", h("b", { class: "num " + (bc || ""), text: b }), c ? [" ", h("span", { class: "num " + (cc || ""), text: c })] : null)));
    else if (kind === "read") body = h("p", { class: "cp-u-read", text: val });
    else if (kind === "votes") body = votesEl(followKey, val);
    else if (kind === "career") body = careerLine(val);
    else if (kind === "empty") body = h("p", { class: "cp-u-read", text: val });
    else body = h("p", { text: val });
    mindBody.append(h("section", { class: "cp-u-ms" }, title ? h("h4", { text: title }) : null, body));
  }
}
const gradeTxt = (v) => (isNum(U.toNum(v)) ? String(U.toNum(v)) : "");
function votesEl(k, v) {
  const p = h("p");
  const pv = obj(v.preside), av = obj(v.auto);
  const pair = (o, self) => {
    const r = gradeTxt(o.ragionamento), d = gradeTxt(o.disciplina);
    return [r ? ["R", h("span", { class: "cp-u-pen" + (self ? " self" : ""), text: r })] : null, r && d ? " · " : null, d ? ["D", h("span", { class: "cp-u-pen" + (self ? " self" : ""), text: d })] : null];
  };
  if (pv) p.append("il Preside ", ...pair(pv, false).flat(2).filter((x) => x != null));
  if (av) p.append(pv ? "; " : "", k === "tartaruga" ? "lei stessa " : "lui stesso ", ...pair(av, true).flat(2).filter((x) => x != null));
  const dd = U.dm((av && av.data) || v.data);
  if (dd) p.append(` (${dd})`);
  return p;
}
function careerLine(c, card) {
  const span = c.next ? c.next - c.base : 1, pct = c.next ? U.clamp(((c.xp - c.base) / span) * 100, 0, 100) : 100;
  return h("div", { style: "display:grid;gap:5px" },
    card ? null : h("div", { class: "cp-u-xpt" }, h("span", null, `Livello ${c.level} · `, h("b", { text: c.levelName })), h("span", { text: `${c.medals.length} ${c.medals.length === 1 ? "medaglia" : "medaglie"}` })),
    h("div", { class: "cp-u-xp", role: "img", "aria-label": `${c.xp} XP` + (c.next ? ` su ${c.next}` : "") }, h("i", { style: `width:${pct.toFixed(1)}%` })),
    h("div", { class: "cp-u-xpt" }, h("span", null, h("b", { text: `${c.xp} XP` })), h("span", { text: c.next ? `prossimo livello a ${c.next}` : "il livello più alto" })));
}

// ---- the side panel
const tabBtn = {}, panel = {};
function buildSide() {
  const side = slots.side;
  side.textContent = "";
  el.mindSide = h("div", { class: "cp-u-mind-side" });
  el.tabs = h("div", { class: "cp-u-tabs", role: "tablist", "aria-label": "Cosa succede nel campus" });
  for (const [n, t] of TABS) {
    tabBtn[n] = h("button", { role: "tab", id: "cp-u-tab-" + n, "aria-controls": "cp-u-panel-" + n, "aria-selected": "false", tabindex: "-1", onclick: () => tab(n), onkeydown: onTabKey }, t);
    el.tabs.append(tabBtn[n]);
    panel[n] = h("div", { role: "tabpanel", id: "cp-u-panel-" + n, "aria-labelledby": "cp-u-tab-" + n, class: "cp-u-panel", hidden: true });
  }
  el.wait = h("p", { class: "cp-u-wait", text: WAIT, hidden: true });
  // 1. the feed
  el.feed = h("ol", { class: "cp-u-feed", "aria-label": "Quello che si dicono, dal più vecchio al più nuovo" });
  el.feedEmpty = h("p", { class: "cp-u-empty", text: "Qui compare quello che si dicono." });
  el.newChip = h("button", { class: "cp-u-newchip", hidden: true, onclick: () => feedBottom(true) }, "Nuovi messaggi ↓");
  el.feed.addEventListener("scroll", () => { stick = el.feed.scrollTop + el.feed.clientHeight >= el.feed.scrollHeight - 28; if (stick) el.newChip.hidden = true; }, { passive: true });
  panel.dialoghi.append(h("div", { class: "cp-u-feedwrap" }, el.feedEmpty, el.feed, el.newChip),
    h("details", { class: "cp-u-legend" }, h("summary", null, LEGEND.map(([k, chip]) => h("span", { class: "cp-u-kind cp-u-kind-" + k }, k === "claude" ? icon("spark") : null, k === "claude" ? "Claude" : chip)), h("span", { text: "Cosa vogliono dire?" })),
      LEGEND.map(([k, chip, text]) => h("p", null, h("b", { text: chip }), ": " + text))));
  // 2. the activities
  el.acts = h("ul", { class: "cp-u-acts", "aria-label": "Cosa fanno gli otto agenti" });
  panel.attivita.append(el.acts);
  // 3. «Fateli parlare»
  buildTalk();
  el.side = h("div", { class: "cp-u cp-u-side" + (ctx.reduceMotion ? " cp-u-rmo" : "") }, el.mindSide, el.tabs, el.wait, TABS.map(([n]) => panel[n]));
  side.append(el.side);
}
function tabVisible(n) {
  if (noLife || !L()) return false;
  return n === "parlare" ? talkOn() : true;
}
function tab(name, focus) {
  const n = TABS.some(([x]) => x === name) ? name : "dialoghi";
  tabCur = tabVisible(n) ? n : TABS.map(([x]) => x).find(tabVisible) || "dialoghi";
  const any = TABS.some(([x]) => tabVisible(x));
  show(el.tabs, any);
  show(el.wait, !any);
  for (const [x] of TABS) {
    const on = any && x === tabCur;
    show(tabBtn[x], tabVisible(x));
    tabBtn[x].setAttribute("aria-selected", String(on));
    tabBtn[x].tabIndex = on ? 0 : -1;
    show(panel[x], on);
  }
  if (n === tabCur) lsSet("cp-tab", tabCur);
  if (focus) tabBtn[tabCur].focus();
  if (tabCur === "dialoghi") requestAnimationFrame(() => feedBottom(false));
  if (tabCur === "attivita") renderActs();
}
function onTabKey(e) {
  const vis = TABS.map(([x]) => x).filter(tabVisible);
  const i = vis.indexOf(tabCur);
  let j = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % vis.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + vis.length) % vis.length;
  else if (e.key === "Home") j = 0;
  else if (e.key === "End") j = vis.length - 1;
  if (j === null) return;
  e.preventDefault();
  tab(vis[j], true);
}

// the feed
let stick = true, feedMode = null, feedPending = false, feedCount = 0;
const sourceTxt = (s) => { s = String(s); return /^verbale/.test(s) ? "dal " + s : /^(palestra|gara)/.test(s) ? "dalla " + s : s; };
function kindChip(e) {
  const kind = C.KINDS[e.kind] ? e.kind : "chiacchiera";
  const text = kind === "ufficiale" ? (e.source ? sourceTxt(e.source) : "ufficiale") : C.KINDS[kind];
  return h("span", { class: "cp-u-kind cp-u-kind-" + kind, title: kind === "ufficiale" ? "Parole scritte dagli agenti" : null }, kind === "claude" ? icon("spark") : null, text);
}
function timeOf(at) {
  const d = U.utc(at);
  if (!d) return "";
  const r = U.rome(d), today = U.rome(C.clock.now()).date;
  return (r.date !== today ? U.dm(r.date) + " " : "") + pad2(r.hh) + ":" + pad2(r.mm);
}
function feedItem(e, rep) {
  if (!obj(e)) return null;
  const k = okKey(e.who);
  const to = KEYS.includes(e.to) && e.to !== e.who ? e.to : null;
  const head = h("span", { class: "cp-u-mh" }, dot(k), h("b", { text: nameOf(e.who) }), to ? h("span", { text: "→ " + nameOf(to) }) : null,
    e.label ? h("span", { text: "· " + U.plain(e.label, 60) }) : null, h("time", { text: timeOf(e.at) }), kindChip(e));
  const body = h("span", { class: "cp-u-mt", text: String(e.text || "") });
  const canJump = rep && isNum(e.step);
  const inner = canJump ? h("button", { class: "cp-u-mb", title: "Torna a questo momento della riunione", onclick: () => { const l = L(); if (l && l.replayJump) safe(() => l.replayJump(e.step)); markReplay(); } }, head, body) : h("div", { class: "cp-u-mb" }, head, body);
  return h("li", { class: "cp-u-msg k-" + k, "data-kind": C.KINDS[e.kind] ? e.kind : "chiacchiera", "data-step": canJump ? String(e.step) : null }, inner);
}
const repDate = () => { const l = L(); return l && l.mode === "replica" && obj(l.replayState) ? l.replayState.date : null; };
function replayEntries(date) {
  const by = new Map();
  for (const e of arr(L() && L().feed)) if (obj(e) && e.date === date) by.set(isNum(e.step) ? "s" + e.step : "i" + e.id, e);
  return [...by.values()].sort((a, b) => (isNum(a.step) ? a.step : 1e9) - (isNum(b.step) ? b.step : 1e9));
}
function renderFeed(full) {
  if (!el.feed) return;
  const l = noLife ? null : L();
  const rd = repDate();
  const mode = rd ? "rep:" + rd : "live";
  if (!l) { el.feed.textContent = ""; show(el.feedEmpty, true); return; }
  if (rd) {
    el.feed.textContent = "";
    for (const e of replayEntries(rd)) { const li = feedItem(e, true); if (li) el.feed.append(li); }
    feedMode = mode;
    markReplay();
  } else if (full || feedMode !== mode) {
    el.feed.textContent = "";
    const list = arr(l.feed).slice(-200);
    const frag = document.createDocumentFragment();
    for (const e of list) { const li = feedItem(e, false); if (li) frag.append(li); }
    el.feed.append(frag);
    feedMode = mode;
    feedCount = el.feed.children.length;
    stick = true;
    feedBottom(true);
  }
  show(el.feedEmpty, !el.feed.children.length);
}
function onFeed(entry) {
  if (!el.feed || noLife) return;
  if (repDate()) { if (!feedPending) { feedPending = true; requestAnimationFrame(() => { feedPending = false; renderFeed(true); }); } return; }
  if (feedMode !== "live") { renderFeed(true); return; }
  // an older entry went in its place: redraw
  const lf = arr(L() && L().feed);
  if (lf.length && lf[lf.length - 1] !== entry) { renderFeed(true); return; }
  const li = feedItem(entry, false);
  if (!li) return;
  el.feed.append(li);
  while (el.feed.children.length > 200) el.feed.firstElementChild.remove();
  show(el.feedEmpty, false);
  if (stick) feedBottom(false); else show(el.newChip, true);
}
// the scroll waits for the next frame: reading scrollHeight in the middle of a render forces a layout
let feedRaf = 0;
function feedBottom(force) {
  if (!el.feed) return;
  if (force) stick = true;
  if (!stick || feedRaf) return;
  feedRaf = requestAnimationFrame(() => { feedRaf = 0; if (!stick) return; el.feed.scrollTop = el.feed.scrollHeight; show(el.newChip, false); });
}
function markReplay() {
  const l = L(), rs = l && obj(l.replayState);
  if (!rs || !el.feed) return;
  const cur = isNum(rs.step) ? rs.step : -1;
  const items = [...el.feed.querySelectorAll("li[data-step]")];
  let nowEl = null;
  for (const li of items) { const s = +li.dataset.step; if (s <= cur) nowEl = li; }
  for (const li of items) {
    const s = +li.dataset.step, st = li === nowEl ? "now" : s <= cur ? "past" : "next";
    if (li.dataset.state !== st) li.dataset.state = st;
  }
  if (nowEl && tabCur === "dialoghi") {
    const top = nowEl.offsetTop - el.feed.clientHeight / 2 + nowEl.offsetHeight / 2;
    el.feed.scrollTop = Math.max(0, top);
  }
}

// the activities
const actRows = {};
let actTimer = 0;
function renderActs() {
  if (!el.acts) return;
  const l = noLife ? null : L();
  const st = l && typeof l.status === "function" ? safe(() => l.status(), []) : [];
  const night = l && l.mode === "notte";
  for (const k of KEYS) {
    let r = actRows[k];
    if (!r) {
      r = actRows[k] = { lab: h("span", { class: "cp-u-al" }), room: h("span", { class: "cp-u-ar" }), mood: h("span", { class: "cp-u-mood" }) };
      r.btn = h("button", { class: "cp-u-act k-" + k, "aria-pressed": "false", onclick: () => follow(followKey === k ? null : k) },
        h("span", { class: "whom" }, dot(k), NM[k]), r.mood, r.lab, r.room);
      el.acts.append(h("li", null, r.btn));
    }
    const s = arr(st).find((x) => obj(x) && x.key === k) || {};
    setText(r.lab, s.label ? U.cap(String(s.label)) : "");
    setText(r.room, [s.roomName || "", sinceTxt(s.since)].filter(Boolean).join(" · "));
    setText(r.mood, s.moodLabel || "");
    r.mood.dataset.mood = s.mood || "";
    show(r.mood, !!s.moodLabel);
    r.mood.title = s.moodWhy ? String(s.moodWhy) : "";
    r.btn.classList.toggle("dim", !!night && (s.state === "sleep" || s.label === "dorme"));
    r.btn.setAttribute("aria-pressed", String(followKey === k));
    r.btn.title = followKey === k ? "Smetti di seguire " + withArt(k) : "Segui " + withArt(k);
  }
}
function actsSoon() { if (actTimer) return; actTimer = setTimeout(() => { actTimer = 0; renderActs(); if (planOn) renderPlanLegend(); }, 250); }

// «Fateli parlare»
const talkOn = () => !!(C.ctx && C.ctx.sample) && !talkBlocked && !noLife && !!L() && typeof L().talk === "function";
function buildTalk() {
  el.talkChips = KEYS.map((k) => h("button", { class: "cp-u-chip k-" + k, "aria-pressed": "false", "data-key": k, onclick: () => { talkSel.has(k) ? talkSel.delete(k) : talkSel.size < 4 && talkSel.add(k); renderTalk(); } }, dot(k), NM[k]));
  el.topic = h("select", { class: "cp-u-select", id: "cp-u-topic" });
  el.talkBtn = h("button", { class: "cp-u-primary", onclick: () => doTalk(false) }, icon("spark"), "Fateli parlare");
  el.talkStatus = h("div", { class: "cp-u-status", role: "status", "aria-live": "polite" });
  el.talkBusy = h("p", { class: "cp-u-note", text: "Durante la diretta e la replica parlano con le loro parole.", hidden: true });
  el.talkHint = h("p", { class: "cp-u-note" });
  panel.parlare.append(h("div", { class: "cp-u-talk" },
    h("p", { text: "Scegli da 2 a 4 agenti e un argomento: Claude scrive un breve dialogo nel loro carattere, con i numeri veri della scuola, e loro lo recitano nel campus." }),
    h("div", { class: "cp-u-lab" }, h("span", { text: "Chi parla" }), h("div", { class: "cp-u-chips", role: "group", "aria-label": "Chi parla: da 2 a 4" }, el.talkChips), el.talkHint),
    h("label", { class: "cp-u-lab", for: "cp-u-topic" }, "Di cosa parlano", el.topic),
    el.talkBusy, el.talkBtn, el.talkStatus,
    h("p", { class: "cp-u-note", text: COST })));
}
let topicSig = "";
function renderTopics() {
  const l = L();
  const list = l ? arr(safe(() => l.talkTopics, [])) : [];
  const sg = sig(list);
  if (sg === topicSig) return;
  topicSig = sg;
  const cur = el.topic.value;
  el.topic.textContent = "";
  for (const t of list) {
    if (!obj(t) || !t.id) continue;
    el.topic.append(h("option", { value: t.id, disabled: !t.enabled }, U.cap(String(t.label || t.id)) + (t.enabled ? "" : ` (non adesso: ${TOPIC_WHY[t.id] || "mancano i dati"})`)));
  }
  const ok = list.find((t) => obj(t) && t.id === cur && t.enabled) || list.find((t) => obj(t) && t.enabled);
  if (ok) el.topic.value = ok.id;
}
function renderTalk() {
  if (!el.talkBtn) return;
  renderTopics();
  const l = L(), busyMode = l && (l.mode === "diretta" || l.mode === "replica");
  const running = ["thinking", "walking", "playing"].includes(talk.state);
  for (const b of el.talkChips) { b.setAttribute("aria-pressed", String(talkSel.has(b.dataset.key))); b.disabled = !!busyMode || running; }
  el.topic.disabled = !!busyMode || running;
  const n = talkSel.size;
  setText(el.talkHint, n < 2 ? `Scegline ancora ${2 - n}.` : n === 4 ? "Al massimo 4: per cambiarne uno, toglilo." : `Ne hai scelti ${n}.`);
  el.talkBtn.disabled = !!busyMode || running || n < 2 || n > 4 || !el.topic.value;
  show(el.talkBusy, !!busyMode);
  const s = el.talkStatus;
  const key = talk.state + "|" + (talk.code || "");
  if (s.dataset.k === key) return;
  s.dataset.k = key;
  s.textContent = "";
  s.classList.toggle("err", talk.state === "error");
  if (talk.state === "thinking") s.append(h("span", { class: "cp-u-spin", "aria-hidden": "true" }), "Claude sta scrivendo il dialogo…", h("button", { class: "cp-u-btn", onclick: () => { const lf = L(); if (lf && lf.cancelTalk) safe(() => lf.cancelTalk()); } }, "Ferma"));
  else if (talk.state === "walking") s.append(h("span", { class: "cp-u-spin", "aria-hidden": "true" }), "Il dialogo è pronto: si stanno avvicinando.");
  else if (talk.state === "playing" || talk.state === "done") {
    s.append("Ecco il dialogo: guardali parlare.");
    if (talk.state === "done") s.append(h("button", { class: "cp-u-btn", onclick: () => doTalk(true) }, "Un altro dialogo"), h("button", { class: "cp-u-btn", onclick: () => tab("dialoghi", true) }, "Leggi il dialogo"));
  } else if (talk.state === "error") s.append(TALK_ERR[talk.code] || TALK_OTHER);
}
async function doTalk(fresh) {
  const l = L();
  if (!l || typeof l.talk !== "function") return;
  const keys = fresh && talk.keys ? talk.keys.slice() : KEYS.filter((k) => talkSel.has(k));
  const topic = fresh && talk.topic ? talk.topic : el.topic.value;
  if (keys.length < 2 || keys.length > 4 || !topic) return;
  talk = { state: "thinking", code: null, keys, topic };
  renderTalk();
  let res = null;
  try { res = await l.talk(keys, topic, fresh ? { fresh: true } : undefined); } catch (e) { res = { ok: false, code: (e && e.code) || "other" }; }
  if (res && res.ok) { if (talk.state !== "done") { talk.state = "done"; renderTalk(); } }
  else talkError(res && res.code);
}
function talkError(code) {
  if (code === "cancelled") { talk.state = "idle"; talk.code = null; renderTalk(); return; }
  if (TALK_OFF(code)) { talkBlocked = true; talk.state = "idle"; talk.code = null; tab(tabCur); renderTalk(); return; }
  talk.state = "error"; talk.code = code || "other";
  renderTalk();
}

// ---- the player layer
function buildPlayer() {
  const p = slots.player;
  p.textContent = "";
  const sheet = (id, title, ic, sub) => {
    const body = h("div", { class: "cp-u-body", style: "display:grid;gap:14px;min-width:0" });
    const s = h("section", { class: "sheet cp-u cp-u-sheet cp-u-" + id + (ctx.reduceMotion ? " cp-u-rmo" : ""), "aria-labelledby": "cp-u-h-" + id },
      h("h3", { id: "cp-u-h-" + id }, icon(ic), title), sub ? h("p", { class: "cp-u-sub", text: sub }) : null, body);
    p.append(s);
    return body;
  };
  el.season = sheet("season", "La stagione", "laurea", "Il fondo comune degli 8 portafogli e la strada verso la laurea: si vince in squadra.");
  el.careers = sheet("careers", "Le carriere", "vincitore_gara", "Livelli e medaglie di ognuno, calcolati solo dai dati della scuola: presenze, voti, previsioni, quaderni, palestre e gare.");
  el.props = sheet("props", "Le tue sfide", "prima_riunione", "Proponi una sfida alla scuola: il Preside la legge e ti risponde.");
  el.gare = sheet("gare", "La gara", "semaforo_verde", null);
  buildForm();
}
let seasonSig = "", careersSig = "", garaSig = "", propListSig = "";
function renderPlayer() {
  renderSeason();
  renderCareers();
  renderPropList();
  renderGare();
  renderForm();
}
function renderSeason() {
  const s = season(), f = D.fund(), g = realGrad();
  const prog = obj(C.data.programma), days = arr(prog && prog.giorni).filter((x) => obj(x) && U.isoDay(x.data));
  const m = { s, src: f ? [f.source, f.at] : null, ms: days.filter((x) => x.tipo === "scrutinio" || x.tipo === "fine").map((x) => [x.data, x.tipo]), start: (prog && U.isoDay(prog.inizio) && prog.inizio) || C.SCHOOL_START, today: g.today };
  const sg = sig(m);
  if (sg === seasonSig) return;
  seasonSig = sg;
  const b = el.season;
  b.textContent = "";
  // the fund
  let fund;
  if (isNum(s.capitale)) {
    const scale = Math.max(10, Math.ceil(Math.abs(s.pct) / 10) * 10), wpct = U.clamp((Math.abs(s.pct) / scale) * 50, 0, 50);
    fund = h("div", { class: "cp-u-stat" }, h("h4", { text: "Il fondo comune" }),
      h("p", { class: "cp-u-big" }, "Il fondo comune: ", h("b", { text: U.fmt(s.capitale) + " USDT" }), " su 80.000 (", h("span", { class: s.pct >= 0 ? "up" : "down", text: U.pct(s.pct) }), ")"),
      h("div", { class: "cp-u-fundbar", role: "img", "aria-label": `${U.pct(s.pct)} rispetto agli 80.000 USDT di partenza` },
        h("i", { class: s.pct >= 0 ? "g" : "l", style: s.pct >= 0 ? `left:50%;width:${wpct}%` : `right:50%;width:${wpct}%` }), h("s")),
      h("div", { class: "cp-u-ticks" }, h("span", { text: "perde" }), h("span", { text: "80.000" }), h("span", { text: "guadagna" })));
  } else fund = h("div", { class: "cp-u-stat" }, h("h4", { text: "Il fondo comune" }), h("p", { class: "cp-u-big", text: "Il fondo comune parte il 26 novembre da 80.000 USDT finti." }));
  const quota = h("div", { class: "cp-u-stat" }, h("h4", { text: "A testa" }),
    isNum(s.quota) ? h("p", { class: "cp-u-big" }, "Diviso tra tutti e 8: ", h("b", { text: U.fmt(s.quota) + " USDT" }), " finti a testa") : h("p", { class: "cp-u-big", text: "Diviso tra tutti e 8, a fine stagione." }));
  const dd = isNum(s.days) ? s.days : null;
  const before = m.today < m.start;
  const road = h("div", { class: "cp-u-stat" }, h("h4", { text: "La laurea" }),
    h("p", { class: "cp-u-big" }, dd === 0 ? h("b", { text: "Oggi" }) : h("b", { text: `${dd} ${dd === 1 ? "giorno" : "giorni"}` }), dd === 0 ? "è il giorno della laurea" : "alla laurea del 21 febbraio 2027"));
  b.append(h("div", { class: "cp-u-stats" }, fund, quota, road));
  // the road to graduation
  const total = Math.max(1, U.daysBetween(m.start, C.GRADUATION));
  const at = U.clamp(U.daysBetween(m.start, m.today) / total, 0, 1);
  const track = h("div", { class: "cp-u-track", role: "img", "aria-label": `La stagione: dal ${U.dmy(m.start)} al 21/2/2027` },
    h("span", { class: "cp-u-rail" }, h("i", { style: `width:${(at * 100).toFixed(1)}%` })));
  for (const [d, tipo] of m.ms) {
    const x = U.clamp(U.daysBetween(m.start, d) / total, 0, 1) * 100;
    const fine = tipo === "fine";
    track.append(h("span", { class: "cp-u-mk" + (fine ? " fine" : "") + (d < m.today ? " past" : ""), style: `left:${x.toFixed(1)}%`, title: (fine ? "La laurea" : "Lo scrutinio del mese") + " · " + U.longDay(d) },
      h("i", null, fine ? icon("laurea") : null), h("span", { text: U.dm(d).replace(/^0/, "") })));
  }
  if (!before) track.append(h("span", { class: "cp-u-you", style: `left:${(at * 100).toFixed(1)}%`, title: "Oggi" }));
  const dayTxt = before ? "La scuola comincia il 26 novembre" : isNum(s.giorno) ? `Giorno ${s.giorno} di ${isNum(s.totale) ? s.totale : 88}` : "";
  const left = dd === null ? "" : dd === 0 ? "oggi è la laurea" : dd === 1 ? "manca 1 giorno alla laurea del 21 febbraio 2027" : `mancano ${dd} giorni alla laurea del 21 febbraio 2027`;
  b.append(h("div", { class: "cp-u-road" }, h("p", { class: "cp-u-gm", text: [dayTxt, left].filter(Boolean).join(" · ") }), track,
    h("p", { class: "cp-u-src" }, "◆ lo scrutinio di ogni mese, quando il Preside dà la pagella e decide il rischio di ognuno · ", "il cerchio rosso è oggi")));
  // the thesis
  const t = obj(s.tesi);
  const who = t && t.chi_la_propone ? String(t.chi_la_propone) : "";
  b.append(t && t.nome ? h("p", { class: "cp-u-tesi" }, "La tesi: ", h("b", { text: String(t.nome) }), who ? ` (la propone ${KEYS.includes(who) ? withArt(who) : who})` : "")
    : h("p", { class: "cp-u-tesi" }, "La tesi: ", h("b", { text: "si sceglie insieme l'ultimo giorno" })));
  if (f) {
    const when = f.source === "portafogli" ? U.romeTime(f.at) : U.dm(f.at);
    b.append(h("p", { class: "cp-u-src", text: f.source === "portafogli" ? `Somma degli 8 portafogli ai prezzi di BingX${when ? " del " + when : ""}.` : `Il fondo calcolato dal Guardiano${when ? " nella riunione del " + when : ""}.` }));
  }
}
// the avatar of a career card: follows the agent and brings the campus into view
const avaBtn = (k) => h("button", { class: "cp-u-ava", "aria-label": `Segui ${withArt(k)} nel campus`, title: `Segui ${withArt(k)} nel campus`, onclick: () => { follow(k); const st = C.ctx && C.ctx.stage; if (st && st.scrollIntoView) st.scrollIntoView({ behavior: ctx.reduceMotion ? "auto" : "smooth", block: "center" }); } }, NM[k].slice(0, 1));
function renderCareers() {
  const ready = careersReady(), c = ready ? careers() : null, pres = presideMeetings();
  const sg = sig([c, pres, C.TRADERS, ready, !!C.data.unavailable]);
  if (sg === careersSig) return;
  careersSig = sg;
  const b = el.careers;
  b.textContent = "";
  if (!ready) { b.append(h("p", { class: "cp-u-src", text: careersWait() })); return; }
  b.append(h("div", { class: "cp-u-pres k-preside" }, avaBtn("preside"),
    h("div", null, h("b", { text: `Il Preside · ${ledTxt(pres)}` }), h("p", { class: "cp-u-sub", text: "Non ha un livello: è lui che dà i voti." }))));
  const grid = h("div", { class: "cp-u-cards" });
  for (const k of C.GRADED) {
    const r = c[k];
    if (!r) continue;
    const trader = C.TRADERS.includes(k);
    const info = h("p", { class: "cp-u-minfo", "aria-live": "polite", text: `${r.medals.length} ${r.medals.length === 1 ? "medaglia" : "medaglie"} su ${trader ? 12 : 8}. Tocca una medaglia per leggere la regola.` });
    const medals = h("div", { class: "cp-u-medals", role: "group", "aria-label": "Le medaglie " + (C.ARTICLE[k] === "la" ? "della " : C.ARTICLE[k] === "lo" ? "dello " : "del ") + NM[k] });
    for (const [id, name, rule, onlyT] of MEDALS) {
      const on = r.medals.includes(id), na = onlyT && !trader;
      const state = on ? "Vinta" : na ? "Solo per i quattro con il portafoglio" : "Non ancora";
      const btn = h("button", { class: "cp-u-medal" + (on ? " on" : "") + (na ? " na" : ""), title: `${name}: ${U.cap(rule)}`, "aria-label": `${name}: ${U.cap(rule)}. ${state}.`, "aria-expanded": "false",
        onclick: () => {
          for (const x of medals.children) x.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-expanded", "true");
          info.textContent = "";
          info.append(h("b", { text: name }), ` · ${state.toLowerCase()}. ${U.cap(rule)}.`);
        } }, icon(id));
      medals.append(btn);
    }
    grid.append(h("article", { class: "cp-u-card k-" + k },
      h("div", { class: "cp-u-ch" }, avaBtn(k),
        h("div", null, h("h4", { text: NM[k] }), h("p", { text: `Livello ${r.level} · ${r.levelName}` })),
        h("span", { class: "cp-u-lv", title: "Livello " + r.level }, h("span", null, h("small", { text: "liv" }), String(r.level)))),
      careerLine(r, true), medals, info));
  }
  b.append(grid);
  const lv = LEVELS.map(([n, x]) => `${n} da ${U.fmt(x, 0)}`).join(", ");
  b.append(h("details", { class: "cp-u-how" }, h("summary", { text: "Come si calcola" }),
    h("p", { text: "I punti esperienza (XP) vengono solo da quello che la scuola ha scritto:" }),
    h("ul", null,
      h("li", { text: "10 per ogni riunione completa in cui ha preso i voti, più i voti stessi (ragionamento più disciplina);" }),
      h("li", { text: "15 per ogni previsione verificata giusta e 5 per ogni previsione verificata sbagliata: anche misurare un errore insegna;" }),
      h("li", { text: "10 per ogni regola scritta nel quaderno e 5 per ogni errore ammesso;" }),
      h("li", { text: "20 per ogni palestra della domenica;" }),
      h("li", { text: "30 per ogni gara finita a cui ha partecipato e 50 per ogni gara vinta." })),
    h("p", { text: `I livelli: ${lv}.` }),
    h("p", { text: "Le medaglie:" }),
    h("ul", null, MEDALS.map(([, n, r, t]) => h("li", null, h("b", { text: n }), `: ${r}${t ? " (solo per i quattro con il portafoglio)" : ""}.`)))));
}
// the owner's challenges: the form
const romeLocal = (d) => { const r = U.rome(d); return `${r.date}T${pad2(r.hh)}:${pad2(r.mm)}`; };
const romeLocalToDate = (v) => U.romeDate(v.slice(0, 10), +v.slice(11, 13) * 60 + +v.slice(14, 16));
function buildForm() {
  const f = {};
  f.ta = h("textarea", { class: "cp-u-ta", id: "cp-u-ptext", maxlength: "600", rows: "4", placeholder: "Per esempio: studiate perché ETH perde contro BTC e ditemi cosa ne pensate.", oninput: () => renderForm() });
  f.count = h("span", { class: "cp-u-count", "aria-live": "off" });
  f.radios = TIPI.map(([v, t], i) => h("label", { class: "cp-u-radio" }, h("input", { type: "radio", name: "cp-u-tipo", value: v, checked: i === 0, onchange: () => renderForm() }), h("span", { text: t })));
  f.when = h("input", { class: "cp-u-input", type: "datetime-local", id: "cp-u-pwhen" });
  f.leva = h("input", { class: "cp-u-input", type: "number", id: "cp-u-pleva", min: "1", max: "10", step: "1", value: "10", inputmode: "numeric" });
  f.gara = h("div", { class: "cp-u-row2", hidden: true },
    h("label", { class: "cp-u-lab", for: "cp-u-pwhen" }, "Fino a quando (ora di Roma)", f.when),
    h("label", { class: "cp-u-lab", for: "cp-u-pleva" }, "Leva (da 1 a 10)", f.leva));
  f.btn = h("button", { class: "cp-u-primary", onclick: submit }, "Proponi al Preside");
  f.msg = h("p", { class: "cp-u-pmsg", role: "status", "aria-live": "polite" });
  f.nodb = h("p", { class: "cp-u-pmsg", hidden: true });
  f.box = h("div", { class: "cp-u-form" },
    h("label", { class: "cp-u-lab", for: "cp-u-ptext" }, "La tua sfida", f.ta), f.count,
    h("fieldset", null, h("legend", { text: "Che cosa è" }), h("div", { class: "cp-u-radios" }, f.radios)),
    f.gara, f.nodb, f.btn, f.msg,
    h("p", { class: "cp-u-note", text: "Il Preside legge le proposte nella riunione delle 06:47 e risponde qui. Soldi solo finti: le proposte che chiedono soldi veri vengono rifiutate." }));
  f.list = h("div", { style: "display:grid;gap:10px;min-width:0" });
  el.props.append(h("div", { class: "cp-u-two" }, f.box, f.list));
  el.form = f;
  resetGaraFields();
}
const tipoOf = () => { const r = el.form.radios.map((l) => l.querySelector("input")).find((i) => i.checked); return r ? r.value : "studio"; };
function resetGaraFields() {
  const f = el.form, now = new Date();
  f.when.min = romeLocal(new Date(now.getTime() + 3600000));
  f.when.max = romeLocal(new Date(now.getTime() + 30 * 86400000));
  f.when.value = U.addDays(U.rome(now).date, 1) + "T15:00";
  f.leva.value = "10";
}
function renderForm() {
  const f = el.form;
  if (!f) return;
  const n = f.ta.value.trim().length;
  setText(f.count, `${f.ta.value.length}/600`);
  const gara = tipoOf() === "gara";
  show(f.gara, gara);
  const db = !!(C.ctx && C.ctx.db) && !C.data.unavailable;
  // «no db» only when the page says so, or when the capabilities are still missing after 12 s
  propState = db ? "ok" : C.data.unavailable || (capsSeen > 1 && performance.now() > CAPS_WAIT_MS) ? "nodb" : "wait";
  const off = propState !== "ok";
  f.ta.disabled = off; f.when.disabled = off; f.leva.disabled = off;
  for (const l of f.radios) l.querySelector("input").disabled = off;
  f.btn.disabled = off || saving || n < 1;
  show(f.nodb, off);
  setText(f.nodb, propState === "nodb" ? "Apri la pagina da claude.ai per proporre una sfida." : "Mi collego al database della scuola…");
}
async function submit() {
  const f = el.form;
  if (saving || propState !== "ok") return;
  const testo = f.ta.value.trim(), tipo = tipoOf();
  const say = (t, cls) => { f.msg.className = "cp-u-pmsg" + (cls ? " " + cls : ""); f.msg.textContent = t; };
  if (testo.length < 10) { say("Scrivi almeno 10 caratteri: racconta la sfida in una frase.", "err"); f.ta.focus(); return; }
  if (testo.length > 600) { say("Al massimo 600 caratteri.", "err"); f.ta.focus(); return; }
  let extra = {};
  if (tipo === "gara") {
    const v = String(f.when.value || "");
    const lev = Number(f.leva.value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) { say("Scegli fino a quando dura la gara.", "err"); f.when.focus(); return; }
    const end = romeLocalToDate(v), now = Date.now();
    if (!(end.getTime() >= now + 3600000 - 60000 && end.getTime() <= now + 30 * 86400000 + 60000)) { say("La gara deve chiudersi tra un'ora e 30 giorni da adesso.", "err"); f.when.focus(); return; }
    if (!Number.isFinite(lev) || lev < 1 || lev > 10 || Math.round(lev) !== lev) { say("La leva va da 1 a 10.", "err"); f.leva.focus(); return; }
    extra = { scadenza_utc: U.utcText(end), leva: Math.round(lev) };
  }
  const d = new Date(), iso = d.toISOString();
  const id = "p-" + iso.slice(0, 10).replace(/-/g, "") + "-" + iso.slice(11, 19).replace(/:/g, "") + "-" + Math.random().toString(36).slice(2, 6);
  saving = true; renderForm(); say("Salvo la proposta…");
  try {
    await C.ctx.db.collection("proposte").doc(id).set({ testo, tipo, creata: U.utcText(d), stato: "nuova", ...extra });
    saving = false;
    f.ta.value = "";
    f.radios[0].querySelector("input").checked = true;
    resetGaraFields();
    renderForm();
    say("Inviata: il Preside la legge nella riunione di domattina alle 06:47.", "ok");
    bus.emit("ui:proposal", { id, state: "sent" });
  } catch (e) {
    saving = false;
    renderForm();
    const code = (e && e.code) || "other";
    say(propErr(code), "err");
    bus.emit("ui:proposal", { id, state: "error", code });
  }
}
function renderPropList() {
  const f = el.form;
  if (!f) return;
  const map = obj(C.data.proposte) || {};
  const list = Object.entries(map).filter(([, p]) => obj(p)).sort((a, b) => String(b[1].creata || b[0]).localeCompare(String(a[1].creata || a[0])));
  const sg = sig(list);
  if (sg === propListSig) return;
  propListSig = sg;
  f.list.textContent = "";
  f.list.append(h("h4", { text: list.length ? "Le sfide che hai proposto" : "Le tue sfide" }));
  if (!list.length) { f.list.append(h("p", { class: "cp-u-empty", style: "padding:0", text: "Ancora nessuna sfida. Proponine una: il Preside risponde nella riunione del mattino." })); return; }
  const ul = h("ul", { class: "cp-u-plist" });
  for (const [, p] of list) {
    const tipo = TIPI.find(([v]) => v === p.tipo);
    const st = STATO_P[p.stato] ? p.stato : null;
    const when = U.romeTime(p.creata);
    const gx = p.tipo === "gara" ? [isNum(U.toNum(p.leva)) ? "leva " + U.toNum(p.leva) : "", U.romeTime(p.scadenza_utc) ? "fino al " + U.romeTime(p.scadenza_utc) : ""].filter(Boolean).join(" · ") : "";
    ul.append(h("li", { class: "cp-u-prop" },
      h("div", { class: "cp-u-ph" }, tipo ? h("span", { class: "tag", text: tipo[1] }) : null, st ? h("span", { class: "cp-u-st " + st, text: STATO_P[st] }) : null, when ? h("span", { text: "inviata il " + when }) : null),
      h("p", { class: "cp-u-pt", text: String(p.testo || "") }),
      gx ? h("p", { class: "cp-u-gm", text: gx }) : null,
      p.risposta ? h("div", { class: "cp-u-reply" }, h("b", { text: "Il Preside: " }), String(p.risposta), U.romeTime(p.data_risposta) ? h("span", { class: "cp-u-src", text: " · " + U.romeTime(p.data_risposta) }) : null) : null));
  }
  f.list.append(ul);
}
// the contests
const contestTitle = (id) => { const m = /^notte-(\d{4}-\d{2}-\d{2})$/.exec(id); return m ? "La gara della notte del " + U.dm(m[1]) : "La gara " + id; };
function renderGare() {
  const list = D.contests();
  const real = C.clock.real().getTime();
  const sg = sig([list.map((c) => [c.id, c.doc]), Math.floor(real / 60000)]);
  if (sg === garaSig) return;
  garaSig = sg;
  const b = el.gare;
  b.textContent = "";
  if (!list.length) { b.append(h("p", { class: "cp-u-empty", style: "padding:0", text: "Nessuna gara per ora. Puoi proporne una qui sopra." })); return; }
  const wrap = h("div", { class: "cp-u-garas" });
  for (const c of list) {
    const doc = c.doc, fin = finished(c), sit = obj(c.situazione) || {}, rows = obj(sit.classifica) || {};
    const wallets = obj(obj(doc.stato) && doc.stato.wallets) || {};
    const status = fin ? ["finita", "fatta"] : c.open ? ["aperta", "aperta"] : ["tempo scaduto: il Preside fa i conti nella riunione del mattino", "nuova"];
    const closed = fin || (c.scadenza && c.scadenza.getTime() <= real);
    const meta = [c.leva != null && isNum(U.toNum(c.leva)) ? "Leva " + U.toNum(c.leva) : "", c.scadenza ? (closed ? "si è chiusa " : "si chiude ") + U.romeTime(c.scadenza) : "", status[0]].filter(Boolean).join(" · ");
    const ranked = Object.keys(rows).filter((k) => KEYS.includes(k) && obj(rows[k])).sort((a, b2) => {
      const ra = U.toNum(rows[a].risultato), rb = U.toNum(rows[b2].risultato);
      return (rb ?? -Infinity) - (ra ?? -Infinity) || KEYS.indexOf(a) - KEYS.indexOf(b2);
    });
    // the opening standing: only the entry costs, so no leader; equal results share the place
    const ol = h("ol", { class: "cp-u-rank" + (c.opening ? " opening" : ""), "aria-label": c.opening ? "La classifica all'apertura" : "La classifica" });
    const resOf = (k) => U.toNum(rows[k].risultato);
    ranked.forEach((k, i) => {
      const row = rows[k], w = obj(wallets[k]) || {};
      const pos = arr(w.positions).find(obj), cl = arr(w.closed).find(obj), p = pos || cl;
      const res = U.toNum(row.risultato);
      const bits = [];
      if (p && p.symbol) bits.push(h("span", null, h("b", { text: String(p.symbol) }), " ", p.side ? h("span", { class: "side " + (p.side === "short" ? "short" : "long"), text: String(p.side) }) : null));
      if (p && isNum(U.toNum(p.margin))) bits.push(h("span", { text: "margine " + U.fmt(U.toNum(p.margin), 0) + " USDT" }));
      ol.append(h("li", { class: "cp-u-rk k-" + k },
        h("span", { class: "cp-u-pos", text: String(isNum(resOf(k)) ? 1 + ranked.filter((x) => isNum(resOf(x)) && resOf(x) > resOf(k)).length : i + 1) }),
        h("span", { class: "cp-u-rm" }, h("span", { class: "whom" }, dot(k), NM[k]), bits.length ? h("small", null, bits) : null),
        h("span", { class: "cp-u-rr" }, h("b", { class: isNum(res) ? (res > 0 ? "up" : res < 0 ? "down" : "") : "muted", text: isNum(res) ? U.usd(res, true) : "—" }),
          row.aperta === true || (!cl && pos) ? h("span", { class: "cp-u-st aperta", text: "aperta" }) : cl && cl.exit_reason ? h("span", { class: "cp-u-st", text: U.shortReason(cl.exit_reason) }) : null)));
    });
    const win = fin && KEYS.includes(sit.vincitore) ? sit.vincitore : null;
    const wres = win && obj(rows[win]) ? U.toNum(rows[win].risultato) : null;
    const words = fin ? doc.commento : doc.chiusura;
    wrap.append(h("article", { class: "cp-u-gara" },
      h("div", { class: "cp-u-gh" }, h("h4", { text: contestTitle(c.id) }), h("span", { class: "cp-u-st " + status[1], text: fin ? "finita" : c.open ? "aperta" : "tempo scaduto" })),
      h("p", { class: "cp-u-gm", text: meta }),
      obj(C.data.proposte) && obj(C.data.proposte[c.id]) && C.data.proposte[c.id].testo ? h("p", { class: "cp-u-gm" }, "È la sfida che hai proposto tu: ", h("i", { text: U.plain(C.data.proposte[c.id].testo, 160) })) : null,
      ranked.length && c.opening ? h("p", { class: "cp-u-src", text: `Classifica all'apertura${U.romeTime(doc.aperta_alle) ? ", " + U.romeTime(doc.aperta_alle) : ""}: per ora contano solo i costi; i conti veri alla chiusura.` }) : null,
      ranked.length ? ol : h("p", { class: "cp-u-gm", text: "La classifica arriva con i primi conti del motore." }),
      win && isNum(wres) ? h("p", { class: "cp-u-win" }, `Vince ${withArt(win)} con ${U.usd(wres, true)}: il premio è il doppio, ${isNum(U.toNum(sit.premio)) ? U.usd(U.toNum(sit.premio), true) : "il doppio"} finti.`)
        : fin ? h("p", { class: "cp-u-win", text: "Nessun vincitore: nessuno ha chiuso in guadagno." }) : null,
      typeof words === "string" && words.trim() ? h("details", { open: true }, h("summary", { text: fin ? "Il commento del Preside" : "Le parole del Preside" }), h("p", { class: "cp-u-words", text: words.trim() })) : null));
  }
  b.append(wrap);
}

// ---- events and the lifecycle
let playerTimer = 0;
function playerSoon() { if (playerTimer) return; playerTimer = setTimeout(() => { playerTimer = 0; safe(renderPlayer); safe(renderTalk); safe(renderReplay); mindSig = ""; safe(renderMind); }, 120); }
function setLifeGone(v) {
  if (noLife === v) return;
  noLife = v;
  tab(tabCur);
  renderFeed(true);
  renderLive();
}
function onResize() {
  const st = C.ctx && C.ctx.stage, w = st ? st.clientWidth : window.innerWidth;
  const c = w < 600;
  if (c !== compact) { compact = c; el.hud.classList.toggle("cp-u-compact", c); drawMinimap(); }
  if (planOn) drawPlan();
}
const CAPS_WAIT_MS = 12000;
function wire() {
  setTimeout(() => safe(renderForm), CAPS_WAIT_MS + 500);
  bus.on("data:change", () => playerSoon());
  // the season's day and days to graduation follow the real date: after a replay and at midnight
  bus.on("clock:override", () => playerSoon());
  setInterval(playerSoon, 60000);
  bus.on("life:mode", () => { liveSig = ""; renderLive(); renderFeed(false); renderReplay(); renderTalk(); actsSoon(); renderClock(); });
  bus.on("life:feed", (p) => onFeed(p && p.entry));
  bus.on("life:activity", actsSoon);
  bus.on("life:mood", actsSoon);
  bus.on("life:replay", (p) => {
    const st = p && p.state;
    if (st === "loading") { replayMsg = `Carico il verbale del ${U.dm(p.date)}…`; replayMsgT = performance.now() + 12000; }
    else if (st === "error") { replayMsg = p.slow ? `Non riesco ancora a caricare il verbale del ${U.dm(p.date)}: lo aspetto.` : `Il verbale del ${U.dm(p.date)} non c'è ancora.`; replayMsgT = performance.now() + 6000; }
    else if (st === "start" || st === "end") replayMsg = null;
    renderReplay();
    if (st === "start" || st === "end") renderFeed(true); else if (st === "step") { if (repDate()) markReplay(); }
  });
  bus.on("life:talk", (p) => {
    const st = p && p.state;
    if (st === "error") talkError(p.code);
    else if (st) { talk.state = st; talk.code = null; if (Array.isArray(p.keys)) talk.keys = p.keys.slice(); renderTalk(); }
  });
  bus.on("render:camera-mode", (p) => {
    const mode = p && p.mode;
    if (!mode) return;
    camMode = mode;
    renderCam();
    if (mode === "segui" && KEYS.includes(p.key) && p.key !== followKey) {
      followKey = p.key;
      const pp = P();
      if (pp && pp.ready && pp.setHighlight) safe(() => pp.setHighlight(p.key));
      afterFollow();
    } else if (mode !== "segui" && followKey && has3d()) stopFollowLocal();
  });
  bus.on("render:quality", renderQuality);
  bus.on("render:sky", () => renderClock());
  bus.on("render:pick", (p) => {
    if (!p || !KEYS.includes(p.key) || p.key === followKey) return;
    const r = R();
    if (r && r.cameraMode === "regia") follow(p.key);
  });
  bus.on("render:restored", () => { lost = false; setPlan(planWanted()); });
  bus.on("campus:degraded", (p) => {
    const m = p && p.module, why = p && p.reason;
    if (why === "context-lost") lost = true;
    if (m === "life") setLifeGone(true);
    if (["no-webgl", "no-3d", "context-lost", "error"].includes(why) && (m === "render" || m === "world" || m === "people" || why !== "error")) setPlan(planWanted());
  });
  bus.on("campus:ready", () => { setPlan(planWanted()); renderQuality(); renderCam(); tab(tabCur); renderFeed(true); renderActs(); renderClock(); renderLive(); });
  bus.on("campus:capabilities", () => { capsSeen++; if (!C.ctx.sample) talk.state = talk.state === "thinking" ? "idle" : talk.state; tab(tabCur); renderTalk(); renderForm(); });
  bus.on("campus:resize", onResize);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.picker && !el.picker.hidden) { closePicker(); el.cam.segui.focus(); } });
  document.addEventListener("pointerdown", (e) => { if (el.picker && !el.picker.hidden && !el.picker.contains(e.target) && e.target !== el.cam.segui) closePicker(); }, true);
  if (window.matchMedia) {
    mqNarrow = window.matchMedia("(max-width: 900px)");
    narrow = mqNarrow.matches;
    const onMq = () => { narrow = mqNarrow.matches; placeMind(); };
    if (mqNarrow.addEventListener) mqNarrow.addEventListener("change", onMq); else if (mqNarrow.addListener) mqNarrow.addListener(onMq);
    const dk = window.matchMedia("(prefers-color-scheme: dark)"), onDk = () => { tokAt = -1e9; drawMinimap(); drawPlan(); };
    if (dk.addEventListener) dk.addEventListener("change", onDk); else if (dk.addListener) dk.addListener(onDk);
  }
}

function init(c) {
  if (inited) return;
  ctx = c || C.ctx || {};
  const root = ctx.uiRoot || document.getElementById("campus-section");
  if (!root) throw new Error("Campus ui: no uiRoot");
  const q = (n) => root.querySelector(`[data-slot="${n}"]`);
  slots = { live: q("live"), hud: q("hud"), side: q("side"), player: q("player") };
  if (!document.getElementById("cp-style-ui")) document.head.append(h("style", { id: "cp-style-ui", text: CSS }));
  if (slots.hud) buildHud(); else el.hud = h("div");
  if (slots.side) buildSide(); else { el.mindSide = h("div"); }
  if (slots.player) buildPlayer();
  inited = true;
  wire();
  const saved = lsGet("cp-tab");
  tabCur = TABS.some(([x]) => x === saved) ? saved : "dialoghi";
  onResize();
  safe(renderLive); safe(renderClock); safe(renderQuality); safe(renderCam);
  tab(tabCur);
  safe(renderPlayer); safe(renderTalk); safe(renderReplay); safe(() => renderFeed(true)); safe(renderActs);
  if (!C.life) setLifeGone(true);
}
function update(dt) {
  if (!inited) return;
  tm.clock += dt; tm.map += dt; tm.half += dt; tm.act += dt; tm.plan += dt;
  if (tm.clock >= 1) { tm.clock = 0; renderClock(); renderLive(); if (planOn) renderPlanLegend(); }
  if (tm.map >= 0.1) { tm.map = 0; if (!planOn) drawMinimap(); }
  if (tm.plan >= 0.25) { tm.plan = 0; if (planOn) drawPlan(); }
  if (tm.half >= 0.5) { tm.half = 0; renderMind(); renderReplay(); if (repDate()) markReplayLite(); }
  if (tm.act >= 20) { tm.act = 0; renderActs(); renderGare(); }
}
let lastStep = null;
function markReplayLite() { const l = L(), rs = l && obj(l.replayState); if (rs && rs.step !== lastStep) { lastStep = rs.step; markReplay(); } }

C.ui = {
  init, update, follow, tab: (n) => tab(n),
  get followKey() { return followKey; },
  _careers: publicCareers,
  _season: season,
};
})();
