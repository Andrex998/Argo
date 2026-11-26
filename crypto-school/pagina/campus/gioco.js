/* Il campus della Scuola Cripto · gioco.js: the game layer.
   The title screen, «I personaggi» (the character sheet), the cinema mode with subtitles and
   portraits, the banners when the school changes mode, the house banners in the courtyard and
   an optional soft music. It uses the Higgsfield art in arte/ (WebP, next to the page).
   It reads Campus.data, derive, life and render, and calls only Campus.ui.follow and
   Campus.render.setCameraMode. It owns the DOM it creates (class prefix cp-g-) and the
   banner meshes it adds to the scene. The page calls Campus.gioco.start() before Campus.boot. */
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.gioco) return;
  const U = C.util, bus = C.bus, D = C.derive, KEYS = C.KEYS;

  const ART = "arte/";
  const RITRATTO = (k) => `${ART}ritratto-${k}.webp`;
  const FIGURA = (k) => `${ART}figura-${k}.webp`;
  const STEMMA = (k) => `${ART}stemma-${k}.webp`;
  const BANNER_HOLD_MS = 4200;      // a mode banner stays this long
  const BANNER_GAP_MS = 9000;       // and never comes back sooner than this
  const SUB_QUEUE = 4;              // at most this many subtitles waiting
  const SUB_CPS = 42;               // typewriter speed, as the bubbles
  const PLACE_POLL_MS = 700;        // how often the cinema checks which room the camera frames
  const DUST = 70;                  // golden dust motes on the title screen

  // who they are, from agenti/*.md and preside.md
  const PERSONA = {
    preside: { titolo: "Il direttore della scuola", casa: "Casa della Chiave", motto: "Prima il metodo, poi il risultato.",
      chi: "Non fa trading. Dirige la riunione delle 7, fa domande, dà i voti e una volta al mese decide quanto rischio può prendere ciascuno." },
    falco: { titolo: "Il cacciatore di rotture", casa: "Casa del Falco", motto: "La regola dice di entrare? Quanto rischio? Dov'è lo stop?",
      chi: "Rapido, disciplinato, di poche parole. Entra quando il prezzo rompe e pensa in multipli del rischio, non in previsioni." },
    tartaruga: { titolo: "Il trend lento", casa: "Casa della Tartaruga", motto: "Non so dove andrà il prezzo; so da che parte va.",
      chi: "Paziente e umile. Segue la direzione su 1, 2, 4, 8 e 16 settimane: accetta molte piccole perdite in cambio di pochi trend grandi." },
    spazzino: { titolo: "Il compratore delle vendite forzate", casa: "Casa della Scopa", motto: "Compro solo da chi è costretto a vendere.",
      chi: "Freddo nel panico, ma sospettoso: compra quando altri vengono liquidati, mai quando qualcuno vende perché sa qualcosa." },
    ragioniere: { titolo: "Il contabile del carry", casa: "Casa della Bilancia", motto: "Chi mi paga, e perché?",
      chi: "Pignolo. Separa sempre il guadagno dal funding, quello dal prezzo e i costi, e diffida di ogni rendimento troppo alto." },
    guardiano: { titolo: "Il responsabile del rischio", casa: "Casa della Torre", motto: "Cosa succede se tutto va contro di noi insieme?",
      chi: "Pessimista di mestiere. Conta le scommesse vere, non le posizioni, e la sera suona l'allarme se il mercato si fa pericoloso." },
    cronista: { titolo: "Notizie, politica e macro", casa: "Casa della Penna", motto: "Il fatto, la fonte, l'ora.",
      chi: "Curioso e narratore, ma obbligato ai numeri: separa il fatto, l'interpretazione e quello che dicono i prezzi." },
    scettico: { titolo: "Il revisore", casa: "Casa della Civetta", motto: "Quante prove hai contato?",
      chi: "Pignolo e un po' antipatico, per mestiere: cerca il difetto in ogni idea prima che costi soldi veri." },
  };
  // the banner shown when the school changes mode; the line under it is life.modeDetail
  const MODE_CARD = {
    vita: { title: "La vita del campus", tone: "gold" },
    notte: { title: "Notte", tone: "night" },
    riunione: { title: "La riunione del mattino", tone: "gold" },
    diretta: { title: "In diretta", tone: "live" },
    replica: { title: "La replica", tone: "gold" },
    emergenza: { title: "Allarme della sera", tone: "alarm" },
    palestra: { title: "La palestra", tone: "gold" },
  };

  const S = {
    started: false, title: null, codex: null, codexKey: 0, cinema: false, cine: null, fixedFallback: false,
    lastBanner: 0, lastMode: null, titleOpenAt: 0, subQueue: [], subNow: null, subTimer: 0, typeTimer: 0,
    placeTimer: 0, place: null, banners: null, bannerLoop: 0, visible: true, music: null, bar: null,
    dustRaf: 0, returnFocus: null,
  };

  const safe = (fn, fallback) => { try { return fn(); } catch (e) { console.warn("Campus gioco:", e); return fallback; } };
  const reduce = () => !!(C.ctx ? C.ctx.reduceMotion : safe(() => matchMedia("(prefers-reduced-motion: reduce)").matches, false));
  const el = (tag, cls, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (k === "text") e.textContent = v; else e.setAttribute(k, v); }
    return e;
  };
  const button = (cls, text, onClick, attrs) => {
    const b = el("button", cls, { type: "button", ...(attrs || {}) });
    if (text) b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  };
  const picture = (cls, src, alt) => { const i = el("img", cls, { src, alt: alt || "", decoding: "async" }); i.addEventListener("error", () => i.classList.add("cp-g-missing")); return i; };
  const stage = () => document.getElementById("campus-stage");
  const section = () => document.getElementById("campus-section");
  const nameOf = (k) => C.NAMES[k] || U.cap(k);
  const art = (k) => `${C.ARTICLE[k] || "il"} ${nameOf(k)}`;
  const later = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------------------------------------
  // styles
  const CSS = `
.cp-g-bar{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 12px}
.cp-g-btn{min-height:36px;display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;border:1px solid rgba(216,178,90,.6);background:linear-gradient(180deg,#1b2a2e,#0f191c);color:#f3e6c4;font:600 .88rem/1 var(--font-head);letter-spacing:.02em;cursor:pointer;box-shadow:0 1px 0 rgba(255,236,190,.12) inset,0 4px 14px rgba(0,0,0,.18)}
.cp-g-btn:hover{border-color:#e9c877;color:#fff5da}
.cp-g-btn:focus-visible{outline:2px solid #e9c877;outline-offset:2px}
.cp-g-btn svg{width:16px;height:16px;flex:none}
.cp-g-btn[aria-pressed="true"]{background:linear-gradient(180deg,#5b4314,#2c2008);border-color:#e9c877}
.cp-g-title,.cp-g-codex{position:fixed;inset:0;z-index:2147483000;color:#f4ead2;background:#05090b;font-family:var(--font-head);overflow:hidden}
.cp-g-title{display:grid;opacity:1;transition:opacity .9s ease,transform .9s ease}
.cp-g-title.cp-g-out{opacity:0;transform:scale(1.04);pointer-events:none}
.cp-g-bg{position:absolute;inset:-4%;}
.cp-g-bg img{width:100%;height:100%;object-fit:cover;object-position:60% 50%;animation:cpgKen 26s ease-in-out infinite alternate;filter:saturate(1.08) contrast(1.05)}
@keyframes cpgKen{from{transform:scale(1.06) translate3d(-1%,0,0)}to{transform:scale(1.0) translate3d(1%,-1%,0)}}
.cp-g-rays{position:absolute;inset:0;background:conic-gradient(from 205deg at 88% 18%,transparent 0 6deg,rgba(255,206,130,.10) 9deg,transparent 14deg,rgba(255,206,130,.07) 20deg,transparent 26deg,rgba(255,206,130,.09) 33deg,transparent 40deg 360deg);mix-blend-mode:screen;animation:cpgRays 9s ease-in-out infinite alternate}
@keyframes cpgRays{from{opacity:.55}to{opacity:1}}
.cp-g-shade{position:absolute;inset:0;background:radial-gradient(120% 90% at 70% 40%,transparent 40%,rgba(2,6,8,.78) 100%),linear-gradient(90deg,rgba(3,8,10,.88) 0%,rgba(3,8,10,.55) 34%,transparent 62%),linear-gradient(0deg,rgba(3,8,10,.92) 0%,transparent 38%)}
.cp-g-dust{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}
.cp-g-lineup{position:absolute;right:1%;bottom:0;height:74%;width:50%;pointer-events:none}
.cp-g-lr{position:absolute;left:0;right:0;display:flex;align-items:flex-end;justify-content:center}
.cp-g-lr.back{bottom:20%;height:52%;filter:brightness(.72) saturate(.85)}
.cp-g-lr.front{bottom:-3%;height:66%}
.cp-g-lineup img{height:100%;width:auto;margin:0 -2.6%;filter:brightness(.78) contrast(1.08) saturate(.95) drop-shadow(0 0 1px rgba(255,214,150,.75)) drop-shadow(0 0 16px rgba(255,190,110,.18)) drop-shadow(0 18px 22px rgba(0,0,0,.65));opacity:0;transform:translateY(24px);animation:cpgRise 1.1s cubic-bezier(.2,.7,.2,1) forwards}
.cp-g-lineup::after{content:"";position:absolute;left:0;right:0;bottom:0;height:22%;background:linear-gradient(0deg,rgba(3,8,10,.95),transparent)}
@keyframes cpgRise{to{opacity:1;transform:none}}
.cp-g-main{position:relative;align-self:center;justify-self:start;margin-left:clamp(20px,7vw,110px);max-width:min(520px,88vw);display:flex;flex-direction:column;gap:10px}
.cp-g-crest{width:92px;height:auto;filter:drop-shadow(0 0 22px rgba(233,200,119,.45));animation:cpgGlow 4.5s ease-in-out infinite alternate}
@keyframes cpgGlow{from{filter:drop-shadow(0 0 10px rgba(233,200,119,.25))}to{filter:drop-shadow(0 0 28px rgba(233,200,119,.6))}}
.cp-g-name{margin:4px 0 0;font:700 clamp(2.6rem,7.4vw,5.4rem)/.92 var(--font-read);letter-spacing:.06em;text-transform:uppercase;background:linear-gradient(100deg,#f7e3a8 0%,#d8a943 38%,#fff3cf 50%,#c99a3a 62%,#f2d48a 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:cpgShine 7s ease-in-out infinite;text-shadow:none;filter:drop-shadow(0 3px 18px rgba(0,0,0,.6))}
.cp-g-name span{display:block}
@keyframes cpgShine{0%,100%{background-position:100% 0}50%{background-position:0 0}}
.cp-g-tagline{margin:0;font:600 .86rem/1.3 var(--font-head);letter-spacing:.32em;text-transform:uppercase;color:#e3cf9c}
.cp-g-rule{height:1px;width:min(380px,80%);background:linear-gradient(90deg,#e9c877,rgba(233,200,119,0));position:relative;margin:6px 0}
.cp-g-rule::before{content:"";position:absolute;left:0;top:-4px;width:9px;height:9px;transform:rotate(45deg);background:#e9c877}
.cp-g-status{margin:0;color:#d9d2c0;font:400 .98rem/1.5 var(--font-read);min-height:3em}
.cp-g-status b{color:#fff3d6;font-weight:600}
.cp-g-menu{display:flex;flex-direction:column;gap:2px;margin-top:8px}
.cp-g-item{position:relative;text-align:left;background:none;border:0;color:#efe6cf;font:600 clamp(1.05rem,2.2vw,1.32rem)/1.2 var(--font-head);letter-spacing:.05em;text-transform:uppercase;padding:9px 14px 9px 34px;min-height:40px;cursor:pointer;border-radius:4px;transition:color .2s,background .2s,padding .2s}
.cp-g-item::before{content:"";position:absolute;left:12px;top:50%;width:9px;height:9px;margin-top:-5px;transform:rotate(45deg) scale(0);background:#e9c877;transition:transform .2s}
.cp-g-item:hover,.cp-g-item:focus-visible{color:#fff6dc;background:linear-gradient(90deg,rgba(233,200,119,.20),rgba(233,200,119,0));padding-left:40px;outline:none}
.cp-g-item:hover::before,.cp-g-item:focus-visible::before{transform:rotate(45deg) scale(1)}
.cp-g-item.cp-g-first{color:#ffe9ad}
.cp-g-item small{display:block;font:400 .78rem/1.3 var(--font-read);letter-spacing:0;text-transform:none;color:#b8b09c;margin-top:2px}
.cp-g-press{margin:10px 0 0;font:600 .74rem/1 var(--font-head);letter-spacing:.3em;text-transform:uppercase;color:#e9c877;animation:cpgBlink 2.2s ease-in-out infinite}
@keyframes cpgBlink{0%,100%{opacity:.25}50%{opacity:1}}
.cp-g-foot{position:absolute;left:clamp(20px,7vw,110px);right:20px;bottom:14px;margin:0;font:400 .76rem/1.4 var(--font-read);color:#9d978a}
.cp-g-missing{visibility:hidden}
@media (max-width:899px){
 .cp-g-lineup{width:100%;right:0;left:0;height:46%;top:6%;bottom:auto;opacity:.5}
 .cp-g-shade{background:radial-gradient(120% 90% at 60% 30%,transparent 30%,rgba(2,6,8,.8) 100%),linear-gradient(0deg,rgba(3,8,10,.95) 10%,rgba(3,8,10,.55) 60%,rgba(3,8,10,.35) 100%)}
 .cp-g-main{justify-self:center;margin:0 16px;align-self:end;padding-bottom:54px}
 .cp-g-crest{width:68px}
 .cp-g-press{display:none}
 .cp-g-foot{left:16px;right:16px;bottom:10px}
}
@media (max-height:620px) and (min-width:900px){.cp-g-crest{width:64px}.cp-g-status{display:none}}
@media (max-height:860px){.cp-g-press{display:none}}
/* the character sheet */
.cp-g-codex{display:grid;grid-template-columns:96px minmax(0,1fr) minmax(320px,440px);grid-template-rows:auto minmax(0,1fr);background:radial-gradient(70% 90% at 42% 60%,color-mix(in srgb,var(--cx,#e9c877) 34%,#0b1316) 0%,#071012 55%,#030607 100%);transition:background .6s}
.cp-g-cx-top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:14px 18px 4px 22px}
.cp-g-cx-top h2{margin:0;font:700 .9rem/1 var(--font-head);letter-spacing:.34em;text-transform:uppercase;color:#e9c877}
.cp-g-x{min-width:40px;min-height:40px;border-radius:999px;border:1px solid rgba(233,200,119,.5);background:rgba(0,0,0,.35);color:#f3e6c4;font:600 .85rem/1 var(--font-head);padding:0 14px;cursor:pointer}
.cp-g-x:focus-visible,.cp-g-tab:focus-visible,.cp-g-arrow:focus-visible{outline:2px solid #e9c877;outline-offset:2px}
.cp-g-cx-tabs{display:flex;flex-direction:column;gap:6px;padding:8px 10px;overflow:auto}
.cp-g-tab{display:grid;place-items:center;gap:2px;min-height:64px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.03);cursor:pointer;padding:6px 2px;color:#cfc6b0;font:600 .62rem/1.1 var(--font-head);letter-spacing:.06em;text-transform:uppercase}
.cp-g-tab img{height:40px;width:auto;filter:grayscale(.55) brightness(.8);transition:filter .25s,transform .25s}
.cp-g-tab[aria-selected="true"]{border-color:rgba(233,200,119,.7);background:rgba(233,200,119,.12);color:#fff1cf}
.cp-g-tab[aria-selected="true"] img,.cp-g-tab:hover img{filter:none;transform:scale(1.08)}
.cp-g-cx-stage{position:relative;min-height:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.cp-g-cx-spot{position:absolute;left:50%;bottom:3%;width:min(70%,520px);height:9%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--cx,#e9c877) 70%,#fff 10%),transparent);opacity:.55;filter:blur(6px)}
.cp-g-cx-beam{position:absolute;left:50%;top:-10%;width:60%;height:120%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(255,240,205,.16),rgba(255,240,205,0) 80%);clip-path:polygon(42% 0,58% 0,100% 100%,0 100%);pointer-events:none}
.cp-g-cx-crestbig{position:absolute;left:50%;top:6%;height:44%;transform:translateX(-50%);opacity:.13;filter:blur(1px) saturate(.8);pointer-events:none}
.cp-g-cx-fig{position:relative;height:92%;max-width:96%;object-fit:contain;filter:drop-shadow(0 0 1px rgba(255,226,170,.6)) drop-shadow(0 0 26px color-mix(in srgb,var(--cx,#e9c877) 35%,transparent)) drop-shadow(0 26px 30px rgba(0,0,0,.7));animation:cpgFigIn .7s cubic-bezier(.2,.7,.2,1);transform-origin:50% 100%}
.cp-g-cx-fig.cp-g-breathe{animation:cpgFigIn .7s cubic-bezier(.2,.7,.2,1),cpgBreath 5s ease-in-out .7s infinite}
@keyframes cpgFigIn{from{opacity:0;transform:translateX(40px) scale(.98)}to{opacity:1;transform:none}}
@keyframes cpgBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.008) translateY(-2px)}}
.cp-g-arrow{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid rgba(233,200,119,.5);background:rgba(0,0,0,.4);color:#f3e6c4;font:700 1.3rem/1 var(--font-head);cursor:pointer}
.cp-g-arrow.cp-g-prev{left:10px}.cp-g-arrow.cp-g-next{right:10px}
.cp-g-cx-card{min-height:0;overflow:auto;padding:10px 26px 26px 10px;display:flex;flex-direction:column;gap:12px}
.cp-g-cx-name{margin:0;font:700 clamp(2.2rem,4.4vw,3.4rem)/1 var(--font-read);letter-spacing:.03em;color:#fff3d6}
.cp-g-cx-role{margin:0;font:600 .82rem/1.3 var(--font-head);letter-spacing:.22em;text-transform:uppercase;color:var(--cxl,#e9c877)}
.cp-g-cx-house{display:flex;align-items:center;gap:10px;margin:0;color:#d5ccb6;font:400 .92rem/1.3 var(--font-read)}
.cp-g-cx-house img{height:34px;width:auto}
.cp-g-cx-motto{margin:0;padding-left:14px;border-left:2px solid var(--cxl,#e9c877);font:italic 400 1.05rem/1.45 var(--font-read);color:#efe5cd}
.cp-g-cx-who{margin:0;font:400 .95rem/1.55 var(--font-read);color:#d7d0bf}
.cp-g-panel{border:1px solid rgba(233,200,119,.28);background:rgba(4,9,11,.55);border-radius:10px;padding:12px 14px;display:grid;gap:9px;backdrop-filter:blur(4px)}
.cp-g-panel h3{margin:0;font:700 .7rem/1 var(--font-head);letter-spacing:.28em;text-transform:uppercase;color:#e9c877}
.cp-g-row{display:flex;justify-content:space-between;gap:12px;font:400 .9rem/1.35 var(--font-read);color:#e8e0cb}
.cp-g-row span:first-child{color:#aea58f}
.cp-g-row b{font:600 .9rem/1.35 var(--font-num);color:#fff3d6;text-align:right}
.cp-g-row b.cp-g-up{color:#6fdc8c}.cp-g-row b.cp-g-down{color:#ff8a7a}
.cp-g-meter{display:grid;grid-template-columns:110px 1fr auto;align-items:center;gap:10px;font:400 .86rem/1 var(--font-read);color:#aea58f}
.cp-g-meter i{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;height:9px}
.cp-g-meter i::before{content:none}
.cp-g-meter i span{background:rgba(255,255,255,.1);border-radius:2px}
.cp-g-meter i span.on{background:linear-gradient(180deg,#f6dc95,#c99a3a);box-shadow:0 0 6px rgba(233,200,119,.45)}
.cp-g-meter b{font:600 .84rem/1 var(--font-num);color:#fff3d6}
.cp-g-note{margin:0;font:400 .82rem/1.45 var(--font-read);color:#a9a190}
.cp-g-acts{display:flex;flex-wrap:wrap;gap:8px}
.cp-g-cta{min-height:42px;padding:0 18px;border-radius:6px;border:1px solid #e9c877;background:linear-gradient(180deg,#e9c877,#b88a2c);color:#1b1306;font:700 .86rem/1 var(--font-head);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.cp-g-cta.cp-g-ghost{background:rgba(0,0,0,.35);color:#f3e6c4}
.cp-g-cta:focus-visible{outline:2px solid #fff3d6;outline-offset:2px}
@media (max-width:899px){
 .cp-g-codex{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto 52vh auto;overflow:auto}
 .cp-g-cx-tabs{flex-direction:row;overflow-x:auto;padding:6px 12px}
 .cp-g-tab{min-width:64px;min-height:58px}
 .cp-g-tab img{height:32px}
 .cp-g-cx-card{overflow:visible;padding:4px 16px 28px}
}
/* inside the stage: banners, the cinema */
.cp-g-banner{position:absolute;left:50%;top:22%;z-index:4;transform:translateX(-50%);pointer-events:none;text-align:center;padding:12px 40px;min-width:min(460px,86%);color:#fff3d6;opacity:0;transition:opacity .6s,transform .6s;background:radial-gradient(closest-side,rgba(3,8,10,.75),rgba(3,8,10,0))}
.cp-g-banner.cp-g-on{opacity:1;transform:translateX(-50%) translateY(0)}
.cp-g-banner::before,.cp-g-banner::after{content:"";display:block;height:1px;margin:0 auto;width:0;background:linear-gradient(90deg,transparent,var(--bn,#e9c877),transparent);transition:width .9s .1s}
.cp-g-banner.cp-g-on::before,.cp-g-banner.cp-g-on::after{width:100%}
.cp-g-banner strong{display:block;margin:8px 0 4px;font:700 clamp(1.3rem,3.6vw,2.1rem)/1.05 var(--font-read);letter-spacing:.12em;text-transform:uppercase;color:var(--bn,#e9c877);text-shadow:0 2px 14px rgba(0,0,0,.8)}
.cp-g-banner span{display:block;margin-bottom:8px;font:400 .95rem/1.35 var(--font-read);color:#f1e8d2;text-shadow:0 1px 8px rgba(0,0,0,.9)}
.cp-g-banner[data-tone="alarm"]{--bn:#ff7a6b}.cp-g-banner[data-tone="live"]{--bn:#ff9b6b}.cp-g-banner[data-tone="night"]{--bn:#a9c4ff}
.cp-g-cine{position:absolute;inset:0;z-index:5;pointer-events:none}
.cp-g-cine .cp-g-lb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .7s cubic-bezier(.2,.7,.2,1)}
.cp-g-cine .cp-g-lb.t{top:0}.cp-g-cine .cp-g-lb.b{bottom:0}
.cp-g-cine.cp-g-on .cp-g-lb.t{height:8%}.cp-g-cine.cp-g-on .cp-g-lb.b{height:19%}
.cp-g-vig{position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%);opacity:0;transition:opacity 1s}
.cp-g-cine.cp-g-on .cp-g-vig{opacity:1}
.cp-g-place{position:absolute;left:4%;top:calc(8% + 14px);opacity:0;transition:opacity .8s;font:700 .74rem/1.2 var(--font-head);letter-spacing:.32em;text-transform:uppercase;color:#f1e3bd;text-shadow:0 1px 6px rgba(0,0,0,.9)}
.cp-g-place em{display:block;font:400 .8rem/1.3 var(--font-num);letter-spacing:.04em;font-style:normal;color:#cfc6ae;margin-top:3px}
.cp-g-place.cp-g-on{opacity:1}
.cp-g-subs{position:absolute;left:0;right:0;bottom:0;height:19%;min-height:86px;display:flex;align-items:center;justify-content:center;padding:0 4%}
.cp-g-sub{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;max-width:920px;width:100%;opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s}
.cp-g-sub.cp-g-on{opacity:1;transform:none}
.cp-g-sub img{width:clamp(48px,7vw,76px);aspect-ratio:3/4;object-fit:cover;border-radius:6px;border:1px solid var(--sc,#e9c877);box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 16px color-mix(in srgb,var(--sc,#e9c877) 40%,transparent)}
.cp-g-sub .who{font:700 .78rem/1.2 var(--font-head);letter-spacing:.2em;text-transform:uppercase;color:var(--sc,#e9c877)}
.cp-g-sub .who small{font:400 .78rem/1.2 var(--font-read);letter-spacing:0;text-transform:none;color:#aaa290;margin-left:8px}
.cp-g-sub p{margin:4px 0 0;font:400 clamp(.92rem,1.9vw,1.16rem)/1.4 var(--font-read);color:#f6efdc}
.cp-g-sub.pensa p{font-style:italic;color:#d9d1bd}
.cp-g-ctl{position:absolute;right:12px;top:calc(8% - 4px);display:flex;gap:8px;transform:translateY(-100%);pointer-events:auto}
.cp-g-ctl .cp-g-btn{min-height:32px;padding:5px 12px;font-size:.8rem;background:rgba(0,0,0,.6)}
.cp-g-cinema .cp-hud{opacity:0;transition:opacity .6s}
.cp-g-cinema .cp-hud *{pointer-events:none!important}
.cp-stage.cp-g-cinema:fullscreen{width:100vw;height:100vh;border-radius:0;border:0}
.cp-stage.cp-g-fixed{position:fixed!important;inset:0!important;z-index:2147482000!important;width:100vw!important;height:100vh!important;height:100dvh!important;border-radius:0!important;border:0!important}
@media (max-width:620px){.cp-g-cine.cp-g-on .cp-g-lb.b{height:26%}.cp-g-subs{height:26%}.cp-g-sub{gap:10px}}
@media (prefers-reduced-motion:reduce){.cp-g-bg img,.cp-g-rays,.cp-g-name,.cp-g-press,.cp-g-crest,.cp-g-cx-fig{animation:none!important}.cp-g-lineup img{animation:none!important;opacity:1;transform:none}}
`;
  function injectStyle() {
    if (document.getElementById("cp-style-gioco")) return;
    const s = el("style", null, { id: "cp-style-gioco" });
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const ICON = {
    menu: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    people: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.5" cy="5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="11" cy="5.6" r="1.9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 14c.4-3 2-4.3 4-4.3s3.6 1.3 4 4.3M10 9.6c2 0 3.6 1.1 4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    film: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 6h13M1.5 10h13M5 3v3M8 3v3M11 3v3M5 10v3M8 10v3M11 10v3" stroke="currentColor" stroke-width="1.1"/></svg>',
    note: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 12.5V3.5l7-1.5v9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="4.3" cy="12.6" r="1.8" fill="currentColor"/><circle cx="11.3" cy="11.1" r="1.8" fill="currentColor"/></svg>',
  };
  const iconButton = (icon, text, onClick, attrs) => {
    const b = button("cp-g-btn", "", onClick, attrs);
    b.innerHTML = ICON[icon];
    b.appendChild(document.createTextNode(text));
    return b;
  };

  // ---------------------------------------------------------------------------------------------
  // the toolbar above the stage
  function addBar() {
    const sec = section();
    if (!sec || S.bar) return;
    const head = sec.querySelector(".section-head");
    const bar = el("div", "cp-g-bar", { role: "toolbar", "aria-label": "Comandi del campus" });
    bar.append(
      iconButton("menu", "Menu", () => openTitle()),
      iconButton("people", "I personaggi", () => openCodex(0)),
      iconButton("film", "Modalità cinema", () => cinema(!S.cinema), { "aria-pressed": "false", "data-g": "cinema" }),
      iconButton("note", "Musica", () => toggleMusic(), { "aria-pressed": "false", "data-g": "musica" }),
    );
    if (head && head.parentNode) head.parentNode.insertBefore(bar, head.nextSibling);
    else sec.prepend(bar);
    S.bar = bar;
  }
  function syncBar() {
    if (!S.bar) return;
    const c = S.bar.querySelector('[data-g="cinema"]'), m = S.bar.querySelector('[data-g="musica"]');
    if (c) c.setAttribute("aria-pressed", String(S.cinema));
    if (m) m.setAttribute("aria-pressed", String(!!(S.music && S.music.on)));
    if (S.title) { const t = S.title.querySelector('[data-g="musica"]'); if (t) t.firstChild.textContent = S.music && S.music.on ? "Musica: accesa" : "Musica: spenta"; }
  }

  // ---------------------------------------------------------------------------------------------
  // the title screen
  function statusLine() {
    const parts = [];
    const g = safe(() => D.graduation(), null), t = safe(() => D.today(), null), f = safe(() => D.fund(), null);
    if (g && U.isNum(g.giorno) && U.isNum(g.totale) && g.giorno > 0) parts.push(`<b>Giorno ${U.esc(g.giorno)} di ${U.esc(g.totale)}</b>`);
    if (t && t.tema) parts.push(U.esc(U.plain(t.tema, 90)));
    const line1 = parts.join(" · ");
    const more = [];
    if (g && U.isNum(g.days)) more.push(g.days === 0 ? "Oggi è il giorno della laurea" : `Mancano <b>${U.esc(g.days)}</b> giorni alla laurea del 21 febbraio`);
    if (f && U.isNum(f.capitale)) more.push(`fondo della scuola <b>${U.esc(U.usd(f.capitale))}</b> (${U.esc(U.pct(f.pct))})`);
    const line2 = more.join(", ");
    if (!line1 && !line2) return C.data.unavailable ? "Otto agenti, un campus, un obiettivo comune: laurearsi in trading, insieme." : "Carico la classe…";
    return [line1, line2].filter(Boolean).join("<br>");
  }
  function refreshTitle() {
    if (!S.title) return;
    const s = S.title.querySelector(".cp-g-status");
    if (s) s.innerHTML = statusLine();
  }
  function openTitle() {
    if (S.title) return;
    injectStyle();
    if (S.cinema) cinema(false);
    S.returnFocus = document.activeElement;
    const t = el("div", "cp-g-title", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cp-g-name" });
    const bg = el("div", "cp-g-bg");
    const small = (window.innerWidth || 1200) < 900;
    bg.appendChild(picture(null, `${ART}${small ? "copertina-piccola" : "copertina"}.webp`, ""));
    const dust = el("canvas", "cp-g-dust", { "aria-hidden": "true" });
    const lineup = el("div", "cp-g-lineup", { "aria-hidden": "true" });
    [["back", ["ragioniere", "cronista", "scettico", "spazzino"]], ["front", ["tartaruga", "preside", "falco", "guardiano"]]].forEach(([cls, keys], r) => {
      const line = el("div", "cp-g-lr " + cls);
      keys.forEach((k, i) => {
        const im = picture(null, FIGURA(k), "");
        im.style.animationDelay = `${0.2 + r * 0.45 + i * 0.12}s`;
        line.appendChild(im);
      });
      lineup.appendChild(line);
    });
    const main = el("div", "cp-g-main");
    const name = el("h1", "cp-g-name", { id: "cp-g-name" });
    name.innerHTML = "<span>Scuola</span><span>Cripto</span>";
    const menu = el("nav", "cp-g-menu", { "aria-label": "Menu" });
    const item = (label, hint, fn, attrs) => {
      const b = button("cp-g-item", label, fn, attrs);
      if (hint) b.appendChild(el("small", null, { text: hint }));
      menu.appendChild(b);
      return b;
    };
    item("Entra nel campus", "Gli otto agenti vivono, lavorano e parlano tra loro", () => enterCampus()).classList.add("cp-g-first");
    item("Modalità cinema", "Schermo intero, sottotitoli e ritratti", () => closeTitle().then(() => cinema(true)));
    item("I personaggi", "Chi sono, che cosa pensano, come vanno", () => openCodex(0));
    item("Il registro della classe", "Le riunioni, i voti, i portafogli", () => closeTitle().then(() => scrollToId("t-registro")));
    item(S.music && S.music.on ? "Musica: accesa" : "Musica: spenta", "Una musica lenta di sottofondo", () => toggleMusic(), { "data-g": "musica" });
    main.append(
      picture("cp-g-crest", STEMMA("scuola"), "Lo stemma della Scuola Cripto"),
      name,
      el("p", "cp-g-tagline", { text: "Accademia di trading · Anno primo" }),
      el("div", "cp-g-rule", { "aria-hidden": "true" }),
      el("p", "cp-g-status", { "aria-live": "polite" }),
      menu,
      el("p", "cp-g-press", { text: "Premi Invio per entrare", "aria-hidden": "true" }),
    );
    t.append(bg, el("div", "cp-g-rays", { "aria-hidden": "true" }), dust, el("div", "cp-g-shade", { "aria-hidden": "true" }), lineup, main,
      el("p", "cp-g-foot", { text: "Fase di allenamento: soldi finti finché i numeri non dimostrano che il metodo funziona. Poi, sui soldi veri, decidi tu." }));
    t.addEventListener("keydown", titleKeys);
    document.body.appendChild(t);
    S.title = t;
    S.titleOpenAt = performance.now();
    document.documentElement.style.overflow = "hidden";
    refreshTitle();
    syncBar();
    startDust(dust);
    requestAnimationFrame(() => { const f = menu.querySelector(".cp-g-item"); if (f) f.focus({ preventScroll: true }); });
  }
  function titleKeys(e) {
    if (!S.title || S.codex) return;
    const items = [...S.title.querySelectorAll(".cp-g-item")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = items.length, j = i < 0 ? 0 : (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      items[j].focus();
    } else if (e.key === "Escape") {
      e.preventDefault(); enterCampus();
    } else if (e.key === "Tab") {
      trapTab(e, S.title);
    }
  }
  function trapTab(e, root) {
    const f = [...root.querySelectorAll("button,[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeTitle() {
    const t = S.title;
    if (!t) return Promise.resolve();
    S.title = null;
    stopDust();
    t.classList.add("cp-g-out");
    document.documentElement.style.overflow = "";
    return later(reduce() ? 0 : 650).then(() => { t.remove(); });
  }
  function enterCampus() {
    closeTitle().then(() => {
      const sec = section();
      if (sec) sec.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
      setTimeout(() => modeBanner(true), reduce() ? 0 : 700);
      const first = S.bar && S.bar.querySelector("button");
      if (first) first.focus({ preventScroll: true });
    });
  }
  function scrollToId(id) {
    const h = document.getElementById(id);
    const target = (h && h.closest("section")) || h;
    if (target) target.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
  }

  // the golden dust on the title screen
  function startDust(cv) {
    if (reduce()) return;
    const ctx2 = cv.getContext("2d");
    if (!ctx2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const size = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx2.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const rand = U.rng("polvere|titolo");
    const motes = Array.from({ length: DUST }, () => ({ x: rand() * w, y: rand() * h, r: 0.6 + rand() * 2.2, v: 6 + rand() * 18, ph: rand() * 6.28, a: 0.25 + rand() * 0.6 }));
    let last = performance.now();
    const frame = (now) => {
      if (!S.title) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (cv.clientWidth !== w || cv.clientHeight !== h) size();
      ctx2.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v * dt; m.x += Math.sin(now / 1700 + m.ph) * 8 * dt;
        if (m.y < -10) { m.y = h + 10; m.x = rand() * w; }
        const tw = 0.6 + 0.4 * Math.sin(now / 600 + m.ph * 3);
        const g = ctx2.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        g.addColorStop(0, `rgba(255,222,150,${(m.a * tw).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,200,120,0)");
        ctx2.fillStyle = g;
        ctx2.beginPath(); ctx2.arc(m.x, m.y, m.r * 4, 0, 6.2832); ctx2.fill();
      }
      S.dustRaf = requestAnimationFrame(frame);
    };
    S.dustRaf = requestAnimationFrame(frame);
  }
  function stopDust() { if (S.dustRaf) cancelAnimationFrame(S.dustRaf); S.dustRaf = 0; }

  // ---------------------------------------------------------------------------------------------
  // «I personaggi»
  function openCodex(index) {
    injectStyle();
    if (S.codex) { showCharacter(index); return; }
    S.codexReturn = document.activeElement;
    const cx = el("div", "cp-g-codex", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cp-g-cx-h" });
    const top = el("header", "cp-g-cx-top");
    top.append(el("h2", null, { id: "cp-g-cx-h", text: "I personaggi" }), button("cp-g-x", "Chiudi ✕", () => closeCodex(), { "aria-label": "Chiudi i personaggi" }));
    const tabs = el("div", "cp-g-cx-tabs", { role: "tablist", "aria-label": "Scegli il personaggio" });
    KEYS.forEach((k, i) => {
      const b = button("cp-g-tab", "", () => showCharacter(i), { role: "tab", "aria-selected": "false", "aria-controls": "cp-g-cx-card", id: `cp-g-tab-${k}`, tabindex: "-1" });
      b.append(picture(null, STEMMA(k), ""), el("span", null, { text: nameOf(k) }));
      tabs.appendChild(b);
    });
    tabs.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); showCharacter(S.codexKey + 1, true); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); showCharacter(S.codexKey - 1, true); }
    });
    const st = el("div", "cp-g-cx-stage");
    st.append(el("div", "cp-g-cx-beam", { "aria-hidden": "true" }), picture("cp-g-cx-crestbig", STEMMA(KEYS[0]), ""), el("div", "cp-g-cx-spot", { "aria-hidden": "true" }),
      picture("cp-g-cx-fig", FIGURA(KEYS[0]), ""),
      button("cp-g-arrow cp-g-prev", "‹", () => showCharacter(S.codexKey - 1), { "aria-label": "Personaggio precedente" }),
      button("cp-g-arrow cp-g-next", "›", () => showCharacter(S.codexKey + 1), { "aria-label": "Personaggio successivo" }));
    let touch = null;
    st.addEventListener("touchstart", (e) => { touch = e.touches[0] ? e.touches[0].clientX : null; }, { passive: true });
    st.addEventListener("touchend", (e) => {
      const x = e.changedTouches[0] && e.changedTouches[0].clientX;
      if (touch !== null && U.isNum(x) && Math.abs(x - touch) > 50) showCharacter(S.codexKey + (x < touch ? 1 : -1));
      touch = null;
    });
    const card = el("section", "cp-g-cx-card", { id: "cp-g-cx-card", role: "tabpanel", "aria-live": "polite" });
    cx.append(top, tabs, st, card);
    cx.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeCodex(); }
      else if (e.key === "Tab") trapTab(e, cx);
      else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.target.closest(".cp-g-cx-tabs")) { e.preventDefault(); showCharacter(S.codexKey + (e.key === "ArrowRight" ? 1 : -1)); }
    });
    document.body.appendChild(cx);
    S.codex = cx;
    document.documentElement.style.overflow = "hidden";
    showCharacter(index || 0, true);
  }
  function closeCodex() {
    if (!S.codex) return;
    S.codex.remove();
    S.codex = null;
    if (!S.title) document.documentElement.style.overflow = "";
    const back = S.codexReturn;
    S.codexReturn = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }
  function showCharacter(i, focusTab) {
    if (!S.codex) return;
    const n = KEYS.length, idx = ((i % n) + n) % n, k = KEYS[idx];
    S.codexKey = idx;
    const cx = S.codex;
    cx.style.setProperty("--cx", U.cssColor(k));
    cx.style.setProperty("--cxl", `color-mix(in srgb, ${U.cssColor(k)} 55%, #f3e6c4)`);
    cx.querySelectorAll(".cp-g-tab").forEach((b, j) => { b.setAttribute("aria-selected", String(j === idx)); b.tabIndex = j === idx ? 0 : -1; });
    if (focusTab) { const t = cx.querySelector(`#cp-g-tab-${k}`); if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: "nearest", inline: "nearest" }); } }
    const fig = cx.querySelector(".cp-g-cx-fig");
    const fresh = picture("cp-g-cx-fig" + (reduce() ? "" : " cp-g-breathe"), FIGURA(k), `${nameOf(k)}, figura intera`);
    fig.replaceWith(fresh);
    cx.querySelector(".cp-g-cx-crestbig").src = STEMMA(k);
    fillCard(cx.querySelector(".cp-g-cx-card"), k);
  }
  function meter(label, v) {
    const row = el("div", "cp-g-meter");
    row.appendChild(el("span", null, { text: label }));
    const bar = el("i", null, { "aria-hidden": "true" });
    const on = U.isNum(v) ? Math.round(U.clamp(v, 0, 10)) : 0;
    for (let j = 0; j < 10; j++) bar.appendChild(el("span", j < on ? "on" : ""));
    row.append(bar, el("b", null, { text: U.isNum(v) ? `${U.fmt(v, Number.isInteger(v) ? 0 : 1)}/10` : "—" }));
    return row;
  }
  function row(label, value, cls) {
    const r = el("div", "cp-g-row");
    r.append(el("span", null, { text: label }), el("b", cls || "", { text: value }));
    return r;
  }
  function fillCard(card, k) {
    const P = PERSONA[k];
    const m = safe(() => (C.life && C.life.mind ? C.life.mind(k) : null), null) || {};
    card.textContent = "";
    card.append(el("h3", "cp-g-cx-name", { text: nameOf(k) }), el("p", "cp-g-cx-role", { text: P.titolo }));
    const house = el("p", "cp-g-cx-house");
    house.append(picture(null, STEMMA(k), ""), document.createTextNode(P.casa));
    card.append(house, el("blockquote", "cp-g-cx-motto", { text: `«${P.motto}»` }), el("p", "cp-g-cx-who", { text: P.chi }));
    // now
    const now = el("div", "cp-g-panel");
    now.appendChild(el("h3", null, { text: "Adesso" }));
    const where = [m.label, m.roomName].filter(Boolean).join(" · ");
    now.appendChild(row("Che cosa fa", where ? U.cap(where) : "—"));
    if (m.moodLabel) now.appendChild(row("Umore", U.cap(m.moodLabel)));
    if (m.moodWhy) now.appendChild(el("p", "cp-g-note", { text: U.cap(m.moodWhy) }));
    card.appendChild(now);
    // the numbers
    const num = el("div", "cp-g-panel");
    num.appendChild(el("h3", null, { text: "I numeri" }));
    let any = false;
    const w = m.wallet || (C.TRADERS.includes(k) ? safe(() => D.wallet(k), null) : null);
    if (w) {
      if (U.isNum(w.judg)) { num.appendChild(row("Portafoglio a giudizio", U.usd(w.judg))); any = true; }
      if (U.isNum(w.pnlPct)) num.appendChild(row("Dall'inizio", U.pct(w.pnlPct), w.pnlPct > 0 ? "cp-g-up" : w.pnlPct < 0 ? "cp-g-down" : ""));
      if (U.isNum(w.rules)) { num.appendChild(row("Portafoglio a regole", U.usd(w.rules))); any = true; }
      const pos = Array.isArray(w.positions) ? w.positions.length : w.positions;
      if (U.isNum(pos)) num.appendChild(row("Posizioni aperte", String(pos)));
    }
    const v = m.voti || safe(() => D.votes(k), null);
    if (v && v.preside) {
      num.appendChild(meter("Ragionamento", U.toNum(v.preside.ragionamento)));
      num.appendChild(meter("Disciplina", U.toNum(v.preside.disciplina)));
      if (v.data) num.appendChild(el("p", "cp-g-note", { text: `Voti del Preside, riunione del ${U.dm(v.data)}.` }));
      any = true;
    }
    const cal = m.calibrazione || safe(() => D.calibration(k), null);
    if (cal && U.isNum(cal.brier) && U.isNum(cal.n)) {
      num.appendChild(row("Previsioni verificate", String(cal.n)));
      num.appendChild(row("Errore medio (Brier)", U.fmt(cal.brier, 3)));
      num.appendChild(el("p", "cp-g-note", { text: "0 vuol dire previsioni perfette; 0,25 è come tirare a indovinare." }));
      any = true;
    }
    const pred = m.previsione || safe(() => D.openPrediction(k), null);
    if (pred && pred.mercato) { num.appendChild(row("Previsione aperta", safe(() => U.predText(pred), "—"))); any = true; }
    if (!any) num.appendChild(el("p", "cp-g-note", { text: C.data.unavailable ? "I numeri compaiono quando apri la pagina da claude.ai." : k === "preside" ? "Il Preside non ha un portafoglio: giudica gli altri." : "Ancora nessun numero: arriva con le prossime riunioni." }));
    card.appendChild(num);
    const les = m.lezione || safe(() => D.lesson(k), null);
    if (les && les.testo) {
      const p = el("div", "cp-g-panel");
      p.append(el("h3", null, { text: "L'ultima lezione" }), el("p", "cp-g-cx-who", { text: U.plain(les.testo, 260) }));
      if (les.data) p.appendChild(el("p", "cp-g-note", { text: `Dal quaderno, ${U.dm(les.data)}.` }));
      card.appendChild(p);
    }
    const acts = el("div", "cp-g-acts");
    acts.append(button("cp-g-cta", `Segui ${art(k)}`, () => followFromCodex(k)), button("cp-g-cta cp-g-ghost", "Chiudi", () => closeCodex()));
    card.appendChild(acts);
  }
  function followFromCodex(k) {
    closeCodex();
    const go = () => {
      const sec = section();
      if (sec) sec.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
      safe(() => C.ui && C.ui.follow && C.ui.follow(k));
    };
    if (S.title) closeTitle().then(go); else go();
  }

  // ---------------------------------------------------------------------------------------------
  // the mode banner
  function modeBanner(force) {
    const st = stage();
    if (!st || S.title || !C.life) return;
    const mode = C.life.mode, card = MODE_CARD[mode];
    if (!card) return;
    const t = performance.now();
    if (!force && (mode === S.lastMode || t - S.lastBanner < BANNER_GAP_MS)) { S.lastMode = mode; return; }
    S.lastMode = mode; S.lastBanner = t;
    let b = st.querySelector(".cp-g-banner");
    if (!b) { b = el("div", "cp-g-banner", { role: "status" }); st.appendChild(b); }
    b.dataset.tone = card.tone;
    b.textContent = "";
    b.append(el("strong", null, { text: card.title }));
    const detail = C.life.modeDetail ? U.plain(C.life.modeDetail, 120) : "";
    if (detail) b.append(el("span", null, { text: detail }));
    b.classList.remove("cp-g-on");
    void b.offsetWidth;
    b.classList.add("cp-g-on");
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove("cp-g-on"), BANNER_HOLD_MS);
  }

  // ---------------------------------------------------------------------------------------------
  // the cinema mode
  function buildCine(st) {
    const c = el("div", "cp-g-cine", { "aria-hidden": "false" });
    const ctl = el("div", "cp-g-ctl");
    ctl.append(iconButton("note", "Musica", () => toggleMusic(), { "aria-pressed": String(!!(S.music && S.music.on)), "data-g": "musica-cine" }),
      button("cp-g-btn", "Esci dal cinema ✕", () => cinema(false), { "aria-label": "Esci dalla modalità cinema" }));
    const subs = el("div", "cp-g-subs", { "aria-live": "polite" });
    c.append(el("div", "cp-g-vig", { "aria-hidden": "true" }), el("div", "cp-g-lb t", { "aria-hidden": "true" }), el("div", "cp-g-lb b", { "aria-hidden": "true" }),
      el("div", "cp-g-place", { "aria-hidden": "true" }), subs, ctl);
    st.appendChild(c);
    return c;
  }
  function cinema(on) {
    const st = stage();
    if (!st) return;
    on = !!on;
    if (on === S.cinema) return;
    S.cinema = on;
    injectStyle();
    if (on) {
      if (S.title) closeTitle();
      if (!S.cine) S.cine = buildCine(st);
      st.classList.add("cp-g-cinema");
      const full = st.requestFullscreen && document.fullscreenEnabled !== false;
      const fallback = () => { st.classList.add("cp-g-fixed"); S.fixedFallback = true; document.documentElement.style.overflow = "hidden"; };
      if (full) st.requestFullscreen({ navigationUI: "hide" }).catch(fallback); else fallback();
      requestAnimationFrame(() => S.cine && S.cine.classList.add("cp-g-on"));
      safe(() => { if (C.ctx && C.ctx.has3d && C.render && C.render.cameraMode !== "regia") C.render.setCameraMode("regia"); });
      S.place = null;
      S.placeTimer = setInterval(updatePlace, PLACE_POLL_MS);
      updatePlace();
      document.addEventListener("keydown", cinemaKeys);
      const exit = S.cine.querySelector(".cp-g-ctl .cp-g-btn:last-child");
      if (exit) exit.focus({ preventScroll: true });
      setTimeout(() => modeBanner(true), 900);
    } else {
      st.classList.remove("cp-g-cinema", "cp-g-fixed");
      if (S.fixedFallback) { S.fixedFallback = false; if (!S.title && !S.codex) document.documentElement.style.overflow = ""; }
      if (document.fullscreenElement === st && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      if (S.cine) S.cine.classList.remove("cp-g-on");
      clearInterval(S.placeTimer); S.placeTimer = 0;
      document.removeEventListener("keydown", cinemaKeys);
      S.subQueue.length = 0; endSub(true);
      const pl = S.cine && S.cine.querySelector(".cp-g-place");
      if (pl) pl.classList.remove("cp-g-on");
    }
    syncBar();
  }
  function cinemaKeys(e) { if (e.key === "Escape" && S.cinema && !S.codex && !S.title) { e.preventDefault(); cinema(false); } }
  function onFullscreen() {
    const st = stage();
    if (S.cinema && st && document.fullscreenElement !== st && !S.fixedFallback) cinema(false);
  }
  function roomName(id) {
    if (!id) return null;
    const rooms = (C.world && C.world.rooms) || [];
    const r = Array.isArray(rooms) ? rooms.find((x) => x.id === id) : rooms[id];
    return r ? r.name : null;
  }
  function updatePlace() {
    if (!S.cine) return;
    const pl = S.cine.querySelector(".cp-g-place");
    const id = safe(() => (C.render && C.ctx && C.ctx.has3d ? C.render.focusRoom : null), null);
    const name = roomName(id) || (id === null && C.ctx && C.ctx.has3d ? "Il campus" : null);
    if (!pl || !name || name === S.place) return;
    S.place = name;
    pl.classList.remove("cp-g-on");
    setTimeout(() => {
      pl.textContent = "";
      pl.append(document.createTextNode(name), el("em", null, { text: `Roma, ${U.romeClock(C.clock.now())}` }));
      pl.classList.add("cp-g-on");
      clearTimeout(pl._t);
      pl._t = setTimeout(() => pl.classList.remove("cp-g-on"), 5200);
    }, 350);
  }
  // the subtitles, from the feed
  function onFeed(p) {
    const e = p && p.entry;
    if (!S.cinema || !e || !e.text) return;
    S.subQueue.push(e);
    if (S.subQueue.length > SUB_QUEUE) S.subQueue.splice(0, S.subQueue.length - SUB_QUEUE);
    if (!S.subNow) nextSub();
  }
  function nextSub() {
    clearTimeout(S.subTimer); clearInterval(S.typeTimer);
    const e = S.subQueue.shift();
    if (!e || !S.cine) { endSub(); return; }
    S.subNow = e;
    const box = S.cine.querySelector(".cp-g-subs");
    const who = KEYS.includes(e.who) ? e.who : null;
    const sub = el("div", "cp-g-sub" + (e.kind === "pensiero" ? " pensa" : ""));
    sub.style.setProperty("--sc", who ? U.cssColor(who) : "#e9c877");
    const head = el("div", "who", { text: who ? nameOf(who) : nameOf(e.who || "motore") });
    const tag = [e.label, e.source].filter(Boolean).join(" · ");
    if (tag) head.appendChild(el("small", null, { text: tag }));
    const txt = el("p");
    const body = el("div");
    body.append(head, txt);
    sub.append(picture(null, who ? RITRATTO(who) : STEMMA("scuola"), ""), body);
    box.textContent = "";
    box.appendChild(sub);
    requestAnimationFrame(() => sub.classList.add("cp-g-on"));
    const text = e.kind === "pensiero" ? `«${e.text}»` : e.text;
    if (reduce()) txt.textContent = text;
    else {
      let n = 0;
      S.typeTimer = setInterval(() => { n = Math.min(text.length, n + 2); txt.textContent = text.slice(0, n); if (n >= text.length) clearInterval(S.typeTimer); }, 2000 / SUB_CPS);
    }
    S.subTimer = setTimeout(nextSub, U.sayMs(text) + 500);
  }
  function endSub(now) {
    clearTimeout(S.subTimer); clearInterval(S.typeTimer);
    S.subNow = null;
    const s = S.cine && S.cine.querySelector(".cp-g-sub");
    if (!s) return;
    if (now) s.remove(); else { s.classList.remove("cp-g-on"); setTimeout(() => s.remove(), 400); }
  }

  // ---------------------------------------------------------------------------------------------
  // the music: a slow pad and a few bells, made in the browser, off by default
  function toggleMusic() {
    if (!S.music) S.music = makeMusic();
    if (!S.music) return;
    if (S.music.on) S.music.stop(); else S.music.start();
    syncBar();
    const t = S.cine && S.cine.querySelector('[data-g="musica-cine"]');
    if (t) t.setAttribute("aria-pressed", String(S.music.on));
  }
  function makeMusic() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    let ac = null, master = null, verb = null, timer = 0, step = 0;
    const CHORDS = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]]; // la-, fa, do, sol
    const BELLS = [69, 72, 74, 76, 79, 81, 84];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const impulse = () => {
      const len = ac.sampleRate * 3.2, b = ac.createBuffer(2, len, ac.sampleRate), rand = U.rng("riverbero");
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      return b;
    };
    const voice = (midi, t0, dur, gain, type, cut) => {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o2.type = type; o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 1.004;
      f.type = "lowpass"; f.frequency.value = cut; f.Q.value = 0.3;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(2.4, dur * 0.3)); g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); g.connect(verb);
      o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
    };
    const bar = () => {
      if (!ac) return;
      const t0 = ac.currentTime + 0.05, chord = CHORDS[step % CHORDS.length];
      chord.forEach((m, i) => voice(m, t0, 9.5, i === 0 ? 0.05 : 0.032, "sawtooth", 700 + i * 120));
      const rand = U.rng("campane|" + step);
      for (let j = 0; j < 3; j++) if (rand() < 0.75) voice(BELLS[Math.floor(rand() * BELLS.length)], t0 + 1 + j * 2.4 + rand(), 2.6, 0.02, "sine", 4000);
      step++;
    };
    const api = {
      on: false,
      start() {
        try {
          if (!ac) {
            ac = new AC();
            master = ac.createGain(); master.gain.value = 0;
            verb = ac.createConvolver(); verb.buffer = impulse();
            const wet = ac.createGain(); wet.gain.value = 0.55;
            verb.connect(wet); wet.connect(master); master.connect(ac.destination);
          }
          ac.resume();
          master.gain.cancelScheduledValues(ac.currentTime);
          master.gain.setTargetAtTime(0.5, ac.currentTime, 1.2);
          bar(); timer = setInterval(bar, 8000);
          api.on = true;
        } catch (e) { console.warn("Campus gioco: music", e); api.on = false; }
      },
      stop() {
        clearInterval(timer); timer = 0; api.on = false;
        if (ac && master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, 0.4); setTimeout(() => { if (!api.on && ac) ac.suspend(); }, 1600); }
      },
    };
    return api;
  }

  // ---------------------------------------------------------------------------------------------
  // the house banners in the courtyard: eight cloth banners on poles, waving
  const BANNER_SPOTS = [
    ["preside", -7.5, -6.45], ["falco", -4.8, -6.45], ["tartaruga", 4.8, -6.45], ["spazzino", 7.5, -6.45],
    ["ragioniere", -7.5, 6.45], ["guardiano", -4.8, 6.45], ["cronista", 4.8, 6.45], ["scettico", 7.5, 6.45],
  ];
  const POLE_H = 3.7, CLOTH_W = 0.92, CLOTH_H = 1.9, CLOTH_TOP = 3.42, SEG_X = 6, SEG_Y = 12;
  function clothCanvas(k, crest) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 512;
    const g = c.getContext("2d");
    const col = U.cssColor(k) || "#2a5a52";
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, col); grad.addColorStop(1, "#0b0f12");
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 512);
    // the banner's shape: straight top, a swallowtail at the bottom
    g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 470); g.lineTo(128, 400); g.lineTo(0, 470); g.closePath();
    g.save(); g.clip();
    g.fillStyle = grad; g.fillRect(0, 0, 256, 512);
    g.globalAlpha = 0.5; g.fillStyle = "#000"; g.fillRect(0, 0, 256, 512); g.globalAlpha = 1;
    g.fillStyle = grad; g.globalAlpha = 0.6; g.fillRect(0, 0, 256, 512); g.globalAlpha = 1;
    for (let y = 0; y < 512; y += 3) { g.fillStyle = `rgba(255,255,255,${y % 6 ? 0.025 : 0.04})`; g.fillRect(0, y, 256, 1); }
    g.strokeStyle = "#d9b45a"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(10, 4); g.lineTo(10, 458); g.lineTo(128, 392); g.lineTo(246, 458); g.lineTo(246, 4); g.stroke();
    g.lineWidth = 3; g.strokeStyle = "rgba(255,236,180,.55)";
    g.beginPath(); g.moveTo(22, 4); g.lineTo(22, 444); g.lineTo(128, 384); g.lineTo(234, 444); g.lineTo(234, 4); g.stroke();
    g.fillStyle = "#d9b45a"; g.fillRect(0, 0, 256, 14);
    if (crest && crest.naturalWidth) {
      const h = 200, w = h * crest.naturalWidth / crest.naturalHeight;
      g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.drawImage(crest, 128 - w / 2, 104, w, h);
      g.shadowColor = "transparent";
    }
    g.restore();
    return c;
  }
  function clothGeometry(THREE) {
    // a front and a back sheet in one geometry, so both sides read the right way round
    const nx = SEG_X + 1, ny = SEG_Y + 1, count = nx * ny * 2;
    const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), rest = new Float32Array(count * 3), idx = [];
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v = side * nx * ny + j * nx + i, u = i / SEG_X, t = j / SEG_Y;
        const x = (u - 0.5) * CLOTH_W, y = -t * CLOTH_H, z = side ? -0.004 : 0.004;
        rest[v * 3] = x; rest[v * 3 + 1] = y; rest[v * 3 + 2] = z;
        uv[v * 2] = side ? 1 - u : u; uv[v * 2 + 1] = 1 - t;
      }
      for (let j = 0; j < SEG_Y; j++) for (let i = 0; i < SEG_X; i++) {
        const a = side * nx * ny + j * nx + i, b = a + 1, c2 = a + nx, d = c2 + 1;
        if (side) idx.push(a, b, c2, b, d, c2); else idx.push(a, c2, b, b, c2, d);
      }
    }
    pos.set(rest);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.rest = rest;
    return g;
  }
  function buildBanners() {
    const ctx = C.ctx, THREE = ctx && ctx.THREE;
    if (S.banners || !ctx || !ctx.has3d || !THREE || !ctx.scene) return;
    const group = new THREE.Group();
    group.name = "gioco:stendardi";
    const metal = new THREE.MeshStandardMaterial({ color: U.col(0x2b2f33), roughness: 0.45, metalness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: U.col(0xd9b45a), roughness: 0.35, metalness: 0.8, emissive: U.col(0x3a2a08), emissiveIntensity: 0.4 });
    const poleG = new THREE.CylinderGeometry(0.035, 0.045, POLE_H, 8), barG = new THREE.CylinderGeometry(0.022, 0.022, CLOTH_W + 0.22, 6), tipG = new THREE.SphereGeometry(0.07, 10, 8), footG = new THREE.CylinderGeometry(0.16, 0.2, 0.12, 10);
    const items = [];
    for (const [k, x, z] of BANNER_SPOTS) {
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      const pole = new THREE.Mesh(poleG, metal); pole.position.set(-CLOTH_W / 2 - 0.12, POLE_H / 2, 0); pole.castShadow = true;
      const foot = new THREE.Mesh(footG, metal); foot.position.set(pole.position.x, 0.06, 0);
      const crossbar = new THREE.Mesh(barG, gold); crossbar.rotation.z = Math.PI / 2; crossbar.position.set(-0.01, CLOTH_TOP + 0.02, 0);
      const tip = new THREE.Mesh(tipG, gold); tip.position.set(pole.position.x, POLE_H + 0.05, 0);
      const geo = clothGeometry(THREE);
      const tex = new THREE.CanvasTexture(clothCanvas(k, null));
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: U.col(0xffffff), emissiveIntensity: 0.1, roughness: 0.92, metalness: 0, alphaTest: 0.5, side: THREE.FrontSide });
      const cloth = new THREE.Mesh(geo, mat);
      cloth.position.set(0, CLOTH_TOP, 0);
      cloth.castShadow = true;
      holder.add(pole, foot, crossbar, tip, cloth);
      group.add(holder);
      items.push({ k, geo, tex, mat, phase: U.hash(k) % 628 / 100 });
      const crest = new Image();
      crest.decoding = "async";
      crest.onload = () => { safe(() => { tex.image = clothCanvas(k, crest); tex.needsUpdate = true; }); };
      crest.onerror = () => console.warn("Campus gioco: crest not loaded", k);
      crest.src = STEMMA(k);
    }
    ctx.scene.add(group);
    S.banners = { group, items, geos: [poleG, barG, tipG, footG], mats: [metal, gold] };
    if (!reduce()) startWave();
  }
  function startWave() {
    if (S.bannerLoop) return;
    let last = performance.now(), acc = 0;
    const frame = (now) => {
      S.bannerLoop = requestAnimationFrame(frame);
      if (!S.banners || !S.visible) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      acc += dt;
      const low = C.render && C.render.quality === "low";
      if (low && acc < 1 / 15) return;   // a slower wave on low quality
      const t = now / 1000;
      acc = 0;
      for (const it of S.banners.items) {
        const p = it.geo.attributes.position, rest = it.geo.userData.rest, a = p.array;
        for (let v = 0; v < p.count; v++) {
          const x = rest[v * 3], y = rest[v * 3 + 1], depth = -y / CLOTH_H;
          const w = Math.sin(t * 1.7 + it.phase + x * 3.1 - y * 1.6) * 0.07 * depth + Math.sin(t * 0.9 + it.phase * 2 + y * 0.8) * 0.035 * depth;
          a[v * 3] = x + Math.sin(t * 0.7 + it.phase) * 0.03 * depth;
          a[v * 3 + 1] = y;
          a[v * 3 + 2] = rest[v * 3 + 2] + w;
        }
        p.needsUpdate = true;
        it.geo.computeVertexNormals();
      }
    };
    S.bannerLoop = requestAnimationFrame(frame);
  }
  function disposeBanners() {
    if (S.bannerLoop) cancelAnimationFrame(S.bannerLoop);
    S.bannerLoop = 0;
    const b = S.banners;
    if (!b) return;
    S.banners = null;
    safe(() => {
      if (b.group.parent) b.group.parent.remove(b.group);
      b.items.forEach((it) => { it.geo.dispose(); it.tex.dispose(); it.mat.dispose(); });
      b.geos.forEach((g) => g.dispose()); b.mats.forEach((m) => m.dispose());
    });
  }

  // ---------------------------------------------------------------------------------------------
  // start
  function start(opts) {
    if (S.started) return;
    S.started = true;
    const o = opts || {};
    injectStyle();
    addBar();
    bus.on("campus:ready", (p) => { if (p && p.has3d) safe(buildBanners); refreshTitle(); });
    bus.on("campus:degraded", (p) => { if (p && (p.reason === "no-3d" || p.reason === "context-lost" || p.reason === "no-webgl")) disposeBanners(); });
    bus.on("render:restored", () => { disposeBanners(); safe(buildBanners); });
    bus.on("campus:visibility", (p) => { S.visible = !p || p.visible !== false; });
    bus.on("data:change", () => { refreshTitle(); if (S.codex) safe(() => fillCard(S.codex.querySelector(".cp-g-cx-card"), KEYS[S.codexKey])); });
    bus.on("life:mode", () => modeBanner(false));
    bus.on("life:feed", onFeed);
    document.addEventListener("fullscreenchange", onFullscreen);
    if (o.title !== false) openTitle();
  }

  C.gioco = {
    start,
    openTitle, closeTitle, enterCampus,
    openCodex, closeCodex, showCharacter,
    cinema, toggleMusic,
    get cinemaOn() { return S.cinema; },
    get titleOpen() { return !!S.title; },
    get codexOpen() { return !!S.codex; },
    PERSONA,
    _state: S,
    _banner: modeBanner,
  };
})();
