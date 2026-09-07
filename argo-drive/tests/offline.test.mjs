/* ============================================================
   Test offline/impostazioni — ARGO Drive
     npm i -D playwright && node tests/offline.test.mjs
   Verifica cache Overpass, persistenza impostazioni, segnalazioni,
   export e apertura dell'app senza rete (service worker).
   ============================================================ */
import { chromium } from 'playwright';
import { check, finish } from './assert.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(4176,r));

const overpass={elements:[
 {type:'way',id:1,tags:{highway:'secondary',name:'Rruga e Elbasanit',maxspeed:'50'},
  geometry:Array.from({length:30},(_,i)=>({lat:41.3200,lon:19.8180+i*0.0004}))},
 {type:'node',id:11,lat:41.3200,lon:19.8220,tags:{traffic_calming:'hump'}},
]};
const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const ctx=await browser.newContext({viewport:{width:414,height:896},isMobile:true,hasTouch:true,locale:'it-IT',
  permissions:['geolocation'],geolocation:{latitude:41.3200,longitude:19.8185,accuracy:9}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
let calls=0;
await ctx.route('**/api/interpreter', r=>{calls++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(overpass)});});
await ctx.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com|tiles\.openfreemap\.org/, r=>r.abort());
await page.goto('http://localhost:4176/',{waitUntil:'networkidle'});
await page.click('#btn-start'); await page.waitForTimeout(3000);
console.log('1) prima sessione');
check('una sola richiesta Overpass da fermo', calls === 1, calls);
check('i dati OSM risultano caricati', (await page.textContent('#pill-data')).includes('Dati OSM'));

// impostazioni: tema, tolleranza, livelli
await page.evaluate(()=>window.ARGO_DRIVE.ui.setSheet('full')); await page.waitForTimeout(400);
await page.click('.tab[data-panel="livelli"]'); await page.waitForTimeout(300);
await page.click('#theme-seg button[data-theme="notte"]');
await page.click('#tol-seg button[data-tol="0"]');
await page.click('#radius-seg button[data-radius="1500"]');
await page.click('#unit-seg button[data-unit="mph"]');
await page.click('input[data-layer="curated"]');
await page.waitForTimeout(300);
await page.click('#mode-seg button[data-mode="nord"]');
const impostazioni = await page.evaluate(()=>JSON.parse(localStorage.getItem('argo-drive:settings:v2')));
console.log('\n2) impostazioni');
check('il tema scelto viene salvato', impostazioni.theme === 'notte', impostazioni.theme);
check('l\'orientamento scelto viene salvato', impostazioni.mode === 'nord', impostazioni.mode);
check('tolleranza, raggio e unità vengono salvati',
  impostazioni.tolerance === 0 && impostazioni.radius === 1500 && impostazioni.unit === 'mph', impostazioni);
check('lo spegnimento di un livello viene salvato', impostazioni.layers.curated === false, impostazioni.layers);
check('le unità cambiano subito sullo schermo', (await page.textContent('#speed-unit')) === 'mph');
check('i FAB spariscono con il pannello aperto',
  await page.evaluate(()=>getComputedStyle(document.querySelector('.fabs')).opacity === '0'));
await page.evaluate(()=>window.ARGO_DRIVE.ui.setSheet('peek')); await page.waitForTimeout(300);

// segnalazione con long press sulla mappa
await page.mouse.move(200, 420); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
await page.waitForTimeout(400);
const sheetOpen = await page.evaluate(()=>document.querySelector('.panel[data-panel="segnala"]').classList.contains('is-on'));
await page.fill('#report-note','buca profonda');
await page.click('.chip-btn[data-kind="buca"]'); await page.waitForTimeout(400);
const rep = await page.evaluate(()=>window.ARGO_DRIVE.reports.items[0]);
console.log('\n3) segnalazioni');
check('la pressione prolungata apre il pannello segnala', sheetOpen === true);
check('la segnalazione nasce nel punto premuto, non sul GPS',
  rep && rep.kind === 'buca' && rep.note === 'buca profonda' && Math.abs(rep.lat - 41.3200) > 0.0002, rep);

// file esterno malformato: va ripulito, non ingoiato
const importati = await page.evaluate(() => window.ARGO_DRIVE.reports.merge(JSON.stringify({ items: [
  { id: 'x1', kind: 'inventato', lat: 41.32, lon: 19.82, note: 'A'.repeat(500), ts: Date.now() },
  { id: 'x2', kind: 'buca', lat: 999, lon: 19.82, ts: Date.now() },
  { id: 'x3', kind: 'buca', lat: '41.33', lon: '19.83', ts: 'ieri' },
] })));
const ripuliti = await page.evaluate(() => window.ARGO_DRIVE.reports.items.filter(r=>r.id.startsWith('x')));
check('l\'import scarta le coordinate impossibili', !ripuliti.some(r=>r.id==='x2'), ripuliti);
check('l\'import normalizza tipo, nota e data',
  ripuliti.length === 2 && ripuliti[0].kind === 'pericolo' && ripuliti[0].note.length <= 120 && Number.isFinite(ripuliti[1].ts), ripuliti);
await page.evaluate(() => { ['x1','x3'].forEach(id => window.ARGO_DRIVE.reports.remove(id)); });

// export
await page.evaluate(()=>{ window.ARGO_DRIVE.ui.setSheet('full'); window.ARGO_DRIVE.ui.showPanel('segnala'); });
await page.waitForTimeout(400);
const dl = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]).then(r=>r[0]);
check('l\'export produce un file datato', /^argo-drive-segnalazioni-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());

// seconda sessione: Overpass irraggiungibile → deve usare la cache
await ctx.route('**/api/interpreter', r=>r.abort());
await page.reload({waitUntil:'networkidle'});
await page.click('#btn-start'); await page.waitForTimeout(3500);
console.log('\n4) rete che manca');
const cache = {
  pill: (await page.textContent('#pill-data')).trim(),
  strade: await page.evaluate(()=>window.ARGO_DRIVE.source.data?.roads.length ?? 0),
  limite: await page.textContent('#limit-value'),
  unita: await page.textContent('#speed-unit'),
  segnalazioni: await page.evaluate(()=>window.ARGO_DRIVE.reports.items.length),
};
check('con Overpass irraggiungibile si usa la cache', cache.pill.includes('cache') && cache.strade > 0, cache);
check('il limite resta disponibile dalla cache', cache.limite === '31' && cache.unita === 'mph', cache);
check('le segnalazioni sopravvivono al riavvio', cache.segnalazioni === 1, cache.segnalazioni);

// service worker + offline totale
const swState = await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(); return r? (r.active?'active':'installing'):'none';});
await ctx.setOffline(true);
let offlineOk=false;
try { await page.reload({waitUntil:'domcontentloaded', timeout:15000}); offlineOk = await page.evaluate(()=>!!document.querySelector('#btn-start')); } catch(e){ offlineOk = 'errore: '+e.message.slice(0,60); }
console.log('\n5) offline totale');
check('il service worker è attivo', swState === 'active', swState);
check('l\'app si apre senza rete', offlineOk === true, offlineOk);
await ctx.setOffline(false);
check('nessun errore di pagina', errs.length === 0, errs);
await browser.close(); server.close();
finish('offline.test.mjs');
