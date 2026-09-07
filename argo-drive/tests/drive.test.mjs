/* ============================================================
   Test di guida simulata — ARGO Drive
   Serve un Chromium di Playwright. Da /argo-drive:
     npm i -D playwright && node tests/drive.test.mjs
   Simula un tragitto a Tirana con Overpass finto e verifica
   HUD, limiti, allerte di prossimità, voce e perdita di GPS.
   ============================================================ */
import { chromium } from 'playwright';
import { check, near, finish } from './assert.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(4175,r));

const overpass={elements:[
 {type:'way',id:1,tags:{highway:'primary',name:'Rruga e Kavajës',maxspeed:'40',lanes:'4'},
  geometry:Array.from({length:60},(_,i)=>({lat:41.3270,lon:19.8100+i*0.0005}))},
 {type:'way',id:2,tags:{highway:'residential',name:'Rruga Vietata',motor_vehicle:'no'},
  geometry:[{lat:41.3276,lon:19.8150},{lat:41.3290,lon:19.8150}]},
 // area pedonale attraversata dal percorso: verifica sia l'avviso in
 // avvicinamento sia lo stato "sei dentro"
 {type:'way',id:4,tags:{highway:'pedestrian',area:'yes',name:'Sheshi Skënderbej'},
  geometry:[{lat:41.3266,lon:19.8200},{lat:41.3274,lon:19.8200},{lat:41.3274,lon:19.8214},{lat:41.3266,lon:19.8214},{lat:41.3266,lon:19.8200}]},
 {type:'node',id:10,lat:41.3270,lon:19.8205,tags:{highway:'speed_camera'}},
 {type:'node',id:11,lat:41.3270,lon:19.8175,tags:{traffic_calming:'bump'}},
 {type:'node',id:12,lat:41.3270,lon:19.8235,tags:{railway:'level_crossing'}},
 {type:'node',id:13,lat:41.3320,lon:19.8300,tags:{highway:'speed_camera'}},  // lontano, dietro: non deve suonare
]};

const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const ctx=await browser.newContext({viewport:{width:414,height:896},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  locale:'it-IT',permissions:['geolocation'],geolocation:{latitude:41.3270,longitude:19.8130,accuracy:8}});
const page=await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const queries=[];
await ctx.route('**/api/interpreter',r=>{
  const body=decodeURIComponent(r.request().postData()||'');
  const m=body.match(/around:(\d+),([\d.]+),([\d.]+)/);
  if(m) queries.push({r:+m[1], lat:+m[2], lon:+m[3]});
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(overpass)});});
await ctx.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com|tiles\.openfreemap\.org/, r=>r.abort());
await page.goto('http://localhost:4175/',{waitUntil:'networkidle'});
// intercetta la voce per verificare cosa verrebbe detto
await page.evaluate(()=>{window.SAID=[]; const orig=window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak=(u)=>{ if(u.text.trim()) window.SAID.push(u.text); };});
await page.click('#btn-start'); await page.waitForTimeout(1200);

const seen=new Set(); const track=[];
for(let i=1;i<=40;i++){
  await ctx.setGeolocation({latitude:41.32700,longitude:19.8130+i*0.00025,accuracy:8});
  await page.waitForTimeout(1000);
  const s=await page.evaluate(()=>({
    lon:+window.ARGO_DRIVE.state.fix.lon.toFixed(5),
    heading: window.ARGO_DRIVE.state.heading==null?null:Math.round(window.ARGO_DRIVE.state.heading),
    speed:document.querySelector('#speed-value').textContent,
    alerts:window.ARGO_DRIVE.state.alerts.map(a=>`${a.level}|${a.title}|${Math.round(a.distance)}`),
  }));
  track.push(s);
  s.alerts.forEach(a=>seen.add(a.split('|')[1]));
}
console.log('marcia simulata verso est a ~75 km/h');
check('la rotta viene ricavata dagli spostamenti (~90°)', near(track.at(-1).heading, 90, 6), track.at(-1).heading);
check('la velocità stimata è quella reale', near(+track.at(-1).speed, 75, 8), track.at(-1).speed);

const tipi = [...seen];
check('avvisa gli autovelox', tipi.includes('Autovelox'), tipi);
check('avvisa i dossi', tipi.includes('Dosso'), tipi);
check('avvisa i passaggi a livello', tipi.includes('Passaggio a livello'), tipi);
check('avvisa le aree pedonali in avvicinamento', tipi.includes('Area pedonale'), tipi);
check('dichiara quando ci sei dentro', tipi.some(t=>t.startsWith('Sei dentro')), tipi);
check('avvisa i divieti di accesso', tipi.includes('Divieto di accesso'), tipi);
check('segnala il superamento del limite', tipi.some(t=>t.includes('km/h sul limite')), tipi);
check('l\'autovelox alle spalle non viene annunciato', !tipi.includes('Autovelox dietro'), tipi);
console.log('\nallerte a metà percorso (lon', track[18].lon, '):'); track[18].alerts.forEach(a=>console.log('  ',a));
const dette = await page.evaluate(()=>window.SAID);
console.log('\nfrasi pronunciate:'); console.log(dette.map(s=>' 🔊 '+s).join('\n'));
check('la voce annuncia il limite superato', dette.some(f=>/Limite \d+\. Stai andando a \d+/.test(f)), dette);
check('la voce annuncia i pericoli in avvicinamento', dette.some(f=>/tra \d+ m/.test(f)), dette);
const toasts=await page.evaluate(()=>[...document.querySelectorAll('.toast')].map(e=>e.textContent.trim()));
check('nessun avviso di errore GPS durante la marcia', toasts.length === 0, toasts);

await page.screenshot({path:'/tmp/drive-hud.png'});
// GPS perso: smetto di aggiornare la posizione oltre la soglia di 20 s
await page.waitForTimeout(23000);
const perso = await page.evaluate(()=>({
  pill:document.querySelector('#pill-gps').textContent.trim(),
  alert:document.querySelector('#alert-stack').textContent.replace(/\s+/g,' ').trim(),
  speed:document.querySelector('#speed-value').textContent}));
console.log('\ndopo 23 s senza fix →', perso);
check('il GPS perso viene dichiarato', perso.pill.includes('GPS perso'), perso.pill);
check('le allerte vengono sospese senza posizione', perso.alert.includes('Segnale GPS perso'), perso.alert);
check('il tachimetro non mostra un valore vecchio', perso.speed === '—', perso.speed);
check('Overpass non viene martellato', queries.length <= 3, queries.length);
check('le query sono centrate davanti al veicolo', queries.length > 1 && queries[1].lon > queries[0].lon, queries);
console.log('\nrichieste Overpass:', queries.length);
queries.forEach((q,i)=>console.log(`  #${i+1} centro ${q.lat},${q.lon} raggio ${q.r}m — posizione reale al momento: ${track[Math.max(0,i*13)]?.lon ?? '—'}`));
check('nessun errore di pagina', errors.length === 0, errors);
await browser.close(); server.close();
finish('drive.test.mjs');
