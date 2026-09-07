/* Micro-libreria di asserzioni: senza, una suite che stampa e basta
   esce con 0 anche mentre tutto brucia. */

const failures = [];
let passed = 0;

export function check(msg, condition, extra) {
  if (condition) { passed += 1; console.log('  ✓', msg); return true; }
  failures.push(msg);
  console.log('  ✗', msg, extra === undefined ? '' : `→ ${JSON.stringify(extra)}`);
  return false;
}

export const near = (value, target, tolerance) => Number.isFinite(value) && Math.abs(value - target) <= tolerance;

export function finish(name) {
  if (failures.length) {
    console.error(`\n${name}: ${failures.length} controlli falliti su ${passed + failures.length}`);
    for (const f of failures) console.error('  ✗', f);
    process.exit(1);
  }
  console.log(`\n${name}: ${passed} controlli superati.`);
}
