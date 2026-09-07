/* ============================================================
   ARGO Drive — osm.js
   Dati stradali live da Overpass API (OpenStreetMap):
   limiti di velocità, divieti di accesso, aree pedonali,
   autovelox, dossi, passaggi a livello, fondo dissestato.

   Overpass è un servizio pubblico e gratuito: qui si interroga
   con parsimonia (una richiesta ogni tot metri, mai sotto i 15s,
   cache locale su localStorage) perché l'app deve reggere anche
   con mezza tacca di rete su una statale albanese.
   ============================================================ */

import { haversine, distanceToLine, angleDelta, bbox, outsideBbox, destination } from './geo.js';
import { parseMaxspeed, presumedLimit, accessVerdict, roughVerdict } from './rules-albania.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const CACHE_PREFIX = 'argo-drive:osm:v1:';
const CACHE_TTL = 7 * 24 * 3600 * 1000;  // le strade non cambiano in una settimana
const CACHE_STALE = 24 * 3600 * 1000;    // ma un refresh giornaliero è sano
const CACHE_MAX_ENTRIES = 8;
const MIN_INTERVAL = 25000;  // Overpass è un servizio pubblico: non si martella

const HIGHWAY_RE =
  '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track|road|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$';

export function buildQuery(lat, lon, rRoads, rArea) {
  const la = lat.toFixed(5);
  const lo = lon.toFixed(5);
  return `[out:json][timeout:30];
(
  way(around:${rRoads},${la},${lo})["highway"~"${HIGHWAY_RE}"];
  way(around:${rArea},${la},${lo})["boundary"="low_emission_zone"];
  relation(around:${rArea},${la},${lo})["boundary"="low_emission_zone"];
  node(around:${rArea},${la},${lo})["highway"="speed_camera"];
  node(around:${rArea},${la},${lo})["traffic_calming"];
  node(around:${rArea},${la},${lo})["railway"="level_crossing"];
  node(around:${rArea},${la},${lo})["barrier"~"^(gate|lift_gate|bollard|block|swing_gate|jersey_barrier)$"];
  node(around:${rArea},${la},${lo})["hazard"];
  way(around:${rArea},${la},${lo})["hazard"];
);
out geom;`;
}

/** Overpass grezzo → modello compatto (≈10x più piccolo in cache). */
export function compact(raw, center, radius, anchor) {
  const roads = [];
  const zones = [];
  const points = [];

  for (const el of raw.elements || []) {
    const tags = el.tags || {};

    if (el.type === 'node') {
      const kind = nodeKind(tags);
      if (!kind) continue;
      points.push({
        id: `n${el.id}`,
        kind,
        lat: el.lat,
        lon: el.lon,
        label: nodeLabel(kind, tags),
      });
      continue;
    }

    if (el.type === 'relation') {
      // Una LEZ è una relazione: i membri sono spezzoni di confine.
      // Presi uno per uno darebbero anelli aperti, e il test
      // "sono dentro?" direbbe sì a caso. Prima si ricuciono.
      let i = 0;
      for (const ring of assembleRings(el.members)) {
        if (ring.coords.length < 3) continue;
        zones.push({
          id: `r${el.id}-${i++}`,
          kind: 'lez',
          name: tags.name || 'Zona a emissioni limitate',
          ring: ring.coords,
          closed: ring.closed,
          box: bbox(ring.coords),
        });
      }
      continue;
    }

    if (el.type !== 'way' || !el.geometry) continue;
    const coords = el.geometry.map((g) => [g.lat, g.lon]);
    if (coords.length < 2) continue;
    const box = bbox(coords);

    if (tags.boundary === 'low_emission_zone') {
      zones.push({ id: `w${el.id}`, kind: 'lez', name: tags.name || 'Zona a emissioni limitate', ring: coords, closed: isClosedRing(coords), box });
      continue;
    }
    if (tags.hazard) {
      points.push({
        id: `w${el.id}`, kind: 'hazard',
        lat: coords[Math.floor(coords.length / 2)][0],
        lon: coords[Math.floor(coords.length / 2)][1],
        label: `Pericolo segnalato: ${tags.hazard.replace(/_/g, ' ')}`,
      });
      // Se il pericolo sta *su* una strada, la strada resta una strada:
      // altrimenti si perderebbero limite, matching e allerta di velocità.
      if (!tags.highway) continue;
    }
    if (!tags.highway) continue;

    const closed = coords.length > 3 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];

    if (tags.highway === 'pedestrian' && (closed || tags.area === 'yes')) {
      zones.push({ id: `w${el.id}`, kind: 'pedestrian', name: tags.name || 'Area pedonale', ring: coords, closed: true, box });
      continue;
    }

    const ms = parseMaxspeed(tags.maxspeed);
    const access = accessVerdict(tags);
    const rough = roughVerdict(tags);

    roads.push({
      id: `w${el.id}`,
      name: tags.name || tags.ref || null,
      hw: tags.highway,
      coords,
      box,
      limit: ms.kmh,
      limitKind: ms.kind,
      oneway: tags.oneway === 'yes' || tags.junction === 'roundabout',
      lanes: tags.lanes ? Number(tags.lanes) : null,
      lit: tags.lit === 'yes',
      tunnel: !!tags.tunnel,
      block: access && access.level === 'block' ? access.reason : null,
      limited: access && access.level === 'limited' ? access.reason : null,
      rough: rough ? rough.reason : null,
    });
  }

  return {
    v: 1,
    ts: Date.now(),
    center,                    // centro della query (proiettato in avanti)
    anchor: anchor || center,  // posizione reale al momento della richiesta
    radius,
    roads,
    zones,
    points,
  };
}

const SAME_POINT = 1e-7;
const samePoint = (a, b) => Math.abs(a[0] - b[0]) < SAME_POINT && Math.abs(a[1] - b[1]) < SAME_POINT;
const isClosedRing = (ring) => ring.length > 3 && samePoint(ring[0], ring[ring.length - 1]);

/**
 * Ricuce i membri di una relazione in anelli.
 * Ogni spezzone si attacca al precedente da qualunque capo, anche
 * invertito: è così che OSM descrive i confini. Chi non chiude resta
 * una linea, e chi resta una linea non entra nel test "sono dentro".
 */
function assembleRings(members) {
  const segments = (members || [])
    .filter((m) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry.map((g) => [g.lat, g.lon]));

  const rings = [];
  while (segments.length) {
    let ring = segments.shift();
    let grown = true;
    while (grown && !isClosedRing(ring)) {
      grown = false;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const head = ring[0];
        const tail = ring[ring.length - 1];
        if (samePoint(tail, seg[0])) ring = ring.concat(seg.slice(1));
        else if (samePoint(tail, seg[seg.length - 1])) ring = ring.concat(seg.slice(0, -1).reverse());
        else if (samePoint(head, seg[seg.length - 1])) ring = seg.slice(0, -1).concat(ring);
        else if (samePoint(head, seg[0])) ring = seg.slice(1).reverse().concat(ring);
        else continue;
        segments.splice(i, 1);
        grown = true;
        break;
      }
    }
    rings.push({ coords: ring, closed: isClosedRing(ring) });
  }
  return rings;
}

function nodeKind(tags) {
  if (tags.highway === 'speed_camera') return 'camera';
  if (tags.traffic_calming) return 'calming';
  if (tags.railway === 'level_crossing') return 'crossing';
  if (tags.barrier) return 'barrier';
  if (tags.hazard) return 'hazard';
  return null;
}

function nodeLabel(kind, tags) {
  switch (kind) {
    case 'camera': return tags.name ? `Autovelox — ${tags.name}` : 'Autovelox';
    case 'calming': return `Dosso / rallentatore (${(tags.traffic_calming || '').replace(/_/g, ' ')})`;
    case 'crossing': return 'Passaggio a livello';
    case 'barrier': return `Sbarra o dissuasore (${(tags.barrier || '').replace(/_/g, ' ')})`;
    default: return `Pericolo: ${(tags.hazard || '').replace(/_/g, ' ')}`;
  }
}

/* ---------- cache ---------- */

const cellKey = (lat, lon) => `${CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`;

function cacheRead(lat, lon) {
  try {
    const raw = localStorage.getItem(cellKey(lat, lon));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.ts || Date.now() - data.ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function cacheWrite(lat, lon, data) {
  try {
    localStorage.setItem(cellKey(lat, lon), JSON.stringify(data));
    trimCache();
  } catch {
    trimCache(true);
    try { localStorage.setItem(cellKey(lat, lon), JSON.stringify(data)); } catch { /* pieno: pazienza */ }
  }
}

function trimCache(aggressive = false) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    const max = aggressive ? 2 : CACHE_MAX_ENTRIES;
    if (keys.length <= max) return;
    const entries = keys.map((k) => {
      let ts = 0;
      try { ts = JSON.parse(localStorage.getItem(k)).ts || 0; } catch { /* voce corrotta */ }
      return { k, ts };
    }).sort((a, b) => a.ts - b.ts);
    for (const e of entries.slice(0, keys.length - max)) localStorage.removeItem(e.k);
  } catch { /* niente localStorage: si continua senza cache */ }
}

/* ---------- sorgente live ---------- */

export class OsmSource {
  /**
   * @param {(status:object)=>void} onStatus notifica UI
   */
  constructor(onStatus) {
    this.onStatus = onStatus || (() => {});
    this.data = null;
    this.pending = false;
    this.lastAttempt = 0;
    this.failures = 0;
    this.endpoint = 0;
    this.radiusRoads = 900;
    this.radiusArea = 1600;
    this.state = 'idle';
    this.lastError = null;
  }

  setRadius(roads) {
    this.radiusRoads = roads;
    this.radiusArea = Math.round(roads * 1.8);
  }

  /** Serve una nuova richiesta per questa posizione? */
  needsFetch(lat, lon) {
    if (this.pending) return false;
    const now = Date.now();
    const backoff = this.failures ? Math.min(120000, 15000 * 2 ** (this.failures - 1)) : MIN_INTERVAL;
    if (now - this.lastAttempt < backoff) return false;
    if (!this.data) return true;
    const moved = haversine([lat, lon], this.data.anchor || this.data.center);
    if (moved > this.radiusRoads * 0.6) return true;
    if (now - this.data.ts > CACHE_STALE) return true;
    return false;
  }

  /** Da chiamare a ogni fix GPS: usa cache, poi rete se serve. */
  async update(lat, lon, heading, speedMs) {
    if (!this.data) {
      const cached = cacheRead(lat, lon);
      if (cached && haversine([lat, lon], cached.anchor || cached.center) < this.radiusRoads * 0.6) {
        this.data = cached;
        this.state = 'cache';
        this.emit();
      }
    }
    if (!this.needsFetch(lat, lon)) return this.data;
    return this.fetchNow(lat, lon, heading, speedMs);
  }

  /**
   * A 100 km/h il raggio dietro di te non serve a niente: la query
   * viene centrata ~15 secondi più avanti lungo la rotta, così i
   * dati arrivano prima di te e non dopo.
   */
  queryCenter(lat, lon, heading, speedMs) {
    if (!Number.isFinite(heading) || !(speedMs > 5)) return [lat, lon];
    const ahead = Math.min(this.radiusRoads * 0.5, speedMs * 15);
    return destination([lat, lon], heading, ahead);
  }

  async fetchNow(lat, lon, heading, speedMs) {
    if (this.pending) return this.data;   // una richiesta alla volta, in ordine
    this.pending = true;
    this.lastAttempt = Date.now();
    this.state = 'loading';
    this.emit();

    const [qLat, qLon] = this.queryCenter(lat, lon, heading, speedMs);
    const query = buildQuery(qLat, qLon, this.radiusRoads, this.radiusArea);
    const url = ENDPOINTS[this.endpoint % ENDPOINTS.length];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const raw = await res.json();
      this.data = compact(raw, [qLat, qLon], this.radiusRoads, [lat, lon]);
      cacheWrite(lat, lon, this.data);
      this.failures = 0;
      this.state = 'live';
      this.lastError = null;
    } catch (err) {
      this.failures += 1;
      this.endpoint += 1; // il prossimo tentativo cambia mirror
      this.lastError = err.name === 'AbortError' ? 'timeout' : err.message;
      this.state = this.data ? 'stale' : 'error';
    } finally {
      clearTimeout(timer);
      this.pending = false;
      this.emit();
    }
    return this.data;
  }

  emit() {
    this.onStatus({
      state: this.state,
      error: this.lastError,
      age: this.data ? Date.now() - this.data.ts : null,
      counts: this.data
        ? { roads: this.data.roads.length, zones: this.data.zones.length, points: this.data.points.length }
        : null,
    });
  }
}

/* ---------- map matching ---------- */

/**
 * Euristica "sono in un centro abitato?": densità di strade
 * residenziali intorno. Serve solo a scegliere il default 40 vs 80
 * quando OSM non ha il maxspeed, ed è dichiarata come presunta.
 */
export function isUrban(point, data) {
  if (!data) return false;
  let hits = 0;
  for (const r of data.roads) {
    if (r.hw !== 'residential' && r.hw !== 'living_street') continue;
    if (outsideBbox(point, r.box, 500)) continue;
    hits += 1;
    if (hits >= 6) return true;
  }
  return false;
}

/**
 * Trova la strada su cui stiamo viaggiando.
 * Distanza + coerenza di rotta: senza il secondo criterio, in centro
 * si "aggancia" continuamente la parallela o il marciapiede.
 */
export function matchRoad(point, heading, speedMs, data) {
  if (!data || !data.roads.length) return null;
  const moving = speedMs > 1.4 && heading != null && !Number.isNaN(heading);
  let best = null;

  for (const road of data.roads) {
    if (outsideBbox(point, road.box, 80)) continue;
    const hit = distanceToLine(point, road.coords);
    if (!hit || hit.dist > 70) continue;

    let score = hit.dist;
    if (moving && hit.heading != null) {
      const delta = angleDelta(heading, hit.heading);
      const aligned = Math.min(delta, 180 - delta); // strade a doppio senso
      if (aligned > 50) score += 45;
      else score += aligned * 0.25;
    }
    // Le corsie di servizio e i parcheggi non sono quasi mai "la mia strada".
    if (road.hw === 'service' || road.hw === 'track') score += 20;
    if (road.block) score += 15;

    if (!best || score < best.score) best = { road, score, dist: hit.dist, heading: hit.heading, snapped: hit.point };
  }
  return best;
}

/** Limite da mostrare nel disco, con provenienza esplicita. */
export function resolveLimit(match, urban) {
  if (!match) return { kmh: null, source: 'nessuna strada agganciata' };
  const r = match.road;
  if (r.limit) return { kmh: r.limit, source: r.limitKind === 'scheme' ? 'OSM (schema nazionale)' : 'OSM', presumed: false, road: r };
  if (r.limitKind === 'none-limit') return { kmh: null, source: 'nessun limite', presumed: false, road: r };
  const p = presumedLimit(r.hw, urban);
  return { kmh: p, source: urban ? 'presunto — centro abitato' : 'presunto — fuori città', presumed: true, road: r };
}
