/* ============================================================
   ARGO Drive — reports.js
   Segnalazioni personali (buca, incidente, controllo, strada
   chiusa…). Restano sul telefono: non esiste un server dietro
   questa app. Si condividono esportando un file JSON — il modo
   onesto di fare "tempo reale di gruppo" senza backend.
   ============================================================ */

const KEY = 'argo-drive:reports:v1';

export const REPORT_KINDS = [
  { id: 'buca', label: 'Buca', emoji: '🕳', ttl: 30 * 24 * 3600e3 },
  { id: 'incidente', label: 'Incidente', emoji: '💥', ttl: 4 * 3600e3 },
  { id: 'chiusa', label: 'Strada chiusa', emoji: '⛔', ttl: 24 * 3600e3 },
  { id: 'polizia', label: 'Polizia', emoji: '👮', ttl: 3 * 3600e3 },
  { id: 'autovelox', label: 'Autovelox', emoji: '📸', ttl: 180 * 24 * 3600e3 },
  { id: 'animali', label: 'Animali', emoji: '🐄', ttl: 12 * 3600e3 },
  { id: 'pericolo', label: 'Altro pericolo', emoji: '⚠️', ttl: 7 * 24 * 3600e3 },
];

const ttlOf = (kind) => (REPORT_KINDS.find((k) => k.id === kind) || { ttl: 24 * 3600e3 }).ttl;

export class Reports {
  constructor(onChange) {
    this.onChange = onChange || (() => {});
    this.items = this.load();
  }

  load() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(items) ? items.filter((r) => this.alive(r)) : [];
    } catch {
      return [];
    }
  }

  alive(r) {
    return r && typeof r.lat === 'number' && typeof r.lon === 'number' &&
      Date.now() - (r.ts || 0) < ttlOf(r.kind);
  }

  save() {
    this.items = this.items.filter((r) => this.alive(r));
    try { localStorage.setItem(KEY, JSON.stringify(this.items)); } catch { /* quota piena */ }
    this.onChange(this.items);
  }

  add(kind, lat, lon, note = '') {
    const rep = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind, lat, lon, note, ts: Date.now(),
    };
    this.items.push(rep);
    this.save();
    return rep;
  }

  remove(id) {
    this.items = this.items.filter((r) => r.id !== id);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  toJSON() {
    return JSON.stringify({ app: 'argo-drive', v: 1, exported: new Date().toISOString(), items: this.items }, null, 2);
  }

  /**
   * Ripulisce una segnalazione che arriva da fuori: il file JSON lo
   * scrive un'altra persona (o un'altra app), quindi niente fiducia
   * su tipo, coordinate e lunghezza della nota.
   */
  sanitize(r) {
    if (!r || typeof r !== 'object') return null;
    const kind = REPORT_KINDS.some((k) => k.id === r.kind) ? r.kind : 'pericolo';
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null;
    if (!Number.isFinite(lon) || Math.abs(lon) > 180) return null;
    const ts = Number(r.ts);
    return {
      id: typeof r.id === 'string' && r.id.length <= 64 ? r.id : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      lat,
      lon,
      note: typeof r.note === 'string' ? r.note.slice(0, 120) : '',
      ts: Number.isFinite(ts) && ts > 0 && ts <= Date.now() + 3600e3 ? ts : Date.now(),
    };
  }

  /** Import additivo: gli id già presenti non vengono duplicati. */
  merge(json) {
    let incoming;
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      incoming = Array.isArray(parsed) ? parsed : parsed.items;
    } catch {
      throw new Error('File non valido');
    }
    if (!Array.isArray(incoming)) throw new Error('Nessuna segnalazione nel file');
    const known = new Set(this.items.map((r) => r.id));
    let added = 0;
    for (const raw of incoming) {
      const r = this.sanitize(raw);
      if (!r || known.has(r.id) || !this.alive(r)) continue;
      this.items.push(r);
      known.add(r.id);
      added += 1;
    }
    this.save();
    return added;
  }
}
