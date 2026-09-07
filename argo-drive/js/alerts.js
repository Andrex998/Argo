/* ============================================================
   ARGO Drive — alerts.js
   Decide cosa merita l'attenzione di chi guida e come dirlo.

   Principio: in auto lo schermo è un lusso, l'orecchio no.
   Ogni allerta ha una soglia di distanza legata alla velocità
   (≈10 secondi di anticipo), un filtro "davanti a me" e un
   cooldown, perché un navigatore che parla troppo viene spento.
   ============================================================ */

import { haversine, bearing, angleDelta, distanceToLine, pointInRing, outsideBbox, formatDistance } from './geo.js';

const LEVEL_RANK = { danger: 3, warn: 2, info: 1 };

/** OSM ha già una zona mappata sopra il punto curato? Allora vince OSM. */
function osmCoversSpot(spot, data) {
  if (!data || !data.zones.length) return false;
  return data.zones.some((z) => {
    const cx = (z.box[0] + z.box[2]) / 2;
    const cy = (z.box[1] + z.box[3]) / 2;
    return haversine([spot.lat, spot.lon], [cx, cy]) < spot.radius + 200;
  });
}

const POINT_META = {
  camera: { level: 'warn', icon: 'camera', title: 'Autovelox', voice: (d) => `Autovelox tra ${d}` },
  calming: { level: 'info', icon: 'bump', title: 'Dosso', voice: (d) => `Dosso tra ${d}` },
  crossing: { level: 'warn', icon: 'rail', title: 'Passaggio a livello', voice: (d) => `Passaggio a livello tra ${d}` },
  barrier: { level: 'info', icon: 'gate', title: 'Sbarra o dissuasore', voice: (d) => `Sbarra tra ${d}` },
  hazard: { level: 'warn', icon: 'alert', title: 'Pericolo segnalato', voice: (d) => `Pericolo tra ${d}` },
};

const REPORT_META = {
  buca: { level: 'warn', icon: 'alert', title: 'Buca segnalata' },
  polizia: { level: 'info', icon: 'police', title: 'Controllo polizia' },
  autovelox: { level: 'warn', icon: 'camera', title: 'Autovelox segnalato' },
  incidente: { level: 'danger', icon: 'alert', title: 'Incidente' },
  chiusa: { level: 'danger', icon: 'block', title: 'Strada chiusa' },
  animali: { level: 'warn', icon: 'alert', title: 'Animali sulla strada' },
  pericolo: { level: 'warn', icon: 'alert', title: 'Pericolo' },
};

/**
 * Elenco "vicino a te": tutto ciò che sta intorno, senza il filtro
 * del cono di marcia. Le allerte servono a chi guida; questa lista
 * serve a chi guarda, quindi dice anche cosa si è appena passato.
 */
export function nearbyList(point, data, reports, curated, radius = 1200) {
  const out = [];
  const add = (level, icon, title, detail, distance, id) =>
    out.push({ id, level, icon, title, detail, distance });

  for (const p of (data ? data.points : [])) {
    const meta = POINT_META[p.kind];
    if (!meta) continue;
    const d = haversine(point, [p.lat, p.lon]);
    if (d <= radius) add(meta.level, meta.icon, meta.title, p.label, d, `n-pt:${p.id}`);
  }
  for (const z of (data ? data.zones : [])) {
    if (outsideBbox(point, z.box, radius)) continue;
    const inside = pointInRing(point, z.ring);
    const hit = distanceToLine(point, z.ring);
    const d = inside ? 0 : (hit ? hit.dist : Infinity);
    if (d > radius) continue;
    const label = z.kind === 'lez' ? 'Zona a emissioni limitate' : 'Area pedonale';
    add(inside ? 'danger' : 'warn', 'block', label, z.name || 'Accesso vietato ai veicoli', d, `n-z:${z.id}`);
  }
  for (const r of (data ? data.roads : [])) {
    if (!r.block && !r.rough) continue;
    if (outsideBbox(point, r.box, 600)) continue;
    const hit = distanceToLine(point, r.coords);
    if (!hit || hit.dist > 600) continue;
    add(r.block ? 'warn' : 'info', r.block ? 'block' : 'rough',
      r.block ? 'Divieto di accesso' : 'Strada dissestata',
      `${r.name || 'Senza nome'} — ${r.block || r.rough}`, hit.dist, `n-r:${r.id}`);
  }
  for (const rep of reports || []) {
    const meta = REPORT_META[rep.kind] || REPORT_META.pericolo;
    const d = haversine(point, [rep.lat, rep.lon]);
    if (d <= radius * 1.5) add(meta.level, meta.icon, meta.title, rep.note || 'Segnalazione tua o del gruppo', d, `n-rep:${rep.id}`);
  }
  for (const c of curated || []) {
    if (osmCoversSpot(c, data)) continue;
    const d = Math.max(0, haversine(point, [c.lat, c.lon]) - c.radius);
    if (d <= radius * 1.5) add('warn', c.kind === 'mountain' ? 'rough' : 'block', c.name, `${c.note} · indicativo`, d, `n-cur:${c.id}`);
  }

  return out.sort((a, b) => a.distance - b.distance).slice(0, 12);
}

export class Voice {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.voice = null;
    this.ready = false;
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => v.lang === 'it-IT') || voices.find((v) => v.lang.startsWith('it')) || null;
      };
      pick();
      speechSynthesis.addEventListener('voiceschanged', pick);
    }
  }

  /** Va chiamato da un gesto utente: iOS non sblocca l'audio altrimenti. */
  unlock() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
      this.ready = true;
    } catch { this.ready = false; }
  }

  tone(level) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const seq = level === 'danger' ? [[880, 0], [660, 0.16]] : level === 'warn' ? [[760, 0]] : [[560, 0]];
    for (const [freq, at] of seq) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.14);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.16);
    }
  }

  say(text, level = 'info') {
    if (!this.enabled) return;
    this.tone(level);
    if (!('speechSynthesis' in window)) return;
    try {
      if (level === 'danger') speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      if (this.voice) u.voice = this.voice;
      u.rate = 1.05;
      u.pitch = 1;
      setTimeout(() => speechSynthesis.speak(u), level === 'danger' ? 180 : 0);
    } catch { /* sintesi non disponibile: resta il tono */ }
  }
}

export class AlertEngine {
  constructor(voice, settings) {
    this.voice = voice;
    this.settings = settings;
    this.spoken = new Map();   // id → { ts, dist }
    this.overspeedSince = null;
    this.overspeedSpoken = 0;
    this.insideZones = new Set();
  }

  /**
   * @returns {Array} allerte attive ordinate per priorità
   */
  evaluate(ctx) {
    const { point, heading, speedMs, data, reports, curated, limit } = ctx;
    const out = [];
    const speedKmh = speedMs * 3.6;
    const moving = speedMs > 1.4 && heading != null && !Number.isNaN(heading);
    // ~10 secondi di anticipo, con un minimo urbano e un tetto extraurbano
    const lookahead = Math.max(150, Math.min(700, speedMs * 10));

    /* --- eccesso di velocità --- */
    const tol = this.settings.tolerance;
    if (limit && limit.kmh && speedKmh > limit.kmh + tol) {
      if (this.overspeedSince === null) this.overspeedSince = Date.now();
      const held = Date.now() - this.overspeedSince;
      const over = Math.round(speedKmh - limit.kmh);
      out.push({
        id: 'overspeed',
        level: 'danger',
        icon: 'speed',
        title: `+${over} km/h sul limite`,
        detail: `Limite ${limit.kmh} km/h${limit.presumed ? ' (presunto)' : ''} · stai a ${Math.round(speedKmh)}`,
        distance: 0,
        sticky: true,
      });
      // Parla solo se l'eccesso dura da 3s, e ripete solo se peggiora
      if (held > 3000 && (over >= this.overspeedSpoken + 8 || this.canSpeak('overspeed', 30000))) {
        this.overspeedSpoken = over;
        this.mark('overspeed', 0);
        this.voice.say(`Limite ${limit.kmh}. Stai andando a ${Math.round(speedKmh)}.`, 'danger');
      }
    } else {
      this.overspeedSince = null;
      this.overspeedSpoken = 0;
    }

    /* --- strada corrente vietata o dissestata --- */
    const road = limit && limit.road;
    if (road && road.block) {
      out.push({
        id: `block:${road.id}`, level: 'danger', icon: 'block',
        title: 'Strada vietata alle auto',
        detail: `${road.name || 'Questa strada'} — ${road.block}`,
        distance: 0, sticky: true,
      });
      this.speakOnce(`block:${road.id}`, 'Attenzione: strada vietata ai veicoli.', 'danger', 0);
    } else if (road && road.rough) {
      out.push({
        id: `rough:${road.id}`, level: 'warn', icon: 'rough',
        title: 'Fondo dissestato',
        detail: `${road.name || 'Strada'} — ${road.rough}`,
        distance: 0,
      });
      this.speakOnce(`rough:${road.id}`, 'Fondo dissestato.', 'warn', 0);
    }

    /* --- zone: dentro o in avvicinamento --- */
    for (const zone of (data ? data.zones : [])) {
      if (outsideBbox(point, zone.box, lookahead)) { this.insideZones.delete(zone.id); continue; }
      const inside = pointInRing(point, zone.ring);
      const hit = distanceToLine(point, zone.ring);
      const dist = inside ? 0 : (hit ? hit.dist : Infinity);
      const label = zone.kind === 'lez' ? 'Zona a emissioni limitate' : 'Area pedonale';

      if (inside) {
        out.push({
          id: `zone:${zone.id}`, level: 'danger', icon: 'block',
          title: `Sei dentro: ${label}`,
          detail: zone.name || 'Accesso ai veicoli non consentito',
          distance: 0, sticky: true,
        });
        if (!this.insideZones.has(zone.id)) {
          this.insideZones.add(zone.id);
          this.voice.say(`Attenzione, ${label.toLowerCase()}.`, 'danger');
        }
        continue;
      }
      this.insideZones.delete(zone.id);
      if (dist > lookahead) continue;
      if (moving && !this.isAhead(point, [hit.point[0], hit.point[1]], heading, dist)) continue;
      out.push({
        id: `zone:${zone.id}`, level: 'warn', icon: 'block',
        title: label, detail: zone.name || '', distance: dist,
      });
      this.speakOnce(`zone:${zone.id}`, `${label} tra ${formatDistance(dist)}`, 'warn', dist);
    }

    /* --- punti OSM: autovelox, dossi, passaggi a livello, sbarre --- */
    for (const p of (data ? data.points : [])) {
      const meta = POINT_META[p.kind];
      if (!meta) continue;
      if (!this.settings.layers[p.kind === 'camera' ? 'cameras' : 'hazards']) continue;
      const dist = haversine(point, [p.lat, p.lon]);
      const range = p.kind === 'camera' ? lookahead : Math.min(lookahead, 250);
      if (dist > range) continue;
      if (moving && !this.isAhead(point, [p.lat, p.lon], heading, dist)) continue;
      out.push({
        id: `pt:${p.id}`, level: meta.level, icon: meta.icon,
        title: meta.title, detail: p.label, distance: dist,
      });
      this.speakOnce(`pt:${p.id}`, meta.voice(formatDistance(dist)), meta.level, dist);
    }

    /* --- strade vietate/dissestate in avvicinamento (solo le vicine) --- */
    for (const r of (data ? data.roads : [])) {
      if (!r.block && !r.rough) continue;
      if (road && r.id === road.id) continue;
      if (outsideBbox(point, r.box, 120)) continue;
      const hit = distanceToLine(point, r.coords);
      if (!hit || hit.dist > 120) continue;
      if (moving && !this.isAhead(point, hit.point, heading, hit.dist)) continue;
      out.push({
        id: `road:${r.id}`, level: r.block ? 'warn' : 'info',
        icon: r.block ? 'block' : 'rough',
        title: r.block ? 'Divieto di accesso' : 'Strada dissestata',
        detail: `${r.name || 'Senza nome'} — ${r.block || r.rough}`,
        distance: hit.dist,
      });
    }

    /* --- segnalazioni personali --- */
    for (const rep of reports || []) {
      const meta = REPORT_META[rep.kind] || REPORT_META.pericolo;
      const dist = haversine(point, [rep.lat, rep.lon]);
      if (dist > Math.min(lookahead, 400)) continue;
      if (moving && !this.isAhead(point, [rep.lat, rep.lon], heading, dist)) continue;
      out.push({
        id: `rep:${rep.id}`, level: meta.level, icon: meta.icon,
        title: meta.title, detail: rep.note || 'Segnalazione tua o del gruppo', distance: dist,
      });
      this.speakOnce(`rep:${rep.id}`, `${meta.title} tra ${formatDistance(dist)}`, meta.level, dist);
    }

    /* --- punti curati: promemoria, non verdetti ---
       Sono cerchi indicativi disegnati a mano. Non possono valere
       quanto una geometria OSM: restano sempre "warn", e tacciono
       del tutto se OSM ha già mappato un'area lì vicino. */
    for (const c of curated || []) {
      const dist = haversine(point, [c.lat, c.lon]);
      const edge = Math.max(0, dist - c.radius);
      if (edge > Math.min(lookahead, 500)) continue;
      if (osmCoversSpot(c, data)) continue;
      out.push({
        id: `cur:${c.id}`, level: 'warn', icon: c.kind === 'mountain' ? 'rough' : 'block',
        title: c.name,
        detail: `${c.note} · indicativo, verifica la segnaletica`,
        distance: edge,
      });
      this.speakOnce(
        `cur:${c.id}`,
        edge === 0 ? `Sei nella zona di ${c.name}` : `${c.name} tra ${formatDistance(edge)}`,
        'warn', edge
      );
    }

    out.sort((a, b) => {
      const r = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
      return r !== 0 ? r : a.distance - b.distance;
    });
    return out;
  }

  /** L'oggetto è davanti a me (cono ±55°)? A meno di 40m conta comunque. */
  isAhead(from, to, heading, dist) {
    if (dist < 40) return true;
    const b = bearing(from, to);
    return angleDelta(b, heading) <= 55;
  }

  canSpeak(id, cooldown) {
    const prev = this.spoken.get(id);
    return !prev || Date.now() - prev.ts > cooldown;
  }

  mark(id, dist) {
    this.spoken.set(id, { ts: Date.now(), dist });
    if (this.spoken.size > 400) {
      const cutoff = Date.now() - 600000;
      for (const [k, v] of this.spoken) if (v.ts < cutoff) this.spoken.delete(k);
    }
  }

  /** Un oggetto si annuncia una volta sola, finché non ci si riallontana. */
  speakOnce(id, text, level, dist) {
    const prev = this.spoken.get(id);
    const reapproach = prev && dist > prev.dist + 300;
    if (prev && !reapproach && Date.now() - prev.ts < 180000) return;
    this.mark(id, dist);
    this.voice.say(text, level);
  }
}
