/* ============================================================
   Test visivo e funzionale del motore mappa — ARGO Drive
     npm i -D playwright geojson-vt vt-pbf && node tests/design.test.mjs
   Serve l'app con tile vettoriali sintetiche locali: verifica che
   lo stile sia valido, che la camera segua la rotta, che i temi
   giorno/notte reggano e produce gli screenshot in /tmp.
   ============================================================ */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { tile, TILEJSON } from './fixtures/tileserver.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = 4180;
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
  const p = url === '/' ? '/index.html' : url;
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const overpass = { elements: [
  { type: 'way', id: 1, tags: { highway: 'primary', name: 'Rruga e Kavajës', maxspeed: '40' },
    geometry: Array.from({ length: 40 }, (_, i) => ({ lat: 41.3275, lon: 19.8007 + i * 0.0009 })) },
  { type: 'way', id: 2, tags: { highway: 'residential', name: 'Rruga Ded Gjo Luli', motor_vehicle: 'no' },
    geometry: [{ lat: 41.3278, lon: 19.8165 }, { lat: 41.3300, lon: 19.8165 }] },
  { type: 'way', id: 3, tags: { highway: 'track', surface: 'gravel', name: 'Rruga e Malit' },
    geometry: [{ lat: 41.3258, lon: 19.8150 }, { lat: 41.3240, lon: 19.8200 }] },
  { type: 'way', id: 4, tags: { highway: 'pedestrian', area: 'yes', name: 'Sheshi Skënderbej' },
    geometry: [{ lat: 41.3286, lon: 19.8180 }, { lat: 41.3296, lon: 19.8180 },
               { lat: 41.3296, lon: 19.8203 }, { lat: 41.3286, lon: 19.8203 }, { lat: 41.3286, lon: 19.8180 }] },
  { type: 'node', id: 10, lat: 41.3275, lon: 19.8215, tags: { highway: 'speed_camera' } },
  { type: 'node', id: 11, lat: 41.3275, lon: 19.8196, tags: { traffic_calming: 'bump' } },
  { type: 'node', id: 12, lat: 41.3276, lon: 19.8245, tags: { railway: 'level_crossing' } },
] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({
  viewport: { width: 414, height: 880 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'it-IT', permissions: ['geolocation'],
  geolocation: { latitude: 41.3275, longitude: 19.8060, accuracy: 6 },
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await ctx.route('**/api/interpreter', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overpass) }));
await ctx.route('https://tiles.openfreemap.org/planet', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TILEJSON(BASE)) }));
await ctx.route('https://tiles.openfreemap.org/fonts/**', (r) => r.fulfill({ status: 404, body: '' }));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.__ERRS = [];
  window.SAID = [];
  window.speechSynthesis.speak = (u) => { if (u.text.trim()) window.SAID.push(u.text); };
  const m = window.ARGO_DRIVE.map().map;
  m.on('error', (e) => window.__ERRS.push(String((e && e.error && e.error.message) || e)));
});
await page.click('#btn-start');
await page.waitForFunction(() => window.ARGO_DRIVE.map().map.isStyleLoaded(), null, { timeout: 15000 });

const style = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  const s = m.getStyle();
  return { layers: s.layers.length, sources: Object.keys(s.sources), sorgenteCaricata: m.isSourceLoaded('omt') };
});
console.log('1) stile caricato →', style.layers, 'layer, sorgenti:', style.sources.join(','), '| tile vettoriali:', style.sorgenteCaricata);

// marcia verso est
for (let i = 1; i <= 16; i++) {
  await ctx.setGeolocation({ latitude: 41.3275, longitude: 19.8060 + i * 0.00022, accuracy: 6 });
  await page.waitForTimeout(1000);
}
const cam = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  return { bearing: Math.round(m.getBearing()), pitch: Math.round(m.getPitch()), zoom: +m.getZoom().toFixed(1),
           follow: window.ARGO_DRIVE.map().follow };
});
console.log('2) camera in marcia → rotta', cam.bearing + '°, inclinazione', cam.pitch + '°, zoom', cam.zoom, '| insegue:', cam.follow);
console.log('   HUD →', await page.evaluate(() => ({
  velocita: document.querySelector('#speed-value').textContent,
  limite: document.querySelector('#limit-value').textContent,
  statoLimite: document.querySelector('#limit-disc').dataset.state,
  strada: document.querySelector('#road-name').textContent,
  meta: document.querySelector('#road-meta').textContent,
  allerte: [...document.querySelectorAll('.alert .a-title')].map((e) => e.textContent),
})));
await page.screenshot({ path: '/tmp/design-giorno.png' });

// pannello: trascinamento
const box = await page.locator('#grabber').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 5);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y - 260, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
console.log('3) pannello dopo trascinamento →', await page.evaluate(() => document.querySelector('#sheet').dataset.state),
            '| voci vicine:', await page.evaluate(() => document.querySelectorAll('#nearby li').length));
await page.screenshot({ path: '/tmp/design-sheet.png' });

// tema notte + 3D off/on
await page.click('.tab[data-panel="livelli"]');
await page.click('#theme-seg button[data-theme="notte"]');
await page.waitForTimeout(1800);
console.log('4) tema notte → chrome:', await page.evaluate(() => document.documentElement.dataset.theme),
            '| sfondo mappa:', await page.evaluate(() => window.ARGO_DRIVE.map().map.getPaintProperty('sfondo', 'background-color')));
console.log('   overlay dopo il cambio stile →', await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  const conta = (id) => { const s = m.getSource(id); return s && s._data ? (s._data.features || []).length : 'assente'; };
  return {
    layerZone: !!m.getLayer('l-zone-fill'), layerAgganciata: !!m.getLayer('l-agganciata'), layerPunti: !!m.getLayer('l-punti'),
    datiZone: conta('zone'), datiPunti: conta('punti'), datiAgganciata: conta('agganciata'), datiCurati: conta('curati'),
    reseZone: m.queryRenderedFeatures({ layers: ['l-zone-fill'] }).length,
    resePunti: m.queryRenderedFeatures({ layers: ['l-punti'] }).length,
    iconaPresente: m.hasImage('pin-camera'),
  };
}));
await page.evaluate(() => window.ARGO_DRIVE.ui.setSheet('peek'));
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/design-notte.png' });

await page.evaluate(() => document.querySelector('#btn-3d').click());
await page.waitForTimeout(1200);
console.log('5) 3D disattivato → inclinazione', await page.evaluate(() => Math.round(window.ARGO_DRIVE.map().map.getPitch())),
            '| layer edifici-3d presente:', await page.evaluate(() => !!window.ARGO_DRIVE.map().map.getLayer('edifici-3d')));
await page.evaluate(() => document.querySelector('#btn-3d').click());
await page.waitForTimeout(1200);

// bussola: passaggio a nord in alto
await page.evaluate(() => document.querySelector('#btn-compass').click());
await page.waitForTimeout(1000);
console.log('6) bussola → rotta', await page.evaluate(() => Math.round(window.ARGO_DRIVE.map().map.getBearing())),
            '| modalità:', await page.evaluate(() => window.ARGO_DRIVE.state.settings.mode));

console.log('\nfrasi pronunciate:', await page.evaluate(() => window.SAID));
console.log('errori MapLibre:', await page.evaluate(() => window.__ERRS.filter((e) => !/font|glyph|204/i.test(e))));
console.log('pageerror:', pageErrors.length ? pageErrors : 'nessuno');

await browser.close();
server.close();
