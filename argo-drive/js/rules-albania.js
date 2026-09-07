/* ============================================================
   ARGO Drive — rules-albania.js
   Regole di default, parsing dei limiti OSM e note di guida
   specifiche per l'Albania. Tutto qui dentro è *fallback*:
   la segnaletica reale vince sempre.
   ============================================================ */

/** Limiti legali generali (auto, conducente non neopatentato). */
export const DEFAULT_LIMITS = {
  urban: 40,        // centro abitato
  rural: 80,        // fuori centro abitato
  expressway: 90,   // strade interurbane principali
  motorway: 110,    // autostrada
};

/**
 * Limite presunto per tipo di strada OSM quando manca `maxspeed`.
 * `urban` = l'euristica di contesto ha rilevato un centro abitato.
 */
export function presumedLimit(highway, urban) {
  switch (highway) {
    case 'motorway': return DEFAULT_LIMITS.motorway;
    case 'motorway_link': return 90;
    case 'trunk': return urban ? DEFAULT_LIMITS.urban : DEFAULT_LIMITS.expressway;
    case 'trunk_link': return 70;
    case 'primary':
    case 'secondary':
    case 'tertiary':
    case 'unclassified':
    case 'road':
      return urban ? DEFAULT_LIMITS.urban : DEFAULT_LIMITS.rural;
    case 'primary_link':
    case 'secondary_link':
    case 'tertiary_link':
      return urban ? DEFAULT_LIMITS.urban : 60;
    case 'residential': return DEFAULT_LIMITS.urban;
    case 'living_street': return 20;
    case 'service': return 20;
    case 'track': return 30;
    default: return null;
  }
}

/**
 * Parsing di `maxspeed` OSM → km/h.
 * Gestisce numeri, mph, schemi nazionali e valori non numerici.
 * @returns {{kmh:number|null, kind:string}}
 */
export function parseMaxspeed(raw) {
  if (!raw) return { kmh: null, kind: 'none' };
  const v = String(raw).trim().toLowerCase();

  if (v === 'none') return { kmh: null, kind: 'none-limit' };
  if (v === 'walk') return { kmh: 7, kind: 'walk' };
  if (v === 'signals' || v === 'variable') return { kmh: null, kind: 'variable' };

  const mph = v.match(/^(\d+(?:\.\d+)?)\s*mph$/);
  if (mph) return { kmh: Math.round(parseFloat(mph[1]) * 1.609344), kind: 'osm' };

  const knots = v.match(/^(\d+(?:\.\d+)?)\s*knots$/);
  if (knots) return { kmh: Math.round(parseFloat(knots[1]) * 1.852), kind: 'osm' };

  const plain = v.match(/^(\d+(?:\.\d+)?)(\s*km\/h)?$/);
  if (plain) return { kmh: Math.round(parseFloat(plain[1])), kind: 'osm' };

  // Schemi tipo "AL:urban", "AL:rural", "AL:motorway", "AL:living_street"
  const zone = v.match(/^([a-z]{2})(?::([a-z_]+))?$/);
  if (zone) {
    const cls = zone[2] || '';
    if (cls.includes('motorway')) return { kmh: DEFAULT_LIMITS.motorway, kind: 'scheme' };
    if (cls.includes('trunk') || cls.includes('express')) return { kmh: DEFAULT_LIMITS.expressway, kind: 'scheme' };
    if (cls.includes('rural')) return { kmh: DEFAULT_LIMITS.rural, kind: 'scheme' };
    if (cls.includes('urban')) return { kmh: DEFAULT_LIMITS.urban, kind: 'scheme' };
    if (cls.includes('living')) return { kmh: 20, kind: 'scheme' };
  }
  return { kmh: null, kind: 'unknown' };
}

/** Il veicolo a motore può passare? Legge i tag di accesso OSM. */
export function accessVerdict(tags) {
  const deny = new Set(['no', 'private', 'permit', 'military', 'customers']);
  const soft = new Set(['destination', 'delivery', 'agricultural', 'forestry']);
  const keys = ['motor_vehicle', 'motorcar', 'vehicle', 'access'];

  for (const k of keys) {
    const v = tags[k];
    if (!v) continue;
    if (deny.has(v)) return { level: 'block', reason: `${k}=${v}` };
    if (soft.has(v)) return { level: 'limited', reason: `${k}=${v}` };
  }
  if (tags.highway === 'pedestrian') return { level: 'block', reason: 'area pedonale' };
  if (tags.highway === 'footway' || tags.highway === 'path' || tags.highway === 'steps') {
    return { level: 'block', reason: 'non carrabile' };
  }
  if (tags.highway === 'living_street') return { level: 'limited', reason: 'zona residenziale' };
  return null;
}

/** Fondo stradale problematico per un'auto normale (tipico noleggio). */
export function roughVerdict(tags) {
  const badSurface = /^(unpaved|gravel|ground|dirt|earth|mud|sand|grass|pebblestone|fine_gravel|compacted|rock|woodchips)$/;
  const badSmooth = /^(bad|very_bad|horrible|very_horrible|impassable)$/;
  const reasons = [];
  if (tags.surface && badSurface.test(tags.surface)) reasons.push(`fondo ${tags.surface}`);
  if (tags.smoothness && badSmooth.test(tags.smoothness)) reasons.push(`stato ${tags.smoothness}`);
  if (tags.highway === 'track') reasons.push('strada agricola');
  if (tags.tracktype && /grade[345]/.test(tags.tracktype)) reasons.push(tags.tracktype);
  if (tags.surface === 'cobblestone' || tags.surface === 'sett') reasons.push('lastricato');
  return reasons.length ? { reason: reasons.join(' · ') } : null;
}

/**
 * Segnalazioni curate: NON sono geometrie ufficiali, sono cerchi
 * indicativi su punti noti. Servono come rete di sicurezza quando
 * OSM non risponde. Ogni voce è etichettata come "indicativo".
 */
export const CURATED_SPOTS = [
  {
    id: 'c-skanderbeg', kind: 'pedestrian', lat: 41.3275, lon: 19.8187, radius: 140,
    name: 'Sheshi Skënderbej — Tirana',
    note: 'Piazza pedonale. Accesso auto vietato: usa gli assi perimetrali.',
  },
  {
    id: 'c-toptani', kind: 'pedestrian', lat: 41.3259, lon: 19.8210, radius: 90,
    name: 'Rruga Murat Toptani — Tirana',
    note: 'Strada pedonale nel centro storico.',
  },
  {
    id: 'c-pazari', kind: 'pedestrian', lat: 41.3294, lon: 19.8251, radius: 110,
    name: 'Pazari i Ri — Tirana',
    note: 'Area del bazar: vie pedonali e accesso limitato nelle traverse.',
  },
  {
    id: 'c-blloku', kind: 'caution', lat: 41.3200, lon: 19.8180, radius: 250,
    name: 'Blloku — Tirana',
    note: 'Traffico intenso, sensi unici, sosta quasi impossibile la sera.',
  },
  {
    id: 'c-gjirokaster', kind: 'oldtown', lat: 40.0758, lon: 20.1389, radius: 400,
    name: 'Centro storico di Gjirokastër',
    note: 'Vie lastricate ripidissime e strette. Lascia l’auto nei parcheggi bassi.',
  },
  {
    id: 'c-berat', kind: 'oldtown', lat: 40.7050, lon: 19.9490, radius: 400,
    name: 'Mangalem / Gorica — Berat',
    note: 'Ciottolato stretto, pendenze forti. Salita al castello sconsigliata con auto bassa.',
  },
  {
    id: 'c-kruje', kind: 'oldtown', lat: 41.5094, lon: 19.7928, radius: 250,
    name: 'Bazar di Krujë',
    note: 'Bazar pedonale, strada d’accesso stretta e in salita.',
  },
  {
    id: 'c-llogara', kind: 'mountain', lat: 40.2035, lon: 19.5860, radius: 1500,
    name: 'Passo di Llogara (SH8)',
    note: 'Tornanti continui, nebbia e vento improvvisi. Marcia bassa in discesa.',
  },
  {
    id: 'c-theth', kind: 'mountain', lat: 42.3350, lon: 19.7800, radius: 2500,
    name: 'Strada per Theth (Qafa e Thores)',
    note: 'Alta quota, tornanti stretti, tratti dissestati. Evita di notte e con pioggia.',
  },
  {
    id: 'c-koman', kind: 'mountain', lat: 42.1050, lon: 19.8200, radius: 1500,
    name: 'Accesso al lago di Koman',
    note: 'Ultimo tratto stretto e con gallerie non illuminate. Fari sempre accesi.',
  },
];

/** Contesto legale/pratico mostrato nel pannello Info. */
export const COUNTRY_BRIEF = {
  country: 'Albania (Shqipëri)',
  side: 'Guida a destra, sorpasso a sinistra.',
  emergency: [
    ['112', 'Numero unico emergenze'],
    ['129', 'Polizia'],
    ['127', 'Ambulanza'],
    ['128', 'Vigili del fuoco'],
  ],
  limits: [
    ['Centro abitato', '40 km/h'],
    ['Fuori centro abitato', '80 km/h'],
    ['Strade interurbane principali', '90 km/h'],
    ['Autostrada', '110 km/h'],
  ],
  rules: [
    'Tolleranza alcol praticamente nulla: se guidi, zero alcol.',
    'Cinture obbligatorie davanti e dietro; seggiolino per i bambini.',
    'Telefono in mano vietato: solo vivavoce.',
    'Porta sempre patente, libretto e carta verde assicurativa: i controlli sono frequenti.',
    'Le multe si pagano in banca o alla polizia stradale, mai a mano libera.',
  ],
  hazards: [
    'Illuminazione scarsa fuori città: la guida notturna su strade secondarie è la parte più rischiosa del viaggio.',
    'Pedoni, biciclette e animali sulla carreggiata anche su strade veloci.',
    'Sorpassi azzardati e veicoli fermi in seconda fila: tieni distanza doppia.',
    'Buche e tombini scoperti dopo la pioggia, soprattutto ai bordi della corsia.',
    'Nei centri storici (Berat, Gjirokastër, Krujë) le vie sono lastricate e strettissime: parcheggia fuori e prosegui a piedi.',
    'Le strade di montagna del nord possono avere tratti sterrati o frane stagionali.',
  ],
  ztl: 'In Albania non esiste una ZTL con telecamere come in Italia. I divieti reali sono aree pedonali, sensi unici e vie chiuse da dissuasori o dalla polizia durante eventi. Questa mappa li ricava da OpenStreetMap e li segnala in rosso.',
};
