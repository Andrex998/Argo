/* ============================================================
   ARGO Drive — ui.js
   Tutto il DOM sta qui. app.js decide, ui.js disegna.
   Vincolo di progetto: leggibile in un'occhiata da 0,4 secondi,
   con il telefono sul supporto e il sole di traverso.
   ============================================================ */

import { formatDistance } from './geo.js';
import { COUNTRY_BRIEF } from './rules-albania.js';

const SETTINGS_KEY = 'argo-drive:settings:v1';

export const DEFAULT_SETTINGS = {
  theme: 'scuro',
  tolerance: 5,
  radius: 900,
  unit: 'kmh',
  voice: true,
  wakelock: true,
  layers: { zones: true, roads: true, cameras: true, hazards: true, reports: true, curated: true },
};

export const LAYER_LABELS = [
  ['zones', 'Aree vietate alle auto (OSM)'],
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

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw, layers: { ...DEFAULT_SETTINGS.layers, ...(raw.layers || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS, layers: { ...DEFAULT_SETTINGS.layers } };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* modalità privata */ }
}

export const $ = (sel) => document.querySelector(sel);

/* ---------- sheet ---------- */

export function openSheet(id) {
  document.querySelectorAll('.sheet').forEach((s) => { s.hidden = s.id !== id; });
  $('#scrim').hidden = false;
}

export function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
  $('#scrim').hidden = true;
}

/* ---------- HUD ---------- */

export function renderSpeed(speedKmh, unit, over) {
  const el = $('#speed-value');
  const value = unit === 'mph' ? speedKmh / 1.609344 : speedKmh;
  el.textContent = Number.isFinite(value) ? String(Math.round(value)) : '—';
  $('#speed-unit').textContent = unit === 'mph' ? 'mph' : 'km/h';
  $('#speed-block').dataset.state = over ? 'over' : 'ok';
}

export function renderLimit(limit, unit) {
  const disc = $('#limit-disc');
  const val = $('#limit-value');
  if (!limit || !limit.kmh) {
    disc.dataset.state = limit && limit.source === 'nessun limite' ? 'none' : 'unknown';
    val.textContent = limit && limit.source === 'nessun limite' ? 'libero' : '—';
    return;
  }
  const shown = unit === 'mph' ? Math.round(limit.kmh / 1.609344) : limit.kmh;
  val.textContent = String(shown);
  disc.dataset.state = limit.presumed ? 'presumed' : 'known';
}

export function renderRoadLine(match, limit) {
  const el = $('#road-line');
  if (!match) {
    el.innerHTML = '<span class="src">Nessuna strada agganciata — dati OSM assenti o GPS impreciso</span>';
    return;
  }
  const r = match.road;
  const bits = [];
  if (r.rough) bits.push(r.rough);
  if (r.limited) bits.push(r.limited);
  if (r.tunnel) bits.push('galleria');
  if (r.oneway) bits.push('senso unico');
  el.innerHTML =
    `<b>${escapeHtml(r.name || tipoStrada(r.hw))}</b>` +
    (bits.length ? ` · ${escapeHtml(bits.join(' · '))}` : '') +
    ` <span class="src">— limite: ${escapeHtml(limit.source)}</span>`;
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
  // Due allerte al massimo: la terza non la legge nessuno mentre guida.
  const top = alerts.slice(0, 2);
  const signature = top.map((a) => `${a.id}:${Math.round(a.distance / 25)}`).join('|');
  if (stack.dataset.sig === signature) return;
  stack.dataset.sig = signature;
  stack.innerHTML = top.map((a) => `
    <div class="alert alert-${a.level}">
      <span class="a-glyph">${GLYPH[a.icon] || '•'}</span>
      <div>
        <div class="a-title">${escapeHtml(a.title)}</div>
        ${a.detail && a.detail !== a.title ? `<div class="a-detail">${escapeHtml(a.detail)}</div>` : ''}
      </div>
      ${a.distance > 15 ? `<div class="a-dist">${formatDistance(a.distance)}</div>` : ''}
    </div>`).join('');
}

export function renderGpsPill(fix, state, stale) {
  const pill = $('#pill-gps');
  if (!fix) {
    pill.dataset.state = 'bad';
    pill.innerHTML = '<i class="dot"></i> GPS assente';
    return;
  }
  if (stale) {
    pill.dataset.state = 'bad';
    pill.innerHTML = '<i class="dot"></i> GPS perso';
    return;
  }
  // Niente velocità qui: c'è già il tachimetro grande. La pill deve
  // stare su una riga sola anche su un telefono stretto.
  const acc = Math.round(fix.accuracy || 0);
  pill.dataset.state = acc <= 25 ? 'ok' : acc <= 60 ? 'warn' : 'bad';
  pill.innerHTML = `<i class="dot"></i> GPS ±${acc} m${state === 'fermo' ? ' · fermo' : ''}`;
}

export function renderDataPill(status) {
  const pill = $('#pill-data');
  const map = {
    idle: ['warn', 'Dati in attesa'],
    loading: ['warn', 'Dati…'],
    live: ['ok', 'Dati OSM'],
    cache: ['ok', 'Dati in cache'],
    stale: ['warn', 'Dati vecchi'],
    error: ['bad', 'Dati non disponibili'],
  };
  const [state, label] = map[status.state] || map.idle;
  pill.dataset.state = state;
  const n = status.counts ? ` · ${status.counts.roads}` : '';
  pill.innerHTML = `<i class="dot"></i> ${label}${n}`;

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
    <label class="toggle">
      <input type="checkbox" data-layer="${key}" ${settings.layers[key] ? 'checked' : ''}>
      <span>${label}</span>
    </label>`).join('');
  box.querySelectorAll('input[data-layer]').forEach((input) => {
    input.addEventListener('change', () => onChange(input.dataset.layer, input.checked));
  });
}

export function buildReportChips(kinds, onPick) {
  const box = $('#report-kinds');
  box.innerHTML = kinds.map((k) => `
    <button class="chip" data-kind="${k.id}"><span class="e">${k.emoji}</span>${k.label}</button>`).join('');
  box.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => onPick(chip.dataset.kind));
  });
}

export function buildInfoPanel() {
  const b = COUNTRY_BRIEF;
  $('#info-body').innerHTML = `
    <div class="info-block">
      <h3>Limiti di velocità — ${escapeHtml(b.country)}</h3>
      ${b.limits.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}
      <p class="sheet-note">Valori generali per automobili. I neopatentati hanno limiti più bassi.
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
      via Overpass API, interrogata intorno alla tua posizione mentre guidi. Sono dati
      collaborativi: <b>possono essere incompleti o superati</b>. Quando manca il limite,
      l'app mostra un valore <i>presunto</i> (disco tratteggiato) ricavato dal tipo di strada
      e dalle regole albanesi.</p>
      <p>Non esiste un server ARGO dietro questa app: la posizione non lascia il telefono,
      tranne le coordinate arrotondate inviate a Overpass per scaricare la mappa della zona.</p>
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

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'alert alert-info';
  el.style.cssText = 'position:fixed;left:10px;right:10px;bottom:calc(var(--safe-b) + 150px);z-index:900;pointer-events:none';
  el.innerHTML = `<span class="a-glyph">◈</span><div><div class="a-title">${escapeHtml(msg)}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
