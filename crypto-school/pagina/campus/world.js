/* Scuola Cripto · campus/world.js · Campus.world (contract v1.0, §5.2).
   The campus as a cutaway dollhouse: the static layout (rooms, doors, anchors, the waypoint
   graph and A*, occupancy, the minimap data) works at load time without THREE; build() adds
   the building, the furniture, the eight dormitories, the garden, the grounds, the lamps
   with their light pool and the canvas surfaces fed by Campus.data. Every number drawn on a
   surface comes from Campus.data through Campus.derive and Campus.util. */
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.world) return;
  const U = C.util, bus = C.bus, D = C.derive;
  const KEYS = C.KEYS, TR = C.TRADERS, PI = Math.PI, HP = PI / 2;
  const sin = Math.sin, cos = Math.cos, hyp = Math.hypot, min = Math.min, max = Math.max, abs = Math.abs;
  const WALL_H = 3.2, LOW_H = 0.9, INF = 0.3;
  const frz = (o) => Object.freeze(o);
  const mixHex = (a, b, k) => { let o = 0; for (const s of [16, 8, 0]) { const x = (a >> s) & 255, y = (b >> s) & 255; o |= Math.round(x + (y - x) * k) << s; } return o; };

  // ---- 1. rooms and doors (§3.2)
  const ART = { il: "del", la: "della", lo: "dello" };
  const DORMX = (i) => -24 + 6 * i;
  const rooms = [
    ["presidenza", "Presidenza", "interno", [[-24, -20, -14, -10]]],
    ["riunione", "Sala riunioni", "interno", [[-14, -20, 0, -10]]],
    ["trading", "Sala trading", "interno", [[0, -20, 14, -10]]],
    ["biblioteca", "Biblioteca", "interno", [[14, -20, 24, -10]]],
    ["mensa", "Mensa e caffè", "interno", [[-24, -10, -14, 10]]],
    ["palestra", "Palestra", "interno", [[14, -10, 24, 10]]],
    ["portico", "Portico", "passaggio", [[-14, -10, 14, -7], [-14, 7, 14, 10], [-14, -7, -11, 7], [11, -7, 14, 7]]],
    ["cortile", "Cortile", "esterno", [[-11, -7, 11, 7]]],
    ["corridoio", "Corridoio dei dormitori", "passaggio", [[-24, 10, 24, 12]]],
    ...KEYS.map((k, i) => ["dorm_" + k, `Stanza ${ART[C.ARTICLE[k]]} ${C.NAMES[k]}`, "dormitorio", [[DORMX(i), 12, DORMX(i) + 6, 20]], k]),
  ].map(([id, name, kind, rects, owner]) => frz({ id, name, kind, rects: frz(rects.map(frz)), ...(owner ? { owner } : {}) }));
  const roomById = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const doors = [
    ["riunione|portico", "riunione", "portico", -7, -10, 1.6, "x"], ["trading|portico", "trading", "portico", 7, -10, 1.6, "x"],
    ["riunione|trading", "riunione", "trading", 0, -15, 1.2, "z"], ["presidenza|riunione", "presidenza", "riunione", -14, -15, 1.2, "z"],
    ["biblioteca|trading", "biblioteca", "trading", 14, -15, 1.2, "z"], ["presidenza|mensa", "presidenza", "mensa", -19, -10, 1.2, "x"],
    ["biblioteca|palestra", "biblioteca", "palestra", 19, -10, 1.2, "x"], ["mensa|portico", "mensa", "portico", -14, 0, 2.0, "z"],
    ["palestra|portico", "palestra", "portico", 14, 0, 2.0, "z"], ["mensa|corridoio", "mensa", "corridoio", -19, 10, 1.6, "x"],
    ["palestra|corridoio", "palestra", "corridoio", 19, 10, 1.6, "x"],
    ["portico|corridoio.o", "portico", "corridoio", -7, 10, 2.0, "x"], ["portico|corridoio.c", "portico", "corridoio", 0, 10, 2.0, "x"],
    ["portico|corridoio.e", "portico", "corridoio", 7, 10, 2.0, "x"],
    ["portico|cortile.n", "portico", "cortile", 0, -7, 2.4, "x"], ["portico|cortile.s", "portico", "cortile", 0, 7, 2.4, "x"],
    ["portico|cortile.o", "portico", "cortile", -11, 0, 2.4, "z"], ["portico|cortile.e", "portico", "cortile", 11, 0, 2.4, "z"],
    ...KEYS.map((k, i) => [`dorm_${k}|corridoio`, "dorm_" + k, "corridoio", -21 + 6 * i, 12, 1.0, "x"]),
  ].map(([id, a, b, x, z, w, axis]) => frz({ id, a, b, x, z, w, axis }));
  const inRect = (q, x, z) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3];
  const roomAt = (x, z) => {
    if (!U.isNum(x) || !U.isNum(z)) return null;
    for (const r of rooms) for (const q of r.rects) if (inRect(q, x, z)) return r.id;
    return null;
  };
  const centreOf = (id) => { const r = roomById[id]; if (!r) return null; if (id === "portico") return { x: 0, z: 0 }; const q = r.rects[0]; return { x: (q[0] + q[2]) / 2, z: (q[1] + q[3]) / 2 }; };

  // ---- 2. walls: [id, x0, z0, x1, z1, room on the −side, room on the +side, open side, windows [c, w, y0, y1]]
  // −side is north for a wall along x, west for a wall along z. "out" names the open side (outside, portico).
  const WALLS = [];
  const W = (id, x0, z0, x1, z1, a, b, out, wins = []) => WALLS.push({
    id, i: WALLS.length + 1, x0, z0, x1, z1, a, b, out, ax: z0 === z1 ? "x" : "z",
    wins: wins.map(([c, w = 1.4, y0 = 0.9, y1 = 2.45]) => ({ c, w, y0, y1 })),
  });
  W("n.presidenza", -24, -20, -14, -20, null, "presidenza", "a", [[-21.5], [-16.5]]);
  W("n.riunione", -14, -20, 0, -20, null, "riunione", "a", [[-12, 1.3], [-2, 1.3]]);
  W("n.trading", 0, -20, 14, -20, null, "trading", "a", [[2.4], [11.6]]);
  W("n.biblioteca", 14, -20, 24, -20, null, "biblioteca", "a");
  W("e.biblioteca", 24, -20, 24, -10, "biblioteca", null, "b", [[-17.5], [-12.5]]);
  W("e.palestra", 24, -10, 24, 10, "palestra", null, "b", [[-7, 2.2, 1.75, 2.85], [-3, 2.2, 1.75, 2.85], [3, 2.2, 1.75, 2.85], [7, 2.2, 1.75, 2.85]]);
  W("e.corridoio", 24, 10, 24, 12, "corridoio", null, "b", [[11, 1.0]]);
  W("e.dorm_scettico", 24, 12, 24, 20, "dorm_scettico", null, "b", [[16.3, 1.2]]);
  W("w.presidenza", -24, -20, -24, -10, null, "presidenza", "a", [[-16.5]]);
  W("w.mensa", -24, -10, -24, 10, null, "mensa", "a", [[-5.5, 2.4, 0.5, 2.6], [0, 2.4, 0.5, 2.6], [5.5, 2.4, 0.5, 2.6]]);
  W("w.corridoio", -24, 10, -24, 12, null, "corridoio", "a", [[11, 1.0]]);
  W("w.dorm_preside", -24, 12, -24, 20, null, "dorm_preside", "a", [[16.4, 1.2]]);
  KEYS.forEach((k, i) => W("s.dorm_" + k, DORMX(i), 20, DORMX(i) + 6, 20, "dorm_" + k, null, "b", [[DORMX(i) + 4.2]]));
  W("c.riunione", -14, -10, 0, -10, "riunione", "portico", "b", [[-11, 1.6], [-3, 1.6]]);
  W("c.trading", 0, -10, 14, -10, "trading", "portico", "b", [[3, 1.6], [11, 1.6]]);
  W("p.presidenza_mensa", -24, -10, -14, -10, "presidenza", "mensa", "");
  W("p.biblioteca_palestra", 14, -10, 24, -10, "biblioteca", "palestra", "");
  W("p.presidenza_riunione", -14, -20, -14, -10, "presidenza", "riunione", "");
  W("p.riunione_trading", 0, -20, 0, -10, "riunione", "trading", "");
  W("p.trading_biblioteca", 14, -20, 14, -10, "trading", "biblioteca", "");
  W("c.mensa", -14, -10, -14, 10, "mensa", "portico", "b", [[-6, 2.0], [6, 2.0]]);
  W("c.palestra", 14, -10, 14, 10, "portico", "palestra", "a", [[-6, 2.0, 1.75, 2.85], [6, 2.0, 1.75, 2.85]]);
  W("c.corridoio", -14, 10, 14, 10, "portico", "corridoio", "a", [[-10.5], [-3.5], [3.5], [10.5]]);
  W("p.mensa_corridoio", -24, 10, -14, 10, "mensa", "corridoio", "");
  W("p.palestra_corridoio", 14, 10, 24, 10, "palestra", "corridoio", "");
  KEYS.forEach((k, i) => W("p.corridoio_" + k, DORMX(i), 12, DORMX(i) + 6, 12, "corridoio", "dorm_" + k, ""));
  KEYS.slice(0, 7).forEach((k, i) => W(`p.dorm_${k}_${KEYS[i + 1]}`, DORMX(i + 1), 12, DORMX(i + 1), 20, "dorm_" + k, "dorm_" + KEYS[i + 1], ""));
  const wallById = Object.fromEntries(WALLS.map((w) => [w.id, w]));
  for (const w of WALLS) {
    w.len = w.ax === "x" ? w.x1 - w.x0 : w.z1 - w.z0;
    w.cx = (w.x0 + w.x1) / 2; w.cz = (w.z0 + w.z1) / 2;
    const s = w.out === "a" ? -1 : 1;
    w.nx = w.out && w.ax === "z" ? s : 0; w.nz = w.out && w.ax === "x" ? s : 0;
    // door openings along this wall: [centre, width], in the wall's own coordinate (x or z)
    w.doors = doors.filter((d) => (w.ax === "x" ? d.axis === "x" && d.z === w.z0 && d.x > w.x0 && d.x < w.x1 : d.axis === "z" && d.x === w.x0 && d.z > w.z0 && d.z < w.z1))
      .map((d) => ({ c: w.ax === "x" ? d.x : d.z, w: d.w }));
  }

  // ---- 3. furniture (static data: the footprints feed the paths, build() draws them)
  // r is a yaw like an anchor's face: the item's local +z (its front) points to (sin r, cos r).
  const ITEMS = [];
  const it = (t, room, x, z, r, w, d, o) => { const e = Object.assign({ t, room, x, z, r: r || 0, w, d, ob: true }, o); ITEMS.push(e); return e; };
  const ANC = {};
  const SPEC = [
    [/^riunione\.seat\./, "sit", "sit listen talk think write", ""], [/^riunione\.stand\./, "stand", "stand talk gesture", ""],
    [/^riunione\.board\.preside$/, "stand", "write gesture talk", ""], [/^riunione\.board\.guest$/, "stand", "gesture talk stand", ""],
    [/^riunione\.shelf$/, "stand", "read think", ""], [/^riunione\.screen$/, "stand", "stand type think", ""],
    [/^trading\.desk\./, "sit", "type read think talk", "work"], [/^trading\.wall\./, "stand", "think read talk", "work"],
    [/^trading\.gara\./, "stand", "think talk gesture", "chat gara"],
    [/^biblioteca\.armchair\./, "sit", "read think talk", "quiet chat"], [/^biblioteca\.table\./, "sit", "read write think", "quiet work"],
    [/^biblioteca\.shelf\./, "stand", "read think", "quiet"],
    [/^palestra\.desk\./, "sit", "think write type", "gym"], [/^palestra\.board$/, "stand", "talk gesture write", "gym"],
    [/^palestra\.stand\./, "stand", "listen think talk", "gym"], [/^palestra\.spot\./, "stand", "gesture idle", "fit"],
    [/^palestra\.bench\./, "sit", "drink talk sit", "chat"],
    [/^mensa\.counter\./, "stand", "drink talk", "meal chat"], [/^mensa\.seat\./, "sit", "drink talk listen read", "meal chat"],
    [/^cortile\.bench\./, "sit", "talk read think drink", "chat"], [/^cortile\.spot\./, "stand", "idle think talk", "walk"],
    [/^cortile\.fountain$/, "stand", "think idle", "walk"],
    [/^presidenza\.desk$/, "sit", "write read think", "work"], [/^presidenza\.guest\./, "sit", "talk listen", "chat"],
    [/^presidenza\.window$/, "stand", "think", "quiet"],
    [/^portico\.spot\./, "stand", "idle think", "walk"], [/^corridoio\.spot\./, "stand", "idle", "walk"],
    [/^dorm_[a-z]+\.bed$/, "lie", "sleep", "night"], [/^dorm_[a-z]+\.desk$/, "sit", "read write think", "quiet"],
    [/^dorm_[a-z]+\.spot$/, "stand", "idle think", ""],
  ];
  // an anchor: the pelvis (sit, lie) or the feet (stand) at x, z; the approach point behind a chair
  // (o.back), in front of an armchair or a bench (o.front), or given (o.ap)
  const A = (id, x, z, face, o = {}) => {
    const sp = SPEC.find(([re]) => re.test(id));
    if (!sp) throw new Error("world: no spec for " + id);
    const [room, kind] = id.split(".");
    const posture = sp[1];
    let ax = x, az = z;
    if (o.ap) [ax, az] = o.ap;
    else if (o.front) { ax = x + sin(face) * o.front; az = z + cos(face) * o.front; }
    else if (posture !== "stand") { const k = o.back || 0.62; ax = x - sin(face) * k; az = z - cos(face) * k; }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    ANC[id] = frz({
      id, room, kind, x: r3(x), z: r3(z), y: 0, face: r3(U.wrapAngle(face)), posture,
      seatH: posture === "sit" ? o.seatH || 0.46 : posture === "lie" ? 0.52 : 0, ax: r3(ax), az: r3(az),
      owner: o.owner || null, tags: frz(sp[3] ? sp[3].split(" ") : []), states: frz(sp[2].split(" ")),
      look: o.look ? frz({ x: o.look.x, y: o.look.y, z: o.look.z }) : null, ...(o.speak ? { speak: frz(o.speak) } : {}),
    });
  };
  const toward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  // a chair under a seated anchor: the seat sits a little in front of the pelvis
  const seat = (t, room, x, z, face, o) => it(t, room, x + sin(face) * 0.07, z + cos(face) * 0.07, face, o && o.w || 0.5, o && o.d || 0.5, o);
  const lamp = (t, room, x, z, o) => it(t, room, x, z, o && o.r || 0, o && o.w || 0.4, o && o.d || 0.4, Object.assign({ lamp: true, ob: t === "flamp" || t === "post" || t === "street" }, o));

  // riunione: the oval table with 8 seats on its north arc, the blackboard and ticker, the engine's terminal
  const TX = -7, TZ = -16.8;
  const ARC = { preside: 0, falco: -27, tartaruga: -54, spazzino: -81, ragioniere: -108, cronista: 32, guardiano: 66, scettico: 100 };
  it("otable", "riunione", TX, TZ, 0, 3.5, 2.1);
  it("rug", "riunione", TX, -16.5, 0, 7.2, 5.0, { ob: false, c: 0x35607e, c2: 0xd8c49a });
  for (const k of KEYS) {
    const t = ARC[k] * PI / 180, x = TX + 2.45 * sin(t), z = TZ - 1.75 * cos(t), f = toward(x, z, TX, TZ);
    seat("chair", "riunione", x, z, f, { tint: k === "preside" ? 0x9b2a35 : 0x3f5d78, kind: "meet", w: 0.4, d: 0.4 });
    A(`riunione.seat.${k}`, x, z, f, { owner: k, back: 0.78, look: { x: TX, y: 0.8, z: TZ } });
    A(`riunione.stand.${k}`, x - sin(f) * 0.78, z - cos(f) * 0.78, f, { owner: k, look: { x: TX, y: 1.0, z: TZ } });
    it("pad", "riunione", TX + 1.32 * sin(t), TZ - 0.78 * cos(t), f, 0.3, 0.3, { ob: false, k });
  }
  it("chalkboard", "riunione", TX, -19.86, 0, 5.6, 0.12, { ob: false, wall: "n.riunione", surf: "board" });
  A("riunione.board.preside", -9.4, -19.3, PI, { owner: "preside", look: { x: -8.6, y: 1.9, z: -19.9 } });
  A("riunione.board.guest", -4.6, -19.3, toward(-4.6, -19.3, TX, TZ), { look: { x: TX, y: 1.2, z: TZ } });
  it("console", "riunione", -1.25, TZ, -HP, 1.2, 0.6);
  A("riunione.screen", -2.2, TZ, HP, { look: { x: -1.32, y: 1.32, z: TZ }, speak: { x: -1.32, y: 1.92, z: TZ } });
  it("shelf", "riunione", -13.69, -12.1, HP, 2.6, 0.42, { h: 2.2 });
  A("riunione.shelf", -12.85, -12.1, -HP, { look: { x: -13.5, y: 1.3, z: -12.1 } });
  it("cabinet", "riunione", -0.33, -12.3, -HP, 2.2, 0.45, { h: 0.86, top: "coffee" });
  for (const x of [-11.8, -11.0, -10.2, -3.8, -3.0, -2.2]) seat("chair", "riunione", x, -10.62, PI, { tint: 0x3f5d78, kind: "meet", w: 0.4, d: 0.4 });
  it("plant", "riunione", -5.2, -10.6, 0, 0.5, 0.5, { s: 1.0, v: 0 });
  it("plant", "riunione", -13.35, -19.35, 0, 0.6, 0.6, { s: 1.5, v: 1 });
  it("plant", "riunione", -13.35, -10.65, 0, 0.6, 0.6, { s: 1.2, v: 0 });
  it("plant", "riunione", -0.65, -10.65, 0, 0.6, 0.6, { s: 1.3, v: 2 });
  lamp("flamp", "riunione", -0.6, -19.35, {});
  lamp("flamp", "riunione", -13.4, -14.0, {});
  it("clock", "riunione", -3.45, -19.87, 0, 0.42, 0.05, { ob: false, wall: "n.riunione", y: 2.35, tz: "Europe/Rome" });
  it("poster", "riunione", -13.88, -18.0, HP, 1.1, 0.04, { ob: false, wall: "p.presidenza_riunione", y: 1.8, cell: "motto" });

  // trading: four desks in the trading row, the risk desk, the news desk, the price wall, the contest board
  const DESKX = { falco: 2.2, tartaruga: 4.8, spazzino: 7.4, ragioniere: 10.0, guardiano: 3.0, cronista: 6.4 };
  for (const k of [...TR, "guardiano", "cronista"]) {
    const x = DESKX[k], dz = TR.includes(k) ? -16.6 : -13.0, wide = k === "guardiano";
    it("tdesk", "trading", x, dz, 0, wide ? 1.9 : 1.6, 0.8, { k, mon: k });
    seat("ochair", "trading", x, dz + 0.9, PI, { tint: C.COLORS[k] });
    A(`trading.desk.${k}`, x, dz + 0.9, PI, { owner: k, look: { x, y: 1.08, z: dz - 0.25 } });
  }
  it("pricewall", "trading", 7, -19.87, 0, 4.6, 0.08, { ob: false, wall: "n.trading", surf: "price" });
  it("ledticker", "trading", 7, -19.87, 0, 12.8, 0.06, { ob: false, wall: "n.trading" });
  [5.2, 7.0, 8.8].forEach((x, i) => A(`trading.wall.${i + 1}`, x, -18.7, PI, { look: { x: 7, y: 1.6, z: -19.85 } }));
  it("scoreboard", "trading", 13.87, -12.3, -HP, 3.2, 0.08, { ob: false, wall: "p.trading_biblioteca", surf: "gara" });
  [[12.6, -13.55], [12.25, -12.75], [12.25, -11.85], [12.6, -11.05]].forEach(([x, z], i) => A(`trading.gara.${i + 1}`, x, z, HP, { look: { x: 13.85, y: 1.75, z: -12.3 } }));
  [["Europe/Rome", -18.4, "roma"], ["America/New_York", -17.6, "ny"], ["Asia/Tokyo", -16.8, "tokyo"]].forEach(([tz, z, cell]) =>
    it("clock", "trading", 0.13, z, HP, 0.36, 0.05, { ob: false, wall: "p.riunione_trading", y: 2.5, tz, label: cell }));
  it("cooler", "trading", 13.45, -19.4, -HP, 0.4, 0.4, {});
  it("sofa", "trading", 3.0, -10.55, PI, 1.8, 0.8, { c: 0x34495e });
  it("plant", "trading", 0.6, -19.4, 0, 0.6, 0.6, { s: 1.4, v: 1 });
  it("plant", "trading", 13.4, -10.6, 0, 0.6, 0.6, { s: 1.2, v: 2 });
  lamp("flamp", "trading", 0.6, -10.6, {});
  lamp("flamp", "trading", 13.4, -17.6, {});

  // presidenza: the desk, the guests, the window, the shelves, the school register on its lectern
  it("desk", "presidenza", -19, -16.2, PI, 2.0, 0.9, { c: 0x5b3a26, big: true });
  seat("exec", "presidenza", -19, -17.15, 0, { w: 0.62, d: 0.6 });
  A("presidenza.desk", -19, -17.15, 0, { owner: "preside", look: { x: -19, y: 0.8, z: -16.2 } });
  [-19.6, -18.4].forEach((x, i) => {
    seat("chair", "presidenza", x, -15.2, PI, { tint: 0x7a2430, kind: "guest" });
    A(`presidenza.guest.${i + 1}`, x, -15.2, PI, { look: { x: -19, y: 1.2, z: -17.1 } });
  });
  A("presidenza.window", -21.5, -19.25, PI, { look: { x: -21.5, y: 1.6, z: -21 } });
  it("shelf", "presidenza", -23.69, -12.4, HP, 2.6, 0.42, { h: 2.3 });
  it("lectern", "presidenza", -15.3, -12.0, -HP + 0.5, 0.55, 0.45, {});
  it("rug", "presidenza", -19, -15.9, 0, 4.2, 3.4, { ob: false, c: 0x7a2430, c2: 0xd9b96a });
  it("globe", "presidenza", -23.2, -19.1, 0, 0.5, 0.5, {});
  it("plant", "presidenza", -23.35, -10.65, 0, 0.6, 0.6, { s: 1.4, v: 1 });
  it("sofa", "presidenza", -15.0, -16.6, -HP, 1.8, 0.8, { c: 0x6a3b26 });
  lamp("flamp", "presidenza", -14.65, -19.35, {});
  it("poster", "presidenza", -14.12, -12.0, -HP, 0.9, 0.04, { ob: false, wall: "p.presidenza_riunione", y: 1.75, cell: "crest" });

  // biblioteca: shelves on three walls, four reading tables, four armchairs round a low table
  [15.35, 17.55, 19.75, 21.95].forEach((x) => it("shelf", "biblioteca", x, -19.69, 0, 2.2, 0.42, { h: 2.4 }));
  it("shelf", "biblioteca", 14.31, -17.6, HP, 3.4, 0.42, { h: 2.4 });
  it("shelf", "biblioteca", 23.69, -15.0, -HP, 1.6, 0.42, { h: 2.4 });
  [[16.3, -18.92, PI, { x: 16.3, y: 1.3, z: -19.7 }], [20.6, -18.92, PI, { x: 20.6, y: 1.3, z: -19.7 }], [15.05, -17.6, -HP, { x: 14.4, y: 1.3, z: -17.6 }]]
    .forEach(([x, z, f, look], i) => A(`biblioteca.shelf.${i + 1}`, x, z, f, { look }));
  [[19.6, -17.6], [22.4, -17.6], [19.6, -14.9], [22.4, -14.9]].forEach(([x, z], i) => {
    it("table", "biblioteca", x, z, 0, 1.2, 0.7, { c: 0x6e4429, h: 0.75, books: true });
    lamp("banker", "biblioteca", x + 0.35, z - 0.12, { on: x });
    seat("chair", "biblioteca", x, z + 0.8, PI, { tint: 0x2f5a44, kind: "library" });
    A(`biblioteca.table.${i + 1}`, x, z + 0.8, PI, { look: { x, y: 0.78, z } });
  });
  it("ctable", "biblioteca", 16.6, -12.2, 0, 0.5, 1.1, {});
  [[15.0, -12.9, HP], [15.0, -11.5, HP], [18.2, -12.9, -HP], [18.2, -11.5, -HP]].forEach(([x, z, f], i) => {
    it("armchair", "biblioteca", x - sin(f) * 0.05, z, f, 0.72, 0.72, { tint: [0x7a3b2e, 0x2f5a44, 0x2f5a44, 0x7a3b2e][i] });
    A(`biblioteca.armchair.${i + 1}`, x, z, f, { front: 0.95, seatH: 0.42, look: { x: 16.6, y: 0.5, z } });
  });
  it("rug", "biblioteca", 16.6, -12.2, 0, 4.4, 3.0, { ob: false, c: 0x6d2f2a, c2: 0xd8b878 });
  lamp("flamp", "biblioteca", 14.5, -13.75, {});
  lamp("flamp", "biblioteca", 23.45, -10.55, {});
  it("globe", "biblioteca", 23.3, -12.0, 0, 0.5, 0.5, {});
  it("plant", "biblioteca", 23.45, -19.45, 0, 0.5, 0.5, { s: 1.0, v: 0 });
  it("ladder", "biblioteca", 18.7, -19.3, 0, 0.5, 0.2, { ob: false });
  it("poster", "biblioteca", 19.0, -10.12, PI, 1.6, 0.04, { ob: false, wall: "p.biblioteca_palestra", y: 1.85, cell: "map" });

  // mensa: the bar with the coffee machine, four tables with four chairs, big windows on the west
  it("counter", "mensa", -22.1, -8.1, 0, 3.6, 0.6, {});
  it("backbar", "mensa", -22.1, -9.62, 0, 3.6, 0.55, {});
  [-23.1, -22.1, -21.1].forEach((x, i) => A(`mensa.counter.${i + 1}`, x, -7.2, PI, { look: { x, y: 1.1, z: -8.1 } }));
  [[-21.6, -3.4], [-16.6, -3.4], [-21.6, 3.6], [-16.6, 3.6]].forEach(([tx, tz], t) => {
    it("rtable", "mensa", tx, tz, 0, 0.9, 0.9, {});
    lamp("candle", "mensa", tx + 0.12, tz - 0.1, {});
    [[0, -0.62, 0], [0.62, 0, -HP], [0, 0.62, PI], [-0.62, 0, HP]].forEach(([dx, dz, f], n) => {
      seat("chair", "mensa", tx + dx, tz + dz, f, { tint: [0xc8553d, 0x2f6b8a, 0xd9a03a, 0x4f8a4a][t], kind: "cafe" });
      A(`mensa.seat.${t + 1}.${n + 1}`, tx + dx, tz + dz, f, { look: { x: tx, y: 0.8, z: tz } });
    });
  });
  it("fridge", "mensa", -14.45, -9.0, -HP, 0.7, 0.62, {});
  it("plant", "mensa", -23.4, 9.4, 0, 0.6, 0.6, { s: 1.5, v: 1 });
  it("plant", "mensa", -14.6, 9.4, 0, 0.6, 0.6, { s: 1.3, v: 2 });
  it("plant", "mensa", -23.4, -9.45, 0, 0.5, 0.5, { s: 1.1, v: 0 });
  lamp("flamp", "mensa", -23.4, -2.75, {});
  lamp("flamp", "mensa", -23.4, 2.75, {});
  it("poster", "mensa", -21.5, 9.88, PI, 0.8, 0.04, { ob: false, wall: "p.mensa_corridoio", y: 1.65, cell: "menu", tall: true });

  // palestra: four exam desks facing the whiteboard, the Scettico's spot, the fitness corner, two benches
  it("whiteboard", "palestra", 21.7, -9.87, 0, 3.4, 0.08, { ob: false, wall: "p.biblioteca_palestra", surf: "palestra" });
  TR.forEach((k, i) => {
    const x = 18.4 + 1.4 * i;
    it("sdesk", "palestra", x, -6.6, 0, 1.0, 0.6, {});
    seat("chair", "palestra", x, -5.85, PI, { tint: C.COLORS[k], kind: "student" });
    A(`palestra.desk.${k}`, x, -5.85, PI, { owner: k, look: { x, y: 0.78, z: -6.6 } });
  });
  A("palestra.board", 23.15, -8.85, toward(23.15, -8.85, 20.5, -6.0), { owner: "preside", look: { x: 20.5, y: 1.1, z: -6.0 } });
  A("palestra.stand.scettico", 16.9, -7.6, toward(16.9, -7.6, 20.5, -6.3), { owner: "scettico", look: { x: 20.5, y: 1.0, z: -6.3 } });
  it("treadmill", "palestra", 22.9, 7.0, HP, 0.8, 1.9, {});
  it("rower", "palestra", 22.4, 4.0, -HP, 0.6, 2.3, {});
  it("mat", "palestra", 19.0, 4.2, 0, 3.0, 2.5, { ob: false });
  [[18.1, 3.4], [19.9, 3.4], [18.1, 5.0], [19.9, 5.0]].forEach(([x, z], i) => A(`palestra.spot.${i + 1}`, x, z, -HP, { look: { x: 14.2, y: 1.4, z } }));
  it("mirror", "palestra", 14.12, 3.5, HP, 3.0, 0.04, { ob: false, wall: "c.palestra", y: 1.25 });
  it("wallbars", "palestra", 23.8, 0, -HP, 2.8, 0.2, {});
  [[14.4, -3.6], [14.4, 8.0]].forEach(([x, z], i) => {
    it("gbench", "palestra", x, z, HP, 1.6, 0.4, {});
    A(`palestra.bench.${i + 1}`, x, z, HP, { front: 0.6, seatH: 0.45, look: { x: 19, y: 1.2, z } });
  });
  it("hoop", "palestra", 22.0, 9.85, PI, 1.1, 0.5, { ob: false, wall: "p.palestra_corridoio" });
  it("balls", "palestra", 15.0, 9.3, 0, 1.2, 0.5, {});
  it("weights", "palestra", 23.45, -4.2, -HP, 1.2, 0.45, {});
  it("cooler", "palestra", 14.45, -9.45, HP, 0.4, 0.4, {});
  it("courtlines", "palestra", 19, 0, 0, 10, 20, { ob: false });
  it("poster", "palestra", 14.12, -2.6, HP, 0.8, 0.04, { ob: false, wall: "c.palestra", y: 1.7, cell: "gym" });
  [[23.86, -5.0, -HP, "e.palestra"], [23.86, 5.0, -HP, "e.palestra"], [14.14, -8.0, HP, "c.palestra"], [14.14, 8.9, HP, "c.palestra"]]
    .forEach(([x, z, r, wall]) => lamp("sconce", "palestra", x, z, { r, wall, y: 2.55, ob: false }));

  // corridoio: four spots, a notice board, wall lamps and the dormitory name plates
  [-16.5, -5.5, 5.5, 16.5].forEach((x, i) => A(`corridoio.spot.${i + 1}`, x, 11, 0, {}));
  it("notice", "corridoio", 12.6, 10.12, 0, 1.6, 0.05, { ob: false, wall: "c.corridoio", y: 1.55 });
  it("rug", "corridoio", 0, 11, 0, 46.6, 0.95, { ob: false, c: 0x7a2f32, c2: 0xd8b878 });
  KEYS.forEach((k, i) => {
    lamp("sconce", "corridoio", DORMX(i) + 1.2, 11.86, { r: PI, wall: "p.corridoio_" + k, y: 2.3, ob: false });
    it("plate", "corridoio", DORMX(i) + 3.78, 11.88, PI, 0.38, 0.03, { ob: false, wall: "p.corridoio_" + k, y: 1.6, k, i });
  });

  // portico: the colonnade (columns every ~3 m, arches), lanterns, lemon trees, the common-goal board
  const COLS = [];
  for (let i = 0; i < 8; i++) { const x = -11 + i * 22 / 7; COLS.push([x, -7], [x, 7]); }
  for (let i = 1; i < 5; i++) { const z = -7 + i * 14 / 5; COLS.push([-11, z], [11, z]); }
  for (const [x, z] of COLS) it("column", x <= -11 || x >= 11 ? "portico" : "portico", x, z, 0, 0.42, 0.42, {});
  it("goalboard", "portico", 0, -9.8, 0, 4.0, 0.14, { surf: "goal" });
  [[-12.5, -8.5], [0, -8.4], [12.5, -8.5], [12.5, -3.5], [12.5, 8.5], [-3.5, 8.5], [-12.5, 8.5], [-12.5, 3.5]].forEach(([x, z], i) =>
    A(`portico.spot.${i + 1}`, x, z, i === 1 ? PI : toward(x, z, 0, 0), { look: i === 1 ? { x: 0, y: 1.9, z: -9.85 } : null }));
  [[-13.4, -9.4], [13.4, -9.4], [-13.4, 9.4], [13.4, 9.4]].forEach(([x, z]) => it("lemon", "portico", x, z, 0, 0.62, 0.62, {}));
  [[-10, -9.86, 0, "c.riunione"], [-4, -9.86, 0, "c.riunione"], [4, -9.86, 0, "c.trading"], [10, -9.86, 0, "c.trading"],
    [-13.86, -4, HP, "c.mensa"], [-13.86, 4, HP, "c.mensa"], [13.86, -4, -HP, "c.palestra"], [13.86, 4, -HP, "c.palestra"],
    [-5.0, 9.86, PI, "c.corridoio"], [5.0, 9.86, PI, "c.corridoio"]]
    .forEach(([x, z, r, wall]) => lamp("lantern", "portico", x, z, { r, wall, y: 2.35, ob: false }));

  // cortile: the fountain, the walking loop, six benches, olive trees, flower beds, lamp posts
  it("fountain", "cortile", 0, 0, 0, 2.9, 2.9, {});
  it("garden", "cortile", 0, 0, 0, 22, 14, { ob: false });
  for (let k = 0; k < 8; k++) {
    const th = k * PI / 4, x = 3 * cos(th), z = 3 * sin(th);
    A(`cortile.spot.${k + 1}`, x, z, Math.atan2(-sin(th), cos(th)), {});
  }
  A("cortile.fountain", 0.88, 2.12, toward(0.88, 2.12, 0, 0), { look: { x: 0, y: 0.9, z: 0 } });
  [[3.6, -4.6, 0], [-3.6, -4.6, 0], [-3.6, 4.6, PI], [3.6, 4.6, PI], [-7.6, -2.4, 0], [7.6, 2.4, PI]].forEach(([x, z, f], i) => {
    it("bench", "cortile", x - sin(f) * 0.06, z - cos(f) * 0.06, f, 1.6, 0.62, {});
    A(`cortile.bench.${i + 1}`, x, z, f, { front: 0.72, seatH: 0.45, look: i < 4 ? { x: 0, y: 0.8, z: 0 } : { x, y: 0.8, z: 0 } });
  });
  [[-7.0, -4.6], [7.0, 4.6], [-7.0, 4.6], [7.0, -4.6]].forEach(([x, z]) => it("tree", "cortile", x, z, 0, 0.4, 0.4, { kind: "olive" }));
  [[-9.6, -5.8], [9.6, -5.8], [-9.6, 5.8], [9.6, 5.8]].forEach(([x, z]) => it("flowerbed", "cortile", x, z, 0, 2.2, 1.6, {}));
  [[5.6, -1.25], [-5.6, 1.25], [-1.25, -5.4], [1.25, 5.4]].forEach(([x, z]) => lamp("post", "cortile", x, z, { w: 0.3, d: 0.3 }));

  // the eight dormitories: bed (head to the west), desk, wardrobe with mirror, rug, personal objects
  KEYS.forEach((k, i) => {
    const x0 = DORMX(i), room = "dorm_" + k, col = C.COLORS[k];
    it("bed", room, x0 + 1.22, 19.27, HP, 1.25, 2.25, { k });
    A(`${room}.bed`, x0 + 1.3, 19.27, -HP, { owner: k, ap: [x0 + 1.3, 18.2] });
    it("nightstand", room, x0 + 0.4, 18.25, HP, 0.4, 0.45, {});
    lamp("blamp", room, x0 + 0.38, 18.2, {});
    it("desk", room, x0 + 5.58, 16.3, -HP, 1.2, 0.6, { c: k === "falco" ? 0xe9e7e2 : 0x8a5a36, k });
    seat("chair", room, x0 + 4.85, 16.3, HP, { tint: col, kind: "dorm" });
    A(`${room}.desk`, x0 + 4.85, 16.3, HP, { owner: k, look: { x: x0 + 5.6, y: 0.85, z: 16.3 } });
    lamp("dlamp", room, x0 + 5.7, 16.85, {});
    it("wardrobe", room, x0 + 0.4, 13.4, HP, 1.6, 0.6, { k });
    A(`${room}.spot`, x0 + 1.45, 13.4, -HP, { owner: k, look: { x: x0 + 0.72, y: 1.55, z: 13.4 } });
    it("rug", room, x0 + 3.0, 16.3, 0, 2.6, 2.0, { ob: false, c: mixHex(col, 0xe9dfcf, 0.3), c2: 0xf1e9da });
    it("dorm", room, x0 + 3, 16, 0, 6, 8, { ob: false, k, x0 });
  });
  // the props that make each room theirs (Appendix C): obstacles only where they stand on the floor
  const DX = (k) => DORMX(KEYS.indexOf(k));
  it("armchair", "dorm_preside", DX("preside") + 5.25, 13.1, -2.4, 0.8, 0.8, { tint: 0x7a2430 });
  it("binders", "dorm_ragioniere", DX("ragioniere") + 4.9, 12.33, 0, 1.6, 0.36, { h: 1.1 });
  it("plant", "dorm_tartaruga", DX("tartaruga") + 5.45, 12.55, 0, 0.6, 0.6, { s: 1.6, v: 1 });
  it("plant", "dorm_tartaruga", DX("tartaruga") + 5.55, 19.5, 0, 0.5, 0.5, { s: 1.1, v: 2 });
  it("plant", "dorm_tartaruga", DX("tartaruga") + 3.0, 19.55, 0, 0.45, 0.45, { s: 0.9, v: 0 });
  it("papers", "dorm_cronista", DX("cronista") + 5.4, 12.55, 0, 0.7, 0.5, {});
  it("trophies", "dorm_spazzino", DX("spazzino") + 4.9, 12.3, 0, 1.4, 0.34, { h: 1.0 });
  it("broom", "dorm_spazzino", DX("spazzino") + 5.8, 18.6, 0, 0.3, 0.3, { ob: false });
  it("chess", "dorm_scettico", DX("scettico") + 5.0, 13.0, 0, 0.6, 0.6, {});
  it("bookpile", "dorm_scettico", DX("scettico") + 3.1, 19.5, 0, 0.5, 0.4, {});
  it("dumbbells", "dorm_falco", DX("falco") + 5.3, 12.5, 0, 0.8, 0.4, {});
  lamp("night", "dorm_guardiano", DX("guardiano") + 0.25, 17.85, { ob: false });
  it("armchair", "dorm_tartaruga", DX("tartaruga") + 4.8, 13.2, -2.5, 0.72, 0.72, { tint: 0x4f7a44 });
  it("safe", "dorm_guardiano", DX("guardiano") + 5.45, 12.55, 0, 0.6, 0.55, {});
  it("armchair", "dorm_cronista", DX("cronista") + 4.6, 13.0, -2.6, 0.72, 0.72, { tint: 0xb05a7c });

  // the grounds: none of these are inside a room, so none of them block paths
  it("grounds", null, 0, 0, 0, 80, 68, { ob: false });

  // ---- 4. obstacles: furniture footprints and the walls' solid parts
  const OBST = [];
  const half = (e) => [abs(cos(e.r)) * e.w / 2 + abs(sin(e.r)) * e.d / 2, abs(sin(e.r)) * e.w / 2 + abs(cos(e.r)) * e.d / 2];
  for (const e of ITEMS) {
    if (!e.ob || !e.room) continue;
    const q = abs(sin(2 * e.r)) > 0.05, long = max(e.w, e.d), short = min(e.w, e.d);
    if (q && long > 1.4 * short) {
      // a long item on a slant: a row of small boxes along its length follows it better than one box
      const n = Math.ceil(long / short), along = e.w >= e.d ? [cos(e.r), -sin(e.r)] : [sin(e.r), cos(e.r)];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5, cx = e.x + along[0] * t * long, cz = e.z + along[1] * t * long;
        const [hx, hz] = half({ r: e.r, w: e.w >= e.d ? long / n : short, d: e.w >= e.d ? short : long / n });
        OBST.push({ x0: cx - hx, z0: cz - hz, x1: cx + hx, z1: cz + hz, id: e.t + "@" + e.room });
      }
      continue;
    }
    const [hx, hz] = half(e);
    OBST.push({ x0: e.x - hx, z0: e.z - hz, x1: e.x + hx, z1: e.z + hz, id: e.t + "@" + e.room });
  }
  for (const w of WALLS) {
    // the solid parts at floor level, between the doors
    const cuts = w.doors.map((d) => [d.c - d.w / 2, d.c + d.w / 2]).sort((a, b) => a[0] - b[0]);
    const s0 = w.ax === "x" ? w.x0 : w.z0, s1 = w.ax === "x" ? w.x1 : w.z1;
    let s = s0 - 0.1;
    for (const [c0, c1] of [...cuts, [s1 + 0.1, s1 + 0.1]]) {
      if (c0 > s + 1e-6) OBST.push(w.ax === "x" ? { x0: s, z0: w.z0 - 0.1, x1: c0, z1: w.z0 + 0.1, id: "wall:" + w.id } : { x0: w.x0 - 0.1, z0: s, x1: w.x0 + 0.1, z1: c0, id: "wall:" + w.id });
      s = c1;
    }
  }
  // a coarse bucket grid over the inflated rects, so clear() looks at the nearby ones only
  const GX0 = -26, GZ0 = -22, GC = 3, GNX = 18, GNZ = 15;
  const GRID = Array.from({ length: GNX * GNZ }, () => []);
  OBST.forEach((o, n) => {
    o.ix0 = o.x0 - INF; o.iz0 = o.z0 - INF; o.ix1 = o.x1 + INF; o.iz1 = o.z1 + INF;
    const a = max(0, Math.floor((o.ix0 - GX0) / GC)), b = min(GNX - 1, Math.floor((o.ix1 - GX0) / GC));
    const c = max(0, Math.floor((o.iz0 - GZ0) / GC)), d = min(GNZ - 1, Math.floor((o.iz1 - GZ0) / GC));
    for (let gx = a; gx <= b; gx++) for (let gz = c; gz <= d; gz++) GRID[gz * GNX + gx].push(n);
  });
  const stamp = new Uint32Array(OBST.length);
  let stampN = 0;
  // does the segment a-b cross the rect (strictly inside)? Liang–Barsky
  const segHits = (ax, az, bx, bz, x0, z0, x1, z1) => {
    const e = 1e-6; x0 += e; z0 += e; x1 -= e; z1 -= e;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 < t1;
  };
  // skip: obstacles to ignore (those that contain a point the path starts or ends in)
  function clearSeg(ax, az, bx, bz, skip) {
    if (++stampN >= 0xffffffff) { stamp.fill(0); stampN = 1; }
    const a = max(0, Math.floor((min(ax, bx) - GX0) / GC)), b = min(GNX - 1, Math.floor((max(ax, bx) - GX0) / GC));
    const c = max(0, Math.floor((min(az, bz) - GZ0) / GC)), d = min(GNZ - 1, Math.floor((max(az, bz) - GZ0) / GC));
    for (let gz = c; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
      for (const n of GRID[gz * GNX + gx]) {
        if (stamp[n] === stampN) continue;
        stamp[n] = stampN;
        if (skip && skip.includes(n)) continue;
        const o = OBST[n];
        if (segHits(ax, az, bx, bz, o.ix0, o.iz0, o.ix1, o.iz1)) return false;
      }
    }
    return true;
  }
  const clear = (p, q) => !!(p && q) && U.isNum(p.x) && U.isNum(p.z) && U.isNum(q.x) && U.isNum(q.z) && clearSeg(p.x, p.z, q.x, q.z, null);
  const inside = (x, z) => OBST.reduce((l, o, n) => (x > o.ix0 && x < o.ix1 && z > o.iz0 && z < o.iz1 ? (l.push(n), l) : l), []);

  // ---- 5. the waypoint graph and A* (built on the first query)
  let G = null;
  function graph() {
    if (G) return G;
    const nodes = [], adj = [];
    const node = (x, z, room, kind) => { nodes.push({ id: kind + nodes.length, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, room, kind }); adj.push([]); return nodes.length - 1; };
    const link = (a, b) => { const d = hyp(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); adj[a].push([b, d]); adj[b].push([a, d]); };
    for (const d of doors) {
      const [ox, oz] = d.axis === "x" ? [0, 0.6] : [0.6, 0];
      const c = node(d.x, d.z, null, "d");
      const p = node(d.x - ox, d.z - oz, roomAt(d.x - ox, d.z - oz), "s"), q = node(d.x + ox, d.z + oz, roomAt(d.x + ox, d.z + oz), "s");
      link(c, p); link(c, q);
    }
    for (const a of Object.values(ANC)) node(a.ax, a.az, a.room, "a");
    for (const r of rooms) for (const q of r.rects) {
      const nx = max(1, Math.round((q[2] - q[0] - 0.8) / 1.25)), nz = max(1, Math.round((q[3] - q[1] - 0.8) / 1.25));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = q[0] + 0.4 + (q[2] - q[0] - 0.8) * (i + 0.5) / nx, z = q[1] + 0.4 + (q[3] - q[1] - 0.8) * (j + 0.5) / nz;
        if (!OBST.some((o) => x > o.ix0 - 0.05 && x < o.ix1 + 0.05 && z > o.iz0 - 0.05 && z < o.iz1 + 0.05)) node(x, z, r.id, "g");
      }
    }
    const byRoom = {};
    nodes.forEach((n, i) => { if (n.room) (byRoom[n.room] = byRoom[n.room] || []).push(i); });
    for (const list of Object.values(byRoom)) {
      for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
        const a = nodes[list[p]], b = nodes[list[q]], d = hyp(a.x - b.x, a.z - b.z);
        if (d > (a.kind === "g" && b.kind === "g" ? 2.7 : 6.5)) continue;
        if (clearSeg(a.x, a.z, b.x, b.z, null)) link(list[p], list[q]);
      }
      // a node with no neighbour joins its nearest visible node at any distance
      for (const i of list) {
        if (adj[i].length) continue;
        let best = -1, bd = 1e9;
        for (const j of list) { if (j === i) continue; const d = hyp(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z); if (d < bd && clearSeg(nodes[i].x, nodes[i].z, nodes[j].x, nodes[j].z, null)) { bd = d; best = j; } }
        if (best >= 0) link(i, best);
      }
    }
    G = { nodes, adj, byRoom };
    return G;
  }
  // connect a free point to the graph: the nearest visible nodes of its room
  function attach(g, p, room) {
    const list = (g.byRoom[room] || []).filter((i) => g.adj[i].length).map((i) => [i, hyp(g.nodes[i].x - p.x, g.nodes[i].z - p.z)]).sort((a, b) => a[1] - b[1]);
    let out = [];
    for (const skip of [null, inside(p.x, p.z)]) {
      for (const [i, d] of list) {
        if (clearSeg(p.x, p.z, g.nodes[i].x, g.nodes[i].z, skip)) out.push([i, d]);
        if (out.length >= 5 || (out.length && d > out[0][1] + 6)) break;
      }
      if (out.length) return { links: out, relaxed: !!skip };
    }
    return { links: list.slice(0, 1), relaxed: true };
  }
  function astar(g, starts, goals, to) {
    const n = g.nodes.length, gs = new Float64Array(n + 1).fill(Infinity), from = new Int32Array(n + 1).fill(-1), done = new Uint8Array(n + 1);
    const goalCost = new Map(goals.map(([i, d]) => [i, d]));
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const h = (i) => (i === n ? 0 : hyp(g.nodes[i].x - to.x, g.nodes[i].z - to.z));
    for (const [i, d] of starts) { if (d < gs[i]) { gs[i] = d; from[i] = -2; push(i, d + h(i)); } }
    while (heap.length) {
      const [, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === n) break;
      const edges = goalCost.has(i) ? [...g.adj[i], [n, goalCost.get(i)]] : g.adj[i];
      for (const [j, d] of edges) {
        const c = gs[i] + d;
        if (c < gs[j]) { gs[j] = c; from[j] = i; push(j, c + h(j)); }
      }
    }
    if (!done[n]) return null;
    const out = [];
    for (let i = from[n]; i >= 0; i = from[i]) out.unshift(i);
    return out;
  }
  function findPath(from, to) {
    if (!from || !to || !U.isNum(from.x) || !U.isNum(from.z) || !U.isNum(to.x) || !U.isNum(to.z)) return null;
    const ra = roomAt(from.x, from.z), rb = roomAt(to.x, to.z);
    if (!ra || !rb) return null;
    const end = { x: to.x, z: to.z };
    if (ra === rb && clearSeg(from.x, from.z, to.x, to.z, null)) return [end];
    const g = graph();
    const s = attach(g, from, ra), e = attach(g, to, rb);
    const ids = astar(g, s.links, e.links, to);
    if (!ids) return [end];
    const pts = [from, ...ids.map((i) => g.nodes[i]), end];
    // pull the string: from each kept point, skip ahead while the straight segment stays clear
    const out = [];
    let i = s.relaxed ? 1 : 0;
    if (s.relaxed) out.push({ x: pts[1].x, z: pts[1].z });
    const lastFree = e.relaxed ? pts.length - 2 : pts.length - 1;
    while (i < pts.length - 1) {
      let j = i + 1;
      while (j + 1 <= lastFree && clearSeg(pts[i].x, pts[i].z, pts[j + 1].x, pts[j + 1].z, null)) j++;
      out.push({ x: pts[j].x, z: pts[j].z });
      i = j;
    }
    out[out.length - 1] = end;
    return out;
  }

  // ---- 6. occupancy
  const OCC = {};
  const reserve = (id, key, force) => {
    const a = ANC[id];
    if (!a || !key) return false;
    if (!force && ((a.owner && a.owner !== key) || (OCC[id] && OCC[id] !== key))) return false;
    OCC[id] = key;
    return true;
  };
  const release = (id, key) => { if (OCC[id] === key) delete OCC[id]; };
  const occupant = (id) => OCC[id] || null;
  const anchorsIn = (room, f = {}) => Object.values(ANC).filter((a) => a.room === room && (!f.kind || a.kind === f.kind)
    && (!f.tag || a.tags.includes(f.tag)) && (!f.posture || a.posture === f.posture) && (f.free === undefined || f.free === !OCC[a.id]));
  const minimap = () => ({
    bounds: [-24, -20, 24, 20],
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, kind: r.kind, rects: r.rects.map((q) => q.slice()) })),
    doors: doors.map((d) => ({ x: d.x, z: d.z, w: d.w, axis: d.axis })),
  });

  // ---- 7. the 3D side: shared uniforms, shader hooks, geometry buckets
  const NW = WALLS.length + 1, NR = rooms.length + 1;
  const ROOMIX = Object.fromEntries(rooms.map((r, i) => [r.id, i + 1]));
  const UNI = { wallH: { value: new Float32Array(NW).fill(99) }, t: { value: 0 }, night: { value: 0 }, roomLit: { value: new Float32Array(NR) } };
  let T = null;
  const LIN = {};
  const lin = (hex) => LIN[hex] || (LIN[hex] = (() => { const c = new T.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; })());
  const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnz(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
  // the floors: one material, the pattern per vertex (type, size, amount): tiles, planks, checker, terrazzo, grass, rugs …
  const FLOOR = `{
  int ty = int(vPat.x + 0.5); float s = max(vPat.y, 0.01); float amp = vPat.z;
  vec2 p = vWP.xz; vec3 c = diffuseColor.rgb; float k = 1.0;
  float fade = 1.0 - smoothstep(12.0, 46.0, length(vViewPosition));
  if (ty == 1 || ty == 3 || ty == 5 || ty == 8) {
    vec2 q = p / s; if (ty == 8) q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 cell = floor(q), fr = fract(q); float h = h21(cell);
    k *= 1.0 + amp * (h - 0.5);
    if (ty == 3) c = mix(c, c * vec3(0.74, 0.5, 0.36), mod(cell.x + cell.y, 2.0));
    if (ty == 5) k *= 1.0 + 0.1 * (mod(cell.x + cell.y, 2.0) - 0.5) + 0.12 * fade * (h21(floor(p * 90.0)) - 0.5);
    if (ty == 8) c *= mix(vec3(1.0), vec3(1.1, 0.9, 0.82), h21(cell + 3.7));
    float e = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)) * s;
    if (ty != 5) k *= mix(1.0, mix(0.6, 1.0, smoothstep(0.003, 0.011, e)), fade);
  } else if (ty == 2 || ty == 9) {
    float L = s * (ty == 9 ? 16.0 : 6.0);
    float row = floor(p.y / s), off = h21(vec2(row, 1.7)) * L, col = floor((p.x + off) / L);
    float h = h21(vec2(col, row));
    k *= 1.0 + amp * (h - 0.5);
    float fy = fract(p.y / s) * s, fx = fract((p.x + off) / L) * L;
    float e = min(min(fy, s - fy), min(fx, L - fx));
    k *= mix(1.0, mix(0.66, 1.0, smoothstep(0.002, 0.007, e)), fade);
    k *= 1.0 + fade * 0.06 * sin(p.y * 110.0 + vnz(vec2(p.x * 1.1, p.y * 14.0)) * 6.0 + h * 9.0);
  } else if (ty == 4) {
    vec2 g0 = floor(p * 34.0); float n = h21(g0), n2 = h21(g0 + 9.1);
    vec3 chip = n2 < 0.4 ? vec3(0.05) : n2 < 0.75 ? vec3(0.85, 0.82, 0.78) : vec3(0.36, 0.12, 0.07);
    c = mix(c, chip, step(0.87, n) * 0.35 * fade);
    k *= 1.0 + 0.07 * (vnz(p * 0.45) - 0.5);
    vec2 g = abs(fract(p / 2.0) - 0.5) * 2.0;
    c = mix(c, vec3(0.42, 0.3, 0.1), (1.0 - smoothstep(0.003, 0.008, min(1.0 - g.x, 1.0 - g.y) * 1.0)) * fade);
  } else if (ty == 6) {
    float n = vnz(p * 0.32), m = vnz(p * 1.6 + 3.0);
    c *= mix(vec3(0.78, 0.95, 0.74), vec3(1.15, 1.08, 0.8), n) * (0.88 + 0.24 * m);
    k *= 1.0 + 0.2 * fade * (h21(floor(p * 55.0)) - 0.5);
  } else if (ty == 7) {
    vec2 sz = vPat.zw, u = vLuv * sz; float b = min(min(u.x, sz.x - u.x), min(u.y, sz.y - u.y));
    float border = step(b, 0.11), inner = step(b, 0.16) - border;
    vec2 lat = abs(fract(u / 0.62) - 0.5);
    float motif = 1.0 - smoothstep(0.02, 0.045, abs(lat.x + lat.y - 0.32));
    float pc = vPat.y; vec3 c2 = pow(vec3(floor(pc / 65536.0), mod(floor(pc / 256.0), 256.0), mod(pc, 256.0)) / 255.0, vec3(2.2));
    c = mix(c, c2, max(inner, motif * (1.0 - step(b, 0.16)) * 0.7));
    c = mix(c, c * 0.5, border);
    k *= 1.0 + 0.1 * fade * (h21(floor(p * 70.0)) - 0.5);
  } else {
    k *= 1.0 + amp * (vnz(p * 0.7) - 0.5) + 0.3 * fade * amp * (h21(floor(p * 42.0)) - 0.5);
  }
  diffuseColor.rgb = c * k;
}`;
  // one hook for every world material: the wall clip (anything mounted on a lowered wall above its
  // cut height is discarded), plus optional floors, caps, sway, water, glass and per-instance glow
  function hook(mat, key, o = {}) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uWallH: UNI.wallH, uT: UNI.t, uNight: UNI.night, uRoomLit: UNI.roomLit });
      let v = sh.vertexShader, f = sh.fragmentShader;
      v = v.replace("#include <common>", `#include <common>
attribute float aWall; uniform float uWallH[${NW}]; uniform float uT; varying float vWallH; varying vec3 vWP;
${o.floor ? "attribute vec4 aPat; varying vec4 vPat; varying vec2 vLuv;" : ""}${o.glass ? `attribute float aRoom; uniform float uRoomLit[${NR}]; varying float vLit;` : ""}`);
      if (o.sway) v = v.replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
#else
  float ph = 0.0;
#endif
  float sw = max(position.y - 1.0, 0.0) * 0.018;
  transformed.x += sin(uT * 1.1 + ph) * sw; transformed.z += cos(uT * 0.83 + ph * 1.3) * sw;`);
      v = v.replace("#include <project_vertex>", `#include <project_vertex>
  vWallH = uWallH[int(aWall + 0.5)];
  vec4 cpw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cpw = instanceMatrix * cpw;
#endif
  vWP = (modelMatrix * cpw).xyz;${o.floor ? " vPat = aPat; vLuv = uv;" : ""}${o.glass ? " vLit = uRoomLit[int(aRoom + 0.5)];" : ""}`);
      f = f.replace("#include <common>", `#include <common>
uniform float uT; uniform float uNight; varying float vWallH; varying vec3 vWP;
${o.floor ? "varying vec4 vPat; varying vec2 vLuv;" + NOISE : ""}${o.glass ? "varying float vLit;" : ""}`);
      f = f.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (vWP.y > vWallH) discard;");
      if (o.cap) f = f.replace("#include <color_fragment>", "#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.05, 0.04, 0.034);");
      if (o.floor) f = f.replace("#include <color_fragment>", "#include <color_fragment>\n" + FLOOR);
      if (o.emis) f = f.replace("#include <color_fragment>", "").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance = vColor;");
      if (o.glass) f = f.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance = mix(vec3(0.03, 0.06, 0.12), vec3(1.0, 0.6, 0.28), vLit) * uNight * 0.9;");
      if (o.water) f = f.replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
  normal = normalize(normal + vec3(sin(vWP.x * 7.0 + uT * 1.9) * 0.07 + sin(vWP.z * 11.0 - uT * 1.3) * 0.05, 0.0, cos(vWP.z * 8.0 + uT * 1.6) * 0.07 + sin((vWP.x + vWP.z) * 5.0 + uT) * 0.04));`);
      sh.vertexShader = v; sh.fragmentShader = f;
    };
    mat.customProgramCacheKey = () => "cpw:" + key;
    return mat;
  }
  const MATS = {};
  const std = (key, p, o) => MATS[key] || (MATS[key] = hook(new T.MeshStandardMaterial(p), key, o));
  const basic = (key, p) => MATS[key] || (MATS[key] = hook(new T.MeshBasicMaterial(p), key, {}));

  // a bucket gathers non-indexed triangles (position, normal, colour, uv, wall index, pattern)
  const bucket = (pat) => ({ P: [], N: [], C: [], UV: [], WL: [], PT: pat ? [] : null, I: [], n: 0 });
  const V3 = [0, 0, 0], N3 = [0, 0, 0];
  const tp = (m, x, y, z) => { const e = m.elements; V3[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; V3[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; V3[2] = e[2] * x + e[6] * y + e[10] * z + e[14]; return V3; };
  const tn = (m, x, y, z) => { const e = m.elements, a = e[0] * x + e[4] * y + e[8] * z, b = e[1] * x + e[5] * y + e[9] * z, c = e[2] * x + e[6] * y + e[10] * z, l = Math.hypot(a, b, c) || 1; N3[0] = a / l; N3[1] = b / l; N3[2] = c / l; return N3; };
  function vert(b, m, x, y, z, nx, ny, nz, c, u, v, wall, pat) {
    const p = tp(m, x, y, z); b.P.push(p[0], p[1], p[2]);
    const n = tn(m, nx, ny, nz); b.N.push(n[0], n[1], n[2]);
    b.C.push(c[0], c[1], c[2]); b.UV.push(u, v); b.WL.push(wall || 0);
    if (b.PT) b.PT.push(pat ? pat[0] : 0, pat ? pat[1] : 0, pat ? pat[2] : 0, pat ? pat[3] : 0);
    return b.n++;
  }
  const fan = (b, base, n) => { for (let i = 1; i < n - 1; i++) b.I.push(base, base + i, base + i + 1); };
  // the 26 polygons of a chamfered box (6 faces, 12 edges, 8 corners), counter-clockwise from outside
  const CBT = (() => {
    const out = [], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const d = [dx, dy, dz], fixed = [0, 1, 2].filter((k) => d[k]), free = [0, 1, 2].filter((k) => !d[k]);
      if (!fixed.length) continue;
      const combos = free.length === 2 ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : free.length === 1 ? [[1], [-1]] : [[]];
      const vs = [];
      for (const cb of combos) for (const i of fixed) {
        const v = [0, 0, 0, 0, 0, 0];
        free.forEach((k, j) => { v[2 * k] = cb[j]; v[2 * k + 1] = 1; });
        fixed.forEach((k) => { v[2 * k] = d[k]; v[2 * k + 1] = k === i ? 0 : 1; });
        vs.push(v);
      }
      const P = vs.map((v) => [0, 1, 2].map((k) => v[2 * k] * (1 - v[2 * k + 1] * 0.2)));
      const c = [0, 1, 2].map((k) => P.reduce((s, p) => s + p[k], 0) / P.length);
      const l = Math.sqrt(fixed.length), n = d.map((x) => x / l);
      const t1 = abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]), t2 = cross(n, t1);
      const ang = P.map((p) => { const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return Math.atan2(dot(q, t2), dot(q, t1)); });
      out.push({ d, n, k: fixed.length, v: vs.map((v, i) => i).sort((a, b) => ang[a] - ang[b]).map((i) => vs[i]) });
    }
    return out;
  })();
  // a box centred on m: o.e chamfer; face colours o.top / o.bot (false = no face) / o.x / o.z; o.wall
  function box(b, m, w, h, d, col, o = {}) {
    const e = o.e ? min(o.e, w / 2.5, h / 2.5, d / 2.5) : 0, H = [w / 2, h / 2, d / 2], base = lin(col);
    for (const poly of CBT) {
      if (!e && poly.k > 1) continue;
      const [dx, dy, dz] = poly.d;
      let c = base;
      if (poly.k === 1) {
        const f = dy > 0 ? o.top : dy < 0 ? (o.bot === true ? undefined : o.bot ?? false) : dx ? (dx > 0 ? o.px : o.nx) ?? o.x : (dz > 0 ? o.pz : o.nz) ?? o.z;
        if (f === false) continue;
        if (f !== undefined && f !== null) c = lin(f);
      } else if (dy < 0 && o.bot !== true && typeof o.bot !== "number") continue;
      const b0 = b.n;
      for (const v of poly.v) vert(b, m, v[0] * (H[0] - v[1] * e), v[2] * (H[1] - v[3] * e), v[4] * (H[2] - v[5] * e), poly.n[0], poly.n[1], poly.n[2], c, 0, 0, o.wall);
      fan(b, b0, poly.v.length);
    }
  }
  // any three.js geometry (cached as a non-indexed prototype); o.s = [sx, sy, sz] scale, o.cf(x, y, z) per-vertex colour
  const PROTO = {};
  const proto = (key, make) => {
    if (!PROTO[key]) {
      const g = make();
      PROTO[key] = { p: g.attributes.position.array, n: g.attributes.normal.array, uv: g.attributes.uv ? g.attributes.uv.array : null, idx: g.index ? g.index.array : null };
      g.dispose();
    }
    return PROTO[key];
  };
  function geo(b, m, pr, col, o = {}) {
    const c0 = lin(col), s = o.s || [1, 1, 1], P = pr.p, Nn = pr.n, base = b.n, flip = s[0] * s[1] * s[2] < 0;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i] * s[0], y = P[i + 1] * s[1], z = P[i + 2] * s[2];
      const c = o.cf ? o.cf(P[i], P[i + 1], P[i + 2], i / 9 | 0) : c0;
      vert(b, m, x, y, z, Nn[i] / s[0], Nn[i + 1] / s[1], Nn[i + 2] / s[2], c, pr.uv ? pr.uv[i / 3 * 2] : 0, pr.uv ? pr.uv[i / 3 * 2 + 1] : 0, o.wall, o.pat);
    }
    const n = P.length / 3;
    if (pr.idx) for (let i = 0; i < pr.idx.length; i += 3) flip ? b.I.push(base + pr.idx[i], base + pr.idx[i + 2], base + pr.idx[i + 1]) : b.I.push(base + pr.idx[i], base + pr.idx[i + 1], base + pr.idx[i + 2]);
    else for (let i = 0; i < n; i += 3) flip ? b.I.push(base + i, base + i + 2, base + i + 1) : b.I.push(base + i, base + i + 1, base + i + 2);
  }
  // a flat quad in the local xy plane facing +z (u, v map the texture rect [u0, v0, u1, v1])
  function quad(b, m, w, h, col, uvr, o = {}) {
    const c = lin(col), [u0, v0, u1, v1] = uvr || [0, 0, 1, 1], x = w / 2, y = h / 2;
    const base = b.n;
    for (const [px, py, u, v] of [[-x, -y, u0, v0], [x, -y, u1, v0], [x, y, u1, v1], [-x, y, u0, v1]]) vert(b, m, px, py, 0, 0, 0, 1, c, u, v, o.wall, o.pat);
    fan(b, base, 4);
  }
  // a horizontal floor rectangle (y up), with a pattern; uv runs 0..1 over the rect (rugs use it)
  function floorRect(b, x0, z0, x1, z1, y, col, pat) {
    const c = lin(col), M = IDM;
    const base = b.n;
    for (const [x, z, u, v] of [[x0, z1, 0, 0], [x1, z1, 1, 0], [x1, z0, 1, 1], [x0, z0, 0, 1]]) vert(b, M, x, y, z, 0, 1, 0, c, u, v, 0, pat);
    fan(b, base, 4);
  }
  let IDM = null;
  function toGeometry(b) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(b.P, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(b.N, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(b.C, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(b.UV, 2));
    g.setAttribute("aWall", new T.Float32BufferAttribute(b.WL, 1));
    if (b.PT) g.setAttribute("aPat", new T.Float32BufferAttribute(b.PT, 4));
    g.setIndex(b.n > 65535 ? new T.Uint32BufferAttribute(b.I, 1) : new T.Uint16BufferAttribute(b.I, 1));
    return g;
  }

  // ---- 8. the item frame: parts are placed in the item's local space
  let FR = null, TMP = null, LOC = null, QT = null, EU = null, VA = null, VB = null;
  let CUR = null; // the current zone's buckets {m, g}
  let WALLI = 0;  // the wall index of the item being built (0 = free standing)
  const L = (x, y, z, ry = 0, rx = 0, rz = 0) => { EU.set(rx, ry, rz, "YXZ"); QT.setFromEuler(EU); LOC.compose(VA.set(x, y, z), QT, VB.set(1, 1, 1)); return TMP.multiplyMatrices(FR, LOC); };
  const bucketOf = (k) => (k === "g" ? CUR.g : k === "e" ? B.glow : k === "w" ? B.walls : CUR.m);
  // bx(w, h, d, x, y, z, colour, o): a box by its centre, local to the item
  const bx = (w, h, d, x, y, z, col, o = {}) => box(bucketOf(o.b), L(x, y, z, o.ry, o.rx, o.rz), w, h, d, col, Object.assign({ wall: WALLI }, o));
  const cyl = (rt, rb, h, x, y, z, col, o = {}) => { const sg = o.seg || (max(rt, rb) < 0.06 ? 6 : 10); return geo(bucketOf(o.b), L(x, y, z, o.ry, o.rx, o.rz), proto(`c${rt}:${rb}:${h}:${sg}:${o.open ? 1 : 0}`, () => new T.CylinderGeometry(rt, rb, h, sg, 1, !!o.open)), col, Object.assign({ wall: WALLI }, o)); };
  const ball = (r, x, y, z, col, o = {}) => geo(bucketOf(o.b), L(x, y, z, o.ry, o.rx, o.rz), proto(`s${o.det ?? 1}`, () => new T.IcosahedronGeometry(1, o.det ?? 1)), col, Object.assign({ wall: WALLI, s: [r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1)] }, o));
  const lathe = (key, pts, x, y, z, col, o = {}) => geo(bucketOf(o.b), L(x, y, z, o.ry, o.rx, o.rz), proto("l" + key, () => new T.LatheGeometry(pts.map(([a, b]) => new T.Vector2(a, b)), o.seg || 16)), col, Object.assign({ wall: WALLI }, o));
  const torus = (r, t, x, y, z, col, o = {}) => geo(bucketOf(o.b), L(x, y, z, o.ry, o.rx, o.rz), proto(`t${r}:${t}:${o.arc || 6.2832}`, () => new T.TorusGeometry(r, t, 6, 20, o.arc || 2 * PI)), col, Object.assign({ wall: WALLI }, o));

  // ---- 9. palettes
  const K = {
    walnut: 0x5a3a26, dark: 0x3b281b, oak: 0xa97c50, pine: 0xc99d6b, white: 0xeeebe4, black: 0x1f2226, steel: 0x8c949b,
    chrome: 0xc9cfd5, brass: 0xb8913a, cream: 0xefe6d4, marble: 0xe8e3da, terra: 0xb5603e, leather: 0x6a3b26, stone: 0xd8cebd,
    iron: 0x2a2e2c, ivy: 0x2f4a33, paper: 0xf4f1e8, screen: 0x0d1620, plant: 0x3f7a45, soil: 0x3b2b20,
  };
  const SPINES = [0x8c2f39, 0x2a5f9e, 0xd9a441, 0x3c6e47, 0x6b4c9a, 0xc8653a, 0x1f4e5f, 0xb5523b, 0xe8dcc0, 0x2b2b2b, 0x7a8f3a, 0x9c6b3e];
  const WALLCOL = {
    presidenza: [0xe8d7bd, 0x6e4a33], riunione: [0xdfe6e3, 0x8fa3a6], trading: [0xd5dbe0, 0x4f5862], biblioteca: [0xefe1c3, 0x6d4630],
    mensa: [0xf3ddbd, 0xe9ece5], palestra: [0xdde9de, 0x6f98b8], corridoio: [0xf0e5cf, 0xb3714f], portico: [0xeedfc2, 0xc7b08d],
    out: [0xeedfc2, 0xc7b08d],
  };
  KEYS.forEach((k) => { WALLCOL["dorm_" + k] = [mixHex(0xf3ede2, C.COLORS[k], 0.13), mixHex(0xd8c8b2, C.COLORS[k], 0.3)]; });
  const B = {}; // the global buckets, created in build()

  // ---- 10. what build() collects besides the buckets
  let INST = {};          // instanced items: kind -> [{m, c}]
  const LAMPS = [];       // {x, y, z, room, wall, kind, glow: [kind, index], pool: [y, r, k], level, target}
  const AO = [];          // contact shadows: [x, y, z, sx, sz, ry, strength, falloff]
  const SURFM = [];       // the canvas surface meshes to create: {name, w, h, m (Matrix4), wall, uv?}
  const CLOCKS = [];      // {x, y, z, r, tz, rad, wall}
  const inst = (kind, m, c, extra) => { (INST[kind] = INST[kind] || []).push(Object.assign({ m: m.clone(), c }, extra)); return INST[kind].length - 1; };
  const wpt = (x, y, z) => { const p = tp(L(x, y, z), 0, 0, 0); return { x: p[0], y: p[1], z: p[2] }; };
  const ao = (x, z, sx, sz, k = 0.45, f = 0.35, y = 0.004) => { const p = wpt(x, y, z); AO.push([p.x, p.y, p.z, sx, sz, CUR_R, k, f]); };
  let CUR_R = 0, RND = Math.random;
  const surf = (name, w, h, x, y, z, o = {}) => SURFM.push(Object.assign({ name, w, h, m: L(x, y, z).clone(), wall: WALLI }, o));
  // a lamp: its glowing part (an instanced shade or globe), its pool of light and where a point light may sit
  const lampAt = (kind, room, glow, lx, ly, lz, sc, pool, o = {}) => {
    const p = wpt(lx, ly, lz);
    const m = L(lx, ly, lz, o.ry || 0, o.rx || 0).clone().scale(new T.Vector3(sc[0], sc[1], sc[2]));
    const lampIx = LAMPS.length;
    const gi = inst(glow, m, 0, { lamp: lampIx, wall: WALLI });
    const pp = pool ? wpt(pool[3] || lx, pool[0], pool[4] ?? lz) : null;
    LAMPS.push({ x: p.x, y: p.y, z: p.z, room, wall: WALLI, kind, glow: [glow, gi], pool: pool ? [pp.x, pp.y, pp.z, pool[1], pool[2]] : null, level: 0, target: 0, warm: o.warm || 0xffc98a, power: o.power || 1 });
  };

  // ---- 11. the builders, one per item type (local space: +z is the item's front, y up, metres)
  const WOOD = { preside: K.walnut, falco: 0xe9e7e2, tartaruga: K.pine, spazzino: 0x7d8790, ragioniere: K.oak, guardiano: 0x3d4b4e, cronista: 0x5d7a5a, scettico: 0x2c2b30 };
  const books = (x0, x1, y, zBack, maxH, depthMax = 0.22, o = {}) => {
    let x = x0;
    while (x < x1 - 0.03) {
      const r = RND();
      if (r < 0.07 && !o.full) { x += 0.06 + RND() * 0.12; continue; }
      if (r < 0.11 && maxH > 0.12) { // a small stack lying flat
        let yy = y; const n = 2 + (RND() * 3 | 0), dw = 0.2 + RND() * 0.06;
        if (x + dw > x1) break;
        for (let i = 0; i < n; i++) { const t = 0.03 + RND() * 0.02; inst("book", L(x + dw / 2, yy + t / 2, zBack + 0.11, RND() * 0.2 - 0.1).clone().scale(new T.Vector3(dw, t, 0.15 + RND() * 0.05)), SPINES[RND() * SPINES.length | 0]); yy += t; }
        x += dw + 0.02; continue;
      }
      const t = 0.03 + RND() * 0.038, h = min(maxH, 0.17 + RND() * 0.13), d = min(depthMax, 0.14 + RND() * 0.08);
      if (x + t > x1) break;
      const lean = r > 0.96 ? 0.18 : 0;
      inst("book", L(x + t / 2 + lean * h * 0.5, y + h / 2, zBack + d / 2 + 0.01, 0, 0, -lean).clone().scale(new T.Vector3(t, h, d)), SPINES[RND() * SPINES.length | 0]);
      x += t + 0.002 + lean * h;
    }
  };
  const pot = (x, y, z, r, h, col = K.terra) => {
    lathe(`pot${r}:${h}`, [[0, 0], [r * 0.72, 0], [r, h * 0.92], [r * 1.06, h], [r * 0.95, h], [r * 0.9, h * 0.9]], x, y, z, col, { seg: 14 });
    cyl(r * 0.92, r * 0.92, 0.01, x, y + h * 0.88, z, K.soil, { seg: 12 });
  };
  const foliage = (x, y, z, s, v) => {
    const g = [0x3f7a45, 0x4d8a4c, 0x2f6a3e, 0x5a9150, 0x37703f];
    if (v === 1) { // a ficus: a thin trunk and clustered leaves
      cyl(0.018 * s, 0.025 * s, 0.9 * s, x, y + 0.45 * s, z, 0x6b5135);
      for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.12 * s + (i % 3) * 0.05 * s; ball((0.17 + (i % 3) * 0.03) * s, x + cos(a) * r, y + (0.75 + (i % 4) * 0.16) * s, z + sin(a) * r, g[i % 5], { sy: 0.85, det: s < 0.8 ? 0 : 1 }); }
    } else if (v === 2) { // big leaves fanning out
      for (let i = 0; i < 8; i++) { const a = i * 0.79; ball(0.2 * s, x + cos(a) * 0.17 * s, y + (0.3 + (i % 3) * 0.14) * s, z + sin(a) * 0.17 * s, g[(i + 2) % 5], { sx: 1.25, sy: 0.32, sz: 0.7, ry: a, rz: 0.4, det: s < 0.8 ? 0 : 1 }); }
    } else { // a round bush
      for (let i = 0; i < 4; i++) { const a = i * 1.6; ball(0.21 * s, x + cos(a) * 0.09 * s, y + (0.22 + (i % 2) * 0.1) * s, z + sin(a) * 0.09 * s, g[i % 5], { det: s < 0.8 ? 0 : 1 }); }
    }
  };
  const chair = (e, proto) => { inst("ch_" + proto, L(0, 0, 0), e.tint || 0xffffff); ao(0, 0, 0.62, 0.62, 0.35, 0.25); };
  const BUILD = {
    otable() {
      geo(CUR.g, L(0, 0.745, 0), proto("ellT", () => new T.CylinderGeometry(1, 1, 0.05, 56)), 0x6b4228, { s: [1.75, 1, 1.05] });
      geo(CUR.m, L(0, 0.705, 0), proto("ellE", () => new T.CylinderGeometry(1, 1, 0.035, 48)), 0x3f2617, { s: [1.66, 1, 0.97] });
      for (const x of [-0.85, 0.85]) { cyl(0.1, 0.14, 0.66, x, 0.36, 0, 0x3f2617, { seg: 16 }); bx(0.72, 0.05, 0.36, x, 0.025, 0, 0x3f2617, { e: 0.015 }); }
      cyl(0.045, 0.06, 0.22, 0, 0.88, 0, 0xb9d6e0, { b: "g", seg: 14 });
      for (const [x, z] of [[-0.3, 0.12], [0.32, -0.14], [0.12, 0.26], [-0.15, -0.25]]) cyl(0.03, 0.025, 0.09, x, 0.815, z, 0xd5e8ee, { b: "g", seg: 10 });
      ao(0, 0, 4.0, 2.6, 0.55, 0.7);
    },
    pad(e) {
      if (e.k === "preside") { bx(0.26, 0.045, 0.34, 0, 0.792, 0, 0x8c1f2b, { e: 0.008 }); return; }
      bx(0.21, 0.008, 0.29, 0, 0.774, 0, K.paper); cyl(0.005, 0.005, 0.14, 0.13, 0.78, 0, 0x1a1a1a, { rz: HP, seg: 6 });
    },
    chair(e) { chair(e, e.kind === "cafe" || e.kind === "student" ? "shell" : "wood"); },
    ochair(e) { chair(e, "office"); },
    exec(e) { e.tint = 0x5a2e1e; chair(e, "exec"); },
    armchair(e) { chair(e, "arm"); },
    chalkboard() {
      bx(5.6, 1.85, 0.05, 0, 1.95, 0.025, K.oak, { e: 0.012, bot: false });
      bx(5.3, 0.035, 0.09, 0, 1.03, 0.07, K.oak);
      for (let i = 0; i < 5; i++) bx(0.07, 0.012, 0.012, -2.2 + i * 0.13, 1.055, 0.07, i % 2 ? 0xf4f1e6 : 0xf1e39a);
      bx(0.14, 0.04, 0.05, 2.1, 1.07, 0.07, 0x3d3a36);
      surf("board", 5.3, 1.66, 0, 1.95, 0.052);
      bx(6.75, 0.27, 0.05, 0, 3.03, 0.025, 0x121519, { e: 0.01 });
      surf("ticker", 6.6, 0.206, 0, 3.03, 0.052);
    },
    console() {
      bx(1.0, 0.92, 0.5, 0, 0.46, -0.06, 0x2b3138, { e: 0.025, bot: false });
      bx(0.8, 0.018, 0.01, 0, 0.82, 0.192, 0x39d98a, { b: "e" });
      bx(0.62, 0.03, 0.26, 0, 0.935, 0.1, 0x22272d, { e: 0.008 });
      cyl(0.035, 0.035, 0.36, 0, 1.08, -0.12, K.steel);
      bx(1.22, 0.78, 0.06, 0, 1.32, 0.04, 0x15181c, { e: 0.015 });
      surf("motore", 1.12, 0.7, 0, 1.32, 0.072);
      ao(0, 0, 1.3, 0.8, 0.5, 0.35);
    },
    shelf(e) {
      const h = e.h || 2.2, w = e.w, d = e.d, wood = e.room === "biblioteca" ? 0x5e3b25 : e.room === "presidenza" ? 0x4a2d1d : K.walnut;
      bx(0.03, h, d, -w / 2 + 0.015, h / 2, 0, wood, { bot: false }); bx(0.03, h, d, w / 2 - 0.015, h / 2, 0, wood, { bot: false });
      bx(w, 0.04, d + 0.02, 0, h - 0.02, 0.01, wood, { e: 0.008 });
      bx(w - 0.06, 0.09, d - 0.02, 0, 0.045, 0.01, mixHex(wood, 0x000000, 0.25), { bot: false });
      bx(w - 0.06, h - 0.1, 0.015, 0, h / 2 + 0.02, -d / 2 + 0.008, mixHex(wood, 0x000000, 0.35));
      const n = max(3, Math.round((h - 0.12) / 0.36)), step = (h - 0.12) / n;
      for (let i = 0; i < n; i++) {
        const y = 0.09 + i * step;
        if (i) bx(w - 0.06, 0.022, d - 0.03, 0, y, 0, wood);
        const r = RND();
        if (r < 0.12) { lathe("vase", [[0, 0], [0.05, 0], [0.07, 0.08], [0.04, 0.18], [0.045, 0.2]], -w / 2 + 0.2, y + 0.011, 0, [0x2a5f9e, 0xb5603e, 0xe8dcc0][i % 3], { b: "g" }); books(-w / 2 + 0.34, w / 2 - 0.04, y + 0.011, -d / 2 + 0.02, step - 0.04); }
        else books(-w / 2 + 0.04, w / 2 - 0.04, y + 0.011, -d / 2 + 0.02, step - 0.04);
      }
      ao(0, 0.05, w + 0.1, d + 0.25, 0.5, 0.3);
    },
    cabinet(e) {
      const h = e.h || 0.85;
      bx(e.w, h - 0.08, e.d, 0, (h - 0.08) / 2 + 0.08, 0, K.walnut, { e: 0.015 });
      for (const x of [-e.w / 2 + 0.06, e.w / 2 - 0.06]) for (const z of [-e.d / 2 + 0.06, e.d / 2 - 0.06]) bx(0.04, 0.08, 0.04, x, 0.04, z, K.dark);
      for (let i = 1; i < 3; i++) bx(0.006, h - 0.16, 0.004, -e.w / 2 + i * e.w / 3, h / 2 + 0.04, e.d / 2 + 0.001, K.dark);
      if (e.top === "coffee") {
        cyl(0.07, 0.07, 0.3, -0.6, h + 0.15, 0, K.chrome, { b: "g" }); cyl(0.02, 0.02, 0.04, -0.6, h + 0.32, 0, K.black);
        bx(0.5, 0.015, 0.3, 0.05, h + 0.008, 0, K.dark);
        for (let i = 0; i < 4; i++) cyl(0.035, 0.03, 0.08, -0.1 + (i % 2) * 0.1, h + 0.055, -0.06 + (i >> 1) * 0.12, K.white, { b: "g", seg: 10 });
        pot(0.75, h, 0, 0.1, 0.16, 0xe8e2d6); foliage(0.75, h + 0.12, 0, 0.6, 0);
      }
      ao(0, 0, e.w + 0.1, e.d + 0.2, 0.45, 0.25);
    },
    plant(e) {
      const s = e.s || 1, r = 0.16 * s + 0.04, h = 0.32 * s;
      pot(0, 0, 0, r, h, e.room && e.room.startsWith("dorm") ? 0xe6dfd2 : K.terra);
      foliage(0, h * 0.85, 0, s * 1.05, e.v ?? 0);
      ao(0, 0, r * 2.6, r * 2.6, 0.4, 0.25);
    },
    flamp(e) {
      cyl(0.16, 0.18, 0.03, 0, 0.015, 0, K.black, { seg: 16 }); cyl(0.013, 0.013, 1.5, 0, 0.78, 0, K.brass);
      lampAt("flamp", e.room, "shade", 0, 1.56, 0, [1, 1, 1], [0.006, 1.9, 0.75]);
    },
    banker(e) {
      cyl(0.07, 0.08, 0.02, 0, 0.76, 0, K.brass, { seg: 12 }); cyl(0.008, 0.008, 0.28, 0, 0.9, 0, K.brass);
      geo(CUR.g, L(0, 1.04, 0, 0, 0, HP), proto("bank", () => new T.CylinderGeometry(0.075, 0.075, 0.26, 14, 1, true, 0, PI)), 0x1d5a3a, {});
      lampAt("banker", e.room, "globe", 0, 1.0, 0, [0.1, 0.022, 0.022], [0.77, 0.55, 0.6], { warm: 0xffd8a0 });
    },
    candle(e) {
      cyl(0.03, 0.035, 0.07, 0, 0.775, 0, 0xd9c7a0, { b: "g", seg: 10 });
      lampAt("candle", e.room, "globe", 0, 0.83, 0, [0.022, 0.03, 0.022], [0.76, 0.45, 0.45], { warm: 0xffb060, power: 0.6 });
    },
    sconce(e) {
      bx(0.12, 0.2, 0.03, 0, e.y, 0.015, K.brass);
      cyl(0.012, 0.012, 0.12, 0, e.y + 0.02, 0.07, K.brass, { rx: HP });
      lampAt("sconce", e.room, "shade", 0, e.y + 0.1, 0.14, [0.5, 0.5, 0.5], [0.006, 1.4, 0.55], { rx: PI });
    },
    lantern(e) {
      bx(0.06, 0.25, 0.03, 0, e.y + 0.1, 0.015, K.iron);
      bx(0.03, 0.03, 0.2, 0, e.y + 0.2, 0.1, K.iron);
      bx(0.22, 0.05, 0.22, 0, e.y + 0.18, 0.2, K.iron, { e: 0.01 });
      bx(0.16, 0.03, 0.16, 0, e.y - 0.12, 0.2, K.iron);
      for (const [x, z] of [[-0.08, 0.12], [0.08, 0.12], [-0.08, 0.28], [0.08, 0.28]]) bx(0.012, 0.28, 0.012, x, e.y + 0.02, z, K.iron);
      lampAt("lantern", e.room, "globe", 0, e.y + 0.02, 0.2, [0.07, 0.11, 0.07], [0.006, 2.0, 0.7, 0, 0.9], { warm: 0xffc070 });
    },
    post(e) {
      cyl(0.09, 0.12, 0.35, 0, 0.175, 0, K.ivy, { seg: 10 }); cyl(0.04, 0.05, 2.5, 0, 1.6, 0, K.ivy, { seg: 10 });
      cyl(0.09, 0.05, 0.1, 0, 2.86, 0, K.ivy, { seg: 10 });
      lampAt("post", e.room, "globe", 0, 3.06, 0, [0.17, 0.2, 0.17], [0.006, 3.0, 0.8], { warm: 0xffd090, power: 1.3 });
      ao(0, 0, 0.5, 0.5, 0.4, 0.2);
    },
    blamp(e) {
      lathe("blb", [[0, 0], [0.06, 0], [0.08, 0.08], [0.05, 0.2], [0.02, 0.22]], 0, 0.5, 0, 0xd8cdb8, { b: "g", seg: 12 });
      lampAt("blamp", e.room, "shade", 0, 0.8, 0, [0.6, 0.55, 0.6], [0.505, 0.6, 0.6]);
    },
    dlamp(e) {
      cyl(0.07, 0.08, 0.02, 0, 0.76, 0, K.black, { seg: 12 });
      bx(0.018, 0.34, 0.018, 0, 0.92, 0, K.black, { rz: 0.25 }); bx(0.018, 0.26, 0.018, -0.12, 1.12, 0, K.black, { rz: -0.9 });
      lampAt("dlamp", e.room, "shade", -0.23, 1.15, 0, [0.42, 0.38, 0.42], [0.76, 0.55, 0.6, -0.2], { rx: 0, ry: 0 });
    },
    night(e) {
      lampAt("night", e.room, "globe", 0, 0.08, 0, [0.07, 0.06, 0.07], [0.005, 0.7, 0.4], { warm: 0x9fd4ff, power: 0.25 });
      bx(0.12, 0.03, 0.12, 0, 0.015, 0, K.white, { e: 0.01 });
    },
    tdesk(e) {
      const w = e.w, col = C.COLORS[e.k];
      bx(w, 0.035, 0.8, 0, 0.735, 0, 0xe7e5e0, { e: 0.01 });
      for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) { bx(0.06, 0.7, 0.06, x, 0.37, 0, 0x2c3035); bx(0.06, 0.04, 0.72, x, 0.02, 0, 0x2c3035); }
      bx(w - 0.3, 0.06, 0.1, 0, 0.62, -0.3, 0x2c3035);
      bx(0.2, 0.42, 0.42, w / 2 - 0.25, 0.21, -0.06, 0x1d2024, { e: 0.01 });
      bx(0.008, 0.008, 0.005, w / 2 - 0.25, 0.38, 0.152, 0x4fe39a, { b: "e" });
      const mons = e.k === "guardiano" ? [[-0.62, 0.3, "guardianoA"], [0, 0, "guardianoB"], [0.62, -0.3, "risk"]] : [[-0.36, 0.18, e.k + "A"], [0.36, -0.18, e.k + "B"]];
      for (const [x, ry, cell] of mons) {
        inst("monitor", L(x, 0.755, -0.24, ry), 0xffffff);
        const m = L(x, 1.105, -0.24, ry).clone().multiply(new T.Matrix4().makeTranslation(0, 0, 0.0175));
        if (cell === "risk") { for (let i = 0; i < 5; i++) quad(B.glow, m.clone().multiply(new T.Matrix4().makeTranslation(-0.22 + i * 0.11, -0.12 + [0.08, 0.14, 0.05, 0.18, 0.1][i] / 2, 0.001)), 0.07, [0.08, 0.14, 0.05, 0.18, 0.1][i] * 1.6, [0x3bd16f, 0xe9b949, 0x3bd16f, 0xe0524f, 0x3bd16f][i]); quad(B.glow, m, 0.62, 0.38, 0x0d1620); }
        else SURFM.push({ name: "mon", cell, w: 0.62, h: 0.385, m, wall: 0 });
      }
      bx(0.44, 0.02, 0.14, 0, 0.765, 0.14, 0x23272c, { e: 0.005 }); bx(0.06, 0.02, 0.1, 0.32, 0.765, 0.15, 0x23272c, { e: 0.008 });
      cyl(0.04, 0.036, 0.1, w / 2 - 0.2, 0.805, 0.18, col, { b: "g", seg: 12 });
      if (e.k === "cronista") { for (let i = 0; i < 4; i++) bx(0.3, 0.01, 0.4, -w / 2 + 0.26, 0.76 + i * 0.012, 0.1, K.paper, { ry: i * 0.12 }); }
      else bx(0.21, 0.006, 0.29, -w / 2 + 0.22, 0.756, 0.16, K.paper, { ry: 0.2 });
      ao(0, 0, w + 0.2, 1.0, 0.45, 0.35);
    },
    pricewall() {
      bx(4.55, 2.35, 0.06, 0, 1.5, 0.03, 0x15181c, { e: 0.015 });
      surf("price", 4.4, 2.2, 0, 1.5, 0.064);
    },
    ledticker() {
      bx(12.9, 0.44, 0.05, 0, 2.94, 0.025, 0x111418, { e: 0.01 });
      surf("ticker", 12.8, 0.4, 0, 2.94, 0.052);
    },
    scoreboard() {
      bx(3.35, 1.75, 0.06, 0, 1.75, 0.03, 0x15181c, { e: 0.015 });
      bx(1.0, 0.05, 0.03, 0, 2.64, 0.04, 0xd8443c, { b: "e" });
      surf("gara", 3.2, 1.6, 0, 1.75, 0.064);
    },
    whiteboard() {
      bx(3.52, 1.82, 0.04, 0, 1.6, 0.02, 0xb9bfc5, { e: 0.01 });
      bx(3.0, 0.03, 0.08, 0, 0.69, 0.06, 0xb9bfc5);
      for (let i = 0; i < 3; i++) cyl(0.01, 0.01, 0.12, -1.2 + i * 0.16, 0.715, 0.06, [0x1d5fd1, 0xd23a30, 0x1a1a1a][i], { rz: HP, seg: 6 });
      surf("palestra", 3.4, 1.7, 0, 1.6, 0.042);
    },
    goalboard() {
      for (const x of [-2.12, 2.12]) { cyl(0.045, 0.05, 2.95, x, 1.475, -0.02, K.ivy, { seg: 10 }); bx(0.3, 0.04, 0.3, x, 0.02, -0.02, K.ivy); }
      bx(4.26, 2.04, 0.08, 0, 1.9, 0, K.ivy, { e: 0.015 });
      bx(4.4, 0.07, 0.2, 0, 2.95, 0, K.ivy, { e: 0.01 });
      surf("goal", 4.0, 1.8, 0, 1.9, 0.042);
      ao(0, 0, 4.4, 0.6, 0.35, 0.3);
    },
    poster(e) {
      const r = POSTER[e.cell] || [0, 0, 1, 1], w = e.w, h = w * r[3] / r[2];
      bx(w + 0.06, h + 0.06, 0.03, 0, e.y, 0.015, e.frame || 0x2b2420, { e: 0.006 });
      SURFM.push({ name: "post", cell: e.cell, w, h, m: L(0, e.y, 0.032).clone(), wall: WALLI });
    },
    plate(e) {
      bx(0.42, 0.13, 0.015, 0, e.y, 0.008, K.brass, { e: 0.004 });
      SURFM.push({ name: "post", cell: "plate" + e.i, w: 0.38, h: 0.095, m: L(0, e.y, 0.0165).clone(), wall: WALLI });
    },
    clock(e) {
      const r = e.w / 2;
      cyl(r, r, 0.025, 0, e.y, 0.012, K.white, { rx: HP, seg: 28 });
      torus(r, 0.018, 0, e.y, 0.02, K.black);
      for (let i = 0; i < 12; i++) { const a = i * PI / 6; bx(0.012, i % 3 ? 0.03 : 0.05, 0.004, sin(a) * r * 0.82, e.y + cos(a) * r * 0.82, 0.027, K.black, { rz: -a }); }
      const p = wpt(0, e.y, 0.03);
      CLOCKS.push({ x: p.x, y: p.y, z: p.z, r: e.r, tz: e.tz, rad: r, wall: WALLI });
      if (e.label) SURFM.push({ name: "post", cell: "clock_" + e.label, w: 0.36, h: 0.09, m: L(0, e.y - r - 0.11, 0.012).clone(), wall: WALLI });
    },
    cooler() {
      bx(0.32, 1.0, 0.32, 0, 0.5, 0, K.white, { e: 0.03, bot: false });
      cyl(0.13, 0.13, 0.36, 0, 1.2, 0, 0x78acd4, { b: "g", seg: 14 });
      bx(0.03, 0.04, 0.03, -0.06, 0.82, 0.17, 0x2a62c9); bx(0.03, 0.04, 0.03, 0.06, 0.82, 0.17, 0xd23a30);
      ao(0, 0, 0.5, 0.5, 0.4, 0.2);
    },
    desk(e) {
      const w = e.w, d = e.d, col = e.c || K.walnut, dk = mixHex(col, 0x000000, 0.3);
      bx(w, 0.04, d, 0, 0.73, 0, col, { e: 0.012 });
      bx(0.03, 0.71, d - 0.04, -w / 2 + 0.03, 0.355, 0, col, { bot: false });
      bx(0.4, 0.71, d - 0.04, w / 2 - 0.22, 0.355, 0, col, { e: 0.01, bot: false });
      for (let i = 0; i < 3; i++) { bx(0.36, 0.2, 0.012, w / 2 - 0.22, 0.13 + 0.225 * i, d / 2 - 0.014, dk); bx(0.1, 0.012, 0.02, w / 2 - 0.22, 0.17 + 0.225 * i, d / 2, K.brass); }
      bx(w - 0.48, 0.4, 0.02, -0.2, 0.5, -d / 2 + 0.04, col);
      if (e.big) {
        bx(0.7, 0.008, 0.45, -0.1, 0.754, 0.08, 0x234a33);
        bx(0.3, 0.05, 0.4, 0.55, 0.775, 0.05, 0x8c1f2b, { e: 0.008, ry: -0.2 });
        cyl(0.04, 0.04, 0.1, -0.75, 0.8, -0.2, K.brass, { seg: 10 });
        bx(0.2, 0.006, 0.28, -0.45, 0.756, 0.15, K.paper, { ry: 0.3 });
        lampAt("banker", e.room, "globe", -0.65, 1.0, -0.15, [0.1, 0.022, 0.022], [0.77, 0.5, 0.5, -0.65, -0.15], { warm: 0xffd8a0 });
        geo(CUR.g, L(-0.65, 1.04, -0.15, 0, 0, HP), proto("bank", () => new T.CylinderGeometry(0.075, 0.075, 0.26, 14, 1, true, 0, PI)), 0x1d5a3a, {});
        cyl(0.008, 0.008, 0.28, -0.65, 0.9, -0.15, K.brass);
      }
      if (e.k) deskProps(e.k, w, d);
      ao(0, 0, w + 0.2, d + 0.3, 0.45, 0.3);
    },
    table(e) {
      const w = e.w, d = e.d, col = e.c || K.walnut;
      bx(w, 0.045, d, 0, 0.73, 0, col, { e: 0.012 });
      bx(w - 0.12, 0.08, d - 0.12, 0, 0.67, 0, mixHex(col, 0x000000, 0.2), { bot: false });
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) bx(0.05, 0.69, 0.05, x, 0.345, z, mixHex(col, 0x000000, 0.2));
      if (e.books) {
        bx(w - 0.16, 0.004, d - 0.16, 0, 0.754, 0, 0x284d36);
        bx(0.36, 0.012, 0.26, -0.1, 0.762, 0.12, K.paper, { ry: 0.08 }); bx(0.012, 0.02, 0.26, -0.1, 0.762, 0.12, 0x6d2f2a, { ry: 0.08 });
        for (let i = 0; i < 3; i++) bx(0.24, 0.035, 0.17, -0.38, 0.77 + i * 0.036, -0.12, SPINES[(i * 5 + (e.x * 3 | 0)) % SPINES.length], { ry: i * 0.15 });
      }
      ao(0, 0, w + 0.3, d + 0.3, 0.45, 0.35);
    },
    rtable() {
      cyl(0.45, 0.45, 0.03, 0, 0.745, 0, K.marble, { b: "g", seg: 28 });
      cyl(0.03, 0.03, 0.72, 0, 0.37, 0, K.black, { seg: 8 }); cyl(0.2, 0.23, 0.03, 0, 0.015, 0, K.black, { seg: 18 });
      cyl(0.04, 0.035, 0.06, -0.1, 0.79, 0.12, K.white, { b: "g", seg: 10 });
      bx(0.08, 0.1, 0.05, 0.1, 0.81, 0.12, K.chrome, { b: "g" });
      cyl(0.02, 0.025, 0.12, -0.05, 0.82, -0.12, 0xbfd8e2, { b: "g", seg: 8 }); ball(0.03, -0.05, 0.9, -0.12, [0xd23a30, 0xe9b949, 0xe58fb4][(RND() * 3) | 0], { det: 0 });
      ao(0, 0, 1.6, 1.6, 0.4, 0.6);
    },
    ctable(e) {
      bx(e.w, 0.04, e.d, 0, 0.42, 0, K.walnut, { e: 0.01 });
      for (const x of [-e.w / 2 + 0.04, e.w / 2 - 0.04]) for (const z of [-e.d / 2 + 0.04, e.d / 2 - 0.04]) bx(0.04, 0.4, 0.04, x, 0.2, z, K.dark);
      for (let i = 0; i < 3; i++) bx(0.22, 0.04, 0.16, 0, 0.46 + i * 0.04, -0.25, SPINES[i * 3], { ry: i * 0.2 });
      cyl(0.045, 0.04, 0.06, 0.05, 0.47, 0.25, K.white, { b: "g", seg: 10 });
      ao(0, 0, e.w + 0.3, e.d + 0.3, 0.4, 0.3);
    },
    sofa(e) {
      const w = e.w, d = e.d, c = e.c || K.leather;
      bx(w, 0.36, d, 0, 0.22, 0, c, { e: 0.05 });
      for (const x of [-w / 4 + 0.02, w / 4 - 0.02]) bx(w / 2 - 0.2, 0.1, d - 0.25, x, 0.44, 0.05, mixHex(c, 0xffffff, 0.06), { e: 0.04 });
      bx(w, 0.45, 0.2, 0, 0.62, -d / 2 + 0.1, c, { e: 0.06 });
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) bx(0.2, 0.62, d, x, 0.34, 0, c, { e: 0.07 });
      ao(0, 0, w + 0.3, d + 0.3, 0.5, 0.3);
    },
    lectern() {
      bx(0.42, 0.04, 0.36, 0, 0.02, 0, K.dark, { e: 0.01 }); bx(0.12, 1.0, 0.12, 0, 0.52, 0, K.walnut);
      bx(0.56, 0.035, 0.44, 0, 1.06, 0, K.walnut, { rx: 0.35, e: 0.01 });
      bx(0.5, 0.035, 0.38, 0, 1.095, -0.01, 0x8c1f2b, { rx: 0.35, e: 0.006 });
      for (const x of [-0.115, 0.115]) bx(0.22, 0.02, 0.34, x, 1.115, -0.02, K.paper, { rx: 0.35, rz: x > 0 ? -0.06 : 0.06 });
      ao(0, 0, 0.6, 0.6, 0.4, 0.2);
    },
    globe() {
      cyl(0.18, 0.2, 0.03, 0, 0.015, 0, K.walnut, { seg: 16 }); cyl(0.025, 0.03, 0.7, 0, 0.38, 0, K.walnut);
      ball(0.22, 0, 0.98, 0, 0x2d6fa3, { det: 2, rz: 0.4, cf: (x, y, z, f) => lin(((f * 7919) % 13) < 4 ? 0x7d9a4e : ((f * 104729) % 11) < 2 ? 0xd9c48a : 0x2d6fa3) });
      torus(0.25, 0.012, 0, 0.98, 0, K.brass, { ry: HP, rz: 0.4 });
      ao(0, 0, 0.5, 0.5, 0.4, 0.2);
    },
    ladder() {
      for (const x of [-0.2, 0.2]) bx(0.04, 2.3, 0.05, x, 1.12, 0.2, K.oak, { rx: -0.2 });
      for (let i = 0; i < 7; i++) bx(0.4, 0.03, 0.04, 0, 0.25 + i * 0.3, 0.2 + 0.2 * (1.12 - 0.25 - i * 0.3) / 1.12 * 0.5, K.oak, { rx: -0.2 });
    },
    counter(e) {
      bx(e.w, 1.0, e.d, 0, 0.5, 0, 0x7b4a2d, { e: 0.02, bot: false });
      for (let i = 0; i < 6; i++) bx(e.w / 6 - 0.06, 0.8, 0.012, -e.w / 2 + (i + 0.5) * e.w / 6, 0.5, e.d / 2 + 0.006, 0x8e5a37, { e: 0.004 });
      bx(e.w + 0.06, 0.05, e.d + 0.14, 0, 1.025, 0.04, K.marble, { e: 0.012, b: "g" });
      cyl(0.02, 0.02, e.w - 0.1, 0, 0.18, e.d / 2 + 0.12, K.chrome, { rz: HP, b: "g" });
      cyl(0.11, 0.11, 0.015, -1.2, 1.06, 0.05, K.chrome, { b: "g", seg: 16 }); lathe("dome", [[0, 0.2], [0.06, 0.19], [0.1, 0.12], [0.11, 0]], -1.2, 1.065, 0.05, 0xe8f2f5, { b: "g" });
      for (let i = 0; i < 6; i++) { cyl(0.05, 0.05, 0.008, -0.3 + i * 0.22, 1.054, 0.18, K.white, { b: "g", seg: 12 }); cyl(0.035, 0.03, 0.06, -0.3 + i * 0.22, 1.09, 0.18, K.white, { b: "g", seg: 10 }); }
      bx(0.1, 0.12, 0.06, 1.3, 1.11, 0.1, K.chrome, { b: "g" });
      ao(0, 0, e.w + 0.3, e.d + 0.5, 0.5, 0.35);
    },
    backbar(e) {
      bx(e.w, 0.9, e.d, 0, 0.45, 0, 0x6a3f27, { e: 0.015, bot: false });
      bx(e.w + 0.02, 0.04, e.d + 0.02, 0, 0.92, 0, K.marble, { b: "g" });
      // the espresso machine
      bx(0.7, 0.42, 0.45, -0.3, 1.15, 0, 0xc9cfd5, { e: 0.04, b: "g" }); bx(0.72, 0.05, 0.47, -0.3, 1.385, 0, 0x8c2f39, { e: 0.015 });
      for (const x of [-0.5, -0.1]) { cyl(0.04, 0.04, 0.08, x, 1.0, 0.25, K.black, { seg: 10 }); cyl(0.012, 0.012, 0.12, x, 1.0, 0.32, K.black, { rx: HP }); }
      for (let i = 0; i < 6; i++) cyl(0.035, 0.03, 0.06, -0.55 + i * 0.1, 1.44, -0.05, K.white, { b: "g", seg: 10 });
      cyl(0.08, 0.06, 0.3, 0.35, 1.09, 0, K.black, { seg: 12 }); cyl(0.09, 0.05, 0.12, 0.35, 1.3, 0, 0x6b4a2b, { seg: 12, b: "g" });
      // the shelves of bottles and jars on the wall behind
      WALLI = wallById["p.presidenza_mensa"].i;
      for (const y of [1.65, 2.05]) {
        bx(e.w - 0.2, 0.03, 0.22, 0, y, -0.15, K.walnut);
        for (let i = 0; i < 14; i++) { const c = [0x3b6e3a, 0x7a2430, 0xd9a441, 0xe8e2d6, 0x2a5f9e][(i * 7 + (y * 10 | 0)) % 5]; cyl(0.035, 0.035, 0.22, -e.w / 2 + 0.25 + i * 0.23, y + 0.125, -0.16, c, { b: "g", seg: 8 }); }
      }
      WALLI = 0;
      ao(0, 0, e.w + 0.2, e.d + 0.3, 0.5, 0.3);
    },
    fridge() {
      bx(0.7, 1.85, 0.62, 0, 0.925, 0, 0xd8dcdf, { e: 0.03, b: "g", bot: false });
      quad(B.glow, L(0, 1.05, 0.312), 0.56, 1.3, 0xbfe3f5);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) cyl(0.03, 0.03, 0.2, -0.22 + i * 0.088, 0.55 + r * 0.33, 0.2, [0xd23a30, 0xe9b949, 0x3bd16f, 0x2a62c9][(r + i) % 4], { b: "e", seg: 6 });
      bx(0.6, 0.12, 0.02, 0, 1.75, 0.315, 0xd8443c, { b: "e" });
      ao(0, 0, 0.9, 0.85, 0.5, 0.25);
    },
    sdesk() {
      bx(1.0, 0.025, 0.6, 0, 0.72, 0, 0xd9cdb5, { e: 0.008 });
      for (const x of [-0.46, 0.46]) for (const z of [-0.26, 0.26]) cyl(0.014, 0.014, 0.71, x, 0.355, z, K.steel, { seg: 6 });
      bx(0.21, 0.004, 0.29, -0.1, 0.735, 0.05, K.paper, { ry: 0.1 }); cyl(0.005, 0.005, 0.14, 0.2, 0.737, 0.05, 0x1d5fd1, { rz: HP, ry: 0.4, seg: 6 });
      ao(0, 0, 1.2, 0.8, 0.35, 0.3);
    },
    treadmill() {
      bx(0.75, 0.14, 1.75, 0, 0.12, -0.05, 0x2a2e33, { e: 0.03 }); bx(0.52, 0.01, 1.55, 0, 0.195, -0.08, 0x151719);
      for (const x of [-0.34, 0.34]) bx(0.05, 1.15, 0.06, x, 0.72, 0.74, 0x3a4047, { rx: -0.15 });
      bx(0.74, 0.2, 0.14, 0, 1.28, 0.82, 0x2a2e33, { rx: 0.5, e: 0.02 });
      bx(0.3, 0.1, 0.006, 0, 1.3, 0.75, 0x5fd0ff, { b: "e", rx: 0.5 });
      ao(0, 0, 1.0, 2.1, 0.45, 0.3);
    },
    rower() {
      bx(0.1, 0.06, 2.1, 0, 0.32, -0.05, K.steel, { e: 0.01 }); bx(0.5, 0.05, 0.08, 0, 0.12, -1.05, K.steel); bx(0.08, 0.3, 0.08, 0, 0.17, -1.05, K.steel);
      cyl(0.26, 0.26, 0.16, 0, 0.42, 0.95, 0x22262b, { rz: HP, seg: 18 });
      bx(0.28, 0.06, 0.3, 0, 0.4, -0.2, 0x111316, { e: 0.02 });
      for (const x of [-0.12, 0.12]) bx(0.12, 0.02, 0.26, x, 0.38, 0.6, 0x111316, { rx: -0.6 });
      cyl(0.015, 0.015, 0.5, 0, 0.6, 0.75, K.black, { rz: HP });
      ao(0, 0, 0.8, 2.4, 0.4, 0.3);
    },
    wallbars(e) {
      WALLI = wallById["e.palestra"].i;
      for (const x of [-1.38, 1.38]) bx(0.08, 2.6, 0.08, x, 1.3, 0, K.pine);
      for (let i = 0; i < 14; i++) cyl(0.017, 0.017, 2.7, 0, 0.2 + i * 0.17, 0, K.pine, { rz: HP, seg: 8 });
      WALLI = 0;
    },
    hoop(e) {
      bx(1.1, 0.68, 0.03, 0, 2.8, 0.3, K.white, { e: 0.01 });
      for (const [w, h, x, y] of [[0.5, 0.025, 0, 2.86], [0.5, 0.025, 0, 2.6], [0.025, 0.28, -0.24, 2.73], [0.025, 0.28, 0.24, 2.73]]) bx(w, h, 0.01, x, y, 0.318, 0xd8443c);
      bx(0.06, 0.06, 0.3, 0, 2.8, 0.15, K.steel);
      torus(0.22, 0.012, 0, 2.58, 0.55, 0xe2662f, { rx: HP });
      cyl(0.21, 0.14, 0.32, 0, 2.42, 0.55, 0xf2f2f2, { open: true, seg: 12 });
    },
    mat(e) { for (const x of [-e.w / 4, e.w / 4]) bx(e.w / 2 - 0.02, 0.04, e.d, x, 0.02, 0, x < 0 ? 0x2f6ea5 : 0x285f90, { e: 0.015 }); },
    balls(e) {
      bx(e.w, 0.04, e.d, 0, 0.3, 0, K.steel); bx(e.w, 0.04, e.d, 0, 0.75, 0, K.steel);
      for (const x of [-e.w / 2 + 0.03, e.w / 2 - 0.03]) bx(0.03, 1.0, 0.03, x, 0.5, 0, K.steel);
      for (let i = 0; i < 4; i++) { ball(0.12, -0.42 + i * 0.28, 0.44, 0, [0xe2662f, 0xf2e8c8, 0x2d6fa3, 0xe2662f][i], { det: 2 }); ball(0.13, -0.42 + i * 0.28, 0.9, 0, [0x3a2f2a, 0x8c2f39, 0x3a2f2a, 0x2f6b4a][i], { det: 1 }); }
      ao(0, 0, e.w + 0.3, e.d + 0.3, 0.4, 0.25);
    },
    weights(e) {
      bx(e.w, 0.05, e.d, 0, 0.42, 0, 0x2a2e33); for (const x of [-0.55, 0.55]) bx(0.05, 0.42, e.d, x, 0.21, 0, 0x2a2e33);
      for (let i = 0; i < 5; i++) { const s = 0.08 + i * 0.012; ball(s, -0.45 + i * 0.22, 0.45 + s, 0, 0x1f2226, { det: 1 }); torus(s * 0.6, 0.015, -0.45 + i * 0.22, 0.45 + 2 * s + 0.02, 0, 0x1f2226, { ry: HP }); }
      ao(0, 0, e.w + 0.3, e.d + 0.3, 0.4, 0.25);
    },
    courtlines(e) {
      const lc = 0xf3f1ea, y = 0.004;
      for (const [w, d, x, z] of [[8.4, 0.05, 0, -9.2], [8.4, 0.05, 0, 9.2], [0.05, 18.4, -4.2, 0], [0.05, 18.4, 4.2, 0], [8.4, 0.05, 0, 0]]) bx(w, 0.008, d, x, y, z, lc, { bot: false });
      torus(1.6, 0.025, 0, 0.0, 0, lc, { rx: HP });
    },
    mirror(e) {
      bx(e.w + 0.06, 1.86, 0.03, 0, e.y, 0.015, 0x3a3f44);
      bx(e.w, 1.8, 0.01, 0, e.y, 0.034, 0xc8d4da, { b: "g" });
    },
    notice(e) {
      bx(e.w, 1.0, 0.03, 0, e.y, 0.015, 0xb98a55, { e: 0.006 });
      for (let i = 0; i < 9; i++) {
        const x = -0.6 + (i % 4) * 0.38 + RND() * 0.06, y = e.y + 0.3 - (i / 4 | 0) * 0.32 + RND() * 0.05;
        quad(CUR.m, L(x, y, 0.032, 0, 0, RND() * 0.2 - 0.1), 0.2 + RND() * 0.08, 0.24, [0xf4f1e8, 0xf6e27a, 0xbfe0f5, 0xf4c6d2][i % 4]);
        ball(0.012, x, y + 0.1, 0.04, [0xd23a30, 0x2a62c9, 0x3bd16f][i % 3], { det: 0 });
      }
    },
    papers(e) {
      for (let s = 0; s < 3; s++) {
        const n = 6 + s * 3, x = -0.18 + s * 0.2, z = (s % 2) * 0.1 - 0.05;
        for (let i = 0; i < n; i++) bx(0.32, 0.012, 0.42, x, 0.006 + i * 0.013, z, i % 3 ? K.paper : 0xe9e2cf, { ry: (RND() - 0.5) * 0.2 });
        SURFM.push({ name: "post", cell: "news", w: 0.3, h: 0.4, m: L(x, 0.014 + n * 0.013, z, 0, -HP).clone(), wall: 0 });
      }
      ao(0, 0, 0.9, 0.7, 0.35, 0.2);
    },
    trophies(e) {
      bx(e.w, e.h, e.d, 0, e.h / 2, 0, 0x6b6f75, { e: 0.015 });
      for (let i = 0; i < 3; i++) {
        const x = -0.45 + i * 0.45, s = [1, 1.3, 0.9][i];
        bx(0.12 * s, 0.05, 0.12 * s, x, e.h + 0.025, 0, K.dark);
        lathe("cup" + i, [[0, 0], [0.04 * s, 0], [0.015 * s, 0.05 * s], [0.015 * s, 0.1 * s], [0.07 * s, 0.14 * s], [0.08 * s, 0.24 * s], [0.07 * s, 0.25 * s]], x, e.h + 0.05, 0, 0xd4a93c, { b: "g" });
      }
      ao(0, 0, e.w + 0.2, e.d + 0.3, 0.4, 0.25);
    },
    broom() {
      cyl(0.014, 0.014, 1.35, 0, 0.72, 0, 0x8a6a45, { rz: 0.18, seg: 6 });
      bx(0.3, 0.2, 0.07, 0.11, 0.1, 0, 0xd9b45a, { rz: 0.18 }); bx(0.3, 0.04, 0.08, 0.1, 0.2, 0, 0xe0662f, { rz: 0.18 });
    },
    chess() {
      bx(0.6, 0.04, 0.6, 0, 0.7, 0, K.walnut, { e: 0.01 }); cyl(0.04, 0.05, 0.68, 0, 0.34, 0, K.walnut); cyl(0.2, 0.22, 0.03, 0, 0.015, 0, K.walnut);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) quad(CUR.m, L(-0.21 + i * 0.06, 0.721, -0.21 + j * 0.06, 0, -HP), 0.06, 0.06, (i + j) % 2 ? 0x2b2420 : 0xe9dfc8);
      for (let i = 0; i < 9; i++) cyl(0.012, 0.016, 0.04 + (i % 3) * 0.015, -0.2 + (i * 37 % 8) * 0.06, 0.74 + (i % 3) * 0.008, -0.2 + (i * 53 % 8) * 0.06, i % 2 ? K.black : K.white, { seg: 8, b: "g" });
      ao(0, 0, 0.7, 0.7, 0.35, 0.2);
    },
    bookpile() {
      for (let s = 0; s < 2; s++) for (let i = 0; i < 5 + s * 2; i++) {
        const x = -0.12 + s * 0.24;
        bx(0.2 + RND() * 0.06, 0.04, 0.15 + RND() * 0.05, x, 0.02 + i * 0.041, 0, SPINES[(i + s * 4) % SPINES.length], { ry: (RND() - 0.5) * 0.5 });
        if (i % 2) bx(0.012, 0.004, 0.1, x + 0.05, 0.04 + i * 0.041, 0.1, [0xd23a30, 0xe9b949, 0x3bd16f][i % 3], { ry: 0.2 });
      }
      ao(0, 0, 0.6, 0.45, 0.35, 0.2);
    },
    dumbbells(e) {
      bx(e.w, 0.04, e.d, 0, 0.3, 0, 0x2a2e33); for (const x of [-0.36, 0.36]) bx(0.04, 0.3, e.d, x, 0.15, 0, 0x2a2e33);
      for (let i = 0; i < 3; i++) { cyl(0.012, 0.012, 0.3, -0.22 + i * 0.22, 0.36, 0, K.chrome, { seg: 6 }); for (const z of [-0.11, 0.11]) cyl(0.045, 0.045, 0.06, -0.22 + i * 0.22, 0.36, z, 0x257de0, { rx: HP, seg: 10 }); }
    },
    binders(e) {
      bx(e.w, e.h, e.d, 0, e.h / 2, 0, K.oak, { e: 0.012 });
      for (let r = 0; r < 2; r++) for (let i = 0; i < 18; i++) {
        const x = -e.w / 2 + 0.07 + i * 0.081, y = 0.08 + r * 0.5;
        bx(0.07, 0.32, 0.28, x, y + 0.16, 0.02, [0xd99400, 0x2a5f9e, 0x8c2f39, 0x3c6e47][(i >> 2) % 4], { e: 0.004 });
        bx(0.04, 0.06, 0.004, x, y + 0.2, 0.162, K.paper);
      }
      bx(e.w - 0.04, 0.02, e.d - 0.02, 0, 0.56, 0, K.oak);
      ao(0, 0, e.w + 0.2, e.d + 0.3, 0.4, 0.25);
    },
    safe() {
      bx(0.6, 0.7, 0.55, 0, 0.35, 0, 0x3b4246, { e: 0.03 }); cyl(0.07, 0.07, 0.03, 0.08, 0.42, 0.285, K.chrome, { rx: HP, b: "g" });
      bx(0.05, 0.16, 0.03, -0.18, 0.4, 0.29, K.chrome, { b: "g" }); ao(0, 0, 0.8, 0.75, 0.45, 0.2);
    },
    lemon() {
      pot(0, 0, 0, 0.28, 0.45);
      cyl(0.03, 0.04, 0.6, 0, 0.7, 0, 0x6b5135, { seg: 6 });
      for (let i = 0; i < 6; i++) { const a = i * 1.1; ball(0.26, cos(a) * 0.14, 1.2 + (i % 2) * 0.16, sin(a) * 0.14, [0x2f5f2f, 0x3a6e35][i % 2]); }
      for (let i = 0; i < 9; i++) { const a = i * 2.1; ball(0.04, cos(a) * 0.32, 1.05 + (i % 3) * 0.15, sin(a) * 0.32, 0xf0c419, { det: 0, b: "g" }); }
      ao(0, 0, 0.9, 0.9, 0.45, 0.3);
    },
    column() { inst("column", L(0, 0, 0), K.stone); ao(0, 0, 0.7, 0.7, 0.4, 0.3); },
    bench() { inst("bench", L(0, 0, 0), 0xffffff); ao(0, 0.05, 1.9, 0.9, 0.4, 0.3); },
    gbench(e) {
      bx(e.w, 0.07, 0.36, 0, 0.42, 0, 0x2f6ea5, { e: 0.03 });
      for (const x of [-e.w / 2 + 0.15, e.w / 2 - 0.15]) { bx(0.04, 0.38, 0.3, x, 0.19, 0, K.steel); }
      ao(0, 0, e.w + 0.2, 0.7, 0.35, 0.25);
    },
    tree(e) { treeAt(e.kind, 0, 0, 1); },
    flowerbed(e) {
      const w = e.w, d = e.d;
      for (const [bw, bd, x, z] of [[w, 0.12, 0, -d / 2], [w, 0.12, 0, d / 2], [0.12, d, -w / 2, 0], [0.12, d, w / 2, 0]]) bx(bw, 0.22, bd, x, 0.11, z, 0xcdbfa6, { e: 0.02 });
      bx(w - 0.12, 0.16, d - 0.12, 0, 0.08, 0, 0x4a3426, { bot: false });
      const cols = [0xd23a30, 0xe9b949, 0x8a5fc8, 0xf4f1e8, 0xe58fb4];
      for (let i = 0; i < 26; i++) {
        const x = (RND() - 0.5) * (w - 0.4), z = (RND() - 0.5) * (d - 0.4);
        ball(0.11 + RND() * 0.05, x, 0.24, z, [0x3f7a45, 0x2f6a3e, 0x4d8a4c][i % 3], { det: 0, sy: 0.7 });
        ball(0.045, x + 0.03, 0.34, z, cols[i % 5], { det: 0 });
      }
    },
    fountain() {
      lathe("fb", [[0, 0.02], [1.38, 0.02], [1.38, 0.36], [1.42, 0.38], [1.62, 0.38], [1.66, 0.44], [1.6, 0.5], [1.48, 0.5], [1.44, 0.46], [1.44, 0.02]], 0, 0, 0, 0xddd2bf, { seg: 40 });
      cyl(2.05, 2.1, 0.04, 0, 0.02, 0, 0xc9bca5, { seg: 40 });
      lathe("fp", [[0, 0], [0.3, 0], [0.28, 0.1], [0.16, 0.2], [0.12, 0.9], [0.16, 1.0], [0.62, 1.05], [0.66, 1.12], [0.6, 1.16], [0.14, 1.12], [0.08, 1.3], [0.12, 1.4], [0.06, 1.52], [0, 1.55]], 0, 0.02, 0, 0xe3d9c6, { seg: 24 });
      geo(B.water, L(0, 0.4, 0), proto("wdisc", () => new T.CircleGeometry(1.42, 40).rotateX(-HP)), 0x3f7f8f, {});
      geo(B.water, L(0, 1.12, 0), proto("wdisc2", () => new T.CircleGeometry(0.58, 24).rotateX(-HP)), 0x3f7f8f, {});
      geo(B.spray, L(0, 0.76, 0), proto("curtain", () => new T.CylinderGeometry(0.6, 0.72, 0.72, 28, 1, true)), 0xe8f6fa, {});
      geo(B.spray, L(0, 1.6, 0), proto("jet", () => new T.ConeGeometry(0.05, 0.3, 8, 1, true)), 0xe8f6fa, {});
      ao(0, 0, 4.2, 4.2, 0.4, 0.6);
    },
    garden() { gardenGround(); },
    dorm(e) { dormDecor(e.k, e.x0); },
    grounds() { groundsBuild(); },
    rug(e) {
      const hx = e.w / 2, hz = e.d / 2;
      floorRect(B.floor, e.x - hx, e.z - hz, e.x + hx, e.z + hz, 0.012, e.c, e.pat ? [e.pat, 0.5, 0.05, 0] : [7, e.c2 || 0xe8dcc0, e.w, e.d]);
    },
  };
  BUILD.nightstand = (e) => {
    const c = WOOD[e.room.slice(5)] || K.oak;
    bx(e.w, 0.5, e.d, 0, 0.25, 0, c, { e: 0.015, bot: false });
    bx(e.w - 0.04, 0.14, 0.01, 0, 0.38, e.d / 2, mixHex(c, 0x000000, 0.25)); ball(0.015, 0, 0.38, e.d / 2 + 0.01, K.brass, { det: 0 });
    bx(0.16, 0.03, 0.22, -0.08, 0.515, 0.05, SPINES[KEYS.indexOf(e.room.slice(5)) % 12], { ry: 0.3 });
    ao(0, 0, e.w + 0.2, e.d + 0.2, 0.4, 0.2);
  };
  BUILD.wardrobe = (e) => {
    const c = WOOD[e.k], dk = mixHex(c, 0x000000, 0.3);
    bx(1.6, 2.0, 0.6, 0, 1.0, 0, c, { e: 0.02, bot: false });
    bx(1.66, 0.06, 0.64, 0, 2.03, 0, dk, { e: 0.01 });
    bx(0.008, 1.88, 0.006, 0, 1.0, 0.301, dk);
    for (const x of [-0.06, 0.06]) bx(0.02, 0.24, 0.025, x, 1.05, 0.315, K.chrome, { b: "g" });
    bx(0.66, 1.6, 0.012, 0.4, 1.05, 0.306, dk); bx(0.6, 1.54, 0.01, 0.4, 1.05, 0.313, 0xd3dde3, { b: "g" });
    ao(0, 0, 1.8, 0.8, 0.5, 0.3);
  };
  BUILD.bed = (e) => {
    const k = e.k, c = WOOD[k], col = C.COLORS[k];
    bx(1.25, 0.26, 2.15, 0, 0.22, 0.03, c, { e: 0.02, bot: false });
    for (const x of [-0.56, 0.56]) for (const z of [-1.0, 1.05]) bx(0.07, 0.1, 0.07, x, 0.05, z, mixHex(c, 0x000000, 0.3));
    bx(1.33, 1.0, 0.07, 0, 0.52, -1.08, c, { e: 0.025 });
    bx(1.33, 0.52, 0.06, 0, 0.3, 1.11, c, { e: 0.02 });
    bx(1.16, 0.18, 2.0, 0, 0.43, 0.03, 0xf3f1eb, { e: 0.05 });
    bx(1.24, 0.07, 1.36, 0, 0.495, 0.36, col, { e: 0.03 });
    bx(1.27, 0.2, 1.36, 0, 0.42, 0.36, mixHex(col, 0x000000, 0.12), { e: 0.04, top: false });
    bx(1.25, 0.035, 0.34, 0, 0.545, 0.84, mixHex(col, 0xffffff, 0.55), { e: 0.012 });
    bx(0.62, 0.11, 0.36, 0, 0.575, -0.77, 0xfbfaf6, { e: 0.045 });
    ao(0, 0, 1.6, 2.6, 0.55, 0.35);
  };
  const deskProps = (k, w, d) => {
    const y = 0.75;
    if (k === "preside") { bx(0.3, 0.02, 0.3, 0.2, y + 0.02, 0, K.black, { ry: 0.5 }); cyl(0.09, 0.1, 0.05, 0.2, y + 0.005, 0, K.black, { seg: 12 }); bx(0.24, 0.04, 0.3, -0.3, y + 0.02, 0.05, 0x8c1f2b, { e: 0.006 }); }
    if (k === "falco") { bx(0.24, 0.012, 0.17, 0.05, y + 0.01, 0.05, K.black, { e: 0.006, ry: -0.2 }); for (let i = 0; i < 7; i++) bx(0.012, 0.002, 0.02 + (i * 37 % 5) * 0.01, -0.04 + i * 0.025, y + 0.017, 0.05, i % 3 ? 0x3bd16f : 0xe0524f, { b: "e", ry: -0.2 }); cyl(0.04, 0.036, 0.1, -0.35, y + 0.05, 0.1, 0x257de0, { b: "g" }); }
    if (k === "tartaruga") { ball(0.08, 0.1, y + 0.02, 0.0, 0x3d7a3a, { sy: 0.55, det: 1 }); ball(0.03, 0.2, y + 0.03, 0.0, 0x6f8f4a, { det: 0 }); for (const [x, z] of [[0.04, 0.06], [0.16, 0.06], [0.04, -0.06], [0.16, -0.06]]) ball(0.018, x, y + 0.01, z, 0x6f8f4a, { det: 0 }); cyl(0.04, 0.035, 0.09, -0.3, y + 0.045, 0.1, 0x128a2b, { b: "g" }); pot(-0.35, y, -0.15, 0.06, 0.09); foliage(-0.35, y + 0.07, -0.15, 0.35, 0); }
    if (k === "spazzino") { cyl(0.04, 0.04, 0.28, 0.25, y + 0.14, -0.1, 0xef6a26, { b: "g" }); ball(0.1, -0.1, y + 0.04, 0.05, 0xef6a26, { sy: 0.5 }); bx(0.12, 0.012, 0.1, -0.1, y + 0.01, 0.15, 0xef6a26); }
    if (k === "ragioniere") { bx(0.24, 0.08, 0.26, 0.15, y + 0.04, 0, 0xd8cdb8, { e: 0.01, rx: -0.15 }); cyl(0.03, 0.03, 0.12, 0.15, y + 0.11, -0.12, K.paper, { rz: HP }); bx(0.26, 0.05, 0.34, -0.25, y + 0.025, 0.05, 0x6a3b26, { e: 0.006 }); for (let i = 0; i < 3; i++) cyl(0.004, 0.004, 0.16, 0.0 + i * 0.02, y + 0.004, 0.2, 0xd99400, { rz: HP, seg: 5 }); }
    if (k === "guardiano") { for (const [x, ry] of [[0.2, -0.3], [-0.2, 0.3]]) { bx(0.3, 0.2, 0.02, x, y + 0.2, -0.15, K.black, { ry, e: 0.005 }); bx(0.03, 0.1, 0.03, x, y + 0.05, -0.15, K.black); for (let i = 0; i < 4; i++) quad(B.glow, L(x - 0.09 + i * 0.06, y + 0.15 + i * 0.02, -0.135, ry), 0.04, 0.06 + i * 0.03, [0x3bd16f, 0xe9b949, 0xe0524f, 0x3bd16f][i]); } bx(0.06, 0.16, 0.04, -0.45, y + 0.08, 0.1, K.black, { e: 0.01 }); }
    if (k === "cronista") { bx(0.14, 0.09, 0.08, 0.2, y + 0.045, 0.05, K.black, { e: 0.01 }); cyl(0.035, 0.035, 0.08, 0.2, y + 0.05, 0.13, 0x333, { rx: HP }); for (let i = 0; i < 5; i++) bx(0.3, 0.01, 0.4, -0.25, y + 0.005 + i * 0.011, 0, K.paper, { ry: i * 0.1 }); }
    if (k === "scettico") { bx(0.34, 0.012, 0.24, 0.0, y + 0.006, 0.05, K.paper); torus(0.05, 0.008, 0.05, y + 0.02, 0.08, K.brass, { rx: HP }); cyl(0.008, 0.008, 0.1, 0.1, y + 0.02, 0.15, K.dark, { rx: HP, ry: 0.6 }); for (let i = 0; i < 4; i++) { bx(0.2, 0.04, 0.15, -0.35, y + 0.02 + i * 0.041, -0.1, SPINES[i + 3]); bx(0.012, 0.004, 0.06, -0.3, y + 0.04 + i * 0.041, -0.02, 0xd23a30); } }
  };
  // what makes each dormitory its owner's (Appendix C): wall decor, the shelf above the desk
  const dormDecor = (k, x0) => {
    const i = KEYS.indexOf(k), east = i < 7 ? `p.dorm_${k}_${KEYS[i + 1]}` : "e.dorm_scettico", north = "p.corridoio_" + k, west = i ? `p.dorm_${KEYS[i - 1]}_${k}` : "w.dorm_preside";
    const onWall = (wallId, fn) => { WALLI = wallById[wallId].i; fn(); WALLI = 0; };
    // the frame is the dorm centre (x0 + 3, 16): local x = world x − (x0 + 3), local z = world z − 16
    const lx = (wx) => wx - (x0 + 3), lz = (wz) => wz - 16;
    // a shelf with books above the desk, on the east wall
    onWall(east, () => {
      bx(0.25, 0.025, 1.2, lx(x0 + 5.76), 1.55, lz(16.3), WOOD[k]);
      FR2(() => books(-0.55, 0.55, 1.5625, -0.12, 0.26, 0.2), x0 + 5.76, 16.3, -HP);
    });
    const poster = (wallId, wx, wz, r, cell, w, y) => onWall(wallId, () => FR2(() => BUILD.poster({ cell, w, y }), wx, wz, r));
    if (k === "preside") { poster(north, x0 + 1.15, 12.11, 0, "diplomaA", 0.55, 1.75); poster(north, x0 + 1.85, 12.11, 0, "diplomaB", 0.45, 1.5); poster(north, x0 + 4.6, 12.11, 0, "crest", 0.6, 1.75); }
    if (k === "falco") { poster(east, x0 + 5.89, 15.2, -HP, "candles", 0.6, 1.55); poster(north, x0 + 4.6, 12.11, 0, "hawk", 0.7, 1.4); }
    if (k === "tartaruga") { poster(north, x0 + 4.6, 12.11, 0, "landscape", 0.7, 1.7); onWall(west, () => FR2(() => { pot(0, 1.8, 0, 0.1, 0.12); foliage(0, 1.9, 0, 0.5, 2); bx(0.5, 0.02, 0.24, 0, 1.79, 0, K.pine); }, x0 + 0.25, 16.9, HP)); }
    if (k === "spazzino") { poster(north, x0 + 4.6, 12.11, 0, "paura", 0.6, 1.35); onWall(west, () => FR2(() => { cyl(0.01, 0.01, 0.08, 0, 1.7, 0.04, K.steel, { rx: HP }); ball(0.11, 0, 1.66, 0.12, 0xef6a26, { sy: 0.55 }); }, x0 + 0.11, 15.4, HP)); }
    if (k === "ragioniere") { poster(east, x0 + 5.89, 14.8, -HP, "ledger", 0.6, 1.6); }
    if (k === "guardiano") { onWall(north, () => FR2(() => { geo(CUR.m, L(0, 1.75, 0.03), proto("shield", () => { const s = new T.Shape(); s.moveTo(-0.3, 0.35); s.lineTo(0.3, 0.35); s.lineTo(0.3, 0.0); s.quadraticCurveTo(0.28, -0.32, 0, -0.45); s.quadraticCurveTo(-0.28, -0.32, -0.3, 0.0); s.lineTo(-0.3, 0.35); return new T.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }); }), 0x00a383, {}); bx(0.06, 0.5, 0.02, 0, 1.72, 0.09, 0xd4a93c); bx(0.36, 0.06, 0.02, 0, 1.85, 0.09, 0xd4a93c); }, x0 + 4.6, 12.11, 0)); poster(east, x0 + 5.89, 14.6, -HP, "rischio", 0.55, 1.6); }
    if (k === "cronista") { poster(north, x0 + 4.6, 12.11, 0, "news", 0.6, 1.6); poster(east, x0 + 5.89, 14.7, -HP, "news", 0.45, 1.45); }
    if (k === "scettico") { poster(north, x0 + 4.6, 12.11, 0, "question", 0.7, 1.4); }
  };
  // run fn with the item frame moved to (wx, wz, r), then restore it
  const FR2 = (fn, wx, wz, r) => {
    const keep = FR.clone(), keepR = CUR_R;
    FR.makeRotationY(r).setPosition(wx, 0, wz); CUR_R = r;
    fn();
    FR.copy(keep); CUR_R = keepR;
  };
  // trees: an instanced trunk and one instanced crown per kind
  const treeAt = (kind, x, z, s) => {
    const sc = (a, b, c) => L(x, 0, z, RND() * 6.28).clone().scale(new T.Vector3(a, b, c));
    const v = 0.85 + RND() * 0.3;
    if (kind === "olive") { inst("trunk", sc(0.9 * s, 1.6 * s * v, 0.9 * s), 0x7a6a55); inst("cr_olive", sc(1.0 * s * v, 1.0 * s * v, 1.0 * s * v), 0xffffff); }
    else if (kind === "pine") { inst("trunk", sc(2.0 * s, 6.2 * s * v, 2.0 * s), 0x6b4a33); inst("cr_pine", sc(1.2 * s * v, 1.0 * s * v, 1.2 * s * v).multiply(new T.Matrix4().makeTranslation(0, (6.2 * v - 5.4) / v, 0)), 0xffffff); }
    else if (kind === "cypress") { inst("trunk", sc(0.8 * s, 1.2 * s, 0.8 * s), 0x5a4332); inst("cr_cypress", sc(s * v, s * (0.85 + RND() * 0.35), s * v), 0xffffff); }
    else { inst("trunk", sc(1.1 * s, 2.6 * s * v, 1.1 * s), 0x6b5135); inst("cr_round", sc(1.1 * s * v, 1.0 * s * v, 1.1 * s * v), 0xffffff); }
    ao(x, z, 2.6 * s, 2.6 * s, 0.35, 1.0);
  };

  // ---- 12. walls, floors, garden and grounds
  const FLOORS = {
    presidenza: [0x6e4831, 2, 0.12, 0.26], riunione: [0xd6cdbf, 4, 1, 0], trading: [0x59626c, 5, 0.5, 0.05], biblioteca: [0x9a6a45, 2, 0.14, 0.3],
    mensa: [0xefe7d8, 3, 0.45, 0.05], palestra: [0xcf9d63, 9, 0.075, 0.14], portico: [0xb27a5c, 8, 0.36, 0.16], corridoio: [0xe2d8c8, 4, 1, 0],
  };
  function buildWalls() {
    const Wb = B.walls, frameC = 0xf0ebe0, sillC = 0xd9cfbd, plaster = 0xe9e0d0, cap = 0x4a403a;
    const colOf = (room, base) => { const c = WALLCOL[room ? (room === "cortile" ? "portico" : room) : "out"] || WALLCOL.out; return base ? c[1] : c[0]; };
    const M = new T.Matrix4();
    for (const w of WALLS) {
      const wi = w.i, alongX = w.ax === "x", s0 = (alongX ? w.x0 : w.z0) - 0.099, s1 = (alongX ? w.x1 : w.z1) + 0.099, fix = alongX ? w.z0 : w.x0;
      const ops = [...w.doors.map((d) => ({ a: d.c - d.w / 2, b: d.c + d.w / 2, y0: 0, y1: 2.1, door: true })), ...w.wins.map((o) => ({ a: o.c - o.w / 2, b: o.c + o.w / 2, y0: o.y0, y1: o.y1 }))];
      const cuts = [...new Set([s0, s1, ...ops.flatMap((o) => [o.a, o.b])])].sort((a, b) => a - b);
      // a box of the wall between s = a..b and y = y0..y1; −side / +side colours by height
      const piece = (a, b, y0, y1, o = {}) => {
        if (b - a < 1e-3 || y1 - y0 < 1e-3) return;
        const base = y1 <= LOW_H + 1e-3;
        const cm = (a + b) / 2, ym = (y0 + y1) / 2;
        M.makeTranslation(alongX ? cm : fix, ym, alongX ? fix : cm);
        const cA = colOf(w.a, base), cB = colOf(w.b, base);
        const faces = alongX ? { nz: cA, pz: cB, x: o.endC ?? plaster } : { nx: cA, px: cB, z: o.endC ?? plaster };
        box(Wb, M, alongX ? b - a : 0.2, y1 - y0, alongX ? 0.2 : b - a, plaster, Object.assign(faces, { top: o.top ?? cap, bot: o.bot ?? false, wall: wi }));
      };
      for (let n = 0; n < cuts.length - 1; n++) {
        const a = cuts[n], b = cuts[n + 1], mid = (a + b) / 2, op = ops.find((o) => mid > o.a && mid < o.b);
        if (!op) { piece(a, b, 0, LOW_H); piece(a, b, LOW_H, WALL_H); continue; }
        if (op.door) { piece(a, b, 2.1, WALL_H, { bot: plaster }); continue; }
        if (op.y0 > LOW_H) { piece(a, b, 0, LOW_H); piece(a, b, LOW_H, op.y0, { top: sillC }); } else piece(a, b, 0, op.y0, { top: sillC });
        piece(a, b, op.y1, WALL_H, { bot: plaster });
      }
      const at = (s, y, off) => (alongX ? M.makeTranslation(s, y, fix + off) : M.makeTranslation(fix + off, y, s));
      const bxw = (len, h, th, s, y, off, c, o = {}) => { at(s, y, off); box(Wb, M, alongX ? len : th, h, alongX ? th : len, c, Object.assign({ wall: wi }, o)); };
      // windows: glass, frames, sills, and green shutters on the open side
      for (const o of w.wins) {
        const gh = o.y1 - o.y0, gy = (o.y0 + o.y1) / 2;
        at(o.c, gy, 0);
        if (!alongX) M.multiply(new T.Matrix4().makeRotationY(HP));
        const room = w.out === "a" ? w.b : w.a;
        quad(B.glass, M, o.w, gh, 0xffffff, null, { wall: wi });
        for (let q = 0; q < 4; q++) B.glassRoom.push(ROOMIX[room] || 0);
        bxw(o.w, 0.05, 0.08, o.c, o.y1 - 0.025, 0, frameC); bxw(o.w, 0.05, 0.08, o.c, o.y0 + 0.025, 0, frameC);
        bxw(0.05, gh, 0.08, o.c - o.w / 2 + 0.025, gy, 0, frameC); bxw(0.05, gh, 0.08, o.c + o.w / 2 - 0.025, gy, 0, frameC);
        bxw(0.04, gh, 0.06, o.c, gy, 0, frameC); bxw(o.w, 0.035, 0.06, o.c, o.y0 + gh * 0.68, 0, frameC);
        bxw(o.w + 0.1, 0.05, 0.32, o.c, o.y0 - 0.025, 0, sillC, { e: 0.01 });
        if (w.out && o.y0 < 1.2) {
          const side = w.out === "a" ? -1 : 1;
          for (const sgn of [-1, 1]) bxw(o.w / 2, gh, 0.03, o.c + sgn * (o.w * 0.75 + 0.03), gy, side * 0.12, 0x3d5a3e, { e: 0.006 });
        }
      }
      // door frames on both faces
      for (const d of w.doors) for (const side of [-1, 1]) {
        bxw(0.08, 2.18, 0.03, d.c - d.w / 2 - 0.03, 1.09, side * 0.11, 0xd8cdb8); bxw(0.08, 2.18, 0.03, d.c + d.w / 2 + 0.03, 1.09, side * 0.11, 0xd8cdb8);
        bxw(d.w + 0.14, 0.08, 0.03, d.c, 2.14, side * 0.11, 0xd8cdb8);
      }
      // skirting on interior faces and the contact shadow along the base
      const solid = []; let s = s0;
      for (const d of w.doors.map((d) => [d.c - d.w / 2, d.c + d.w / 2]).sort((a, b) => a[0] - b[0])) { solid.push([s, d[0]]); s = d[1]; }
      solid.push([s, s1]);
      for (const [a, b] of solid) {
        if (b - a < 0.05) continue;
        for (const [room, side] of [[w.a, -1], [w.b, 1]]) {
          if (!room || roomById[room].kind === "esterno") continue;
          bxw(b - a, 0.1, 0.016, (a + b) / 2, 0.05, side * 0.108, room === "portico" ? 0xa0583a : 0x9c5a3e, { bot: false });
        }
        const p = alongX ? [(a + b) / 2, fix] : [fix, (a + b) / 2];
        AO.push([p[0], 0.005, p[1], alongX ? b - a : 1.2, alongX ? 1.2 : b - a, 0, 0.42, 0.5]);
      }
    }
  }
  function buildFloors() {
    const F = B.floor;
    for (const r of rooms) {
      if (r.id === "cortile") continue;
      const [c, ty, s, amp] = r.kind === "dormitorio" ? [mixHex(0xb48858, C.COLORS[r.owner], 0.06), 2, 0.13, 0.28] : FLOORS[r.id];
      for (const q of r.rects) floorRect(F, q[0], q[1], q[2], q[3], 0, c, [ty, s, amp, 0]);
    }
  }
  function ringQuads(b, r0, r1, y, col, pat, n = 64) {
    const c = lin(col);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 2 * PI, a1 = (i + 1) / n * 2 * PI;
      const p = [[r0 * cos(a0), r0 * sin(a0)], [r1 * cos(a0), r1 * sin(a0)], [r1 * cos(a1), r1 * sin(a1)], [r0 * cos(a1), r0 * sin(a1)]];
      const base = b.n;
      for (const j of [0, 3, 2, 1]) vert(b, IDM, p[j][0], y, p[j][1], 0, 1, 0, c, 0, 0, 0, pat);
      fan(b, base, 4);
    }
  }
  function gardenGround() {
    const F = B.floor, G = [0, 0, 0.5, 0], grass = [6, 1, 0, 0];
    floorRect(F, -11, -7, 11, 7, -0.01, 0x5b8a42, grass);
    for (const [x0, z0, x1, z1] of [[-0.9, -7, 0.9, -3.4], [-0.9, 3.4, 0.9, 7], [-11, -0.9, -3.4, 0.9], [3.4, -0.9, 11, 0.9]]) floorRect(F, x0, z0, x1, z1, -0.004, 0xd9cbab, G);
    ringQuads(F, 1.75, 3.85, 0, 0xd9cbab, G);
    for (const [x, z] of [[-1.3, -3.6], [1.3, -3.6], [-1.3, 3.6], [1.3, 3.6], [-3.6, -1.3], [-3.6, 1.3], [3.6, -1.3], [3.6, 1.3]]) ball(0.32, x, 0.22, z, 0x2f5f2f, { det: 1, sy: 0.75 });
  }
  function groundsBuild() {
    const F = B.floor;
    const frame = (o, i, y, col, pat) => { for (const [x0, z0, x1, z1] of [[o[0], o[1], o[2], i[1]], [o[0], i[3], o[2], o[3]], [o[0], i[1], i[0], i[3]], [i[2], i[1], o[2], i[3]]]) floorRect(F, x0, z0, x1, z1, y, col, pat); };
    frame([-40, -34, 40, 34], [-26.4, -22.4, 26.4, 22.4], -0.03, 0x6a8d4c, [6, 1, 0, 0]);
    frame([-26.4, -22.4, 26.4, 22.4], [-24.1, -20.1, 24.1, 20.1], -0.016, 0xcbbfa8, [1, 0.6, 0.12, 0]);
    floorRect(F, -1.8, 22.4, 1.8, 34, -0.016, 0xc8b89c, [8, 0.4, 0.15, 0]);
    const gr = [0, 0, 0.5, 0];
    for (const [x0, z0, x1, z1] of [[-33, -29, 33, -27.6], [-33, 27.6, -1.8, 29], [1.8, 27.6, 33, 29], [-33, -29, -31.6, 29], [31.6, -29, 33, 29]]) floorRect(F, x0, z0, x1, z1, -0.022, 0xd6c7a6, gr);
    // the low perimeter wall with pillars, open at the gate on the south side
    const wallC = 0xcdbfa5, capC = 0xb8a98e;
    const seg = (x0, z0, x1, z1) => { const len = hyp(x1 - x0, z1 - z0), ax = x1 !== x0; const M = new T.Matrix4().makeTranslation((x0 + x1) / 2, 0.55, (z0 + z1) / 2); box(CUR.m, M, ax ? len : 0.35, 1.1, ax ? 0.35 : len, wallC, { bot: false }); M.makeTranslation((x0 + x1) / 2, 1.14, (z0 + z1) / 2); box(CUR.m, M, ax ? len + 0.1 : 0.48, 0.08, ax ? 0.48 : len + 0.1, capC, {}); };
    seg(-40, -34, 40, -34); seg(-40, -34, -40, 34); seg(40, -34, 40, 34); seg(-40, 34, -3.2, 34); seg(3.2, 34, 40, 34);
    const pil = (x, z, h = 1.5, s = 0.6) => { const M = new T.Matrix4().makeTranslation(x, h / 2, z); box(CUR.m, M, s, h, s, 0xc4b597, { e: 0.02, bot: false }); };
    for (let x = -40; x <= 40; x += 8) { pil(x, -34); if (abs(x) > 4) pil(x, 34); }
    for (let z = -26; z <= 26; z += 8) { pil(-40, z); pil(40, z); }
    for (const x of [-3.4, 3.4]) { pil(x, 34, 2.5, 0.8); FR2(() => lampAt("street", null, "globe", 0, 2.75, 0, [0.2, 0.22, 0.2], [0.0, 3.2, 0.7], { warm: 0xffd090, power: 1.2 }), x, 34, 0); }
    FR2(() => { bx(1.6, 0.42, 0.06, 0, 1.75, 0, 0x2b2420, { e: 0.01 }); SURFM.push({ name: "post", cell: "gate", w: 1.5, h: 0.375, m: L(0, 1.75, 0.032).clone(), wall: 0 }); }, -3.4, 33.55, PI);
    for (const sx of [-1, 1]) FR2(() => {
      for (let i = 0; i < 10; i++) bx(0.025, 1.8, 0.025, 0, 0.95, 0.15 + i * 0.12, K.iron);
      for (const y of [0.2, 1.7]) bx(0.04, 0.05, 1.25, 0, y, 0.72, K.iron);
    }, sx * 2.9, 34.1, 0);
    // trees: an avenue of cypresses, umbrella pines, round trees
    for (let z = 24.5; z <= 32.5; z += 2.7) { treeAt("cypress", -3.3, z, 1); treeAt("cypress", 3.3, z, 1); }
    for (const [x, z] of [[-32, -26], [-17, -28.5], [9, -27], [27, -24], [34, 6], [-34, 9], [-30, 25], [29, 25], [17, 30], [-15, 30], [35, -12], [-35, -10], [-24, -29], [22, -30], [-36, 22], [36, 20]]) treeAt("pine", x, z, 0.9 + RND() * 0.3);
    for (const [x, z] of [[-29, -14], [30, -4], [-30, 2], [30, 14], [-21, 27], [12, 26], [-8, -27], [4, -30.5], [-12, -31], [26, 31]]) treeAt("round", x, z, 0.8 + RND() * 0.4);
    for (const [x, z] of [[-26.4, -23], [26.4, -23], [-25.6, 23.4], [25.6, 23.4]]) treeAt("cypress", x, z, 0.9);
    for (const [x, z] of [[-27.6, -12], [-27.6, 0], [-27.6, 12], [27.6, -12], [27.6, 0], [27.6, 12], [-12, -23.6], [0, -23.6], [12, -23.6], [-2.6, 25.5], [2.6, 29], [-2.6, 32.5], [-14, 23.6], [14, 23.6]]) FR2(() => BUILD.street({}), x, z, 0);
    for (const [x, z, r] of [[-3.0, 27.3, HP], [3.0, 30.7, -HP]]) FR2(() => { inst("bench", L(0, 0, 0), 0xffffff); ao(0, 0.05, 1.9, 0.9, 0.4, 0.3); }, x, z, r);
    // bushes along the facades
    for (let x = -22; x <= 22; x += 4) { if (abs(x) < 2) continue; ball(0.5, x, 0.35, -22.9, 0x3a6b35, { det: 1, sy: 0.75 }); }
    for (let z = -18; z <= 18; z += 4) { ball(0.5, -26.9, 0.35, z, 0x3a6b35, { det: 1, sy: 0.75 }); ball(0.5, 26.9, 0.35, z, 0x3a6b35, { det: 1, sy: 0.75 }); }
    // the flags at the entrance
    FR2(() => {
      cyl(0.04, 0.05, 7, 0, 3.5, 0, K.chrome, { b: "g", seg: 8 }); ball(0.07, 0, 7.05, 0, 0xd4a93c, { det: 0, b: "g" });
      const fl = proto("flag", () => { const g = new T.PlaneGeometry(0.5, 1.0, 4, 1), a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setZ(i, sin(a.getX(i) * 6 + 1) * 0.04); g.computeVertexNormals(); return g; });
      for (const [i, c] of [[0, 0x1f8a4c], [1, 0xf4f1e8], [2, 0xce2b37]]) for (const r of [0, PI]) geo(CUR.m, L(0.25 + i * 0.5, 6.35, 0, r), fl, c, { s: [r ? -1 : 1, 1, 1] });
    }, -6, 23.4, 0);
  }
  BUILD.street = () => {
    cyl(0.12, 0.16, 0.5, 0, 0.25, 0, K.iron, { seg: 10 }); cyl(0.05, 0.07, 4.0, 0, 2.5, 0, K.iron, { seg: 10 });
    bx(0.6, 0.05, 0.05, 0.25, 4.35, 0, K.iron); cyl(0.13, 0.08, 0.16, 0.5, 4.3, 0, K.iron, { seg: 8 });
    lampAt("street", null, "globe", 0.5, 4.13, 0, [0.12, 0.14, 0.12], [-0.01, 3.6, 0.75, 0.5], { warm: 0xffd8a0, power: 1.4 });
    ao(0, 0, 0.6, 0.6, 0.35, 0.2);
  };
  // the arcade over the colonnade: arches between consecutive columns, a cornice on top
  function buildArcade() {
    const edges = [[-11, -7, 11, -7], [-11, 7, 11, 7], [-11, -7, -11, 7], [11, -7, 11, 7]];
    for (const [x0, z0, x1, z1] of edges) {
      const ax = z0 === z1, cols = COLS.filter(([x, z]) => (ax ? z === z0 : x === x0)).map(([x, z]) => (ax ? x : z)).sort((a, b) => a - b);
      cols.unshift(ax ? x0 : z0); cols.push(ax ? x1 : z1);
      const uniq = [...new Set(cols.map((v) => Math.round(v * 1000) / 1000))];
      for (let i = 0; i < uniq.length - 1; i++) {
        const a = uniq[i], b = uniq[i + 1], span = b - a, half = span / 2 - 0.21;
        const g = proto("arch" + span.toFixed(2), () => {
          const s = new T.Shape(); s.moveTo(-half, 0); s.lineTo(-half - 0.02, 0.8); s.lineTo(half + 0.02, 0.8); s.lineTo(half, 0);
          for (let k = 0; k <= 16; k++) { const t = k / 16 * PI; s.lineTo(half * cos(t), 0.55 * sin(t)); }
          const eg = new T.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: false, curveSegments: 4 }); eg.translate(0, 0, -0.17); return eg;
        });
        const M = new T.Matrix4().makeRotationY(ax ? 0 : HP).setPosition(ax ? (a + b) / 2 : x0, 2.4, ax ? z0 : (a + b) / 2);
        geo(B.zone("garden").m, M, g, K.stone, {});
      }
      const len = ax ? x1 - x0 : z1 - z0, M = new T.Matrix4().makeTranslation(ax ? 0 : x0, 3.27, ax ? z0 : 0);
      box(B.zone("garden").m, M, ax ? len + 0.5 : 0.5, 0.14, ax ? 0.5 : len + 0.5, 0xcfc3ae, { e: 0.02 });
    }
  }

  // ---- 13. instanced prototypes
  function protoGeo(fn) {
    const keep = CUR, b = bucket(false), g = bucket(false);
    CUR = { m: b, g }; FR.identity(); fn(); CUR = keep;
    const off = b.n;
    for (const k of ["P", "N", "C", "UV", "WL"]) b[k].push(...g[k]);
    b.I.push(...g.I.map((i) => i + off)); b.n += g.n;
    return toGeometry(b);
  }
  const PROTOS = {
    ch_wood: () => { for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) bx(0.035, 0.44, 0.035, x, 0.22, z, 0x3a2618); bx(0.46, 0.035, 0.44, 0, 0.42, 0, 0x3a2618); bx(0.44, 0.03, 0.42, 0, 0.447, 0.01, 0xf2f2f2, { e: 0.012 }); for (const x of [-0.2, 0.2]) bx(0.035, 0.52, 0.035, x, 0.72, -0.2, 0x3a2618, { rx: -0.08 }); bx(0.42, 0.3, 0.035, 0, 0.8, -0.215, 0xf2f2f2, { e: 0.012, rx: -0.08 }); },
    ch_shell: () => { for (const [x, z] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) cyl(0.011, 0.011, 0.46, x, 0.23, z, 0x2a2d31, { seg: 6, rx: z * 0.3, rz: -x * 0.3 }); bx(0.42, 0.03, 0.42, 0, 0.445, 0, 0xffffff, { e: 0.012 }); bx(0.4, 0.3, 0.03, 0, 0.76, -0.2, 0xffffff, { e: 0.012, rx: -0.14 }); },
    ch_office: () => { for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; bx(0.04, 0.035, 0.3, sin(a) * 0.15, 0.06, cos(a) * 0.15, 0x26292d, { ry: a }); bx(0.04, 0.04, 0.04, sin(a) * 0.29, 0.02, cos(a) * 0.29, 0x111111); } cyl(0.025, 0.025, 0.32, 0, 0.25, 0, 0x8c949b, { seg: 8 }); bx(0.5, 0.08, 0.48, 0, 0.42, 0.01, 0xd9d9d9, { e: 0.03 }); bx(0.47, 0.56, 0.06, 0, 0.86, -0.24, 0xd9d9d9, { e: 0.03, rx: -0.1 }); bx(0.05, 0.3, 0.05, 0, 0.62, -0.25, 0x26292d); for (const x of [-0.26, 0.26]) { bx(0.04, 0.2, 0.04, x, 0.58, 0.0, 0x26292d); bx(0.06, 0.03, 0.24, x, 0.68, 0.02, 0x26292d, { e: 0.01 }); } },
    ch_exec: () => { PROTOS.ch_office(); bx(0.5, 0.36, 0.07, 0, 1.25, -0.28, 0xb07a52, { e: 0.035, rx: -0.1 }); },
    ch_arm: () => { bx(0.78, 0.26, 0.74, 0, 0.17, 0, 0xffffff, { e: 0.04 }); bx(0.56, 0.12, 0.56, 0, 0.36, 0.06, 0xffffff, { e: 0.04 }); bx(0.78, 0.5, 0.18, 0, 0.62, -0.28, 0xffffff, { e: 0.06 }); for (const x of [-0.32, 0.32]) bx(0.15, 0.28, 0.72, x, 0.5, 0, 0xffffff, { e: 0.06 }); for (const x of [-0.32, 0.32]) for (const z of [-0.3, 0.3]) bx(0.05, 0.06, 0.05, x, 0.03, z, 0x2a1a10); },
    book: () => bx(1, 1, 1, 0, 0, 0, 0xffffff, { nz: false, top: 0xf2ead8 }),
    monitor: () => { bx(0.66, 0.42, 0.03, 0, 0.35, 0, 0x16191d); bx(0.06, 0.2, 0.03, 0, 0.1, -0.03, 0x2a2d31); bx(0.22, 0.015, 0.16, 0, 0.008, -0.02, 0x2a2d31); },
    column: () => { bx(0.46, 0.2, 0.46, 0, 0.1, 0, K.stone); lathe("colshaft", [[0.2, 0.2], [0.21, 0.26], [0.175, 0.32], [0.155, 2.15], [0.2, 2.28], [0.22, 2.3]], 0, 0, 0, 0xe7dccb, { seg: 10 }); bx(0.46, 0.1, 0.46, 0, 2.35, 0, K.stone); },
    bench: () => { for (let i = 0; i < 4; i++) bx(1.6, 0.03, 0.09, 0, 0.45, 0.18 - i * 0.11, 0x8a5a36, { e: 0.008 }); for (let i = 0; i < 3; i++) bx(1.6, 0.08, 0.025, 0, 0.6 + i * 0.12, -0.27 - i * 0.02, 0x8a5a36, { e: 0.008, rx: -0.2 }); for (const x of [-0.7, 0.7]) { bx(0.05, 0.45, 0.5, x, 0.225, 0, 0x2a2e2c); bx(0.05, 0.42, 0.05, x, 0.68, -0.29, 0x2a2e2c, { rx: -0.2 }); } },
    trunk: () => { cyl(0.09, 0.14, 1, 0, 0.5, 0, 0xffffff, { seg: 7 }); },
    cr_olive: () => { for (let i = 0; i < 5; i++) { const a = i * 0.9; ball(0.62 - (i % 3) * 0.08, cos(a) * 0.55, 1.75 + (i % 3) * 0.32, sin(a) * 0.55, [0x7f9a6a, 0x6d8a5c, 0x8ba674][i % 3], { sy: 0.7 }); } bx(0.08, 0.9, 0.08, 0.15, 1.3, 0, 0x6b5a46, { rz: -0.5 }); bx(0.07, 0.8, 0.07, -0.18, 1.3, 0.1, 0x6b5a46, { rz: 0.6 }); },
    cr_pine: () => { for (let i = 0; i < 7; i++) { const a = i * 1.05, r = i ? 1.6 : 0; ball(i ? 1.35 : 1.7, cos(a) * r, i ? 5.55 : 6.0, sin(a) * r, [0x355e2c, 0x2e5428, 0x3f6a33][i % 3], { sy: 0.34 }); } bx(0.12, 1.6, 0.12, 0.5, 5.0, 0, 0x6b4a33, { rz: -0.7 }); bx(0.12, 1.6, 0.12, -0.5, 5.0, 0.2, 0x6b4a33, { rz: 0.7 }); },
    cr_cypress: () => { lathe("cyp", [[0, 0.7], [0.5, 1.2], [0.72, 2.4], [0.7, 3.8], [0.5, 5.2], [0.22, 6.4], [0, 7.0]], 0, 0, 0, 0x2b4a2a, { seg: 9 }); },
    cr_round: () => { for (let i = 0; i < 5; i++) { const a = i * 1.3; ball(1.1 - (i % 2) * 0.2, cos(a) * 0.8, 3.0 + (i % 3) * 0.45, sin(a) * 0.8, [0x4d7f3c, 0x3f7034, 0x5a8c44][i % 3], { sy: 0.85 }); } },
    shade: () => geo(CUR.m, L(0, 0, 0), proto("shadeG", () => new T.CylinderGeometry(0.15, 0.22, 0.26, 16, 1, true)), 0xffffff, {}),
    globe: () => geo(CUR.m, L(0, 0, 0), proto("globeG", () => new T.IcosahedronGeometry(1, 2)), 0xffffff, {}),
  };
  const CHAIRS = ["ch_wood", "ch_shell", "ch_office", "ch_exec", "ch_arm"];

  // ---- 14. contact shadows and pools of light: one instanced quad each, a small shader
  function decalMesh(list, additive) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute([-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5], 3));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      vertexShader: `varying vec2 vL; varying vec2 vH; varying vec3 vC;
void main() { float sx = length(instanceMatrix[0].xyz), sz = length(instanceMatrix[2].xyz); vL = position.xz * vec2(sx, sz); vH = 0.5 * vec2(sx, sz);
#ifdef USE_INSTANCING_COLOR
vC = instanceColor;
#else
vC = vec3(1.0);
#endif
gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: additive
        ? `varying vec2 vL; varying vec2 vH; varying vec3 vC; void main() { float r = length(vL / vH); float k = 1.0 - clamp(r, 0.0, 1.0); k = k * k * (0.6 + 0.4 * k); gl_FragColor = linearToOutputTexel(vec4(vC * k, 1.0)); }`
        : `varying vec2 vL; varying vec2 vH; varying vec3 vC; void main() { float f = max(vC.g, 0.05); vec2 d = max(abs(vL) - (vH - f), 0.0); float k = 1.0 - clamp(length(d) / f, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, vC.r * k * k); }`,
    });
    const im = new T.InstancedMesh(g, mat, max(1, list.length));
    im.count = list.length; im.frustumCulled = false; im.renderOrder = additive ? 3 : 1;
    return im;
  }

  // ---- 15. the canvas surfaces
  const FONT = { head: "'Titillium Web', 'Segoe UI', system-ui, sans-serif", num: "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace", hand: "Caveat, 'Segoe Print', 'Bradley Hand', cursive", read: "'Source Serif 4', Georgia, serif" };
  const DARKC = { preside: "#ef6a6b", falco: "#3d93f0", tartaruga: "#22b83c", spazzino: "#ef7a3c", ragioniere: "#dca21c", guardiano: "#19b496", cronista: "#e8649f", scettico: "#9d8cf1", motore: "#b7c2bb" };
  const GAIN = "#4fd18b", LOSS = "#ff7b72";
  const POSTER = {
    candles: [512, 0, 128, 256], hawk: [512, 256, 128, 256], paura: [640, 0, 128, 256], question: [640, 256, 128, 256],
    menu: [768, 0, 128, 256], diplomaA: [768, 256, 128, 128], diplomaB: [768, 384, 128, 128],
    news: [896, 0, 128, 128], crest: [896, 128, 128, 128], motto: [896, 256, 128, 128], rischio: [896, 384, 128, 128],
    gate: [0, 288, 256, 64], map: [256, 256, 256, 128], gym: [128, 384, 128, 128], landscape: [256, 384, 128, 128], ledger: [384, 384, 128, 128],
    clock_roma: [0, 384, 128, 40], clock_ny: [0, 426, 128, 40], clock_tokyo: [0, 468, 128, 40],
  };
  KEYS.forEach((k, i) => { POSTER["plate" + i] = [(i % 2) * 256, (i >> 1) * 64, 256, 64]; });
  const MONCELL = ["falcoA", "tartarugaA", "spazzinoA", "ragioniereA", "falcoB", "tartarugaB", "spazzinoB", "ragioniereB", "guardianoA", "cronistaA", "guardianoB", "cronistaB"];
  const SURF = {};
  let TXT = null;
  const warned = {};
  const warnOnce = (what, err) => { if (!warned[what]) { warned[what] = 1; console.info("Campus world: surface", what, "skipped:", err && err.message); } };
  const say = (c, text, x, y, font, color, align = "left", maxW) => {
    let s = String(text);
    if (maxW) { c.font = font; if (c.measureText(s).width > maxW) { while (s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1); s = s.trimEnd() + "…"; } }
    if (TXT) TXT.push(s);
    c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(s, x, y);
  };
  const wrapLines = (c, text, font, maxW, maxLines) => {
    c.font = font;
    const out = []; let row = "";
    for (const w of String(text).split(/\s+/)) {
      const t = row ? row + " " + w : w;
      if (c.measureText(t).width > maxW && row) { out.push(row); row = w; if (out.length === maxLines) break; } else row = t;
    }
    if (out.length < maxLines && row) out.push(row);
    else if (out.length === maxLines && row) out[maxLines - 1] = out[maxLines - 1] + " …";
    return out;
  };
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const g0 = () => U.obj(C.data.giudizio), ult = () => U.obj(C.data.ultimo);
  const priceList = () => { const p = D.prices(); return C.COINS.filter((s) => U.isNum(p[s])).map((s) => [s, U.price(p[s])]); };
  // the models: plain data, compared as JSON so a surface repaints only when its content changes
  const boardState = { lines: ["Scuola Cripto"], reveal: 1 }, motoreState = { events: null, title: "" }, palestraState = { lines: null };
  let tickerPage = 0, tickerPages = [[]];
  const MODELS = {
    board: () => ({ lines: boardState.lines.map((l) => U.plain(l, 160)), reveal: boardState.reveal }),
    motore: () => {
      const title = U.plain(motoreState.title || "", 30).toUpperCase();
      if (Array.isArray(motoreState.events)) return { title, events: motoreState.events.filter(U.obj).slice(0, 5).map((e) => [e.event === "aperta" ? "#7fd1a8" : e.event === "chiusa" ? "#9fc3ff" : "#ff8f8f", `${String(C.NAMES[e.wallet] || "").toUpperCase().slice(0, 4)} ${U.shortEvent(e)}`.trim()]) };
      return { title, prices: priceList().slice(0, 9) };
    },
    ticker: () => ({ items: tickerPages[tickerPage % tickerPages.length] || [] }),
    // the change since the last daily close of the quadro, at the price shown (not the day before's change)
    price: () => {
      const items = priceList(), qd = ult() && U.obj(ult().quadro), q = qd && U.obj(qd.monete), px = D.prices();
      if (!items.length) return { empty: true };
      const since = (s) => { const m = q && U.obj(q[s]), cl = m && U.toNum(m.chiusura); return U.isNum(cl) && cl > 0 && U.isNum(px[s]) ? (px[s] / cl - 1) * 100 : null; };
      return { at: U.romeTime(g0() && g0().prices_at), ref: qd && U.dm(qd.giorno) ? "variazione dalla chiusura del " + U.dm(qd.giorno) : "", cells: items.map(([s, p]) => { const v = since(s); return [s, p, U.isNum(v) ? U.pct(v, 2, true) : "", U.isNum(v) ? Math.sign(Math.round(v * 100)) : 0]; }) };
    },
    mon: () => {
      const cells = {}, G = g0(), R = U.obj(C.data.regole), u = ult(), Ri = u && U.obj(u.rischio), Bf = u && U.obj(u.briefing);
      for (const k of TR) {
        const w = D.wallet(k), gw = G && U.obj(G.wallets) && U.obj(G.wallets[k]);
        cells[k + "A"] = w ? {
          rows: [["A giudizio", U.isNum(w.judg) ? U.fmt(w.judg, 2) + " USDT" : ""], ["La regola", U.isNum(w.rules) ? U.fmt(w.rules, 2) : ""], ["Differenza", U.isNum(w.gap) ? U.fmt(w.gap, 2, true) : ""]].filter((r) => r[1]),
          gap: U.isNum(w.gap) ? Math.sign(w.gap) : 0, pos: U.arr(gw && gw.positions).filter(U.obj).map((p) => `${p.symbol} ${p.side}`).slice(0, 4),
        } : null;
        const rp = D.rulesPoints(R && U.obj(R.portafogli) && R.portafogli[k]).map((p) => p.value), jp = D.judgPoints(gw).map((p) => p.value);
        const thin = (a) => (a.length > 60 ? a.filter((_, i) => i % Math.ceil(a.length / 60) === 0 || i === a.length - 1) : a);
        cells[k + "B"] = rp.length || jp.length ? { rules: thin(rp), judg: thin(jp) } : null;
      }
      const f = D.fund(), fondo = Ri && U.obj(Ri.fondo), al = Ri ? U.arr(Ri.allarmi) : null;
      cells.guardianoA = f || fondo ? { rows: [["Il fondo", f ? U.fmt(f.capitale, 2) + " USDT" : U.isNum(fondo.capitale) ? U.fmt(fondo.capitale, 2) + " USDT" : ""], ["Netta, beta", fondo && U.isNum(fondo.netta_beta_pct) ? U.pct(fondo.netta_beta_pct, 1, true) : ""], ["Allarmi", al ? String(al.length) : ""]].filter((r) => r[1]) } : null;
      cells.guardianoB = al ? { list: al.slice(0, 3).map((a) => U.plain(U.human(a), 110)) } : null;
      const n = Bf && U.arr(Bf.notizie).filter(U.obj)[0];
      cells.cronistaA = n ? { text: U.plain(n.testo, 120), src: [U.plain(n.fonte || "", 40), U.romeTime(n.ora)].filter(Boolean).join(" · ") } : null;
      const cal = Bf ? U.arr(Bf.calendario).filter(U.obj).slice(0, 4) : [];
      cells.cronistaB = cal.length ? { cal: cal.map((x) => [U.romeTime(x.quando) || "", U.plain(x.evento || "", 60)]) } : null;
      return cells;
    },
    gara: () => {
      const g = D.contests()[0];
      if (!g) return { empty: true };
      const st = U.obj(g.doc.stato) || {}, wl = U.obj(st.wallets) || {}, cl = U.obj(g.situazione && g.situazione.classifica) || {};
      const m = /^notte-(\d{4}-\d{2}-\d{2})$/.exec(g.id);
      const title = typeof g.doc.titolo === "string" && g.doc.titolo ? U.plain(g.doc.titolo, 48) : m ? "Gara della notte del " + U.dm(m[1]) : U.isoDay(g.doc.aperta_alle) ? "Gara del " + U.dm(g.doc.aperta_alle) : "La gara della scuola";
      const ev = U.arr(g.doc.eventi).filter(U.obj);
      const rows = Object.keys(cl).filter((k) => KEYS.includes(k) && U.obj(cl[k])).sort((a, b) => {
        const ra = U.isNum(cl[a].risultato) ? cl[a].risultato : -Infinity, rb = U.isNum(cl[b].risultato) ? cl[b].risultato : -Infinity;
        return rb - ra || KEYS.indexOf(a) - KEYS.indexOf(b);
      }).map((k) => {
        const w = U.obj(wl[k]) || {}, p = U.arr(w.positions).filter(U.obj)[0] || U.arr(w.closed).filter(U.obj)[0] || ev.find((e) => e.wallet === k && e.symbol) || {};
        return [k, C.NAMES[k], p.symbol ? `${p.symbol} ${p.side || ""}`.trim() : "", U.isNum(cl[k].risultato) ? U.usd(cl[k].risultato, true) : "", U.isNum(cl[k].risultato) ? Math.sign(cl[k].risultato) : 0, cl[k].aperta === true];
      });
      const win = g.situazione && KEYS.includes(g.situazione.vincitore) ? g.situazione.vincitore : null;
      return { title, sub: (g.open ? (g.scadenza ? "Si chiude " + U.romeTime(g.scadenza) : "In corso") : g.doc.finita === true || !g.scadenza ? "Finita" : "Tempo scaduto: " + U.romeTime(g.scadenza)) + (U.isNum(g.leva) ? " · leva " + U.fmt(g.leva, 0) : "") + (g.opening ? " · all'apertura: contano solo i costi" : ""), rows, win: win ? `Vince ${C.ARTICLE[win]} ${C.NAMES[win]}` : "" };
    },
    goal: () => {
      const f = D.fund(), gr = D.graduation(), days = gr.days;
      const daysTxt = days > 1 ? `Mancano ${days} giorni alla laurea (21/2/2027)` : days === 1 ? "Manca un giorno alla laurea (21/2/2027)" : "Oggi è il giorno della laurea (21/2/2027)";
      const tesi = gr.tesi && (gr.tesi.nome || gr.tesi.regola) ? "La tesi: " + U.plain(gr.tesi.nome || gr.tesi.regola, 80) : "La tesi si sceglie insieme l'ultimo giorno";
      const giorno = U.isNum(gr.giorno) && U.isNum(gr.totale) ? `Giorno ${gr.giorno} di ${gr.totale}` : "";
      if (!f) return { empty: true, days: daysTxt, giorno };
      return { fund: U.fmt(f.capitale, 2), start: U.fmt(f.iniziale, 0), pct: U.pct(f.pct, 2, true), sign: Math.sign(f.capitale - f.iniziale), bar: U.clamp(f.capitale / (f.iniziale * 1.25), 0, 1), mark: 0.8, days: daysTxt, tesi, giorno };
    },
    palestra: () => {
      if (Array.isArray(palestraState.lines)) return { life: palestraState.lines.slice(0, 7).map((l) => U.plain(l, 90)) };
      const gym = D.latestGym(), rows = [];
      for (const k of TR) {
        let r = gym && U.obj(gym.doc.agenti) && U.obj(gym.doc.agenti[k]) && U.obj(gym.doc.agenti[k].riassunto);
        if (!r) { const ss = U.arr(U.obj(C.data.memoria[k]) && U.obj(C.data.memoria[k].palestra) && C.data.memoria[k].palestra.sessioni).filter(U.obj); r = ss[ss.length - 1] || null; }
        if (r && (U.isNum(r.brier) || U.isNum(r.r_totale))) rows.push([k, C.NAMES[k], [U.isNum(r.brier) ? "Brier " + U.fmt(r.brier, 3) : "", U.isNum(r.r_totale) ? U.fmt(r.r_totale, 1, true) + " R" : ""].filter(Boolean).join(" · ")]);
      }
      if (!rows.length) return { empty: true };
      const q = gym && U.obj(gym.doc.scettico) && gym.doc.scettico.domanda_per_il_consiglio;
      return { title: gym ? "Palestra del " + U.dm(gym.date) : "L'ultima palestra", rows, q: q ? U.plain(q, 110) : "" };
    },
    post: () => ({ v: 1 }),
  };
  const PAINT = {
    board(c, m, W, H) {
      c.fillStyle = "#2c4a3a"; c.fillRect(0, 0, W, H);
      const gr = c.createRadialGradient(W * 0.4, H * 0.3, 40, W / 2, H / 2, W * 0.7); gr.addColorStop(0, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0.12)"); c.fillStyle = gr; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { const g2 = c.createRadialGradient(0, 0, 4, 0, 0, 90); g2.addColorStop(0, "rgba(255,255,255,0.05)"); g2.addColorStop(1, "rgba(255,255,255,0)"); c.save(); c.translate(90 + i * 170, 70 + (i % 3) * 90); c.scale(2.2, 0.6); c.fillStyle = g2; c.fillRect(-90, -90, 180, 180); c.restore(); }
      if (m.lines.length === 1 && m.reveal >= 1) { say(c, m.lines[0], W / 2, H / 2 + 22, `600 76px ${FONT.hand}`, "#eef2ea", "center", W - 80); return; }
      let left = Math.floor(m.lines.join("").length * U.clamp(m.reveal, 0, 1)), y = 72;
      m.lines.forEach((line, n) => {
        if (!line) return;
        const font = n === 0 ? `600 40px ${FONT.hand}` : `600 52px ${FONT.hand}`;
        for (const r of wrapLines(c, line, font, 940, n === 0 ? 1 : 2)) {
          const vis = r.slice(0, max(0, left));
          if (vis) say(c, vis, 42, y, font, n === 0 ? "rgba(238,242,234,0.82)" : "#eef2ea");
          left -= r.length; y += n === 0 ? 62 : 58;
        }
      });
    },
    motore(c, m, W, H) {
      c.fillStyle = "#0b1620"; c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(127,209,168,0.06)"; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
      say(c, `MOTORE${m.title ? " · " + m.title : ""}`, 18, 36, `600 22px ${FONT.num}`, "#7fd1a8", "left", W - 30);
      let y = 72;
      if (m.events) {
        if (!m.events.length) say(c, "niente da segnalare", 18, y, `400 18px ${FONT.num}`, "#c9d6e2");
        for (const [col, t] of m.events) for (const part of wrapLines(c, t, `400 18px ${FONT.num}`, W - 36, 2)) { if (y > 310) break; say(c, part, 18, y, `400 18px ${FONT.num}`, col); y += 26; }
      } else if (m.prices.length) for (const [s, p] of m.prices) { say(c, `${s.padEnd(6)} ${p}`, 18, y, `400 18px ${FONT.num}`, "#c9d6e2"); y += 26; }
      else say(c, "in attesa dei prezzi", 18, y, `400 18px ${FONT.num}`, "#c9d6e2");
    },
    ticker(c, m, W, H) {
      c.fillStyle = "#0e1318"; c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(255,170,60,0.05)"; for (let x = 0; x < W; x += 4) c.fillRect(x, 0, 1, H);
      const font = `500 30px ${FONT.num}`;
      if (!m.items.length) { say(c, "Prezzi di BingX in arrivo", W / 2, 43, font, "#ffb347", "center"); return; }
      let x = 28;
      for (const [s, p] of m.items) {
        say(c, s, x, 43, `700 30px ${FONT.num}`, "#ffb347"); c.font = `700 30px ${FONT.num}`; x += c.measureText(s + " ").width;
        say(c, p, x, 43, font, "#f4efe2"); c.font = font; x += c.measureText(p).width;
        say(c, "·", x + 22, 43, font, "#6d7680"); x += 56;
      }
    },
    price(c, m, W, H) {
      c.fillStyle = "#0c131a"; c.fillRect(0, 0, W, H);
      if (m.empty) { say(c, "In attesa dei prezzi", W / 2, H / 2 + 12, `600 40px ${FONT.head}`, "#c9d6e2", "center"); return; }
      c.fillStyle = "#13202b"; c.fillRect(0, 0, W, 58);
      say(c, "Prezzi BingX" + (m.at ? " · " + m.at : ""), 22, 40, `700 30px ${FONT.head}`, "#f4efe2", "left", m.ref ? W * 0.55 : W - 40);
      if (m.ref) say(c, m.ref, W - 22, 38, `500 19px ${FONT.head}`, "#9fb2c4", "right", W * 0.42);
      const cw = W / 6, ch = (H - 66) / 6;
      m.cells.slice(0, 36).forEach(([s, p, chg, sg], i) => {
        const x = (i % 6) * cw, y = 64 + Math.floor(i / 6) * ch;
        c.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)"; c.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        say(c, s, x + 10, y + 26, `700 20px ${FONT.head}`, "#ffb347");
        say(c, p, x + cw - 10, y + 26, `500 19px ${FONT.num}`, "#f4efe2", "right", cw - 70);
        if (chg) say(c, (sg > 0 ? "▲ " : sg < 0 ? "▼ " : "") + chg, x + cw - 10, y + 56, `500 17px ${FONT.num}`, sg > 0 ? GAIN : sg < 0 ? LOSS : "#9aa6b2", "right");
      });
    },
    mon(c, m) {
      MONCELL.forEach((id, i) => {
        const x0 = (i % 4) * 256, y0 = (i >> 2) * 160, W = 256, H = 160, k = id.slice(0, -1), d = m[id];
        c.save(); c.beginPath(); c.rect(x0, y0, W, H); c.clip(); c.translate(x0, y0);
        c.fillStyle = "#0b141c"; c.fillRect(0, 0, W, H);
        const col = DARKC[k];
        c.fillStyle = col; c.fillRect(0, 0, W, 4);
        const head = id.endsWith("A") ? (k === "guardiano" ? "RISCHIO" : k === "cronista" ? "NOTIZIE" : "A GIUDIZIO") : k === "guardiano" ? "ALLARMI" : k === "cronista" ? "CALENDARIO" : "REGOLA E GIUDIZIO";
        say(c, `${C.NAMES[k].toUpperCase()} · ${head}`, 10, 24, `700 15px ${FONT.head}`, col, "left", W - 20);
        if (!d) {
          if (id.endsWith("B") && TR.includes(k)) { c.strokeStyle = "#56616c"; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 96); c.lineTo(W - 14, 96); c.stroke(); say(c, "I portafogli partono il 26/11", W / 2, 134, `500 14px ${FONT.head}`, "#9aa6b2", "center"); }
          else say(c, "Nessun dato oggi", W / 2, 96, `500 17px ${FONT.head}`, "#9aa6b2", "center");
        } else if (d.rows) {
          d.rows.forEach(([l, v], j) => { say(c, l, 10, 54 + j * 26, `400 14px ${FONT.head}`, "#9aa6b2"); say(c, v, W - 10, 54 + j * 26, `500 16px ${FONT.num}`, j === 2 && d.gap ? (d.gap > 0 ? GAIN : LOSS) : "#e9eef2", "right", 150); });
          if (d.pos && d.pos.length) say(c, d.pos.join(" · "), 10, 148, `500 13px ${FONT.num}`, "#c9d6e2", "left", W - 20);
        } else if (d.rules) {
          const all = [...d.rules, ...d.judg], lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.1 || 1;
          const px = (i, n) => 12 + (W - 24) * (n > 1 ? i / (n - 1) : 0.5), py = (v) => 140 - (100 * (v - lo + pad)) / (hi - lo + 2 * pad);
          c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 1; for (let g = 0; g < 4; g++) { c.beginPath(); c.moveTo(12, 40 + g * 33); c.lineTo(W - 12, 40 + g * 33); c.stroke(); }
          const line = (a, color, dash) => { if (!a.length) return; c.setLineDash(dash); c.strokeStyle = color; c.lineWidth = 2.5; c.beginPath(); a.forEach((v, i) => (i ? c.lineTo(px(i, a.length), py(v)) : c.moveTo(px(i, a.length), py(v)))); c.stroke(); c.setLineDash([]); };
          line(d.rules, "#aab4bf", [6, 5]); line(d.judg, col, []);
          say(c, "regola", 12, 154, `500 12px ${FONT.head}`, "#aab4bf"); say(c, "giudizio", 70, 154, `600 12px ${FONT.head}`, col);
        } else if (d.list) {
          if (!d.list.length) say(c, "Nessun allarme", W / 2, 96, `500 17px ${FONT.head}`, GAIN, "center");
          let y = 48; for (const a of d.list) for (const r of wrapLines(c, a, `400 13px ${FONT.head}`, W - 20, 2)) { if (y > 154) break; say(c, r, 10, y, `400 13px ${FONT.head}`, "#ffb4a8"); y += 17; }
        } else if (d.text) {
          let y = 50; for (const r of wrapLines(c, d.text, `400 15px ${FONT.read}`, W - 20, 5)) { say(c, r, 10, y, `400 15px ${FONT.read}`, "#e9eef2"); y += 19; }
          if (d.src) say(c, d.src, 10, 152, `500 12px ${FONT.head}`, "#9aa6b2", "left", W - 20);
        } else if (d.cal) {
          d.cal.forEach(([w, ev], j) => { say(c, w, 10, 50 + j * 28, `500 12px ${FONT.num}`, col, "left", W - 20); say(c, ev, 10, 64 + j * 28, `400 13px ${FONT.head}`, "#e9eef2", "left", W - 20); });
        }
        c.restore();
      });
    },
    gara(c, m, W, H) {
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#17202b"); bg.addColorStop(1, "#0d141b"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      c.fillStyle = "#d8443c"; rrect(c, 24, 22, 98, 36, 6); c.fill(); say(c, "GARA", 73, 48, `700 24px ${FONT.head}`, "#fff", "center");
      if (m.empty) { say(c, "Nessuna gara aperta", W / 2, H / 2 + 16, `600 44px ${FONT.head}`, "#c9d6e2", "center"); return; }
      say(c, m.title, 140, 50, `700 34px ${FONT.head}`, "#f4efe2", "left", W - 160);
      say(c, m.sub, 24, 96, `500 24px ${FONT.head}`, "#9fb2c4", "left", W - 48);
      m.rows.slice(0, 6).forEach(([k, name, cs, res, sg, open], i) => {
        const y = 128 + i * 62;
        c.fillStyle = i % 2 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)"; rrect(c, 20, y, W - 40, 54, 8); c.fill();
        c.fillStyle = DARKC[k]; c.beginPath(); c.arc(48, y + 27, 11, 0, 7); c.fill();
        say(c, name, 72, y + 36, `700 28px ${FONT.head}`, "#f4efe2", "left", 260);
        if (cs) say(c, cs, 360, y + 36, `500 24px ${FONT.num}`, "#c9d6e2", "left", 300);
        if (res) say(c, res, W - 40, y + 36, `600 26px ${FONT.num}`, sg > 0 ? GAIN : sg < 0 ? LOSS : "#e9eef2", "right", 300);
      });
      if (m.win) say(c, m.win, W / 2, H - 22, `700 28px ${FONT.head}`, "#f2c14e", "center");
    },
    goal(c, m, W, H) {
      const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#123a35"); bg.addColorStop(1, "#0c2422"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(242,193,78,0.6)"; c.lineWidth = 3; rrect(c, 10, 10, W - 20, H - 20, 14); c.stroke();
      say(c, "Obiettivo comune", 36, 62, `700 40px ${FONT.head}`, "#f2c14e");
      if (m.giorno) say(c, m.giorno, W - 36, 60, `500 24px ${FONT.head}`, "#9cc7bd", "right");
      if (m.empty) {
        say(c, "Il fondo parte il 26/11 da 80.000 USDT", 36, 150, `600 34px ${FONT.head}`, "#f4efe2", "left", W - 72);
        say(c, "Si vince in squadra: tutto il denaro si divide tra tutti", 36, 200, `400 24px ${FONT.read}`, "#cfe3dc", "left", W - 72);
        say(c, m.days, 36, 300, `600 28px ${FONT.head}`, "#f4efe2", "left", W - 72);
        return;
      }
      say(c, "Il fondo della scuola", 36, 116, `500 24px ${FONT.head}`, "#9cc7bd");
      say(c, m.fund + " USDT", 36, 172, `700 54px ${FONT.num}`, "#f4efe2", "left", W - 280);
      say(c, m.pct, W - 36, 170, `600 36px ${FONT.num}`, m.sign > 0 ? GAIN : m.sign < 0 ? LOSS : "#e9eef2", "right");
      const bx0 = 36, bw = W - 72, by = 200;
      c.fillStyle = "rgba(255,255,255,0.1)"; rrect(c, bx0, by, bw, 26, 13); c.fill();
      c.fillStyle = m.sign >= 0 ? "#4fd18b" : "#e9a23b"; rrect(c, bx0, by, max(26, bw * m.bar), 26, 13); c.fill();
      c.fillStyle = "#f2c14e"; c.fillRect(bx0 + bw * m.mark - 2, by - 8, 4, 42);
      say(c, "su " + m.start + " USDT di partenza", bx0 + bw * m.mark, by + 58, `500 20px ${FONT.head}`, "#cfe3dc", "center");
      say(c, m.days, 36, 330, `600 28px ${FONT.head}`, "#f4efe2", "left", W - 72);
      say(c, m.tesi, 36, 382, `400 26px ${FONT.read}`, "#cfe3dc", "left", W - 72);
      say(c, "Si vince in squadra: tutto il denaro si divide tra tutti", 36, 428, `italic 400 20px ${FONT.read}`, "#9cc7bd", "left", W - 72);
    },
    palestra(c, m, W, H) {
      c.fillStyle = "#f7f8f6"; c.fillRect(0, 0, W, H);
      c.fillStyle = "rgba(30,60,120,0.04)"; c.fillRect(0, 0, W, 6);
      if (m.empty) { say(c, "La prossima palestra è", W / 2, H / 2 - 16, `600 54px ${FONT.hand}`, "#1d4fa8", "center"); say(c, "domenica alle 11:13", W / 2, H / 2 + 46, `600 54px ${FONT.hand}`, "#1d4fa8", "center"); return; }
      if (m.life) { let y = 70; for (const l of m.life) for (const r of wrapLines(c, l, `600 40px ${FONT.hand}`, W - 80, 2)) { if (y > H - 20) break; say(c, r, 40, y, `600 40px ${FONT.hand}`, "#1d3f8a"); y += 50; } return; }
      say(c, m.title, 40, 66, `700 52px ${FONT.hand}`, "#c0392b");
      m.rows.forEach(([k, name, t], i) => { const y = 136 + i * 66; say(c, name, 40, y, `700 44px ${FONT.hand}`, "#1d3f8a"); say(c, t, 300, y, `600 42px ${FONT.hand}`, "#222", "left", W - 330); });
      if (m.q) for (const [i, r] of wrapLines(c, "Lo Scettico: " + m.q, `600 32px ${FONT.hand}`, W - 80, 2).entries()) say(c, r, 40, 420 + i * 40, `600 32px ${FONT.hand}`, "#6a4ce2");
    },
    post(c, m, W, H) { paintPosters(c, W, H); },
  };
  const SIZES = { board: [1024, 320], motore: [512, 320], ticker: [2048, 64], price: [1024, 512], mon: [1024, 512], gara: [1024, 512], goal: [1024, 460], palestra: [1024, 512], post: [1024, 512] };
  const DATAKEYS = { motore: ["giudizio"], ticker: ["giudizio"], price: ["giudizio", "ultimo"], mon: ["giudizio", "regole", "ultimo"], gara: ["gare"], goal: ["giudizio", "regole", "ultimo", "programma"], palestra: ["palestre", "memoria"] };
  function makeSurfaces() {
    for (const [name, [W, H]] of Object.entries(SIZES)) {
      const cv = document.createElement("canvas"), tex = new T.CanvasTexture(cv);
      tex.encoding = T.sRGBEncoding;
      const pot = (W & (W - 1)) === 0 && (H & (H - 1)) === 0;
      if (!pot) { tex.minFilter = T.LinearFilter; tex.generateMipmaps = false; }
      tex.anisotropy = min(4, ctx.renderer && ctx.renderer.capabilities ? ctx.renderer.capabilities.getMaxAnisotropy() : 1);
      if (name === "ticker") { tex.wrapS = T.ClampToEdgeWrapping; tex.offset.x = ctx.reduceMotion ? 0 : -1; }
      SURF[name] = { name, W, H, cv, c: cv.getContext("2d"), tex, key: null, last: -1e9, checked: -1e9, dirty: true, texts: [], scale: 0 };
    }
  }
  function paintSurf(name, force) {
    const s = SURF[name];
    if (!s) return;
    const sc = surfaceScale();
    let m;
    try { m = MODELS[name](); } catch (e) { warnOnce(name, e); return; }
    const key = JSON.stringify(m) + "|" + sc;
    s.dirty = false; s.checked = performance.now();
    if (!force && key === s.key) return;
    s.key = key; s.last = performance.now();
    if (s.scale !== sc) { s.cv.width = Math.round(s.W * sc); s.cv.height = Math.round(s.H * sc); s.scale = sc; }
    const c = s.c;
    c.setTransform(sc, 0, 0, sc, 0, 0); c.clearRect(0, 0, s.W, s.H); c.textBaseline = "alphabetic";
    TXT = []; try { PAINT[name](c, m, s.W, s.H); s.texts = TXT; } catch (e) { warnOnce(name, e); } TXT = null;
    s.tex.needsUpdate = true;
  }
  let scaleVal = 1;
  const surfaceScale = () => (world.surfaceScale === 0.5 ? 0.5 : 1);
  function tickerPaging() {
    const items = priceList(), c = SURF.ticker.c, out = [];
    let page = [], wsum = 28;
    c.font = `700 30px ${FONT.num}`;
    for (const it of items) { const w = c.measureText(it[0] + " " + it[1]).width + 56; if (wsum + w > 2000 && page.length) { out.push(page); page = []; wsum = 28; } page.push(it); wsum += w; }
    out.push(page);
    tickerPages = out; tickerPage = tickerPage % out.length;
  }
  // the poster atlas: name plates, dorm posters, diplomas, menu, crest, map, clock labels, the gate sign
  function paintPosters(c) {
    const at = (name, fn) => { const [x, y, w, h] = POSTER[name]; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); fn(w, h); c.restore(); };
    KEYS.forEach((k, i) => at("plate" + i, (w, h) => {
      c.fillStyle = "#" + C.COLORS[k].toString(16).padStart(6, "0"); c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(0, 0, w, 4);
      say(c, C.NAMES[k], w / 2, 45, `700 36px ${FONT.head}`, "#ffffff", "center", w - 20);
    }));
    at("candles", (w, h) => {
      c.fillStyle = "#0e1a26"; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(255,255,255,0.08)";
      for (let y = 20; y < 200; y += 30) { c.beginPath(); c.moveTo(6, y); c.lineTo(w - 6, y); c.stroke(); }
      let v = 120; const R = U.rng("candles");
      for (let i = 0; i < 14; i++) { const o = v, cl = v + (R() - 0.55) * 30; const hi = Math.min(o, cl) - R() * 12, lo = Math.max(o, cl) + R() * 12; const x = 10 + i * 8; c.strokeStyle = c.fillStyle = cl < o ? "#3bd16f" : "#e0524f"; c.beginPath(); c.moveTo(x + 2.5, hi); c.lineTo(x + 2.5, lo); c.stroke(); c.fillRect(x, Math.min(o, cl), 5, max(2, abs(cl - o))); v = cl; }
      say(c, "FALCO", w / 2, 236, `700 26px ${FONT.head}`, "#3d93f0", "center");
    });
    at("hawk", (w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#7fb3e6"); g.addColorStop(1, "#e8f1fa"); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = "#1d2a3a"; c.beginPath(); c.moveTo(64, 95); c.quadraticCurveTo(30, 70, 4, 82); c.quadraticCurveTo(34, 92, 50, 108); c.lineTo(58, 140); c.lineTo(64, 128); c.lineTo(70, 140); c.lineTo(78, 108); c.quadraticCurveTo(94, 92, 124, 82); c.quadraticCurveTo(98, 70, 64, 95); c.fill();
      c.beginPath(); c.arc(64, 96, 7, 0, 7); c.fill();
      say(c, "FALCO", w / 2, 222, `700 30px ${FONT.head}`, "#1d2a3a", "center");
    });
    at("paura", (w, h) => { c.fillStyle = "#ef6a26"; c.fillRect(0, 0, w, h); ["COMPRA", "LA", "PAURA"].forEach((t, i) => say(c, t, w / 2, 80 + i * 48, `800 34px ${FONT.head}`, "#1a1a1a", "center", w - 12)); c.fillStyle = "#1a1a1a"; c.fillRect(20, 210, w - 40, 6); });
    at("question", (w, h) => { c.fillStyle = "#5b3fd0"; c.fillRect(0, 0, w, h); say(c, "?", w / 2, 190, `800 190px ${FONT.read}`, "#f4efe2", "center"); say(c, "Quale prova?", w / 2, 236, `600 18px ${FONT.head}`, "#e8e0ff", "center"); });
    at("menu", (w, h) => { c.fillStyle = "#24302b"; c.fillRect(0, 0, w, h); say(c, "Mensa", w / 2, 40, `700 30px ${FONT.hand}`, "#f2c14e", "center"); ["Caffè", "Cappuccino", "Tè", "Spremuta", "Panini", "Frutta"].forEach((t, i) => say(c, t, w / 2, 84 + i * 28, `600 24px ${FONT.hand}`, "#eef2ea", "center")); });
    for (const [name, t] of [["diplomaA", "Diploma"], ["diplomaB", "Laurea"]]) at(name, (w, h) => {
      c.fillStyle = "#f3ead2"; c.fillRect(0, 0, w, h); c.strokeStyle = "#b8913a"; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
      say(c, t, w / 2, 44, `italic 700 24px ${FONT.read}`, "#5a3a26", "center");
      c.fillStyle = "rgba(90,58,38,0.35)"; for (let i = 0; i < 3; i++) c.fillRect(24, 62 + i * 12, w - 48, 3);
      c.fillStyle = "#b8243a"; c.beginPath(); c.arc(w - 30, h - 28, 12, 0, 7); c.fill();
    });
    at("news", (w, h) => {
      c.fillStyle = "#f1ede2"; c.fillRect(0, 0, w, h); say(c, "IL CRONISTA", w / 2, 22, `700 17px ${FONT.read}`, "#1b1b1b", "center"); c.fillStyle = "#1b1b1b"; c.fillRect(8, 28, w - 16, 2);
      c.fillStyle = "#333"; c.fillRect(8, 36, w - 16, 9); c.fillStyle = "#9a9a9a"; c.fillRect(8, 52, 52, 40); c.fillStyle = "#8c8c8c";
      for (let i = 0; i < 9; i++) { c.fillRect(66, 52 + i * 8, 54, 3); if (i > 5) c.fillRect(8, 52 + i * 8, 52, 3); }
      for (let i = 0; i < 3; i++) c.fillRect(8, 104 + i * 8, w - 16, 3);
    });
    at("crest", (w, h) => {
      c.fillStyle = "#f3ead2"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#b8243a"; c.beginPath(); c.moveTo(34, 14); c.lineTo(94, 14); c.lineTo(94, 60); c.quadraticCurveTo(94, 88, 64, 100); c.quadraticCurveTo(34, 88, 34, 60); c.closePath(); c.fill();
      c.strokeStyle = "#d9b96a"; c.lineWidth = 3; c.stroke(); c.fillStyle = "#f2c14e"; c.beginPath(); c.arc(64, 52, 16, 0, 7); c.fill(); c.fillStyle = "#b8243a"; c.fillRect(60, 40, 8, 24);
      say(c, "Scuola Cripto", w / 2, 120, `700 15px ${FONT.read}`, "#5a3a26", "center");
    });
    at("motto", (w, h) => { c.fillStyle = "#f4efe2"; c.fillRect(0, 0, w, h); ["Prima il", "ragionamento,", "poi la disciplina,", "per ultimo", "il risultato"].forEach((t, i) => say(c, t, w / 2, 26 + i * 21, `italic 600 15px ${FONT.read}`, "#5a3a26", "center", w - 10)); });
    at("rischio", (w, h) => { c.fillStyle = "#0f3d36"; c.fillRect(0, 0, w, h); c.fillStyle = "#19b496"; c.beginPath(); c.moveTo(40, 18); c.lineTo(88, 18); c.lineTo(88, 50); c.quadraticCurveTo(88, 72, 64, 82); c.quadraticCurveTo(40, 72, 40, 50); c.closePath(); c.fill(); ["Il rischio", "prima di tutto"].forEach((t, i) => say(c, t, w / 2, 102 + i * 18, `700 15px ${FONT.head}`, "#f4efe2", "center")); });
    at("gate", (w, h) => { c.fillStyle = "#2b2420"; c.fillRect(0, 0, w, h); say(c, "Scuola Cripto", w / 2, 44, `700 34px ${FONT.read}`, "#e8cf8a", "center", w - 16); });
    at("map", (w, h) => { c.fillStyle = "#cfe2ec"; c.fillRect(0, 0, w, h); c.fillStyle = "#b9a77a"; for (const [x, y, rx, ry] of [[50, 50, 30, 22], [70, 92, 14, 24], [128, 45, 26, 16], [134, 82, 18, 26], [184, 52, 40, 20], [210, 98, 16, 10]]) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); } c.strokeStyle = "#5a3a26"; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); });
    at("gym", (w, h) => { c.fillStyle = "#1d4fa8"; c.fillRect(0, 0, w, h); c.fillStyle = "#f4efe2"; c.beginPath(); c.arc(64, 52, 22, 0, 7); c.fill(); c.fillStyle = "#1d4fa8"; c.beginPath(); c.arc(64, 56, 12, 0, 7); c.fill(); say(c, "Prima la forma", w / 2, 108, `700 16px ${FONT.head}`, "#f4efe2", "center"); });
    at("landscape", (w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#f6d7a0"); g.addColorStop(1, "#bfe0c4"); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = "#f2a65a"; c.beginPath(); c.arc(92, 40, 14, 0, 7); c.fill(); c.fillStyle = "#4f8a4a"; c.beginPath(); c.moveTo(0, 90); c.quadraticCurveTo(40, 60, 80, 86); c.quadraticCurveTo(110, 70, 128, 84); c.lineTo(128, 128); c.lineTo(0, 128); c.fill(); c.fillStyle = "#2f6a3e"; c.beginPath(); c.ellipse(40, 110, 12, 7, 0, 0, 7); c.fill(); say(c, "Piano piano", w / 2, 124, `600 14px ${FONT.hand}`, "#1f3b25", "center"); });
    at("ledger", (w, h) => { c.fillStyle = "#f3ecd8"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9b98f"; for (let y = 34; y < h; y += 14) { c.beginPath(); c.moveTo(6, y); c.lineTo(w - 6, y); c.stroke(); } say(c, "Prezzo · Funding · Costi", w / 2, 22, `700 11px ${FONT.head}`, "#6a3b26", "center", w - 8); c.fillStyle = "#d99400"; c.fillRect(42, 30, 2, h - 36); c.fillRect(86, 30, 2, h - 36); });
    [["clock_roma", "Roma"], ["clock_ny", "New York"], ["clock_tokyo", "Tokyo"]].forEach(([n, t]) => at(n, (w, h) => { c.fillStyle = "#1c2026"; c.fillRect(0, 0, w, h); say(c, t, w / 2, 28, `600 22px ${FONT.head}`, "#e9eef2", "center"); }));
  }

  // ---- 16. build
  let ctx = null, root = null, PICK = [], LIGHTS = [], ZONES = {}, MESH = {}, ready = false, ticker = { t: 0, page: 0 };
  const zoneOf = (room) => (!room ? "out" : room.startsWith("dorm_") ? (KEYS.indexOf(room.slice(5)) < 4 ? "dw" : "de") : room === "portico" || room === "cortile" ? "garden" : room);
  const WALLST = WALLS.map(() => ({ h: WALL_H, target: WALL_H }));
  let focusHint = null;
  function build(cx) {
    ctx = cx; T = cx.THREE || window.THREE;
    const scene = cx.scene;
    if (!T || !scene) throw new Error("Campus.world.build: THREE and ctx.scene are required");
    IDM = new T.Matrix4(); FR = new T.Matrix4(); TMP = new T.Matrix4(); LOC = new T.Matrix4(); QT = new T.Quaternion(); EU = new T.Euler(); VA = new T.Vector3(); VB = new T.Vector3();
    RND = U.rng("scuola-cripto|campus");
    Object.assign(B, { walls: bucket(), floor: bucket(true), glow: bucket(), glass: bucket(), glassRoom: [], water: bucket(), spray: bucket(), mon: bucket(), post: bucket() });
    ZONES = {}; B.zone = (z) => ZONES[z] || (ZONES[z] = { m: bucket(), g: bucket() });
    INST = {}; LAMPS.length = 0; AO.length = 0; SURFM.length = 0; CLOCKS.length = 0;
    buildWalls(); buildFloors();
    for (const e of ITEMS) {
      const f = BUILD[e.t];
      if (!f) continue;
      CUR = B.zone(zoneOf(e.room)); WALLI = e.wall ? wallById[e.wall].i : 0; CUR_R = e.r;
      FR.makeRotationY(e.r).setPosition(e.x, 0, e.z);
      f(e);
      WALLI = 0;
    }
    CUR = B.zone("garden"); FR.identity(); buildArcade();
    root = new T.Group(); root.name = "campus-world";
    const mk = (geom, mat, o = {}) => { const m = new T.Mesh(geom, mat); m.castShadow = !!o.cast; m.receiveShadow = !!o.recv; m.matrixAutoUpdate = false; m.updateMatrix(); if (o.order) m.renderOrder = o.order; root.add(m); return m; };
    const VC = { vertexColors: true };
    MESH.floor = mk(toGeometry(B.floor), std("floor", Object.assign({ roughness: 0.84, metalness: 0 }, VC), { floor: true }), { recv: true });
    MESH.walls = mk(toGeometry(B.walls), std("walls", Object.assign({ roughness: 0.93, side: T.DoubleSide }, VC), { cap: true }), { cast: true, recv: true });
    MESH.walls.customDepthMaterial = hook(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), "wdepth", {});
    for (const [z, b] of Object.entries(ZONES)) {
      if (b.m.n) mk(toGeometry(b.m), std("matte", Object.assign({ roughness: 0.78 }, VC)), { cast: true, recv: true });
      if (b.g.n) mk(toGeometry(b.g), std("gloss", Object.assign({ roughness: 0.32, metalness: 0.12 }, VC)), { cast: z !== "garden", recv: true });
    }
    if (B.glow.n) mk(toGeometry(B.glow), basic("glow", Object.assign({ toneMapped: false }, VC)));
    if (B.water.n) mk(toGeometry(B.water), std("water", { color: 0x2f6e80, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.86 }, { water: true }), { recv: true, order: 2 });
    if (B.spray.n) mk(toGeometry(B.spray), basic("spray", { color: 0xe6f4f8, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide }), { order: 4 });
    const gg = toGeometry(B.glass); gg.setAttribute("aRoom", new T.Float32BufferAttribute(B.glassRoom, 1));
    MESH.glass = mk(gg, std("glass", { color: 0x9fc6d6, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide, emissive: 0xffffff }, { glass: true }), { order: 5 });
    // the instanced items
    const instMat = std("inst", Object.assign({ roughness: 0.74 }, VC));
    const crownMat = std("crown", Object.assign({ roughness: 0.92 }, VC), { sway: true });
    const glowMat = { shade: std("shade", { color: 0xf2e8d2, roughness: 0.75, side: T.DoubleSide, emissive: 0xffffff }, { emis: true }), globe: std("globe", { color: 0xf6f1e6, roughness: 0.25, emissive: 0xffffff }, { emis: true }) };
    const colr = new T.Color();
    for (const [kind, list] of Object.entries(INST)) {
      if (!list.length || !PROTOS[kind]) continue;
      if (kind === "book") for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(RND() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      const geom = protoGeo(PROTOS[kind]), glow = kind === "shade" || kind === "globe";
      if (glow) geom.setAttribute("aWall", new T.InstancedBufferAttribute(new Float32Array(list.map((x) => x.wall || 0)), 1));
      const im = new T.InstancedMesh(geom, glow ? glowMat[kind] : kind.startsWith("cr_") ? crownMat : instMat, list.length);
      list.forEach((x, i) => { im.setMatrixAt(i, x.m); im.setColorAt(i, glow ? colr.setRGB(0, 0, 0) : colr.setHex(x.c).convertSRGBToLinear()); });
      im.frustumCulled = false;
      im.castShadow = !glow && kind !== "book" && kind !== "monitor";
      im.receiveShadow = !glow;
      root.add(im); MESH[kind] = im;
    }
    // clock hands, contact shadows and pools of light
    if (CLOCKS.length) {
      const hg = protoGeo(() => bx(1, 1, 1, 0, 0.5, 0, 0x16181b));
      hg.setAttribute("aWall", new T.InstancedBufferAttribute(new Float32Array(CLOCKS.flatMap((k) => [k.wall, k.wall])), 1));
      MESH.hands = new T.InstancedMesh(hg, std("hands", Object.assign({ roughness: 0.5 }, VC)), CLOCKS.length * 2);
      MESH.hands.frustumCulled = false; root.add(MESH.hands); clocks(true);
    }
    MESH.ao = decalMesh(AO, false);
    AO.forEach(([x, y, z, sx, sz, ry, k, f], i) => { LOC.makeRotationY(ry).scale(VA.set(sx, 1, sz)).setPosition(x, y, z); MESH.ao.setMatrixAt(i, LOC); MESH.ao.setColorAt(i, colr.setRGB(k, f, 0)); });
    root.add(MESH.ao);
    // a soft warm spill over each interior room, lit with its lamps, so the rooms read at night from afar
    const spill = (room, x, z, r) => LAMPS.push({ x, y: 1.5, z, room, wall: 0, kind: "room", glow: null, pool: [x, 0.008, z, r, 0.5], level: 0, target: 0, warm: 0xffc98a, power: 1 });
    for (const r of rooms) {
      const q = r.rects[0], w = q[2] - q[0], d = q[3] - q[1], n = d > 12 ? 2 : 1;
      if (r.kind === "dormitorio") spill(r.id, q[0] + 3, 16.2, 3.3);
      else if (r.kind === "interno") for (let i = 0; i < n; i++) spill(r.id, (q[0] + q[2]) / 2, q[1] + d * (i + 0.5) / n, min(w, d / n) * 0.5);
    }
    const pools = LAMPS.filter((l) => l.pool);
    MESH.pools = decalMesh(pools, true);
    pools.forEach((l, i) => { l.pi = i; LOC.makeScale(l.pool[3] * 2, 1, l.pool[3] * 2).setPosition(l.pool[0], l.pool[1], l.pool[2]); MESH.pools.setMatrixAt(i, LOC); MESH.pools.setColorAt(i, colr.setRGB(0, 0, 0)); });
    root.add(MESH.pools);
    // the canvas surfaces
    if (C.render && C.render.quality === "low" && world.surfaceScale !== 0.5) world.surfaceScale = 0.5;
    lastScale = surfaceScale();
    makeSurfaces();
    tickerPaging();
    const surfMat = (name) => {
      const tex = SURF[name].tex;
      if (name === "board" || name === "palestra") return std("s_" + name, { map: tex, roughness: name === "board" ? 0.95 : 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: name === "board" ? 0.22 : 0.18 });
      if (name === "post") return std("s_post", { map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1 });
      return basic("s_" + name, { map: tex, toneMapped: false });
    };
    const uvOf = (name) => { const [x, y, w, h] = POSTER[name] || [0, 0, 1, 1]; return [x / 1024, 1 - (y + h) / 512, (x + w) / 1024, 1 - y / 512]; };
    for (const s of SURFM) {
      if (s.name === "mon") { const i = MONCELL.indexOf(s.cell), x = (i % 4) * 256, y = (i >> 2) * 160; quad(B.mon, s.m, s.w, s.h, 0xffffff, [x / 1024, 1 - (y + 160) / 512, (x + 256) / 1024, 1 - y / 512]); continue; }
      if (s.name === "post") { quad(B.post, s.m, s.w, s.h, 0xffffff, uvOf(s.cell), { wall: s.wall }); continue; }
      const b = bucket(false);
      quad(b, s.m, s.w, s.h, 0xffffff, [0, 0, 1, 1], { wall: s.wall });
      mk(toGeometry(b), surfMat(s.name), { recv: s.name === "board" || s.name === "palestra" });
    }
    if (B.mon.n) mk(toGeometry(B.mon), surfMat("mon"));
    if (B.post.n) mk(toGeometry(B.post), surfMat("post"), { recv: true });
    // invisible floors to pick rooms on
    PICK = [];
    const pm = new T.MeshBasicMaterial({ visible: false });
    for (const r of rooms) for (const q of r.rects) {
      const m = new T.Mesh(new T.PlaneGeometry(q[2] - q[0], q[3] - q[1]).rotateX(-HP), pm);
      m.position.set((q[0] + q[2]) / 2, 0.01, (q[1] + q[3]) / 2); m.visible = false; m.userData.room = r.id; m.updateMatrixWorld(true);
      root.add(m); PICK.push(m);
    }
    // the pool of point lights: exactly render.lightBudget, never added or removed afterwards
    const n = C.render && [2, 4, 6].includes(C.render.lightBudget) ? C.render.lightBudget : 4;
    LIGHTS = [];
    for (let i = 0; i < n; i++) { const l = new T.PointLight(0xffd59a, 0, 9, 2); l.position.set(0, -50, 0); l.userData.lamp = -1; root.add(l); LIGHTS.push(l); }
    scene.add(root);
    root.updateMatrixWorld(true);
    // data and fonts
    bus.on("data:change", ({ keys }) => {
      for (const [name, ks] of Object.entries(DATAKEYS)) if (keys.some((k) => ks.includes(k) || k === "unavailable")) SURF[name].dirty = true;
      if (keys.includes("giudizio")) { tickerPaging(); SURF.ticker.dirty = true; }
    });
    bus.on("render:restored", () => { for (const s of Object.values(SURF)) s.tex.needsUpdate = true; });
    for (const name of Object.keys(SURF)) paintSurf(name, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tickerPaging(); for (const name of Object.keys(SURF)) paintSurf(name, true); }).catch(() => {});
    lampsUpdate(1, true);
    ready = world.ready = true;
    bus.emit("world:ready", { rooms, anchors: ANC });
  }

  // ---- 17. update: the cutaway, the lamps and their lights, the ticker, the clocks, the surfaces
  const camPos = { x: 0, y: 44, z: 46 }, camTgt = { x: 0, z: 0 };
  const segX = (ax, az, bx2, bz, cx2, cz, dx, dz) => {
    const d1x = bx2 - ax, d1z = bz - az, d2x = dx - cx2, d2z = dz - cz, den = d1x * d2z - d1z * d2x;
    if (abs(den) < 1e-9) return false;
    const t = ((cx2 - ax) * d2z - (cz - az) * d2x) / den, u = ((cx2 - ax) * d1z - (cz - az) * d1x) / den;
    return t > 0 && t < 1 && u >= 0 && u <= 1;
  };
  function focusPoint() {
    const r = focusHint || (C.render && C.render.focusRoom) || null;
    const c = r && centreOf(r);
    if (c) return { room: r, x: c.x, z: c.z };
    let best = null, bd = 1e9;
    for (const rm of rooms) { const p = centreOf(rm.id); const d = hyp(p.x - camTgt.x, p.z - camTgt.z); if (d < bd) { bd = d; best = rm.id; } }
    const p = centreOf(best);
    return { room: best, x: p.x, z: p.z };
  }
  function cutaway(dt) {
    const cam = ctx.camera || (C.render && C.render.camera);
    if (!cam) return;
    camPos.x = cam.position.x; camPos.y = cam.position.y; camPos.z = cam.position.z;
    cam.getWorldDirection(VA);
    if (VA.y < -0.05) { const t = (0.8 - camPos.y) / VA.y; camTgt.x = camPos.x + VA.x * t; camTgt.z = camPos.z + VA.z * t; } else { camTgt.x = camPos.x + VA.x * 20; camTgt.z = camPos.z + VA.z * 20; }
    const f = focusPoint(), speed = (WALL_H - LOW_H) / 0.4, H = UNI.wallH.value;
    WALLS.forEach((w, n) => {
      let low = false;
      if (w.out) { const dx = camPos.x - w.cx, dy = camPos.y - 1.6, dz = camPos.z - w.cz, l = hyp(dx, dy, dz) || 1; low = (w.nx * dx + w.nz * dz) / l > 0.2; }
      if (!low && f) low = segX(camPos.x, camPos.z, f.x, f.z, w.x0, w.z0, w.x1, w.z1);
      const st = WALLST[n]; st.target = low ? LOW_H : WALL_H;
      st.h = ctx.reduceMotion ? st.target : st.h < st.target ? min(st.target, st.h + speed * dt) : max(st.target, st.h - speed * dt);
      H[w.i] = st.h >= WALL_H - 1e-4 ? 99 : st.h + 0.002;
    });
  }
  const occupied = new Set(), asleep = new Set();
  let occAcc = 9, lightAcc = 9;
  function lampsUpdate(dt, instant) {
    const sky = C.render && C.render.sky, now = C.clock.now();
    const sun = sky && U.isNum(sky.sunAltDeg) ? null : U.sun(now);
    const night = sky && U.isNum(sky.night) ? sky.night : U.nightOf(sun.altDeg), alt = sky && U.isNum(sky.sunAltDeg) ? sky.sunAltDeg : sun.altDeg;
    UNI.night.value = night;
    occAcc += dt;
    if (occAcc > 1) {
      occAcc = 0; occupied.clear(); asleep.clear();
      if (C.people && C.people.ready && C.ctx && C.ctx.has3d) for (const k of KEYS) {
        const p = C.people.positionOf(k), r = p && roomAt(p.x, p.z);
        if (r) (C.people.stateOf(k) === "sleep" ? asleep : occupied).add(r);
      }
    }
    const lit = UNI.roomLit.value; lit.fill(0);
    const colr = TMPC || (TMPC = new T.Color());
    let changed = false, poolChanged = false;
    LAMPS.forEach((l, i) => {
      const hidden = l.wall && UNI.wallH.value[l.wall] < l.y;
      // a room's lights are on when someone awake is in it after sunset; a sleeper's dorm keeps only a
      // dim glow (the Guardiano his night light); outside, the passages and the street: on after dark
      const kind = l.room && roomById[l.room] ? roomById[l.room].kind : "esterno";
      const interior = kind === "interno" || kind === "dormitorio";
      l.target = hidden ? 0 : !interior ? (night > 0.35 ? 1 : 0)
        : l.kind === "night" ? (night > 0.35 && asleep.has(l.room) ? 1 : 0)
          : occupied.has(l.room) && alt < 15 ? 1
            : l.kind === "room" && kind === "dormitorio" && asleep.has(l.room) ? 0.16 * night : 0;
      const prev = l.level;
      l.level = instant || ctx.reduceMotion ? l.target : U.damp(l.level, l.target, 4, dt);
      if (abs(l.level - l.target) < 0.004) l.level = l.target;
      if (l.room) lit[ROOMIX[l.room]] = max(lit[ROOMIX[l.room]], l.level);
      if (abs(prev - l.level) > 1e-4 || instant) {
        const im = l.glow && MESH[l.glow[0]], gi = l.glow && l.glow[1];
        if (im) { colr.setHex(l.warm).convertSRGBToLinear().multiplyScalar(l.level * 2.4 * min(1.2, l.power + 0.2)); im.setColorAt(gi, colr); changed = true; }
        if (l.pi !== undefined && MESH.pools) { colr.setHex(l.warm).convertSRGBToLinear().multiplyScalar(l.level * l.pool[4] * 0.55); MESH.pools.setColorAt(l.pi, colr); poolChanged = true; }
      }
    });
    if (changed) for (const k of ["shade", "globe"]) if (MESH[k] && MESH[k].instanceColor) MESH[k].instanceColor.needsUpdate = true;
    if (poolChanged && MESH.pools.instanceColor) { MESH.pools.instanceColor.needsUpdate = true; MESH.pools.visible = LAMPS.some((l) => l.pool && l.level > 0.003); }
    // the pooled point lights follow the lit lamps nearest the focus
    lightAcc += dt;
    if (lightAcc > 0.25 || instant) {
      lightAcc = 0;
      const f = focusPoint(), fx = f ? f.x : camTgt.x, fz = f ? f.z : camTgt.z;
      const cand = LAMPS.map((l, i) => [i, l]).filter(([, l]) => l.level > 0.05 && l.kind !== "night" && l.kind !== "room").sort((a, b) => hyp(a[1].x - fx, a[1].z - fz) - hyp(b[1].x - fx, b[1].z - fz)).slice(0, LIGHTS.length).map(([i]) => i);
      const free = LIGHTS.filter((L0) => !cand.includes(L0.userData.lamp));
      for (const i of cand) if (!LIGHTS.some((L0) => L0.userData.lamp === i)) { const L0 = free.shift(); if (L0) { L0.userData.lamp = i; const l = LAMPS[i]; L0.position.set(l.x, l.y - (l.kind === "street" || l.kind === "post" ? 0.3 : 0.05), l.z); } }
      for (const L0 of free) L0.userData.lamp = -1;
    }
    for (const L0 of LIGHTS) {
      const l = LAMPS[L0.userData.lamp], want = l ? l.level * (l.kind === "street" || l.kind === "post" ? 1.5 : l.kind === "candle" ? 0.5 : 1.05) * l.power : 0;
      L0.intensity = instant ? want : U.damp(L0.intensity, want, 6, dt);
    }
  }
  let TMPC = null, clockAcc = 9;
  const TZF = {};
  function clocks(force) {
    if (!MESH.hands) return;
    const now = C.clock.now(), M = new T.Matrix4(), R2 = new T.Matrix4();
    CLOCKS.forEach((k, i) => {
      const f = TZF[k.tz] || (TZF[k.tz] = new Intl.DateTimeFormat("en-GB", { timeZone: k.tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }));
      const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value])), hh = +p.hour % 12, mm = +p.minute;
      [[(hh + mm / 60) / 12, k.rad * 0.55, 0.022], [mm / 60, k.rad * 0.82, 0.014]].forEach(([frac, len, w], j) => {
        M.makeRotationY(k.r).setPosition(k.x, k.y, k.z);
        R2.makeRotationZ(-frac * 2 * PI); M.multiply(R2); M.multiply(R2.makeScale(w, len, 0.006));
        MESH.hands.setMatrixAt(i * 2 + j, M);
      });
    });
    MESH.hands.instanceMatrix.needsUpdate = true;
  }
  let lastScale = 1, booksFull = 0;
  function update(dt, t) {
    if (!ready) return;
    if (!ctx.reduceMotion) UNI.t.value += dt;
    cutaway(dt);
    lampsUpdate(dt, false);
    // the ticker crawls; at the end of each crawl the next page of coins comes in
    const tk = SURF.ticker;
    if (ctx.reduceMotion) { ticker.t += dt; if (ticker.t > 12) { ticker.t = 0; tickerPage = (tickerPage + 1) % tickerPages.length; paintSurf("ticker"); } }
    else { tk.tex.offset.x += dt * 0.055; if (tk.tex.offset.x > 1) { tk.tex.offset.x = -1; tickerPage = (tickerPage + 1) % tickerPages.length; paintSurf("ticker"); } }
    clockAcc += dt; if (clockAcc > 5) { clockAcc = 0; clocks(); }
    // data-driven surfaces: at most once every 2 s each; time-driven ones are checked every 30 s
    const now = performance.now();
    for (const name of ["motore", "ticker", "price", "mon", "gara", "goal", "palestra"]) {
      const s = SURF[name];
      if (now - s.checked > 30000) s.dirty = true;
      if (s.dirty && now - s.checked >= 2000) paintSurf(name);
    }
    const sc = surfaceScale();
    if (sc !== lastScale) { lastScale = sc; for (const name of Object.keys(SURF)) paintSurf(name, true); }
    // fewer books on low quality
    if (MESH.book) { const want = C.render && C.render.quality === "low" ? Math.round(INST.book.length * 0.55) : INST.book.length; if (want !== booksFull) { booksFull = want; MESH.book.count = want; } }
  }

  // ---- 18. the public object
  const world = (C.world = {
    rooms, doors, bounds: frz([-24, -20, 24, 20]), anchors: frz(ANC),
    anchor: (id) => ANC[id] || null, anchorsIn, reserve, release, occupant, roomAt, findPath, clear, minimap,
    ready: false, build, update,
    pickables: () => PICK,
    // what can stand between the camera and a face: monitors, lamps, columns, trees (outdoor: trees only)
    // how lit a room is now (0..1), from its lamps
    litOf: (room) => (ROOMIX[room] ? UNI.roomLit.value[ROOMIX[room]] : 0),
    occluders: (outdoor) => Object.keys(MESH).filter((k) => MESH[k] && MESH[k].isInstancedMesh && (outdoor ? /^(cr_|trunk$)/ : /^(monitor|shade|globe|column|trunk|cr_)/).test(k)).map((k) => MESH[k]),
    setCutawayFocus: (room) => { focusHint = room && roomById[room] ? room : null; },
    surfaceScale: 1,
    surfaces: {
      board(lines, reveal = 1) { boardState.lines = Array.isArray(lines) && lines.length ? lines.map((l) => String(l ?? "")) : ["Scuola Cripto"]; boardState.reveal = U.isNum(reveal) ? reveal : 1; if (ready) paintSurf("board"); },
      motore(events, title) { motoreState.events = Array.isArray(events) ? events : null; motoreState.title = title || ""; if (ready) paintSurf("motore"); },
      palestra(lines) { palestraState.lines = Array.isArray(lines) ? lines.map((l) => String(l ?? "")) : null; if (ready) paintSurf("palestra"); },
      refresh(name) { if (!ready) return; if (!name || name === "ticker") tickerPaging(); for (const n of Object.keys(SURF)) if (!name || n === name) paintSurf(n, true); },
    },
    _obstacles: () => OBST.map((o) => ({ x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1, id: o.id })),
    _graph: () => { const g = graph(), edges = []; g.adj.forEach((l, i) => l.forEach(([j]) => { if (i < j) edges.push([g.nodes[i].id, g.nodes[j].id]); })); return { nodes: g.nodes.map((n) => ({ id: n.id, x: n.x, z: n.z, room: n.room })), edges }; },
    _texts: (name) => (name ? (SURF[name] ? SURF[name].texts.slice() : null) : Object.fromEntries(Object.entries(SURF).map(([k, s]) => [k, s.texts.slice()]))),
    _walls: () => WALLS.map((w, n) => ({ id: w.id, h: Math.round(WALLST[n].h * 100) / 100, target: WALLST[n].target })),
    _lamps: () => ({ total: LAMPS.length, on: LAMPS.filter((l) => l.target > 0.5).length, lit: LAMPS.filter((l) => l.level > 0.5).length, lights: LIGHTS.map((l) => Math.round(l.intensity * 100) / 100) }),
  });
})();
