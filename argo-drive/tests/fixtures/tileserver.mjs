/* ============================================================
   Banco di prova: tile vettoriali sintetiche in schema
   OpenMapTiles, generate al volo. Servono per verificare che
   js/style.js sia valido e per fotografare il design senza
   dipendere dalla rete.
   ============================================================ */
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

const C = [19.8187, 41.3275];           // Tirana, piazza Skanderbeg
const dx = (m) => m / (111320 * Math.cos(C[1] * Math.PI / 180));
const dy = (m) => m / 110540;

const line = (pts, props) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts } });
const poly = (pts, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
const pt = (p, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: p } });
const box = (cx, cy, w, h) => [
  [C[0] + dx(cx - w / 2), C[1] + dy(cy - h / 2)],
  [C[0] + dx(cx + w / 2), C[1] + dy(cy - h / 2)],
  [C[0] + dx(cx + w / 2), C[1] + dy(cy + h / 2)],
  [C[0] + dx(cx - w / 2), C[1] + dy(cy + h / 2)],
];
const horiz = (y, from, to) => [[C[0] + dx(from), C[1] + dy(y)], [C[0] + dx(to), C[1] + dy(y)]];
const vert = (x, from, to) => [[C[0] + dx(x), C[1] + dy(from)], [C[0] + dx(x), C[1] + dy(to)]];

const LAYERS = {
  water: [poly(box(700, -450, 700, 420), { class: 'lake' })],
  waterway: [line([[C[0] + dx(-1200), C[1] + dy(-800)], [C[0] + dx(400), C[1] + dy(-560)], [C[0] + dx(700), C[1] - dy(450)]], { class: 'river', name: 'Lana' })],
  boundary: [line([[C[0] - dx(1600), C[1] + dy(1100)], [C[0] + dx(1600), C[1] + dy(1150)]], { admin_level: 4 })],
  park: [poly(box(-420, 320, 460, 380), { class: 'park', name: 'Parku Rinia' })],
  landcover: [poly(box(-900, -700, 700, 600), { class: 'grass' })],
  landuse: [poly(box(250, 350, 900, 700), { class: 'residential' })],
  transportation: [
    line(horiz(0, -1600, 1600), { class: 'primary', name: 'Rruga e Kavajës' }),
    line(horiz(300, -1600, 1600), { class: 'secondary', name: 'Rruga e Durrësit' }),
    line(horiz(-320, -1600, 1600), { class: 'motorway', name: 'SH2' }),
    line(vert(-250, -1600, 1600), { class: 'secondary', name: 'Rruga Myslym Shyri' }),
    line(vert(420, -1600, 1600), { class: 'trunk', name: 'Unaza e Madhe' }),
    ...[-800, -500, -100, 150, 650, 900].map((x) => line(vert(x, -900, 900), { class: 'minor' })),
    ...[-600, -180, 120, 480, 700].map((y) => line(horiz(y, -1100, 1100), { class: 'minor' })),
  ],
  building: [
    ...[[-150, 120, 90, 70, 28], [60, 150, 70, 60, 42], [-300, -120, 110, 80, 18],
        [200, -200, 90, 90, 55], [420, 120, 60, 120, 34], [-520, 60, 80, 70, 22],
        [-80, -350, 140, 90, 12], [520, -120, 70, 70, 60]]
      .map(([x, y, w, h, height]) => poly(box(x, y, w, h), { render_height: height, render_min_height: 0 })),
  ],
  transportation_name: [
    line(horiz(0, -1600, 1600), { class: 'primary', name: 'Rruga e Kavajës' }),
    line(horiz(-320, -1600, 1600), { class: 'motorway', name: 'SH2' }),
  ],
  place: [pt([C[0], C[1] + dy(500)], { class: 'city', name: 'Tiranë', rank: 1 })],
  water_name: [pt([C[0] + dx(700), C[1] - dy(450)], { class: 'lake', name: 'Liqeni' })],
};

const indexes = Object.fromEntries(Object.entries(LAYERS).map(([name, features]) => [
  name,
  geojsonvt({ type: 'FeatureCollection', features }, { maxZoom: 16, indexMaxZoom: 14, tolerance: 3, extent: 4096, buffer: 64 }),
]));

export function tile(z, x, y) {
  const layers = {};
  for (const [name, idx] of Object.entries(indexes)) {
    const t = idx.getTile(z, x, y);
    if (t && t.features.length) layers[name] = t;
  }
  if (!Object.keys(layers).length) return null;
  return Buffer.from(vtpbf.fromGeojsonVt(layers, { version: 2, extent: 4096 }));
}

export const TILEJSON = (base) => ({
  tilejson: '2.2.0',
  tiles: [`${base}/tiles/{z}/{x}/{y}.pbf`],
  minzoom: 0,
  maxzoom: 14,
  bounds: [19.5, 41.0, 20.1, 41.6],
  vector_layers: Object.keys(LAYERS).map((id) => ({ id, fields: {} })),
});
