/* ============================================================
   Test del motore di guida — ARGO Drive
     node tests/guidance.test.mjs
   Puro Node, nessun browser: percorso sintetico, veicolo che lo
   percorre, verifica di aggancio, annunci, ricalcolo e arrivo.
   ============================================================ */
import { Guidance, durataParlata } from '../js/guidance.js';
import { cumulativeDistances } from '../js/router.js';
import { destination } from '../js/geo.js';
import { check, finish } from './assert.mjs';

// percorso finto: 1 km verso est, svolta a destra, 1 km verso sud
const start = [41.3275, 19.8000];
const coords = [];
for (let m = 0; m <= 1000; m += 20) coords.push(destination(start, 90, m));
const angolo = coords[coords.length - 1];
for (let m = 20; m <= 1000; m += 20) coords.push(destination(angolo, 180, m));
const cumulative = cumulativeDistances(coords);
const steps = [
  { at: coords[0], along: 0, type: 'depart', modifier: null, name: 'Rruga A', ref: '', distance: 1000, duration: 90, instruction: 'Parti su Rruga A' },
  { at: angolo, along: 1000, type: 'turn', modifier: 'right', name: 'Rruga A', ref: '', distance: 1000, duration: 90, instruction: 'Gira a destra in Rruga B' },
  { at: coords[coords.length - 1], along: 2000, type: 'arrive', modifier: null, name: 'Rruga B', ref: '', distance: 0, duration: 0, instruction: 'Sei arrivato' },
];
const route = { id: 'r0', coords, cumulative, steps, distance: cumulative[cumulative.length - 1], duration: 180, summary: 'test' };

const dette = [];
const voce = { say: (t) => dette.push(t), tone: () => {} };
const g = new Guidance(voce);
g.start(route, { lat: coords[coords.length - 1][0], lon: coords[coords.length - 1][1], name: 'Arrivo' });

// percorre il primo chilometro a 50 km/h (13.9 m/s)
let stato;
for (let m = 0; m <= 990; m += 30) {
  stato = g.update(destination(start, 90, m), 13.9);
}
check('aggancia il percorso', stato.distanzaDalPercorso < 5, stato.distanzaDalPercorso);
check('sa quanto manca', Math.abs(stato.remainingM - 1010) < 40, stato.remainingM);
check('punta alla svolta giusta', stato.step.type === 'turn' && stato.icon === 'destra', stato.icon);
check('annuncia a 500, 200, 100 e alla svolta',
  ['500 metri','200 metri','100 metri'].every(s => dette.some(d => d.includes(s))) && dette.includes('Gira a destra in Rruga B'), dette);
check('non ripete lo stesso annuncio', new Set(dette).size === dette.length, dette);

// dopo la svolta, verso sud
for (let m = 30; m <= 900; m += 30) stato = g.update(destination(angolo, 180, m), 13.9);
check('dopo la svolta punta all arrivo', stato.step.type === 'arrive', stato.step.type);
check('il tempo residuo è sensato', stato.remainingS > 0 && stato.remainingS < 200, Math.round(stato.remainingS));
check('l orario di arrivo è nel futuro', stato.eta.getTime() > Date.now(), stato.eta.toISOString());

// arrivo
stato = g.update(destination(angolo, 180, 995), 5);
check('dichiara l arrivo', stato.arrived && dette.includes('Sei arrivato a destinazione'), dette.at(-1));

// fuori rotta: 120 m a nord della linea
const g2 = new Guidance({ say: (t) => dette.push(t), tone: () => {} });
g2.start(route, { lat: 0, lon: 0, name: 'x' });
let fuori;
for (let i = 0; i < 5; i++) fuori = g2.update(destination(destination(start, 90, 400), 0, 120), 14);
check('rileva il fuori percorso', fuori.offRoute && fuori.needsReroute, fuori.distanzaDalPercorso);
check('lo dice una volta sola', dette.filter(d => d.includes('Fuori percorso')).length === 1);

check('formato durata', durataParlata(90) === '2 min' && durataParlata(4500) === '1 h 15 min', durataParlata(4500));
finish('guidance.test.mjs');
