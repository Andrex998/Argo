/* ============================================================
   ARGO Drive — app.js
   Il direttore d'orchestra: GPS → dati OSM → allerte → schermo.

   Ciclo: ogni fix aggiorna posizione e velocità; un tick a 1 Hz
   rifà il map matching e rivaluta le allerte. Separati apposta,
   perché il GPS a volte spara 5 fix al secondo e a volte uno
   ogni dieci.
   ============================================================ */

import { SpeedEstimator, msToKmh, haversine, bearing } from './geo.js';
import { OsmSource, matchRoad, resolveLimit, isUrban } from './osm.js';
import { AlertEngine, Voice } from './alerts.js';
import { Reports, REPORT_KINDS } from './reports.js';
import { DriveMap } from './map.js';
import { CURATED_SPOTS } from './rules-albania.js';
import * as ui from './ui.js';

const state = {
  settings: ui.loadSettings(),
  fix: null,
  heading: null,
  compass: null,
  speedMs: 0,
  match: null,
  limit: null,
  urban: false,
  alerts: [],
  wakeLock: null,
  watchId: null,
  started: false,
  pendingLatLng: null,
  lastFixTs: 0,
  lastErrCode: null,
  lastErrToast: 0,
};

const FIX_STALE_MS = 20000;

const voice = new Voice();
const speedometer = new SpeedEstimator();
const engine = new AlertEngine(voice, state.settings);
const source = new OsmSource((status) => ui.renderDataPill(status));
const reports = new Reports((items) => {
  map.renderReports(items, REPORT_KINDS, (id) => reports.remove(id));
  const el = ui.$('#report-count');
  if (el) el.textContent = `${items.length} segnalazioni attive sul telefono.`;
});

let map;

/* ---------- avvio ---------- */

function boot() {
  map = new DriveMap(ui.$('#map'), {
    theme: state.settings.theme,
    onFollowChange: (on) => ui.$('#btn-center').classList.toggle('is-on', on),
    onMapLongPress: (latlng) => {
      state.pendingLatLng = latlng;
      ui.openSheet('sheet-report');
      ui.toast('Segnalazione sul punto scelto');
    },
  });

  voice.enabled = state.settings.voice;
  source.setRadius(state.settings.radius);

  ui.buildInfoPanel();
  ui.buildReportChips(REPORT_KINDS, addReport);
  ui.buildLayerToggles(state.settings, (layer, on) => {
    state.settings.layers[layer] = on;
    ui.saveSettings(state.settings);
    applyLayers();
  });
  ui.setSegActive('#theme-seg', 'theme', state.settings.theme);
  ui.setSegActive('#tol-seg', 'tol', state.settings.tolerance);
  ui.setSegActive('#radius-seg', 'radius', state.settings.radius);
  ui.setSegActive('#unit-seg', 'unit', state.settings.unit);
  ui.$('#opt-voice').checked = state.settings.voice;
  ui.$('#opt-wakelock').checked = state.settings.wakelock;
  ui.$('#btn-voice').classList.toggle('is-on', state.settings.voice);

  map.renderCurated(CURATED_SPOTS);
  map.renderReports(reports.items, REPORT_KINDS, (id) => reports.remove(id));
  applyLayers();
  wireUI();

  ui.renderDataPill({ state: 'idle' });
  updateNetPill();
  window.addEventListener('online', updateNetPill);
  window.addEventListener('offline', updateNetPill);

  setInterval(tick, 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* funziona lo stesso, senza offline */ });
  }
}

function start() {
  if (state.started) return;
  state.started = true;
  voice.unlock();
  requestWakeLock();
  requestCompass();

  if (!('geolocation' in navigator)) {
    ui.$('.gate-legal').innerHTML = '<b>Questo browser non espone la posizione.</b> Apri la pagina in Safari o Chrome.';
    state.started = false;
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(onFix, onGeoError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 20000,
  });

  ui.$('#gate').hidden = true;
}

/**
 * Il GPS produce errori transitori in continuazione (una galleria,
 * un palazzo, un garage). Se ho un fix recente li ignoro: avvisare
 * ogni volta trasformerebbe l'app in un allarme antifurto.
 */
function onGeoError(err) {
  const now = Date.now();
  if (state.lastFixTs && now - state.lastFixTs < 15000) return;

  const msgs = {
    1: 'Permesso di posizione negato. Attivalo nelle impostazioni del browser e ricarica la pagina.',
    2: 'Posizione non disponibile: galleria, garage o cielo coperto.',
    3: 'Il GPS non risponde. Esci all’aperto e riprova.',
  };
  ui.renderGpsPill(state.fix, null, true);
  if (err.code === state.lastErrCode && now - state.lastErrToast < 30000) return;
  state.lastErrCode = err.code;
  state.lastErrToast = now;
  ui.toast(msgs[err.code] || 'Errore GPS');
}

/* ---------- flusso posizione ---------- */

function onFix(pos) {
  const c = pos.coords;
  const fix = {
    lat: c.latitude,
    lon: c.longitude,
    accuracy: c.accuracy,
    speed: c.speed,
    heading: c.heading,
    ts: pos.timestamp || Date.now(),
  };

  // Fix con precisione oltre i 200 m fanno più danno che altro.
  if (fix.accuracy && fix.accuracy > 200 && state.fix) return;

  const prev = state.fix;
  state.speedMs = speedometer.push(fix);
  const moving = state.speedMs > 1.4;

  // Priorità: rotta dal GPS → rotta ricavata dallo spostamento
  // (molti Android non riempiono coords.heading) → bussola da fermo.
  if (moving && Number.isFinite(fix.heading)) {
    state.heading = fix.heading;
  } else if (prev && haversine([prev.lat, prev.lon], [fix.lat, fix.lon]) > 8) {
    state.heading = bearing([prev.lat, prev.lon], [fix.lat, fix.lon]);
  } else if (!moving && Number.isFinite(state.compass)) {
    state.heading = state.compass;
  }

  state.fix = fix;
  state.lastFixTs = Date.now();
  state.lastErrCode = null;
  map.updatePosition(fix, state.heading);
  ui.renderGpsPill(fix, moving ? null : 'fermo');

  source.update(fix.lat, fix.lon, state.heading, state.speedMs).then((data) => {
    if (data) map.renderData(data);
  });
}

/* ---------- ciclo di valutazione ---------- */

function tick() {
  if (!state.fix) return;

  // Posizione vecchia = allerte sbagliate. Meglio dirlo che fingere.
  if (Date.now() - state.lastFixTs > FIX_STALE_MS) {
    ui.renderGpsPill(state.fix, null, true);
    ui.renderAlerts([{
      id: 'nogps', level: 'warn', icon: 'alert', distance: 0,
      title: 'Segnale GPS perso',
      detail: 'Limiti e avvisi sono sospesi finché non torna la posizione.',
    }]);
    ui.renderSpeed(NaN, state.settings.unit, false);
    return;
  }

  const point = [state.fix.lat, state.fix.lon];
  const data = source.data;

  state.urban = isUrban(point, data);
  state.match = matchRoad(point, state.heading, state.speedMs, data);
  state.limit = resolveLimit(state.match, state.urban);
  map.highlightRoad(state.match ? state.match.road : null);

  state.alerts = engine.evaluate({
    point,
    heading: state.heading,
    speedMs: state.speedMs,
    data,
    reports: state.settings.layers.reports ? reports.items : [],
    curated: state.settings.layers.curated ? CURATED_SPOTS : [],
    limit: state.limit,
  });

  const speedKmh = msToKmh(state.speedMs);
  const over = !!(state.limit.kmh && speedKmh > state.limit.kmh + state.settings.tolerance);
  ui.renderSpeed(speedKmh, state.settings.unit, over);
  ui.renderLimit(state.limit, state.settings.unit);
  ui.renderRoadLine(state.match, state.limit);
  ui.renderAlerts(state.alerts);
}

/* ---------- segnalazioni ---------- */

function addReport(kind) {
  const ll = state.pendingLatLng
    ? [state.pendingLatLng.lat, state.pendingLatLng.lng]
    : state.fix ? [state.fix.lat, state.fix.lon] : null;
  if (!ll) { ui.toast('Serve prima una posizione GPS'); return; }
  const note = ui.$('#report-note').value.trim();
  reports.add(kind, ll[0], ll[1], note);
  ui.$('#report-note').value = '';
  state.pendingLatLng = null;
  ui.closeSheets();
  ui.toast('Segnalazione salvata');
  voice.tone('info');
}

function exportReports() {
  if (!reports.items.length) { ui.toast('Nessuna segnalazione da esportare'); return; }
  const blob = new Blob([reports.toJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `argo-drive-segnalazioni-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importReports(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const n = reports.merge(String(fr.result));
      ui.toast(n ? `${n} segnalazioni importate` : 'Nessuna nuova segnalazione');
    } catch (e) {
      ui.toast(e.message);
    }
  };
  fr.readAsText(file);
}

/* ---------- schermo, bussola, rete ---------- */

async function requestWakeLock() {
  if (!state.settings.wakelock || !('wakeLock' in navigator)) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch { /* batteria bassa o tab in background */ }
}

function requestCompass() {
  const handler = (e) => {
    const h = Number.isFinite(e.webkitCompassHeading)
      ? e.webkitCompassHeading
      : (e.absolute && Number.isFinite(e.alpha) ? (360 - e.alpha) % 360 : null);
    if (Number.isFinite(h)) state.compass = h;
  };
  const attach = () => {
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
  };
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((r) => { if (r === 'granted') attach(); }).catch(() => {});
  } else if (DOE) {
    attach();
  }
}

function updateNetPill() {
  ui.$('#pill-net').hidden = navigator.onLine;
}

function applyLayers() {
  const l = state.settings.layers;
  map.setLayerVisible('zones', l.zones);
  map.setLayerVisible('roads', l.roads);
  map.setLayerVisible('cameras', l.cameras);
  map.setLayerVisible('hazards', l.hazards);
  map.setLayerVisible('reports', l.reports);
  map.setLayerVisible('curated', l.curated);
}

/* ---------- eventi UI ---------- */

function wireUI() {
  ui.$('#btn-start').addEventListener('click', start);
  ui.$('#scrim').addEventListener('click', ui.closeSheets);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', ui.closeSheets));

  ui.$('#btn-report').addEventListener('click', () => { state.pendingLatLng = null; ui.openSheet('sheet-report'); });
  ui.$('#btn-layers').addEventListener('click', () => ui.openSheet('sheet-layers'));
  ui.$('#btn-info').addEventListener('click', () => ui.openSheet('sheet-info'));
  ui.$('#btn-center').addEventListener('click', () => map.recenter());

  ui.$('#btn-voice').addEventListener('click', () => {
    state.settings.voice = !state.settings.voice;
    voice.enabled = state.settings.voice;
    ui.saveSettings(state.settings);
    ui.$('#btn-voice').classList.toggle('is-on', state.settings.voice);
    ui.$('#opt-voice').checked = state.settings.voice;
    if (state.settings.voice) { voice.unlock(); voice.say('Avvisi vocali attivi', 'info'); }
  });

  ui.$('#btn-export').addEventListener('click', exportReports);
  ui.$('#btn-import').addEventListener('click', () => ui.$('#import-file').click());
  ui.$('#import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importReports(e.target.files[0]);
    e.target.value = '';
  });
  ui.$('#btn-clear-reports').addEventListener('click', () => {
    if (confirm('Cancellare tutte le segnalazioni salvate?')) { reports.clear(); ui.toast('Segnalazioni cancellate'); }
  });

  document.querySelectorAll('#theme-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.theme = b.dataset.theme;
    ui.saveSettings(state.settings);
    ui.setSegActive('#theme-seg', 'theme', state.settings.theme);
    map.setTheme(state.settings.theme);
  }));

  document.querySelectorAll('#tol-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.tolerance = Number(b.dataset.tol);
    ui.saveSettings(state.settings);
    ui.setSegActive('#tol-seg', 'tol', state.settings.tolerance);
    tick();
  }));

  document.querySelectorAll('#radius-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.radius = Number(b.dataset.radius);
    ui.saveSettings(state.settings);
    ui.setSegActive('#radius-seg', 'radius', state.settings.radius);
    source.setRadius(state.settings.radius);
    if (state.fix) source.fetchNow(state.fix.lat, state.fix.lon, state.heading, state.speedMs).then((d) => d && map.renderData(d));
  }));

  document.querySelectorAll('#unit-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.unit = b.dataset.unit;
    ui.saveSettings(state.settings);
    ui.setSegActive('#unit-seg', 'unit', state.settings.unit);
    tick();
  }));

  ui.$('#opt-voice').addEventListener('change', (e) => {
    state.settings.voice = e.target.checked;
    voice.enabled = e.target.checked;
    ui.saveSettings(state.settings);
    ui.$('#btn-voice').classList.toggle('is-on', e.target.checked);
  });

  ui.$('#opt-wakelock').addEventListener('change', (e) => {
    state.settings.wakelock = e.target.checked;
    ui.saveSettings(state.settings);
    if (e.target.checked) requestWakeLock();
    else if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
  });

  ui.$('#btn-refresh').addEventListener('click', () => {
    if (!state.fix) { ui.toast('Serve prima una posizione GPS'); return; }
    source.failures = 0;
    source.lastAttempt = 0;
    source.fetchNow(state.fix.lat, state.fix.lon, state.heading, state.speedMs).then((d) => {
      if (d) { map.renderData(d); ui.toast('Dati stradali aggiornati'); }
      else ui.toast('Overpass non raggiungibile: resto sui dati in cache');
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      if (state.fix) source.update(state.fix.lat, state.fix.lon, state.heading, state.speedMs).then((d) => d && map.renderData(d));
    }
  });
}

boot();

// Utile per verifiche manuali dalla console del telefono.
window.ARGO_DRIVE = { state, source, reports, engine, map: () => map, haversine };
