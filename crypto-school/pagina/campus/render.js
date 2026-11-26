/* Scuola Cripto · campus renderer (campus/render.js), contract v1.0 §5.1.
   It owns the WebGL renderer, the scene and the camera; Rome's sky by day and by night (sun,
   moon, stars, clouds, fog and a far countryside); the quality presets that follow the measured
   fps; the post-processing loaded on demand (bloom, SSAO); and the camera rig: «regia», an
   automatic director that frames whoever speaks or acts, «libera», a free orbit, and «segui»,
   which follows one agent. It reads no database value: the scene follows Rome's clock only. */
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.render) return;
  const U = C.util, bus = C.bus;

  const DEG = Math.PI / 180, FOV = 42, TAN = Math.tan((FOV / 2) * DEG);
  const LEVELS = ["low", "medium", "high"], STARS = { low: 150, medium: 300, high: 600 }, LIGHTS = { low: 2, medium: 4, high: 6 };
  const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/";
  const FILES = {
    orbit: ["controls/OrbitControls"],
    post: ["shaders/CopyShader", "shaders/LuminosityHighPassShader", "shaders/FXAAShader", "postprocessing/EffectComposer",
      "postprocessing/RenderPass", "postprocessing/ShaderPass", "postprocessing/UnrealBloomPass"],
    ssao: ["math/SimplexNoise", "shaders/SSAOShader", "postprocessing/SSAOPass"],
  };
  const BOUNDS = [-24, -20, 24, 20];
  // the director's pleasing angles: [yaw from the subject to the camera (0 = south, +x = east), elevation°]
  // (higher than the contract's 35/25/35 for wide shots: low angles put the garden's trees in front of the north wing)
  const ANGLES = [[Math.PI / 4, 35], [0, 25], [-Math.PI / 4, 35]], WIDE = [[Math.PI / 4, 40], [0, 34], [-Math.PI / 4, 40]];
  const CYCLE = ["wide", "medium", "close"];

  const R = {
    scene: null, camera: null, renderer: null,
    quality: "medium", qualityMode: "auto", lightBudget: 4, fps: 0,
    sky: { romeMinutes: 0, sunAltDeg: 0, sunAzDeg: 0, night: 0, phase: "giorno" },
    cameraMode: "regia", followKey: null, focusRoom: null, postActive: false,
  };

  let T = null, ctx = null, renderer = null, scene = null, camera = null, canvas = null;
  let inited = false, disposed = false, lost = false, drawn = false, reduce = false, coarse = false, fine = false;
  let hemi, sun, moon, env, skyMat, starGeo, starMat, veil = null;
  const offs = [], domOffs = [];
  let clockT = 0, lastDt = 1 / 60, wallAt = 0;
  const V = () => new T.Vector3();
  let UP, _a, _b, _c, _d, _e;
  const PAL = {}, tmp = {};

  // ---- small helpers ---------------------------------------------------------------------------
  const W = () => C.world || null;
  const P = () => (C.people && C.people.ready ? C.people : null);
  const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const aspect = () => (camera ? camera.aspect : 16 / 9);
  const safe = (fn, dflt) => { try { return fn(); } catch (e) { return dflt; } };
  const roomAt = (x, z) => safe(() => (W() && W().roomAt ? W().roomAt(x, z) : null), null);
  const roomOf = (id) => safe(() => (W() && W().rooms || []).find((r) => r.id === id), null) || null;
  const inRoom = (id, x, z, m) => { const r = roomOf(id); return !!r && r.rects.some((q) => x >= q[0] + m && x <= q[2] - m && z >= q[1] + m && z <= q[3] - m); };
  const dirOf = (yaw, el, out) => (out || V()).set(Math.sin(yaw) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(yaw) * Math.cos(el * DEG));
  const wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const validKey = (k) => C.KEYS.includes(k) && !!(P() && safe(() => P().positionOf(k), null));
  // a critically damped spring on a Vector3: `hl` is the time to cover half of the distance from rest
  function spring(x, v, g, hl, dt) {
    const y = 1.678 / Math.max(0.02, hl), e = Math.exp(-y * dt);
    let j0 = x.x - g.x, j1 = v.x + j0 * y; x.x = e * (j0 + j1 * dt) + g.x; v.x = e * (v.x - j1 * y * dt);
    j0 = x.y - g.y; j1 = v.y + j0 * y; x.y = e * (j0 + j1 * dt) + g.y; v.y = e * (v.y - j1 * y * dt);
    j0 = x.z - g.z; j1 = v.z + j0 * y; x.z = e * (j0 + j1 * dt) + g.z; v.z = e * (v.z - j1 * y * dt);
  }

  // ---- on-demand scripts (examples/js of three r128 from jsdelivr) ------------------------------------
  const loaded = {};
  function loadOne(file) {
    const name = file.split("/").pop();
    if (window.THREE && window.THREE[name]) return Promise.resolve();
    if (loaded[file]) return loaded[file];
    return (loaded[file] = new Promise((res, rej) => {
      const s = document.createElement("script");
      const done = (ok, why) => { clearTimeout(timer); s.onload = s.onerror = null; ok ? res() : rej(new Error(why)); };
      const timer = setTimeout(() => done(false, "timeout: " + file), 8000);
      s.onload = () => done(!!(window.THREE && window.THREE[name]), "missing: " + name);
      s.onerror = () => done(false, "not loaded: " + file);
      s.async = false; s.src = CDN + file + ".js";
      document.head.appendChild(s);
    }));
  }
  // in order, one after the other: a failed file stops the chain before its dependants run
  const loadAll = (list) => list.reduce((p, f) => p.then(() => loadOne(f)), Promise.resolve());

  // ---- sky, stars, far countryside ---------------------------------------------------------------------
  const SKY_VS = `varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  // colours are display-referred (sRGB, after tone mapping), exactly like the fog colour that
  // three.js mixes in after encoding: the horizon and the fogged ground meet without a seam
  const SKY_FS = `uniform vec3 uZen, uHor, uBand, uGlow, uSun, uMoon, uCloud, uHill;
uniform float uSunA, uMoonA, uBandA, uClouds, uT;
varying vec3 vDir;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 c = mix(uHor, uZen, pow(clamp(y, 0.0, 1.0), 0.5));
  c = mix(c, uBand, uBandA * exp(-pow((y - 0.1) / 0.08, 2.0)));
  float s = max(dot(d, uSun), 0.0);
  c += uGlow * uSunA * (0.26 * pow(s, 5.0) + 0.42 * pow(s, 42.0) + 1.5 * smoothstep(0.99955, 0.9998, s));
  float m = max(dot(d, uMoon), 0.0);
  c += vec3(0.80, 0.86, 1.0) * uMoonA * (0.85 * smoothstep(0.99962, 0.99984, m) + 0.12 * pow(m, 160.0));
  if (uClouds > 0.0 && y > 0.0) {
    vec2 p = d.xz / (y + 0.1) * 0.8 + vec2(uT * 0.006, uT * 0.002);
    float f = 0.5 * n2(p) + 0.25 * n2(p * 2.1 + 3.1) + 0.125 * n2(p * 4.3 + 7.7) + 0.0625 * n2(p * 8.9 + 1.3);
    float k = smoothstep(0.52, 0.82, f) * smoothstep(0.0, 0.2, y) * uClouds;
    c = mix(c, uCloud * (0.86 + 0.22 * f) + uGlow * uSunA * 0.22 * pow(s, 4.0), k * 0.82);
  }
  float a = atan(d.x, -d.z), aa = 0.0005;
  float hz = 0.011 + 0.007 * sin(a * 2.0 + 0.7) + 0.0045 * sin(a * 5.0 + 2.1) + 0.0025 * sin(a * 13.0 + 0.3);
  float cl = a * 70.0, ci = floor(cl), cf = fract(cl) - 0.5, r = h1(ci);
  float sil = smoothstep(hz + aa, hz - aa, y);
  if (r > 0.62) {
    float u = abs(cf) / (0.32 + 0.12 * h1(ci + 3.0));
    if (u < 1.0) { float b = hz + 0.0034 - 0.0006 * u * u, t = hz + 0.0036 + 0.0021 * sqrt(1.0 - u * u);
      sil = max(sil, smoothstep(b - aa, b + aa, y) * smoothstep(t + aa, t - aa, y)); }
    sil = max(sil, step(abs(cf), 0.03) * smoothstep(hz + 0.004, hz + 0.0034, y));
  } else if (r > 0.5) {
    float u = abs(cf) / 0.13; if (u < 1.0) { float t = hz + 0.0085 * (1.0 - u * u); sil = max(sil, smoothstep(t + aa, t - aa, y)); }
  }
  c = mix(c, uHill, sil);
  c = mix(c, uHor, smoothstep(0.0, -0.03, y));
  c += (h2(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;
  const STAR_VS = `attribute float aS; attribute float aP; uniform float uA, uT, uPR; varying float vA;
void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uPR;
  vA = uA * (0.72 + 0.28 * sin(uT * (0.7 + aP) + aP * 6.2831)); }`;
  const STAR_FS = `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.86, 0.9, 1.0, vA * smoothstep(0.5, 0.08, d)); }`;
  // the last pass with post: a gentle vignette, a faint split-tone and a dither against banding
  const FINISH = {
    uniforms: { tDiffuse: { value: null }, uVig: { value: 0.2 }, uAsp: { value: 1.6 }, uWarm: { value: 1 }, uGain: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uAsp, uWarm, uGain; varying vec2 vUv;
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * uGain; vec2 q = (vUv - 0.5) * vec2(sqrt(uAsp), 1.0 / sqrt(uAsp));
  c *= 1.0 - uVig * smoothstep(0.12, 0.62, dot(q, q));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c += (vec3(-0.008, 0.0, 0.012) * (1.0 - l) + vec3(0.010, 0.004, -0.008) * l) * uWarm;
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0); }`,
  };

  function buildEnv() {
    env = new T.Group(); env.name = "cp-r-env";
    skyMat = new T.ShaderMaterial({
      uniforms: Object.fromEntries(["uZen", "uHor", "uBand", "uGlow", "uCloud", "uHill"].map((k) => [k, { value: new T.Color() }])
        .concat(["uSun", "uMoon"].map((k) => [k, { value: V() }]), ["uSunA", "uMoonA", "uBandA", "uClouds", "uT"].map((k) => [k, { value: 0 }]))),
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    skyMat.uniforms.uMoon.value.set(-0.7, 0.62, 0.36).normalize();
    const sky = new T.Mesh(new T.SphereGeometry(320, 40, 20), skyMat);
    sky.renderOrder = -1e6; sky.frustumCulled = false; sky.name = "cp-r-sky";
    const n = STARS.high, pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n), rnd = U.rng("stelle di Roma");
    for (let i = 0; i < n; i++) {
      const az = rnd() * Math.PI * 2, el = Math.asin(0.07 + 0.93 * Math.pow(rnd(), 0.8)), r = 300;
      pos.set([Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r], i * 3);
      sz[i] = 1.5 + Math.pow(rnd(), 3) * 3.0; ph[i] = rnd();
    }
    starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    starGeo.setAttribute("aS", new T.BufferAttribute(sz, 1));
    starGeo.setAttribute("aP", new T.BufferAttribute(ph, 1));
    starMat = new T.ShaderMaterial({ uniforms: { uA: { value: 0 }, uT: { value: 0 }, uPR: { value: 1 } }, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    const stars = new T.Points(starGeo, starMat); stars.frustumCulled = false; stars.name = "cp-r-stars"; stars.renderOrder = -1;
    env.add(sky, stars);
    scene.add(env);
    // the countryside beyond the campus grounds (x ±40, z ±34 belong to world): fields and pines, fogged
    const far = new T.Group(); far.name = "cp-r-countryside";
    const g = new T.RingGeometry(33, 420, 96, 24); g.rotateX(-Math.PI / 2);
    const FIELDS = [0x6f7d55, 0x83835f, 0x667552, 0x857560, 0x77805c, 0x6b7752].map((h) => U.col(h));
    const p = g.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), c = FIELDS[U.hash(Math.round(x / 26 + Math.sin(z * 0.03) * 0.6) + ":" + Math.round(z / 21)) % FIELDS.length];
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new T.BufferAttribute(cols, 3));
    const ground = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
    ground.position.y = -0.12; ground.receiveShadow = false; ground.name = "cp-r-farground";
    // clumps of umbrella pines, rows of cypresses and a few holm oaks, far out in the fields
    const rnd2 = U.rng("pini e cipressi"), list = [];
    for (let c = 0; c < 16; c++) {
      const a = (c / 16) * Math.PI * 2 + rnd2() * 0.3, rr = 82 + rnd2() * 80, k = rnd2(), n = 2 + Math.floor(rnd2() * 4);
      for (let i = 0; i < n; i++) {
        const row = k > 0.55 && k < 0.82, off = row ? (i - n / 2) * 4.2 : (rnd2() - 0.5) * 16, side = row ? 0 : (rnd2() - 0.5) * 14;
        list.push([Math.sin(a) * rr + Math.cos(a) * off + Math.sin(a) * side, Math.cos(a) * rr - Math.sin(a) * off + Math.cos(a) * side, k, rnd2(), rnd2()]);
      }
    }
    const crowns = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial(), list.length);
    const trunkGeo = new T.CylinderGeometry(0.13, 0.22, 1, 5); trunkGeo.translate(0, 0.5, 0);
    const trunks = new T.InstancedMesh(trunkGeo, new T.MeshLambertMaterial({ color: U.col(0x5a4636) }), list.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = V(), o = V(), col = new T.Color();
    list.forEach(([x, z, k, u, w], i) => {
      const kind = k < 0.36 ? "pino" : k < 0.82 ? "cipresso" : "leccio";
      const h = kind === "pino" ? 4.2 + u * 2.2 : kind === "cipresso" ? 0.9 : 2.0;
      e.set((w - 0.5) * 0.12, u * 6, (u - 0.5) * 0.12); q.setFromEuler(e);
      m.compose(o.set(x, -0.1, z), q, s.set(1, h, 1)); trunks.setMatrixAt(i, m);
      if (kind === "pino") { m.compose(o.set(x, h + 0.9, z), q, s.set(2.5 + w, 1.55 + u * 0.4, 2.5 + w)); col.setHex(0x3f5a33); }
      else if (kind === "cipresso") { m.compose(o.set(x, 4.6 + u, z), q, s.set(0.95 + w * 0.3, 4.2 + u, 0.95 + w * 0.3)); col.setHex(0x33482c); }
      else { m.compose(o.set(x, 3.8, z), q, s.set(2.5 + w, 2.1 + u * 0.6, 2.5 + w)); col.setHex(0x55693d); }
      crowns.setMatrixAt(i, m); crowns.setColorAt(i, col.offsetHSL(0, 0, (u - 0.5) * 0.05).convertSRGBToLinear());
    });
    crowns.name = "cp-r-farcrowns"; trunks.name = "cp-r-fartrunks";
    far.add(ground, crowns, trunks);
    far.traverse((x) => { x.matrixAutoUpdate = false; x.updateMatrix(); });
    scene.add(far);
  }

  // ---- the sky follows Rome's clock ------------------------------------------------------------------------
  let skyInit = false, dAlt = 0, dAz = 180, pAlt = 0, pAz = 180, blending = false, romeAt = -1e9, lastNowMs = 0, skyEmitAt = -1e9;
  function sunVec(alt, az, out) { return out.set(Math.sin(az * DEG) * Math.cos(alt * DEG), Math.sin(alt * DEG), -Math.cos(az * DEG) * Math.cos(alt * DEG)); }
  function updateSky(dt, wdt = dt) {
    const now = C.clock.now(), s = U.sun(now);
    if (!skyInit) { dAlt = s.altDeg; dAz = s.azDeg; skyInit = true; }
    else {
      sunVec(pAlt, pAz, _a); sunVec(s.altDeg, s.azDeg, _b);
      if (_a.angleTo(_b) > 10 * DEG) blending = true;
      if (blending) {
        const k = 1 - Math.pow(0.5, wdt / 1.2);
        dAlt += (s.altDeg - dAlt) * k; dAz += wrapDeg(s.azDeg - dAz) * k; dAz = (dAz + 360) % 360;
        if (Math.abs(s.altDeg - dAlt) < 0.3 && Math.abs(wrapDeg(s.azDeg - dAz)) < 0.5) blending = false;
      } else { dAlt = s.altDeg; dAz = s.azDeg; }
    }
    pAlt = s.altDeg; pAz = s.azDeg;
    const sk = R.sky, nowMs = now.getTime();
    if (clockT - romeAt >= 1 || Math.abs(nowMs - lastNowMs) > 30000) { romeAt = clockT; sk.romeMinutes = U.rome(now).minutes; }
    lastNowMs = nowMs;
    const night = U.nightOf(dAlt), phase = s.altDeg >= 6 ? "giorno" : s.altDeg <= -8 ? "notte" : s.azDeg < 180 ? "alba" : "tramonto";
    const changed = phase !== sk.phase;
    sk.sunAltDeg = s.altDeg; sk.sunAzDeg = s.azDeg; sk.night = night; sk.phase = phase;
    if (changed || clockT - skyEmitAt >= 60) { skyEmitAt = clockT; bus.emit("render:sky", { romeMinutes: sk.romeMinutes, sunAltDeg: sk.sunAltDeg, night, phase }); }
    // the palette: day, golden hour, night (display-space colours for sky and fog)
    const g = U.smooth(15, 2, dAlt) * (1 - U.smooth(-3, -9, dAlt));
    const mix3 = (out, a, b, kb, c, kc) => out.copy(PAL[a]).lerp(PAL[b], kb).lerp(PAL[c], kc);
    const hor = mix3(tmp.hor, "dayH", "goldH", g, "nightH", night);
    const u = skyMat.uniforms;
    mix3(u.uZen.value, "dayZ", "goldZ", g * 0.7, "nightZ", night);
    u.uHor.value.copy(hor);
    u.uBand.value.copy(PAL.band); u.uBandA.value = g * (1 - night * 0.6) * 0.55;
    u.uGlow.value.copy(PAL.glowD).lerp(PAL.glowG, g);
    mix3(u.uCloud.value, "cloudD", "cloudG", g, "cloudN", night);
    u.uHill.value.copy(hor).lerp(mix3(tmp.hill, "hillD", "hillG", g, "hillN", night), 0.55);
    sunVec(dAlt, dAz, u.uSun.value);
    u.uSunA.value = U.smooth(-4, 1, dAlt); u.uMoonA.value = night;
    u.uClouds.value = R.quality === "low" ? 0 : 0.9;
    if (!reduce) u.uT.value = clockT;
    scene.fog.color.copy(hor); renderer.setClearColor(hor, 1);
    hemi.color.copy(mix3(tmp.c, "hemiD", "hemiG", g * 0.6, "hemiN", night)).convertSRGBToLinear();
    hemi.groundColor.copy(PAL.grD).lerp(PAL.grN, night).convertSRGBToLinear();
    hemi.intensity = U.lerp(0.85, 0.16, night);
    sun.color.copy(PAL.sunD).lerp(PAL.sunL, U.smooth(12, 3, dAlt)).convertSRGBToLinear();
    sun.intensity = 2.2 * (1 - night);
    moon.intensity = 0.25 * night;
    renderer.toneMappingExposure = U.lerp(1.05, 0.82, night);
    starMat.uniforms.uA.value = U.smooth(0.5, 0.9, night);
    env.children[1].visible = starMat.uniforms.uA.value > 0.001;
    if (!reduce) starMat.uniforms.uT.value = clockT;
    // the sun light: no lower than 7° so that the shadows stay readable at dawn and dusk
    sunVec(Math.max(7, dAlt), dAz, tmp.ldir);
    // nothing to update in the shadow map once the sun is down
    renderer.shadowMap.autoUpdate = night < 0.995;
  }

  // ---- quality presets and the adaptive fps logic ------------------------------------------------------
  const fpsWin = []; let fpsSum = 0, warm = 3, lowT = 0, highT = 0, prLowT = 0, prDropped = false, ups = 0, everUp = false, noUps = false;
  const pixelRatio = (q) => { const dpr = window.devicePixelRatio || 1; return q === "low" ? (prDropped ? 0.75 : Math.min(1, dpr)) : q === "medium" ? Math.min(1.5, dpr) : Math.min(2, dpr); };
  function resetMeasure(w) { fpsWin.length = 0; fpsSum = 0; lowT = highT = prLowT = 0; warm = w; }
  function adapt(dt) {
    fpsWin.push(dt); fpsSum += dt;
    while (fpsSum > 2 && fpsWin.length > 1) fpsSum -= fpsWin.shift();
    R.fps = fpsSum > 0 ? fpsWin.length / fpsSum : 0;
    if (warm > 0) { warm -= dt; return; }
    if (R.qualityMode !== "auto") return;
    const f = R.fps;
    lowT = f < 27 ? lowT + dt : 0; highT = f > 52 ? highT + dt : 0;
    if (R.quality === "low" && !prDropped) {
      prLowT = f < 22 ? prLowT + dt : 0;
      if (prLowT >= 4) { prDropped = true; renderer.setPixelRatio(pixelRatio("low")); R.resize(ctx.size.w, ctx.size.h); resetMeasure(3); return; }
    }
    if (lowT >= 3) {
      if (R.postActive) { setPost(false); resetMeasure(3); return; }
      const i = LEVELS.indexOf(R.quality);
      // already at low: only lowT starts again, so that prLowT can still reach its 4 s
      if (i > 0) { if (everUp) noUps = true; applyQuality(LEVELS[i - 1], "fps-low"); } else lowT = 0;
    } else if (highT >= 10 && !noUps && ups < 2 && R.quality !== "high") {
      ups += 1; everUp = true; applyQuality(LEVELS[LEVELS.indexOf(R.quality) + 1], "fps-high");
    }
  }
  function eachMaterial(fn) { scene.traverse((o) => { if (o.material) [].concat(o.material).forEach(fn); }); }
  function applyQuality(level, reason) {
    R.quality = level;
    renderer.setPixelRatio(pixelRatio(level));
    const sh = level !== "low";
    if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; eachMaterial((m) => { m.needsUpdate = true; }); }
    const size = level === "high" ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    starGeo.setDrawRange(0, STARS[level]);
    if (W()) safe(() => { C.world.surfaceScale = level === "low" ? 0.5 : 1; });
    if (P() && P().setDetail) safe(() => P().setDetail(level));
    R.resize(ctx.size.w, ctx.size.h);
    if (level === "high") R.loadPost().then((ok) => { if (ok && R.quality === "high") setPost(true); });
    else setPost(false);
    resetMeasure(3);
    if (reason) bus.emit("render:quality", { level, reason, fps: R.fps });
  }

  // ---- post-processing (high only) -------------------------------------------------------------------------
  let composer = null, renderPass = null, bloomPass = null, fxaaPass = null, finishPass = null, ssaoPass = null, msaa = false, postPromise = null;
  let ssaoTrial = 0, ssaoDead = false;
  function buildComposer() {
    // stencil on: in r128 that is the only way to get a 24-bit depth buffer (16 bits z-fight at 0.1 m near)
    const pars = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, encoding: T.sRGBEncoding, stencilBuffer: true };
    let rt;
    // the composer works in display space: tone mapping and sRGB stay in the materials, as without post,
    // so fog, sky and clear colour match and no shader recompiles when post turns on or off
    if (renderer.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget) { rt = new T.WebGLMultisampleRenderTarget(4, 4, pars); rt.samples = 4; msaa = true; }
    else rt = new T.WebGLRenderTarget(4, 4, pars);
    composer = new T.EffectComposer(renderer, rt);
    renderPass = new T.RenderPass(scene, camera);
    bloomPass = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.4, 0.82);
    bloomPass.highPassUniforms.smoothWidth.value = 0.06;
    fxaaPass = new T.ShaderPass(T.FXAAShader); fxaaPass.enabled = !msaa;
    finishPass = new T.ShaderPass(FINISH);
    [renderPass, bloomPass, fxaaPass, finishPass].forEach((p) => composer.addPass(p));
    sizeComposer();
  }
  function sizeComposer() {
    if (!composer) return;
    const pr = renderer.getPixelRatio(), w = Math.max(1, ctx.size.w), h = Math.max(1, ctx.size.h);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    fxaaPass.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    finishPass.uniforms.uAsp.value = w / h;
    if (ssaoPass) ssaoPass.setSize(w * pr, h * pr);
  }
  function setPost(on) {
    const v = !!(on && composer && R.quality === "high");
    if (v === R.postActive) return;
    R.postActive = v;
    if (v) { ssaoTrial = 0; maybeSsao(); }
    else if (ssaoPass) ssaoPass.enabled = false, renderPass.enabled = true;
  }
  R.loadPost = () => {
    if (!inited || disposed) return Promise.resolve(false);
    if (!postPromise) {
      postPromise = loadAll(FILES.post)
        .then(() => { if (disposed) throw new Error("render disposed"); if (!composer) buildComposer(); bus.emit("render:post", { loaded: true }); return true; })
        .catch((e) => { composer = null; bus.emit("render:post", { loaded: false, error: String((e && e.message) || e) }); return false; });
    }
    return postPromise;
  };
  // SSAO: desktop only, kept only while the frame stays over 45 fps and inside the draw budget
  function maybeSsao() {
    if (ssaoDead || !fine || coarse || !composer) return;
    if (ssaoPass) { ssaoPass.enabled = true; renderPass.enabled = false; fxaaPass.enabled = true; ssaoTrial = 0; return; }
    loadAll(FILES.ssao).then(() => {
      if (ssaoPass || ssaoDead || !composer || disposed) return;
      const pr = renderer.getPixelRatio();
      ssaoPass = new T.SSAOPass(scene, camera, ctx.size.w * pr, ctx.size.h * pr);
      // depths are normalised over near..far (0.1..400 m): 0.00012 ≈ 5 cm, 0.0015 ≈ 0.6 m
      Object.assign(ssaoPass, { kernelRadius: 0.38, minDistance: 0.00012, maxDistance: 0.0015 });
      // a gentle occlusion: the pass multiplies the lit frame, so at full strength a detailed room loses ~20% of its light
      const fs = ssaoPass.ssaoMaterial.fragmentShader;
      ssaoPass.ssaoMaterial.fragmentShader = fs.replace("vec3( 1.0 - occlusion )", "vec3( 1.0 - occlusion * 0.3 )");
      ssaoPass.ssaoMaterial.needsUpdate = true;
      ssaoPass.beautyRenderTarget.texture.encoding = T.sRGBEncoding;
      // 24-bit depth for both of its passes (the 16-bit defaults band into stripes)
      ssaoPass.beautyRenderTarget.stencilBuffer = true;
      ssaoPass.normalRenderTarget.depthTexture.type = T.UnsignedIntType;
      composer.insertPass(ssaoPass, 1);
      ssaoPass.enabled = R.postActive; renderPass.enabled = !R.postActive; fxaaPass.enabled = R.postActive || !msaa;
      ssaoTrial = 0;
    }).catch(() => { ssaoDead = true; });
  }
  function checkSsao(dt) {
    if (!ssaoPass || !ssaoPass.enabled || ssaoDead) return;
    ssaoTrial += dt;
    const calls = renderer.info.render.calls;
    if ((ssaoTrial > 1.5 && calls > 700) || (ssaoTrial > 4 && R.fps < 45)) {
      ssaoDead = true; ssaoPass.enabled = false; renderPass.enabled = true; fxaaPass.enabled = !msaa;
    }
  }

  // ---- the camera rig ------------------------------------------------------------------------------------------
  const rig = { P: null, T: null, vP: null, vT: null, gP: null, gT: null, hlP: 0.45, hlT: 0.45 };
  let shot = null, pending = null, lastReq = 0, lastCut = -9, lastVary = 0, idleAt = 0, angleN = 0, p3n = 0, nightDorm = 0;
  const minHold = () => (reduce ? 8 : 4);
  const eff = (s) => (clockT - s.start < s.hold ? s.priority : 0);

  // the distance that fits every point inside `fill` of the frame, for a camera looking along -dir at `tgt`
  function fit(pts, tgt, dir, fill) {
    const f = _c.copy(dir).negate(), r = _d.crossVectors(f, UP).normalize(), u = _e.crossVectors(r, f);
    const tv = TAN * fill, th = tv * aspect();
    let d = 0;
    for (const p of pts) {
      _a.set(p.x - tgt.x, p.y - tgt.y, p.z - tgt.z);
      const z = _a.dot(f);
      d = Math.max(d, Math.abs(_a.dot(r)) / th - z, Math.abs(_a.dot(u)) / tv - z);
    }
    return d;
  }
  // a camera at `el`° over the subject, then raised until it clears the walls (y ≥ minY)
  function place(tgt, yaw, el, pts, fill, minD, minY) {
    let dir = dirOf(yaw, el), d = Math.max(minD, fit(pts, tgt, dir, fill));
    for (let i = 0; i < 3 && tgt.y + dir.y * d < minY; i++) {
      el = Math.min(70, Math.asin(Math.min(0.94, (minY - tgt.y) / d)) / DEG + 2);
      dir = dirOf(yaw, el); d = Math.max(minD, fit(pts, tgt, dir, fill));
    }
    const p = tgt.clone().addScaledVector(dir, d);
    if (p.y < minY) p.y = minY;
    return p;
  }
  function rectPts(x0, z0, x1, z1, tgt, yaw, walls) {
    const pts = [], fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      pts.push(V().set(x, 0, z));
      if (walls && (x - tgt.x) * fx + (z - tgt.z) * fz > 0) pts.push(V().set(x, 3.2, z));
    }
    return pts;
  }
  function campusShot(s) {
    const night = R.sky.night > 0.5;
    // portrait screens get a steeper view, so the campus fills the tall frame
    const A = aspect() < 1 ? (night ? [[0.3, 50], [-0.3, 52]] : [[0.32, 56], [0, 60], [-0.32, 56]])
      : night ? [[0.45, 23], [-0.5, 25], [0.12, 21]] : [[0.62, 40], [0, 46], [-0.62, 40]];
    const [yaw, el] = A[s.angle % A.length];
    const tgt = V().set(0, 0, night ? -1 : 0.5);
    const p = place(tgt, yaw, el, rectPts(BOUNDS[0], BOUNDS[1], BOUNDS[2], BOUNDS[3], tgt, yaw, true), aspect() < 1 ? 0.98 : 0.9, 20, 3.6);
    return { kind: "campus", P: p, T: tgt, room: null, track: false };
  }
  function roomShot(s) {
    const r = roomOf(s.room);
    if (!r) return campusShot(s);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const q of r.rects) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[2]); z1 = Math.max(z1, q[3]); }
    const [yaw, el] = WIDE[s.angle % 3];
    const tgt = V().set((x0 + x1) / 2, 0.6, (z0 + z1) / 2);
    const walled = r.kind === "interno" || r.kind === "dormitorio";
    return { kind: "wide", P: place(tgt, yaw, el, rectPts(x0, z0, x1, z1, tgt, yaw, walled), 0.85, 7, 3.6), T: tgt, room: r.id, track: false };
  }
  // feet and heads of the subjects; "motore" is its terminal in the meeting room
  function subjectPts(keys) {
    const p = P(), pts = [];
    for (const k of keys) {
      if (k === "motore") {
        const a = safe(() => W().anchor("riunione.screen"), null), sp = (a && a.speak) || { x: -1.4, y: 1.7, z: -16.8 };
        pts.push(V().set(sp.x, 0.4, sp.z), V().set(sp.x, sp.y + 0.3, sp.z));
        continue;
      }
      const f = p && safe(() => p.positionOf(k), null);
      if (!f) continue;
      const h = safe(() => p.headOf(k), null) || { x: f.x, y: (f.y || 0) + 1.75, z: f.z };
      pts.push(V().set(f.x, f.y || 0, f.z), V().set(h.x, h.y, h.z));
    }
    return pts;
  }
  function center(pts) {
    const b = new T.Box3().setFromPoints(pts);
    return b.getCenter(V());
  }
  function groupShot(s) {
    const keys = s.keys || [];
    let pts = subjectPts(keys);
    if (!pts.length && s.point) pts = [V().set(s.point.x - 2, 0, s.point.z - 2), V().set(s.point.x + 2, 1.8, s.point.z + 2)];
    if (!pts.length) return s.room ? roomShot(s) : campusShot(s);
    const tgt = center(pts), room = s.room || roomAt(pts[0].x, pts[0].z), yaws = [];
    if (pts.length >= 4 && keys[0] !== "motore") {
      // two people: over the listener's shoulder, either side
      const dx = pts[2].x - pts[0].x, dz = pts[2].z - pts[0].z, side = s.angle % 2 ? 0.42 : -0.42;
      if (dx * dx + dz * dz > 0.04) yaws.push(Math.atan2(dx, dz) + side, Math.atan2(dx, dz) - side);
    }
    for (let i = 0; i < 3; i++) yaws.push(ANGLES[(s.angle + i) % 3][0]);
    yaws.push(Math.PI / 2, -Math.PI / 2, Math.PI);
    // at eye level inside the room when it fits (the cutaway is on there)
    if (pts.length <= 4 && room) {
      for (const yaw of yaws) {
        const dir = dirOf(yaw, 14), d = Math.max(2.8, fit(pts, tgt, dir, 0.7)) * (aspect() < 1 ? 1.15 : 1);
        const cam = tgt.clone().addScaledVector(dir, d);
        cam.y = U.clamp(cam.y, 1.5, 2.6);
        if (inRoom(room, cam.x, cam.z, 0.45)) return { kind: "medium", P: cam, T: tgt, room, track: true, keys, low: true };
      }
    }
    // else above the walls: inside the room, or south of it (the dollhouse side), or the first angle
    let best = null;
    for (const yaw of yaws) {
      const cam = place(tgt, yaw, 30, pts, 0.7, 3.2, 3.6), r = roomOf(room);
      const score = inRoom(room, cam.x, cam.z, 0.3) ? 2 : r && cam.z > Math.max(...r.rects.map((q) => q[3])) ? 1 : 0;
      if (!best || score > best.score) best = { cam, score };
      if (score === 2) break;
    }
    return { kind: "medium", P: best.cam, T: tgt, room, track: true, keys };
  }
  function closeShot(s) {
    const p = P(), keys = s.keys || [], k = keys.find((x) => x !== "motore" && validKey(x));
    if (!k) return null;
    const f = p.positionOf(k), h = safe(() => p.headOf(k), null) || { x: f.x, y: f.y + 1.7, z: f.z };
    const room = roomAt(f.x, f.z);
    if (!room) return null;
    const post = safe(() => p.postureOf(k), "stand"), state = safe(() => p.stateOf(k), "idle"), face = safe(() => p.yawOf(k), 0) || 0;
    const portrait = aspect() < 1, d = (0.9 / (0.55 * 2 * TAN)) * (portrait ? 1.35 : 1);
    if (post === "lie") {
      const tgt = V().set(f.x + Math.sin(face) * 0.35, 0.65, f.z + Math.cos(face) * 0.35);
      for (const o of [1.9, -1.9, 2.4, -2.4, 1.2, -1.2]) {
        const cam = V().set(tgt.x + Math.sin(face + o) * 1.7, 2.35, tgt.z + Math.cos(face + o) * 1.7);
        if (inRoom(room, cam.x, cam.z, 0.4)) return { kind: "close", P: cam, T: tgt, room, track: true, keys: [k] };
      }
      return null;
    }
    const other = keys.find((x) => x !== k && x !== "motore" && validKey(x));
    if (other && post !== "lie") {
      const L = p.positionOf(other), lh = safe(() => p.headOf(other), null) || { x: L.x, y: 1.7, z: L.z };
      const dx = L.x - f.x, dz = L.z - f.z, dd = Math.hypot(dx, dz);
      if (dd > 0.4 && dd < 4.5 && roomAt(L.x, L.z) === room) {
        const ux = dx / dd, uz = dz / dd;
        for (const side of s.angle % 2 ? [1, -1] : [-1, 1]) {
          // over the listener's shoulder: behind and beside them, a little above their head
          const cam = V().set(lh.x + ux * 1.3 - uz * 0.72 * side, U.clamp(lh.y + 0.22, 1.4, 2.4), lh.z + uz * 1.3 + ux * 0.72 * side);
          if (inRoom(room, cam.x, cam.z, 0.4)) return { kind: "close", P: cam, T: V().set(h.x - uz * 0.18 * side, h.y - 0.32, h.z + ux * 0.18 * side), room, track: true, keys: [k, other] };
        }
      }
    }
    const tgt = V().set(h.x, h.y - 0.37, h.z);
    // at a keyboard: over the shoulder, towards the screens; otherwise a 3/4 view of the face
    const O = state === "type" ? [2.55, -2.55, 2.1, -2.1, 1.5, -1.5] : [0.5, -0.5, 0.85, -0.85, 0, 1.3, -1.3];
    const flip = s.angle % 2 ? -1 : 1;
    for (const o of O) {
      const y = face + o * flip, cam = V().set(tgt.x + Math.sin(y) * d, U.clamp(h.y - 0.02, 1.4, 2.4), tgt.z + Math.cos(y) * d);
      if (inRoom(room, cam.x, cam.z, 0.4)) return { kind: "close", P: cam, T: tgt, room, track: true, keys: [k] };
    }
    return null;
  }
  function build(spec) {
    if (spec.kind === "campus") return campusShot(spec);
    if (spec.kind === "wide") return roomShot(spec);
    if (spec.kind === "close") return closeShot(spec) || groupShot(spec);
    return groupShot(spec);
  }
  function specOf(req) {
    const keys = U.arr(req.keys).filter((k) => k === "motore" || validKey(k));
    let kind = ["campus", "wide", "medium", "close"].includes(req.shot) ? req.shot : null;
    if (!kind) {
      const pr = U.isNum(req.priority) ? req.priority : 1;
      if (!keys.length) kind = req.room ? "wide" : req.point ? "medium" : "campus";
      else if (pr >= 3) kind = ["close", "medium", "close", "wide"][p3n++ % 4];
      else if (pr === 2) kind = "medium";
      else if (pr === 1) kind = /pens|thought|riflett/i.test(String(req.reason || "")) ? "close" : "medium";
      else kind = "wide";
    }
    let room = typeof req.room === "string" ? req.room : null;
    if (!room && keys.length) { const pt = subjectPts(keys)[0]; room = pt ? roomAt(pt.x, pt.z) : null; }
    if (!room && req.point) room = roomAt(req.point.x, req.point.z);
    if (kind === "wide" && !room) kind = "campus";
    return { kind, keys, room, point: U.obj(req.point), angle: angleN++ };
  }
  // the speaker comes first: the same pair with the other one speaking is a new subject (the reverse shot)
  const subjOf = (spec) => (spec.kind === "campus" ? "campus" : (spec.room || "") + "|" + spec.keys.join(","));

  function setFocusRoom(room) {
    if (room === R.focusRoom) return;
    R.focusRoom = room || null;
    if (W() && W().setCutawayFocus) safe(() => W().setCutawayFocus(R.focusRoom));
  }
  function snap() { rig.P.copy(rig.gP); rig.T.copy(rig.gT); rig.vP.set(0, 0, 0); rig.vT.set(0, 0, 0); lastCut = clockT; }
  function take(req, opts) {
    const o = opts || {}, spec = specOf(req), sh = build(spec);
    if (!sh) return false;
    const subj = subjOf(spec);
    Object.assign(sh, {
      spec, subj, start: clockT, priority: U.isNum(req.priority) ? req.priority : 1, manual: !!req.manual, idle: !!req.idle,
      hold: U.clamp(Math.max(minHold(), U.isNum(req.holdS) ? req.holdS : 0), minHold(), 30), reason: req.reason || "",
      off: sh.P.clone().sub(sh.T), seed: Math.random() * 6.28,
    });
    if (sh.track) { const c = trackRef(sh); sh.tOff = c ? sh.T.clone().sub(c) : null; }
    if (!shot || subj !== shot.subj) lastVary = clockT;
    const inside = (p) => p.y < 3.3;
    const cut = o.instant || reduce || !shot || rig.T.distanceTo(sh.T) > 12 || (sh.room && R.focusRoom && sh.room !== R.focusRoom) || inside(sh.P) !== inside(rig.P);
    const sameRoom = shot && sh.room && sh.room === shot.room;
    rig.hlP = rig.hlT = sameRoom ? 0.45 : 0.9;
    shot = sh;
    setFocusRoom(sh.room);
    rig.gP.copy(sh.P); rig.gT.copy(sh.T);
    if (cut) snap();
    return true;
  }
  // the point a tracking shot follows: the mean of the subjects' feet
  function trackRef(sh) {
    const p = P(); if (!p || !sh.keys || !sh.keys.length) return null;
    let n = 0; const c = _b.set(0, 0, 0);
    for (const k of sh.keys) { const f = k !== "motore" && safe(() => p.positionOf(k), null); if (f) { c.x += f.x; c.y += f.y || 0; c.z += f.z; n++; } }
    return n ? c.multiplyScalar(1 / n) : null;
  }
  function busiestRoom() {
    const p = P(); if (!p) return null;
    const n = {};
    for (const k of C.KEYS) {
      const f = safe(() => p.positionOf(k), null);
      if (!f || safe(() => p.stateOf(k), "") === "sleep") continue;
      const r = roomAt(f.x, f.z); if (r) n[r] = (n[r] || 0) + 1;
    }
    let best = null; for (const r in n) if (!best || n[r] > n[best]) best = r;
    return best;
  }
  function agentsIn(room) {
    const p = P(); if (!p || !room) return [];
    return C.KEYS.filter((k) => { const f = safe(() => p.positionOf(k), null); return f && roomAt(f.x, f.z) === room; });
  }
  function vary() {
    lastVary = clockT;
    const s = shot, next = CYCLE[(CYCLE.indexOf(s.kind) + 1) % 3];
    let keys = s.spec.keys.filter((k) => k !== "motore");
    if (!keys.length && s.room) keys = agentsIn(s.room);
    if (next !== "wide" && !keys.length) { take({ room: s.room, shot: "wide", priority: s.priority, holdS: s.hold, manual: s.manual }); shot.subj = s.subj; return; }
    if (next === "close" && keys.length > 2) keys = [keys[Math.floor(clockT) % keys.length]];
    take({ keys, room: s.room, shot: next, priority: s.priority, holdS: s.hold, reason: s.reason, manual: s.manual });
    shot.subj = s.subj;
  }
  function idleStep() {
    const room = busiestRoom();
    if (room) take({ room, shot: "wide", priority: 0, idle: true });
    else { const k = C.KEYS[nightDorm++ % C.KEYS.length]; take({ room: "dorm_" + k, keys: [k], shot: nightDorm % 2 ? "wide" : "close", priority: 0, idle: true }); }
  }
  // the same subject again keeps its framing and renews the hold; anything else is a new shot
  function takePending() {
    const req = pending; pending = null;
    const keys = U.arr(req.keys).filter((k) => k === "motore" || validKey(k));
    let room = typeof req.room === "string" ? req.room : null;
    if (!room && keys.length) { const pt = subjectPts(keys)[0]; room = pt ? roomAt(pt.x, pt.z) : null; }
    if (!req.shot && keys.length && (room || "") + "|" + keys.join(",") === shot.subj) {
      shot.priority = U.isNum(req.priority) ? req.priority : 1; shot.start = clockT; shot.reason = req.reason || shot.reason;
      shot.hold = U.clamp(Math.max(minHold(), U.isNum(req.holdS) ? req.holdS : 0), minHold(), 30);
      return;
    }
    take(req);
  }
  // a request takes the camera when it outranks the shot or the hold is over; a new speaker of a
  // live, replayed or Claude dialog (priority 3) takes over from the previous one after the minimum hold
  const preempts = (r, age) => r.priority > eff(shot) || age >= shot.hold || (r.priority >= 3 && r.priority >= eff(shot) && age >= minHold());
  function regia(dt) {
    if (!shot && !take({ shot: "campus", priority: 0, idle: true }, { instant: true })) return;
    if (pending && clockT - pending.t > 12) pending = null;
    const age = clockT - shot.start;
    if (pending && preempts(pending, age) && clockT - lastCut >= (pending.priority >= 3 ? 0.8 : 1.5)) takePending();
    else if (shot.idle && shot.kind === "campus" && age >= 6 && clockT - lastReq >= 6) idleStep();
    else if (clockT - lastReq >= 60 && clockT - idleAt >= 60 && !shot.manual) { idleAt = clockT; take({ shot: "campus", priority: 0, idle: true, holdS: 6 }); }
    else if (age >= Math.max(shot.hold, 14) && clockT - lastVary >= 14 && !shot.manual && shot.kind !== "campus") vary();
    const s = shot;
    if (reduce) {
      // no tracking and no drift: re-cut only when the subject has left the frame for a while
      if (s.track && clockT - lastCut > 4 && offFrame(s)) take({ keys: s.spec.keys, room: s.spec.room, shot: s.kind, priority: s.priority, holdS: s.hold });
      rig.gP.copy(rig.P); rig.gT.copy(rig.T);
      return;
    }
    if (s.track && s.tOff) {
      const c = trackRef(s);
      if (c) { rig.gT.copy(c).add(s.tOff); rig.gP.copy(rig.gT).add(s.off); }
      if (s.kind === "close") {
        rig.gP.y = U.clamp(rig.gP.y, 1.4, 2.4);
        if (!inRoom(s.room, rig.gP.x, rig.gP.z, 0.3) && clockT - lastCut > 1) take({ keys: s.spec.keys, shot: "medium", priority: s.priority, holdS: s.hold });
      } else if (s.low && !inRoom(s.room, rig.gP.x, rig.gP.z, 0.3) && clockT - lastCut > 1) take({ keys: s.spec.keys, shot: "medium", priority: s.priority, holdS: s.hold, room: s.room });
    } else { rig.gP.copy(s.P); rig.gT.copy(s.T); }
    // a slow cinematic drift: a lateral arc and a gentle push-in; a faint breath on close-ups
    const a = clockT - s.start, dist = s.off.length(), f = _c.copy(s.off).normalize(), r = _d.crossVectors(f, UP).normalize();
    const lat = (s.kind === "close" ? 0.02 : 0.04) * dist * Math.sin((2 * Math.PI * a) / 34);
    rig.gP.addScaledVector(r, lat).addScaledVector(f, -0.05 * dist * (1 - Math.exp(-a / 9)));
    if (s.kind === "close" || s.low) rig.gP.y += 0.012 * Math.sin(clockT * 1.3 + s.seed) + 0.006 * Math.sin(clockT * 2.1);
    if (s.kind !== "close" && !s.low && rig.gP.y < 3.6) rig.gP.y = 3.6;
    spring(rig.P, rig.vP, rig.gP, rig.hlP, dt);
    spring(rig.T, rig.vT, rig.gT, rig.hlT, dt);
  }
  function offFrame(s) {
    const c = trackRef(s); if (!c) return false;
    _a.set(c.x, c.y + 1, c.z).project(camera);
    return Math.abs(_a.x) > 0.9 || Math.abs(_a.y) > 0.9 || _a.z > 1;
  }

  // segui: behind and above the agent, a spring of 0.35 s; the look-at stays on the head
  let fYaw = null, fCut = false;
  function follow(dt) {
    const k = R.followKey, p = P();
    const f = validKey(k) ? safe(() => p.positionOf(k), null) : null;
    if (!f) { setMode("regia", null); return; }
    const h = safe(() => p.headOf(k), null) || { x: f.x, y: f.y + 1.7, z: f.z };
    const yaw = safe(() => p.yawOf(k), 0) || 0, post = safe(() => p.postureOf(k), "stand");
    if (fYaw === null || reduce) fYaw = yaw; else fYaw += U.wrapAngle(yaw - fYaw) * (1 - Math.exp(-dt * 2.2));
    const room = roomAt(f.x, f.z);
    setFocusRoom(room);
    if (post === "lie") {
      rig.gT.set(f.x + Math.sin(fYaw) * 0.3, 0.6, f.z + Math.cos(fYaw) * 0.3);
      rig.gP.set(rig.gT.x + Math.sin(fYaw + 2.3) * 2.6, 3.0, rig.gT.z + Math.cos(fYaw + 2.3) * 2.6);
    } else {
      const back = aspect() < 1 ? 6.5 : 5.5;
      rig.gT.set(h.x, h.y - 0.15, h.z);
      rig.gP.set(f.x - Math.sin(fYaw) * back, (f.y || 0) + (post === "sit" ? 2.0 : 2.6), f.z - Math.cos(fYaw) * back);
    }
    // outside the agent's room, or on its walls: rise above the walls
    if (room && !inRoom(room, rig.gP.x, rig.gP.z, 0.35)) rig.gP.y = Math.max(rig.gP.y, 3.6);
    rig.gP.x = U.clamp(rig.gP.x, -40, 40); rig.gP.z = U.clamp(rig.gP.z, -34, 34);
    if (fCut) { fCut = false; snap(); return; }
    if (reduce) {
      // reduced motion: a still camera that re-cuts when the agent drifts away from the centre
      _a.set(h.x, h.y, h.z).project(camera);
      if ((Math.abs(_a.x) > 0.55 || Math.abs(_a.y) > 0.6 || _a.z > 1 || rig.P.distanceTo(rig.gP) > 4) && clockT - lastCut > 1) snap();
      return;
    }
    spring(rig.P, rig.vP, rig.gP, 0.35, dt);
    spring(rig.T, rig.vT, rig.gT, 0.15, dt);
  }

  // libera: OrbitControls from jsdelivr, or a small built-in orbit
  let orbit = null, orbitTry = null, mini = null;
  function freeStart() {
    if (orbit) { orbit.target.copy(rig.T); orbit.enabled = true; orbit.enableDamping = !reduce; orbit.update(); return; }
    if (mini) { miniFrom(); return; }
    if (orbitTry) return;
    orbitTry = loadAll(FILES.orbit).then(() => {
      if (disposed) return;
      orbit = new T.OrbitControls(camera, canvas);
      Object.assign(orbit, { minDistance: 2.5, maxDistance: 90, maxPolarAngle: 1.45, enableDamping: !reduce, dampingFactor: 0.09, screenSpacePanning: false, rotateSpeed: 0.8, zoomSpeed: 0.9 });
      orbit.target.copy(rig.T);
      orbit.enabled = R.cameraMode === "libera";
      canvas.style.touchAction = R.cameraMode === "libera" ? "none" : "pan-y";
      if (orbit.enabled) orbit.update();
    }).catch(() => { mini = { yaw: 0, el: 0.6, dist: 30, ptr: new Map(), pinch: 0 }; miniFrom(); });
  }
  function miniFrom() {
    const o = _a.copy(rig.P).sub(rig.T);
    mini.dist = U.clamp(o.length(), 2.5, 90); mini.el = U.clamp(Math.asin(o.y / Math.max(1e-3, o.length())), 0.12, 1.5); mini.yaw = Math.atan2(o.x, o.z);
  }
  function miniEvents() {
    const on = (type, fn, opt) => { canvas.addEventListener(type, fn, opt); domOffs.push(() => canvas.removeEventListener(type, fn, opt)); };
    on("pointerdown", (e) => { if (!mini || R.cameraMode !== "libera") return; if (e.isPrimary) mini.ptr.clear(); mini.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); mini.pinch = 0; });
    on("pointermove", (e) => {
      if (!mini || R.cameraMode !== "libera" || !mini.ptr.has(e.pointerId)) return;
      const q = mini.ptr.get(e.pointerId), dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (mini.ptr.size === 1) { mini.yaw -= dx * 0.006; mini.el = U.clamp(mini.el + dy * 0.005, 0.12, 1.5); }
      else if (mini.ptr.size === 2) {
        const [a, b] = [...mini.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (mini.pinch) mini.dist = U.clamp(mini.dist * (mini.pinch / Math.max(1, d)), 2.5, 90);
        mini.pinch = d;
      }
    });
    const up = (e) => { if (mini) { mini.ptr.delete(e.pointerId); mini.pinch = 0; } };
    on("pointerup", up); on("pointercancel", up);
    on("wheel", (e) => { if (!mini || R.cameraMode !== "libera") return; e.preventDefault(); mini.dist = U.clamp(mini.dist * Math.exp(e.deltaY * 0.0012), 2.5, 90); }, { passive: false });
  }
  function free(dt) {
    if (orbit) {
      orbit.update();
      const t = orbit.target;
      t.x = U.clamp(t.x, BOUNDS[0], BOUNDS[2]); t.z = U.clamp(t.z, BOUNDS[1], BOUNDS[3]); t.y = U.clamp(t.y, 0, 8);
      if (camera.position.y < 0.3) camera.position.y = 0.3;
      rig.P.copy(camera.position); rig.T.copy(t);
    } else if (mini) {
      dirOf(mini.yaw, mini.el / DEG, _a);
      rig.gP.copy(rig.T).addScaledVector(_a, mini.dist);
      if (reduce) rig.P.copy(rig.gP); else spring(rig.P, rig.vP, rig.gP, 0.12, dt);
    }
    if (orbit) { rig.vP.set(0, 0, 0); rig.vT.set(0, 0, 0); }
    setFocusRoom(roomAt(rig.T.x, rig.T.z));
  }

  function setMode(mode, key) {
    const prev = R.cameraMode, prevKey = R.followKey;
    R.cameraMode = mode; R.followKey = mode === "segui" ? key : null;
    if (prev === "libera" && mode !== "libera" && orbit) orbit.enabled = false;
    if (canvas) canvas.style.touchAction = mode === "libera" ? "none" : "pan-y";
    if (mode === "libera") freeStart();
    if (mode === "segui") { fYaw = null; fCut = reduce || prev === "segui" && key !== prevKey || rig.T.distanceTo(_a.copy(P().positionOf(key))) > 12; }
    if (mode === "regia" && prev !== "regia" && inited) {
      const req = pending && clockT - pending.t < 12 ? pending : prev === "segui" && prevKey ? { keys: [prevKey], priority: 1, holdS: 6 } : { shot: "campus", priority: 0, idle: true };
      pending = null; take(req);
    }
    bus.emit("render:camera-mode", { mode, key: mode === "segui" ? key : null });
  }

  // ---- picking -----------------------------------------------------------------------------------------------------
  let ray = null, down = null, lastPick = null;
  function pickAt(cx, cy) {
    const none = { key: null, room: null, point: null };
    if (!inited || disposed || !camera) return none;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return none;
    ray.setFromCamera({ x: ((cx - rect.left) / rect.width) * 2 - 1, y: -((cy - rect.top) / rect.height) * 2 + 1 }, camera);
    const ppl = safe(() => (C.people && C.people.pickables ? C.people.pickables() : []), []);
    const hp = ppl.length ? ray.intersectObjects(ppl, true)[0] : null;
    if (hp) {
      let o = hp.object; while (o && !(o.userData && o.userData.agentKey)) o = o.parent;
      if (o) return { key: o.userData.agentKey, room: roomAt(hp.point.x, hp.point.z), point: { x: hp.point.x, y: hp.point.y, z: hp.point.z } };
    }
    const fl = safe(() => (W() && W().pickables ? W().pickables() : []), []);
    const hw = fl.length ? ray.intersectObjects(fl, true)[0] : null;
    if (!hw) return none;
    let o = hw.object; while (o && !(o.userData && o.userData.room)) o = o.parent;
    return { key: null, room: o ? o.userData.room : roomAt(hw.point.x, hw.point.z), point: { x: hw.point.x, y: hw.point.y, z: hw.point.z } };
  }
  function pickEvents() {
    const on = (type, fn) => { canvas.addEventListener(type, fn); domOffs.push(() => canvas.removeEventListener(type, fn)); };
    const active = new Set();
    on("pointerdown", (e) => {
      if (e.isPrimary) active.clear();
      active.add(e.pointerId);
      down = active.size > 1 || (e.pointerType === "mouse" && e.button !== 0) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), far: false };
    });
    on("pointermove", (e) => { if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 6) down.far = true; });
    const end = (e) => {
      active.delete(e.pointerId);
      const d = down; down = null;
      if (e.type !== "pointerup" || !d || d.id !== e.pointerId || d.far || performance.now() - d.t > 400 || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 6) return;
      const res = pickAt(e.clientX, e.clientY), t = performance.now();
      bus.emit("render:pick", res);
      if (res.key && lastPick && lastPick.key === res.key && t - lastPick.t < 450) { lastPick = null; R.setCameraMode("segui", { key: res.key }); }
      else lastPick = { key: res.key, t };
    };
    on("pointerup", end); on("pointercancel", end);
  }

  // ---- the frame -------------------------------------------------------------------------------------------------------
  let shadowHalf = 0;
  function applyCamera() {
    camera.position.copy(rig.P);
    camera.lookAt(rig.T);
    camera.updateMatrixWorld();
    env.position.copy(camera.position); env.updateMatrixWorld();
    const dist = rig.P.distanceTo(rig.T);
    // the sun's shadow box follows the focus, re-centred in 2 m steps; its size steps with the shot
    const want = dist > 38 ? 26 : dist > 22 ? 20 : dist > 11 ? 15 : 11;
    if (want !== shadowHalf && (Math.abs(want - shadowHalf) > 4 || !shadowHalf)) {
      shadowHalf = want;
      Object.assign(sun.shadow.camera, { left: -want, right: want, top: want, bottom: -want, near: 4, far: 150 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    const fx = Math.round(rig.T.x / 2) * 2, fz = Math.round(rig.T.z / 2) * 2, l = tmp.ldir;
    sun.position.set(fx + l.x * 60, l.y * 60, fz + l.z * 60);
    sun.target.position.set(fx, 0, fz); sun.target.updateMatrixWorld();
    moon.target.position.set(fx, 0, fz); moon.position.set(fx - 42, 37, fz + 21); moon.target.updateMatrixWorld();
    scene.fog.near = Math.max(70, dist * 0.9); scene.fog.far = scene.fog.near + 120;
  }
  function postParams() {
    if (!R.postActive || !bloomPass) return;
    const n = R.sky.night;
    // by day only the brightest highlights glow; at night the lamps, windows and screens do
    bloomPass.strength = U.lerp(0.16, 0.52, n); bloomPass.threshold = U.lerp(0.93, 0.74, n); bloomPass.radius = 0.4;
    finishPass.uniforms.uWarm.value = 1 - n * 0.5;
    // exposure compensation while SSAO is on: it darkens the crevices, not the whole frame
    finishPass.uniforms.uGain.value = ssaoPass && ssaoPass.enabled ? 1.045 : 1;
  }

  // ---- the public API ------------------------------------------------------------------------------------------------
  R.init = (c) => {
    if (inited) return;
    ctx = c; T = c.THREE || window.THREE; canvas = c.canvas;
    if (!T || !canvas) throw new Error("render: THREE or the canvas is missing");
    reduce = !!c.reduceMotion; coarse = mq("(pointer: coarse)"); fine = mq("(pointer: fine)");
    const sw = (window.screen && Math.min(screen.width, screen.height)) || 1000;
    const q0 = coarse || sw < 600 ? "low" : "medium";
    renderer = new T.WebGLRenderer({ canvas, antialias: q0 !== "low", alpha: false, powerPreference: "high-performance" });
    Object.assign(renderer, { outputEncoding: T.sRGBEncoding, toneMapping: T.ACESFilmicToneMapping, physicallyCorrectLights: false });
    renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.enabled = q0 !== "low";
    renderer.info.autoReset = false;
    UP = V().set(0, 1, 0); [_a, _b, _c, _d, _e] = [V(), V(), V(), V(), V()];
    Object.assign(rig, { P: V().set(30, 40, 50), T: V(), vP: V(), vT: V(), gP: V().set(30, 40, 50), gT: V() });
    tmp.hor = new T.Color(); tmp.hill = new T.Color(); tmp.c = new T.Color(); tmp.ldir = V().set(0, 1, 0);
    const HEX = { dayZ: 0x5d9bd5, dayH: 0xdbe8f3, goldZ: 0x5779b0, goldH: 0xf2a65a, band: 0xe48aa0, nightZ: 0x060a18, nightH: 0x1a2440,
      glowD: 0xfff3d6, glowG: 0xff9a4a, cloudD: 0xf3f6fa, cloudG: 0xf2b08a, cloudN: 0x262f4c, hillD: 0x80938a, hillG: 0x8d6f6c, hillN: 0x0b1122,
      hemiD: 0xdfeaf5, hemiG: 0xf1d9bf, hemiN: 0x3a4878, grD: 0x5e5240, grN: 0x1f1c26, sunD: 0xfff1dc, sunL: 0xffb36b };
    for (const k in HEX) PAL[k] = new T.Color(HEX[k]);
    scene = new T.Scene();
    scene.fog = new T.Fog(0xdbe8f3, 70, 190);
    camera = new T.PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
    hemi = new T.HemisphereLight(0xffffff, 0xffffff, 0.85);
    sun = new T.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    sun.shadow.mapSize.set(1024, 1024);
    moon = new T.DirectionalLight(U.col(0x9fb4ff), 0);
    scene.add(hemi, sun, sun.target, moon, moon.target);
    buildEnv();
    ray = new T.Raycaster();
    Object.assign(R, { scene, camera, renderer, quality: q0, lightBudget: LIGHTS[q0] });
    Object.assign(c, { renderer, scene, camera });
    inited = true;
    applyQuality(q0, null);
    updateSky(0);
    R.resize(c.size.w, c.size.h);
    canvas.style.touchAction = "pan-y";
    // the stage veil: a soft fade-in at boot, and a calm cover while the GPU context is lost
    if (!document.getElementById("cp-style-render")) {
      const st = document.createElement("style"); st.id = "cp-style-render";
      st.textContent = ".cp-r-veil{position:absolute;inset:0;z-index:0;pointer-events:none;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;background:#0d1317;color:rgba(236,240,241,.78);font:500 .92rem/1.4 var(--font-read,serif);opacity:1;transition:opacity .9s ease}.cp-r-veil.cp-r-off{opacity:0}@media (prefers-reduced-motion: reduce){.cp-r-veil{transition:none}}";
      document.head.appendChild(st);
    }
    if (c.stage) { veil = document.createElement("div"); veil.className = "cp-r-veil"; veil.setAttribute("aria-hidden", "true"); canvas.after(veil); }
    const lostFn = (e) => { e.preventDefault(); if (lost) return; lost = true; if (veil) { veil.textContent = "La grafica 3D è in pausa: la riprendo appena possibile."; veil.classList.remove("cp-r-off"); } bus.emit("campus:degraded", { module: "render", reason: "context-lost" }); };
    const backFn = () => { lost = false; resetMeasure(2); if (veil) { veil.textContent = ""; veil.classList.add("cp-r-off"); } bus.emit("render:restored", {}); };
    canvas.addEventListener("webglcontextlost", lostFn, false); canvas.addEventListener("webglcontextrestored", backFn, false);
    domOffs.push(() => canvas.removeEventListener("webglcontextlost", lostFn, false), () => canvas.removeEventListener("webglcontextrestored", backFn, false));
    pickEvents(); miniEvents();
    offs.push(bus.on("campus:resize", ({ w, h }) => R.resize(w, h)));
    offs.push(bus.on("life:focus", (f) => R.focus(f)));
    offs.push(bus.on("campus:visibility", (v) => { if (v && v.visible) resetMeasure(1); }));
    take({ shot: "campus", priority: 0, idle: true }, { instant: true });
    applyCamera();
    bus.emit("render:quality", { level: q0, reason: "start", fps: 0 });
  };

  R.update = (dt) => {
    if (!inited || disposed) return;
    dt = U.isNum(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
    // the director's holds run on the wall clock, even when slow frames cap dt
    const w = performance.now() / 1000;
    const gap = wallAt ? w - wallAt : 0, wdt = wallAt ? U.clamp(gap, dt, 1) : dt;
    clockT += wdt; wallAt = w; lastDt = dt || lastDt;
    // the fps is measured on the wall clock: the kernel caps dt at 0.1 s, which would hide frames
    // slower than 10 fps; a gap over 1.5 s is a resume after a hidden stage, not a slow frame
    // (not while the GPU context is lost: nothing is drawn, so the fps would read too high)
    if (dt > 0 && gap <= 1.5 && !lost) adapt(Math.max(dt, wdt));
    // the camera springs also run on the wall clock (up to 0.25 s a frame), so a slow device still
    // reaches the shot in the same time instead of crawling at the kernel's capped dt
    const cdt = Math.min(wdt, 0.25);
    updateSky(dt, cdt);
    if (R.cameraMode === "segui") follow(cdt);
    if (R.cameraMode === "libera") free(cdt);
    else if (R.cameraMode === "regia") regia(cdt);
    applyCamera();
    postParams();
    checkSsao(dt);
  };

  R.draw = () => {
    if (!inited || disposed || lost) return;
    renderer.info.reset();
    if (R.postActive && composer) composer.render(lastDt);
    else renderer.render(scene, camera);
    if (!drawn) { drawn = true; if (veil) requestAnimationFrame(() => veil && veil.classList.add("cp-r-off")); }
  };

  R.resize = (w, h) => {
    if (!inited || disposed || !w || !h) return;
    const before = camera.aspect;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    starMat.uniforms.uPR.value = renderer.getPixelRatio();
    sizeComposer();
    // a new aspect needs a new framing
    if (shot && R.cameraMode === "regia" && Math.abs(before - camera.aspect) > 0.12 * before) {
      const s = shot; take({ keys: s.spec.keys, room: s.spec.room, point: s.spec.point, shot: s.kind, priority: s.priority, holdS: s.hold, manual: s.manual, idle: s.idle }, { instant: true });
    }
  };

  R.dispose = () => {
    if (disposed) return;
    disposed = true;
    offs.splice(0).forEach((f) => safe(f));
    domOffs.splice(0).forEach((f) => safe(f));
    if (orbit) safe(() => orbit.dispose());
    if (veil) { veil.remove(); veil = null; }
    if (!inited) { if (renderer) safe(() => renderer.dispose()); return; }
    safe(() => {
      if (composer) { [composer.renderTarget1, composer.renderTarget2].forEach((t) => t.dispose()); [bloomPass, ssaoPass].forEach((p) => p && p.dispose && p.dispose()); }
      if (sun && sun.shadow && sun.shadow.map) sun.shadow.map.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
      });
    });
    safe(() => renderer.dispose());
    R.postActive = false;
  };

  R.setQuality = (mode) => {
    if (!["auto", "low", "medium", "high"].includes(mode)) return;
    R.qualityMode = mode;
    if (!inited || disposed) { if (mode !== "auto") R.quality = mode; return; }
    if (mode === "auto") { resetMeasure(3); bus.emit("render:quality", { level: R.quality, reason: "user", fps: R.fps }); return; }
    applyQuality(mode, "user");
  };

  R.setCameraMode = (mode, opts) => {
    if (!["regia", "libera", "segui"].includes(mode)) return;
    let key = (opts && opts.key) || (mode === "segui" ? R.followKey : null);
    if (mode === "segui" && !(inited && !disposed && C.ctx && C.ctx.has3d !== false && validKey(key))) { mode = "regia"; key = null; }
    if (!inited || disposed) { R.cameraMode = mode; R.followKey = key; bus.emit("render:camera-mode", { mode, key }); return; }
    setMode(mode, key);
  };

  R.focus = (req) => {
    if (!U.obj(req)) return;
    lastReq = clockT;
    const r = Object.assign({}, req, { t: clockT, priority: U.isNum(req.priority) ? req.priority : 1 });
    if (!inited || disposed || R.cameraMode !== "regia" || !shot) { pending = r; return; }
    const age = clockT - shot.start;
    if (preempts(r, age) && (clockT - lastCut >= 0.8 || r.priority > shot.priority)) { pending = r; takePending(); return; }
    if (!pending || r.priority >= pending.priority) pending = r;
  };

  R.shot = (name, opts) => {
    if (!inited || disposed || typeof name !== "string") return;
    const o = opts || {};
    const req = name === "campus" ? { shot: "campus" } : name.startsWith("room:") ? { room: name.slice(5), shot: "wide" } : name.startsWith("agent:") ? { keys: [name.slice(6)], shot: "close" } : null;
    if (!req) return;
    Object.assign(req, { priority: 4, holdS: 20, manual: true, reason: "shot" });
    if (R.cameraMode === "segui") setMode("regia", null);
    if (R.cameraMode === "libera") {
      const sh = build(specOf(req)); if (!sh) return;
      setFocusRoom(sh.room);
      rig.P.copy(sh.P); rig.T.copy(sh.T); rig.gP.copy(sh.P);
      if (orbit) { camera.position.copy(sh.P); orbit.target.copy(sh.T); orbit.update(); } else if (mini) miniFrom();
      applyCamera();
      return;
    }
    pending = null;
    take(req, { instant: !!o.instant });
    if (o.instant) applyCamera();
  };

  R.pick = (cx, cy) => { const res = pickAt(cx, cy); bus.emit("render:pick", res); return res; };

  // test hook: feed fake frame times to the adaptive logic (it starts from a fresh 2 s window)
  R._simulateFps = (fps, seconds) => {
    if (!inited || disposed || !(fps > 0) || !(seconds > 0)) return;
    resetMeasure(0);
    const dt = 1 / fps, n = Math.round(fps * seconds);
    for (let i = 0; i < n; i++) adapt(dt);
  };
  // test hook: put the camera at p looking at t (in libera it also moves the orbit's target)
  R._look = (p, t) => {
    if (!inited || disposed) return;
    rig.gP.set(p.x, p.y, p.z); rig.gT.set(t.x, t.y, t.z); snap();
    if (orbit) { camera.position.copy(rig.P); orbit.target.copy(rig.T); orbit.update(); } else if (mini) miniFrom();
    applyCamera();
  };
  // test hook: post on or off at high quality, and SSAO on or off, without changing anything else
  R._setPost = (on, ssao) => {
    if (on === false) { setPost(false); return; }
    setPost(true);
    if (ssaoPass && ssao !== undefined) { ssaoPass.enabled = !!ssao && R.postActive; renderPass.enabled = !ssaoPass.enabled; fxaaPass.enabled = ssaoPass.enabled || !msaa; }
  };
  // test hook: the rig and the director, read-only copies
  R._state = () => ({
    mode: R.cameraMode, target: rig.T && { x: rig.T.x, y: rig.T.y, z: rig.T.z }, position: rig.P && { x: rig.P.x, y: rig.P.y, z: rig.P.z },
    shot: shot && { kind: shot.kind, room: shot.room, keys: shot.spec.keys, priority: shot.priority, hold: shot.hold, age: clockT - shot.start },
    pending: pending && { priority: pending.priority, room: pending.room || null }, post: { active: R.postActive, ssao: !!(ssaoPass && ssaoPass.enabled), msaa }, lost, prDropped,
  });

  C.render = R;
})();
