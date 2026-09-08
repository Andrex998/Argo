/* ============================================================
   ARGO Drive — router.js
   Calcolo del percorso e traduzione delle manovre in italiano.

   Motore: OSRM pubblico (profilo auto, OpenStreetMap). Nessuna
   chiave, nessun account. Due istanze in rotazione: quella dimostrativa
   del progetto e quella FOSSGIS, così se una è satura si passa all'altra.

   Quello che NON c'è, e va detto: nessun dato di traffico in tempo
   reale. Gli orari di arrivo sono stime sulla velocità libera della
   strada, corrette con la velocità che stai davvero tenendo.
   ============================================================ */

const ENDPOINTS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];

let endpoint = 0;

/**
 * Chiede un percorso da → a.
 * @param {[number,number]} from [lat, lon]
 * @param {[number,number]} to   [lat, lon]
 * @param {{alternatives?: boolean, signal?: AbortSignal}} opts
 */
export async function route(from, to, opts = {}) {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    annotations: 'false',
    alternatives: opts.alternatives === false ? 'false' : 'true',
  });

  let lastError = null;
  for (let attempt = 0; attempt < ENDPOINTS.length; attempt++) {
    const base = ENDPOINTS[(endpoint + attempt) % ENDPOINTS.length];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${base}/${coords}?${params}`, { signal: opts.signal || ctrl.signal });
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
        throw new Error(data.code === 'NoRoute' ? 'Nessun percorso stradale per quella destinazione' : `OSRM ${data.code}`);
      }
      endpoint = (endpoint + attempt) % ENDPOINTS.length;
      return data.routes.map((r, i) => parseRoute(r, i));
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Servizio di percorso non raggiungibile');
}

/** OSRM → modello interno, con distanze cumulate lungo il percorso. */
function parseRoute(raw, index) {
  const coords = raw.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const cumulative = cumulativeDistances(coords);
  const steps = [];

  let travelled = 0;
  for (const leg of raw.legs || []) {
    for (const s of leg.steps || []) {
      const at = [s.maneuver.location[1], s.maneuver.location[0]];
      steps.push({
        at,
        along: nearestAlong(coords, cumulative, at),
        type: s.maneuver.type,
        modifier: s.maneuver.modifier || null,
        exit: s.maneuver.exit || null,
        name: s.name || '',
        ref: s.ref || '',
        distance: s.distance,
        duration: s.duration,
        instruction: null,   // riempita sotto: serve il nome della strada successiva
        start: travelled,
      });
      travelled += s.distance;
    }
  }
  for (let i = 0; i < steps.length; i++) {
    steps[i].instruction = instruction(steps[i], steps[i + 1]);
  }

  return {
    id: `r${index}`,
    coords,
    cumulative,
    steps,
    distance: raw.distance,
    duration: raw.duration,
    summary: (raw.legs || []).map((l) => l.summary).filter(Boolean).join(' · '),
  };
}

/* ---------- geometria del percorso ---------- */

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function metres(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const la1 = rad(a[0]);
  const la2 = rad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulativeDistances(coords) {
  const out = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) out[i] = out[i - 1] + metres(coords[i - 1], coords[i]);
  return out;
}

/** Quanti metri dall'inizio del percorso si trova il punto dato. */
function nearestAlong(coords, cumulative, point) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = metres(coords[i], point);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return cumulative[best];
}

/* ---------- istruzioni in italiano ---------- */

const DIR = {
  left: 'a sinistra',
  right: 'a destra',
  'sharp left': 'tutto a sinistra',
  'sharp right': 'tutto a destra',
  'slight left': 'leggermente a sinistra',
  'slight right': 'leggermente a destra',
  straight: 'dritto',
  uturn: 'inversione a U',
};

const ORDINALE = ['prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima'];

/** Icona della manovra: serve al pannello e alla mappa. */
export function maneuverIcon(step) {
  const m = step.modifier || '';
  if (step.type === 'arrive') return 'arrivo';
  if (step.type === 'depart') return 'partenza';
  if (step.type === 'roundabout' || step.type === 'rotary') return 'rotonda';
  if (step.type === 'merge') return 'immissione';
  if (step.type === 'on ramp') return 'rampa';
  if (step.type === 'off ramp') return 'uscita';
  if (m.includes('uturn')) return 'inversione';
  if (m.includes('sharp left')) return 'sinistra-secca';
  if (m.includes('sharp right')) return 'destra-secca';
  if (m.includes('slight left')) return 'sinistra-lieve';
  if (m.includes('slight right')) return 'destra-lieve';
  if (m.includes('left')) return 'sinistra';
  if (m.includes('right')) return 'destra';
  return 'dritto';
}

/**
 * Frase della manovra. `next` serve per dire "in Rruga X":
 * il nome della strada in cui si entra sta nel passo successivo.
 */
export function instruction(step, next) {
  const verso = DIR[step.modifier] || '';
  const strada = nomeStrada(next || step);
  const dove = strada ? ` in ${strada}` : '';

  switch (step.type) {
    case 'depart':
      return strada ? `Parti su ${strada}` : 'Parti';
    case 'arrive':
      return step.modifier === 'left' ? 'Sei arrivato, sulla sinistra'
        : step.modifier === 'right' ? 'Sei arrivato, sulla destra'
        : 'Sei arrivato';
    case 'roundabout':
    case 'rotary':
      return step.exit && ORDINALE[step.exit - 1]
        ? `Alla rotonda prendi la ${ORDINALE[step.exit - 1]} uscita${dove}`
        : `Alla rotonda esci${dove}`;
    case 'roundabout turn':
      return `Alla rotonda vai ${verso || 'dritto'}${dove}`;
    case 'merge':
      return `Immettiti ${verso || 'dritto'}${dove}`;
    case 'on ramp':
      return `Prendi la rampa ${verso}`.trim() + dove;
    case 'off ramp':
      return `Prendi l'uscita ${verso}`.trim() + dove;
    case 'fork':
      return `Al bivio tieni ${verso || 'la destra'}${dove}`;
    case 'end of road':
      return `In fondo alla strada gira ${verso}${dove}`;
    case 'continue':
      if (step.modifier === 'uturn') return `Inverti il senso di marcia${dove}`;
      return `Prosegui ${verso || 'dritto'}${dove}`;
    case 'new name':
      return `Prosegui${dove}`;
    case 'turn':
    default:
      if (step.modifier === 'uturn') return `Inverti il senso di marcia${dove}`;
      if (step.modifier === 'straight') return `Prosegui dritto${dove}`;
      return `Gira ${verso}${dove}`;
  }
}

function nomeStrada(step) {
  if (!step) return '';
  if (step.ref && step.name) return `${step.name} (${step.ref})`;
  return step.name || step.ref || '';
}

/** "300 metri", "1,2 chilometri" — da dire a voce, non da leggere. */
export function distanzaParlata(m) {
  if (m < 30) return '';
  if (m < 1000) {
    const arrotondato = m < 200 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
    return `${arrotondato} metri`;
  }
  const km = m / 1000;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} chilometri`;
  return `${Math.round(km)} chilometri`;
}
