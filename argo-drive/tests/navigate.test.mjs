/* ============================================================
   Test della navigazione — ARGO Drive
     node tests/navigate.test.mjs
   Ricerca finta (Photon), percorso finto (OSRM), veicolo simulato:
   verifica ricerca, anteprima, avvio, indicazioni vocali, avanzamento,
   ricalcolo dopo una deviazione e arrivo.
   ============================================================ */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { tile, TILEJSON } from './fixtures/tileserver.mjs';
import { check, near, finish } from './assert.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = 4190;
const BASE = `http://localhost:${PORT}`;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const m = url.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
  if (m) {
    const buf = tile(+m[1], +m[2], +m[3]);
    if (!buf) { res.writeHead(204); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/x-protobuf' });
    res.end(buf);
    return;
  }
  const f = path.join(ROOT, url === '/' ? '/index.html' : url);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

/* ---------- percorso finto: 900 m a est, svolta a destra, 600 m a sud ---------- */
const START = [41.3275, 19.8100];
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
function dest([lat, lon], brg, m) {
  const d = m / R, b = rad(brg), la1 = rad(lat), lo1 = rad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [deg(la2), ((deg(lo2) + 540) % 360) - 180];
}
const svolta = dest(START, 90, 900);
const fine = dest(svolta, 180, 600);
const geometria = [];
for (let m = 0; m <= 900; m += 25) geometria.push(dest(START, 90, m));
for (let m = 25; m <= 600; m += 25) geometria.push(dest(svolta, 180, m));

const geometriaLunga = [];
for (let m = 0; m <= 600; m += 25) geometriaLunga.push(dest(START, 60, m));
for (let m = 25; m <= 900; m += 25) geometriaLunga.push(dest(dest(START, 60, 600), 150, m));

const osrm = {
  code: 'Ok',
  waypoints: [],
  routes: [{
    distance: 1500, duration: 150,
    geometry: { type: 'LineString', coordinates: geometria.map(([la, lo]) => [lo, la]) },
    legs: [{
      distance: 1500, duration: 150, summary: 'Rruga e Kavajës, Rruga e Malit',
      steps: [
        { name: 'Rruga e Kavajës', distance: 900, duration: 90, maneuver: { type: 'depart', location: [START[1], START[0]] } },
        { name: 'Rruga e Malit', distance: 600, duration: 60, maneuver: { type: 'turn', modifier: 'right', location: [svolta[1], svolta[0]] } },
        { name: '', distance: 0, duration: 0, maneuver: { type: 'arrive', modifier: 'right', location: [fine[1], fine[0]] } },
      ],
    }],
  }, {
    distance: 1900, duration: 210,
    geometry: { type: 'LineString', coordinates: geometriaLunga.map(([la, lo]) => [lo, la]) },
    legs: [{
      distance: 1900, duration: 210, summary: 'Unaza',
      steps: [
        { name: 'Unaza', distance: 600, duration: 70, maneuver: { type: 'depart', location: [START[1], START[0]] } },
        { name: 'Rruga e Malit', distance: 1300, duration: 140, maneuver: { type: 'turn', modifier: 'right', location: [geometriaLunga[24][1], geometriaLunga[24][0]] } },
        { name: '', distance: 0, duration: 0, maneuver: { type: 'arrive', location: [fine[1], fine[0]] } },
      ],
    }],
  }],
};

const photon = {
  features: [{
    geometry: { coordinates: [fine[1], fine[0]] },
    properties: { osm_id: 42, osm_type: 'N', name: 'Farmacia Qendra', street: 'Rruga e Malit', city: 'Tiranë', country: 'Albania' },
  }],
};

const overpass = { elements: [
  { type: 'way', id: 1, tags: { highway: 'primary', name: 'Rruga e Kavajës', maxspeed: '50' },
    geometry: geometria.slice(0, 37).map(([lat, lon]) => ({ lat, lon })) },
] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({
  viewport: { width: 414, height: 880 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'it-IT', permissions: ['geolocation'], geolocation: { latitude: START[0], longitude: START[1], accuracy: 6 },
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

let richiesteOsrm = 0;
await ctx.route('**/api/interpreter', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overpass) }));
await ctx.route('https://tiles.openfreemap.org/planet', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TILEJSON(BASE)) }));
await ctx.route('https://tiles.openfreemap.org/fonts/**', (r) => r.fulfill({ status: 404, body: '' }));
await ctx.route('https://photon.komoot.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photon) }));
await ctx.route('**/route/v1/driving/**', (r) => {
  richiesteOsrm += 1;
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(osrm) });
});

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => { window.SAID = []; window.speechSynthesis.speak = (u) => { if (u.text.trim()) window.SAID.push(u.text); }; });
await page.click('#btn-start');
await page.waitForTimeout(2500);

/* 1 — ricerca */
console.log('1) ricerca della destinazione');
await page.click('#btn-search');
await page.waitForTimeout(400);
check('la ricerca apre il pannello', await page.evaluate(() => document.querySelector('.panel[data-panel="cerca"]').classList.contains('is-on')));
await page.fill('#search-input', 'farmacia');
await page.waitForTimeout(1200);
const risultati = await page.evaluate(() => [...document.querySelectorAll('#search-results li')].map((li) => li.textContent.trim()));
check('mostra i risultati del geocoder', risultati.length === 1 && risultati[0].includes('Farmacia Qendra'), risultati);

/* 2 — anteprima del percorso */
console.log('\n2) anteprima del percorso');
await page.click('#search-results li');
await page.waitForTimeout(1500);
const anteprima = await page.evaluate(() => ({
  pannello: document.querySelector('.panel[data-panel="percorso"]').classList.contains('is-on'),
  tempo: document.querySelector('#route-time').textContent,
  meta: document.querySelector('#route-meta').textContent,
  dest: document.querySelector('#route-dest').textContent,
  passi: document.querySelectorAll('#route-steps li').length,
  layerPercorso: !!window.ARGO_DRIVE.map().map.getLayer('l-percorso'),
  puntiPercorso: window.ARGO_DRIVE.map().map.getSource('percorso')._data.features.length,
}));
check('si apre l\'anteprima del percorso', anteprima.pannello === true);
check('mostra durata, distanza e orario', anteprima.tempo.includes('min') && anteprima.meta.includes('km') && anteprima.meta.includes('arrivo'), anteprima);
check('mostra la destinazione scelta', anteprima.dest.includes('Farmacia Qendra'), anteprima.dest);
check('elenca le indicazioni', anteprima.passi === 2, anteprima.passi);
check('disegna il percorso sulla mappa', anteprima.layerPercorso && anteprima.puntiPercorso === 1, anteprima);
const resa = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  return {
    rese: m.queryRenderedFeatures({ layers: ['l-percorso'] }).length,
    visibile: m.getLayoutProperty('l-percorso', 'visibility') || 'visible',
    ordine: m.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('l-')),
    zoom: +m.getZoom().toFixed(1),
  };
});
check('la linea del percorso è visibile sullo schermo', resa.rese > 0, resa);
const inquadratura = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  const r = window.ARGO_DRIVE.state.nav.route;
  const ys = r.coords.map((c) => m.project([c[1], c[0]]).y);
  const cima = document.querySelector('#sheet').getBoundingClientRect().top;
  return { alto: Math.round(Math.min(...ys)), basso: Math.round(Math.max(...ys)), cima: Math.round(cima) };
});
check('il percorso è inquadrato nella fascia libera, non dietro al pannello',
  inquadratura.alto > 100 && inquadratura.basso < inquadratura.cima, inquadratura);
// prova diretta: rifaccio l'inquadratura e guardo se la camera si muove

/* 3 — navigazione */
console.log('\n3) navigazione svolta per svolta');
const scelte = await page.evaluate(() => [...document.querySelectorAll('.route-alt')].map((b) => b.textContent.trim()));
check('propone i percorsi alternativi', scelte.length === 2 && scelte[0].includes('Più rapido') && scelte[1].includes('Alternativa'), scelte);
await page.evaluate(() => document.querySelectorAll('.route-alt')[1].click());
await page.waitForTimeout(800);
const dopoScelta = await page.evaluate(() => ({
  tempo: document.querySelector('#route-time').textContent,
  attivo: [...document.querySelectorAll('.route-alt')].findIndex((b) => b.classList.contains('is-on')),
  distanza: Math.round(window.ARGO_DRIVE.state.nav.route.distance),
}));
check('scegliendo l\'alternativa cambia il percorso attivo',
  dopoScelta.attivo === 1 && dopoScelta.distanza === 1900, dopoScelta);
await page.evaluate(() => document.querySelectorAll('.route-alt')[0].click());
await page.waitForTimeout(800);
check('si può tornare al percorso più rapido',
  (await page.evaluate(() => Math.round(window.ARGO_DRIVE.state.nav.route.distance))) === 1500);

await page.evaluate(() => document.querySelector('#btn-fav').click());
await page.waitForTimeout(300);
check('il luogo si salva nei preferiti',
  (await page.evaluate(() => JSON.parse(localStorage.getItem('argo-drive:preferiti:v1') || '[]'))).some((p) => p.name === 'Farmacia Qendra'));

await page.screenshot({ path: '/tmp/nav-anteprima.png' });
await page.click('#btn-go');
await page.waitForTimeout(600);
check('entra in modalità navigazione', await page.evaluate(() => !document.querySelector('#maneuver').hidden && document.querySelector('#btn-search').hidden));

for (let m = 40; m <= 880; m += 40) {   // ~14 m/s lungo il primo tratto
  await ctx.setGeolocation({ latitude: dest(START, 90, m)[0], longitude: dest(START, 90, m)[1], accuracy: 6 });
  await page.waitForTimeout(1000);
}
const inMarcia = await page.evaluate(() => ({
  manovra: document.querySelector('#man-street').textContent,
  distanza: document.querySelector('#man-dist').textContent,
  icona: document.querySelector('#man-icon').textContent,
  eta: document.querySelector('#eta-time').textContent,
  resto: document.querySelector('#eta-rest').textContent,
  fatto: window.ARGO_DRIVE.map().map.getSource('percorsoFatto')._data.features.length,
}));
check('la scheda manovra indica la svolta', inMarcia.manovra.includes('Gira a destra') && inMarcia.icona === '↱', inMarcia);
check('la distanza alla manovra è credibile', /^\d+ m$/.test(inMarcia.distanza), inMarcia.distanza);
check('la barra mostra orario e distanza residua', /^\d{1,2}:\d{2}$/.test(inMarcia.eta) && inMarcia.resto.includes('m'), inMarcia);
check('la barra dell\'arrivo è davvero visibile',
  await page.evaluate(() => { const r = document.querySelector('#etabar').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight + 1; }));
check('in navigazione resta una sola allerta a schermo',
  await page.evaluate(() => document.querySelectorAll('#alert-stack .alert').length <= 1));
check('la parte percorsa viene spenta sulla mappa', inMarcia.fatto === 1, inMarcia.fatto);

await page.screenshot({ path: '/tmp/nav-marcia.png' });
const dette = await page.evaluate(() => window.SAID);
check('annuncia la manovra in anticipo', dette.some((d) => /Tra 500 metri, gira a destra/i.test(d)), dette);
check('annuncia la manovra imminente', dette.some((d) => /^Gira a destra/i.test(d)), dette);

/* 4 — deviazione e ricalcolo */
console.log('\n4) deviazione e ricalcolo');
const prima = richiesteOsrm;
for (let i = 1; i <= 6; i++) {
  const p = dest(dest(START, 90, 880), 0, 60 + i * 30);   // si allontana verso nord
  await ctx.setGeolocation({ latitude: p[0], longitude: p[1], accuracy: 6 });
  await page.waitForTimeout(1000);
}
check('si accorge di essere fuori percorso', (await page.evaluate(() => window.SAID)).some((d) => /Fuori percorso/i.test(d)));
check('richiede un nuovo percorso', richiesteOsrm > prima, { prima, dopo: richiesteOsrm });
check('lo dice a voce una volta sola',
  (await page.evaluate(() => window.SAID)).filter((d) => /Fuori percorso/i.test(d)).length === 1);

/* 5 — arrivo */
console.log('\n5) arrivo');
await page.evaluate(() => { window.ARGO_DRIVE.guidance.needsReroute = false; });
await ctx.setGeolocation({ latitude: fine[0], longitude: fine[1], accuracy: 6 });
await page.waitForTimeout(2500);
const arrivo = await page.evaluate(() => ({
  detto: window.SAID.some((d) => /Sei arrivato/i.test(d)),
  navigazioneFinita: document.querySelector('#maneuver').hidden && !document.querySelector('#btn-search').hidden,
  percorsoPulito: window.ARGO_DRIVE.map().map.getSource('percorso')._data.features.length === 0,
}));
check('annuncia l\'arrivo', arrivo.detto === true);
check('esce dalla navigazione', arrivo.navigazioneFinita === true, arrivo);
check('pulisce il percorso dalla mappa', arrivo.percorsoPulito === true, arrivo);

/* 6 — ricerca per categoria */
console.log('\n6) ricerca per categoria');
await page.evaluate(() => { window.ARGO_DRIVE.ui.setSheet('full'); window.ARGO_DRIVE.ui.showPanel('cerca'); });
await ctx.route('**/api/interpreter', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [
  { type: 'node', id: 5, lat: fine[0], lon: fine[1], tags: { name: 'Kastrati', amenity: 'fuel' } },
] }) }));
await page.evaluate(() => document.querySelector('.cat[data-cat="benzina"]').click());
await page.waitForTimeout(1500);
const benzina = await page.evaluate(() => [...document.querySelectorAll('#search-results li')].map((li) => li.textContent.trim()));
check('trova i distributori vicini', benzina.length === 1 && benzina[0].includes('Kastrati'), benzina);

check('nessun errore di pagina', pageErrors.length === 0, pageErrors);
await page.screenshot({ path: '/tmp/nav-fine.png' });
await browser.close();
server.close();
finish('navigate.test.mjs');
