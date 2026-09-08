/* ============================================================
   ARGO Drive — service worker
   L'app deve aprirsi anche a rete zero: guscio in precache,
   tile mappa in cache runtime con tetto massimo.
   Overpass non viene mai messo in cache qui (ci pensa
   localStorage lato app, con TTL).
   ============================================================ */

const VERSION = 'argo-drive-v4';
const SHELL = `${VERSION}-shell`;
const TILES = `${VERSION}-tiles`;
const TILE_CAP = 1200;   // i tile vettoriali coprono più superficie dei raster

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './vendor/maplibre/maplibre-gl.js',
  './vendor/maplibre/maplibre-gl.css',
  './js/app.js',
  './js/alerts.js',
  './js/geo.js',
  './js/map.js',
  './js/osm.js',
  './js/guidance.js',
  './js/reports.js',
  './js/router.js',
  './js/rules-albania.js',
  './js/search.js',
  './js/style.js',
  './js/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tile (vettoriali .pbf, raster .png) e glifi dei caratteri: tutto ciò
// che, già visto una volta, deve restare visibile senza rete.
const isTile = (url) =>
  /tiles\.openfreemap\.org|basemaps\.cartocdn\.com|tile\.openstreetmap\.org|server\.arcgisonline\.com/
    .test(url.hostname + url.pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // Overpass usa POST: passa dritto
  const url = new URL(req.url);

  if (isTile(url)) { e.respondWith(tileStrategy(req)); return; }
  if (url.origin !== self.location.origin) return;  // altre risorse esterne: rete diretta

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(shellStrategy(req));
});

/**
 * Guscio: cache first, aggiornamento in sottofondo.
 * Il ramo di errore deve restituire una Response vera: se torna
 * undefined, respondWith solleva e la richiesta muore con un errore
 * di rete opaco invece di un 504 leggibile.
 */
async function shellStrategy(req) {
  const cached = await caches.match(req);
  if (cached) {
    fetch(req)
      .then((res) => { if (res && res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone())); })
      .catch(() => { /* offline: resta la copia in cache */ });
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(SHELL);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 504, statusText: 'Non disponibile offline' });
  }
}

/** Tile: cache first (una strada già vista resta visibile senza rete). */
async function tileStrategy(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone());
      trimTiles(cache);
    }
    return res;
  } catch {
    return hit || new Response('', { status: 504, statusText: 'Tile non disponibile offline' });
  }
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_CAP) return;
  for (const k of keys.slice(0, keys.length - TILE_CAP)) cache.delete(k);
}
