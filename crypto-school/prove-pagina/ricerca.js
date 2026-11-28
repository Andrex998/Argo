const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
// Prova della sezione «La ricerca» senza rete e con un database finto: prima, in questa cartella,
// `npm i three@0.128.0 marked@4.3.0 dompurify@3.0.6`, poi `node ricerca.js`.
// Controlla che la ricerca si veda, e che testo ostile nel database non diventi codice né link.
const ROOT = path.join(__dirname, '..', 'pagina'), S = __dirname;
const LIB = { 'three.min.js': S + '/node_modules/three/build/three.min.js', 'marked.min.js': S + '/node_modules/marked/marked.min.js', 'purify.min.js': S + '/node_modules/dompurify/dist/purify.min.js' };
const BAD = '<img src=x onerror="window.__hit=1"><script>window.__hit=1</script>';
const DOCS = {
  'classe/programma': JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'programma.json'), 'utf8')),
  'ricerca/2026-11-29': {
    data: '2026-11-29', stato: 'completo', avviso: '', scritto: '2026-11-29 15:50:00',
    agenti: {
      falco: { domanda: 'Le rotture con volume reggono dopo il 2024?' + BAD, perche: 'Un errore che torna.', conclusione: 'Reggono meno.' + BAD, fiducia: 0.6, smentita: 'Un esame che dice il contrario.',
        trovato: 'Un fatto (fonte A).\n\nLa mia lettura.' + BAD, stato_d_animo: 'Ho paura di sbagliare, ma ci provo.' + BAD, scartate: 2,
        ipotesi: { nome: 'Rottura lenta' + BAD, regola: 'Entro dopo due chiusure.', dati: 'Candele a 4 ore.', smentita: 'Meno di +0,1 R.' },
        fonti: [{ titolo: 'Fonte buona', url: 'https://example.org/studio', data: '2025-03', tipo: 'studio' },
                { titolo: 'Fonte finta', url: 'javascript:window.__hit=1', tipo: 'opinione' },
                { titolo: 'Fonte rotta', url: 'https://example.org/"onmouseover="window.__hit=1', tipo: 'articolo' }] },
    },
    scettico: { testo: 'La più debole è quella del Falco.' + BAD, verifica: { chi: 'falco', affermazione: 'Reggono meno.' + BAD, esito: 'regge', nota: 'La fonte lo dice.' }, domanda_per_il_consiglio: 'Con quanti casi?' },
    preside: ['Abbiamo imparato una cosa.' + BAD, 'Un’ipotesi da discutere.', 'Non sappiamo ancora il resto.'],
  },
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.addInitScript((docs) => {
    const snap = (k) => ({ exists: k in docs, data: () => docs[k] });
    const db = { doc: (k) => ({ onSnapshot: (ok) => { setTimeout(() => ok(snap(k)), 50); return () => {}; } }),
                 collection: () => ({ onSnapshot: (ok) => { setTimeout(() => ok({ forEach() {}, docs: [] }), 50); return () => {}; }, doc: () => ({ set: async () => {} }) }) };
    window.claude = { use: async (name) => (name === 'db' ? db : null) };
  }, DOCS);
  await p.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'cdnjs.cloudflare.com') return r.fulfill({ path: LIB[path.basename(u.pathname)], contentType: 'text/javascript; charset=utf-8' });
    if (u.hostname === 'school.test') { const f = ROOT + decodeURIComponent(u.pathname); const ct = f.endsWith('.js') ? 'text/javascript; charset=utf-8' : f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : undefined; return fs.existsSync(f) ? r.fulfill({ path: f, contentType: ct }) : r.fulfill({ status: 404, body: '' }); }
    return r.abort();
  });
  await p.goto('http://school.test/scuola-cripto.html'); await p.waitForTimeout(4000);
  const got = await p.evaluate(() => {
    const el = document.getElementById('ricerca');
    return { text: el.innerText.slice(0, 160), preside: /Le righe del Preside/i.test(el.innerText), cards: el.querySelectorAll('article.mind').length, links: [...el.querySelectorAll('a')].map((a) => a.getAttribute('href')),
             bad: el.querySelectorAll('script, img, [onerror], [onmouseover]').length, hit: window.__hit || 0,
             wide: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  const checks = { 'la ricerca si vede': got.cards === 6 && got.preside, 'un solo link, quello https pulito': got.links.length === 1 && got.links[0] === 'https://example.org/studio',
                   'nessun codice dal database': got.bad === 0 && got.hit === 0, 'nessuno scorrimento orizzontale': !got.wide, 'nessun errore della pagina': errs.length === 0 };
  let fail = 0;
  for (const [k, v] of Object.entries(checks)) { console.log(v ? 'OK  ' : 'FAIL', k); if (!v) fail++; }
  if (fail) console.log(JSON.stringify(got), errs);
  await p.locator('#ricerca').screenshot({ path: S + '/ricerca.png' });
  await b.close(); process.exit(fail ? 1 : 0);
})();
