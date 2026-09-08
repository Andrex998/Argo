/* ============================================================
   ARGO Drive — search.js
   Trovare dove andare: ricerca per nome, ricerca inversa
   (che cos'è questo punto) e categorie utili in viaggio.

   Geocoder: Photon (komoot) come primo, Nominatim come riserva.
   Entrambi su dati OpenStreetMap, entrambi senza chiave. Le
   categorie ("benzina", "parcheggio") passano invece da Overpass,
   perché lì conta la distanza reale, non la rilevanza testuale.
   ============================================================ */

import { haversine, formatDistance } from './geo.js';

const PHOTON = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const RECENTI_KEY = 'argo-drive:recenti:v1';
const PREFERITI_KEY = 'argo-drive:preferiti:v1';

export const CATEGORIE = [
  { id: 'benzina', label: 'Benzina', emoji: '⛽', filtro: '["amenity"="fuel"]' },
  { id: 'parcheggio', label: 'Parcheggio', emoji: '🅿️', filtro: '["amenity"="parking"]' },
  { id: 'ristorante', label: 'Mangiare', emoji: '🍽', filtro: '["amenity"~"^(restaurant|fast_food)$"]' },
  { id: 'caffe', label: 'Caffè', emoji: '☕', filtro: '["amenity"="cafe"]' },
  { id: 'hotel', label: 'Dormire', emoji: '🛏', filtro: '["tourism"~"^(hotel|guest_house|hostel)$"]' },
  { id: 'farmacia', label: 'Farmacia', emoji: '💊', filtro: '["amenity"="pharmacy"]' },
  { id: 'ospedale', label: 'Ospedale', emoji: '🏥', filtro: '["amenity"="hospital"]' },
  { id: 'bancomat', label: 'Bancomat', emoji: '🏧', filtro: '["amenity"~"^(atm|bank)$"]' },
  { id: 'officina', label: 'Officina', emoji: '🔧', filtro: '["shop"="car_repair"]' },
  { id: 'supermercato', label: 'Spesa', emoji: '🛒', filtro: '["shop"~"^(supermarket|convenience)$"]' },
];

/** Ricerca testuale, orientata su dove ti trovi. */
export async function geocode(query, near, signal) {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const params = new URLSearchParams({ q, limit: '8', lang: 'it' });
    if (near) { params.set('lat', near[0].toFixed(4)); params.set('lon', near[1].toFixed(4)); }
    const res = await fetch(`${PHOTON}?${params}`, { signal });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    const risultati = (data.features || []).map((f) => daPhoton(f, near)).filter(Boolean);
    if (risultati.length) return risultati;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
  }

  // Riserva: Nominatim
  const params = new URLSearchParams({ format: 'jsonv2', q, limit: '8', 'accept-language': 'it' });
  const res = await fetch(`${NOMINATIM}?${params}`, { signal });
  if (!res.ok) throw new Error('Ricerca non disponibile');
  const data = await res.json();
  return data.map((r) => ({
    id: `n${r.osm_type || ''}${r.osm_id || r.place_id}`,
    name: (r.display_name || '').split(',')[0],
    detail: (r.display_name || '').split(',').slice(1, 4).join(',').trim(),
    lat: Number(r.lat),
    lon: Number(r.lon),
    distance: near ? haversine(near, [Number(r.lat), Number(r.lon)]) : null,
  }));
}

function daPhoton(feature, near) {
  const p = feature.properties || {};
  const [lon, lat] = (feature.geometry || {}).coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const via = [p.street, p.housenumber].filter(Boolean).join(' ');
  const nome = p.name || via || p.city || 'Luogo senza nome';
  const dettaglio = [via && via !== nome ? via : null, p.postcode, p.city || p.district, p.state, p.country]
    .filter(Boolean).join(' · ');
  return {
    id: `p${p.osm_type || ''}${p.osm_id || `${lat},${lon}`}`,
    name: nome,
    detail: dettaglio,
    lat, lon,
    distance: near ? haversine(near, [lat, lon]) : null,
  };
}

/** Che cos'è questo punto? Serve quando scegli sulla mappa. */
export async function reverse(point, signal) {
  try {
    const params = new URLSearchParams({ lat: String(point[0]), lon: String(point[1]), lang: 'it' });
    const res = await fetch(`${PHOTON_REVERSE}?${params}`, { signal });
    if (!res.ok) throw new Error('reverse');
    const data = await res.json();
    const primo = (data.features || [])[0];
    const risultato = primo && daPhoton(primo, point);
    if (risultato) return { ...risultato, lat: point[0], lon: point[1] };
  } catch { /* senza rete resta il punto nudo */ }
  return {
    id: `punto-${point[0].toFixed(5)},${point[1].toFixed(5)}`,
    name: 'Punto sulla mappa',
    detail: `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`,
    lat: point[0], lon: point[1], distance: 0,
  };
}

/** Categorie: la distanza conta più della rilevanza, quindi Overpass. */
export async function nearby(categoriaId, point, raggio = 5000, signal) {
  const cat = CATEGORIE.find((c) => c.id === categoriaId);
  if (!cat) return [];
  const query = `[out:json][timeout:20];
(
  node(around:${raggio},${point[0].toFixed(5)},${point[1].toFixed(5)})${cat.filtro};
  way(around:${raggio},${point[0].toFixed(5)},${point[1].toFixed(5)})${cat.filtro};
);
out center 40;`;

  let ultimo = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      return (data.elements || []).map((el) => {
        const lat = el.lat ?? (el.center && el.center.lat);
        const lon = el.lon ?? (el.center && el.center.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const t = el.tags || {};
        const distanza = haversine(point, [lat, lon]);
        return {
          id: `o${el.type}${el.id}`,
          name: t.name || t.brand || cat.label,
          detail: [t.brand && t.brand !== t.name ? t.brand : null, t['addr:street'], t.opening_hours ? `orari: ${t.opening_hours}` : null, formatDistance(distanza)]
            .filter(Boolean).join(' · '),
          lat, lon,
          distance: distanza,
        };
      }).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 12);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      ultimo = err;
    }
  }
  throw ultimo || new Error('Ricerca per categoria non disponibile');
}

/* ---------- memoria dei luoghi ---------- */

const leggi = (key) => {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const scrivi = (key, v) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* navigazione privata */ }
};

export const recenti = () => leggi(RECENTI_KEY);

export function ricorda(luogo) {
  if (!luogo) return;
  const voce = { id: luogo.id, name: luogo.name, detail: luogo.detail, lat: luogo.lat, lon: luogo.lon, ts: Date.now() };
  const lista = [voce, ...recenti().filter((r) => r.id !== voce.id)].slice(0, 12);
  scrivi(RECENTI_KEY, lista);
}

export const preferiti = () => leggi(PREFERITI_KEY);

export function salvaPreferito(luogo, etichetta) {
  if (!luogo) return preferiti();
  const voce = { id: luogo.id, name: luogo.name, detail: luogo.detail, lat: luogo.lat, lon: luogo.lon, label: etichetta || luogo.name };
  const lista = [voce, ...preferiti().filter((p) => p.id !== voce.id && p.label !== voce.label)].slice(0, 10);
  scrivi(PREFERITI_KEY, lista);
  return lista;
}

export function rimuoviPreferito(id) {
  const lista = preferiti().filter((p) => p.id !== id);
  scrivi(PREFERITI_KEY, lista);
  return lista;
}
