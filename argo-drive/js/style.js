/* ============================================================
   ARGO Drive — style.js
   Lo stile della mappa, scritto a mano invece di prendere uno
   stile pronto: è l'unico modo per avere la stessa gerarchia
   visiva di un navigatore moderno (autostrade che emergono,
   strade minori che spariscono, edifici in volume quando la
   camera si inclina) e due palette coerenti giorno/notte.

   Tile vettoriali: OpenFreeMap (schema OpenMapTiles, gratuito,
   senza chiave API). Se non risponde, map.js ricade su uno
   stile raster con la stessa palette.
   ============================================================ */

const VECTOR_TILES = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const GLYPH_PROBE = 'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf';

/**
 * I caratteri delle etichette si scaricano a parte. Se non arrivano,
 * MapLibre non fallisce solo i testi: fallisce il parsing dell'intero
 * tile e la mappa resta bianca. Quindi si sonda prima, una volta, e
 * si accendono le etichette solo se il servizio risponde davvero.
 */
export async function probeGlyphs(timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GLYPH_PROBE, { signal: ctrl.signal, cache: 'force-cache' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · OpenFreeMap';

export const PALETTES = {
  giorno: {
    ui: 'light',
    land: '#EEF0F4',
    landuse: '#E6E9EE',
    park: '#D6E8D2',
    wood: '#CBE1C6',
    water: '#A6C8EA',
    waterway: '#8FB7DD',
    building: '#DCE0E8',
    buildingEdge: '#C7CCD7',
    minorFill: '#FFFFFF',
    minorCase: '#DEE1E8',
    mainFill: '#FFFFFF',
    mainCase: '#CDD2DC',
    trunkFill: '#FFE6A6',
    trunkCase: '#E9C173',
    motorwayFill: '#FFD16B',
    motorwayCase: '#E2AC45',
    rail: '#C7CCD8',
    boundary: '#B4BAC6',
    label: '#3A3E46',
    labelHalo: 'rgba(255,255,255,0.92)',
    roadLabel: '#5C616B',
    waterLabel: '#4E7CA8',
    sky: '#BFD6F0',
    horizon: '#E8EEF6',
  },
  notte: {
    ui: 'dark',
    land: '#0E1015',
    landuse: '#12151B',
    park: '#13221A',
    wood: '#132018',
    water: '#0B1E31',
    waterway: '#123048',
    building: '#1E232D',
    buildingEdge: '#2A3140',
    minorFill: '#22262F',
    minorCase: '#141821',
    mainFill: '#2C313C',
    mainCase: '#151922',
    trunkFill: '#3D3A31',
    trunkCase: '#191C24',
    motorwayFill: '#4E452F',
    motorwayCase: '#1B1E26',
    rail: '#232833',
    boundary: '#2A3040',
    label: '#C6CBD5',
    labelHalo: 'rgba(6,8,12,0.9)',
    roadLabel: '#98A0AE',
    waterLabel: '#5C8AB4',
    sky: '#070A12',
    horizon: '#1B2333',
  },
};

/** Tile raster di riserva, per palette. */
const RASTER = {
  giorno: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
  },
  notte: {
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    ],
    attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · © CARTO',
  },
};

/** Interpolazione esponenziale: le strade crescono come su un navigatore. */
const width = (stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()];
const fade = (stops) => ['interpolate', ['linear'], ['zoom'], ...stops.flat()];

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

/**
 * Stile vettoriale completo.
 *
 * `labels: false` toglie ogni layer di testo. Non è un vezzo: se i
 * glifi dei caratteri non si scaricano, MapLibre fallisce l'intero
 * parsing del tile e la mappa resta **vuota**, non solo senza nomi.
 * Meglio una mappa muta che una mappa bianca.
 *
 * @param {string} name 'giorno' | 'notte'
 * @param {{buildings3d?: boolean, labels?: boolean}} opts
 */
export function buildVectorStyle(name, opts = {}) {
  const labels = opts.labels !== false;
  const p = PALETTES[name] || PALETTES.giorno;
  const layers = [
    { id: 'sfondo', type: 'background', paint: { 'background-color': p.land } },

    {
      id: 'bosco', type: 'fill', source: 'omt', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest', 'scrub']]],
      paint: { 'fill-color': p.wood, 'fill-opacity': fade([[6, 0.3], [12, 0.75]]) },
    },
    {
      id: 'prato', type: 'fill', source: 'omt', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]],
      paint: { 'fill-color': p.park, 'fill-opacity': fade([[8, 0.2], [13, 0.55]]) },
    },
    {
      id: 'urbanizzato', type: 'fill', source: 'omt', 'source-layer': 'landuse', minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': p.landuse, 'fill-opacity': 0.7 },
    },
    {
      id: 'parco', type: 'fill', source: 'omt', 'source-layer': 'park',
      paint: { 'fill-color': p.park, 'fill-opacity': 0.8 },
    },
    {
      id: 'acqua', type: 'fill', source: 'omt', 'source-layer': 'water',
      paint: { 'fill-color': p.water },
    },
    {
      id: 'corsi-acqua', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 9,
      paint: { 'line-color': p.waterway, 'line-width': width([[9, 0.6], [16, 3]]) },
    },
    {
      id: 'edifici', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-color': p.building,
        'fill-outline-color': p.buildingEdge,
        // Con il 3D attivo la sagoma piatta si spegne mentre nasce il volume.
      'fill-opacity': opts.buildings3d ? fade([[14, 0], [14.8, 0.9], [15.6, 0]]) : fade([[14, 0], [15.2, 1]]),
      },
    },
  ];

  if (opts.buildings3d) {
    layers.push({
      id: 'edifici-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 15,
      paint: {
        'fill-extrusion-color': p.building,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': fade([[15, 0], [15.7, 0.92]]),
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  // ── strade: prima tutti i bordi, poi tutti i riempimenti ──
  const roadClasses = {
    minore: ['service', 'minor', 'track'],
    secondaria: ['secondary', 'tertiary'],
    principale: ['primary'],
    scorrimento: ['trunk'],
    autostrada: ['motorway'],
  };
  const roadWidth = {
    minore: [[12, 0.4], [14, 1.4], [16, 5], [19, 20]],
    secondaria: [[9, 0.5], [13, 2], [16, 8], [19, 26]],
    principale: [[8, 0.7], [13, 2.6], [16, 10], [19, 30]],
    scorrimento: [[6, 0.8], [13, 3], [16, 11], [19, 32]],
    autostrada: [[5, 1], [13, 3.6], [16, 13], [19, 36]],
  };
  const roadColor = {
    minore: [p.minorFill, p.minorCase],
    secondaria: [p.mainFill, p.mainCase],
    principale: [p.mainFill, p.mainCase],
    scorrimento: [p.trunkFill, p.trunkCase],
    autostrada: [p.motorwayFill, p.motorwayCase],
  };
  const order = ['minore', 'secondaria', 'principale', 'scorrimento', 'autostrada'];

  layers.push({
    id: 'ferrovia', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
    filter: ['==', ['get', 'class'], 'rail'],
    paint: { 'line-color': p.rail, 'line-width': width([[11, 0.5], [16, 2.5]]), 'line-dasharray': [3, 2] },
  });

  for (const key of order) {
    layers.push({
      id: `bordo-${key}`, type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', roadClasses[key]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': roadColor[key][1],
        'line-width': width(roadWidth[key].map(([z, w]) => [z, w + (key === 'minore' ? 1 : 2.2)])),
      },
    });
  }
  for (const key of order) {
    layers.push({
      id: `strada-${key}`, type: 'line', source: 'omt', 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', roadClasses[key]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': roadColor[key][0], 'line-width': width(roadWidth[key]) },
    });
  }

  layers.push({
    id: 'confini', type: 'line', source: 'omt', 'source-layer': 'boundary',
    filter: ['<=', ['get', 'admin_level'], 4],
    paint: { 'line-color': p.boundary, 'line-width': width([[4, 0.6], [10, 1.6]]), 'line-dasharray': [4, 3] },
  });

  if (labels) layers.push(
    {
      id: 'etichette-strade', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
        'text-font': FONT,
        'text-size': fade([[13, 10], [18, 14]]),
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'viewport',
      },
      paint: { 'text-color': p.roadLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'etichette-acqua', type: 'symbol', source: 'omt', 'source-layer': 'water_name', minzoom: 9,
      layout: {
        'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
        'text-font': FONT, 'text-size': 12, 'text-max-width': 6,
      },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'etichette-luoghi', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:it'], ['get', 'name']],
        'text-font': FONT_BOLD,
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          6, ['case', ['==', ['get', 'class'], 'city'], 13, 10],
          12, ['case', ['==', ['get', 'class'], 'city'], 19, 14],
          16, ['case', ['==', ['get', 'class'], 'city'], 22, 15],
        ],
        'text-max-width': 8,
        'text-transform': 'none',
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
    }
  );

  const style = {
    version: 8,
    name: `ARGO Drive ${name}`,
    // Con la camera inclinata la fascia alta dello schermo è cielo:
    // senza, la mappa sembra tagliata di netto sull'orizzonte.
    sky: {
      'sky-color': p.sky,
      'horizon-color': p.horizon,
      'fog-color': p.land,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.05,
    },
    sources: {
      omt: { type: 'vector', url: VECTOR_TILES, attribution: ATTRIBUTION },
    },
    layers,
  };
  if (labels) style.glyphs = GLYPHS;
  return style;
}

/** Stile di riserva: tile raster, stessa aria della palette scelta. */
export function buildRasterStyle(name) {
  const p = PALETTES[name] || PALETTES.giorno;
  const r = RASTER[name] || RASTER.giorno;
  return {
    version: 8,
    name: `ARGO Drive ${name} (raster)`,
    sources: {
      base: { type: 'raster', tiles: r.tiles, tileSize: 256, maxzoom: 19, attribution: r.attribution },
    },
    layers: [
      { id: 'sfondo', type: 'background', paint: { 'background-color': p.land } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 1 } },
    ],
  };
}

/** Stile satellite (Esri World Imagery), utile per orientarsi in campagna. */
export function buildSatelliteStyle() {
  return {
    version: 8,
    name: 'ARGO Drive satellite',
    sources: {
      sat: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri',
      },
    },
    layers: [
      { id: 'sfondo', type: 'background', paint: { 'background-color': '#0B0D10' } },
      { id: 'sat', type: 'raster', source: 'sat' },
    ],
  };
}
