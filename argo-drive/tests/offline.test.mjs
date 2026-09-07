/* ============================================================
   Test offline/impostazioni — ARGO Drive
     npm i -D playwright && node tests/offline.test.mjs
   Verifica cache Overpass, persistenza impostazioni, segnalazioni,
   export e apertura dell'app senza rete (service worker).
   ============================================================ */
import { chromium } from 'playwright';
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
await page.route('**/api/interpreter', r=>{calls++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(overpass)});});
await page.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com/, r=>r.abort());
await page.goto('http://localhost:4176/',{waitUntil:'networkidle'});
await page.click('#btn-start'); await page.waitForTimeout(3000);
console.log('1) prima sessione — chiamate Overpass:', calls, '| pill:', await page.textContent('#pill-data'));

// impostazioni: tema, tolleranza, livelli
await page.click('#btn-layers'); await page.waitForTimeout(200);
await page.click('#theme-seg button[data-theme="chiaro"]');
await page.click('#tol-seg button[data-tol="0"]');
await page.click('#radius-seg button[data-radius="1500"]');
await page.click('#unit-seg button[data-unit="mph"]');
await page.click('input[data-layer="curated"]');
await page.waitForTimeout(300);
console.log('2) impostazioni salvate:', await page.evaluate(()=>localStorage.getItem('argo-drive:settings:v1')));
console.log('   unità mostrata:', await page.textContent('#speed-unit'), '| limite:', await page.textContent('#limit-value'));
await page.click('#sheet-layers [data-close]');

// segnalazione con long press sulla mappa
await page.mouse.move(200, 500); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
await page.waitForTimeout(400);
const sheetOpen = await page.evaluate(()=>!document.querySelector('#sheet-report').hidden);
await page.fill('#report-note','buca profonda');
await page.click('.chip[data-kind="buca"]'); await page.waitForTimeout(400);
const rep = await page.evaluate(()=>window.ARGO_DRIVE.reports.items[0]);
console.log('3) long-press apre il pannello:', sheetOpen, '| segnalazione:', rep && `${rep.kind} "${rep.note}" @${rep.lat.toFixed(4)},${rep.lon.toFixed(4)}`);

// export
const dl = await Promise.all([page.waitForEvent('download'), page.click('#btn-report').then(()=>page.click('#btn-export'))]).then(r=>r[0]);
console.log('4) export:', dl.suggestedFilename());

// seconda sessione: Overpass irraggiungibile → deve usare la cache
await page.route('**/api/interpreter', r=>r.abort());
await page.reload({waitUntil:'networkidle'});
await page.click('#btn-start'); await page.waitForTimeout(3500);
console.log('5) Overpass KO — pill:', (await page.textContent('#pill-data')).trim(),
            '| strade in cache:', await page.evaluate(()=>window.ARGO_DRIVE.source.data?.roads.length ?? 0),
            '| limite:', await page.textContent('#limit-value'), await page.textContent('#speed-unit'));
console.log('   segnalazioni sopravvissute al reload:', await page.evaluate(()=>window.ARGO_DRIVE.reports.items.length));

// service worker + offline totale
const swState = await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(); return r? (r.active?'active':'installing'):'none';});
await ctx.setOffline(true);
let offlineOk=false;
try { await page.reload({waitUntil:'domcontentloaded', timeout:15000}); offlineOk = await page.evaluate(()=>!!document.querySelector('#btn-start')); } catch(e){ offlineOk = 'errore: '+e.message.slice(0,60); }
console.log('6) service worker:', swState, '| app si apre offline:', offlineOk);
await ctx.setOffline(false);
console.log('pageerror:', errs.length?errs:'nessuno');
await browser.close(); server.close();
