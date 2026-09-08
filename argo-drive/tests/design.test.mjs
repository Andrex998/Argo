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
import { check, near, finish } from './assert.mjs';

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

// Il tema "auto" segue l'ora: per non dipendere dall'orologio della
// macchina che esegue i test, qui si fissa il giorno.
check('il tema automatico segue l\'ora', await page.evaluate(() => {
  const r = window.ARGO_DRIVE.ui.resolveTheme;
  return r('auto', new Date(2026, 0, 1, 10)) === 'giorno' && r('auto', new Date(2026, 0, 1, 22)) === 'notte';
}));
await page.evaluate(() => { window.ARGO_DRIVE.ui.setSheet('full'); window.ARGO_DRIVE.ui.showPanel('livelli'); });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#theme-seg button[data-theme="giorno"]').click());
await page.evaluate(() => window.ARGO_DRIVE.ui.setSheet('peek'));
await page.waitForTimeout(1500);
check('il tema giorno è attivo prima degli scatti',
  (await page.evaluate(() => window.ARGO_DRIVE.map().map.getPaintProperty('sfondo', 'background-color'))) === '#EEF0F4');

const style = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  const s = m.getStyle();
  return { layers: s.layers.length, sources: Object.keys(s.sources), sorgenteCaricata: m.isSourceLoaded('omt') };
});
console.log('1) stile vettoriale');
check('lo stile ha i layer della mappa e gli overlay', style.layers > 25, style.layers);
check('la sorgente vettoriale è quella giusta', style.sources.includes('omt'), style.sources);
check('i tile vettoriali arrivano davvero', style.sorgenteCaricata === true);
check('nessun declassamento a raster', !style.sources.includes('base'), style.sources);

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
console.log('\n2) camera e scheda di guida');
check('la mappa ruota verso la marcia (est ≈ 90°)', near(cam.bearing, 90, 6), cam.bearing);
check('la camera è inclinata come un navigatore', near(cam.pitch, 60, 2), cam.pitch);
check('lo zoom si allarga con la velocità', cam.zoom > 15 && cam.zoom < 16.5, cam.zoom);
check('la camera insegue il veicolo', cam.follow === true);

const hud = await page.evaluate(() => ({
  velocita: +document.querySelector('#speed-value').textContent,
  limite: document.querySelector('#limit-value').textContent,
  statoLimite: document.querySelector('#limit-disc').dataset.state,
  strada: document.querySelector('#road-name').textContent,
  statoVelocita: document.querySelector('#speedo').dataset.state,
  allerte: [...document.querySelectorAll('.alert .a-title')].map((e) => e.textContent),
  bussolaNascosta: document.querySelector('#btn-compass').hidden,
  bussolaVisibile: getComputedStyle(document.querySelector('#btn-compass')).display !== 'none',
}));
check('il tachimetro mostra la velocità reale', near(hud.velocita, 66, 12), hud.velocita);
check('il limite letto da OSM è 40', hud.limite === '40' && hud.statoLimite === 'known', hud);
check('la strada agganciata è quella percorsa', hud.strada.includes('Kavajës'), hud.strada);
check('il superamento del limite è segnalato', hud.statoVelocita === 'over' && hud.allerte.some((a) => a.includes('km/h sul limite')), hud.allerte);
check('la bussola compare quando la mappa è ruotata', hud.bussolaNascosta === false && hud.bussolaVisibile);
await page.screenshot({ path: '/tmp/design-giorno.png' });

// pannello: trascinamento
const box = await page.locator('#grabber').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 5);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y - 260, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(500);
await page.evaluate(() => window.ARGO_DRIVE.ui.showPanel('vicino'));
await page.waitForTimeout(400);
console.log('\n3) pannello trascinabile');
const sheet = await page.evaluate(() => ({
  stato: document.querySelector('#sheet').dataset.state,
  vicine: document.querySelectorAll('#nearby li').length,
  vuoto: !!document.querySelector('#nearby .nearby-empty'),
}));
check('il trascinamento apre il pannello', sheet.stato === 'half', sheet.stato);
check('l\'elenco "vicino a te" è popolato', sheet.vicine > 0 && !sheet.vuoto, sheet);
await page.screenshot({ path: '/tmp/design-sheet.png' });

// tema notte + 3D off/on — il pannello va aperto davvero, altrimenti i
// click finiscono sulle coordinate di elementi fuori schermo.
await page.evaluate(() => { window.ARGO_DRIVE.ui.setSheet('full'); window.ARGO_DRIVE.ui.showPanel('livelli'); });
await page.waitForTimeout(500);
await page.click('#theme-seg button[data-theme="notte"]');
await page.waitForTimeout(1800);
console.log('\n4) tema notte e sopravvivenza degli overlay');
// prima spengo un livello: deve restare spento anche dopo il cambio stile
await page.evaluate(() => document.querySelector('input[data-layer="curated"]').click());
await page.evaluate(() => document.querySelector('#theme-seg button[data-theme="notte"]').click());
await page.waitForTimeout(2000);
const notte = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  return {
    chrome: document.documentElement.dataset.theme,
    sfondo: m.getPaintProperty('sfondo', 'background-color'),
    curatiSpenti: m.getLayoutProperty('l-curati', 'visibility') === 'none',
  };
});
check('il chrome passa al tema scuro', notte.chrome === 'dark', notte.chrome);
check('la mappa usa la palette notturna', notte.sfondo === '#0E1015', notte.sfondo);
check('i livelli spenti restano spenti dopo il cambio stile', notte.curatiSpenti === true);
const overlay = await page.evaluate(() => {
  const m = window.ARGO_DRIVE.map().map;
  const conta = (id) => { const s = m.getSource(id); return s && s._data ? (s._data.features || []).length : 'assente'; };
  return {
    layerZone: !!m.getLayer('l-zone-fill'), layerAgganciata: !!m.getLayer('l-agganciata'), layerPunti: !!m.getLayer('l-punti'),
    datiZone: conta('zone'), datiPunti: conta('punti'), datiAgganciata: conta('agganciata'), datiCurati: conta('curati'),
    reseZone: m.queryRenderedFeatures({ layers: ['l-zone-fill'] }).length,
    resePunti: m.queryRenderedFeatures({ layers: ['l-punti'] }).length,
    iconaPresente: m.hasImage('pin-camera'),
  };
});
check('i layer degli overlay sono stati reinstallati', overlay.layerZone && overlay.layerAgganciata && overlay.layerPunti, overlay);
check('i dati degli overlay sono sopravvissuti', overlay.datiZone > 0 && overlay.datiPunti > 0 && overlay.datiAgganciata > 0, overlay);
check('zone e punti sono di nuovo disegnati', overlay.reseZone > 0 && overlay.resePunti > 0, overlay);
check('le icone dei pin sono ricreate', overlay.iconaPresente === true);
await page.evaluate(() => document.querySelector('input[data-layer="curated"]').click());   // riaccendo
await page.evaluate(() => window.ARGO_DRIVE.ui.setSheet('peek'));
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/design-notte.png' });

await page.evaluate(() => document.querySelector('#btn-3d').click());
await page.waitForFunction(() => Math.round(window.ARGO_DRIVE.map().map.getPitch()) === 0, null, { timeout: 8000 }).catch(() => {});
check('la modalità di marcia non è cambiata da sola', await page.evaluate(() => window.ARGO_DRIVE.state.settings.mode) === 'rotta');
await page.evaluate(() => {
  const d = window.ARGO_DRIVE.map();
  window.__MODI = [];
  const orig = d.setMode.bind(d);
  d.setMode = (m) => { window.__MODI.push({ m, stack: new Error().stack.split('\n').slice(1, 5).join(' | ') }); return orig(m); };
});
console.log('\n5) vista 3D');
const senza3d = await page.evaluate(() => ({
  pitch: Math.round(window.ARGO_DRIVE.map().map.getPitch()),
  layer: !!window.ARGO_DRIVE.map().map.getLayer('edifici-3d'),
}));
check('spegnendo il 3D la mappa torna piatta', senza3d.pitch === 0 && senza3d.layer === false, senza3d);
await page.evaluate(() => document.querySelector('#btn-3d').click());
await page.waitForFunction(() => Math.round(window.ARGO_DRIVE.map().map.getPitch()) === 60, null, { timeout: 8000 }).catch(() => {});
const con3d = await page.evaluate(() => {
  const d = window.ARGO_DRIVE.map();
  return { pitch: Math.round(d.map.getPitch()), layer: !!d.map.getLayer('edifici-3d'), tilt: d.tilt, mode: d.mode };
});
check('riaccendendo il 3D tornano volume e inclinazione', con3d.pitch === 60 && con3d.layer === true, con3d);

// bussola: passaggio a nord in alto (che azzera l'inclinazione di proposito)
console.log('\n6) bussola');
await page.evaluate(() => document.querySelector('#btn-compass').click());
await page.waitForFunction(() => Math.round(window.ARGO_DRIVE.map().map.getBearing()) === 0, null, { timeout: 8000 }).catch(() => {});
const bussola = await page.evaluate(() => ({
  rotta: Math.round(window.ARGO_DRIVE.map().map.getBearing()),
  pitch: Math.round(window.ARGO_DRIVE.map().map.getPitch()),
  modo: window.ARGO_DRIVE.state.settings.mode,
  nascosta: document.querySelector('#btn-compass').hidden,
}));
check('la bussola riporta il nord in alto', bussola.rotta === 0 && bussola.modo === 'nord', bussola);
check('con il nord in alto la mappa si raddrizza', bussola.pitch === 0, bussola);
check('a nord la bussola si nasconde', bussola.nascosta === true);

console.log('\n7) pressione prolungata con la camera che insegue');
await page.evaluate(() => { window.ARGO_DRIVE.map().setFollow(true); window.ARGO_DRIVE.ui.setSheet('peek'); });
await ctx.setGeolocation({ latitude: 41.3275, longitude: 19.8100, accuracy: 6 });
await page.waitForTimeout(1200);
await page.mouse.move(207, 300);
await page.mouse.down();
await page.waitForTimeout(900);   // durante l'attesa la camera continua a inseguire
await page.mouse.up();
await page.waitForTimeout(400);
const pressione = await page.evaluate(() => ({
  pannello: document.querySelector('.panel[data-panel="cerca"]').classList.contains('is-on'),
  punto: !!window.ARGO_DRIVE.state.pendingLngLat,
  risultati: document.querySelectorAll('#search-results li').length,
}));
check('la pressione prolungata sceglie un punto anche in marcia',
  pressione.pannello && pressione.punto && pressione.risultati === 1, pressione);

console.log('\n8) tema satellite');
await page.evaluate(() => { window.ARGO_DRIVE.ui.setSheet('full'); window.ARGO_DRIVE.ui.showPanel('livelli'); });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#theme-seg button[data-theme="satellite"]').click());
await page.waitForTimeout(1500);
const sat = await page.evaluate(() => ({
  sorgenti: Object.keys(window.ARGO_DRIVE.map().map.getStyle().sources),
  salvato: JSON.parse(localStorage.getItem('argo-drive:settings:v2')).theme,
}));
check('il satellite carica la sua sorgente', sat.sorgenti.includes('sat'), sat.sorgenti);
check('la scelta satellite viene salvata', sat.salvato === 'satellite', sat.salvato);
await page.waitForTimeout(13000);   // oltre il timer di salute: non deve rimpiazzare il satellite
const satDopo = await page.evaluate(() => Object.keys(window.ARGO_DRIVE.map().map.getStyle().sources));
check('il satellite sopravvive al guardiano del vettoriale', satDopo.includes('sat') && !satDopo.includes('base'), satDopo);

await page.reload({ waitUntil: 'networkidle' });
await page.click('#btn-start');
await page.waitForTimeout(2500);
const satRicarica = await page.evaluate(() => Object.keys(window.ARGO_DRIVE.map().map.getStyle().sources));
check('il satellite viene ripristinato al riavvio', satRicarica.includes('sat'), satRicarica);

console.log('\n9) inseguimento e gesti');
await page.evaluate(() => { window.ARGO_DRIVE.map().autoRecenterMs = 1500; });
// il veicolo riparte: servono un paio di posizioni per avere velocità
for (let i = 1; i <= 3; i++) {
  await ctx.setGeolocation({ latitude: 41.3275, longitude: 19.8100 + i * 0.00022, accuracy: 6 });
  await page.waitForTimeout(1000);
}
await page.evaluate(() => window.ARGO_DRIVE.map().map.fire('rotatestart'));
check('la rotazione della mappa sospende l\'inseguimento',
  (await page.evaluate(() => window.ARGO_DRIVE.map().follow)) === false);
for (let i = 4; i <= 8; i++) {
  await ctx.setGeolocation({ latitude: 41.3275, longitude: 19.8100 + i * 0.00022, accuracy: 6 });
  await page.waitForTimeout(1000);
}
check('in marcia la mappa torna da sola sul veicolo',
  (await page.evaluate(() => window.ARGO_DRIVE.map().follow)) === true);

const errori = await page.evaluate(() => (window.__ERRS || []).filter((e) => !/font|glyph|204/i.test(e)));
console.log('\nfrasi pronunciate:', await page.evaluate(() => window.SAID || []));
check('nessun errore MapLibre', errori.length === 0, errori);
check('nessun errore di pagina', pageErrors.length === 0, pageErrors);

await browser.close();
server.close();
finish('design.test.mjs');
