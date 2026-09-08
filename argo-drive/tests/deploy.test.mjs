/* ============================================================
   Test di pubblicazione — ARGO Drive
     node tests/deploy.test.mjs
   Serve l'app sotto un sottopercorso, come fa GitHub Pages, e
   verifica che tutto si risolva: guscio, manifest, icone, service
   worker, avvio. Un file mancante nella lista di precache qui si
   vede subito, invece che in Albania senza campo.
   ============================================================ */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { check, finish } from './assert.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = 4195;
const PREFIX = '/Argo';                      // com'è su https://utente.github.io/Argo/
const BASE = `http://localhost:${PORT}${PREFIX}/`;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const chieste = new Set();
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(`${PREFIX}/`)) { res.writeHead(404); res.end(); return; }
  const rel = url.slice(PREFIX.length) === '/' ? '/index.html' : url.slice(PREFIX.length);
  const f = path.join(ROOT, rel);
  chieste.add(rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('non trovato'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

/* 1 — tutti i file del precache esistono davvero */
console.log('1) guscio dell’app');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const elencati = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((f) => f && !f.endsWith('/'));
const mancanti = elencati.filter((f) => !fs.existsSync(path.join(ROOT, f)));
check('ogni file del precache esiste', mancanti.length === 0, mancanti);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const icone = manifest.icons.map((i) => i.src).filter((s) => !fs.existsSync(path.join(ROOT, s)));
check('ogni icona del manifest esiste', icone.length === 0, icone);
check('c’è un’icona PNG per la schermata Home',
  manifest.icons.some((i) => i.type === 'image/png' && i.sizes === '192x192'));
check('l’icona di iOS è un PNG',
  fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('apple-touch-icon.png'));

/* 2 — l'app parte servita da un sottopercorso */
console.log('\n2) avvio da sottopercorso');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({
  viewport: { width: 414, height: 880 }, isMobile: true, hasTouch: true, locale: 'it-IT',
  permissions: ['geolocation'], geolocation: { latitude: 41.3275, longitude: 19.8187, accuracy: 8 },
});
const page = await ctx.newPage();
const errori = [];
const risposte404 = [];
page.on('pageerror', (e) => errori.push(e.message));
page.on('response', (r) => { if (r.status() === 404 && r.url().startsWith(`http://localhost:${PORT}`)) risposte404.push(r.url()); });
// niente rete verso l'esterno: qui si prova solo la pubblicazione
await ctx.route(/openfreemap|cartocdn|openstreetmap\.org|arcgisonline|photon|router\.project-osrm|routing\.openstreetmap/, (r) => r.abort());

await page.goto(BASE, { waitUntil: 'networkidle' });
check('la pagina si apre dal sottopercorso', (await page.title()).includes('ARGO Drive'));
check('nessun file del sito manca (404)', risposte404.length === 0, risposte404);

await page.click('#btn-start');
await page.waitForTimeout(3000);
const stato = await page.evaluate(() => ({
  gate: document.querySelector('#gate').hidden,
  mappa: !!window.ARGO_DRIVE.map().map,
  gps: document.querySelector('#pill-gps').textContent.trim(),
  ricerca: !document.querySelector('#btn-search').hidden,
}));
check('la schermata di avvio si chiude', stato.gate === true);
check('la mappa viene creata anche senza tile', stato.mappa === true);
check('il GPS viene agganciato', /GPS ±\d+ m/.test(stato.gps), stato.gps);
check('la barra di ricerca è pronta', stato.ricerca === true);

/* 3 — service worker con l'ambito giusto */
console.log('\n3) service worker');
const swStato = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? { scope: reg.scope, attivo: !!reg.active } : null;
});
check('il service worker si registra', !!swStato && swStato.attivo, swStato);
check('l’ambito è la cartella dell’app, non la radice del dominio',
  !!swStato && swStato.scope.endsWith(`${PREFIX}/`), swStato && swStato.scope);

/* 4 — si riapre offline */
console.log('\n4) riapertura senza rete');
await ctx.setOffline(true);
let offline = false;
try {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  offline = await page.evaluate(() => !!document.querySelector('#btn-start'));
} catch (e) { offline = `errore: ${e.message.slice(0, 60)}`; }
check('l’app si riapre senza rete anche da sottopercorso', offline === true, offline);
await ctx.setOffline(false);

check('nessun errore di pagina', errori.length === 0, errori);
await browser.close();
server.close();
finish('deploy.test.mjs');
