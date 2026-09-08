/* ============================================================
   ARGO Drive — map.js
   Motore mappa: MapLibre GL (vettoriale, WebGL).

   Perché non una mappa a tile raster: un navigatore serio deve
   poter ruotare con la rotta, inclinarsi, tenere le etichette
   dritte e far emergere gli edifici. Con le immagini pre-cotte
   non si fa; con i tile vettoriali sì.

   Se le tile vettoriali non rispondono (rete povera, servizio
   giù), la mappa ricade da sola su uno stile raster: meglio una
   mappa piatta che nessuna mappa.
   ============================================================ */

import { destination } from './geo.js';
import { buildVectorStyle, buildRasterStyle, buildSatelliteStyle, probeGlyphs, PALETTES } from './style.js';

const COLORS = {
  danger: '#FF3B30',
  warn: '#FFB020',
  voltage: '#3B8EFF',
  trace: '#3B8EFF',
  route: '#1A73E8',        // il blu del percorso: più saturo dell'accento
  routeCase: '#0B3D91',
  routeDone: '#9AA3B2',    // quel che ti sei lasciato dietro
  alt: '#9AA3B2',
};

const GLYPHS = {
  camera: '📸', calming: '⏛', crossing: '🚂', barrier: '⛓', hazard: '⚠️',
  buca: '🕳', incidente: '💥', chiusa: '⛔', polizia: '👮', autovelox: '📸',
  animali: '🐄', pericolo: '⚠️', destinazione: '🏁',
};

const EMPTY = { type: 'FeatureCollection', features: [] };

export class DriveMap {
  constructor(el, opts = {}) {
    this.theme = opts.theme || 'giorno';
    this.buildings3d = opts.buildings3d !== false;
    this.mode = opts.mode || 'rotta';         // 'rotta' = course-up, 'nord' = north-up
    this.follow = true;
    this.tilt = this.mode === 'rotta' ? 60 : 0;
    this.onFollowChange = opts.onFollowChange || (() => {});
    this.onBearingChange = opts.onBearingChange || (() => {});
    this.onFallback = opts.onFallback || (() => {});
    this.onLongPress = opts.onLongPress || null;

    this.usingRaster = false;
    this.lastInteraction = 0;
    this.autoRecenterMs = 12000;   // in marcia la mappa torna da sola su di te
    // Si riparte dall'esito dell'ultima volta: chi ha già visto le
    // etichette funzionare non subisce il ridisegno all'avvio.
    this.labels = readFlag('argo-drive:labels') === '1';
    // Ogni cambio stile ricrea i layer da zero: le scelte dell'utente
    // vanno ricordate qui, o dopo un cambio tema tornano tutte accese.
    this.visibility = { zones: true, roads: true, reports: true, curated: true };
    this.pointFilter = { cameras: true, hazards: true };
    this.dataStamp = null;
    this.overlays = {
      zone: EMPTY, vietate: EMPTY, dissestate: EMPTY, agganciata: EMPTY,
      punti: EMPTY, segnalazioni: EMPTY, curati: EMPTY, precisione: EMPTY, scia: EMPTY,
      percorso: EMPTY, percorsoFatto: EMPTY, percorsiAlt: EMPTY, destinazione: EMPTY,
    };
    this.trace = [];

    this.map = new maplibregl.Map({
      container: el,
      style: this.theme === 'satellite'
        ? buildSatelliteStyle()
        : buildVectorStyle(this.theme, { buildings3d: this.buildings3d, labels: this.labels }),
      center: opts.center || [19.8187, 41.3275],
      zoom: opts.zoom || 15.5,
      pitch: this.tilt,
      bearing: 0,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 70,
      fadeDuration: 120,      // meno dissolvenze: in auto servono numeri, non effetti
      refreshExpiredTiles: false,
    });

    // In basso a destra ci sono i FAB: l'attribuzione sta a sinistra.
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    this.map.touchZoomRotate.enableRotation();
    this.map.keyboard.disable();

    this.map.on('style.load', () => {
      this.installOverlays();
      this.restoreCamera();
    });
    // Qualunque gesto sulla mappa sospende l'inseguimento: trascinamento,
    // rotazione a due dita, zoom. Prima la rotazione veniva ignorata e la
    // camera la annullava un secondo dopo.
    for (const ev of ['dragstart', 'rotatestart', 'pitchstart']) {
      this.map.on(ev, () => { this.lastInteraction = Date.now(); this.setFollow(false); });
    }
    this.map.on('zoomstart', (e) => {
      if (e && e.originalEvent) { this.lastInteraction = Date.now(); this.setFollow(false); }
    });
    this.map.on('rotate', () => this.onBearingChange(this.map.getBearing()));
    this.watchVectorHealth();
    this.installPuck();
    this.installInteractions();
    this.checkGlyphs();
  }

  /* ---------- stile ---------- */

  setTheme(name) {
    this.theme = name;
    this.usingRaster = false;
    const style = name === 'satellite'
      ? buildSatelliteStyle()
      : buildVectorStyle(name, { buildings3d: this.buildings3d, labels: this.labels });
    this.applyStyle(style);
    if (name === 'satellite') {
      clearTimeout(this._healthTimer);   // altrimenti scatta e sostituisce il satellite
      this.detachHealth();
    } else {
      this.watchVectorHealth();
      this.checkGlyphs();
    }
  }

  set3D(on) {
    this.buildings3d = on;
    this.tilt = on && this.mode === 'rotta' ? 60 : 0;
    if (this.theme !== 'satellite' && !this.usingRaster) {
      this.applyStyle(buildVectorStyle(this.theme, { buildings3d: on, labels: this.labels }));
    }
    this.map.easeTo({ pitch: this.tilt, duration: 500 });
  }

  setMode(mode) {
    this.mode = mode;
    this.tilt = mode === 'rotta' && this.buildings3d ? 60 : mode === 'rotta' ? 45 : 0;
    if (mode === 'nord') this.map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
    else if (this.lastFix) this.camera(this.lastFix, this.lastHeading, this.lastSpeed, 600);
  }

  /**
   * Salute del servizio vettoriale.
   * Il segnale giusto è "è arrivato almeno un tile", non
   * isSourceLoaded(): quello resta falso finché ogni tile della
   * vista non è pronto, e su rete lenta farebbe scattare un
   * declassamento a raster con la mappa che stava funzionando.
   */
  watchVectorHealth() {
    clearTimeout(this._healthTimer);
    this.detachHealth();
    if (this.theme === 'satellite') return;
    this.vectorAlive = false;
    let netErrors = 0;

    const onData = (e) => {
      if (e.sourceId === 'omt' && e.tile) this.vectorAlive = true;
    };
    const onError = (e) => {
      const src = e && (e.sourceId || (e.source && e.source.id));
      const msg = String((e && e.error && e.error.message) || '');
      // I glifi che non arrivano non tolgono solo i nomi: fanno
      // fallire il parsing dell'intero tile e lasciano lo schermo
      // vuoto. Alla prima avvisaglia si ridisegna senza etichette.
      if (/glyph|font/i.test(msg)) {
        this.dropLabels();
        return;
      }
      if (src !== 'omt' || this.vectorAlive) return;  // qualche tile vuoto è normale
      if (++netErrors >= 6) this.fallbackToRaster('tile vettoriali non raggiungibili');
    };

    this._health = { onData, onError };
    this.map.on('sourcedata', onData);
    this.map.on('error', onError);

    clearTimeout(this._healthTimer);
    this._healthTimer = setTimeout(() => {
      if (!this.usingRaster && !this.vectorAlive) {
        this.fallbackToRaster('nessuna risposta dal servizio mappe');
      }
    }, 12000);
  }

  /** Sonda i caratteri e allinea lo stile all'esito. */
  async checkGlyphs() {
    const ok = await probeGlyphs();
    writeFlag('argo-drive:labels', ok ? '1' : '0');
    if (ok === this.labels || this.usingRaster || this.theme === 'satellite') return;
    if (ok) {
      this.labels = true;
      this.applyStyle(buildVectorStyle(this.theme, { buildings3d: this.buildings3d, labels: true }));
    } else {
      this.dropLabels();
    }
  }

  /** Mappa muta ma viva: si perdono i nomi, non la strada. */
  dropLabels() {
    if (!this.labels || this.usingRaster || this.theme === 'satellite') return;
    this.labels = false;
    this.applyStyle(buildVectorStyle(this.theme, { buildings3d: this.buildings3d, labels: false }));
    this.onFallback('caratteri non disponibili: mappa senza nomi');
  }

  detachHealth() {
    if (!this._health) return;
    this.map.off('sourcedata', this._health.onData);
    this.map.off('error', this._health.onError);
    this._health = null;
  }

  fallbackToRaster(reason) {
    if (this.usingRaster) return;
    this.usingRaster = true;
    clearTimeout(this._healthTimer);
    this.detachHealth();
    this.applyStyle(buildRasterStyle(this.theme === 'satellite' ? 'giorno' : this.theme));
    this.onFallback(reason);
  }

  /**
   * Cambio stile.
   * `diff: false` è obbligatorio: con il diff MapLibre rimuove in
   * silenzio le sorgenti che non stanno nel nuovo stile — cioè tutti
   * i nostri overlay — e non emette 'style.load', quindi nessuno li
   * rimetterebbe. Con il ricaricamento pieno l'evento arriva e gli
   * overlay tornano al loro posto.
   */
  applyStyle(style) {
    this.map.setStyle(style, { diff: false });
  }

  /* ---------- overlay ---------- */

  installOverlays() {
    const M = this.map;
    const add = (id, data) => {
      if (!M.getSource(id)) M.addSource(id, { type: 'geojson', data });
      else M.getSource(id).setData(data);
    };
    for (const [id, data] of Object.entries(this.overlays)) add(id, data);

    const layer = (spec) => { if (!M.getLayer(spec.id)) M.addLayer(spec); };

    layer({
      id: 'l-zone-fill', type: 'fill', source: 'zone',
      paint: { 'fill-color': COLORS.danger, 'fill-opacity': 0.16 },
    });
    layer({
      id: 'l-zone-bordo', type: 'line', source: 'zone',
      paint: { 'line-color': COLORS.danger, 'line-width': 2, 'line-opacity': 0.85 },
    });
    const scuro = this.theme === 'satellite' || (PALETTES[this.theme] ? PALETTES[this.theme].ui === 'dark' : false);
    layer({
      id: 'l-curati', type: 'fill', source: 'curati',
      paint: { 'fill-color': COLORS.warn, 'fill-opacity': scuro ? 0.05 : 0.1 },
    });
    layer({
      id: 'l-curati-bordo', type: 'line', source: 'curati',
      paint: { 'line-color': COLORS.warn, 'line-width': 1.5, 'line-dasharray': [3, 3], 'line-opacity': 0.7 },
    });
    // Percorso: alternative sotto, tracciato attivo sopra, parte già
    // percorsa spenta. Ordine e spessori sono quelli di un navigatore:
    // la linea deve leggersi con un'occhiata di mezzo secondo.
    layer({
      id: 'l-alt', type: 'line', source: 'percorsiAlt',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.alt, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 9], 'line-opacity': 0.55 },
    });
    layer({
      id: 'l-percorso-bordo', type: 'line', source: 'percorso',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.routeCase, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 18, 20] },
    });
    layer({
      id: 'l-percorso', type: 'line', source: 'percorso',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 18, 14] },
    });
    layer({
      id: 'l-percorso-fatto', type: 'line', source: 'percorsoFatto',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.routeDone, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 18, 14], 'line-opacity': 0.85 },
    });
    layer({
      id: 'l-destinazione', type: 'symbol', source: 'destinazione',
      layout: {
        'icon-image': 'pin-destinazione', 'icon-size': 0.55, 'icon-allow-overlap': true,
        'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
      },
    });
    layer({
      id: 'l-agganciata', type: 'line', source: 'agganciata',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.voltage, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 18, 14], 'line-opacity': 0.5 },
    });
    layer({
      id: 'l-dissestate', type: 'line', source: 'dissestate',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': COLORS.warn, 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.85 },
    });
    layer({
      id: 'l-vietate', type: 'line', source: 'vietate',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': COLORS.danger, 'line-width': 5, 'line-opacity': 0.9 },
    });
    layer({
      id: 'l-precisione', type: 'fill', source: 'precisione',
      paint: { 'fill-color': COLORS.voltage, 'fill-opacity': 0.1 },
    });
    layer({
      id: 'l-scia', type: 'line', source: 'scia',
      paint: { 'line-color': COLORS.trace, 'line-width': 3, 'line-opacity': 0.35 },
    });
    layer({
      id: 'l-punti', type: 'symbol', source: 'punti',
      layout: {
        'icon-image': ['get', 'icon'], 'icon-size': 0.5, 'icon-allow-overlap': true,
        'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
      },
    });
    layer({
      id: 'l-segnalazioni', type: 'symbol', source: 'segnalazioni',
      layout: {
        'icon-image': ['get', 'icon'], 'icon-size': 0.5, 'icon-allow-overlap': true,
        'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
      },
    });

    this.ensureIcons();
    this.applyVisibility();
  }

  /**
   * Un ricaricamento di stile interrompe le animazioni in corso:
   * senza questo, spegnere e riaccendere il 3D lasciava la camera
   * piatta con gli edifici in piedi.
   */
  restoreCamera() {
    if (this.follow && this.lastFix) this.camera(this.lastFix, this.lastHeading, this.lastSpeed, 300);
    else if (Math.round(this.map.getPitch()) !== Math.round(this.tilt)) {
      this.map.easeTo({ pitch: this.tilt, duration: 300 });
    }
  }

  /** Riporta i layer allo stato scelto dall'utente dopo un cambio stile. */
  applyVisibility() {
    for (const name of Object.keys(this.visibility)) this.setLayerVisible(name, this.visibility[name]);
    this.applyPointFilter();
  }

  applyPointFilter() {
    if (!this.map.getLayer('l-punti')) return;
    const allowed = [];
    if (this.pointFilter.cameras) allowed.push('pin-camera');
    if (this.pointFilter.hazards) allowed.push('pin-calming', 'pin-crossing', 'pin-barrier', 'pin-hazard');
    this.map.setFilter('l-punti', allowed.length
      ? ['in', ['get', 'icon'], ['literal', allowed]]
      : ['==', ['get', 'icon'], '__nessuno__']);
  }

  /**
   * Icone disegnate a runtime su canvas: niente sprite da scaricare,
   * niente font con emoji dentro i glyph vettoriali.
   */
  ensureIcons() {
    const dark = this.theme === 'satellite' || (PALETTES[this.theme] ? PALETTES[this.theme].ui === 'dark' : false);
    for (const [key, glyph] of Object.entries(GLYPHS)) {
      const id = `pin-${key}`;
      if (this.map.hasImage(id)) this.map.removeImage(id);
      this.map.addImage(id, this.pinImage(glyph, key, dark), { pixelRatio: 2 });
    }
  }

  pinImage(glyph, key, dark) {
    const size = 88;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const accent = key === 'camera' || key === 'autovelox' || key === 'crossing' || key === 'chiusa' || key === 'incidente'
      ? COLORS.danger
      : key === 'calming' || key === 'barrier' ? COLORS.voltage : COLORS.warn;

    // goccia
    g.beginPath();
    g.moveTo(size / 2, size - 4);
    g.quadraticCurveTo(size / 2 - 30, size - 34, size / 2 - 30, size / 2 - 8);
    g.arc(size / 2, size / 2 - 8, 30, Math.PI, 0);
    g.quadraticCurveTo(size / 2 + 30, size - 34, size / 2, size - 4);
    g.closePath();
    g.fillStyle = dark ? '#12151B' : '#FFFFFF';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = accent;
    g.stroke();

    g.font = '30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, size / 2, size / 2 - 8);

    const data = g.getImageData(0, 0, size, size);
    return { width: size, height: size, data: data.data };
  }

  setSource(id, data) {
    this.overlays[id] = data;
    const src = this.map.getSource(id);
    if (src) src.setData(data);
  }

  /* ---------- puck ---------- */

  installPuck() {
    const el = document.createElement('div');
    el.className = 'puck';
    el.innerHTML = `
      <div class="puck-beam"></div>
      <div class="puck-dot"></div>`;
    this.puckEl = el;
    this.puck = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat([19.8187, 41.3275])
      .addTo(this.map);
  }

  installInteractions() {
    const clickable = ['l-punti', 'l-segnalazioni', 'l-zone-fill', 'l-vietate', 'l-dissestate', 'l-curati'];
    this.map.on('click', (e) => {
      const feats = this.map.queryRenderedFeatures(e.point, { layers: clickable.filter((l) => this.map.getLayer(l)) });
      if (!feats.length) return;
      const f = feats[0];
      const p = f.properties || {};
      new maplibregl.Popup({ closeButton: false, offset: 16, className: 'argo-popup' })
        .setLngLat(f.geometry.type === 'Point' ? f.geometry.coordinates : e.lngLat)
        .setHTML(`<b>${esc(p.titolo || 'Elemento')}</b>${p.dettaglio ? `<br>${esc(p.dettaglio)}` : ''}` +
                 `<br><i>${esc(p.fonte || 'OpenStreetMap')}</i>`)
        .addTo(this.map);
    });

    this.installLongPress();
  }

  /**
   * Pressione prolungata per segnalare un punto.
   * Va agganciata agli eventi del canvas, non a quelli della mappa:
   * in marcia la camera insegue il veicolo ed emette 'move' di
   * continuo, che annullerebbe ogni pressione prima che maturi.
   * Qui conta solo il dito: se si sposta di più di 14 px, si annulla.
   */
  installLongPress() {
    if (!this.onLongPress) return;
    const el = this.map.getCanvasContainer();
    let timer = null;
    let start = null;
    let pointers = 0;

    const pos = (e) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const cancel = () => { clearTimeout(timer); timer = null; start = null; };

    el.addEventListener('pointerdown', (e) => {
      pointers += 1;
      if (pointers > 1) { cancel(); return; }   // pizzicata a due dita: non è una pressione
      start = pos(e);
      timer = setTimeout(() => {
        if (start) this.onLongPress(this.map.unproject([start.x, start.y]));
        cancel();
      }, 600);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const p = pos(e);
      if (Math.hypot(p.x - start.x, p.y - start.y) > 14) cancel();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(ev, () => { pointers = Math.max(0, pointers - 1); cancel(); });
    }
  }

  /* ---------- camera ---------- */

  setFollow(on) {
    if (this.follow === on) return;
    this.follow = on;
    this.onFollowChange(on);
  }

  /** Più corri, più lontano guardi: come fa qualunque navigatore. */
  zoomForSpeed(speedMs) {
    const kmh = (speedMs || 0) * 3.6;
    // Vicino a una manovra si stringe: la svolta si deve vedere.
    if (Number.isFinite(this.manovraVicina) && this.manovraVicina < 180) return kmh < 55 ? 17.6 : 16.8;
    if (kmh < 25) return 17;
    if (kmh < 55) return 16.3;
    if (kmh < 85) return 15.7;
    return 15.2;
  }

  /** Distanza dalla prossima manovra: la usa solo la camera. */
  setManeuverDistance(m) {
    this.manovraVicina = m;
  }

  camera(fix, heading, speedMs, duration = 900) {
    const el = this.map.getContainer();
    const h = el.clientHeight || 800;
    this.map.easeTo({
      center: [fix.lon, fix.lat],
      bearing: this.mode === 'rotta' && Number.isFinite(heading) ? heading : this.map.getBearing(),
      pitch: this.tilt,
      zoom: this.zoomForSpeed(speedMs),
      // In course-up il veicolo sta nel terzo basso e la strada davanti occupa lo schermo.
      padding: this.mode === 'rotta' ? { top: h * 0.42, bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 },
      duration,
      easing: (t) => t,
    });
  }

  updatePosition(fix, heading, speedMs) {
    this.lastFix = fix;
    this.lastHeading = heading;
    this.lastSpeed = speedMs;

    this.puck.setLngLat([fix.lon, fix.lat]);
    if (Number.isFinite(heading)) this.puck.setRotation(heading);
    this.puckEl.classList.toggle('is-moving', (speedMs || 0) > 1.4);

    this.setSource('precisione', {
      type: 'FeatureCollection',
      features: [circleFeature([fix.lat, fix.lon], Math.min(fix.accuracy || 15, 120), {})],
    });

    const last = this.trace[this.trace.length - 1];
    if (!last || Math.abs(last[0] - fix.lon) + Math.abs(last[1] - fix.lat) > 0.00012) {
      this.trace.push([fix.lon, fix.lat]);
      if (this.trace.length > 900) this.trace = this.trace.slice(-900);
      this.setSource('scia', this.trace.length > 1
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.trace } }] }
        : EMPTY);
    }

    if (this.follow) this.camera(fix, heading, speedMs);
  }

  /** In marcia, dopo un po' che non tocchi niente, si torna a inseguire. */
  shouldAutoRecenter(speedMs) {
    return !this.follow && speedMs > 2.8 && Date.now() - this.lastInteraction > this.autoRecenterMs;
  }

  recenter() {
    this.setFollow(true);
    if (this.lastFix) this.camera(this.lastFix, this.lastHeading, this.lastSpeed, 700);
  }

  resetNorth() {
    this.setMode('nord');
  }

  /* ---------- dati ---------- */

  renderData(data) {
    if (!data || data.ts === this.dataStamp) return;
    this.dataStamp = data.ts;

    this.setSource('zone', {
      type: 'FeatureCollection',
      features: data.zones.map((z) => ({
        type: 'Feature',
        properties: {
          titolo: z.kind === 'lez' ? 'Zona a emissioni limitate' : 'Area pedonale',
          dettaglio: z.name || 'Accesso ai veicoli non consentito',
          fonte: 'Fonte: OpenStreetMap',
        },
        geometry: z.closed === false
          ? { type: 'LineString', coordinates: z.ring.map(([la, lo]) => [lo, la]) }
          : { type: 'Polygon', coordinates: [closeRing(z.ring.map(([la, lo]) => [lo, la]))] },
      })),
    });

    const vietate = [];
    const dissestate = [];
    for (const r of data.roads) {
      const feat = {
        type: 'Feature',
        properties: {
          titolo: r.block ? 'Vietata alle auto' : 'Fondo dissestato',
          dettaglio: `${r.name || 'Strada senza nome'} — ${r.block || r.rough}`,
          fonte: 'Fonte: OpenStreetMap',
        },
        geometry: { type: 'LineString', coordinates: r.coords.map(([la, lo]) => [lo, la]) },
      };
      if (r.block) vietate.push(feat);
      else if (r.rough) dissestate.push(feat);
    }
    this.setSource('vietate', { type: 'FeatureCollection', features: vietate });
    this.setSource('dissestate', { type: 'FeatureCollection', features: dissestate });

    this.setSource('punti', {
      type: 'FeatureCollection',
      features: data.points.map((p) => ({
        type: 'Feature',
        properties: { icon: `pin-${p.kind}`, titolo: p.label, fonte: 'Fonte: OpenStreetMap' },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    });
  }

  highlightRoad(road) {
    this.setSource('agganciata', road
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: road.coords.map(([la, lo]) => [lo, la]) } }] }
      : EMPTY);
  }

  renderReports(items, kinds) {
    this.setSource('segnalazioni', {
      type: 'FeatureCollection',
      features: items.map((r) => {
        const meta = kinds.find((k) => k.id === r.kind) || { label: 'Segnalazione' };
        const min = Math.round((Date.now() - r.ts) / 60000);
        return {
          type: 'Feature',
          properties: {
            icon: `pin-${r.kind}`,
            titolo: meta.label,
            dettaglio: r.note || '',
            fonte: min < 60 ? `Segnalata ${min} min fa` : `Segnalata ${Math.round(min / 60)} h fa`,
          },
          geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        };
      }),
    });
  }

  renderCurated(spots) {
    this.setSource('curati', {
      type: 'FeatureCollection',
      features: spots.map((c) => circleFeature([c.lat, c.lon], c.radius, {
        titolo: c.name, dettaglio: c.note, fonte: 'Indicativo — verifica la segnaletica',
      })),
    });
  }

  /* ---------- percorso ---------- */

  /** Disegna il percorso attivo, le alternative e la bandierina. */
  showRoute(route, alternatives = [], destinazione = null) {
    this.setSource('percorso', route ? linea(route.coords) : EMPTY);
    this.setSource('percorsiAlt', {
      type: 'FeatureCollection',
      features: alternatives.map((r) => linea(r.coords).features[0]),
    });
    this.setSource('percorsoFatto', EMPTY);
    this.setSource('destinazione', destinazione
      ? { type: 'FeatureCollection', features: [{
          type: 'Feature',
          properties: { icon: 'pin-destinazione', titolo: destinazione.name || 'Destinazione', dettaglio: destinazione.detail || '', fonte: '' },
          geometry: { type: 'Point', coordinates: [destinazione.lon, destinazione.lat] },
        }] }
      : EMPTY);
    this.route = route;
  }

  /** Spegne la parte di percorso già fatta: si vede quanto manca. */
  updateProgress(alongM) {
    if (!this.route || !Number.isFinite(alongM)) return;
    const { coords, cumulative } = this.route;
    let i = 1;
    while (i < cumulative.length && cumulative[i] < alongM) i++;
    if (i < 2) { this.setSource('percorsoFatto', EMPTY); return; }
    this.setSource('percorsoFatto', linea(coords.slice(0, i)));
  }

  clearRoute() {
    this.route = null;
    for (const id of ['percorso', 'percorsoFatto', 'percorsiAlt', 'destinazione']) this.setSource(id, EMPTY);
  }

  /**
   * Inquadra tutto il percorso nella fascia di schermo libera.
   *
   * Non si usa un margine inferiore grande quanto il pannello: oltre
   * circa metà altezza MapLibre non riesce più a calcolare la camera
   * e restituisce null (verificato: a 420 px su 880 smette). Si
   * inquadra quindi a schermo pieno e poi si sposta la camera in su,
   * riducendo lo zoom in proporzione alla fascia davvero visibile.
   */
  fitRoute(route, opts = {}) {
    if (!route || !route.coords.length) return false;
    let minLat = 90, minLon = 180, maxLat = -90, maxLon = -180;
    for (const [la, lo] of route.coords) {
      if (la < minLat) minLat = la;
      if (la > maxLat) maxLat = la;
      if (lo < minLon) minLon = lo;
      if (lo > maxLon) maxLon = lo;
    }
    const canvas = this.map.getCanvas();
    const h = canvas.clientHeight || 800;
    // Fascia realmente libera: sotto la barra di ricerca, sopra il pannello.
    const cima = Math.max(0, opts.visibleTop || 0);
    const fondo = Math.max(cima + 160, Math.min(opts.visibleBottom || h, h));

    this.setFollow(false);
    this.map.stop();
    // In marcia la camera tiene un margine in alto per mettere il
    // veicolo nel terzo basso: va azzerato, o l'inquadratura del
    // percorso risulta spostata di trecento pixel verso il basso.
    this.map.jumpTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });

    const base = this.map.cameraForBounds(
      [[minLon, minLat], [maxLon, maxLat]],
      { padding: { top: 60, bottom: 60, left: 50, right: 50 } }
    );
    if (!base) return false;

    const utile = Math.max(120, fondo - cima - 44);      // 22 px di aria per lato
    const rapporto = Math.min(1, utile / Math.max(1, h - 120));

    // Prima l'inquadratura giusta al centro dello schermo, poi lo
    // spostamento verso la fascia libera: 'offset' di easeTo non si
    // comporta come ci si aspetta quando si passa anche un centro.
    this.map.jumpTo({ center: base.center, zoom: base.zoom + Math.log2(rapporto), pitch: 0, bearing: 0 });
    this.map.panBy([0, h / 2 - (cima + fondo) / 2], { duration: 600 });
    return true;
  }

  setLayerVisible(name, visible) {
    const groups = {
      zones: ['l-zone-fill', 'l-zone-bordo'],
      roads: ['l-vietate', 'l-dissestate'],
      reports: ['l-segnalazioni'],
      curated: ['l-curati', 'l-curati-bordo'],
    };
    // Autovelox e pericoli vivono nello stesso layer: si filtrano per icona.
    if (name === 'cameras' || name === 'hazards') {
      this.pointFilter[name] = visible;
      this.applyPointFilter();
      return;
    }
    if (!(name in this.visibility)) return;
    this.visibility[name] = visible;
    for (const id of groups[name] || []) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  resize() { this.map.resize(); }
}

/* ---------- helper geometrici ---------- */

const linea = (coords) => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.map(([la, lo]) => [lo, la]) } }],
});

function circleFeature([lat, lon], radiusM, properties) {
  const coords = [];
  for (let a = 0; a <= 360; a += 12) {
    const [la, lo] = destination([lat, lon], a, radiusM);
    coords.push([lo, la]);
  }
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function closeRing(ring) {
  if (ring.length < 3) return ring;
  const [a, b] = [ring[0], ring[ring.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, ring[0]];
}

function readFlag(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeFlag(key, value) {
  try { localStorage.setItem(key, value); } catch { /* navigazione privata */ }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
