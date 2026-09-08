/* ============================================================
   ARGO Drive — ui.js
   Tutto il DOM sta qui. app.js decide, ui.js disegna.

   Il pannello inferiore si trascina come nelle app di mappe:
   tre posizioni (scheda di guida, metà, tutto). In marcia
   torna da solo alla posizione minima — meno cose sullo
   schermo mentre si guida, più superficie di mappa.
   ============================================================ */

import { formatDistance } from './geo.js';
import { COUNTRY_BRIEF } from './rules-albania.js';
import { maneuverIcon } from './router.js';
import { orarioArrivo, durataParlata } from './guidance.js';

const SETTINGS_KEY = 'argo-drive:settings:v2';

export const DEFAULT_SETTINGS = {
  theme: 'auto',          // auto | giorno | notte | satellite
  mode: 'rotta',          // rotta (course-up) | nord
  tolerance: 5,
  radius: 900,
  unit: 'kmh',
  voice: true,
  haptics: true,
  wakelock: true,
  buildings3d: true,
  layers: { zones: true, roads: true, cameras: true, hazards: true, reports: true, curated: true },
};

export const LAYER_LABELS = [
  ['zones', 'Aree vietate alle auto'],
  ['roads', 'Strade vietate e dissestate'],
  ['cameras', 'Autovelox'],
  ['hazards', 'Dossi, passaggi a livello, sbarre'],
  ['reports', 'Le mie segnalazioni'],
  ['curated', 'Punti noti curati (indicativi)'],
];

const GLYPH = {
  block: '⛔', camera: '📸', bump: '⏛', rail: '🚂', gate: '⛓',
  alert: '⚠️', rough: '〰', speed: '⏱', police: '👮',
};

/** Frecce delle manovre: leggibili di sbieco, a 90 km/h. */
const MANOVRA = {
  dritto: '↑', sinistra: '↰', destra: '↱',
  'sinistra-lieve': '↖', 'destra-lieve': '↗',
  'sinistra-secca': '⬅', 'destra-secca': '➡',
  inversione: '↩', rotonda: '↻', rampa: '⤴', immissione: '⤴', uscita: '⤵',
  arrivo: '🏁', partenza: '▲',
};

export const $ = (sel) => document.querySelector(sel);

/* ---------- impostazioni ---------- */

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw, layers: { ...DEFAULT_SETTINGS.layers, ...(raw.layers || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS, layers: { ...DEFAULT_SETTINGS.layers } };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* navigazione privata */ }
}

/** 'auto' segue l'ora: chiaro di giorno, scuro dopo il tramonto. */
export function resolveTheme(setting, date = new Date()) {
  if (setting !== 'auto') return setting;
  const h = date.getHours();
  return h >= 7 && h < 19 ? 'giorno' : 'notte';
}

/** Il chrome (pannelli, chip, FAB) segue il tema della mappa. */
export function applyChromeTheme(mapTheme) {
  const dark = mapTheme === 'notte' || mapTheme === 'satellite';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#14171D' : '#FFFFFF');
}

/* ---------- pannello trascinabile ---------- */

const SHEET_STATES = ['peek', 'half', 'full'];
let sheetState = 'peek';
let onSheetState = () => {};
let remisura = () => {};

export function initSheet(onChange) {
  onSheetState = onChange || (() => {});
  const sheet = $('#sheet');
  const handle = $('#grabber');
  const card = $('#navcard');

  // CSS e JS devono avere la stessa idea di "quanto sporge la scheda":
  // il valore vero lo conosce solo il DOM, quindi lo misura lui e lo
  // scrive nella variabile che il CSS usa per la trasformazione.
  const measurePeek = () => {
    const eta = $('#etabar');
    // In navigazione sopra il bordo c'è anche la barra dell'arrivo,
    // con il suo margine inferiore: va contata, o resta fuori schermo.
    const extra = eta && !eta.hidden ? eta.offsetHeight + 12 : 0;
    const peek = handle.offsetHeight + card.offsetHeight + extra + 6;
    if (peek > 40) document.documentElement.style.setProperty('--peek', `${peek}px`);
    return peek;
  };
  remisura = measurePeek;
  measurePeek();
  window.addEventListener('resize', measurePeek);
  window.addEventListener('orientationchange', () => setTimeout(measurePeek, 250));

  let startY = 0;
  let base = 0;
  let dragging = false;
  let moved = 0;

  const snapPoints = () => {
    const h = sheet.getBoundingClientRect().height;
    return { peek: h - measurePeek(), half: h - window.innerHeight * 0.52, full: 0 };
  };

  const down = (e) => {
    dragging = true;
    moved = 0;
    startY = e.clientY;
    base = snapPoints()[sheetState];
    sheet.classList.add('is-dragging');
    sheet.setPointerCapture?.(e.pointerId);
  };

  const move = (e) => {
    if (!dragging) return;
    moved = e.clientY - startY;
    const pts = snapPoints();
    const y = Math.max(pts.full, Math.min(pts.peek, base + moved));
    sheet.style.transform = `translateY(${y}px)`;
  };

  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    const pts = snapPoints();
    if (Math.abs(moved) < 8) {                     // tocco secco: apre/chiude
      setSheet(sheetState === 'peek' ? 'half' : 'peek');
      return;
    }
    const current = base + moved;
    const nearest = SHEET_STATES.reduce((best, s) =>
      Math.abs(pts[s] - current) < Math.abs(pts[best] - current) ? s : best, sheetState);
    setSheet(nearest);
  };

  for (const el of [handle, card]) {
    el.addEventListener('pointerdown', down);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export function setSheet(state) {
  if (!SHEET_STATES.includes(state) || state === sheetState) return;
  sheetState = state;
  $('#sheet').dataset.state = state;
  onSheetState(state);
}

export const getSheet = () => sheetState;

export function showPanel(name) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('is-on', p.dataset.panel === name));
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.panel === name;
    t.classList.toggle('is-on', on);
    t.setAttribute('aria-selected', String(on));
  });
  $('#sheet-body').scrollTop = 0;
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      showPanel(tab.dataset.panel);
      if (getSheet() === 'peek') setSheet('half');
    });
  });
}

/* ---------- scheda di guida ---------- */

export function renderSpeed(speedKmh, unit, over) {
  const value = unit === 'mph' ? speedKmh / 1.609344 : speedKmh;
  $('#speed-value').textContent = Number.isFinite(value) ? String(Math.round(value)) : '—';
  $('#speed-unit').textContent = unit === 'mph' ? 'mph' : 'km/h';
  $('#speedo').dataset.state = over ? 'over' : 'ok';
}

export function renderLimit(limit, unit) {
  const disc = $('#limit-disc');
  const val = $('#limit-value');
  if (!limit || !limit.kmh) {
    const libero = limit && limit.source === 'nessun limite';
    disc.dataset.state = libero ? 'none' : 'unknown';
    val.textContent = libero ? 'libero' : '—';
    return;
  }
  val.textContent = String(unit === 'mph' ? Math.round(limit.kmh / 1.609344) : limit.kmh);
  disc.dataset.state = limit.presumed ? 'presumed' : 'known';
}

export function renderRoad(match, limit) {
  const name = $('#road-name');
  const meta = $('#road-meta');
  if (!match) {
    name.textContent = 'Strada non agganciata';
    meta.textContent = 'GPS impreciso o dati OSM assenti in questa zona';
    return;
  }
  const r = match.road;
  const bits = [`limite: ${limit.source}`];
  if (r.rough) bits.push(r.rough);
  if (r.limited) bits.push(r.limited);
  if (r.tunnel) bits.push('galleria');
  if (r.oneway) bits.push('senso unico');
  name.textContent = r.name || tipoStrada(r.hw);
  meta.textContent = bits.join(' · ');
}

function tipoStrada(hw) {
  const map = {
    motorway: 'Autostrada', trunk: 'Superstrada', primary: 'Strada principale',
    secondary: 'Strada secondaria', tertiary: 'Strada locale', residential: 'Strada residenziale',
    living_street: 'Zona residenziale', service: 'Strada di servizio', track: 'Strada bianca',
    unclassified: 'Strada senza classifica', pedestrian: 'Area pedonale',
  };
  return map[hw] || 'Strada';
}

export function renderAlerts(alerts) {
  const stack = $('#alert-stack');
  const inNav = document.body.classList.contains('in-navigazione');
  const top = alerts.slice(0, inNav ? 1 : 2);
  // Il titolo entra nella firma: l'allerta di velocità ha id e distanza
  // fissi, e senza il titolo resterebbe congelata sul primo "+N km/h".
  const sig = top.map((a) => `${a.id}:${a.title}:${Math.round(a.distance / 25)}`).join('|');
  if (stack.dataset.sig !== sig) {
    stack.dataset.sig = sig;
    stack.innerHTML = top.map((a) => `
      <div class="alert alert-${a.level}">
        <span class="a-icon">${GLYPH[a.icon] || '•'}</span>
        <div>
          <div class="a-title">${escapeHtml(a.title)}</div>
          ${a.detail && a.detail !== a.title ? `<div class="a-detail">${escapeHtml(a.detail)}</div>` : ''}
        </div>
        ${a.distance > 15 ? `<div class="a-dist">${formatDistance(a.distance)}</div>` : ''}
      </div>`).join('');
  }
}

export function renderNearby(items) {
  const list = $('#nearby');
  if (!list) return;
  const sig = items.map((a) => `${a.id}:${Math.round(a.distance / 50)}`).join('|');
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig;
  list.innerHTML = items.length
    ? items.map((a) => `
      <li>
        <span class="n-icon">${GLYPH[a.icon] || '•'}</span>
        <div>
          <div class="n-title">${escapeHtml(a.title)}</div>
          ${a.detail ? `<div class="n-detail">${escapeHtml(a.detail)}</div>` : ''}
        </div>
        ${a.distance > 15 ? `<div class="n-dist">${formatDistance(a.distance)}</div>` : ''}
      </li>`).join('')
    : '<li class="nearby-empty">Niente di rilevante entro un chilometro.</li>';
}

/* ---------- navigazione ---------- */

/** Passa fra modalità esplorazione (barra di ricerca) e navigazione. */
export function setNavMode(on) {
  $('#btn-search').hidden = on;
  $('#maneuver').hidden = !on;
  $('#etabar').hidden = !on;
  document.body.classList.toggle('in-navigazione', on);
  // La barra dell'arrivo alza la parte visibile del pannello: senza
  // rimisurare resterebbe sotto il bordo dello schermo.
  remisura();
}

export function renderManeuver(nav) {
  if (!nav) return;
  $('#man-icon').textContent = MANOVRA[nav.icon] || '↑';
  $('#man-dist').textContent = nav.arrived ? 'Arrivato' : formatDistance(nav.distanceToManeuver);
  $('#man-street').textContent = nav.instruction || '';
  const then = $('#man-then');
  if (nav.after && !nav.arrived) {
    then.hidden = false;
    $('#man-then-icon').textContent = MANOVRA[maneuverIcon(nav.after)] || '↑';
  } else {
    then.hidden = true;
  }
}

export function renderEta(nav) {
  if (!nav) return;
  $('#eta-time').textContent = nav.arrived ? 'Arrivato' : orarioArrivo(nav.eta);
  $('#eta-rest').textContent = nav.arrived
    ? (nav.destination && nav.destination.name) || ''
    : `${durataParlata(nav.remainingS)} · ${formatDistance(nav.remainingM)}`;
}

/* ---------- ricerca ---------- */

export function buildCategoryChips(categorie, onPick) {
  const box = $('#search-cats');
  box.innerHTML = categorie.map((c) => `
    <button class="cat" data-cat="${c.id}"><span>${c.emoji}</span>${c.label}</button>`).join('');
  box.querySelectorAll('.cat').forEach((chip) => {
    chip.addEventListener('click', () => {
      const attiva = chip.classList.contains('is-on');
      box.querySelectorAll('.cat').forEach((c) => c.classList.remove('is-on'));
      if (!attiva) chip.classList.add('is-on');
      onPick(attiva ? null : chip.dataset.cat);
    });
  });
}

export function clearCategory() {
  document.querySelectorAll('#search-cats .cat').forEach((c) => c.classList.remove('is-on'));
}

export function searchNote(text) {
  const el = $('#search-note');
  el.hidden = !text;
  el.textContent = text || '';
}

/**
 * Elenco dei risultati. `azione` è l'etichetta del secondo pulsante
 * (serve per il punto scelto sulla mappa: "Segnala qui").
 */
export function renderResults(items, onPick, vuoto = 'Nessun risultato.') {
  const list = $('#search-results');
  if (!items.length) {
    list.innerHTML = `<li class="nearby-empty">${escapeHtml(vuoto)}</li>`;
    return;
  }
  list.innerHTML = items.map((r, i) => `
    <li data-i="${i}">
      <span class="r-icon">${r.emoji || '📍'}</span>
      <div>
        <div class="r-name">${escapeHtml(r.name)}</div>
        ${r.detail ? `<div class="r-detail">${escapeHtml(r.detail)}</div>` : ''}
      </div>
      ${Number.isFinite(r.distance) ? `<div class="r-dist">${formatDistance(r.distance)}</div>` : ''}
    </li>`).join('');
  list.querySelectorAll('li[data-i]').forEach((li) => {
    li.addEventListener('click', () => onPick(items[Number(li.dataset.i)]));
  });
}

/** Selettore dei percorsi alternativi: senza, dire "2 percorsi" è una bugia. */
export function renderRouteChoices(percorsi, attivo, onPick) {
  const box = $('#route-alts');
  if (!percorsi || percorsi.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = percorsi.map((r, i) => `
    <button class="route-alt ${i === attivo ? 'is-on' : ''}" data-i="${i}">
      ${i === 0 ? 'Più rapido' : `Alternativa ${i}`} · ${durataParlata(r.duration)} · ${formatDistance(r.distance)}
    </button>`).join('');
  box.querySelectorAll('.route-alt').forEach((b) => {
    b.addEventListener('click', () => onPick(Number(b.dataset.i)));
  });
}

export function renderRoutePreview(route, destinazione, alternative = 0) {
  $('#route-time').textContent = durataParlata(route.duration);
  $('#route-meta').textContent =
    `${formatDistance(route.distance)} · arrivo ${orarioArrivo(new Date(Date.now() + route.duration * 1000))}`;
  $('#route-badge').textContent = alternative > 0 ? `${alternative + 1} percorsi` : 'percorso più rapido';
  $('#route-dest').innerHTML =
    `<b>${escapeHtml(destinazione.name)}</b>${destinazione.detail ? `<span>${escapeHtml(destinazione.detail)}</span>` : ''}`;
  $('#route-steps').innerHTML = route.steps
    .filter((s) => s.type !== 'depart')
    .map((s) => `
      <li>
        <span class="s-icon">${MANOVRA[maneuverIcon(s)] || '↑'}</span>
        <span>${escapeHtml(s.instruction)}</span>
        <span class="s-dist">${formatDistance(s.distance)}</span>
      </li>`).join('');
}

/* ---------- stato ---------- */

export function renderGpsChip(fix, label, stale) {
  const chip = $('#pill-gps');
  const text = chip.querySelector('span');
  if (!fix) { chip.dataset.state = 'bad'; text.textContent = 'GPS assente'; return; }
  if (stale) { chip.dataset.state = 'bad'; text.textContent = 'GPS perso'; return; }
  const acc = Math.round(fix.accuracy || 0);
  chip.dataset.state = acc <= 25 ? 'ok' : acc <= 60 ? 'warn' : 'bad';
  text.textContent = `GPS ±${acc} m${label === 'fermo' ? ' · fermo' : ''}`;
}

export function renderDataChip(status) {
  const chip = $('#pill-data');
  const text = chip.querySelector('span');
  const map = {
    idle: ['warn', 'Dati in attesa'],
    loading: ['warn', 'Dati…'],
    live: ['ok', 'Dati OSM'],
    cache: ['ok', 'Dati in cache'],
    stale: ['warn', 'Dati vecchi'],
    error: ['bad', 'Dati non disponibili'],
  };
  const [state, label] = map[status.state] || map.idle;
  chip.dataset.state = state;
  text.textContent = status.counts ? `${label} · ${status.counts.roads}` : label;

  const detail = $('#data-detail');
  if (detail) {
    detail.textContent = status.counts
      ? `${status.counts.roads} strade, ${status.counts.zones} aree, ${status.counts.points} punti · aggiornati ${Math.round((status.age || 0) / 60000)} min fa${status.error ? ` · ultimo errore: ${status.error}` : ''}`
      : `Nessun dato stradale caricato${status.error ? ` · ${status.error}` : ''}.`;
  }
}

/* ---------- pannelli ---------- */

export function buildLayerToggles(settings, onChange) {
  const box = $('#layer-toggles');
  box.innerHTML = LAYER_LABELS.map(([key, label]) => `
    <label class="toggle"><span>${label}</span>
      <input type="checkbox" data-layer="${key}" ${settings.layers[key] ? 'checked' : ''}>
    </label>`).join('');
  box.querySelectorAll('input[data-layer]').forEach((input) => {
    input.addEventListener('change', () => onChange(input.dataset.layer, input.checked));
  });
}

export function buildReportChips(kinds, onPick) {
  const box = $('#report-kinds');
  box.innerHTML = kinds.map((k) => `
    <button class="chip-btn" data-kind="${k.id}"><span class="e">${k.emoji}</span>${k.label}</button>`).join('');
  box.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => onPick(chip.dataset.kind));
  });
}

export function buildInfoPanel() {
  const b = COUNTRY_BRIEF;
  $('#info-body').innerHTML = `
    <div class="info-block">
      <h3>Limiti di velocità — ${escapeHtml(b.country)}</h3>
      ${b.limits.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}
      <p class="note">Valori generali per automobili. I neopatentati hanno limiti più bassi.
      La segnaletica in loco prevale sempre su questa tabella.</p>
    </div>
    <div class="info-block">
      <h3>Emergenze</h3>
      ${b.emergency.map(([n, d]) => `<div class="kv"><span>${d}</span><a class="tel" href="tel:${n}">${n}</a></div>`).join('')}
    </div>
    <div class="info-block">
      <h3>ZTL: come funziona qui</h3>
      <p>${escapeHtml(b.ztl)}</p>
    </div>
    <div class="info-block">
      <h3>Rischi tipici sulla strada</h3>
      <ul>${b.hazards.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
    </div>
    <div class="info-block">
      <h3>Regole da rispettare</h3>
      <ul>${b.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </div>
    <div class="info-block">
      <h3>Da dove arrivano i dati</h3>
      <p>Limiti, divieti, aree pedonali, autovelox e dossi vengono da <b>OpenStreetMap</b>
      via Overpass API, interrogata intorno a te mentre guidi. La mappa disegnata sotto usa
      tile vettoriali OpenFreeMap. Sono dati collaborativi: <b>possono essere incompleti o
      superati</b>. Quando manca il limite, l'app mostra un valore <i>presunto</i>
      (disco tratteggiato) ricavato dal tipo di strada e dalle regole albanesi.</p>
      <p>Non esiste un server ARGO dietro questa app: la posizione non lascia il telefono,
      tranne le coordinate arrotondate inviate per scaricare la mappa della zona.</p>
    </div>
    <div class="info-block">
      <h3>Avvertenza</h3>
      <p>Strumento di supporto, non un'autorità. Guarda la strada, non lo schermo.
      Nessuna responsabilità per multe, divieti non segnalati o dati errati.</p>
    </div>`;
}

export function setSegActive(container, attr, value) {
  document.querySelectorAll(`${container} button`).forEach((b) => {
    b.classList.toggle('is-on', String(b.dataset[attr]) === String(value));
  });
}

let toastTimer = null;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
