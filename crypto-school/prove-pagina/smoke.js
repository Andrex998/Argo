const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
// Prova della pagina senza rete: prima, in questa cartella, `npm i three@0.128.0 marked@4.3.0 dompurify@3.0.6`, poi `node smoke.js`.
const ROOT = path.join(__dirname, '..', 'pagina'), S = __dirname;
const LIB = { 'three.min.js': S + '/node_modules/three/build/three.min.js', 'marked.min.js': S + '/node_modules/marked/marked.min.js', 'purify.min.js': S + '/node_modules/dompurify/dist/purify.min.js' };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'cdnjs.cloudflare.com') return r.fulfill({ path: LIB[path.basename(u.pathname)], contentType: 'text/javascript' });
    if (u.hostname === 'school.test') { const f = ROOT + decodeURIComponent(u.pathname); const ct = f.endsWith('.js') ? 'text/javascript; charset=utf-8' : f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.webp') ? 'image/webp' : undefined; return fs.existsSync(f) ? r.fulfill({ path: f, contentType: ct }) : r.fulfill({ status: 404, body: '' }); }
    return r.abort();
  });
  await p.goto('http://school.test/scuola-cripto.html'); await p.waitForTimeout(9000);
  const info = await p.evaluate(() => ({ campus: !!window.Campus, mods: window.Campus ? Object.keys(window.Campus) : [], mode: window.Campus && Campus.life && Campus.life.state ? 1 : 0, canvas: document.querySelectorAll('canvas').length }));
  console.log(JSON.stringify(info)); console.log('errors:', errs.length, errs.slice(0, 8));
  await p.screenshot({ path: S + '/smoke.png' }); await b.close();
})();
