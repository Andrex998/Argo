/* ============================================================
   ARGO Drive — guidance.js
   La guida svolta per svolta: dove sei lungo il percorso, quanto
   manca alla prossima manovra, quando parlare, quando ricalcolare.

   Regola di fondo: si parla presto abbastanza da poter cambiare
   corsia, e una volta sola per soglia. Un navigatore che ripete
   viene spento, uno che avvisa tardi fa sbagliare svolta.
   ============================================================ */

import { haversine, distanceToLine, projector } from './geo.js';
import { distanzaParlata, maneuverIcon } from './router.js';

const SOGLIE_URBANE = [500, 200, 100, 40];
const SOGLIE_VELOCI = [2000, 1000, 500, 200, 80];
const FUORI_ROTTA_M = 55;
const FUORI_ROTTA_TICK = 4;
const ARRIVO_M = 25;

export class Guidance {
  constructor(voice) {
    this.voice = voice;
    this.reset();
  }

  reset() {
    this.route = null;
    this.destination = null;
    this.index = 0;
    this.dette = new Set();
    this.fuoriRottaTick = 0;
    this.needsReroute = false;
    this.arrived = false;
    this.storicoVelocita = [];
    this.startedAt = null;
  }

  start(route, destination) {
    const wasActive = this.active;
    this.reset();
    this.route = route;
    this.destination = destination;
    this.startedAt = Date.now();
    if (route.steps.length) {
      const primo = route.steps[0];
      this.voice.say(wasActive ? 'Percorso ricalcolato' : primo.instruction, 'info');
      if (!wasActive) this.dette.add('partenza');
    }
  }

  stop() {
    const era = this.active;
    this.reset();
    return era;
  }

  get active() {
    return !!this.route;
  }

  /**
   * Da chiamare a ogni tick con la posizione corrente.
   * @returns {object|null} stato della navigazione
   */
  update(point, speedMs) {
    if (!this.route) return null;

    const snap = this.snap(point);
    const percorso = this.route;
    const restanteM = Math.max(0, percorso.distance - snap.along);

    // fuori rotta: si insiste qualche secondo prima di dirlo, perché
    // il GPS in città sbaglia di venti metri con disinvoltura
    if (snap.dist > FUORI_ROTTA_M && speedMs > 1.4) {
      this.fuoriRottaTick += 1;
      if (this.fuoriRottaTick === FUORI_ROTTA_TICK) {
        this.needsReroute = true;
        this.voice.say('Fuori percorso, ricalcolo', 'warn');
      }
    } else {
      this.fuoriRottaTick = 0;
    }

    this.storicoVelocita.push(speedMs);
    if (this.storicoVelocita.length > 90) this.storicoVelocita.shift();

    const passo = this.prossimoPasso(snap.along);
    const distanzaManovra = passo ? Math.max(0, passo.along - snap.along) : restanteM;
    const restanteS = this.tempoRestante(snap.along, restanteM);

    if (!this.arrived && (restanteM <= ARRIVO_M || haversine(point, [this.destination.lat, this.destination.lon]) <= ARRIVO_M)) {
      this.arrived = true;
      this.voice.say('Sei arrivato a destinazione', 'info');
    } else if (passo) {
      this.annuncia(passo, distanzaManovra, speedMs);
    }

    return {
      active: true,
      arrived: this.arrived,
      offRoute: this.fuoriRottaTick >= FUORI_ROTTA_TICK,
      needsReroute: this.needsReroute,
      distanzaDalPercorso: snap.dist,
      along: snap.along,
      remainingM: restanteM,
      remainingS: restanteS,
      eta: new Date(Date.now() + restanteS * 1000),
      step: passo,
      instruction: passo ? passo.instruction : 'Sei arrivato',
      icon: passo ? maneuverIcon(passo) : 'arrivo',
      distanceToManeuver: distanzaManovra,
      after: this.passoSuccessivo(passo),
      destination: this.destination,
      totalM: percorso.distance,
    };
  }

  /** Aggancio alla polilinea, cercando prima intorno al punto già noto. */
  snap(point) {
    const coords = this.route.coords;
    const finestra = 60;
    let best = this.cerca(point, Math.max(0, this.index - 5), Math.min(coords.length - 1, this.index + finestra));
    if (!best || best.dist > FUORI_ROTTA_M) {
      const completo = this.cerca(point, 0, coords.length - 1);
      if (completo && (!best || completo.dist < best.dist)) best = completo;
    }
    if (!best) return { along: 0, dist: Infinity };
    this.index = best.i;
    return best;
  }

  cerca(point, da, a) {
    const { coords, cumulative } = this.route;
    if (a <= da) return null;
    const proj = projector(point);
    const p = { x: 0, y: 0 };
    let best = null;
    for (let i = da; i < a; i++) {
      const A = proj(coords[i]);
      const B = proj(coords[i + 1]);
      const vx = B.x - A.x;
      const vy = B.y - A.y;
      const len2 = vx * vx + vy * vy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - A.x) * vx + (p.y - A.y) * vy) / len2));
      const dx = A.x + t * vx - p.x;
      const dy = A.y + t * vy - p.y;
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.dist) {
        best = { i, t, dist, along: cumulative[i] + t * Math.sqrt(len2) };
      }
    }
    return best;
  }

  prossimoPasso(along) {
    const steps = this.route.steps;
    for (const s of steps) {
      if (s.type === 'depart') continue;
      if (s.along > along + 8) return s;
    }
    return steps[steps.length - 1] || null;
  }

  passoSuccessivo(passo) {
    if (!passo) return null;
    const i = this.route.steps.indexOf(passo);
    return i >= 0 ? this.route.steps[i + 1] || null : null;
  }

  /**
   * Tempo rimasto: la stima di OSRM è sulla strada libera, quindi
   * si corregge con l'andatura che stai davvero tenendo.
   */
  tempoRestante(along, restanteM) {
    const r = this.route;
    const quota = r.distance > 0 ? restanteM / r.distance : 0;
    const base = r.duration * quota;
    const mediaPercorso = r.duration > 0 ? r.distance / r.duration : 12;
    const guidate = this.storicoVelocita.filter((v) => v > 1.4);
    if (guidate.length < 15) return base;
    const mediaReale = guidate.reduce((a, b) => a + b, 0) / guidate.length;
    const fattore = Math.min(2, Math.max(0.6, mediaPercorso / Math.max(2, mediaReale)));
    return base * fattore;
  }

  /**
   * Una voce per soglia, mai due volte la stessa.
   * Si annuncia la soglia ("tra 200 metri"), non la distanza esatta
   * al momento del fix: "tra 190 metri" suona come un calcolo, non
   * come un'indicazione. Solo l'ultima soglia dice la manovra nuda,
   * altrimenti la si sente due volte in cinquanta metri.
   */
  annuncia(passo, distanza, speedMs) {
    const soglie = speedMs > 22 ? SOGLIE_VELOCI : SOGLIE_URBANE;
    const ultima = soglie[soglie.length - 1];
    const chiave = (s) => `${passo.along.toFixed(0)}:${s}`;
    for (const s of soglie) {
      if (distanza > s) continue;
      if (this.dette.has(chiave(s))) continue;
      // Le soglie più lontane, se saltate, non vanno recuperate dopo
      for (const piuLontana of soglie.filter((x) => x > s)) this.dette.add(chiave(piuLontana));
      this.dette.add(chiave(s));
      const frase = s === ultima
        ? passo.instruction
        : `Tra ${distanzaParlata(s)}, ${minuscola(passo.instruction)}`;
      this.voice.say(frase, 'info');
      return;
    }
  }
}

const minuscola = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "14:32" — l'ora di arrivo, non i minuti che mancano. */
export function orarioArrivo(date) {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** "1 h 12 min" / "8 min" */
export function durataParlata(secondi) {
  const min = Math.max(1, Math.round(secondi / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

export { distanceToLine };
