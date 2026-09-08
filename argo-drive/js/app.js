/* ============================================================
   ARGO Drive — app.js
   Il direttore d'orchestra: GPS → dati OSM → allerte → schermo.

   Due cicli separati apposta: ogni fix GPS aggiorna posizione,
   velocità e camera (il GPS a volte manda cinque fix al secondo,
   a volte uno ogni dieci); un tick a 1 Hz rifà il map matching,
   rivaluta le allerte e ridisegna la scheda di guida.
   ============================================================ */

import { SpeedEstimator, msToKmh, haversine, bearing } from './geo.js';
import { OsmSource, matchRoad, resolveLimit, isUrban } from './osm.js';
import { AlertEngine, Voice, nearbyList } from './alerts.js';
import { Reports, REPORT_KINDS } from './reports.js';
import { DriveMap } from './map.js';
import { CURATED_SPOTS } from './rules-albania.js';
import { route as calcolaPercorso } from './router.js';
import { Guidance } from './guidance.js';
import * as search from './search.js';
import * as ui from './ui.js';

const FIX_STALE_MS = 20000;
const AUTO_COLLAPSE_MS = 8000;
const RICALCOLO_MS = 12000;

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
  started: false,
  pendingLngLat: null,
  lastFixTs: 0,
  lastErrCode: null,
  lastErrToast: 0,
  lastSheetTouch: 0,
  lastTopAlert: null,
  mapTheme: 'giorno',
  nav: { destination: null, route: null, percorsi: [], alternatives: [], lastReroute: 0, rerouting: false },
  ricerca: { ctrl: null, timer: null, categoria: null },
};

const voice = new Voice();
const guidance = new Guidance(voice);
const speedometer = new SpeedEstimator();
const engine = new AlertEngine(voice, state.settings);
const source = new OsmSource((status) => ui.renderDataChip(status));
const reports = new Reports((items) => {
  map.renderReports(items, REPORT_KINDS);
  const el = ui.$('#report-count');
  if (el) el.textContent = `${items.length} segnalazioni attive sul telefono.`;
});

let map;

/* ---------- avvio ---------- */

function boot() {
  state.mapTheme = ui.resolveTheme(state.settings.theme);
  ui.applyChromeTheme(state.mapTheme);

  map = new DriveMap(ui.$('#map'), {
    theme: state.mapTheme,
    mode: state.settings.mode,
    buildings3d: state.settings.buildings3d,
    onFollowChange: (on) => ui.$('#btn-center').classList.toggle('is-off', !on),
    onBearingChange: (b) => {
      const btn = ui.$('#btn-compass');
      btn.hidden = Math.abs(b) < 1;
      btn.style.transform = `rotate(${-b}deg)`;
    },
    onFallback: (reason) => ui.toast(`Mappa vettoriale non disponibile (${reason}): passo alla mappa semplice.`),
    onLongPress: (lngLat) => scegliPuntoSullaMappa(lngLat),
  });

  voice.enabled = state.settings.voice;
  source.setRadius(state.settings.radius);

  ui.initSheet(() => { state.lastSheetTouch = Date.now(); });
  ui.initTabs();
  ui.buildInfoPanel();
  ui.buildReportChips(REPORT_KINDS, addReport);
  ui.buildCategoryChips(search.CATEGORIE, pickCategory);
  ui.setNavMode(false);
  mostraLuoghiSalvati();
  ui.buildLayerToggles(state.settings, (layer, on) => {
    state.settings.layers[layer] = on;
    ui.saveSettings(state.settings);
    map.setLayerVisible(layer, on);
  });

  ui.setSegActive('#theme-seg', 'theme', state.settings.theme);
  ui.setSegActive('#mode-seg', 'mode', state.settings.mode);
  ui.setSegActive('#tol-seg', 'tol', state.settings.tolerance);
  ui.setSegActive('#radius-seg', 'radius', state.settings.radius);
  ui.setSegActive('#unit-seg', 'unit', state.settings.unit);
  ui.$('#opt-voice').checked = state.settings.voice;
  ui.$('#opt-haptics').checked = state.settings.haptics;
  ui.$('#opt-wakelock').checked = state.settings.wakelock;
  ui.$('#opt-3d').checked = state.settings.buildings3d;
  ui.$('#btn-voice').classList.toggle('is-on', state.settings.voice);
  ui.$('#btn-3d').classList.toggle('is-on', state.settings.buildings3d);

  map.map.on('load', () => {
    map.renderCurated(CURATED_SPOTS);
    map.renderReports(reports.items, REPORT_KINDS);
    applyLayers();
  });

  wireUI();
  ui.renderDataChip({ state: 'idle' });
  updateNetChip();
  window.addEventListener('online', updateNetChip);
  window.addEventListener('offline', updateNetChip);

  setInterval(tick, 1000);
  setInterval(refreshAutoTheme, 10 * 60 * 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* niente offline, ma l'app gira */ });
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

  navigator.geolocation.watchPosition(onFix, onGeoError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 20000,
  });

  ui.$('#gate').hidden = true;
  map.resize();
}

/**
 * Il GPS produce errori transitori in continuazione (una galleria,
 * un garage). Se ho un fix recente li ignoro: avvisare ogni volta
 * trasformerebbe l'app in un allarme antifurto.
 */
function onGeoError(err) {
  const now = Date.now();
  if (state.lastFixTs && now - state.lastFixTs < 15000) return;

  const msgs = {
    1: 'Permesso di posizione negato. Attivalo nelle impostazioni del browser e ricarica la pagina.',
    2: 'Posizione non disponibile: galleria, garage o cielo coperto.',
    3: 'Il GPS non risponde. Esci all’aperto e riprova.',
  };
  ui.renderGpsChip(state.fix, null, true);
  if (err.code === state.lastErrCode && now - state.lastErrToast < 30000) return;
  state.lastErrCode = err.code;
  state.lastErrToast = now;
  ui.toast(msgs[err.code] || 'Errore GPS');
}

/* ---------- flusso posizione ---------- */

function onFix(pos) {
  const c = pos.coords;
  const fix = {
    lat: c.latitude, lon: c.longitude,
    accuracy: c.accuracy, speed: c.speed, heading: c.heading,
    ts: pos.timestamp || Date.now(),
  };
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

  map.updatePosition(fix, state.heading, state.speedMs);
  ui.renderGpsChip(fix, moving ? null : 'fermo');

  source.update(fix.lat, fix.lon, state.heading, state.speedMs).then((data) => {
    if (data) map.renderData(data);
  });
}

/* ---------- ciclo di valutazione ---------- */

function tick() {
  if (!state.fix) return;

  // Posizione vecchia = allerte sbagliate. Meglio dirlo che fingere.
  if (Date.now() - state.lastFixTs > FIX_STALE_MS) {
    ui.renderGpsChip(state.fix, null, true);
    ui.renderAlerts([{
      id: 'nogps', level: 'warn', icon: 'alert', distance: 0,
      title: 'Segnale GPS perso',
      detail: 'Limiti e avvisi sono sospesi finché non torna la posizione.',
    }]);
    ui.renderSpeed(NaN, state.settings.unit, false);
    map.highlightRoad(null);
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

  if (map.shouldAutoRecenter(state.speedMs)) map.recenter();

  if (guidance.active) {
    const nav = guidance.update(point, state.speedMs);
    if (nav) {
      ui.renderManeuver(nav);
      ui.renderEta(nav);
      map.updateProgress(nav.along);
      map.setManeuverDistance(nav.distanceToManeuver);
      if (nav.arrived) arrivato();
      else if (nav.needsReroute) ricalcola();
    }
  }

  const speedKmh = msToKmh(state.speedMs);
  const over = !!(state.limit.kmh && speedKmh > state.limit.kmh + state.settings.tolerance);
  ui.renderSpeed(speedKmh, state.settings.unit, over);
  ui.renderLimit(state.limit, state.settings.unit);
  ui.renderRoad(state.match, state.limit);
  ui.renderAlerts(state.alerts);
  ui.renderNearby(nearbyList(
    point, data,
    state.settings.layers.reports ? reports.items : [],
    state.settings.layers.curated ? CURATED_SPOTS : []
  ));
  buzz(state.alerts);
  autoCollapse(speedKmh);
}

/** Una vibrazione quando compare un'allerta nuova: si sente anche con la radio alta. */
function buzz(alerts) {
  const top = alerts[0];
  const id = top ? top.id : null;
  if (id === state.lastTopAlert) return;
  state.lastTopAlert = id;
  if (!top || !state.settings.haptics || !navigator.vibrate) return;
  if (top.level === 'danger') navigator.vibrate([60, 50, 60]);
  else if (top.level === 'warn') navigator.vibrate(35);
}

/** In marcia il pannello torna alla scheda di guida: schermo alla mappa. */
function autoCollapse(speedKmh) {
  if (speedKmh < 12 || ui.getSheet() === 'peek') return;
  if (Date.now() - state.lastSheetTouch < AUTO_COLLAPSE_MS) return;
  ui.setSheet('peek');
}

function refreshAutoTheme() {
  if (state.settings.theme !== 'auto') return;
  const wanted = ui.resolveTheme('auto');
  if (wanted === state.mapTheme) return;
  applyTheme(wanted);
}

function applyTheme(mapTheme) {
  state.mapTheme = mapTheme;
  ui.applyChromeTheme(mapTheme);
  map.setTheme(mapTheme);
}

/* ---------- ricerca e navigazione ---------- */

function posizione() {
  return state.fix ? [state.fix.lat, state.fix.lon] : null;
}

function apriRicerca() {
  ui.showPanel('cerca');
  ui.setSheet('full');
  const input = ui.$('#search-input');
  setTimeout(() => input.focus(), 250);
}

/** Con la casella vuota si mostrano preferiti e ultime destinazioni. */
function mostraLuoghiSalvati() {
  const preferiti = search.preferiti().map((p) => ({ ...p, emoji: '⭐', name: p.label || p.name }));
  const recenti = search.recenti().map((r) => ({ ...r, emoji: '🕘' }));
  const punto = posizione();
  const voci = [...preferiti, ...recenti].map((v) => ({
    ...v,
    distance: punto ? haversine(punto, [v.lat, v.lon]) : null,
  }));
  ui.renderResults(voci, scegliDestinazione, 'Cerca un luogo, o tieni premuto un punto sulla mappa.');
}

function cerca(query) {
  clearTimeout(state.ricerca.timer);
  if (state.ricerca.ctrl) state.ricerca.ctrl.abort();
  if (!query.trim()) { ui.searchNote(''); mostraLuoghiSalvati(); return; }

  state.ricerca.timer = setTimeout(async () => {
    const ctrl = new AbortController();
    state.ricerca.ctrl = ctrl;
    ui.searchNote('Cerco…');
    try {
      const risultati = await search.geocode(query, posizione(), ctrl.signal);
      ui.searchNote('');
      ui.renderResults(risultati.map((r) => ({ ...r, emoji: '📍' })), scegliDestinazione, 'Nessun risultato.');
    } catch (err) {
      if (err.name === 'AbortError') return;
      ui.searchNote('Ricerca non disponibile senza rete.');
      ui.renderResults([], scegliDestinazione, 'Nessun risultato.');
    }
  }, 350);
}

async function pickCategory(id) {
  state.ricerca.categoria = id;
  if (!id) { mostraLuoghiSalvati(); return; }
  const punto = posizione();
  if (!punto) { ui.toast('Serve prima una posizione GPS'); ui.clearCategory(); return; }
  const cat = search.CATEGORIE.find((c) => c.id === id);
  ui.searchNote(`Cerco ${cat.label.toLowerCase()} qui intorno…`);
  try {
    const risultati = await search.nearby(id, punto);
    ui.searchNote('');
    ui.renderResults(risultati.map((r) => ({ ...r, emoji: cat.emoji })), scegliDestinazione,
      `Nessun risultato entro 5 km.`);
  } catch {
    ui.searchNote('Ricerca per categoria non disponibile senza rete.');
  }
}

async function scegliPuntoSullaMappa(lngLat) {
  state.pendingLngLat = lngLat;
  ui.showPanel('cerca');
  ui.setSheet('half');
  ui.searchNote('Punto scelto sulla mappa: toccalo per andarci, oppure usa la scheda Segnala per segnalarlo qui.');
  ui.renderResults([{ name: 'Punto sulla mappa', detail: 'cerco l’indirizzo…', lat: lngLat.lat, lon: lngLat.lng, emoji: '📌' }], () => {});
  const luogo = await search.reverse([lngLat.lat, lngLat.lng]);
  const punto = posizione();
  ui.renderResults([{ ...luogo, emoji: '📌', distance: punto ? haversine(punto, [luogo.lat, luogo.lon]) : null }],
    scegliDestinazione);
}

async function scegliDestinazione(luogo) {
  const partenza = posizione();
  if (!partenza) { ui.toast('Serve prima una posizione GPS'); return; }
  search.ricorda(luogo);
  ui.searchNote('');
  ui.toast('Calcolo il percorso…');
  try {
    const percorsi = await calcolaPercorso(partenza, [luogo.lat, luogo.lon]);
    state.nav.destination = luogo;
    state.nav.route = percorsi[0];
    state.nav.alternatives = percorsi.slice(1);
    state.nav.percorsi = percorsi;
    mostraPercorso(0);
    ui.showPanel('percorso');
    ui.setSheet('half');
  } catch (err) {
    ui.toast(err.message || 'Percorso non disponibile');
  }
}

/** Mostra il percorso scelto fra quelli proposti. */
function mostraPercorso(indice) {
  const percorsi = state.nav.percorsi || [];
  const scelto = percorsi[indice];
  if (!scelto) return;
  state.nav.route = scelto;
  state.nav.alternatives = percorsi.filter((_, i) => i !== indice);
  map.showRoute(scelto, state.nav.alternatives, state.nav.destination);
  // Il pannello aperto a metà occupa la parte bassa: il percorso va
  // inquadrato in quella alta, o resta nascosto dietro.
  map.fitRoute(scelto, {
    visibleTop: 150,                                        // sotto la barra di ricerca
    visibleBottom: Math.round(window.innerHeight * 0.47),   // sopra il pannello aperto a metà
  });
  ui.renderRoutePreview(scelto, state.nav.destination, state.nav.alternatives.length);
  ui.renderRouteChoices(percorsi, indice, mostraPercorso);
}

function salvaLuogo() {
  const d = state.nav.destination;
  if (!d) return;
  search.salvaPreferito(d, d.name);
  ui.toast(`"${d.name}" salvato nei preferiti`);
}

/** Condivide l'orario di arrivo: quello che si fa davvero, in viaggio. */
async function condividiArrivo() {
  const d = state.nav.destination;
  const r = state.nav.route;
  if (!d || !r) return;
  const arrivo = new Date(Date.now() + r.duration * 1000);
  const testo = `Sto andando a ${d.name}. Arrivo previsto ${arrivo.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} `
    + `(${Math.round(r.distance / 100) / 10} km). Posizione: https://www.openstreetmap.org/?mlat=${d.lat.toFixed(5)}&mlon=${d.lon.toFixed(5)}#map=16/${d.lat.toFixed(5)}/${d.lon.toFixed(5)}`;
  try {
    if (navigator.share) await navigator.share({ title: 'ARGO Drive', text: testo });
    else { await navigator.clipboard.writeText(testo); ui.toast('Copiato: incollalo dove vuoi'); }
  } catch { /* condivisione annullata */ }
}

function avviaNavigazione() {
  if (!state.nav.route || !state.nav.destination) return;
  guidance.start(state.nav.route, state.nav.destination);
  ui.setNavMode(true);
  ui.setSheet('peek');
  ui.showPanel('cerca');
  state.settings.mode = 'rotta';
  ui.setSegActive('#mode-seg', 'mode', 'rotta');
  map.setMode('rotta');
  map.recenter();
}

function terminaNavigazione(messaggio) {
  const era = guidance.stop();
  map.clearRoute();
  map.setManeuverDistance(null);
  ui.setNavMode(false);
  state.nav = { destination: null, route: null, percorsi: [], alternatives: [], lastReroute: 0, rerouting: false };
  if (era && messaggio) ui.toast(messaggio);
  mostraLuoghiSalvati();
}

function arrivato() {
  const nome = state.nav.destination ? state.nav.destination.name : 'destinazione';
  terminaNavigazione(`Arrivato: ${nome}`);
}

/** Ricalcolo dopo un'uscita dal percorso, con freno per non insistere. */
async function ricalcola() {
  const adesso = Date.now();
  if (state.nav.rerouting || adesso - state.nav.lastReroute < RICALCOLO_MS) return;
  const partenza = posizione();
  if (!partenza || !state.nav.destination) return;

  state.nav.rerouting = true;
  state.nav.lastReroute = adesso;
  try {
    const percorsi = await calcolaPercorso(partenza, [state.nav.destination.lat, state.nav.destination.lon], { alternatives: false });
    state.nav.route = percorsi[0];
    state.nav.alternatives = [];
    map.showRoute(percorsi[0], [], state.nav.destination);
    guidance.start(percorsi[0], state.nav.destination);
  } catch {
    ui.toast('Ricalcolo non riuscito: nessuna rete');
    guidance.needsReroute = false;
  } finally {
    state.nav.rerouting = false;
  }
}

/* ---------- segnalazioni ---------- */

function addReport(kind) {
  const ll = state.pendingLngLat
    ? [state.pendingLngLat.lat, state.pendingLngLat.lng]
    : state.fix ? [state.fix.lat, state.fix.lon] : null;
  if (!ll) { ui.toast('Serve prima una posizione GPS'); return; }
  const note = ui.$('#report-note').value.trim();
  reports.add(kind, ll[0], ll[1], note);
  ui.$('#report-note').value = '';
  state.pendingLngLat = null;
  ui.setSheet('peek');
  ui.toast('Segnalazione salvata');
  voice.tone('info');
  if (state.settings.haptics && navigator.vibrate) navigator.vibrate(20);
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
  } catch { /* batteria bassa o scheda in background */ }
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

function updateNetChip() {
  ui.$('#pill-net').hidden = navigator.onLine;
}

function applyLayers() {
  for (const [key, on] of Object.entries(state.settings.layers)) map.setLayerVisible(key, on);
}

/* ---------- eventi UI ---------- */

function wireUI() {
  ui.$('#btn-start').addEventListener('click', start);

  ui.$('#btn-center').addEventListener('click', () => {
    map.recenter();
    if (state.settings.mode === 'rotta') return;
    state.settings.mode = 'rotta';
    ui.saveSettings(state.settings);
    ui.setSegActive('#mode-seg', 'mode', 'rotta');
    map.setMode('rotta');
  });

  ui.$('#btn-compass').addEventListener('click', () => {
    state.settings.mode = 'nord';
    ui.saveSettings(state.settings);
    ui.setSegActive('#mode-seg', 'mode', 'nord');
    map.setMode('nord');
  });

  ui.$('#btn-3d').addEventListener('click', () => toggle3D(!state.settings.buildings3d));
  ui.$('#opt-3d').addEventListener('change', (e) => toggle3D(e.target.checked));

  ui.$('#btn-voice').addEventListener('click', () => toggleVoice(!state.settings.voice));
  ui.$('#opt-voice').addEventListener('change', (e) => toggleVoice(e.target.checked));

  ui.$('#opt-haptics').addEventListener('change', (e) => {
    state.settings.haptics = e.target.checked;
    ui.saveSettings(state.settings);
  });

  ui.$('#opt-wakelock').addEventListener('change', (e) => {
    state.settings.wakelock = e.target.checked;
    ui.saveSettings(state.settings);
    if (e.target.checked) requestWakeLock();
    else if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
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
    applyTheme(ui.resolveTheme(state.settings.theme));
  }));

  document.querySelectorAll('#mode-seg button').forEach((b) => b.addEventListener('click', () => {
    state.settings.mode = b.dataset.mode;
    ui.saveSettings(state.settings);
    ui.setSegActive('#mode-seg', 'mode', state.settings.mode);
    map.setMode(state.settings.mode);
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

  ui.$('#btn-refresh').addEventListener('click', () => {
    if (!state.fix) { ui.toast('Serve prima una posizione GPS'); return; }
    source.failures = 0;
    source.lastAttempt = 0;
    source.fetchNow(state.fix.lat, state.fix.lon, state.heading, state.speedMs).then((d) => {
      if (d) { map.renderData(d); ui.toast('Dati stradali aggiornati'); }
      else ui.toast('Overpass non raggiungibile: resto sui dati in cache');
    });
  });

  ui.$('#btn-search').addEventListener('click', apriRicerca);
  ui.$('#search-input').addEventListener('input', (e) => {
    ui.$('#search-clear').hidden = !e.target.value;
    ui.clearCategory();
    cerca(e.target.value);
  });
  ui.$('#search-clear').addEventListener('click', () => {
    ui.$('#search-input').value = '';
    ui.$('#search-clear').hidden = true;
    cerca('');
  });
  ui.$('#btn-go').addEventListener('click', avviaNavigazione);
  ui.$('#btn-fav').addEventListener('click', salvaLuogo);
  ui.$('#btn-share').addEventListener('click', condividiArrivo);
  ui.$('#btn-cancel-route').addEventListener('click', () => {
    map.clearRoute();
    state.nav.route = null;
    ui.showPanel('cerca');
    map.recenter();
  });
  ui.$('#btn-stop-nav').addEventListener('click', () => terminaNavigazione('Navigazione interrotta'));

  ui.$('#sheet-body').addEventListener('pointerdown', () => { state.lastSheetTouch = Date.now(); });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      refreshAutoTheme();
      if (state.fix) source.update(state.fix.lat, state.fix.lon, state.heading, state.speedMs).then((d) => d && map.renderData(d));
    }
  });
}

function toggle3D(on) {
  state.settings.buildings3d = on;
  ui.saveSettings(state.settings);
  ui.$('#opt-3d').checked = on;
  ui.$('#btn-3d').classList.toggle('is-on', on);
  map.set3D(on);
}

function toggleVoice(on) {
  state.settings.voice = on;
  voice.enabled = on;
  ui.saveSettings(state.settings);
  ui.$('#opt-voice').checked = on;
  ui.$('#btn-voice').classList.toggle('is-on', on);
  if (on) { voice.unlock(); voice.say('Avvisi vocali attivi', 'info'); }
}

boot();

// Utile per verifiche manuali dalla console del telefono.
window.ARGO_DRIVE = { state, source, reports, engine, guidance, search, map: () => map, ui };
