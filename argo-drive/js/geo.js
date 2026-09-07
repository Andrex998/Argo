/* ============================================================
   ARGO Drive — geo.js
   Geodesia leggera: distanze, proiezioni locali, matching
   punto→strada. Tutto in metri, tutto sincrono, zero deps.
   ============================================================ */

export const R_EARTH = 6371008.8;

export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;

/** Distanza haversine in metri fra [lat,lon] e [lat,lon]. */
export function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rotta iniziale da a→b, gradi 0..360 (0 = nord). */
export function bearing(a, b) {
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const dLon = toRad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Differenza angolare minima fra due rotte, 0..180. */
export function angleDelta(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Proiezione equirettangolare locale intorno a `origin`.
 * Su scala < 5 km l'errore è trascurabile e il costo è ~zero,
 * il che conta quando gira 1 volta al secondo su un telefono.
 */
export function projector(origin) {
  const k = Math.cos(toRad(origin[0]));
  return (p) => ({
    x: toRad(p[1] - origin[1]) * R_EARTH * k,
    y: toRad(p[0] - origin[0]) * R_EARTH,
  });
}

/** Punto a `m` metri da `origin` lungo la rotta `brg` (gradi). */
export function destination(origin, brg, m) {
  const d = m / R_EARTH;
  const b = toRad(brg);
  const la1 = toRad(origin[0]);
  const lo1 = toRad(origin[1]);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(la1),
    Math.cos(d) - Math.sin(la1) * Math.sin(la2)
  );
  return [toDeg(la2), ((toDeg(lo2) + 540) % 360) - 180];
}

/** Distanza punto→segmento nel piano locale. Ritorna {dist, t}. */
function pointSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = a.x + t * vx - p.x;
  const dy = a.y + t * vy - p.y;
  return { dist: Math.hypot(dx, dy), t };
}

/**
 * Distanza da un punto a una polilinea [[lat,lon], ...].
 * Ritorna { dist, index, t, point, heading } dove heading è
 * l'orientamento del segmento più vicino (utile per capire se
 * la strada è "la mia" o quella parallela).
 */
export function distanceToLine(point, coords) {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1) {
    return { dist: haversine(point, coords[0]), index: 0, t: 0, point: coords[0], heading: null };
  }
  const proj = projector(point);
  const p = { x: 0, y: 0 };
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = proj(coords[i]);
    const b = proj(coords[i + 1]);
    const r = pointSegment(p, a, b);
    if (!best || r.dist < best.dist) best = { dist: r.dist, index: i, t: r.t };
  }
  const a = coords[best.index];
  const b = coords[best.index + 1];
  const snapped = [
    a[0] + (b[0] - a[0]) * best.t,
    a[1] + (b[1] - a[1]) * best.t,
  ];
  return { ...best, point: snapped, heading: bearing(a, b) };
}

/** Distanza da un punto al bordo di un anello chiuso. */
export function distanceToRing(point, ring) {
  const r = distanceToLine(point, ring);
  return r ? r.dist : Infinity;
}

/** Ray casting: il punto è dentro l'anello? */
export function pointInRing(point, ring) {
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const hit =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Bounding box [minLat, minLon, maxLat, maxLon] di una lista di coordinate. */
export function bbox(coords) {
  let minLat = 90, minLon = 180, maxLat = -90, maxLon = -180;
  for (const [la, lo] of coords) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  return [minLat, minLon, maxLat, maxLon];
}

/** Scarto rapido: il punto è lontano dalla bbox più di `m` metri? */
export function outsideBbox(point, box, m) {
  const dLat = m / 111320;
  const dLon = m / (111320 * Math.max(0.2, Math.cos(toRad(point[0]))));
  return (
    point[0] < box[0] - dLat ||
    point[0] > box[2] + dLat ||
    point[1] < box[1] - dLon ||
    point[1] > box[3] + dLon
  );
}

/**
 * Velocità stimata dalle posizioni quando il GPS non fornisce
 * `coords.speed` (succede su parecchi Android e su desktop).
 * Media mobile esponenziale per non far ballare il tachimetro.
 */
export class SpeedEstimator {
  constructor(alpha = 0.4) {
    this.alpha = alpha;
    this.value = 0;
    this.last = null;
  }

  /** @returns {number} m/s */
  push(fix) {
    let raw = null;
    if (typeof fix.speed === 'number' && !Number.isNaN(fix.speed) && fix.speed >= 0) {
      raw = fix.speed;
    } else if (this.last) {
      const dt = (fix.ts - this.last.ts) / 1000;
      if (dt > 0.4 && dt < 30) {
        const d = haversine([this.last.lat, this.last.lon], [fix.lat, fix.lon]);
        // Sotto i 3 m di spostamento è rumore GPS, non movimento.
        raw = d < 3 ? 0 : d / dt;
      }
    }
    this.last = fix;
    if (raw === null) return this.value;
    if (raw > 70) raw = this.value; // 250 km/h: è un salto GPS, non un'auto
    this.value = this.value === 0 && raw > 0 ? raw : this.value + this.alpha * (raw - this.value);
    return this.value;
  }
}

export const msToKmh = (ms) => ms * 3.6;
export const kmhToMs = (k) => k / 3.6;

/** "1,2 km" / "300 m" */
export function formatDistance(m) {
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
