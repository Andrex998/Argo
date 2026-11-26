/* Scuola Cripto · campus kernel (campus/core.js), contract v1.0.
   The shared pieces of the 3D campus: the window.Campus namespace, the constants, the
   utilities, the data store, the derived numbers, the event bus, the Rome clock, the boot
   and the frame loop. Its source of truth is campus/CONTRATTO.md, section 4: no module
   edits it. Every number shown or spoken comes from Campus.data through these helpers. */
(() => {
  "use strict";
  const C = (window.Campus = window.Campus || {});
  if (C.core) return;
  C.core = { version: "1.0.0" };
  const freeze = Object.freeze;

  // ---- constants ---------------------------------------------------------------------------------
  C.KEYS = freeze(["preside", "falco", "tartaruga", "spazzino", "ragioniere", "guardiano", "cronista", "scettico"]);
  C.TRADERS = freeze(["falco", "tartaruga", "spazzino", "ragioniere"]);
  C.GRADED = freeze(C.KEYS.slice(1));
  C.NAMES = freeze({ preside: "Preside", falco: "Falco", tartaruga: "Tartaruga", spazzino: "Spazzino", ragioniere: "Ragioniere", guardiano: "Guardiano", cronista: "Cronista", scettico: "Scettico", motore: "Motore" });
  C.ARTICLE = freeze({ preside: "il", falco: "il", tartaruga: "la", spazzino: "lo", ragioniere: "il", guardiano: "il", cronista: "il", scettico: "lo", motore: "il" });
  C.COLORS = freeze({ preside: 0xb8243a, falco: 0x257de0, tartaruga: 0x128a2b, spazzino: 0xef6a26, ragioniere: 0xd99400, guardiano: 0x00a383, cronista: 0xdb5a93, scettico: 0x6a4ce2, motore: 0x47526a });
  C.STATES = freeze(["idle", "walk", "sit", "stand", "type", "read", "talk", "gesture", "drink", "sleep", "think", "write", "listen"]);
  C.POSTURES = freeze(["stand", "sit", "lie"]);
  C.KINDS = freeze({ ufficiale: "ufficiale", chiacchiera: "chiacchiera", pensiero: "pensiero", claude: "dialogo generato da Claude" });
  C.COINS = freeze(["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "TRX", "LINK", "DOT", "MATIC", "LTC", "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI", "SUI", "TIA", "ICP", "HBAR", "AAVE", "RNDR", "FTM", "IMX", "STX", "RUNE", "ORDI", "WLD"]);
  C.FASE = freeze({
    inizio: "si comincia", motore: "il motore fa i conti", briefing: "il briefing del Cronista",
    posizioni: "le posizioni, in privato", domande: "le domande dello Scettico", risposte: "le risposte",
    ordini: "gli ordini", chiusura: "la chiusura del Preside", fine: "riunione salvata", sera: "la sera",
    palestra: "la palestra",
  });
  C.CAPITAL = 10000;
  C.FUND_START = 80000;
  C.SCHOOL_START = "2026-11-26";
  C.GRADUATION = "2027-02-21";
  C.ROME = freeze({ lat: 41.9028, lon: 12.4964, tz: "Europe/Rome" });

  // ---- utilities -----------------------------------------------------------------------------------
  const U = (C.util = {});
  U.isNum = (v) => typeof v === "number" && Number.isFinite(v);
  U.toNum = (v) => U.isNum(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  U.obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  U.arr = (v) => (Array.isArray(v) ? v : []);
  U.esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.lerp = (a, b, k) => a + (b - a) * k;
  U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  // frame-rate independent exponential approach: damp(x, target, 6, dt)
  U.damp = (x, target, lambda, dt) => U.lerp(x, target, 1 - Math.exp(-lambda * dt));
  U.wrapAngle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  U.hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // deterministic random numbers: rng("falco|2026-11-26")() -> [0, 1)
  U.rng = (seed) => {
    let a = typeof seed === "number" ? seed >>> 0 : U.hash(seed);
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  U.pick = (rand, list) => list[Math.floor(rand() * list.length) % Math.max(1, list.length)];
  U.weighted = (rand, pairs) => {
    const ok = pairs.filter((p) => U.isNum(p[1]) && p[1] > 0);
    const total = ok.reduce((s, p) => s + p[1], 0);
    if (!total) return null;
    let x = rand() * total;
    for (const [item, w] of ok) { x -= w; if (x < 0) return item; }
    return ok[ok.length - 1][0];
  };

  // numbers the Italian way (the same rules as the page)
  const NFS = {};
  const nf = (a, b) => NFS[a + ":" + b] || (NFS[a + ":" + b] = new Intl.NumberFormat("it-IT", { minimumFractionDigits: a, maximumFractionDigits: b, useGrouping: "always" }));
  U.fmt = (v, d = 2, sign = false) => {
    if (!U.isNum(v)) return "—";
    const r = Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v;
    return (r > 0 && sign ? "+" : r < 0 ? "−" : "") + nf(d, d).format(Math.abs(r));
  };
  U.small = (v) => { const n = U.toNum(v); return n === null ? "—" : (n < 0 ? "−" : "") + nf(0, 2).format(Math.abs(n)); };
  U.usd = (v, sign) => (U.isNum(v) ? U.fmt(v, 2, sign) + " USDT" : "—");
  U.pct = (v, d = 2, sign = true) => (U.isNum(v) ? U.fmt(v, d, sign) + "%" : "—");
  const pdig = (p) => (p >= 10000 ? 1 : p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.1 ? 4 : 5);
  U.price = (v) => { const n = U.toNum(v); return n === null ? "—" : U.fmt(n, pdig(Math.abs(n))); };
  U.level = (v) => { const n = U.toNum(v); return n === null ? String(v ?? "—") : (n < 0 ? "−" : "") + nf(0, pdig(Math.abs(n))).format(Math.abs(n)); };
  U.prob = (v) => { const n = U.toNum(v); return n === null ? "—" : Math.round(n * 100) + "%"; };
  U.cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
  U.lowerFirst = (s) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  U.listIt = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);
  // Markdown to one plain line, cut at a sentence end when possible (the page's plain())
  U.plain = (text, max = 240) => {
    const t = String(Array.isArray(text) ? text.join(" ") : text ?? "")
      .split("\n").filter((l) => !/^\s*\|/.test(l) && !/^\s*-{3,}\s*$/.test(l)).join(" ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    return end > max * 0.45 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  };
  // how long a line stays on screen at speed 1 (the old classroom's sayTime)
  U.sayMs = (text) => Math.round(1000 * Math.min(11, 2.4 + String(text || "").length / 26));
  // the engine's wallet keys and English decimals, made readable (the page's human())
  U.human = (s) => String(s ?? "")
    .replace(/\b(falco|tartaruga|spazzino|ragioniere)_(giudizio|regole)\b/g, (m, a, k) => `${C.NAMES[a]} ${k === "giudizio" ? "a giudizio" : "a regole"}`)
    .replace(/(\d)\.(\d)/g, "$1,$2").replace(/(^|[\s(:;])-(?=\d)/g, "$1−")
    .replace(/\bdel Spazzino\b/g, "dello Spazzino").replace(/\bdel Tartaruga\b/g, "della Tartaruga");
  U.shortReason = (s) => String(s || "").replace(/^chiusa dall'agente:.*$/s, "chiusa dall'agente");
  U.shortEvent = (e) => {
    const o = U.obj(e && e.order) || {};
    if (!U.obj(e)) return "";
    if (e.event === "aperta") return `aperta: ${e.side} ${e.symbol} a ${U.price(e.entry)}`;
    if (e.event === "chiusa") return `chiusa: ${e.side || ""} ${e.symbol}, ${U.shortReason(e.exit_reason)}, ${U.usd(e.pnl, true)}`;
    return `respinto: ${[o.side, o.symbol || o.id].filter(Boolean).join(" ")}: ${U.human(e.reason || "")}`;
  };
  U.orderText = (o) => !U.obj(o) ? "" : o.action === "close" ? `chiudo ${o.id}`
    : `${o.side || ""} ${String(o.symbol || "").toUpperCase()}, stop ${U.level(o.stop)}${o.target != null && o.target !== "" ? ", target " + U.level(o.target) : ""}, rischio ${U.small(U.toNum(o.risk_pct) ?? 1)}%`;
  U.predText = (p) => `${p.mercato} ${p.direzione} ${U.level(p.livello)}${p.scadenza ? " entro il " + U.dm(p.scadenza) : ""}, al ${U.prob(p.probabilita)}`;

  // dates: the school runs on Rome's clock, the engine writes UTC as "YYYY-MM-DD HH:MM:SS"
  U.utc = (s) => {
    if (!s) return null;
    let t = String(s).trim().replace(/\s*UTC$/i, "").replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) t += "Z";
    const d = new Date(t);
    return isNaN(d) || d.getUTCFullYear() < 2000 ? null : d;
  };
  U.utcText = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().replace("T", " ").slice(0, 19) : "");
  U.isoDay = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");
  const RP = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hourCycle: "h23" });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // {date: "2026-11-26", minutes: 0..1439, seconds: 0..86399, weekday: 0 (Sunday)..6, hh, mm}
  U.rome = (d = C.clock.now()) => {
    const p = Object.fromEntries(RP.formatToParts(d).map((x) => [x.type, x.value]));
    const hh = +p.hour % 24, mm = +p.minute, ss = +p.second;
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: hh * 60 + mm, seconds: hh * 3600 + mm * 60 + ss, weekday: WD[p.weekday], hh, mm };
  };
  // a Rome wall-clock time ("2026-11-26", 6*60+47) as a Date (handles the DST offset)
  U.romeDate = (iso, minutes) => {
    const guess = new Date(`${iso}T00:00:00Z`).getTime() + minutes * 60000;
    let t = guess;
    for (let i = 0; i < 3; i++) { const r = U.rome(new Date(t)); const diff = (r.date === iso ? r.minutes : r.date < iso ? r.minutes - 1440 : r.minutes + 1440) - minutes; t -= diff * 60000; }
    return new Date(t);
  };
  U.romeClock = (d) => (d instanceof Date && !isNaN(d) ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : "");
  U.romeTime = (s) => { const d = s instanceof Date ? s : U.utc(s); return d ? new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : ""; };
  U.whenTxt = (s) => U.romeTime(s) || String(s || "");
  U.longDay = (iso) => (U.isoDay(iso) ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date(U.isoDay(iso) + "T12:00:00Z")) : "");
  U.dm = (iso) => (U.isoDay(String(iso || "")) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : "");
  U.dmy = (iso) => (U.isoDay(String(iso || "")) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "");
  U.addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  U.daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  // the live document counts only when fresh: written in the last 12 minutes and not "fine"
  U.liveNow = (L, nowMs = C.clock.real().getTime()) => {
    if (!U.obj(L) || !L.ora || L.fase === "fine") return null;
    const at = U.utc(L.ora);
    if (!at) return null;
    const age = nowMs - at.getTime();
    return age < 12 * 60000 && age > -10 * 60000 ? L : null;
  };
  // the sun seen from Rome (NOAA formulas): altitude above the horizon, azimuth from north, clockwise
  U.sun = (d = C.clock.now(), lat = C.ROME.lat, lon = C.ROME.lon) => {
    const rad = Math.PI / 180, ms = d.getTime();
    const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
    const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Cc = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + Cc - 0.00569 - 0.00478 * Math.sin(omega * rad);
    const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * rad);
    const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
    const y = Math.tan((eps * rad) / 2) ** 2;
    const eq = (4 / rad) * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
    const utcMin = ((ms / 60000) % 1440 + 1440) % 1440;
    const ha = ((utcMin + eq + 4 * lon) % 1440 + 1440) % 1440 / 4 - 180;
    const cz = U.clamp(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha * rad), -1, 1);
    const zen = Math.acos(cz);
    const ca = U.clamp((Math.sin(lat * rad) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat * rad) * Math.sin(zen) || 1e-9), -1, 1);
    const a = Math.acos(ca) / rad;
    return { altDeg: 90 - zen / rad, azDeg: ha > 0 ? (a + 180) % 360 : (540 - a) % 360 };
  };
  // night 0 (day) .. 1 (night), from the sun's altitude: 0 above +4°, 1 below −8°
  U.nightOf = (altDeg) => U.smooth(4, -8, altDeg);
  // the page's colour token for a character, for DOM (follows the light/dark theme)
  U.cssColor = (key) => getComputedStyle(document.documentElement).getPropertyValue("--c-" + key).trim() || "#47526a";
  // r128 has no colour management: hex colours are sRGB and must be linearised for an sRGB output
  U.col = (hex) => new window.THREE.Color(hex).convertSRGBToLinear();

  // ---- the event bus ---------------------------------------------------------------------------
  const handlers = new Map();
  C.bus = {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => C.bus.off(name, fn);
    },
    once(name, fn) { const off = C.bus.on(name, (p, n) => { off(); fn(p, n); }); return off; },
    off(name, fn) { const s = handlers.get(name); if (s) s.delete(fn); },
    emit(name, payload) {
      for (const key of [name, "*"]) {
        const s = handlers.get(key);
        if (!s) continue;
        for (const fn of [...s]) {
          try { fn(payload, name); } catch (e) { console.warn("Campus bus:", name, e); }
        }
      }
    },
  };

  // ---- the clock: real time, or a replay's time -----------------------------------------------------
  let over = null;
  C.clock = {
    real: () => new Date(),
    now: () => (over ? new Date(over.at + (performance.now() - over.t0) * over.rate) : new Date()),
    get overridden() { return !!over; },
    setOverride(date, rate = 1) {
      over = date instanceof Date && !isNaN(date) ? { at: date.getTime(), t0: performance.now(), rate } : null;
      C.bus.emit("clock:override", { active: !!over, at: over ? new Date(over.at) : null, rate: over ? rate : 1 });
    },
  };

  // ---- the data store: the page fills it from the db snapshots -----------------------------------------
  // undefined = not arrived yet; null = the document does not exist; maps hold one entry per document
  C.data = {
    programma: undefined, classe: undefined, giudizio: undefined, regole: undefined, live: undefined,
    sera: undefined, registro: undefined, semaforo: undefined, ultimo: undefined, ultimoData: null,
    memoria: {}, verbali: {}, palestre: {}, proposte: {}, gare: {},
    selected: null, picked: false, unavailable: false, got: {}, version: 0,
  };
  const MAPS = new Set(["memoria", "verbali", "palestre", "proposte", "gare"]);
  let dirty = null;
  const flush = () => {
    const keys = [...dirty];
    dirty = null;
    C.data.version += 1;
    C.bus.emit("data:change", { keys, version: C.data.version });
  };
  const touch = (key) => {
    if (!dirty) { dirty = new Set(); queueMicrotask(flush); }
    dirty.add(key);
  };
  C.setData = (key, value) => {
    if (MAPS.has(key)) throw new TypeError("Campus.setData: use setDataIn for " + key);
    if (C.data[key] === value) return;
    C.data[key] = value;
    if (value !== undefined && key !== "got") C.data.got[key] = true;
    touch(key);
  };
  // maps: setDataIn("memoria", "falco", doc); value undefined removes the entry
  C.setDataIn = (key, id, value) => {
    if (!MAPS.has(key)) throw new TypeError("Campus.setDataIn: not a map: " + key);
    const m = C.data[key];
    if (m[id] === value) return;
    if (value === undefined) delete m[id]; else m[id] = value;
    C.data.got[key] = true;
    touch(key);
  };
  // a whole collection at once (proposte, gare): replaces the map
  C.setDataMap = (key, map) => {
    if (!MAPS.has(key)) throw new TypeError("Campus.setDataMap: not a map: " + key);
    C.data[key] = Object.assign({}, map);
    C.data.got[key] = true;
    touch(key);
  };

  // ---- derived numbers: one implementation for every module ---------------------------------------
  const D = (C.derive = {});
  const sideSign = (s) => (s === "short" ? -1 : 1);
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  D.prices = () => (U.obj(C.data.giudizio) && U.obj(C.data.giudizio.prices)) || {};
  D.rulesPoints = (r) => Object.entries((U.obj(r) && U.obj(r.curve)) || {}).filter(([d, v]) => U.isoDay(d) && U.isNum(v)).map(([date, value]) => ({ date, value })).sort(byDate);
  D.judgPoints = (w) => U.arr(w && w.equity).filter((e) => e && U.isoDay(e.date) && U.isNum(e.value)).map((e) => ({ date: e.date, value: e.value })).sort(byDate);
  D.judgEquity = (w, prices = D.prices()) => {
    if (!U.obj(w)) return null;
    if (U.isNum(w.cash)) {
      return w.cash + U.arr(w.positions).reduce((a, p) => {
        const now = U.isNum(prices[p.symbol]) ? prices[p.symbol] : p.entry;
        return a + (U.isNum(p.units) && U.isNum(p.entry) && U.isNum(now) ? sideSign(p.side) * p.units * (now - p.entry) : 0);
      }, 0);
    }
    const e = D.judgPoints(w);
    return e.length ? e[e.length - 1].value : null;
  };
  // one trader's two wallets: {judg, rules, gap, pnlPct, positions, at} or null
  D.wallet = (key) => {
    if (!C.TRADERS.includes(key)) return null;
    const g = U.obj(C.data.giudizio), r = U.obj(C.data.regole);
    const w = g && U.obj(g.wallets) && U.obj(g.wallets[key]);
    const rw = r && U.obj(r.portafogli) && U.obj(r.portafogli[key]);
    const judg = D.judgEquity(w);
    const rp = D.rulesPoints(rw);
    const rules = rp.length ? rp[rp.length - 1].value : null;
    if (!U.isNum(judg) && !U.isNum(rules)) return null;
    return {
      judg: U.isNum(judg) ? judg : null, rules: U.isNum(rules) ? rules : null,
      gap: U.isNum(judg) && U.isNum(rules) ? judg - rules : null,
      pnlPct: U.isNum(judg) ? (judg / C.CAPITAL - 1) * 100 : null,
      positions: U.arr(w && w.positions).length, at: (g && g.prices_at) || null,
    };
  };
  // the common fund of the 8 wallets, as the page's "fondo della scuola" computes it
  D.fund = () => {
    const vals = C.TRADERS.flatMap((k) => { const w = D.wallet(k); return [w && w.rules, w && w.judg]; });
    if (vals.some(U.isNum)) {
      const capitale = vals.reduce((a, v) => a + (U.isNum(v) ? v : C.CAPITAL), 0);
      return { capitale, iniziale: C.FUND_START, pct: (capitale / C.FUND_START - 1) * 100, quota: capitale / C.KEYS.length, source: "portafogli", at: (U.obj(C.data.giudizio) && C.data.giudizio.prices_at) || null };
    }
    const R = U.obj(C.data.ultimo) && U.obj(C.data.ultimo.rischio), F = R && U.obj(R.fondo);
    if (F && U.isNum(F.capitale)) {
      const ini = U.isNum(F.iniziale) ? F.iniziale : C.FUND_START;
      return { capitale: F.capitale, iniziale: ini, pct: (F.capitale / ini - 1) * 100, quota: F.capitale / C.KEYS.length, source: "rischio", at: R.giorno || null };
    }
    return null;
  };
  // today in the programme, in Rome: the day entry or null
  D.today = () => { const d = U.rome().date; return U.arr(U.obj(C.data.programma) && C.data.programma.giorni).find((g) => g && g.data === d) || null; };
  D.graduation = () => {
    const today = U.rome().date;
    const days = U.arr(U.obj(C.data.programma) && C.data.programma.giorni);
    const last = days.length ? days[days.length - 1] : null;
    const t = D.today();
    const fine = U.obj(C.data.ultimo) && U.obj(C.data.ultimo.fine);
    return {
      today, days: Math.max(0, U.daysBetween(today, C.GRADUATION)),
      giorno: t && U.isNum(t.giorno) ? t.giorno : null, totale: last && U.isNum(last.giorno) ? last.giorno : null,
      tesi: (fine && U.obj(fine.tesi)) || null,
    };
  };
  // the meetings held so far, oldest first (classe/stato.giorni)
  D.held = () => U.arr(U.obj(C.data.classe) && C.data.classe.giorni).filter((g) => U.obj(g) && U.isoDay(g.data)).slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  // the Preside's last grades for an agent and the agent's own self-grades of that day
  D.votes = (key) => {
    const day = D.held().filter((g) => U.obj(g.voti) && U.obj(g.voti[key])).pop();
    const self = U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].autovoti).filter(U.obj).pop() || null;
    if (!day && !self) return null;
    return { data: day ? day.data : self.data, preside: day ? day.voti[key] : U.obj(self && self.preside), auto: self ? { ragionamento: self.ragionamento, disciplina: self.disciplina, data: self.data } : null };
  };
  D.lesson = (key) => U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].lezioni).filter((x) => U.obj(x) && x.testo).pop() || null;
  D.openPrediction = (key) => U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].previsioni).filter((p) => U.obj(p) && p.stato === "aperta").pop() || null;
  D.calibration = (key) => { const c = U.obj(C.data.memoria[key]) && U.obj(C.data.memoria[key].calibrazione); return c && U.isNum(c.n) && c.n > 0 ? c : null; };
  // the contests (gara/*), newest first, with open = not finished and before the deadline
  D.contests = () => Object.entries(C.data.gare || {}).filter(([, g]) => U.obj(g)).map(([id, g]) => {
    const st = U.obj(g.stato) || {};
    const end = U.utc(st.scadenza_utc);
    return { id, doc: g, open: g.finita === false && (!end || end.getTime() > C.clock.real().getTime()), scadenza: end, leva: st.leva ?? null, situazione: U.obj(g.situazione_finale) || U.obj(g.situazione) || null };
  }).sort((a, b) => (String(a.doc.aperta_alle || a.id) < String(b.doc.aperta_alle || b.id) ? 1 : -1));
  D.latestGym = () => { const ks = Object.keys(C.data.palestre || {}).filter((k) => U.obj(C.data.palestre[k])).sort(); return ks.length ? { date: ks[ks.length - 1], doc: C.data.palestre[ks[ks.length - 1]] } : null; };

  // ---- the boot and the frame loop ------------------------------------------------------------------
  const ORDER3D = ["people", "world", "render"];
  const fails = {}, off = {};
  let raf = 0, last = 0, t = 0, visible = true, hiddenSince = 0, slowTimer = 0;
  function step(name, fn) {
    if (off[name]) return false;
    try { fn(); fails[name] = 0; return true; } catch (e) {
      console.warn("Campus:", name, e);
      fails[name] = (fails[name] || 0) + 1;
      if (fails[name] >= 3) {
        off[name] = true;
        C.bus.emit("campus:degraded", { module: name, reason: "error", message: String((e && e.message) || e) });
        if (name === "render" || name === "world" || name === "people") stop3d();
      }
      return false;
    }
  }
  function stop3d() {
    const ctx = C.ctx;
    if (!ctx || !ctx.has3d) return;
    ctx.has3d = false;
    try { C.render && C.render.dispose && C.render.dispose(); } catch (e) { /* already gone */ }
    C.bus.emit("campus:degraded", { module: "render", reason: "no-3d" });
  }
  function webglOk() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }
  function frame(nowMs) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
    last = nowMs;
    if (!visible) return;
    t += dt;
    const ctx = C.ctx;
    if (C.life) step("life", () => C.life.update(dt, t));
    if (ctx.has3d) {
      for (const m of ORDER3D) if (ctx.has3d && C[m]) step(m, () => C[m].update(dt, t));
      if (ctx.has3d) step("render", () => C.render.draw());
      if (ctx.has3d) step("people", () => C.people.updateOverlay(ctx.camera, ctx.size.w, ctx.size.h));
    }
    if (C.ui) step("ui", () => C.ui.update(dt, t));
  }
  function setVisible(v) {
    if (v === visible) return;
    visible = v;
    const now = performance.now();
    if (!v) hiddenSince = now; else last = now;
    C.bus.emit("campus:visibility", { visible: v, hiddenFor: v ? (now - hiddenSince) / 1000 : 0 });
  }
  // Campus.boot({canvas, overlay, uiRoot, db, sample, reduceMotion}) -> ctx
  C.boot = (opts) => {
    if (C.ctx) return C.ctx;
    const o = opts || {};
    const stage = o.stage || (o.canvas && o.canvas.parentElement) || null;
    const ctx = (C.ctx = {
      THREE: window.THREE || null, canvas: o.canvas || null, overlay: o.overlay || null, uiRoot: o.uiRoot || null, stage,
      db: o.db || null, sample: typeof o.sample === "function" ? o.sample : null, reduceMotion: !!o.reduceMotion,
      has3d: false, scene: null, camera: null, renderer: null,
      size: { w: (stage && stage.clientWidth) || 1, h: (stage && stage.clientHeight) || 1 },
    });
    if (stage && "ResizeObserver" in window) {
      new ResizeObserver(() => {
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h || (w === ctx.size.w && h === ctx.size.h)) return;
        ctx.size = { w, h };
        C.bus.emit("campus:resize", { w, h });
      }).observe(stage);
    }
    if (stage && "IntersectionObserver" in window) {
      new IntersectionObserver((es) => setVisible(es[0].isIntersecting && !document.hidden), { rootMargin: "120px" }).observe(stage);
    }
    document.addEventListener("visibilitychange", () => setVisible(!document.hidden));
    if (C.ui) step("ui-init", () => C.ui.init(ctx));
    ctx.has3d = !!(ctx.THREE && ctx.canvas && webglOk() && C.render && C.world && C.people);
    if (ctx.has3d) {
      ctx.has3d = step("render-init", () => C.render.init(ctx)) && !!ctx.renderer
        && step("world-init", () => C.world.build(ctx))
        && step("people-init", () => C.people.init(ctx));
      if (!ctx.has3d) { try { C.render && C.render.dispose && C.render.dispose(); } catch (e) { /* nothing to free */ } }
    }
    if (!ctx.has3d) C.bus.emit("campus:degraded", { module: "render", reason: ctx.THREE && webglOk() ? "error" : "no-webgl" });
    if (C.life) step("life-init", () => C.life.init(ctx));
    // a hidden tab gets no animation frames: the brain keeps the clock at 1 Hz
    slowTimer = setInterval(() => { if (!visible && C.life) step("life", () => C.life.update(1, (t += 1))); }, 1000);
    C.bus.emit("campus:ready", { has3d: ctx.has3d, quality: ctx.has3d && C.render ? C.render.quality : null });
    C.bus.emit("campus:capabilities", { db: !!ctx.db, sample: !!ctx.sample });
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return ctx;
  };
  // the capabilities arrive after the boot: Campus.attach({db, sample}) hands them over, once each
  C.attach = (caps) => {
    const ctx = C.ctx;
    if (!ctx) throw new Error("Campus.attach: call Campus.boot first");
    const c = caps || {};
    if ("db" in c) ctx.db = c.db || null;
    if ("sample" in c) ctx.sample = typeof c.sample === "function" ? c.sample : null;
    C.bus.emit("campus:capabilities", { db: !!ctx.db, sample: !!ctx.sample });
  };
  // numbers for tests and the debug overlay
  C.stats = () => {
    const r = C.render && C.render.renderer;
    const info = r && r.info && r.info.render;
    return {
      has3d: !!(C.ctx && C.ctx.has3d), visible, quality: C.render ? C.render.quality : null, fps: C.render ? C.render.fps : null,
      calls: info ? info.calls : null, triangles: info ? info.triangles : null, mode: C.life ? C.life.mode : null,
      disabled: Object.keys(off),
    };
  };
  C.halt = () => { cancelAnimationFrame(raf); clearInterval(slowTimer); };
})();
