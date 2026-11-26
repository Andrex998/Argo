/* campus/people.js · Campus.people (contract §5.3)
   The eight procedural humanoids of the Scuola Cripto. Each person is ONE skinned mesh (one draw
   call): body, layered clothes, hair, face (eyes that blink, brows, a mouth that talks) and props
   are merged into a vertex-coloured geometry bound to a hand-made skeleton of 43 bones. Props are
   bones scaled to zero when not in use. A pose library blends posture × state × time per joint;
   legs use two-bone IK so the feet never slide. Path following with steering and separation, and
   the DOM overlay (name tags, speech bubbles, thought clouds) live here too. */
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.people) return;
  const U = C.util, bus = C.bus, KEYS = C.KEYS;
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, abs = Math.abs, min = Math.min, max = Math.max, hyp = Math.hypot, sgn = Math.sign;
  const clamp = U.clamp, lerp = U.lerp, smooth = U.smooth;
  let T = null, ctx = null;

  // ---- the eight looks (Appendix C, §3.3)
  // h height · sw/hw shoulder/hip width · g girth · skin/eye/hair/brow/lip · sp walk speed (m/s)
  // gait: [step × h, arm swing (rad), bob (m), sway (m), foot lift (m), lean (rad)]
  const LOOK = {
    preside: { h: 1.78, sw: 0.96, hw: 0.98, g: 0.94, skin: 0xe8c4a0, eye: 0x8d969e, hair: 0xc9c6c0, brow: 0xa29d96, lip: 0xbe8a7c, sp: 1.05, gait: [0.36, 0.16, 0.009, 0.02, 0.065, 0.1] },
    falco: { h: 1.8, sw: 1.06, hw: 0.95, g: 1, skin: 0xd9a77f, eye: 0xb27a2c, hair: 0x3d2b1f, brow: 0x2b1e15, lip: 0xb07560, sp: 1.55, gait: [0.43, 0.42, 0.013, 0.012, 0.1, -0.02] },
    tartaruga: { h: 1.66, sw: 0.9, hw: 1.14, g: 1.12, fem: 1, skin: 0xc98f6a, eye: 0x5f8a4c, hair: 0x8e8a85, brow: 0x8a8580, lip: 0xa35a4c, sp: 0.85, gait: [0.33, 0.2, 0.008, 0.034, 0.055, 0.05] },
    spazzino: { h: 1.75, sw: 1, hw: 0.95, g: 0.9, skin: 0xb07850, eye: 0x3a2618, hair: 0x1b1714, brow: 0x1b1613, lip: 0x8a5642, sp: 1.25, gait: [0.4, 0.34, 0.014, 0.018, 0.09, 0.05] },
    ragioniere: { h: 1.7, sw: 0.92, hw: 0.94, g: 0.86, skin: 0xf0cfae, eye: 0x4f7fb5, hair: 0x161616, brow: 0x1c1c1c, lip: 0xc98a7e, sp: 1.15, gait: [0.38, 0.22, 0.011, 0.013, 0.08, 0.02] },
    guardiano: { h: 1.88, sw: 1.14, hw: 1.03, g: 1.15, skin: 0x7a4a2e, eye: 0x2e1d12, hair: 0x100e0d, brow: 0x141110, lip: 0x5a3122, sp: 1.2, gait: [0.41, 0.26, 0.012, 0.026, 0.085, 0] },
    cronista: { h: 1.72, sw: 1, hw: 0.98, g: 1, skin: 0xe0b08a, eye: 0x86683a, hair: 0x5e3d24, brow: 0x4a3020, lip: 0xb47864, sp: 1.35, gait: [0.41, 0.36, 0.014, 0.016, 0.09, 0.03] },
    scettico: { h: 1.76, sw: 0.95, hw: 0.93, g: 0.88, skin: 0xd6a985, eye: 0x6f8aa3, hair: 0x161616, brow: 0x161616, lip: 0xab7562, sp: 1.1, gait: [0.39, 0.22, 0.011, 0.015, 0.08, 0.04] },
  };
  // the item a person carries, reads, drinks from (Appendix C props)
  const ITEMS = {
    preside: { carry: "under", read: [0x9e1b2e, 0xd9b45a] },
    falco: { carry: "tablet", read: "tablet", cup: "mug" },
    tartaruga: { read: [0x3f6e46, 0xe6d9b8], cup: "tea", back: 1 },
    spazzino: { read: [0x6f7378, 0xd8d4c8], cup: "thermos" },
    ragioniere: { carry: "under", read: [0x5a3820, 0xc9a66b] },
    guardiano: { read: [0x24343c, 0xd8d4c8] },
    cronista: { carry: "note", read: [0x222226, 0xe9e3d3] },
    scettico: { read: [0x3d2f63, 0xd8d0bd], mag: 1 },
  };
  const BONES = "hips spine chest breath neck head jaw mouth smile eyeL eyeR lidL lidR browL browR hat clavL armL foreL handL idxL fingL thumbL clavR armR foreR handR idxR fingR thumbR thighL shinL footL thighR shinR footR back carry read page cup pen mag".split(" ");
  const B = {}; BONES.forEach((n, i) => (B[n] = i));
  const PARENT = { spine: "hips", chest: "spine", breath: "chest", neck: "chest", head: "neck", jaw: "head", mouth: "head", smile: "head", eyeL: "head", eyeR: "head", lidL: "head", lidR: "head", browL: "head", browR: "head", hat: "head", back: "chest", read: "chest", page: "read", cup: "handR", pen: "handR", mag: "handR" };
  // the read item's frame: width to the reader's right (-x), page-up away and up, face towards the eyes
  const BOOK = [[-1, 0, 0], [0, 0.6, 0.8], [0, 0.8, -0.6]];
  for (const s of "LR") Object.assign(PARENT, { ["clav" + s]: "chest", ["arm" + s]: "clav" + s, ["fore" + s]: "arm" + s, ["hand" + s]: "fore" + s, ["idx" + s]: "hand" + s, ["fing" + s]: "hand" + s, ["thumb" + s]: "hand" + s, ["thigh" + s]: "hips", ["shin" + s]: "thigh" + s, ["foot" + s]: "shin" + s });

  function joints(L) {
    const h = 1.75, s = 1;
    return {
      h, s, k: L.h / 1.75, hip: 0.53 * h, waist: 0.6 * h, chest: 0.705 * h, neck: 0.832 * h, head: 0.884 * h, hc: 0.929 * h, hz: 0.014,
      shX: 0.104 * h * L.sw, shY: 0.815 * h, clX: 0.02 * h, clY: 0.8 * h, elY: 0.629 * h, wrY: 0.483 * h,
      hipX: 0.051 * h * L.hw, knee: 0.285 * h, ank: 0.045 * h, thigh: 0.245 * h, shin: 0.24 * h,
      ha: 0.0458 * h, hb: 0.0668 * h, hd: 0.0565 * h,
    };
  }

  // ---- geometry: a quad grid, lofts, ellipsoids, merging with skin weights
  const lin = (hex) => { const c = new T.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
  function geo(pos, idx) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // surf(cols, rows, fn(c, r) -> [x,y,z]); o.wrap closes the columns, o.p0/o.p1: poles
  function surf(cols, rows, fn, o = {}) {
    const pos = [], idx = [], st = [], n = o.wrap ? cols : cols + 1;
    const pole = (r) => (r === 0 && o.p0) || (r === rows - 1 && o.p1);
    for (let r = 0; r < rows; r++) {
      st.push(pos.length / 3);
      if (pole(r)) { pos.push(...fn(0, r)); continue; }
      for (let c = 0; c < n; c++) pos.push(...fn(c, r));
    }
    const at = (r, c) => (pole(r) ? st[r] : st[r] + (o.wrap ? c % cols : c));
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
      const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c), e = at(r + 1, c + 1);
      if (a !== b) o.flip ? idx.push(a, e, b) : idx.push(a, b, e);
      if (d !== e) o.flip ? idx.push(a, d, e) : idx.push(a, e, d);
    }
    return geo(pos, idx);
  }
  // loft: rings [[y, rx, rz, cx, cz]] ascending in y; superellipse exponent o.n; o.open = [a0, a1]
  // (angles from the front, +z, towards +x); o.f(p, angle, ring) reshapes a point
  function loft(rings, seg, o = {}) {
    const e = 2 / (o.n || 2), op = o.open;
    return surf(seg, rings.length, (c, r) => {
      const [y, rx, rz, cx = 0, cz = 0] = rings[r];
      const a = op ? op[0] + ((op[1] - op[0]) * c) / seg : (TAU * c) / seg, sn = sin(a), k = cos(a);
      const p = [cx + rx * sgn(sn) * abs(sn) ** e, y, cz + rz * sgn(k) * abs(k) ** e];
      if (o.f) o.f(p, a, r);
      return p;
    }, { wrap: !op, p0: !op && rings[0][1] < 1e-5, p1: !op && rings[rings.length - 1][1] < 1e-5 });
  }
  // an ellipsoid with no seam; f(p, a, ph) may reshape (ph = 0 at the bottom pole)
  const ell = (rx, ry, rz, w, h, f) => surf(w, h + 1, (c, r) => {
    const ph = (PI * r) / h, a = (TAU * c) / w, sn = sin(ph), p = [rx * sn * sin(a), -ry * cos(ph), rz * sn * cos(a)];
    if (f) f(p, a, ph);
    return p;
  }, { wrap: true, p0: true, p1: true });
  const M4 = () => new T.Matrix4();
  const Box = (...a) => new T.BoxGeometry(...a), Cyl = (...a) => new T.CylinderGeometry(...a), Sph = (...a) => new T.SphereGeometry(...a), Tor = (...a) => new T.TorusGeometry(...a), Circ = (...a) => new T.CircleGeometry(...a);
  // a transform: position, Euler rotation, scale
  const TR = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => M4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));

  // weights: a bone index, or fn(x, y, z) -> [bone, w, bone, w, ...]
  // a chain along y (ascending joints): bone i owns [ys[i], ys[i+1]], blended ±bl around each joint
  const chainW = (bs, ys, bl) => (x, y) => {
    let i = 0;
    while (i < bs.length - 1 && y > ys[i + 1] - bl) i++;
    if (i > 0 && y < ys[i] + bl) { const t = smooth(ys[i] - bl, ys[i] + bl, y); return [bs[i], t, bs[i - 1], 1 - t]; }
    return [bs[i], 1];
  };
  // a hanging limb (descending joints): bone i owns [ys[i+1], ys[i]]
  const limbW = (bs, ys, bl) => (x, y) => {
    let i = 0;
    while (i < bs.length - 1 && y < ys[i + 1] + bl) i++;
    if (i > 0 && y > ys[i] - bl) { const t = smooth(ys[i] + bl, ys[i] - bl, y); return [bs[i], t, bs[i - 1], 1 - t]; }
    return [bs[i], 1];
  };

  // occ: capsules of the bind pose (see occluders); each vertex gets a baked, skin-warm ambient occlusion
  function merge(parts, occ) {
    let nv = 0, ni = 0;
    for (const p of parts) { nv += p.g.attributes.position.count; ni += p.g.index ? p.g.index.count : p.g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), mat = new Float32Array(nv * 2);
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let o = 0, oi = 0;
    for (const p of parts) {
      if (!p.g.attributes.normal) p.g.computeVertexNormals();
      const P = p.g.attributes.position.array, N = p.g.attributes.normal.array, n = P.length / 3, I = p.g.index ? p.g.index.array : Array.from({ length: n }, (_, i) => i);
      const kind = p.m[2] != null ? p.m[2] : p.m[0] >= 0.6 && !p.m[1] ? 3 : 0;
      for (let i = 0; i < n; i++) {
        const k = o + i, x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2], nx = N[3 * i], ny = N[3 * i + 1], nz = N[3 * i + 2];
        if (!(x === x && y === y && z === z)) throw new Error("people: NaN in part " + parts.indexOf(p) + " " + (p.dbg || ""));
        pos[3 * k] = x; pos[3 * k + 1] = y; pos[3 * k + 2] = z;
        nor[3 * k] = nx; nor[3 * k + 1] = ny; nor[3 * k + 2] = nz;
        const c = p.cf ? p.cf(x, y, z) : p.c;
        let s = 0;
        if (occ) for (const q of occ) {
          const ex = q[3] - q[0], ey = q[4] - q[1], ez = q[5] - q[2], l2 = ex * ex + ey * ey + ez * ez;
          const u = l2 ? clamp(((x - q[0]) * ex + (y - q[1]) * ey + (z - q[2]) * ez) / l2, 0, 1) : 0;
          const dx = q[0] + ex * u - x, dy = q[1] + ey * u - y, dz = q[2] + ez * u - z, d = hyp(dx, dy, dz) || 1e-4, cs = (dx * nx + dy * ny + dz * nz) / d;
          if (cs > 0) s += cs * min(1, (q[6] / d) ** 2);
        }
        const ao = 1 - min(0.48, s * 0.42);
        col[3 * k] = c[0] * (kind === 1 ? ao ** 0.75 : ao); col[3 * k + 1] = c[1] * ao * (kind === 1 ? 0.93 : 1); col[3 * k + 2] = c[2] * (kind === 1 ? 0.86 * ao ** 1.15 : ao);
        mat[2 * k] = p.m[0]; mat[2 * k + 1] = p.m[1] + 10 * kind;
        let w = typeof p.w === "number" ? [p.w, 1] : p.w(x, y, z);
        if (typeof w === "number") w = [w, 1];
        let sum = 0;
        for (let j = 0; j < 4; j++) { const b = j * 2 < w.length ? w[j * 2] : 0, ww = j * 2 < w.length ? w[j * 2 + 1] : 0; si[4 * k + j] = b; sw[4 * k + j] = ww; sum += ww; }
        for (let j = 0; j < 4; j++) sw[4 * k + j] /= sum || 1;
      }
      for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + o;
      o += n; oi += I.length;
      p.g.dispose();
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.BufferAttribute(nor, 3));
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    g.setAttribute("matp", new T.BufferAttribute(mat, 2));
    g.setAttribute("skinIndex", new T.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4));
    g.setIndex(new T.BufferAttribute(idx, 1));
    return g;
  }

  // ---- the head: one analytic surface shared by the skin, the hair and the beard
  function headFn(J, key, noSocket) {
    const a = J.ha, b = J.hb, c = J.hd, L = LOOK[key];
    const jaw = key === "guardiano" ? 0.05 : L.fem ? 0.2 : key === "ragioniere" || key === "scettico" ? 0.17 : 0.11;
    const ex = 0.42 * a;
    return (dx, dy, dz) => {
      let x = dx * a, y = dy * b, z = dz * c;
      if (dz < 0) z *= 1 + 0.12 * -dz * smooth(-0.75, -0.1, dy);
      if (dy > 0) x *= 1 + 0.3 * dy * dy;
      if (dy > 0.25) { y *= 1 - 0.09 * (dy - 0.25); if (dz > 0) z *= 1 - 0.12 * (dy - 0.25); }
      if (dy < 0) {
        const k = -dy;
        x *= 1 - jaw * k ** 1.6 - 0.16 * k ** 5;
        z *= dz > 0 ? 1 - 0.06 * k * k : 1 - 0.5 * k ** 1.5;
        y *= 1 + 0.04 * k;
      }
      // the face plane, then the brow ridge, cheekbones, the muzzle, the chin and the eye sockets
      const zf = c * 0.8;
      if (z > zf) z = zf + (z - zf) * 0.42;
      if (dz > 0.2) {
        const fr = smooth(0.3, 0.7, dz), ax = abs(x), g = (u, v, su, sv) => Math.exp(-((u * u) / su + (v * v) / sv));
        z += 0.0046 * g(y - 0.029, 0, 0.00011, 1) * smooth(0.068, 0.03, ax) * fr;
        x *= 1 + 0.03 * g(y + 0.014, 0, 0.0005, 1) * smooth(0.2, 0.6, dz);
        z += 0.003 * g(y + 0.066, ax, 0.0005, 0.0005) * fr + 0.0045 * g(y + 0.1, ax, 0.0003, 0.0004) * fr;
        if (!noSocket) z -= 0.0052 * g(ax - ex, y - 0.001, 0.00028, 0.0001) * fr;
      }
      return [x, y, z];
    };
  }

  // the face layout (absolute bind coordinates), read off the head surface so features sit on it
  function faceGeom(J, key) {
    const hf = headFn(J, key, true), at = (x, y) => hf(x, y, Math.sqrt(max(0.01, 1 - x * x - y * y)));
    const re = 0.0125, e = at(0.42, 0.01), b = at(0.43, 0.22), m = at(0, -0.57);
    return { eX: e[0], eY: J.hc + 0.001, eZ: J.hz + e[2] + 0.0024 - re, re, bX: b[0], bY: J.hc + 0.026, bZ: J.hz + b[2] + 0.0025, mY: J.hc + m[1], mZ: J.hz + m[2] + 0.0012 };
  }
  // the eyelids: shells round the eye centre with almond edges; the upper one rides the blinking lid bone
  const lidEdge = (ph, up) => { const q = min(1.6, (ph / 1.08) ** 2); return up ? PI / 2 - 0.44 + 0.44 * q : PI / 2 + 0.47 - 0.47 * q; };
  const lidGeo = (F, ep, up, n) => { const r = F.re * (up ? 1.1 : 1.07); return surf(n, 6, (c, k) => { const ph = -1.35 + (2.7 * c) / n, e = lidEdge(ph, up), th = up ? (e * k) / 5 : PI - ((PI - e) * k) / 5; return [ep[0] + r * sin(th) * sin(ph), ep[1] + r * cos(th), ep[2] + r * sin(th) * cos(ph)]; }, { p0: true, flip: up }); };
  // ---- building one person (bind pose: standing straight, arms hanging, facing +z)
  function bindPos(key, J) {
    const P = {}, s = J.s, it = ITEMS[key];
    const hc = J.hc, hz = J.hz;
    Object.assign(P, {
      hips: [0, J.hip, 0], spine: [0, J.waist, 0.006], chest: [0, J.chest, 0.01], breath: [0, J.chest + 0.03, 0.035],
      neck: [0, J.neck, -0.012], head: [0, J.head, -0.004], jaw: [0, hc - 0.012, hz - 0.03],
      hat: [0, hc + J.hb, hz],
      back: [0, J.chest, -0.15],
    });
    const F = LOOK[key].F;
    P.mouth = P.smile = [0, F.mY, F.mZ];
    for (const [S, sd] of [["L", 1], ["R", -1]]) {
      P["eye" + S] = P["lid" + S] = [sd * F.eX, F.eY, F.eZ];
      P["brow" + S] = [sd * F.bX, F.bY, F.bZ];
      const x = sd * J.shX;
      P["clav" + S] = [sd * J.clX, J.clY, -0.012];
      P["arm" + S] = [x, J.shY, -0.008];
      P["fore" + S] = [x, J.elY, -0.008];
      P["hand" + S] = [x, J.wrY, -0.004];
      P["idx" + S] = [x - sd * 0.004, J.wrY - 0.092, 0.026];
      P["fing" + S] = [x - sd * 0.004, J.wrY - 0.092, -0.012];
      P["thumb" + S] = [x - sd * 0.012, J.wrY - 0.028, 0.03];
      P["thigh" + S] = [sd * J.hipX, J.hip, 0];
      P["shin" + S] = [sd * J.hipX, J.knee, 0];
      P["foot" + S] = [sd * J.hipX, J.ank, 0];
    }
    const pl = (sd) => [sd * (J.shX - 0.03), J.wrY - 0.06, 0.012];
    // the read item lives in front of the chest, tilted towards the eyes; the page hinges on its spine
    P.read = P.page = [0, J.chest + 0.01, (0.118 * LOOK[key].g + 0.017) + 0.24];
    P.cup = P.pen = P.mag = pl(-1);
    P.carry = it.carry === "under" ? [(0.165 * LOOK[key].sw + 0.026), J.chest - 0.05, 0.025] : pl(1);
    return P;
  }

  // the parts of one person; lvl 0 low, 1 medium, 2 high
  function buildGeo(key, lvl) {
    const L = LOOK[key], J = L.J, s = J.s, g = L.g, it = ITEMS[key], P = L.P;
    const seg = [8, 12, 16][lvl], hs = [[12, 8], [20, 14], [28, 20]][lvl];
    const parts = [];
    const add = (geom, color, w, m = [0.8, 0], cf) => { parts.push({ g: geom, c: color == null ? null : lin(color), w, m, cf }); return geom; };
    const at = (geom, mtx) => geom.applyMatrix4(mtx);
    const head = headFn(J, key, lvl === 0), hc = [0, J.hc, J.hz];
    const HB = B.head;
    const D = DRESS[key];
    const skin = L.skin;
    const shade = (hex, f) => { const c = new T.Color(hex); c.multiplyScalar(f); return c.getHex(); };

    // --- torso, from the crotch to the neck base: the garment colour, with the skin above the collar
    const ty = (f) => f * J.h;
    const fem = !!L.fem, sw = L.sw, hw = L.hw;
    const TOR = [
      [0.468, 0.142 * hw, 0.1], [0.5, 0.16 * hw, 0.108], [0.53, 0.168 * hw, 0.112, 0, 0.002], [0.565, 0.16 * (fem ? hw : 1), 0.108, 0, 0.006],
      [0.6, (fem ? 0.138 : 0.148) * g, 0.1 * g, 0, 0.01], [0.64, (fem ? 0.14 : 0.15) * g, 0.104 * g, 0, 0.012], [0.68, 0.157 * g * (fem ? 0.98 : 1), 0.11 * g, 0, 0.016],
      [0.72, 0.163 * sw, 0.118 * g, 0, 0.017], [0.755, 0.168 * sw, 0.115 * g, 0, 0.012], [0.785, 0.17 * sw, 0.104, 0, 0.002],
      [0.805, 0.163 * sw, 0.092, 0, -0.006], [0.818, 0.151 * sw, 0.08, 0, -0.01], [0.83, 0.11, 0.068, 0, -0.012], [0.842, 0.074, 0.057, 0, -0.012], [0.85, 0.058, 0.052, 0, -0.012],
    ].map(([y, rx, rz, cx = 0, cz = 0]) => [ty(y), rx, rz, cx, cz]);
    const hy = { falco: J.hip - 0.035, tartaruga: J.hip - 0.045, spazzino: J.hip - 0.03, ragioniere: J.waist - 0.04, guardiano: J.waist - 0.06, scettico: J.hip }[key];
    if (hy) for (const y of [hy - 0.004, hy + 0.004]) { const i = TOR.findIndex((r) => r[0] > y); if (i > 0) { const a = TOR[i - 1], b = TOR[i], t = (y - a[0]) / (b[0] - a[0]); TOR.splice(i, 0, a.map((v, j) => (j ? lerp(v, b[j], t) : y))); } }
    const torsoW = (() => {
      const ch = chainW([B.hips, B.spine, B.breath, B.neck], [J.hip, J.waist, J.chest, J.neck], 0.045);
      return (x, y, z) => {
        const w = ch(x, y, z);
        // the shoulders follow the clavicles
        const k = smooth(0.1, 0.17, abs(x)) * smooth(J.chest, J.shY - 0.01, y) * 0.7;
        if (k > 0.01) { for (let i = 1; i < w.length; i += 2) w[i] *= 1 - k; w.push(x > 0 ? B.clavL : B.clavR, k); }
        return w;
      };
    })();
    const neckW = chainW([B.breath, B.neck, B.head], [J.chest, J.neck, J.head], 0.03);
    const hem = { falco: [J.hip - 0.035, 0x23262d], tartaruga: [J.hip - 0.045, 0xcdbb98], spazzino: [J.hip - 0.03, 0x3a3d44], ragioniere: [J.waist - 0.04, 0x3b3a40], guardiano: [J.waist - 0.06, 0x1f2328], scettico: [J.hip, 0x25262c] }[key];
    D.torso({ add, TOR, torsoW, neckW, J, s, seg, lvl, L, at, P, shade, mix, head, hem });

    // --- the neck
    const nk = D.collar ? D.collar[2] || 1 : 1, cY = D.collar ? J.neck + D.collar[1] : -1;
    const NK = [[J.neck - 0.03, 0.062 * g, 0.058, -0.012], [J.neck + 0.02, 0.057 * g, 0.054, -0.008], [J.head + 0.01, 0.054 * g, 0.051, -0.002], [J.head + 0.045, 0.048, 0.047, 0.004]];
    const nr = (y, j) => { let i = 0; while (i < 2 && y > NK[i + 1][0]) i++; const t = clamp((y - NK[i][0]) / (NK[i + 1][0] - NK[i][0]), 0, 1); return lerp(NK[i][j], NK[i + 1][j], t); };
    const ny = NK.map((r) => r[0]).concat(cY > 0 ? [cY - 0.003, cY + 0.001] : []).sort((a, b) => a - b);
    add(loft(ny.map((y) => { const k = y < cY ? nk : 1; return [y, nr(y, 1) * k, nr(y, 2) * k, 0, nr(y, 3)]; }), seg), null, neckW, [0.65, 0, D.collar ? 0 : 1], (x, y) => lin(y < cY ? D.collar[0] : skin));

    // --- the head and its face; the grid is denser on the face; vertex colours add soft shading
    const F = L.F, skinC = lin(skin), dark = lin(shade(skin, 0.74)), blush = lin(mix(skin, 0xd0605a, 0.2)), tmp = [0, 0, 0];
    const wa = lvl ? 0.42 : 0, wp = lvl ? 0.36 : 0;
    add(surf(hs[0], hs[1] + 1, (c, r) => {
      const v = (TAU * c) / hs[0], a = v - wa * sin(v), w = (PI * r) / hs[1], ph = w + (wp * sin(2 * w)) / 2, sn = sin(ph), q = head(sn * sin(a), -cos(ph), sn * cos(a));
      return [q[0], q[1] + J.hc, q[2] + J.hz];
    }, { wrap: true, p0: true, p1: true }), null, (x, y, z) => {
      // the chin and lower lip follow the jaw
      const fy = y - J.hc, fz = z - J.hz, j = smooth(-0.06, -0.085, fy) * smooth(0.0, 0.04, fz) * smooth(0.045, 0.02, abs(x));
      return j > 0.01 ? [HB, 1 - j, B.jaw, j] : [HB, 1];
    }, [0.55, 0, 1], (x, y, z) => {
      const fy = y - J.hc, fz = z - J.hz, h = D.face ? D.face(x, fy, fz, J) : null, base = h == null ? skinC : lin(h), ax = abs(x);
      const sock = Math.exp(-(((ax - F.eX) ** 2) / 0.0005 + ((fy - 0.009) ** 2) / 0.00018)) * smooth(0, 0.05, fz);
      const under = smooth(-0.09, -0.125, fy) * smooth(0.02, -0.02, fz), side = Math.exp(-(((ax - 0.019) ** 2) / 0.00003 + ((fy + 0.035) ** 2) / 0.0003)) * smooth(0.03, 0.06, fz);
      const cheek = Math.exp(-(((ax - 0.042) ** 2) / 0.0003 + ((fy + 0.032) ** 2) / 0.0004)) * smooth(0, 0.05, fz), lips = Math.exp(-((x * x) / 0.0004 + ((fy + 0.068) ** 2) / 0.0002));
      const k = 0.4 * sock + 0.55 * under + 0.3 * side;
      for (let i = 0; i < 3; i++) tmp[i] = lerp(lerp(base[i], blush[i], cheek * 0.85 + lips * 0.4), dark[i], k);
      return tmp.slice();
    });
    // the nose: a loft on the midline from the base to the bridge, with nostril wings and dark nostrils
    const zf = (y) => { const d = (y - J.hc) / J.hb; return head(0, d, Math.sqrt(max(0.01, 1 - d * d)))[2] + J.hz; }, zb = zf(J.hc - 0.043);
    const NR = [[-0.047, 0.0001, 0.0001, 0.003], [-0.0445, 0.015, 0.009, 0.0125], [-0.039, 0.0156, 0.012, 0.0182], [-0.031, 0.0102, 0.011, 0.0178], [-0.019, 0.0074, 0.009, 0.0126], [-0.006, 0.0068, 0.0075, 0.0082], [0.005, 0.0066, 0.006, 0.0042], [0.013, 0.0001, 0.0001, 0.0006]];
    add(loft(NR.map(([y, rx, rz, f]) => [J.hc + y, rx, rz, 0, zf(J.hc + y) + f - rz]), lvl ? 12 : 6, { n: 2.3 }), null, HB, [0.5, 0, 1], (x, y, z) => lin(y < J.hc - 0.0415 && abs(x) > 0.002 && abs(x) < 0.0105 && z < zb + 0.013 ? shade(skin, 0.42) : mix(skin, 0xd0605a, 0.1 * smooth(-0.028, -0.042, y - J.hc))));
    // ears, on the side of the head; the hollow is darker
    const ear = head(1, -0.05, -0.12);
    for (const sd of [1, -1]) {
      const ec = [sd * (ear[0] - 0.002), J.hc - 0.008, J.hz + ear[2]];
      add(at(ell(0.0075, 0.031, 0.018, lvl ? 10 : 6, lvl ? 6 : 4, (p) => { if (p[0] * sd < 0) p[0] *= 0.4; }), TR(...ec, -0.12, sd * 0.3)), null, HB, [0.6, 0, 1], (x, y, z) => lin(abs(x) > abs(ec[0]) + 0.003 && abs(y - ec[1]) < 0.016 && abs(z - ec[2]) < 0.008 ? shade(skin, 0.72) : mix(skin, 0xd0605a, 0.12)));
    }
    // eyes in their sockets: eyeball, iris with a dark limbal ring, pupil, catch-light; almond eyelids
    for (const [S, sd] of [["L", 1], ["R", -1]]) {
      const ep = [sd * F.eX, F.eY, F.eZ], eb = B["eye" + S];
      if (lvl === 0) {
        add(at(ell(F.re * 0.72, F.re * 0.62, F.re * 0.5, 6, 4), TR(ep[0], ep[1], ep[2] + F.re * 0.66)), shade(L.eye, 0.3), eb, [0.3, 0]);
      } else {
        const hi = lvl > 1, cap = (r, th, n) => Sph(F.re * r, n, 3, 0, TAU, 0, th).applyMatrix4(TR(ep[0], ep[1], ep[2], PI / 2));
        add(at(ell(F.re, F.re, F.re, hi ? 16 : 12, hi ? 12 : 8), TR(...ep)), null, eb, [0.15, 0], (x, y, z) => lin(mix(0xebe5dc, 0xb59f98, smooth(0.5, 0.95, 1 - (z - ep[2]) / F.re))));
        add(cap(1.008, 0.6, hi ? 18 : 12), null, eb, [0.12, 0.04], (x, y) => { const r = hyp(x - ep[0], y - ep[1]) / (F.re * 0.565); return lin(mix(mix(L.eye, 0xffffff, 0.15 * (1 - r)), 0x1a1412, smooth(0.72, 1, r))); });
        add(cap(1.016, 0.25, hi ? 14 : 10), 0x060606, eb, [0.05, 0]);
        add(Circ(F.re * 0.12, 6).applyMatrix4(TR(ep[0] + F.re * 0.2, ep[1] + F.re * 0.24, ep[2] + F.re * 1.03)), 0xffffff, eb, [0.05, 1.2]);
        for (const up of [1, 0]) add(lidGeo(F, ep, up, hi ? 14 : 10), null, up ? B["lid" + S] : HB, [0.6, 0, 1], (x, y, z) => {
          const r = F.re * (up ? 1.1 : 1.07), th = Math.acos(clamp((y - ep[1]) / r, -1, 1)), e = lidEdge(Math.atan2(x - ep[0], z - ep[2]), up);
          return lin(up ? (th > e - 0.1 ? shade(L.brow, 0.3) : th > e - 0.3 ? shade(skin, 0.9) : skin) : th < e + 0.08 ? mix(skin, 0x9a5550, 0.35) : skin);
        });
      }
      // the brow: a tapered arch laid on the brow ridge
      const bc = P["brow" + S];
      add(surf(8, 2, (c, r) => {
        const u = c / 8, x = sd * (F.eX - 0.017 + u * 0.037), th = lerp(0.0062, 0.0026, u) * (L.fem ? 0.8 : 1), y = bc[1] + 0.0042 * sin(PI * min(1, u * 1.2)) - 0.0035 * u + (r - 0.4) * th, d = (y - J.hc) / J.hb, q = head(x / J.ha, d, Math.sqrt(max(0.01, 1 - (x / J.ha) ** 2 - d * d)));
        return [x, y, J.hz + q[2] + 0.0014];
      }, { flip: sd < 0 }), L.brow, B["brow" + S], [0.9, 0, 2]);
    }
    // mouth: a dark opening (mouth bone), lips; the lower one follows the jaw, the corners the smile bone
    const mY = F.mY, mZ = F.mZ, mw = (L.fem ? 0.0205 : 0.0215);
    add(at(ell(mw * 0.92, 0.0068, 0.005, lvl ? 12 : 6, 4), TR(0, mY, mZ - 0.0042)), 0x2a1410, B.mouth, [0.9, 0]);
    if (lvl) {
      const lipW = (jaw) => (x) => { const k = smooth(0.45, 1, abs(x) / mw); return [jaw ? B.jaw : HB, 1 - k, B.smile, k]; };
      add(at(ell(mw, 0.0041, 0.005, 12, 5, (q) => { q[1] -= 0.0016 * (q[0] / mw) ** 2 - 0.0007 * Math.exp(-((q[0] / 0.004) ** 2)) * (q[1] > 0); }), TR(0, mY + 0.0042, mZ - 0.0022)), mix(L.lip, skin, 0.12), lipW(false), [0.45, 0, 1]);
      add(at(ell(mw * 0.84, 0.0048, 0.0047, 12, 5), TR(0, mY - 0.005, mZ - 0.003)), mix(L.lip, skin, 0.12), lipW(true), [0.38, 0, 1]);
    }
    D.head({ add, J, s, hs, lvl, L, at, head, hc, F, shade, mix, seg });

    // --- arms: sleeves come from the dress; hands are skin
    for (const [S, sd] of [["L", 1], ["R", -1]]) {
      const x = sd * J.shX, armW = limbW([B["clav" + S], B["arm" + S], B["fore" + S], B["hand" + S]], [9, J.shY, J.elY, J.wrY], 0.04);
      D.arm({ add, S, sd, x, armW, J, s, seg, lvl, L, at, shade });
      hand(add, S, sd, x, J, s, lvl, skin);
    }
    // --- legs: trousers or tights from the dress, then shoes
    for (const [S, sd] of [["L", 1], ["R", -1]]) {
      const x = sd * J.hipX, legW = limbW([B.hips, B["thigh" + S], B["shin" + S], B["foot" + S]], [9, J.hip, J.knee, J.ank], 0.05);
      D.leg({ add, S, sd, x, legW, J, s, seg, lvl, L, at, shade });
      shoe(add, B["foot" + S], x, J, s, lvl, D.shoe || [0x1e1c1b, 0.35], D.boot);
    }
    items(add, key, J, s, lvl, at, P);
    return merge(parts, occluders(key, J));
  }

  // the body as capsules [ax, ay, az, bx, by, bz, r] for the baked occlusion; a brim shades the brow
  function occluders(key, J) {
    const g = LOOK[key].g, o = [[0, J.hip + 0.05, 0, 0, J.shY - 0.07, 0, 0.1 * g], [0, J.hc, J.hz, 0, J.hc, J.hz, 0.07], [0, J.neck - 0.02, -0.01, 0, J.head, 0, 0.038]];
    for (const sd of [1, -1]) {
      const x = sd * J.shX, lx = sd * J.hipX;
      o.push([x, J.shY - 0.03, -0.008, x, J.elY, -0.008, 0.034], [x, J.elY, -0.008, x, J.wrY + 0.02, -0.006, 0.027], [x, J.wrY - 0.05, 0.006, x, J.wrY - 0.05, 0.006, 0.026], [lx, J.hip - 0.06, 0, lx, J.knee, 0, 0.058], [lx, J.knee, 0, lx, J.ank + 0.05, 0, 0.04]);
    }
    if ("spazzino ragioniere guardiano cronista".includes(key)) o.push([0, J.hc + J.hb * 1.1, J.hz + 0.03, 0, J.hc + J.hb * 1.1, J.hz + 0.03, 0.075]);
    return o;
  }
  // a hand hanging along -y, palm towards the body (-x for the left hand), thumb forward (+z)
  function hand(add, S, sd, x, J, s, lvl, skin) {
    const wy = J.wrY, hb = B["hand" + S];
    if (lvl === 0) { add(at0(ell(0.016, 0.05, 0.038, 6, 4), TR(x - sd * 0.004, wy - 0.055, 0.006)), skin, hb, [0.6, 0, 1]); return; }
    add(at0(ell(0.0155, 0.05, 0.04, 10, 6, (p) => { if (p[1] < 0) p[2] *= 1 + 0.1 * p[1] / 0.05; }), TR(x - sd * 0.003, wy - 0.045, 0.006)), skin, hb, [0.6, 0, 1]);
    const fr = 0.0085;
    const finger = (bone, z, len, r) => add(at0(loft([[-len, 0.0001, 0.0001], [-len + r * 0.6, r * 0.8, r * 0.8], [-len * 0.5, r, r * 1.02], [0, r * 1.08, r * 1.12], [r * 1.5, r, r]], 6), TR(x - sd * 0.004, wy - 0.088, z)), skin, (xx, y) => [bone, smooth(wy - 0.085, wy - 0.1, y), hb, 1 - smooth(wy - 0.085, wy - 0.1, y)], [0.6, 0, 1]);
    finger(B["idx" + S], 0.024, 0.072, fr);
    if (lvl === 1) add(at0(loft([[-0.075, 0.0001, 0.0001], [-0.07, fr * 0.9, fr * 2.4], [-0.03, fr, fr * 3], [0.012, fr * 1.05, fr * 3.1]], 8, { n: 2.6 }), TR(x - sd * 0.004, wy - 0.088, -0.011)), skin, (xx, y) => { const t = smooth(wy - 0.085, wy - 0.1, y); return [B["fing" + S], t, hb, 1 - t]; }, [0.6, 0, 1]);
    else for (const [z, l] of [[0.004, 0.08], [-0.0155, 0.075], [-0.033, 0.06]]) finger(B["fing" + S], z, l, fr * (z < -0.03 ? 0.85 : 0.95));
    // the thumb, angled forward and inward
    add(at0(loft([[-0.055, 0.0001, 0.0001], [-0.05, 0.008, 0.008], [-0.025, 0.0105, 0.0105], [0.008, 0.013, 0.014]], 6), TR(x - sd * 0.012, wy - 0.028, 0.03, 0.45, 0, sd * 0.25)), skin, (xx, y) => { const t = smooth(wy - 0.03, wy - 0.045, y); return [B["thumb" + S], t, hb, 1 - t]; }, [0.6, 0, 1]);
  }
  const at0 = (g, m) => g.applyMatrix4(m);
  // a shoe (or boot) along +z from the heel; a darker sole
  function shoe(add, fb, x, J, s, lvl, [c, r], boot) {
    const n = lvl ? 10 : 6, L = 0.27, hgt = (boot ? 0.15 : 0.09);
    const rings = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = -0.06 + t * L;
      const w = (0.036 + 0.013 * sin(PI * min(1, t * 1.15)) + 0.006 * smooth(0.5, 0.75, t) - 0.03 * smooth(0.86, 1, t) ** 2) * (boot ? 1.12 : 1);
      const hh = t < 0.35 ? hgt : lerp(hgt, (boot ? 0.06 : 0.042), smooth(0.35, 0.78, t)) * (1 - 0.35 * smooth(0.85, 1, t));
      rings.push([z, w, hh / 2, -x * 0.0, -hh / 2]);
    }
    // loft along y, turn it so y -> +z and ring z -> -y; the sole: the same outline, flat, darker
    rings[0] = [rings[0][0], 0.0001, 0.0001, 0, -0.035]; rings[n] = [rings[n][0], 0.0001, 0.0001, 0, -0.018];
    add(at0(loft(rings, lvl ? 12 : 6, { n: 2.6 }), TR(x, 0.008, 0, PI / 2)), c, fb, [r, 0]);
    const sole = rings.map(([z, w], i) => [z, i === 0 || i === n ? 0.0001 : w * 1.06, (boot ? 0.012 : 0.0075), 0, 0]);
    sole[0] = [rings[0][0] - 0.004, 0.0001, 0.0001, 0, 0]; sole[n] = [rings[n][0] + 0.005, 0.0001, 0.0001, 0, 0];
    add(at0(loft(sole, lvl ? 10 : 6, { n: 3 }), TR(x, (boot ? 0.012 : 0.0075), 0, PI / 2)), 0x161413, fb, [0.85, 0]);
  }

  // ---- props: hats on the head bone, items on their own bones
  // tablet face with candles: built flat in x/y, facing +z
  function tabletParts(add, bone, m, s, glow) {
    add(Box(0.17, 0.24, 0.009).applyMatrix4(m), 0x1a1d22, bone, [0.35, 0]);
    add(new T.PlaneGeometry(0.15, 0.215).applyMatrix4(TR(0, 0, 0.0047)).applyMatrix4(m), 0x0f1720, bone, [0.25, glow]);
    const vals = [0.2, 0.32, 0.27, 0.45, 0.4, 0.58, 0.5, 0.72];
    vals.forEach((v, i) => {
      const up = i === 0 || v > vals[i - 1], h = 0.03 + abs(v - (vals[i - 1] || 0.1)) * 0.12;
      add(new T.PlaneGeometry(0.011, h).applyMatrix4(TR(-0.06 + i * 0.017, -0.08 + v * 0.17, 0.0052)).applyMatrix4(m), up ? 0x2bd46a : 0xf0504a, bone, [0.3, 1.4]);
    });
  }
  function bookParts(add, bone, pageBone, m, s, [cover, paper], open) {
    if (!open) {
      add(Box(0.035, 0.25, 0.19).applyMatrix4(m), cover, bone, [0.7, 0]);
      add(Box(0.028, 0.24, 0.186).applyMatrix4(TR(0, 0, 0.004)).applyMatrix4(m), paper, bone, [0.9, 0]);
      add(Box(0.037, 0.03, 0.192).applyMatrix4(TR(0, 0.08, 0)).applyMatrix4(m), 0xd9b45a, bone, [0.5, 0]);
      return;
    }
    // open book in the x/y plane (width along x), spine at x = 0, pages face +z, a V of 160°
    for (const sd of [1, -1]) {
      const r = TR(0, 0, 0, 0, sd * 0.17, 0);
      add(Box(0.15, 0.22, 0.004).applyMatrix4(TR(sd * 0.075, 0, -0.004)).applyMatrix4(r).applyMatrix4(m), cover, bone, [0.7, 0]);
      add(Box(0.142, 0.21, 0.012).applyMatrix4(TR(sd * 0.072, 0, 0.004)).applyMatrix4(r).applyMatrix4(m), paper, bone, [0.95, 0]);
      for (let i = 0; i < 6; i++) add(new T.PlaneGeometry(0.1, 0.003).applyMatrix4(TR(sd * 0.075, 0.07 - i * 0.028, 0.0105)).applyMatrix4(r).applyMatrix4(m), 0x8b8579, bone, [0.95, 0]);
    }
    // the turning page, hinged at the spine (the page bone), lying on the right half
    add(new T.PlaneGeometry(0.14, 0.205).applyMatrix4(TR(-0.071, 0, 0.0115)).applyMatrix4(TR(0, 0, 0, 0, -0.17, 0)).applyMatrix4(m), paper, pageBone, [0.95, 0]);
  }
  function items(add, key, J, s, lvl, at, P) {
    const it = ITEMS[key], pr = P.read, pc = P.cup;
    // read: an open book or the tablet in front of the chest, facing the eyes (BOOK frame)
    const readM = M4().makeBasis(new T.Vector3(...BOOK[0]), new T.Vector3(...BOOK[1]), new T.Vector3(...BOOK[2])).setPosition(pr[0], pr[1], pr[2]);
    if (it.read === "tablet") tabletParts(add, B.read, readM.clone().multiply(TR(0, 0, 0, 0, 0, PI / 2)), s, 0.8);
    else bookParts(add, B.read, B.page, readM, s, it.read, true);
    // carry: under the arm (a closed book against the ribs), the tablet or a notebook in the left hand
    if (it.carry === "under") bookParts(add, B.carry, B.carry, TR(P.carry[0], P.carry[1], P.carry[2]), s, it.read, false);
    else if (it.carry === "tablet") tabletParts(add, B.carry, TR(P.carry[0] - 0.012, P.carry[1] - 0.06, P.carry[2] + 0.005, 0, PI / 2, 0), s, 0.6);
    else if (it.carry === "note") {
      add(Box(0.016, 0.15, 0.1).applyMatrix4(TR(P.carry[0] - 0.014, P.carry[1] - 0.04, P.carry[2] + 0.02)), 0x222226, B.carry, [0.6, 0]);
      add(Box(0.004, 0.13, 0.003).applyMatrix4(TR(P.carry[0] - 0.024, P.carry[1] - 0.04, P.carry[2] + 0.07)), 0xd23a3a, B.carry, [0.5, 0]);
    }
    // cup: axis along the thumb (+z), in front of the palm
    const cx = pc[0] + 0.034, cy = pc[1] - 0.012, cz = pc[2] + 0.005, rr = lvl ? 12 : 7;
    const cupM = TR(cx, cy, cz, PI / 2, 0, 0);
    if (it.cup === "thermos") {
      add(Cyl(0.034, 0.034, 0.24, rr).applyMatrix4(TR(0, 0.03, 0)).applyMatrix4(cupM), 0x8f9aa5, B.cup, [0.3, 0]);
      add(Cyl(0.036, 0.036, 0.05, rr).applyMatrix4(TR(0, 0.17, 0)).applyMatrix4(cupM), 0x1e1f22, B.cup, [0.6, 0]);
    } else {
      const body = it.cup === "tea" ? 0xe8e1d2 : 0xf3f1ec, band = it.cup === "tea" ? 0x3f7d4a : it.cup === "mug" ? 0x1f2d4f : 0xb5462f;
      add(Cyl(0.04, 0.035, 0.095, rr, 1, false).applyMatrix4(TR(0, 0.02, 0)).applyMatrix4(cupM), body, B.cup, [0.25, 0]);
      add(Cyl(0.0405, 0.0395, 0.022, rr, 1, true).applyMatrix4(TR(0, 0.035, 0)).applyMatrix4(cupM), band, B.cup, [0.3, 0]);
      add(Circ(0.036, rr).applyMatrix4(TR(0, 0.06, 0, -PI / 2)).applyMatrix4(cupM), it.cup === "tea" ? 0x8a5a2a : 0x3b2214, B.cup, [0.2, 0]);
      add(Tor(0.022, 0.006, 5, 8, PI).applyMatrix4(TR(0, 0.02, -0.04, 0, PI / 2, -PI / 2)).applyMatrix4(cupM), body, B.cup, [0.25, 0]);
    }
    // pen: between thumb and index, the tip beyond the fingers
    add(Cyl(0.0045, 0.0025, 0.14, 5).applyMatrix4(TR(pc[0] + 0.014, pc[1] - 0.06, pc[2] + 0.034, -0.4, 0, 0)), key === "preside" ? 0xf2efe6 : 0x1d2b6b, B.pen, [0.4, 0]);
    // the scettico's magnifying glass: the handle in the grip, the lens beyond
    if (it.mag) {
      const mm = TR(cx - 0.006, cy, cz, PI / 2, 0, 0);
      add(Cyl(0.011, 0.013, 0.11, 6).applyMatrix4(mm), 0x1b1715, B.mag, [0.4, 0]);
      add(Tor(0.045, 0.006, 5, lvl ? 20 : 10).applyMatrix4(TR(0, 0.105, 0)).applyMatrix4(mm), 0xc9a24a, B.mag, [0.3, 0.1]);
      add(Circ(0.043, lvl ? 20 : 10).applyMatrix4(TR(0, 0.105, 0)).applyMatrix4(mm), 0xbfe0f0, B.mag, [0.05, 0.3]);
      add(Circ(0.043, lvl ? 20 : 10).applyMatrix4(TR(0, 0.105, 0, PI)).applyMatrix4(mm), 0xbfe0f0, B.mag, [0.05, 0.3]);
    }
    // tartaruga's backpack, the shell: hexagon plates on its back
    if (it.back) {
      const by = J.chest - 0.02, back = (0.118 * LOOK[key].g + 0.008 - 0.017), bc = -back - 0.024;
      add(at(ell(0.13, 0.17, 0.075, lvl ? 14 : 8, lvl ? 10 : 6, (p) => { if (p[2] > 0) p[2] *= 0.4; }), TR(0, by, bc)), 0x35633f, B.back, [0.75, 0]);
      const hex = Cyl(0.034, 0.034, 0.012, 6);
      for (const [hx, hy] of [[0, 0.02], [-0.062, 0.055], [0.062, 0.055], [-0.062, -0.03], [0.062, -0.03], [0, 0.105], [0, -0.065]]) {
        const zz = bc - 0.074 * Math.sqrt(max(0.05, 1 - (hx / 0.13) ** 2 - (hy / 0.17) ** 2));
        add(hex.clone().applyMatrix4(TR(hx, by + hy, zz, PI / 2 - hy * 2.5, hx * 3, 0).multiply(TR(0, 0, 0, 0, PI / 6, 0))), hy > 0.08 || hy < -0.05 ? 0x6b9a55 : 0x5d8f4c, B.back, [0.6, 0]);
      }
    }
  }

  // ---- hair, hats, glasses: helpers on the head surface
  // a cap over the head: angle a from the front (+z) towards +x; th(a) the lowest polar angle (0 = top);
  // thick(a, t) the offset from the scalp (t = 0 at the edge, 1 at the crown)
  function capGeo(head, hc, cols, rows, th, thick, f) {
    return surf(cols, rows, (c, r) => {
      const a = (TAU * c) / cols, t = r / (rows - 1), tt = th(a) * (1 - t), dx = sin(tt) * sin(a), dy = cos(tt), dz = sin(tt) * cos(a);
      const q = head(dx, dy, dz), L = hyp(q[0], q[1], q[2]) || 1, k = 1 + thick(a, t, dy) / L;
      const p = [q[0] * k + hc[0], q[1] * k + hc[1], q[2] * k + hc[2]];
      if (f) f(p, a, t);
      return p;
    }, { wrap: true, p1: true });
  }
  function glasses(add, J, s, F, color, shape, lvl, yOff = 0, zOff = 0) {
    const r = F.re * (shape === "round" ? 1.55 : 1.6), seg = lvl ? 14 : 8;
    for (const sd of [1, -1]) {
      const g = Tor(r, 0.0016 * (shape === "rect" ? 1.4 : 1.1), 4, seg);
      if (shape !== "round") g.scale(1.15, shape === "half" ? 0.62 : 0.78, 1);
      add(g.applyMatrix4(TR(sd * F.eX, F.eY + yOff, F.eZ + F.re * 1.45 + zOff)), color, B.head, [0.3, 0]);
      const z0 = F.eZ + F.re * 1.45 + zOff, x0 = F.eX + r * (shape === "round" ? 0.95 : 1.1), x1 = J.ha * 1.01;
      add(Box(x1 - x0, 0.003, 0.003).applyMatrix4(TR(sd * (x0 + x1) / 2, F.eY + yOff + 0.002, z0)), color, B.head, [0.3, 0]);
      add(Box(0.0025, 0.003, J.hd * 0.95).applyMatrix4(TR(sd * x1, F.eY + yOff + 0.002, z0 - J.hd * 0.475, 0.05)), color, B.head, [0.3, 0]);
    }
    add(Box(F.eX * 2 - r * 2.1, 0.0025, 0.003).applyMatrix4(TR(0, F.eY + yOff + 0.004, F.eZ + F.re * 1.5 + zOff)), color, B.head, [0.3, 0]);
  }

  // ---- the dresses
  // torso({TOR...}), neck colour, head({...}) for hair/hats/face extras, arm({...}), leg({...}), shoe, boot
  const sleeve = (c, cuff, o = {}) => ({ add, S, sd, x, armW, J, s, seg, lvl }) => {
    const sh = J.shY, el = J.elY, wr = J.wrY, b = o.bell || 0, k = o.k || 1;
    const R = [[wr - 0.004, (0.032 + b) * k, (0.03 + b) * k], [wr + 0.04, (0.034 + b * 0.8) * k, (0.032 + b * 0.8) * k], [el - 0.06, 0.041 * k, 0.04 * k], [el, 0.043 * k, 0.043 * k], [el + 0.08, 0.047 * k, 0.048 * k], [sh - 0.1, 0.05 * k, 0.052 * k], [sh - 0.035, 0.053 * k, 0.056 * k], [sh - 0.008, 0.05 * k, 0.054 * k], [sh + 0.003, 0.04 * k, 0.046 * k], [sh + 0.008, 0.024 * k, 0.03 * k], [sh + 0.01, 0.0001, 0.0001]];
    // the sleeve leans in at the top so the shoulder rounds into the torso
    add(loft(R.map(([y, rx, rz]) => [y, rx, rz, x - sd * 0.026 * smooth(sh - 0.08, sh + 0.01, y), -0.008]), seg), c, armW, [o.r || 0.8, 0]);
    // the forearm skin from the cuff to the wrist when the sleeve is short
    if (cuff) add(loft([[wr - 0.012, 0.031, 0.028, x, -0.006], [wr + 0.012, 0.034, 0.031, x, -0.006]], seg), cuff, armW, [0.7, 0]);
  };
  const trousers = (c, o = {}) => ({ add, x, legW, J, s, seg, L }) => {
    const hip = J.hip, kn = J.knee, an = J.ank, w = (o.w || 1) * L.g ** 0.5, tight = o.tight || 0;
    const R = [[an + 0.01, 0.05 * (1 - tight), 0.055 * (1 - tight)], [an + 0.1, 0.05, 0.054, 0, -0.004], [kn - 0.12, 0.056 * w, 0.06 * w, 0, -0.008], [kn, 0.058 * w, 0.06 * w], [kn + 0.12, 0.07 * w, 0.074 * w], [hip - 0.12, 0.083 * w, 0.086 * w], [hip - 0.03, 0.09 * w, 0.093 * w], [hip + 0.05, 0.085 * w, 0.092 * w]];
    add(loft(R.map(([y, rx, rz, cx = 0, cz = 0]) => [y, rx, rz, x + cx, cz]), seg), c, legW, [o.r || 0.85, 0]);
  };
  // a skirt-like hem (gown, coat) below the hips: the front follows the thighs
  const skirtW = (J, s) => (x, y, z) => {
    const tw = smooth(J.hip + 0.03, J.knee + 0.05, y) * (z > 0 ? 0.92 : 0.45), l = smooth(-0.6, 0.6, x / (0.12));
    const sp = y > J.waist - 0.02 ? [B.breath, smooth(J.waist - 0.02, J.chest, y), B.spine, 1 - smooth(J.waist - 0.02, J.chest, y)] : [B.spine, smooth(J.hip, J.waist, y), B.hips, 1 - smooth(J.hip, J.waist, y)];
    if (tw < 0.01) return sp;
    return [sp[0], sp[1] * (1 - tw), sp[2], sp[3] * (1 - tw), B.thighL, tw * l, B.thighR, tw * (1 - l)];
  };
  // torso shell with optional open front; rings TOR scaled outwards by d (m)
  const shell = (TOR, d, y0, y1, open) => TOR.filter(([y]) => y >= y0 - 1e-6 && y <= y1 + 1e-6).map(([y, rx, rz, cx, cz]) => [y, rx + d, rz + d, cx, cz]);
  function torsoSkin(o) { // the garment over the whole torso: a neckline colour above collarY, the trousers below the hem
    const { add, TOR, torsoW, seg, hem } = o;
    return (c, collarY, collarC, r = 0.8, extra = 0, cf) => add(loft(TOR.map(([y, rx, rz, cx, cz]) => [y, rx + extra, rz + extra, cx, cz]), seg, { n: 2.3 }), null, torsoW, [r, 0], (x, y, z) => (hem && y < hem[0] ? lin(hem[1]) : cf ? cf(x, y, z) : lin(y > collarY && abs(x) < 0.078 ? collarC : c)));
  }
  // the torso surface: z at (x, y) on the front (superellipse n = 2.3), plus an offset
  const surfZ = (TOR) => (x, y, d = 0) => {
    let i = 0;
    while (i < TOR.length - 2 && y > TOR[i + 1][0]) i++;
    const a = TOR[i], b = TOR[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    const rx = lerp(a[1], b[1], t) + d, rz = lerp(a[2], b[2], t) + d, cz = lerp(a[4], b[4], t);
    return cz + rz * max(0, 1 - abs(x / rx) ** 2.3) ** (1 / 2.3);
  };
  // a band round the torso between y0 and y1, d outside the surface (stripes, belts)
  const band = (TOR, y0, y1, d) => [y0, y1].map((y) => { let i = 0; while (i < TOR.length - 2 && y > TOR[i + 1][0]) i++; const a = TOR[i], b = TOR[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1); return [y, lerp(a[1], b[1], t) + d, lerp(a[2], b[2], t) + d, 0, lerp(a[4], b[4], t)]; });
  // a plate on the torso front from yTop to yBot, half-width wTop -> wBot (shirt fronts, ties, collars)
  const plate = (TOR, d, yTop, yBot, wTop, wBot, lift = 0.0012) => { const sz = surfZ(TOR); return surf(4, 6, (c, r) => { const t = r / 5, y = lerp(yBot, yTop, t), x = (c / 4 - 0.5) * 2 * lerp(wBot, wTop, t); return [x, y, sz(x, y, d) + lift]; }); };
  // a ribbon through points [[x, y, z]] (descending in y), width w across x, facing +z
  function strip(pts, w) {
    const P = pts.slice().reverse();
    return surf(1, P.length, (c, r) => [P[r][0] + (c - 0.5) * w, P[r][1], P[r][2]]);
  }
  // lapels: one flat triangle per side from the collar to the V, the notch towards the shoulder
  function lapels(add, J, s, c, yTop, yLow, TOR, d, wide = 1, w = B.breath) {
    const sz = surfZ(TOR);
    for (const sd of [1, -1]) {
      const A = [sd * 0.05, yTop], Cc = [sd * 0.012, yLow], Bb = [sd * (0.09 + 0.028 * wide), yTop - 0.055];
      const v = [A, Cc, Bb].flatMap(([x, y]) => [x, y, sz(x, y, d) + 0.003]);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
      g.setIndex(sd > 0 ? [0, 1, 2] : [0, 2, 1]);
      g.computeVertexNormals();
      add(g, c, w, [0.75, 0]);
    }
  }

  function hairCap(o, color, spec) {
    const { add, head, hc, hs, lvl, s } = o;
    const g = capGeo(head, hc, hs[0], max(5, (hs[1] >> 1) + 2), spec.th, spec.thick, spec.f);
    add(g, null, B.head, [spec.r || 0.7, 0, 2], spec.cf || ((x, y, z) => lin(color)));
  }
  // a patch of hair laid on the face (beards): rows from y0 to y1, half-width w(t), thickest in the middle
  const patch = (o, y0, y1, w, th, n) => surf(n, n, (c, r) => {
    const J = o.J, t = r / (n - 1), u = (2 * c) / (n - 1) - 1, y = lerp(y0, y1, t), x = u * w(t), d = (y - J.hc) / J.hb, dx = x / J.ha;
    return [x, y, J.hz + o.head(dx, d, Math.sqrt(max(0.01, 1 - dx * dx - d * d)))[2] + 0.0008 + th * (1 - u * u) * (0.35 + 0.65 * smooth(0, 0.45, t))];
  }, { flip: y1 < y0 });
  const curls = (o, color, n, region, size) => {
    const { add, head, hc, s, lvl } = o;
    const rand = U.rng("curls|" + n);
    const base = new T.IcosahedronGeometry(size, 0);
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, th = Math.acos(1 - rand() * 1.4);
      if (!region(a, th)) continue;
      const dx = sin(th) * sin(a), dy = cos(th), dz = sin(th) * cos(a), q = head(dx, dy, dz), L = hyp(...q), k = 1 + (0.011 + rand() * 0.005) / L;
      add(base.clone().applyMatrix4(TR(q[0] * k + hc[0], q[1] * k + hc[1], q[2] * k + hc[2], rand() * 3, rand() * 3, 0, 0.8 + rand() * 0.5)), new T.Color(color).multiplyScalar(0.85 + rand() * 0.3).getHex(), B.head, [0.8, 0, 2]);
    }
  };

  // hairline: the lowest polar angle of the hair at the front, the sides and the back
  const hairline = (fr, sd, bk) => (a) => { const c = cos(a); return c > 0 ? lerp(sd, fr, smooth(0.05, 0.95, c)) : lerp(sd, bk, smooth(0, 0.85, -c)); };
  const DRESS = {
    preside: {
      // a dark suit, white shirt and tie; the black gown over it, open at the front; the red stole
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o, sz = surfZ(TOR), sk = skirtW(J, s);
        torsoSkin(o)(0x25242a, J.neck - 0.006, 0xf2f0ea, 0.75);
        add(plate(TOR, 0, J.neck + 0.004, J.neck - 0.16, 0.062, 0.004), 0xf2f0ea, torsoW, [0.7, 0]);
        add(plate(TOR, 0, J.neck - 0.01, J.neck - 0.15, 0.009, 0.013, 0.003), 0x5a1520, torsoW, [0.5, 0]);
        const G = [[0.22 * J.h, 0.29, 0.24, 0, -0.02], [0.36 * J.h, 0.245, 0.195, 0, -0.015], [J.hip - 0.06, 0.2, 0.15, 0, -0.005], [J.hip + 0.02, 0.185, 0.13], ...shell(TOR, 0.012, J.hip + 0.07, J.neck - 0.005).slice(0, -1)];
        const gw = (x, y, z) => (y < J.hip + 0.03 ? sk(x, y, z) : torsoW(x, y, z));
        add(loft(G, seg + 4, { open: [0.42, TAU - 0.42], n: 2.2 }), 0x141318, gw, [0.85, 0]);
        add(loft(G.map(([y, rx, rz, cx, cz]) => [y, rx - 0.006, rz - 0.006, cx, cz]), seg + 4, { open: [TAU - 0.42, 0.42], n: 2.2 }), 0x24222a, gw, [0.9, 0]);
        // the stole: two red bands down the front edges of the gown, and round the back of the neck
        for (const sd of [1, -1]) {
          const pts = [];
          for (let i = 0; i <= 7; i++) { const y = J.neck - 0.005 - i * 0.06, x = sd * (0.07 + i * 0.006); pts.push([x, y, sz(x, y, 0.012) + 0.006]); }
          add(strip(pts, 0.05), 0xb8243a, torsoW, [0.5, 0]);
        }
        add(Tor(0.078, 0.016, 4, 14, PI * 1.2).applyMatrix4(TR(0, J.neck - 0.006, -0.012, PI / 2, 0, PI * 0.4 + PI)), 0xb8243a, B.breath, [0.5, 0]);
      },
      head(o) {
        const { add, J, s, lvl, F, L } = o;
        hairCap(o, null, { th: hairline(1.0, 1.5, 1.95), thick: (a, t) => 0.0016 + 0.0042 * smooth(0, 0.25, t) - 0.0035 * smooth(0.45, 0.85, t), r: 0.85, cf: (x, y, z) => lin(mix(L.hair, L.skin, 0.62 * smooth(J.hc + 0.06, J.hc + 0.1, y) * smooth(J.hz - 0.04, J.hz + 0.03, z))) });
        glasses(add, J, s, F, 0x1c1c1e, "rect", lvl);
        // the mortarboard (hat bone: only in the meeting and gym modes)
        add(Cyl(0.098, 0.093, 0.07, lvl ? 16 : 8).applyMatrix4(TR(0, J.hc + J.hb * 0.72, J.hz - 0.005, -0.1)), 0x141318, B.hat, [0.8, 0]);
        add(Box(0.3, 0.012, 0.3).applyMatrix4(TR(0, J.hc + J.hb + 0.022, J.hz - 0.01, -0.1)), 0x141318, B.hat, [0.7, 0]);
        add(Cyl(0.004, 0.006, 0.13, 4).applyMatrix4(TR(0.12, J.hc + J.hb - 0.04, J.hz + 0.1)), 0xd9a441, B.hat, [0.5, 0.15]);
      },
      arm: sleeve(0x141318, null, { bell: 0.03 }),
      leg: trousers(0x26252b),
      shoe: [0x151413, 0.3],
    },
    falco: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg, L } = o, sz = surfZ(TOR);
        torsoSkin(o)(0x1f2d4f, J.neck - 0.004, 0xf4f4f2, 0.7);
        add(plate(TOR, 0, J.neck + 0.004, J.neck - 0.19, 0.056, 0.004), 0xf4f4f2, torsoW, [0.7, 0]);
        add(plate(TOR, 0, J.neck + 0.006, J.neck - 0.045, 0.022, 0.002, 0.0024), L.skin, torsoW, [0.6, 0]);
        lapels(add, J, s, 0x18233f, J.neck - 0.005, J.neck - 0.2, TOR, 0, 0.6);
        for (const y of [J.waist, J.waist + 0.05]) add(Sph(0.006, 6, 4).applyMatrix4(TR(0.01, y, sz(0.01, y) + 0.003)), 0x0e1424, torsoW, [0.4, 0]);
        add(Box(0.045, 0.012, 0.004).applyMatrix4(TR(0.085, J.chest + 0.04, sz(0.085, J.chest + 0.04) + 0.002, 0, 0.35)), 0xf4f4f2, B.breath, [0.7, 0]);
      },
      head(o) {
        const { add, J, s, L } = o;
        // undercut: shaved sides and back, a longer top swept back with a small quiff
        hairCap(o, null, { th: hairline(0.92, 1.62, 1.9), thick: (a, t) => 0.002 + 0.012 * smooth(0.42, 0.75, t) * (0.75 + 0.25 * max(0, cos(a))), cf: (x, y) => lin(y > J.hc + J.hb * 0.5 ? L.hair : mix(L.hair, L.skin, 0.45)), r: 0.6, f: (p, a, t) => { if (t > 0.55) p[2] += 0.007 * max(0, cos(a)) * smooth(0.55, 0.9, t); } });
        // aviator sunglasses pushed up on the head
        for (const sd of [1, -1]) {
          add(Circ(0.026, 12).applyMatrix4(TR(sd * 0.032, J.hc + J.hb * 1.02, J.hz + J.hd * 0.55, -1.0, sd * 0.15, 0, 1, 0.8)), 0x101318, B.hat, [0.06, 0]);
          add(Tor(0.026, 0.0022, 3, 12).applyMatrix4(TR(sd * 0.032, J.hc + J.hb * 1.02, J.hz + J.hd * 0.55, -1.0, sd * 0.15, 0, 1, 0.8)), 0xc9a548, B.hat, [0.25, 0]);
        }
        add(Box(0.02, 0.003, 0.003).applyMatrix4(TR(0, J.hc + J.hb * 1.06, J.hz + J.hd * 0.53, -1.0)), 0xc9a548, B.hat, [0.25, 0]);
      },
      arm: (o) => {
        sleeve(0x1f2d4f, null, { r: 0.7 })(o);
        // the smartwatch on the left wrist, its face peeking out of the cuff
        if (o.S === "L") { o.add(Box(0.007, 0.032, 0.027).applyMatrix4(TR(o.x + 0.034, o.J.wrY + 0.012, -0.004)), 0x15171a, B.foreL, [0.3, 0]); o.add(Box(0.002, 0.024, 0.02).applyMatrix4(TR(o.x + 0.038, o.J.wrY + 0.012, -0.004)), 0x2fd3b8, B.foreL, [0.2, 0.7]); }
      },
      leg: trousers(0x23262d, { w: 0.95 }),
      shoe: [0x3a2a20, 0.3],
    },
    tartaruga: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o, sz = surfZ(TOR);
        torsoSkin(o)(0x3f7a49, J.neck - 0.004, 0xefe6d2, 0.95, 0.008, (x, y) => lin(y > J.neck - 0.004 && abs(x) < 0.078 ? 0xefe6d2 : y < J.hip - 0.01 ? 0x346540 : 0x3f7a49));
        add(plate(TOR, 0.008, J.neck + 0.004, J.neck - 0.17, 0.07, 0.004), 0xefe6d2, torsoW, [0.85, 0]);
        for (let i = 0; i < 4; i++) { const y = J.neck - 0.19 - i * 0.065; add(Sph(0.007, 6, 4).applyMatrix4(TR(0, y, sz(0, y, 0.008) + 0.002)), 0x8a6a45, torsoW, [0.5, 0]); }
        for (const sd of [1, -1]) add(Sph(0.058, seg, 8).applyMatrix4(TR(sd * 0.056, J.chest + 0.03, sz(sd * 0.056, J.chest + 0.03) - 0.04, 0, 0, 0, 1, 0.85, 0.72)), 0x3f7a49, B.breath, [0.95, 0]);
        // the backpack straps over the shoulders, on the backpack's bone
        for (const sd of [1, -1]) add(strip([0, 1, 2, 3, 4, 5].map((i) => { const y = J.shY + 0.005 - i * 0.05, x = sd * (0.088 + i * 0.004); return [x, y, sz(x, y, 0.008) + 0.004]; }), 0.028), 0x2d4f34, B.back, [0.8, 0]);
        // the cord of her reading glasses, round the neck
        add(Tor(0.085, 0.0015, 3, 16, PI * 1.2).applyMatrix4(TR(0, J.neck - 0.05, 0.03, PI / 2 + 0.6, 0, PI * 0.4 + PI)), 0x3b2a1a, B.breath, [0.6, 0]);
      },
      head(o) {
        const { add, J, s, lvl, F, L } = o;
        // a grey bob with a fringe, down to the jaw, flaring a little
        hairCap(o, L.hair, { th: hairline(1.2, 2.1, 2.2), thick: (a, t) => 0.006 + 0.017 * smooth(0.35, 0, t) * (1 - 0.85 * max(0, cos(a))) + 0.003 * smooth(0.55, 0.9, t) + 0.005 * max(0, cos(a)) * smooth(0.0, 0.3, t), r: 0.7, cf: (x, y) => lin(mix(L.hair, 0xd8d4cc, smooth(J.hc, J.hc + J.hb, y) * 0.35)) });
        glasses(add, J, s, F, 0x6b4a2b, "half", lvl, -0.007, 0.002);
      },
      arm: sleeve(0x3f7a49, null, { k: 1.12, r: 0.95 }),
      leg: trousers(0xcdbb98, { w: 1.08 }),
      shoe: [0x6b4f3a, 0.6],
    },
    spazzino: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o;
        torsoSkin(o)(0x2c2f36, J.neck + 0.03, o.L.skin, 0.9);
        // the hood bunched at the back of the neck
        add(Tor(0.085, 0.028, 6, 12, PI * 1.3).applyMatrix4(TR(0, J.neck - 0.01, -0.02, PI / 2 + 0.25, 0, PI * 0.35 + PI)), 0x2c2f36, B.breath, [0.9, 0]);
        // the hi-vis vest with two reflective stripes
        const V = shell(TOR, 0.012, J.hip - 0.02, J.shY - 0.02).concat([[J.shY + 0.005, 0.1, 0.07, 0, -0.01]]);
        add(loft(V, seg + 2, { open: [0.18, TAU - 0.18], n: 2.3 }), 0xff7a1a, torsoW, [0.55, 0]);
        for (const y of [J.waist, J.chest + 0.04]) add(loft(band(TOR, y - 0.016, y + 0.016, 0.0145), seg + 2, { open: [0.2, TAU - 0.2], n: 2.3 }), 0xe8ecf0, torsoW, [0.3, 0.12]);
        add(loft(V.map(([y, rx, rz, cx, cz]) => [y, rx - 0.004, rz - 0.004, cx, cz]), seg + 2, { open: [TAU - 0.18, 0.18] }), 0xd9661a, torsoW, [0.7, 0]);
      },
      // stubble on the jaw and the upper lip
      face: (x, fy, fz, J) => { const s = J.s, k = smooth(-0.028, -0.05, fy + 0.02 * abs(x) / J.ha) * smooth(-0.035, 0.01, fz); return k > 0.02 ? mixHex(LOOK.spazzino.skin, 0x2a1d14, 0.4 * k) : null; },
      head(o) {
        const { add, J, s, L, head, hc, hs } = o;
        hairCap(o, L.hair, { th: hairline(0.85, 1.62, 1.9), thick: () => 0.004, r: 0.8 });
        // the work cap
        add(capGeo(head, hc, hs[0], 6, hairline(1.15, 1.3, 1.35), (a, t) => 0.012 + 0.004 * t), 0xe2621b, B.hat, [0.8, 0]);
        add(Cyl(J.ha * 1.1, J.ha * 1.75, 0.022, 14, 1, true, -1.0, 2.0).applyMatrix4(TR(0, J.hc + J.hb * 0.36, J.hz + 0.006, 0, 0, 0, 1, 1, J.hd / J.ha * 1.02)), 0xc95415, B.hat, [0.8, 0]);
      },
      arm: sleeve(0x2c2f36, null, { k: 1.05, r: 0.9 }),
      leg: trousers(0x3a3d44, { w: 1.05 }),
      shoe: [0x5a4632, 0.75], boot: 1,
    },
    ragioniere: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o, sz = surfZ(TOR);
        torsoSkin(o)(0xf2f1ec, J.neck + 0.01, 0xf2f1ec, 0.7);
        // the mustard waistcoat: V opening, buttons, a pointed front hem
        const V = shell(TOR, 0.008, J.hip, J.shY - 0.03).concat([[J.shY - 0.005, 0.105, 0.068, 0, -0.01]]);
        add(loft(V, seg + 2, { n: 2.3, f: (p, a) => { if (p[1] < J.hip + 0.02 && cos(a) > 0.6) p[1] -= 0.04 * (cos(a) - 0.6) / 0.4; } }), null, torsoW, [0.6, 0], (x, y, z) => lin(z < -0.03 ? 0x4b3a2c : 0xb8841f));
        add(plate(TOR, 0.008, J.shY - 0.025, J.neck - 0.2, 0.07, 0.004), 0xf2f1ec, torsoW, [0.7, 0]);
        for (let i = 0; i < 5; i++) { const y = J.chest - 0.03 - i * 0.035; add(Sph(0.005, 6, 4).applyMatrix4(TR(0, y, sz(0, y, 0.008) + 0.003)), 0x5a4214, torsoW, [0.4, 0]); }
        // the burgundy bow tie
        const ny = J.neck + 0.012, nz = 0.056;
        for (const sd of [1, -1]) add(new T.ConeGeometry(0.016, 0.03, 4).applyMatrix4(TR(sd * 0.016, ny, nz, 0, 0, sd * PI / 2, 1, 1, 0.5)), 0x7a1f2e, B.neck, [0.5, 0]);
        add(Sph(0.007, 6, 4).applyMatrix4(TR(0, ny, nz + 0.003)), 0x6a1a28, B.neck, [0.5, 0]);
      },
      collar: [0xf2f1ec, 0.035],
      head(o) {
        const { add, J, s, lvl, F, L } = o;
        // slicked black hair, glossy, with a side part
        hairCap(o, null, { th: hairline(0.85, 1.55, 1.9), thick: (a, t) => 0.007 * smooth(0, 0.25, t) + 0.003, r: 0.25, cf: (x, y, z) => lin(abs(x - 0.025) < 0.0025 && z > J.hz - 0.03 && y > J.hc + J.hb * 0.55 ? 0x050505 : L.hair) });
        glasses(add, J, s, F, 0x9a8456, "round", lvl);
        // the green eyeshade visor
        add(Cyl(J.ha * 1.12, J.ha * 1.1, 0.03, lvl ? 16 : 10, 1, true).applyMatrix4(TR(0, J.hc + J.hb * 0.42, J.hz + 0.004, -0.12, 0, 0, 1, 1, J.hd / J.ha)), 0x2f8a4a, B.hat, [0.4, 0.05]);
        add(Cyl(J.ha * 1.12, J.ha * 1.42, 0.008, lvl ? 16 : 10, 1, true, -1.15, 2.3).applyMatrix4(TR(0, J.hc + J.hb * 0.4, J.hz + 0.006, -0.12, 0, 0, 1, 1, J.hd / J.ha)), 0x36a356, B.hat, [0.35, 0.15]);
      },
      arm: (o) => {
        sleeve(0xf2f1ec, null, { r: 0.7 })(o);
        // the sleeve garters
        o.add(Tor(0.05, 0.006, 4, o.seg).applyMatrix4(TR(o.x, o.J.elY + 0.11, -0.008, PI / 2)), 0x1d1d1d, o.armW, [0.4, 0]);
      },
      leg: trousers(0x3b3a40, { w: 0.92 }),
      shoe: [0x0f0f10, 0.2],
    },
    guardiano: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o, sz = surfZ(TOR);
        torsoSkin(o)(0x1d6b62, J.neck + 0.004, 0x1a5f57, 0.7, 0.004);
        add(loft(band(TOR, J.waist - 0.058, J.waist - 0.022, 0.008), seg + 2, { n: 2.3 }), 0x18191b, torsoW, [0.35, 0]);
        // the shield badge, the buckle, a pocket flap, the radio on the left shoulder, the epaulettes
        const sh = new T.Shape(); sh.moveTo(0, -0.028); sh.quadraticCurveTo(0.024, -0.012, 0.022, 0.018); sh.lineTo(0, 0.024); sh.lineTo(-0.022, 0.018); sh.quadraticCurveTo(-0.024, -0.012, 0, -0.028);
        const by = J.chest + 0.05;
        add(new T.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false, curveSegments: 3 }).scale(s, s, s).applyMatrix4(TR(-0.075, by, sz(-0.075, by, 0.004) - 0.001, 0, -0.25)), 0xd8b24c, B.breath, [0.3, 0.15]);
        add(Box(0.03, 0.024, 0.006).applyMatrix4(TR(0, J.waist - 0.04, sz(0, J.waist - 0.04, 0.004) + 0.002)), 0xb8bcc2, B.spine, [0.3, 0]);
        add(Box(0.065, 0.022, 0.006).applyMatrix4(TR(0.075, by + 0.015, sz(0.075, by + 0.015, 0.004), 0, 0.25)), 0x15514a, B.breath, [0.7, 0]);
        const ry = J.shY - 0.07, rz = sz(0.1, ry, 0.004);
        add(Box(0.04, 0.07, 0.024).applyMatrix4(TR(0.1, ry, rz + 0.008, 0.15, 0.3)), 0x161719, B.breath, [0.45, 0]);
        add(Cyl(0.003, 0.003, 0.07, 4).applyMatrix4(TR(0.112, ry + 0.06, rz + 0.002)), 0x111111, B.breath, [0.5, 0]);
        add(Box(0.012, 0.006, 0.002).applyMatrix4(TR(0.1, ry + 0.02, rz + 0.021, 0.15, 0.3)), 0x39d17a, B.breath, [0.3, 1.5]);
        for (const sd of [1, -1]) add(Box(0.085, 0.01, 0.05).applyMatrix4(TR(sd * 0.12, J.shY + 0.012, -0.01, 0, 0, -sd * 0.22)), 0x123f3a, sd > 0 ? B.clavL : B.clavR, [0.6, 0]);
      },
      face: (x, fy, fz, J) => null,
      head(o) {
        const { add, J, s, lvl, L } = o;
        hairCap(o, null, { th: hairline(0.95, 1.62, 1.9), thick: () => 0.0025, cf: () => lin(mix(L.hair, L.skin, 0.25)), r: 0.85 });
        // the peaked cap: band, a wider crown, a black visor, the badge
        const cy = J.hc + J.hb * 0.66;
        add(Cyl(J.ha * 1.1, J.ha * 1.08, 0.04, lvl ? 16 : 10).applyMatrix4(TR(0, cy, J.hz - 0.004, -0.1, 0, 0, 1, 1, J.hd / J.ha * 1.0)), 0x123631, B.hat, [0.7, 0]);
        add(Cyl(J.ha * 1.3, J.ha * 1.12, 0.032, lvl ? 16 : 10).applyMatrix4(TR(0, cy + 0.034, J.hz - 0.01, -0.14, 0, 0, 1, 1, J.hd / J.ha * 1.05)), 0x1a4a44, B.hat, [0.7, 0]);
        add(Cyl(J.ha * 1.08, J.ha * 1.5, 0.018, 12, 1, true, -1.0, 2.0).applyMatrix4(TR(0, cy - 0.026, J.hz - 0.002, -0.05, 0, 0, 1, 1, J.hd / J.ha)), 0x0c0c0d, B.hat, [0.2, 0]);
        add(Circ(0.013, 6).applyMatrix4(TR(0, cy + 0.004, J.hz + J.hd * 1.1, -0.1)), 0xd8b24c, B.hat, [0.3, 0.25]);
      },
      arm: sleeve(0x1d6b62, null, { k: 1.12, r: 0.7 }),
      leg: trousers(0x1f2328, { w: 1.08 }),
      shoe: [0x121212, 0.35], boot: 1,
    },
    cronista: {
      torso(o) {
        const { add, TOR, torsoW, J, s, seg } = o, sz = surfZ(TOR), d = 0.01, sk = skirtW(J, s);
        torsoSkin(o)(0xc8b28a, J.neck - 0.004, 0xe79bb8, 0.85, d);
        add(plate(TOR, d, J.neck + 0.004, J.neck - 0.17, 0.066, 0.004), 0xe08eb0, torsoW, [0.7, 0]);
        add(loft(band(TOR, J.waist - 0.04, J.waist, d + 0.004), seg + 2, { n: 2.3 }), 0xa8925f, torsoW, [0.7, 0]);
        // the coat skirt to the knees, open at the front
        const G = [[J.knee + 0.04, 0.2, 0.17, 0, -0.01], [J.hip - 0.08, 0.185, 0.14, 0, 0], [J.hip + 0.01, 0.178, 0.126, 0, 0.002]];
        add(loft(G, seg + 4, { open: [0.12, TAU - 0.12], n: 2.2 }), 0xc8b28a, sk, [0.85, 0]);
        add(loft(G.map(([y, rx, rz, cx, cz]) => [y, rx - 0.005, rz - 0.005, cx, cz]), seg + 4, { open: [TAU - 0.12, 0.12] }), 0x9c8866, sk, [0.9, 0]);
        lapels(add, J, s, 0xbca57c, J.neck, J.neck - 0.17, TOR, d, 1.3);
        for (const sd of [1, -1]) for (const y of [0.62, 0.66, 0.7]) add(Sph(0.0065, 6, 4).applyMatrix4(TR(sd * 0.05, y * J.h, sz(sd * 0.05, y * J.h, d) + 0.003)), 0x4a3424, torsoW, [0.4, 0]);
        add(Box(0.04, 0.03, 0.006).applyMatrix4(TR(0, J.waist - 0.02, sz(0, J.waist - 0.02, d) + 0.003)), 0x6b5a3a, B.spine, [0.4, 0]);
        // the camera on its strap: from the left shoulder across to the right hip
        const pts = [[0.1, J.shY + 0.012], [0.06, J.chest + 0.02], [-0.04, J.waist + 0.03], [-0.11, J.hip + 0.07]].map(([x, y]) => new T.Vector3(x, y, sz(x, y, d) + 0.006));
        pts[0].z = -0.005;
        add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 10, 0.006, 4, false), 0x2a2420, torsoW, [0.7, 0]);
        const cy = J.hip + 0.03, cz = sz(-0.12, cy, d) + 0.03;
        add(Box(0.11, 0.07, 0.045).applyMatrix4(TR(-0.12, cy, cz, 0, -0.35)), 0x1c1c1e, B.spine, [0.4, 0]);
        add(Box(0.11, 0.014, 0.046).applyMatrix4(TR(-0.12, cy + 0.04, cz, 0, -0.35)), 0xb9bcc2, B.spine, [0.3, 0]);
        add(Cyl(0.022, 0.024, 0.045, 10).applyMatrix4(TR(-0.112, cy, cz + 0.035, PI / 2, 0, 0.35)), 0x222222, B.spine, [0.3, 0]);
      },
      head(o) {
        const { add, J, s, lvl, L } = o;
        hairCap(o, L.hair, { th: hairline(1.0, 1.75, 1.95), thick: () => 0.012, r: 0.9 });
        curls(o, L.hair, [16, 80, 120][lvl], (a, th) => th < hairline(1.0, 1.75, 1.95)(a) + 0.08 && th > 0.98, 0.0085);
        // the fedora: a creased crown, a band, a brim, the press card
        const fy = J.hc + J.hb * 0.55, fz0 = J.hz - 0.004;
        add(loft([[0, J.ha * 1.16, J.hd * 1.06], [0.05, J.ha * 1.12, J.hd * 1.0], [0.082, J.ha * 1.0, J.hd * 0.9], [0.094, J.ha * 0.62, J.hd * 0.58], [0.098, 0.0001, 0.0001]], lvl ? 16 : 10, { f: (p) => { if (p[1] > 0.075) p[1] -= 0.014 * max(0, 1 - abs(p[0]) / (J.ha * 0.8)); } }).applyMatrix4(TR(0, fy, fz0, -0.12)), 0x4a3f36, B.hat, [0.85, 0]);
        add(Cyl(J.ha * 1.17, J.ha * 1.17, 0.02, lvl ? 16 : 10, 1, true).applyMatrix4(TR(0, fy + 0.012, fz0, -0.12, 0, 0, 1, 1, J.hd / J.ha * 0.93)), 0x1a1714, B.hat, [0.6, 0]);
        add(Cyl(J.ha * 1.85, J.ha * 1.85, 0.006, lvl ? 20 : 12).applyMatrix4(TR(0, fy - 0.002, fz0 + 0.005, -0.12, 0, 0, 1, 1, J.hd / J.ha * 0.95)), 0x433931, B.hat, [0.85, 0]);
        add(Box(0.03, 0.022, 0.002).applyMatrix4(TR(0.03, fy + 0.026, fz0 + J.hd * 1.0, -0.1, 0.4)), 0xf5f2e8, B.hat, [0.8, 0.1]);
        add(Box(0.03, 0.005, 0.0025).applyMatrix4(TR(0.03, fy + 0.032, fz0 + J.hd * 1.0, -0.1, 0.4)), 0xc0282e, B.hat, [0.8, 0.1]);
      },
      arm: sleeve(0xc8b28a, null, { k: 1.1, r: 0.85 }),
      leg: trousers(0x2f3240),
      shoe: [0x5b3b25, 0.4],
    },
    scettico: {
      torso(o) {
        const { J, s } = o;
        torsoSkin(o)(0x5a3e9a, 99, 0x5a3e9a, 0.95, 0.004, (x, y) => lin(y < J.hip + 0.02 ? 0x4f368a : 0x5a3e9a));
      },
      collar: [0x523891, 0.09, 1.18],
      head(o) {
        const { add, J, s, L } = o;
        hairCap(o, L.hair, { th: hairline(0.95, 1.55, 1.9), thick: (a, t) => 0.008 * smooth(0, 0.3, t) + 0.003, r: 0.55, cf: (x, y, z) => lin(abs(x + 0.03) < 0.0025 && z > J.hz - 0.02 && y > J.hc + J.hb * 0.55 ? 0x070707 : L.hair) });
        // the goatee and the moustache
        const mY = o.F.mY;
        add(patch(o, mY + 0.0125, mY + 0.0052, (t) => 0.0215 - 0.002 * t, 0.0026, 7), 0x1a1a1a, (x) => (abs(x) > 0.013 ? [B.smile, 0.6, B.head, 0.4] : B.head), [0.9, 0, 2]);
        add(patch(o, mY - 0.0105, J.hc - 0.112, (t) => 0.0095 + 0.011 * t, 0.0045, 7), 0x1a1a1a, B.jaw, [0.9, 0, 2]);
      },
      arm: sleeve(0x5a3e9a, null, { r: 0.95 }),
      leg: trousers(0x25262c, { w: 0.92 }),
      shoe: [0x111111, 0.3],
    },
  };
  const mixHex = (h1, h2, t) => new T.Color(h1).lerp(new T.Color(h2), t).getHex(), mix = mixHex;

  // ---- the shared material: vertex colours; matp = [roughness, glow + 10·kind], kind 1 skin (a warm
  // subsurface fill), 2 hair (strands), 3 cloth (weave, soft folds); the detail fades out beyond ~8 m
  let MAT = null, PROXY = null, BLOBS = null, RING = null;
  const RIM = { value: null }, SSS = { value: null }, DET = { value: 1 };
  const GLSL_N = "float ph3(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat vn3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);vec2 e=vec2(1.0,0.0);return mix(mix(mix(ph3(i),ph3(i+e.xyy),f.x),mix(ph3(i+e.yxy),ph3(i+e.xxy),f.x),f.y),mix(mix(ph3(i+e.yyx),ph3(i+e.xyx),f.x),mix(ph3(i+e.yxx),ph3(i+e.xxx),f.x),f.y),f.z);}";
  function material() {
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    m.skinning = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = RIM; sh.uniforms.uSss = SSS; sh.uniforms.uDet = DET;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 matp;\nvarying vec2 vMatp;\nvarying vec3 vLoc;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvMatp = matp; vLoc = position;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vMatp;\nvarying vec3 vLoc;\nuniform vec3 uRim, uSss;\nuniform float uDet;\n" + GLSL_N)
        .replace("#include <color_fragment>", "#include <color_fragment>\nfloat pKind = floor(vMatp.y * 0.1 + 0.01), pGlow = vMatp.y - pKind * 10.0, pFd = uDet * clamp(2.0 - length(vViewPosition) * 0.25, 0.0, 1.0);\nif (pFd > 0.0) {\n"
          + "if (pKind == 2.0) diffuseColor.rgb *= 1.0 + pFd * (1.0 - 0.9 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * (0.3 * vn3(vLoc * vec3(700.0, 45.0, 700.0)) + 0.2 * vn3(vLoc * vec3(1500.0, 90.0, 1500.0)) - 0.27);\n"
          + "else if (pKind == 3.0) diffuseColor.rgb *= 1.0 + pFd * (0.12 * vn3(vLoc * 820.0) + 0.16 * vn3(vLoc * vec3(34.0, 7.0, 34.0)) - 0.14);\n"
          + "else if (pKind == 1.0) diffuseColor.rgb *= 1.0 + pFd * (0.05 * vn3(vLoc * 1400.0) - 0.025);\n}")
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vMatp.x;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * pGlow;\nif (pKind == 1.0) totalEmissiveRadiance += diffuseColor.rgb * uSss;\nfloat rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\ntotalEmissiveRadiance += uRim * rimF * rimF * rimF * (0.4 + diffuseColor.rgb);");
    };
    m.customProgramCacheKey = () => "cp-people-2";
    return m;
  }

  // ---- channels of the pose
  const CH = ["px", "py", "pz", "hx", "hy", "hz", "sx", "sy", "sz", "cx", "cy", "cz", "nx", "ny", "nz", "kx", "ky", "kz", "jaw", "mo", "sm", "ex", "ey", "lid", "bL", "bR", "tL", "tR"];
  for (const S of "LR") CH.push(...["ce", "cp", "af", "aa", "at", "ef", "et", "wf", "wd", "fc", "ic", "tc", "lf", "la", "lt", "kn", "an"].map((n) => n + S));
  const blank = () => { const o = {}; for (const c of CH) o[c] = 0; return o; };
  const ARM = ["ce", "cp", "af", "aa", "at", "ef", "et", "wf", "wd", "fc", "ic", "tc"];
  // arm(o, side, [ce, cp, af, aa, at, ef, et, wf, wd, fc, ic, tc]) with undefined = keep
  // the hot path builds no strings: the keys of each side are made once
  const ARMK = { L: ARM.map((n) => n + "L"), R: ARM.map((n) => n + "R") };
  const arm = (o, S, v) => { const K = ARMK[S]; for (let i = 0; i < v.length; i++) if (v[i] !== undefined) o[K[i]] = v[i]; };
  const SIDEK = ["L", "R"].map((S, i) => ({ sd: i ? -1 : 1, K: Object.fromEntries(["cp", "ce", "af", "at", "aa", "ef", "et", "wd", "wf", "fc", "ic", "tc", "lf", "lt", "la", "kn", "an"].map((n) => [n, n + S])),
    bn: ["clav", "arm", "fore", "hand", "fing", "idx", "thumb", "thigh", "shin", "foot", "eye", "lid"].map((n) => B[n + S]) }));
  const HEAD_PITCH_MAX = 0.5; // rad, about 29° of spine, neck and head together: lower and the face hides
  const TYPE_PH = [["L", 0], ["R", 2.1]], TR_KEYS = ["py", "hx", "lfL", "lfR", "knL", "knR", "anL", "anR", "laL", "laR"];
  const REST = [0, 0, 0.03, 0.1, 0.12, 0.2, 0.55, 0.06, 0, 0.42, 0.32, 0.3];

  // ---- the people
  const PP = {}; // key -> person
  let detail = "medium", cmdSeq = 0, bubSeq = 0, clk = 0, followed = null, lastUpd = 0, overlayEl = null, motore = null;
  const pending = []; // events for the next frame
  const _v = () => new T.Vector3();
  let V1, V2, V3, Q1, E1, M1;

  function makePerson(key) {
    const L = LOOK[key];
    L.J = joints(L);
    L.F = faceGeom(L.J, key);
    L.P = bindPos(key, L.J);
    const bones = BONES.map((n) => { const b = new T.Bone(); b.name = key + "." + n; return b; });
    const par = (n) => (n === "carry" ? (ITEMS[key].carry === "under" ? "chest" : "handL") : PARENT[n]);
    BONES.forEach((n, i) => {
      const p = par(n), a = L.P[n];
      if (p) { const q = L.P[p]; bones[B[p]].add(bones[i]); bones[i].position.set(a[0] - q[0], a[1] - q[1], a[2] - q[2]); }
      else bones[i].position.set(a[0], a[1], a[2]);
    });
    bones[B.page].quaternion.setFromRotationMatrix(M4().makeBasis(new T.Vector3(...BOOK[0]), new T.Vector3(...BOOK[1]), new T.Vector3(...BOOK[2])));
    bones[B.page].userData.q0 = bones[B.page].quaternion.clone();
    const mesh = new T.SkinnedMesh(buildGeo(key, LV[detail]), MAT);
    mesh.userData.lvl = LV[detail];
    mesh.add(bones[0]);
    mesh.bind(new T.Skeleton(bones));
    mesh.castShadow = true; mesh.receiveShadow = false;
    fixBounds(mesh, L.J);
    mesh.name = "person." + key;
    const root = new T.Group();
    root.name = "agent." + key;
    root.scale.setScalar(L.J.k);
    root.add(mesh);
    const proxy = new T.Mesh(PROXY, MAT);
    proxy.visible = false; proxy.userData.agentKey = key; proxy.name = "pick." + key;
    proxy.scale.set(1, L.J.h, 1);
    root.add(proxy);
    root.userData.agentKey = key;
    const rnd = U.rng(key + "|people");
    const p = {
      key, L, J: L.J, root, mesh, bones, proxy, rnd, ph0: rnd() * 6,
      x: 0, z: 0, yaw: 0, posture: "stand", state: "idle", at: null,
      cmd: null, phase: 0, path: null, pi: 0, stuck: 0, best: 0, ref: null,
      tr: null, walk: { ph: 0, w: 0, v: 0 },
      T: blank(), S: blank(), O: blank(), snap: true,
      look: null, lookT: null, mood: "sereno", bodyYaw: null,
      blink: { next: 1 + rnd() * 3, t: -1, dbl: false }, mouth: 0, mouthT: 0, lidv: 0,
      acc: 0, far: false, items: {}, itemV: {}, pageT: 6 + rnd() * 6, page: 0, sleepRoll: 0, rollT: 30 + rnd() * 40,
      shift: { t: 2 + rnd() * 4, side: 1, v: 0 }, glance: { t: 3 + rnd() * 4, yaw: 0, pitch: 0, until: 0 }, sip: { t: 3 + rnd() * 4, v: 0, until: 0 },
      watch: { t: 6 + rnd() * 8, until: 0 }, nod: { t: 2 + rnd() * 3, v: 0, until: 0 }, gest: { t: 0, kind: 0 },
      top: { x: 0, y: L.J.h, z: 0 }, pelvisY: L.J.hip, fade: 1, fadeT: 1,
      tag: null, bubble: null, cloud: null,
    };
    return p;
  }
  const LV = { low: 0, medium: 1, high: 2 };
  function fixBounds(mesh, J) {
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.boundingSphere.center.set(0, J.h * 0.5, 0);
    mesh.geometry.boundingSphere.radius = J.h * 0.78;
  }

  // ---- posture placement
  // pelvis heights in the body's own units (the root is scaled by J.k)
  const seatY = (p, a) => (a && U.isNum(a.seatH) ? a.seatH : 0.46) / p.J.k + 0.05 * p.J.h;
  const lieY = (p, a) => (a && U.isNum(a.seatH) ? a.seatH : 0.52) / p.J.k + 0.1;
  function mapState(posture, st) {
    if (!C.STATES.includes(st) || st === "walk") st = "idle";
    if (st === "sit" && posture === "stand") return "stand";
    if (st === "sleep" && posture !== "lie") return "idle";
    return st;
  }
  function placeAt(p, g, state) {
    p.posture = g.posture;
    p.x = g.x; p.z = g.z;
    p.yaw = g.posture === "lie" ? g.face + PI : g.face;
    p.state = mapState(p.posture, state || (g.states && g.states[0]) || "idle");
    p.at = g.anchor || null;
    p.seat = g.posture === "sit" ? seatY(p, g.anchor) : g.posture === "lie" ? lieY(p, g.anchor) : 0;
    p.path = null; p.phase = 0; p.tr = null; p.walk.w = 0; p.walk.v = 0; p.bodyYaw = null;
    p.snap = true;
    syncRoot(p);
    // headOf agrees with positionOf at once
    const lie = g.posture === "lie";
    p.top.x = p.x + (lie ? Math.sin(g.face) * 0.8 : 0); p.top.z = p.z + (lie ? Math.cos(g.face) * 0.8 : 0);
    p.top.y = lie ? p.seat + 0.2 : g.posture === "sit" ? p.seat + p.J.h - p.J.hip : p.J.h;
  }
  function syncRoot(p) { p.root.position.set(p.x, 0, p.z); p.root.rotation.y = p.yaw; }
  // a goal from an anchor id or a point
  function goalOf(to) {
    if (typeof to === "string") {
      const a = C.world && C.world.anchor ? C.world.anchor(to) : null;
      if (!a) return null;
      return { x: a.x, z: a.z, face: U.isNum(a.face) ? a.face : 0, posture: a.posture || "stand", ax: U.isNum(a.ax) ? a.ax : a.x, az: U.isNum(a.az) ? a.az : a.z, anchor: a, states: a.states };
    }
    if (to && U.isNum(to.x) && U.isNum(to.z)) return { x: to.x, z: to.z, face: U.isNum(to.face) ? to.face : null, posture: "stand", ax: to.x, az: to.z, anchor: null, states: null };
    return null;
  }

  // ---- commands
  function emitLater(name, payload) { pending.push([name, payload]); }
  function command(key, cmd) {
    const p = PP[key];
    if (!p || !cmd) return 0;
    const id = ++cmdSeq;
    if ("lookAt" in cmd) p.look = cmd.lookAt == null ? null : cmd.lookAt;
    const c = { id, to: cmd.to == null ? null : cmd.to, state: cmd.state, speed: U.isNum(cmd.speed) && cmd.speed > 0 ? cmd.speed : 1, instant: !!cmd.instant || !!(ctx && ctx.reduceMotion) };
    if (c.to == null) {
      halt(p);
      if (c.state) p.state = mapState(p.posture, c.state);
      emitLater("people:arrived", { key, id, to: null });
      return id;
    }
    const g = goalOf(c.to);
    c.goal = g;
    if (!g) { // a missing anchor counts as «no path»: stay, say so, then carry on
      p.fadeT = 0.25; setTimeoutSafe(() => { p.fadeT = 1; }, 700);
      emitLater("people:blocked", { key, id, to: c.to });
      if (c.state) p.state = mapState(p.posture, c.state);
      emitLater("people:arrived", { key, id, to: c.to });
      return id;
    }
    if (g.face == null) g.face = p.yaw;
    if (c.instant) {
      placeAt(p, g, c.state);
      emitLater("people:arrived", { key, id, to: c.to });
      return id;
    }
    // a new command replaces the old one at once, from the current pose
    const ph = p.phase;
    p.cmd = c;
    if (ph === 1) return id;                                   // still getting up: then walk
    if (ph === 4 || (ph === 0 && p.posture !== "stand")) { beginRise(p); return id; }
    p.tr = null; p.path = null;
    beginWalk(p);
    return id;
  }
  const setTimeoutSafe = (f, ms) => setTimeout(() => { try { f(); } catch (e) { /* ignore */ } }, ms);

  // posture transitions: {from, to, t, dur, x0, z0, x1, z1, y0, y1, front}; front: the approach point lies
  // in front of the seat (one sits down backwards); otherwise (the meeting chairs) one steps in
  const inFront = (a) => !a || (a.ax - a.x) * sin(a.face) + (a.az - a.z) * cos(a.face) > 0;
  function beginRise(p) {
    const a = p.at;
    let x1 = a && U.isNum(a.ax) ? a.ax : p.x + sin(p.yaw) * 0.45, z1 = a && U.isNum(a.az) ? a.az : p.z + cos(p.yaw) * 0.45;
    if (p.posture === "lie") { const f = a && U.isNum(a.face) ? a.face : p.yaw + PI; x1 = a && U.isNum(a.ax) ? a.ax : p.x; z1 = a && U.isNum(a.az) ? a.az : p.z; p.tr = { from: "lie", to: "stand", t: 0, dur: 1.2, x0: p.x, z0: p.z, x1, z1, y0: p.yaw, y1: Math.atan2(x1 - p.x, z1 - p.z) || f }; }
    else if (p.tr && p.tr.to !== "stand") { const tr = p.tr; p.tr = { from: tr.to, to: "stand", t: (1 - tr.t / tr.dur) * 0.7, dur: 0.7, x0: tr.x1, z0: tr.z1, x1: tr.x0, z1: tr.z0, y0: tr.y1, y1: tr.y0, front: tr.front }; }
    else p.tr = { from: p.posture, to: "stand", t: 0, dur: 0.7, x0: p.x, z0: p.z, x1, z1, y0: p.yaw, y1: p.yaw, front: inFront(a) };
    p.phase = 1; p.state = "idle"; p.path = null;
  }
  // stop at once where one is: finish a posture change to the nearest posture
  function halt(p) {
    const tr = p.tr;
    if (tr && tr.to !== "turn") { const far = tr.t / tr.dur > 0.5; p.posture = far ? tr.to : tr.from; p.x = far ? tr.x1 : tr.x0; p.z = far ? tr.z1 : tr.z0; p.yaw = far ? tr.y1 : tr.y0; syncRoot(p); }
    p.tr = null; p.phase = 0; p.path = null; p.cmd = null;
    if (p.state === "walk") p.state = mapState(p.posture, "idle");
  }
  function beginWalk(p) {
    const g = p.cmd.goal;
    p.phase = 2; p.stuck = 0; p.best = 1e9; p.ref = { d: 1e9, t: clk };
    let path = null;
    try { path = C.world && C.world.findPath ? C.world.findPath({ x: p.x, z: p.z }, { x: g.ax, z: g.az }) : [{ x: g.ax, z: g.az }]; } catch (e) { path = null; }
    if (!path || !path.length) {
      if (hyp(g.ax - p.x, g.az - p.z) < 0.05) { beginTurn(p); return; }
      // no path: fade the tag, teleport to the approach point, say so, continue
      p.fadeT = 0.2; setTimeoutSafe(() => { p.fadeT = 1; }, 800);
      p.x = g.ax; p.z = g.az; syncRoot(p); p.snap = true;
      bus.emit("people:blocked", { key: p.key, id: p.cmd.id, to: p.cmd.to });
      beginTurn(p);
      return;
    }
    p.path = path.map((q) => ({ x: q.x, z: q.z }));
    p.pi = 0;
    p.state = "walk";
  }
  function beginTurn(p) {
    const g = p.cmd.goal;
    p.phase = 3; p.path = null;
    p.tr = { from: "stand", to: "turn", t: 0, dur: 0.3, x0: p.x, z0: p.z, x1: g.posture === "stand" ? g.x : p.x, z1: g.posture === "stand" ? g.z : p.z, y0: p.yaw, y1: g.posture === "lie" ? Math.atan2(g.ax - g.x, g.az - g.z) : g.face };
    if (g.posture === "lie" && !(hyp(g.ax - g.x, g.az - g.z) > 0.05)) p.tr.y1 = g.face + PI / 2;
  }
  function beginSettle(p) {
    const g = p.cmd.goal;
    if (g.posture === "stand") return arrive(p);
    p.phase = 4;
    p.tr = { from: "stand", to: g.posture, t: 0, dur: g.posture === "lie" ? 1.2 : 0.8, x0: p.x, z0: p.z, x1: g.x, z1: g.z, y0: p.yaw, y1: g.posture === "lie" ? g.face + PI : g.face, front: inFront(g.anchor) };
    p.seat = g.posture === "sit" ? seatY(p, g.anchor) : lieY(p, g.anchor);
    p.at = g.anchor;
  }
  function arrive(p) {
    const c = p.cmd, g = c.goal;
    p.posture = g.posture; p.x = g.x; p.z = g.z;
    p.yaw = g.posture === "lie" ? g.face + PI : g.face;
    p.at = g.anchor; p.tr = null; p.phase = 0; p.path = null;
    p.state = mapState(p.posture, c.state || (g.states && g.states[0]) || "idle");
    p.cmd = null;
    syncRoot(p);
    bus.emit("people:arrived", { key: p.key, id: c.id, to: c.to });
  }

  // ---- locomotion: path following with steering and separation
  function locomote(p, dt) {
    if (p.phase === 1 || p.phase === 3 || p.phase === 4) {
      const tr = p.tr; tr.t += dt;
      const u = clamp(tr.t / tr.dur, 0, 1), e = u * u * (3 - 2 * u);
      p.x = lerp(tr.x0, tr.x1, e); p.z = lerp(tr.z0, tr.z1, e);
      p.yaw = tr.y0 + U.wrapAngle(tr.y1 - tr.y0) * e;
      syncRoot(p);
      if (u >= 1) {
        if (p.phase === 1) { p.posture = "stand"; p.tr = null; p.at = null; beginWalk(p); }
        else if (p.phase === 3) { p.tr = null; beginSettle(p); }
        else arrive(p);
      }
      return;
    }
    if (p.phase !== 2 || !p.path) { p.walk.v = U.damp(p.walk.v, 0, 8, dt); return; }
    const path = p.path, last = path.length - 1;
    let tgt = path[p.pi];
    let dx = tgt.x - p.x, dz = tgt.z - p.z, d = hyp(dx, dz);
    while (p.pi < last && d < 0.45) { p.pi++; tgt = path[p.pi]; dx = tgt.x - p.x; dz = tgt.z - p.z; d = hyp(dx, dz); }
    const end = path[last], dEnd = p.pi === last ? d : d + segLen(path, p.pi);
    if (p.pi === last && d < 0.12) { p.x = end.x; p.z = end.z; p.walk.v = 0; syncRoot(p); beginTurn(p); return; }
    // the desired heading: towards the waypoint, rounding the corner ahead
    let hx = dx / (d || 1), hz = dz / (d || 1);
    if (p.pi < last && d < 1.0) { const n = path[p.pi + 1], nx = n.x - tgt.x, nz = n.z - tgt.z, nl = hyp(nx, nz) || 1, k = (1 - d) * 0.6; hx = hx * (1 - k) + (nx / nl) * k; hz = hz * (1 - k) + (nz / nl) * k; }
    const mood = p.mood === "teso" ? 1.15 : p.mood === "preoccupato" || p.mood === "assonnato" ? 0.9 : 1;
    let speed = p.L.sp * p.cmd.speed * mood;
    if (dEnd < 1) speed *= lerp(0.6, 1, dEnd);
    // separation: sideways from other walkers, round people who stand, sit or lie; queue behind
    let sx = 0, sz = 0, ahead = 1;
    const px = -hz, pz = hx; // the left of the heading
    for (const k of KEYS) {
      const o = PP[k]; if (o === p) continue;
      const ox = o.x - p.x, oz = o.z - p.z, od = hyp(ox, oz);
      if (od > 1.3 || od < 1e-4) continue;
      const side = ox * px + oz * pz > 0 ? -1 : 1, fwd = (ox * hx + oz * hz) / od;
      if (o.phase === 2) {
        if (od < 0.75) { const f = 1.2 * (1 - od / 0.75); sx += px * side * f; sz += pz * side * f; }
        if (fwd > 0.55 && od < 1 && sin(o.yaw) * hx + cos(o.yaw) * hz > 0.3) ahead = min(ahead, max(0.25, (od - 0.42) / 0.58));
      } else if (dEnd > 0.7) {
        const r = o.posture === "stand" ? 0.32 : 0.38, lim = r + 0.45;
        if (od < lim) { const f = min(1.6 * (1 - od / lim), 0.7 * speed) * (fwd > 0 ? 1 : 0.4); sx += px * side * f; sz += pz * side * f; if (fwd > 0.7) ahead = min(ahead, max(0.35, (od - r) / 0.45)); }
      }
    }
    // turn at most 4 rad/s towards the heading
    const want = Math.atan2(hx, hz), dy = U.wrapAngle(want - p.yaw), turn = clamp(dy, -4 * dt, 4 * dt);
    p.yaw += turn;
    const align = clamp(cos(dy), 0.25, 1);
    const v = speed * ahead * align;
    p.walk.v = U.damp(p.walk.v, v, 10, dt);
    let nx = p.x + sin(p.yaw) * p.walk.v * dt + sx * dt, nz = p.z + cos(p.yaw) * p.walk.v * dt + sz * dt;
    if ((sx || sz) && C.world && C.world.clear && !C.world.stub) {
      try { if (!C.world.clear({ x: nx, z: nz }, tgt)) { nx = p.x + sin(p.yaw) * p.walk.v * dt; nz = p.z + cos(p.yaw) * p.walk.v * dt; } } catch (e) { /* keep */ }
    }
    p.x = nx; p.z = nz;
    // a hard minimum distance from everyone (closer only at one's own anchor)
    for (const k of KEYS) {
      const o = PP[k]; if (o === p) continue;
      const lim = o.phase !== 2 && dEnd < 0.5 ? 0.3 : 0.42, ox = p.x - o.x, oz = p.z - o.z, od = hyp(ox, oz);
      if (od < lim && od > 1e-4) { const push = (lim - od) * (o.phase === 2 ? 0.5 : 1); p.x += (ox / od) * push; p.z += (oz / od) * push; }
    }
    syncRoot(p);
    // stuck: under 0.05 m/s of progress for 2 s -> sidestep 0.5 m; for 6 s -> jump to the next waypoint
    p.best = min(p.best, dEnd);
    if (clk - p.ref.t >= 1) {
      const el = clk - p.ref.t;
      p.stuck = (p.ref.d - p.best) / el < 0.05 ? p.stuck + el : 0;
      p.ref = { d: p.best, t: clk };
      if (p.stuck >= 6) {
        p.stuck = 0;
        p.x = tgt.x; p.z = tgt.z; syncRoot(p);
        bus.emit("people:blocked", { key: p.key, id: p.cmd.id, to: p.cmd.to });
        if (p.pi < last) p.pi++;
      } else if (p.stuck >= 2 && !p.side) {
        const sd = p.rnd() < 0.5 ? 1 : -1;
        path.splice(p.pi, 0, { x: p.x + px * 0.5 * sd + hx * 0.2, z: p.z + pz * 0.5 * sd + hz * 0.2, side: 1 });
        p.side = true;
      }
      if (p.stuck < 2) p.side = false;
    }
  }
  const segLen = (path, i) => { let l = 0; for (let j = i; j < path.length - 1; j++) l += hyp(path[j + 1].x - path[j].x, path[j + 1].z - path[j].z); return l; };

  // ---- look-at targets
  function lookPoint(p, out) {
    const t = p.look;
    if (t == null) return false;
    if (typeof t === "string") {
      if (PP[t] && PP[t] !== p) { const o = PP[t]; out.set(o.top.x, o.top.y - 0.12, o.top.z); return true; }
      if (t === "motore") { const sp = motorePoint(); out.set(sp.x, sp.y, sp.z); return true; }
      const a = C.world && C.world.anchor ? C.world.anchor(t) : null;
      if (!a) return false;
      if (a.look && U.isNum(a.look.x)) out.set(a.look.x, U.isNum(a.look.y) ? a.look.y : 1.2, a.look.z);
      else out.set(a.x, a.posture === "sit" ? 1.15 : a.posture === "lie" ? 0.7 : 1.55, a.z);
      return true;
    }
    if (U.isNum(t.x) && U.isNum(t.z)) { out.set(t.x, U.isNum(t.y) ? t.y : 1.5, t.z); return true; }
    return false;
  }
  function motorePoint() {
    const a = C.world && C.world.anchor ? C.world.anchor("riunione.screen") : null;
    return a && a.speak && U.isNum(a.speak.x) ? a.speak : { x: -1.4, y: 1.7, z: -16.8 };
  }
  // the default gaze of a state at an anchor (a monitor, the board) when nothing else is asked
  function defaultLook(p, out) {
    const a = p.at;
    if (a && a.look && U.isNum(a.look.x) && ["type", "read", "write", "think", "stand", "idle"].includes(p.state) && p.phase === 0) { out.set(a.look.x, U.isNum(a.look.y) ? a.look.y : 1.2, a.look.z); return true; }
    return false;
  }

  // ---- the pose library
  // fills p.T for the current posture, state and time; legs come later (IK)
  function poseTargets(p, t, dt) {
    const o = p.T, J = p.J, k = p.key, st = p.state, post = postureNow(p), rm = ctx && ctx.reduceMotion;
    for (let i = 0; i < CH.length; i++) o[CH[i]] = 0;
    arm(o, "L", REST); arm(o, "R", REST);
    const breath = sin(t * (post === "lie" ? 1.25 : 1.75) + p.ph0);
    // the posture base
    if (post === "sit") {
      o.py = p.seat; o.hx = -0.06; o.sx = 0.07; o.cx = 0.05; o.nx = 0.04;
      for (const S of "LR") arm(o, S, [0, 0, 0.5, 0.14, 0.32, 0.82, 1.25, 0.12, 0, 0.3, 0.25, 0.25]);
    } else if (post === "lie") {
      o.py = p.seat; o.hx = -PI / 2; o.nx = 0.28; o.kx = 0.06;
      for (const S of "LR") arm(o, S, [0, 0, 0.05, 0.16, 0.1, 0.35, 0.9, 0.1, 0, 0.5, 0.45, 0.3]);
      // turning over now and then
      if (st === "sleep") {
        o.hy = p.sleepRoll * 1.15;
        if (p.sleepRoll) { o.lfL = o.lfR = 0.45; o.knL = o.knR = 0.85; o.cy = -p.sleepRoll * 0.2; arm(o, p.sleepRoll > 0 ? "R" : "L", [0, 0, 0.9, 0.1, 0.4, 1.1, 0.8]); arm(o, p.sleepRoll > 0 ? "L" : "R", [0, 0, 0.55, 0.05, 0.3, 1.3, 0.8]); }
        else { o.lfL = 0.04; o.lfR = 0.1; o.knL = 0.06; o.knR = 0.22; o.anL = o.anR = -0.35; o.ky = 0.3; arm(o, "R", [0, 0.06, 0.35, 0.05, 0.6, 1.75, 0.9]); }
      } else { o.lfL = o.lfR = 0.05; o.knL = o.knR = 0.08; o.anL = o.anR = -0.3; o.nx = 0.45; }
    } else {
      o.py = J.hip - 0.012;
    }
    // the character in the body: stoop, tension, posture
    if (k === "preside") { o.sx += 0.05; o.cx += 0.09; o.nx += 0.12; o.kx -= 0.12; }
    if (k === "falco") { o.cx -= 0.03; o.kx -= 0.02; }
    if (k === "tartaruga") { o.sx += 0.03; o.nx += 0.04; }
    if (k === "guardiano") { o.cx -= 0.02; }
    // mood
    const m = p.mood;
    if (m === "teso") { o.ceL = o.ceR = 0.07; o.cx -= 0.02; }
    if (m === "preoccupato") { o.kx += 0.1; o.nx += 0.06; }
    if (m === "assonnato") { o.kx += 0.12; o.lid = 0.38; }
    if (m === "contento") { o.cx -= 0.03; o.kx -= 0.04; }
    // the state layer
    const w = (f, ph = 0) => (rm ? 0 : sin(t * f + ph));
    const carry = ITEMS[k].carry, standing = post === "stand";
    switch (st) {
      case "idle": case "stand": case "walk": case "listen": {
        if (standing) idleArms(p, o, t, st);
        if (st === "listen") { o.kx += 0.05 + nodding(p, t, dt) ; }
        break;
      }
      case "sit": break;
      case "type":
        o.sx += 0.05; o.cx += 0.06; o.kx += 0.1;
        for (const [S, ph] of TYPE_PH) arm(o, S, [0, 0.02, 0.52, 0.2, 0.42, 1.25, 1.42, -0.12, 0, 0.45 + 0.2 * w(17, ph), 0.35 + 0.25 * w(23, ph + 1), 0.3]);
        o.afL += 0.015 * w(5.3); o.afR += 0.015 * w(4.7, 1);
        break;
      case "read":
        o.kx += 0.2; o.nx += 0.06; o.sx += 0.05; o.cx += 0.07;
        for (const S of "LR") arm(o, S, [0, 0.03, 0.26, 0.04, 0.34, 1.62, 0.05, -0.2, 0.05, 0.55, 0.45, 0.25]);
        if (ITEMS[k].mag) arm(o, "R", [0.02, 0.05, 0.42, 0.1, 0.45, 1.75, 0.1, 0.1, 0.1, 0.8, 0.75, 0.6]);
        break;
      case "talk": {
        o.kx += 0.03 * w(2.3); o.ky += 0.05 * w(0.9);
        const beat = p.mouth * 0.25;
        arm(o, "R", [0, 0, 0.25 + 0.08 * w(1.7), 0.14, 0.3, 1.0 + 0.22 * w(2.6) + beat, 0.4 + 0.3 * w(1.3), 0.05 * w(3.1), 0, 0.25, 0.15, 0.2]);
        if (!(carry && standing)) arm(o, "L", [0, 0, 0.18 + 0.05 * w(1.4, 2), 0.12, 0.25, 0.75 + 0.15 * w(2.1, 1), 0.6, 0, 0, 0.35, 0.25, 0.25]);
        if (!standing) { o.afR += 0.2; o.afL += 0.25; }
        break;
      }
      case "gesture": {
        const ph = (t * 0.45) % 3 | 0;
        o.cx -= 0.02;
        if (ph === 0) { aimArm(p, o, "R"); arm(o, "L", [0, 0, 0.35, 0.3, 0.1, 1.0, -0.4, 0, 0, 0.1, 0.05, 0.1]); }
        else if (ph === 1) { for (const S of "LR") arm(o, S, [0.04, 0.05, 0.55 + 0.1 * w(3), 0.5, 0.0, 0.7, -0.6, 0.1, 0, 0.1, 0.05, 0.1]); }
        else { arm(o, "R", [0, 0, 0.55 + 0.25 * abs(w(4)), 0.1, 0.4, 1.3 - 0.4 * abs(w(4)), 0.9, -0.2, 0, 0.15, 0.1, 0.2]); arm(o, "L", [0, 0, 0.25, 0.15, 0.3, 1.0, 0.6]); }
        o.kx += 0.03 * w(3.3);
        break;
      }
      case "drink": {
        const s = p.sip;
        s.t -= dt;
        if (s.t <= 0 && !s.until) { s.until = 1.6; }
        if (s.until) { s.until -= dt; if (s.until <= 0) { s.until = 0; s.t = 6 + p.rnd() * 4; } }
        const lift = s.until ? smooth(1.6, 1.25, s.until) * smooth(0, 0.35, s.until) : 0;
        arm(o, "R", [0, 0.02, lerp(0.28, 0.7, lift), lerp(0.16, 0.22, lift), lerp(0.25, 0.55, lift), lerp(1.6, 2.35, lift), lerp(0.15, 0.3, lift), lerp(0, 0.25, lift), 0, 0.75, 0.7, 0.6]);
        o.kx -= 0.16 * lift;
        break;
      }
      case "sleep": o.lid = 1; break;
      case "think": {
        arm(o, "R", [0.04, 0.06, 0.5, -0.16, 0.42, 2.52, 1.05, 0.5, 0.1, 0.95, 0.6, 0.5]);
        arm(o, "L", [0, 0.04, 0.22, 0.03, 1.2, 1.62, 0.85, 0, 0, 0.5, 0.4, 0.3]);
        o.kx -= 0.06 + 0.05 * w(0.6); o.ky += 0.06; o.ex = 0.3; o.ey = 0.25;
        if (ITEMS[k].mag) arm(o, "R", [0.03, 0.04, 0.6, 0.05, 0.5, 2.25, 0.6, 0.1, 0.1, 0.95, 0.9, 0.7]);
        break;
      }
      case "write":
        if (standing) {
          arm(o, "R", [0.06, 0.04, 1.45 + 0.04 * w(7), 0.08 + 0.05 * w(5.3) + 0.06 * w(0.7), 0.3, 0.75, 1.0, -0.25, 0, 0.75, 0.6, 0.6]);
          o.kx -= 0.04; o.ky += 0.08 * w(0.7);
        } else {
          o.sx += 0.1; o.cx += 0.1; o.kx += 0.22;
          arm(o, "R", [0, 0.03, 0.62, 0.14, 0.4, 1.12, 1.3, 0.3 + 0.05 * w(9), 0.04 * w(6), 0.65, 0.55, 0.55]);
          arm(o, "L", [0, 0.03, 0.6, 0.22, 0.55, 1.05, 1.45, -0.05, 0, 0.2, 0.15, 0.2]);
        }
        break;
    }
    // breathing (the breath bone scales elsewhere) and a tiny sway
    o.cx += 0.008 * breath; o.ceL += 0.006 * breath; o.ceR += 0.006 * breath;
    // look-at
    lookAtPose(p, o, t, dt, post);
    // reading or writing, the torso leans and the head stays up enough to show the face
    if ((st === "read" || st === "write") && o.sx + o.cx + o.nx + o.kx > HEAD_PITCH_MAX) o.kx = HEAD_PITCH_MAX - o.sx - o.cx - o.nx;
    // the face
    faceTargets(p, o, t, dt);
  }
  // the standing arms per character, and idle life (glance, watch, weight shift)
  function idleArms(p, o, t, st) {
    const k = p.key, it = ITEMS[k];
    if (it.carry === "under") arm(o, "L", [0.02, 0, 0.12, 0.24, -0.05, 1.05, 0.35, 0.1, 0, 0.65, 0.55, 0.4]);
    if (it.carry === "tablet" || it.carry === "note") arm(o, "L", [0, 0, 0.12, 0.08, 0.1, 0.55, 0.3, 0.1, 0, 0.75, 0.65, 0.6]);
    if (st === "walk") return;
    if (k === "falco" && st === "idle") {
      const w = p.watch;
      if (w.until > 0) { arm(o, "L", [0, 0.03, 0.55, 0.15, 0.5, 1.85, 1.35, 0.05, 0, 0.6, 0.5, 0.4]); o.kx += 0.42; o.ky += 0.12; }
    }
    if (k === "tartaruga") for (const S of "LR") arm(o, S, [0, 0.02, 0.22, -0.05, 0.62, 0.95, 1.05, 0.15, 0, 0.6, 0.5, 0.45]);
    if (k === "spazzino") for (const S of "LR") arm(o, S, [0.02, -0.02, -0.04, 0.2, 0.32, 0.55, 0.45, 0.45, 0, 0.75, 0.7, 0.6]);
    if (k === "guardiano" || (k === "scettico" && st === "idle")) {
      arm(o, "R", [0.03, 0.06, 0.38, -0.02, 1.15, 1.9, 0.55, 0.1, 0, 0.6, 0.5, 0.4]);
      arm(o, "L", [0.03, 0.06, 0.32, -0.02, 1.05, 2.05, 0.5, 0.05, 0, 0.6, 0.5, 0.4]);
      if (k === "scettico") arm(o, "R", [0.02, 0.04, 0.12, 0.12, 0.2, 0.75, 0.2, 0, 0.1, 0.85, 0.8, 0.6]);
    }
    if (k === "ragioniere" && st === "idle") arm(o, "R", [0, 0.02, -0.25, 0.08, 0.7, 1.05, 0.6, 0.15, 0, 0.6, 0.5, 0.4]);
    if (k === "cronista" && st === "idle") arm(o, "R", [0, 0, 0.08, 0.1, 0.2, 0.45, 0.55, 0.1, 0, 0.6, 0.5, 0.5]);
  }
  function nodding(p, t, dt) {
    const n = p.nod;
    n.t -= dt;
    if (n.t <= 0) { n.until = 0.7; n.t = 3 + p.rnd() * 3; }
    if (n.until > 0) { n.until -= dt; return 0.12 * sin((0.7 - n.until) / 0.7 * PI * 2) * (n.until > 0 ? 1 : 0); }
    return 0;
  }
  // point the right arm at the look target (gesture)
  function aimArm(p, o, S) {
    let yaw = 0.2, pitch = 0.1;
    if (lookPoint(p, V1)) {
      const dx = V1.x - p.x, dz = V1.z - p.z;
      yaw = clamp(U.wrapAngle(Math.atan2(dx, dz) - p.yaw), -1.2, 1.2);
      pitch = clamp(Math.atan2(V1.y - 1.45, hyp(dx, dz)), -0.5, 0.5);
    }
    // right arm: flex up to the horizon + pitch; abduct outwards for targets to the right (negative yaw)
    arm(o, S, [0.05, 0.08, 1.35 + pitch * 0.8, clamp(-yaw * 0.9, -0.4, 1.1), 0.1, 0.25, 1.4, -0.1, 0, 0.9, 0.0, 0.7]);
  }

  // head, neck, chest and eyes towards the look target; the body turns for big angles
  function lookAtPose(p, o, t, dt, post) {
    let has = lookPoint(p, V1);
    if (!has) has = defaultLook(p, V1);
    const rm = ctx && ctx.reduceMotion;
    let yaw = 0, pitch = 0;
    if (has) {
      const hx = p.top.x, hy = p.top.y - 0.12, hz = p.top.z;
      const dx = V1.x - hx, dz = V1.z - hz;
      yaw = U.wrapAngle(Math.atan2(dx, dz) - p.yaw);
      pitch = Math.atan2(V1.y - hy, hyp(dx, dz) || 1e-3);
      // standing still: turn the whole body for targets beyond 70°, or square to it in «stand»
      if (post === "stand" && p.phase === 0 && (abs(yaw) > 1.22 || (p.state === "stand" && abs(yaw) > 0.5)) && !p.tr) {
        const turn = clamp(yaw, -2.4 * dt, 2.4 * dt);
        p.yaw += turn; syncRoot(p); yaw -= turn;
      }
    } else if (post !== "lie" && p.phase !== 2 && !rm && p.state !== "sleep") {
      // glance around now and then
      const g = p.glance;
      g.t -= dt;
      if (g.t <= 0) { g.yaw = (p.rnd() - 0.5) * (p.key === "spazzino" || p.key === "guardiano" ? 1.6 : 1.0); g.pitch = (p.rnd() - 0.6) * 0.25; g.until = 1 + p.rnd() * 1.4; g.t = g.until + 3 + p.rnd() * 4; }
      if (g.until > 0) { g.until -= dt; yaw = g.yaw; pitch = g.pitch; }
      if (p.key === "falco" && p.state === "idle") { const w = p.watch; w.t -= dt; if (w.t <= 0) { w.until = 1.8; w.t = 9 + p.rnd() * 9; } if (w.until > 0) { w.until -= dt; yaw = 0; pitch = 0; } }
    }
    if (post === "lie") { yaw *= 0.3; pitch = 0; }
    const lim = 1.22, yh = clamp(yaw, -lim, lim), torso = post === "sit" ? clamp(yh * 0.25, -0.35, 0.35) : yh * 0.22;
    o.cy += torso * 0.5; o.sy += torso * 0.5;
    o.ny += (yh - torso) * 0.4; o.ky += (yh - torso) * 0.6;
    const ph = clamp(pitch, -0.52, 0.52);
    o.nx -= ph * 0.35; o.kx -= ph * 0.65;
    // the eyes: what the head cannot reach, plus they lead
    o.ex += clamp(yaw - yh, -0.26, 0.26) + clamp(yaw - (p.S.ky + p.S.ny + p.S.cy + p.S.sy), -0.25, 0.25) * 0.5;
    o.ey += clamp(pitch - ph, -0.26, 0.26) + clamp(pitch + p.S.kx + p.S.nx, -0.2, 0.2) * 0.4;
  }

  // brows by mood, the mouth from the bubble, blinking
  const BROWS = { sereno: [0, 0], contento: [0.0018, 0.05], teso: [-0.0022, -0.22], preoccupato: [0.0012, 0.32], concentrato: [-0.0012, -0.12], curioso: [0.0028, 0.08], dubbioso: [0.0005, -0.06], severo: [-0.0018, -0.18], assonnato: [0.001, 0.08] };
  const SMILE = { sereno: 0.2, contento: 0.75, teso: -0.3, preoccupato: -0.35, concentrato: -0.05, curioso: 0.3, dubbioso: -0.12, severo: -0.3, assonnato: 0 };
  function faceTargets(p, o, t, dt) {
    const b = BROWS[p.mood] || BROWS.sereno, s = p.J.s;
    o.bL = o.bR = b[0]; o.tL = o.tR = b[1];
    if (p.state === "think") { o.bL += 0.0015; o.tL += 0.1; o.tR += 0.1; }
    if (p.state === "listen") { o.bL += 0.0008; o.bR += 0.0008; }
    if (p.key === "scettico") { o.bL += 0.0045; o.tL -= 0.15; }
    if (p.key === "falco") { o.tL -= 0.08; o.tR -= 0.08; }
    o.sm = SMILE[p.mood] != null ? SMILE[p.mood] : 0.15;
    if (p.key === "tartaruga") o.sm += 0.2;
    // the mouth: following the typed characters
    p.mouthT = 0;
    const bu = p.bubble;
    if (bu && bu.typing) p.mouthT = bu.openness;
    if (p.state === "sleep") p.mouthT = 0.08;
    p.mouth = U.damp(p.mouth, p.mouthT, p.mouthT > p.mouth ? 30 : 18, dt);
    o.mo = p.mouth; o.jaw = p.mouth; p.mouthPeak = max(p.mouthPeak || 0, p.mouth);
    // blinks every 2.5-6 s, 120 ms, with a 10% chance of a double one; more often while listening
    const bl = p.blink;
    bl.next -= dt;
    if (bl.next <= 0 && bl.t < 0) { bl.t = 0; bl.dbl = p.rnd() < 0.1; p.blinks = (p.blinks || 0) + 1; }
    let lc = 0;
    if (bl.t >= 0) {
      // the first frame of a blink is always closed, so it shows even at low frame rates
      lc = bl.t < 0.06 ? 1 : max(0, 1 - (bl.t - 0.06) / 0.06);
      bl.t += dt;
      if (bl.t >= 0.12 && lc < 1) {
        if (bl.dbl) { bl.dbl = false; bl.t = -1; bl.next = 0.15; }
        else { bl.t = -1; bl.next = (2.5 + p.rnd() * 3.5) * (p.state === "listen" ? 0.65 : 1); }
      }
    }
    p.lidv = max(o.lid, lc);
    p.lidPeak = max(p.lidPeak || 0, lc);
  }
  function postureNow(p) {
    const tr = p.tr;
    if (!tr || tr.to === "turn") return p.posture;
    return tr.t / tr.dur > 0.5 ? tr.to : tr.from;
  }

  // ---- legs: two-bone IK in the hips frame
  function legIK(p, S, ax, ay, az, o, pitch) {
    const J = p.J, sd = S === "L" ? 1 : -1;
    E1.set(o.hx, o.hy, o.hz); Q1.setFromEuler(E1);
    V2.set(sd * J.hipX, 0, 0).applyQuaternion(Q1);
    V3.set(ax - (o.px + V2.x), ay - (o.py + V2.y), az - (o.pz + V2.z)).applyQuaternion(Q1.invert());
    const L1 = J.thigh, L2 = J.shin;
    let d = V3.length();
    const dd = clamp(d, abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
    const knee = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dd * dd) / (2 * L1 * L2), -1, 1));
    const al = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    d = d || 1;
    const f = Math.atan2(V3.z, -V3.y) + al;
    o["lf" + S] = f;
    o["la" + S] = sd * Math.asin(clamp(V3.x / d, -1, 1));
    o["kn" + S] = knee;
    o["an" + S] = o.hx - f + knee - (pitch || 0);
  }
  function legsFor(p, o, t, dt, post) {
    const J = p.J, tr = p.tr;
    if (post === "lie" && !(tr && tr.to !== "turn")) return; // FK set in the pose
    const fx = J.hipX * 0.98 + 0.012;
    if (tr && tr.to !== "turn" && (tr.from === "lie" || tr.to === "lie")) {
      // getting into or out of bed: blended FK
      const u = clamp(tr.t / tr.dur, 0, 1), e = tr.to === "lie" ? u : 1 - u;
      const sitK = sin(PI * min(1, e * 1.6)) ;
      o.py = lerp(J.hip - 0.012, p.seat, smooth(0, 0.55, e));
      o.hx = -PI / 2 * smooth(0.35, 1, e) - 0.06 * sitK;
      for (const S of "LR") { o["lf" + S] = 1.4 * sitK * (1 - smooth(0.6, 1, e)) + 0.05; o["kn" + S] = 1.5 * sitK * (1 - smooth(0.6, 1, e)) + 0.08; o["an" + S] = -0.2; }
      return;
    }
    if (post === "sit" && !tr) {
      for (const [S, sd] of [["L", 1], ["R", -1]]) {
        const hy = o.py, reach = J.thigh * 0.98 + Math.sqrt(max(0, J.shin * J.shin - (hy - J.ank) ** 2)) * 0.98;
        legIK(p, S, sd * (fx + 0.03), J.ank, reach, o, 0);
      }
      return;
    }
    // standing, or sitting down / getting up: feet planted
    let wx = 0, roll = 0;
    if (post === "stand" && !tr && p.phase === 0 && !(ctx && ctx.reduceMotion)) {
      const sh = p.shift;
      sh.t -= dt;
      if (sh.t <= 0) { sh.side = -sh.side; sh.t = 4 + p.rnd() * 4; }
      sh.v = U.damp(sh.v, sh.side, 1.6, dt);
      const st = p.state === "stand"; wx = sh.v * (st ? 0.012 : 0.036); roll = sh.v * (st ? 0.01 : 0.055); o.py -= st ? 0 : 0.008 * abs(sh.v); o.ky -= st ? 0 : 0.05 * sh.v;
    }
    o.px += wx; o.hz += roll; o.sz -= roll * 0.7; o.cz -= roll * 0.4;
    let fz = 0, py = o.py, lean = 0;
    if (tr && tr.to !== "turn") {
      // sitting down / standing up: the pelvis drops behind the feet, the trunk leans forward
      const u = clamp(tr.t / tr.dur, 0, 1), e = tr.to === "sit" ? u : 1 - u, ee = e * e * (3 - 2 * e);
      const seat = p.seat || seatY(p, p.at);
      py = lerp(J.hip - 0.012, seat, ee);
      o.py = py;
      lean = 0.55 * sin(PI * e);
      o.hx += lean * 0.6 - 0.06 * ee; o.sx += lean * 0.3;
      // the feet stay where the person stood (the approach point), in the moving root frame
      const ddx = (tr.to === "sit" ? tr.x0 : tr.x1) - p.x, ddz = (tr.to === "sit" ? tr.z0 : tr.z1) - p.z;
      fz = tr.front ? (ddx * sin(p.yaw) + ddz * cos(p.yaw)) / J.k : 0;
      const sitReach = J.thigh * 0.98 + Math.sqrt(max(0, J.shin * J.shin - (seat - J.ank) ** 2)) * 0.98;
      fz = lerp(fz, sitReach, smooth(0.6, 1, e));
    }
    const toe = p.key === "falco" ? 0.08 : 0.16;
    o.ltL = o.ltR = -toe;
    legIK(p, "L", fx + (p.key === "guardiano" ? 0.03 : 0), J.ank, fz + 0.01, o, 0);
    legIK(p, "R", -fx - (p.key === "guardiano" ? 0.03 : 0), J.ank, fz - 0.01, o, 0);
  }

  // ---- the walk cycle: overrides pelvis, spine, arms and legs
  function walkPose(p, o, dt) {
    const J = p.J, [stepK, armA, bob, sway, lift, lean] = p.L.gait, v = p.walk.v;
    const step = stepK * J.h * clamp(0.75 + 0.25 * v / p.L.sp, 0.75, 1.1);
    p.walk.ph = (p.walk.ph + (v * dt) / (2 * step * J.k)) % 1;
    const ph = p.walk.ph, c2 = cos(TAU * (ph - 0.3)), c4 = cos(2 * TAU * (ph - 0.3));
    const amp = clamp(v / p.L.sp, 0, 1.2);
    o.py = J.hip - 0.022 + bob * amp * c4;
    o.px = sway * amp * c2;
    o.hy = -0.08 * amp * cos(TAU * ph);
    o.hz = 0.04 * amp * c2;
    o.hx = 0.03 + lean * 0.5;
    o.sx = 0.02 + lean * 0.5 + 0.03 * v; o.sz = -0.5 * o.hz;
    o.cy = 0.07 * amp * cos(TAU * ph); o.cx = (p.key === "falco" ? -0.04 : 0.01) + 0.005 * c4;
    o.ny = -0.5 * (o.hy + o.cy); o.ky = -0.5 * (o.hy + o.cy);
    o.kx = (p.key === "preside" ? -0.06 : 0) - 0.02 * c4;
    // the arms swing against the legs
    const it = ITEMS[p.key];
    for (const [S, sgnA] of [["L", -1], ["R", 1]]) {
      const swing = armA * amp * sgnA * cos(TAU * ph);
      const busy = (S === "L" && it.carry) || (S === "R" && ["drink", "read"].includes(p.state));
      const k = busy ? 0.25 : 1;
      o["af" + S] = (busy ? o["af" + S] : 0.02) + swing * k;
      if (!busy) { o["ef" + S] = 0.25 + 0.3 * max(0, swing / (armA || 1)) * armA; o["aa" + S] = 0.1; o["et" + S] = 0.5; }
    }
    // the feet: stance 60% of the cycle, rolling heel to toe; swing with lift
    const fx = J.hipX * 0.92 + (p.key === "tartaruga" ? 0.025 : 0.008);
    for (const [S, sd, off] of [["L", 1, 0], ["R", -1, 0.5]]) {
      const q = (ph + off) % 1;
      let z, y = J.ank, pitch = 0;
      if (q < 0.6) {
        const u = q / 0.6;
        z = step * 0.6 * (1 - 2 * u);
        pitch = -0.22 * smooth(0.12, 0, u) + 0.55 * smooth(0.7, 1, u);
        y += 0.14 * max(0, sin(pitch)) + 0.02 * max(0, -sin(pitch));
      } else {
        const u = (q - 0.6) / 0.4, e = u * u * (3 - 2 * u);
        z = -step * 0.6 + step * 1.2 * e;
        y += lift * amp * sin(PI * u) + 0.06 * (1 - u) ** 2;
        pitch = lerp(0.6, -0.25, smooth(0, 0.8, u));
      }
      o["lt" + S] = -0.08;
      legIK(p, S, sd * fx, y, z, o, pitch * amp);
    }
  }

  // ---- applying a pose to the bones
  function applyBones(p, o) {
    const b = p.bones, J = p.J;
    b[B.hips].position.set(o.px, o.py, o.pz);
    b[B.hips].rotation.set(o.hx, o.hy, o.hz);
    b[B.spine].rotation.set(o.sx, o.sy, o.sz);
    b[B.chest].rotation.set(o.cx, o.cy, o.cz);
    b[B.neck].rotation.set(o.nx, o.ny, o.nz);
    b[B.head].rotation.set(o.kx, o.ky, o.kz);
    const br = 1 + 0.012 * sin(clk * (p.state === "sleep" ? 1.25 : 1.75) + p.J.h * 10);
    b[B.breath].scale.set(br, 1 + (br - 1) * 0.4, br * 1.1);
    for (let i = 0; i < 2; i++) {
      const { sd, K, bn } = SIDEK[i];
      b[bn[0]].rotation.set(0, -sd * o[K.cp], sd * o[K.ce]);
      b[bn[1]].rotation.set(-o[K.af], -sd * o[K.at], sd * o[K.aa]);
      b[bn[2]].rotation.set(-o[K.ef], -sd * o[K.et], 0);
      b[bn[3]].rotation.set(-o[K.wd], 0, -sd * o[K.wf]);
      b[bn[4]].rotation.set(0, 0, -sd * o[K.fc] * 1.4);
      b[bn[5]].rotation.set(0, 0, -sd * o[K.ic] * 1.4);
      b[bn[6]].rotation.set(0.2 * o[K.tc], sd * 0.5 * o[K.tc], -sd * 0.5 * o[K.tc]);
      b[bn[7]].rotation.set(-o[K.lf], sd * o[K.lt], sd * o[K.la]);
      b[bn[8]].rotation.set(o[K.kn], 0, 0);
      b[bn[9]].rotation.set(-o[K.an], 0, 0);
    }
    // face
    const lvl = LV[detail], s = J.s;
    const eyes = clamp(o.ex, -0.4, 0.4), eyp = clamp(o.ey, -0.35, 0.35);
    for (let i = 0; i < 2; i++) {
      const e = b[SIDEK[i].bn[10]];
      e.rotation.set(-eyp, eyes, 0);
      if (lvl === 0) e.scale.set(1, 1 - 0.9 * p.lidv, 1); else e.scale.set(1, 1, 1);
      b[SIDEK[i].bn[11]].rotation.set(lerp(0, 0.98, p.lidv) - eyp * 0.4, 0, 0);
    }
    b[B.browL].position.set(L0(p, "browL", 0), L0(p, "browL", 1) + o.bL, L0(p, "browL", 2));
    b[B.browR].position.set(L0(p, "browR", 0), L0(p, "browR", 1) + o.bR, L0(p, "browR", 2));
    b[B.browL].rotation.z = -o.tL; b[B.browR].rotation.z = o.tR;
    b[B.jaw].rotation.x = 0.2 * o.jaw;
    b[B.mouth].scale.set(1 - 0.15 * o.mo, 0.14 + 1.35 * o.mo, 1);
    b[B.smile].position.set(L0(p, "smile", 0), L0(p, "smile", 1) + 0.005 * o.sm, L0(p, "smile", 2) - 0.002 * abs(o.sm));
    b[B.smile].scale.set(1 + 0.08 * o.sm, 1, 1);
    // items
    for (const n of ["hat", "back", "carry", "read", "cup", "pen", "mag"]) {
      const v = p.itemV[n] = U.damp(p.itemV[n] == null ? 1 : p.itemV[n], p.items[n] ? 1 : 0, p.snap ? 1e3 : 14, p.adt || 0.016);
      const sc = v < 0.02 ? 1e-4 : v;
      b[B[n]].scale.set(sc, sc, sc);
    }
    b[B.page].quaternion.copy(b[B.page].userData.q0).multiply(Q1.setFromAxisAngle(V2.set(0, 1, 0), -PI * p.page));
  }
  // a bone's bind offset from its parent
  const L0 = (p, n, i) => p.bones[B[n]].userData.b0[i];

  function itemsFor(p) {
    const st = p.state, post = postureNow(p), it = ITEMS[p.key], k = p.key, I = p.items;
    const mode = C.life && C.life.mode;
    I.hat = post !== "lie" && (k !== "preside" || ["riunione", "diretta", "replica", "emergenza", "palestra"].includes(mode));
    I.back = !!it.back && post === "stand";
    I.read = st === "read";
    I.cup = st === "drink";
    I.pen = st === "write";
    I.mag = !!it.mag && post !== "lie" && !["drink", "write", "type", "read"].includes(st) || (!!it.mag && st === "read");
    I.carry = !!it.carry && post === "stand" && !["read", "write", "gesture", "drink", "type", "think"].includes(st);
  }

  // ---- one frame of one person
  // a blanket in the owner's colour from the waist past the feet (the body lies along +z of its root)
  function blanketFor(p, on) {
    if (!on) { if (p.blanket) p.blanket.visible = false; return; }
    if (!p.blanket) {
      const J = p.J, len = J.hip + 0.32, g = Box(0.6, 0.05, len).translate(0, 0, len / 2 - 0.12);
      const col = new T.Color(C.COLORS[p.key] || 0x777777).lerp(new T.Color(0xf1ece2), 0.35).convertSRGBToLinear();
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: col, roughness: 0.95 }));
      const side = new T.Mesh(Box(0.02, 0.24, len), m.material);
      for (const sd of [-1, 1]) { const s = side.clone(); s.position.set(sd * 0.3, -0.12, len / 2 - 0.12); m.add(s); }
      m.receiveShadow = true; m.name = "blanket." + p.key;
      p.root.add(m); p.blanket = m;
    }
    p.blanket.visible = true;
    p.blanket.position.set(0, p.seat + 0.15, 0);
  }
  function animate(p, t, dt) {
    p.adt = dt;
    itemsFor(p);
    poseTargets(p, t, dt);
    const Tg = p.T, S = p.S;
    const post = postureNow(p);
    // pelvis & legs (IK) on the targets
    legsFor(p, Tg, t, dt, post);
    // damp towards the targets (snap after a placement)
    const lam = p.snap ? 1e3 : 10;
    const kd = 1 - Math.exp(-lam * dt), kp = 1 - Math.exp(-lam * 1.6 * dt);
    for (let i = 0; i < CH.length; i++) { const c = CH[i]; S[c] += (Tg[c] - S[c]) * (i < 2 ? kp : kd); }
    if (p.tr && p.tr.to !== "turn") for (let i = 0; i < TR_KEYS.length; i++) S[TR_KEYS[i]] = Tg[TR_KEYS[i]];
    // the walk: blended in by weight
    const walking = p.phase === 2;
    p.walk.w = U.damp(p.walk.w, walking ? 1 : 0, walking ? 9 : 7, dt);
    const O = p.O;
    if (p.walk.w > 0.01) {
      for (let i = 0; i < CH.length; i++) O[CH[i]] = S[CH[i]];
      walkPose(p, O, dt);
      const w = p.walk.w;
      for (let i = 0; i < CH.length; i++) { const c = CH[i]; O[c] = lerp(S[c], O[c], w); }
    } else for (let i = 0; i < CH.length; i++) O[CH[i]] = S[CH[i]];
    // face and eyes always from the damped state, mouth fast
    O.lid = p.lidv;
    applyBones(p, O);
    // page turns while reading
    if (p.state === "read") {
      p.pageT -= dt;
      if (p.pageT <= 0) { p.page = 0.0001; p.pageT = 8 + p.rnd() * 7; }
      if (p.page > 0) { p.page += dt / 0.7; if (p.page >= 1) p.page = 0; }
    } else p.page = 0;
    // sleeping: turn over now and then
    blanketFor(p, post === "lie" && p.state === "sleep");
    if (p.state === "sleep") { p.rollT -= dt; if (p.rollT <= 0) { p.rollT = 40 + p.rnd() * 50; const r = p.rnd(); p.sleepRoll = r < 0.4 ? 0 : r < 0.7 ? 1 : -1; } }
    else p.sleepRoll = 0;
    p.snap = false;
    // the proxy follows the posture
    const pr = p.proxy;
    if (post === "lie") { pr.rotation.set(PI / 2, 0, 0); pr.position.set(0, p.seat - 0.05, -p.J.h * 0.45); }
    else if (post === "sit") { pr.rotation.set(0, 0, 0); pr.position.set(0, 0, 0.1); pr.scale.y = p.J.h * 0.8; }
    else { pr.rotation.set(0, 0, 0); pr.position.set(0, 0, 0); pr.scale.y = p.J.h; }
  }

  // ---- the DOM overlay: tags, bubbles, thought clouds
  const CSS = `
.cp-p-tag,.cp-p-bubble,.cp-p-thought{position:absolute;left:0;top:0;will-change:transform;contain:layout style}
.cp-p-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 8px 2px 6px;border-radius:999px;background:var(--sheet);color:var(--ink);font:600 .74rem/1.3 var(--font-head);box-shadow:0 2px 8px rgba(0,0,0,.22);white-space:nowrap;border:1px solid var(--who,var(--rule));z-index:1;transition:opacity .3s,box-shadow .2s}
.cp-p-dot{width:8px;height:8px;border-radius:50%;background:var(--who,var(--ink-2));flex:none}
.cp-p-act{color:var(--muted);font-weight:400}
.cp-p-act:empty,.cp-p-grades:empty{display:none}
.cp-p-grades em{font-style:normal;font-family:var(--font-hand);font-weight:700;color:var(--pen);font-size:1.05rem;line-height:1;margin-left:4px}
.cp-p-tag.cp-p-speaking{box-shadow:0 0 0 2px var(--who),0 2px 8px rgba(0,0,0,.22)}
.cp-p-tag.cp-p-followed{box-shadow:0 0 0 2px var(--who),0 0 14px var(--who)}
.cp-p-compact .cp-p-tag{font-size:.66rem;padding:1px 6px 1px 5px;gap:4px}
.cp-p-tag.cp-p-mini{padding:2px;gap:0;pointer-events:auto;cursor:pointer}
.cp-p-mini .cp-p-name,.cp-p-mini .cp-p-act,.cp-p-mini .cp-p-grades,.cp-p-mini .cp-p-lead{display:none}
.cp-p-mini .cp-p-dot{width:10px;height:10px}
.cp-p-lead{position:absolute;left:50%;top:100%;width:1px;margin-left:-.5px;background:var(--who,var(--ink-2));opacity:.75;transform-origin:50% 0;pointer-events:none}
.cp-p-bubble[data-tail=t]::after{top:-8px;bottom:auto;transform:translateX(-50%) rotate(225deg)}
.cp-p-bubble[data-tail=l]::after{left:0;top:var(--tail,50%);bottom:auto;transform:translate(-50%,-50%) rotate(135deg)}
.cp-p-bubble[data-tail=r]::after{left:100%;top:var(--tail,50%);bottom:auto;transform:translate(-50%,-50%) rotate(-45deg)}
.cp-p-compact .cp-p-act{display:none}
.cp-p-compact .cp-p-grades em{font-size:.92rem;margin-left:2px}
.cp-p-bubble{max-width:min(310px,76%);padding:7px 11px 8px;border-radius:12px;background:var(--sheet);color:var(--ink);border:2px solid var(--who,var(--rule));box-shadow:0 6px 18px rgba(0,0,0,.25);font:13px/1.42 var(--font-read);z-index:3;overflow-wrap:anywhere}
.cp-p-bubble::after{content:"";position:absolute;left:var(--tail,50%);bottom:-8px;width:12px;height:12px;background:var(--sheet);border-right:2px solid var(--who,var(--rule));border-bottom:2px solid var(--who,var(--rule));transform:translateX(-50%) rotate(45deg)}
.cp-p-bubble b{display:block;font:600 .66rem/1.2 var(--font-head);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.cp-p-chip{display:inline-block;font:600 .6rem/1.35 var(--font-head);letter-spacing:.04em;color:var(--ink-2);border:1px solid var(--rule);background:var(--wash);border-radius:999px;padding:0 7px;margin:0 0 3px;font-style:normal}
.cp-p-bubble[data-kind=claude]{border-style:dashed}
.cp-p-compact .cp-p-bubble{font-size:12px;padding:6px 9px 7px}
.cp-p-thought{max-width:min(250px,66%);padding:6px 11px 7px;border-radius:18px;background:var(--sheet);color:var(--ink-2);border:1.5px dashed var(--who,var(--rule));box-shadow:0 4px 14px rgba(0,0,0,.18);font:italic 12.5px/1.4 var(--font-read);z-index:2;overflow-wrap:anywhere}
.cp-p-thought b{display:block;font:600 .62rem/1.2 var(--font-head);font-style:normal;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.cp-p-thought b span{text-transform:none;letter-spacing:0;font-weight:400}
.cp-p-thought i{position:absolute;border-radius:50%;background:var(--sheet);border:1.5px dashed var(--who,var(--rule))}
.cp-p-compact .cp-p-thought{font-size:11.5px}
.cp-p-off{display:none!important}`;
  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function makeOverlay() {
    overlayEl = ctx.overlay;
    if (!document.getElementById("cp-style-people")) { const st = el("style"); st.id = "cp-style-people"; st.textContent = CSS; document.head.appendChild(st); }
    if (!overlayEl) return;
    overlayEl.classList.add("cp-p-overlay");
    for (const k of KEYS) {
      const p = PP[k];
      const tag = el("div", "cp-p-tag k-" + k, overlayEl);
      el("i", "cp-p-dot", tag);
      el("span", "cp-p-name", tag).textContent = C.NAMES[k];
      const act = el("span", "cp-p-act", tag), gr = el("span", "cp-p-grades", tag);
      tag.title = C.NAMES[k];
      p.tagEl = { el: tag, act, gr, w: 0, h: 0, x: -1e4, y: -1e4, op: -1, vis: true, cls: "", mini: false, peek: 0, lead: null, leadKey: "" };
      tag.addEventListener("click", () => { p.tagEl.peek = performance.now() + 3000; });
    }
    motore = { key: "motore", bubble: null };
  }
  function bubbleEl(key, kind) {
    const b = el("div", "cp-p-bubble k-" + key + " cp-p-off", overlayEl);
    const head = el("b", null, b), chip = el("i", "cp-p-chip", b), span = el("span", null, b);
    b.dataset.kind = kind || "";
    return { el: b, head, chip, span };
  }
  function say(key, line) {
    if (!line || typeof line.text !== "string") return 0;
    const p = key === "motore" ? motore : PP[key];
    if (!p || !overlayEl) return 0;
    if (p.bubble) endBubble(p, true);
    const id = ++bubSeq, text = String(line.text);
    const chars = Array.from(text), kind = ["ufficiale", "chiacchiera", "pensiero", "claude"].includes(line.kind) ? line.kind : null;
    const ms = U.isNum(line.ms) && line.ms > 0 ? line.ms : U.sayMs(text);
    const rm = ctx && ctx.reduceMotion;
    const cps = max(U.isNum(line.cps) && line.cps > 0 ? line.cps : 42, chars.length / max(0.3, (ms / 1000) * 0.85));
    const d = bubbleEl(key, kind);
    d.head.textContent = (C.NAMES[key] || key) + (line.label ? " · " + line.label : "");
    if (kind && kind !== "ufficiale") d.chip.textContent = C.KINDS[kind] || kind; else d.chip.remove();
    d.span.textContent = rm ? text : "";
    p.bubble = { id, chars, n: rm ? chars.length : 0, t0: performance.now(), ms, cps, kind, prio: kind === "ufficiale" || kind === "claude" ? 2 : 1, d, typing: true, openness: 0, rm, x: -1e4, y: -1e4, w: 0, h: 0, dirty: true, to: line.to || null };
    if (line.to && PP[key] && (PP[line.to] || line.to === "motore")) PP[key].look = line.to;
    return id;
  }
  function endBubble(p, replaced) {
    const b = p.bubble;
    if (!b) return;
    p.bubble = null;
    b.d.el.remove();
    if (p.tagEl) p.tagEl.el.classList.remove("cp-p-speaking");
    bus.emit("people:said", { key: p.key, id: b.id });
  }
  function hush(key) { const p = key === "motore" ? motore : PP[key]; if (p && p.bubble) endBubble(p); }
  function think(key, th) {
    const p = PP[key];
    if (!p || !th || typeof th.text !== "string" || !overlayEl) return 0;
    unthink(key);
    const id = ++bubSeq, e = el("div", "cp-p-thought k-" + key + " cp-p-off", overlayEl);
    const head = el("b", null, e); head.textContent = "pensa";
    if (th.source) { const s = el("span", null, head); s.textContent = " · " + String(th.source); }
    el("span", null, e).textContent = String(th.text);
    for (let i = 0; i < 3; i++) el("i", null, e);
    p.cloud = { id, e, t0: performance.now(), ms: U.isNum(th.ms) && th.ms > 0 ? th.ms : U.sayMs(th.text) + 1500, x: -1e4, y: -1e4, w: 0, h: 0, dirty: true };
    return id;
  }
  function unthink(key) { const p = PP[key]; if (p && p.cloud) { p.cloud.e.remove(); p.cloud = null; } }
  // typewriter and timers, by real time: hidden bubbles still count and still end
  const VOW = /[aeoàèéòóAEOÀÈÉÒ]/, HALF = /[iuìùíúIUÌÙ]/, LET = /[\p{L}\p{N}]/u;
  function tickBubbles() {
    const now = performance.now();
    for (const p of [...KEYS.map((k) => PP[k]), motore]) {
      if (!p) continue;
      const b = p.bubble;
      if (b) {
        const el = (now - b.t0) / 1000;
        if (b.typing) {
          const n = b.rm ? b.chars.length : min(b.chars.length, Math.ceil(el * b.cps));
          if (n !== b.n || b.dirty) { b.n = n; if (!b.rm) b.d.span.textContent = b.chars.slice(0, n).join(""); b.dirty = true; }
          // the virtual typing clock drives the mouth even with reduced motion
          // (the characters of the last 60 ms, so slow frames still catch the vowels)
          const vn = min(b.chars.length, Math.ceil(el * b.cps));
          let op = 0;
          for (let i = max(0, Math.ceil((el - 0.06) * b.cps) - 1); i < vn; i++) { const ch = b.chars[i]; op = max(op, VOW.test(ch) ? 1 : HALF.test(ch) ? 0.5 : LET.test(ch) ? 0.25 : 0); }
          b.openness = vn >= b.chars.length ? 0 : op;
          if (vn >= b.chars.length) b.typing = false;
        }
        if (el * 1000 >= b.ms) endBubble(p);
      }
      const c = p.cloud;
      if (c && now - c.t0 >= c.ms) unthink(p.key);
    }
  }

  // projection and placement
  function project(x, y, z, camera, w, h, out) {
    V2.set(x, y, z).project(camera);
    out.x = ((V2.x + 1) / 2) * w; out.y = ((1 - V2.y) / 2) * h; out.ok = V2.z < 1 && V2.z > -1 && abs(V2.x) < 1.15 && abs(V2.y) < 1.2;
    return out;
  }
  const setT = (o, e, x, y) => { if (abs(o.x - x) > 0.5 || abs(o.y - y) > 0.5) { o.x = x; o.y = y; e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; } };
  const show = (o, e, on) => { if (o.vis !== on) { o.vis = on; e.classList.toggle("cp-p-off", !on); if (on) o.dirty = true; } };
  const PT = { x: 0, y: 0, ok: false };
  // the HUD's glass boxes (clock, camera switch, minimap, replay bar, mind card) in overlay pixels,
  // read twice a second: tags and bubbles keep out of them
  let HUD = [], hudAt = -1e9;
  function hudBoxes() {
    const now = performance.now();
    if (now - hudAt < 500) return HUD;
    hudAt = now; HUD = [];
    const st = (ctx && ctx.stage) || overlayEl.parentElement;
    if (!st) return HUD;
    const o = overlayEl.getBoundingClientRect();
    for (const e of st.querySelectorAll(".cp-u-glass")) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) HUD.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
    }
    return HUD;
  }
  const INDOOR = ["interno", "dormitorio"];
  // at eye level inside a room, the people of other rooms are behind walls: their tags stay hidden
  function eyeRoom() {
    const w = C.world;
    if (!w || !w.roomAt || V3.y >= 3.3) return null;
    const id = w.roomAt(V3.x, V3.z), r = id && arr(w.rooms).find((x) => x.id === id);
    return r && INDOOR.includes(r.kind) ? id : null;
  }
  const arr = (v) => (Array.isArray(v) ? v : []);
  const overlap = (a, x, y, bw, bh, pad) => a.some((r) => x < r.x + r.w + pad && x + bw + pad > r.x && y < r.y + r.h + pad && y + bh + pad > r.y);
  const LEAD_PX = 24, MINI = 16;
  function updateOverlay(camera, w, h) {
    if (!P.ready || !overlayEl || !camera) return;
    tickBubbles();
    const compact = w < 600;
    if (overlayEl.classList.contains("cp-p-compact") !== compact) { overlayEl.classList.toggle("cp-p-compact", compact); for (const k of KEYS) { PP[k].tagEl.w = 0; renderGrades(PP[k]); } }
    camera.getWorldPosition(V3);
    const hud = hudBoxes(), room = eyeRoom(), now = performance.now(), list = [];
    for (const k of KEYS) {
      const p = PP[k], te = p.tagEl;
      const dist = hyp(p.top.x - V3.x, p.top.y - V3.y, p.top.z - V3.z);
      const elsewhere = room && k !== followed && C.world.roomAt(p.top.x, p.top.z) !== room;
      project(p.top.x, p.top.y + 0.1, p.top.z, camera, w, h, PT);
      const keep = k === followed || !!p.bubble;
      const vis = PT.ok && !elsewhere && (dist <= 60 || keep);
      if (!vis) { show(te, te.el, false); continue; }
      const x = PT.x, y = PT.y;
      project(p.top.x, p.top.y - 0.32, p.top.z, camera, w, h, PT);
      list.push({ p, x, y, cy: max(y + 8, PT.y), dist });
    }
    // the bubbles first chosen (at most 3): the followed agent, then priority ≥ 2, then the newest
    const anchors = {};
    for (const it of list) anchors[it.p.key] = it;
    const cands = [];
    for (const k of KEYS) if (PP[k].bubble) cands.push(PP[k]);
    if (motore.bubble) cands.push(motore);
    cands.sort((a, b) => ((b.key === followed) - (a.key === followed)) || (b.bubble.prio - a.bubble.prio) || (b.bubble.t0 - a.bubble.t0));
    const talking = new Set(), heard = new Set();
    for (const p of cands) if (talking.size < 3 && (p === motore || anchors[p.key])) { talking.add(p.key); if (p.bubble.to) heard.add(p.bubble.to); }
    // tags: nearest first; a tag that collides moves sideways, then up; when 4 or more crowd, the minor ones
    // become a coloured dot at the head (the name on hover or tap); a moved tag keeps a thin leader line
    list.sort((a, b) => b.y - a.y);
    const placed = [], crowd = list.length >= 4;
    for (const it of list) {
      const p = it.p, te = p.tagEl, k = p.key;
      // the speaker's name is in the bubble's header: the tag steps aside, unless it carries the grades
      if (talking.has(k) && !p.grades) { show(te, te.el, false); it.ax = it.x; it.ay = it.y - 4; continue; }
      show(te, te.el, true);
      const op = (it.dist < 18 ? 1 : it.dist < 40 ? lerp(1, 0.35, (it.dist - 18) / 22) : 0.35) * p.fade;
      if (abs(te.op - op) > 0.02) { te.op = op; te.el.style.opacity = op.toFixed(2); }
      const cls = (p.bubble ? " cp-p-speaking" : "") + (k === followed ? " cp-p-followed" : "");
      if (cls !== te.cls) { te.cls = cls; te.el.classList.toggle("cp-p-speaking", !!p.bubble); te.el.classList.toggle("cp-p-followed", k === followed); }
      if (!te.w) { if (te.mini) te.el.classList.remove("cp-p-mini"); te.w = te.el.offsetWidth; te.h = te.el.offsetHeight; if (te.mini) te.el.classList.add("cp-p-mini"); }
      const major = k === followed || talking.has(k) || heard.has(k) || !!p.grades || te.peek > now;
      const nx = clamp(it.x - te.w / 2, 2, max(2, w - te.w - 2)), ny = it.y - te.h - 4;
      const free = (x, y) => y >= 2 && !overlap(placed, x, y, te.w, te.h, 2) && !overlap(hud, x, y, te.w, te.h, 2);
      let spot = null;
      const levels = major ? 6 : crowd ? 1 : 3;
      for (let L = 0; L <= levels && !spot; L++) for (const dx of [0, -0.55, 0.55]) {
        const x = clamp(nx + dx * te.w, 2, max(2, w - te.w - 2)), y = ny - L * (te.h + 3);
        if (free(x, y)) { spot = [x, y]; break; }
      }
      if (!spot && !major) {
        // a dot at the head; under the HUD it hides
        const mx = it.x - MINI / 2, my = it.y - MINI - 2;
        if (overlap(hud, mx, my, MINI, MINI, 0)) { show(te, te.el, false); continue; }
        if (!te.mini) { te.el.classList.add("cp-p-mini"); te.mini = true; }
        placed.push({ x: mx, y: my, w: MINI, h: MINI });
        setT(te, te.el, mx, my); lead(te, 0);
        it.ax = it.x; it.ay = my;
        continue;
      }
      const [x, y] = spot || [nx, ny];
      if (te.mini) { te.el.classList.remove("cp-p-mini"); te.mini = false; }
      placed.push({ x, y, w: te.w, h: te.h });
      setT(te, te.el, x, y);
      // the leader: from the tag's bottom centre down to the head
      const dx = it.x - (x + te.w / 2), dy = it.y - (y + te.h);
      lead(te, hyp(dx, dy) > LEAD_PX ? [dx, dy] : 0);
      it.ax = x + te.w / 2; it.ay = y;
    }
    // bubbles: never on the HUD, the tags, the speaker's own head or the head it talks to
    const boxes = hud.concat(placed);
    for (const k of talking) {
      for (const kk of [k, PP[k] && PP[k].bubble && PP[k].bubble.to]) {
        const a = kk && anchors[kk];
        if (a) { const hw = max(18, (a.cy - a.y) * 0.75); boxes.push({ x: a.x - hw, y: a.y - 4, w: hw * 2, h: a.cy - a.y + 10, head: kk === k }); }
      }
    }
    for (const p of cands) {
      const b = p.bubble, d = b.d;
      if (!talking.has(p.key)) { show(b, d.el, false); continue; }
      let a;
      if (p === motore) { const sp = motorePoint(); project(sp.x, sp.y + 0.25, sp.z, camera, w, h, PT); if (!PT.ok) { show(b, d.el, false); continue; } a = { ax: PT.x, ay: PT.y - 6, x: PT.x, y: PT.y, cy: PT.y + 30 }; }
      else a = anchors[p.key];
      show(b, d.el, true);
      if (b.dirty || !b.w) { b.w = d.el.offsetWidth; b.h = d.el.offsetHeight; b.dirty = false; }
      const [bx, by, side] = bubbleSpot(boxes, a, b.w, b.h, w, h);
      boxes.push({ x: bx, y: by, w: b.w, h: b.h });
      setT(b, d.el, bx, by);
      if (b.side !== side) { b.side = side; if (side) d.el.dataset.tail = side; else delete d.el.dataset.tail; }
      const tail = side === "l" || side === "r" ? clamp((a.y + a.cy) / 2 - by, 14, max(14, b.h - 14)) : clamp(a.ax - bx, 16, max(16, b.w - 16));
      if (abs((b.tail || 0) - tail) > 0.5) { b.tail = tail; d.el.style.setProperty("--tail", tail.toFixed(1) + "px"); }
    }
    // thought clouds: at most 2 — the followed agent first, then the newest
    const clouds = KEYS.map((k) => PP[k]).filter((p) => p.cloud).sort((a, b) => ((b.key === followed) - (a.key === followed)) || (b.cloud.t0 - a.cloud.t0));
    let nc = 0;
    for (const p of clouds) {
      const c = p.cloud, a = anchors[p.key];
      if (!a || a.ay === undefined || nc >= 2) { show(c, c.e, false); continue; }
      show(c, c.e, true); nc++;
      if (c.dirty || !c.w) { c.w = c.e.offsetWidth; c.h = c.e.offsetHeight; c.dirty = false; const is = c.e.querySelectorAll("i"); [[10, 0], [7, 1], [5, 2]].forEach(([sz, i]) => { Object.assign(is[i].style, { width: sz + "px", height: sz + "px" }); }); }
      const sp = freeSpot(boxes, a.ax + c.w * 0.2, a.ay - 26, c.w, c.h, w, h);
      if (!sp) { show(c, c.e, false); nc--; continue; } // no room left: the cloud waits, it never covers a bubble
      const [cx, cy] = sp;
      boxes.push({ x: cx, y: cy, w: c.w, h: c.h });
      setT(c, c.e, cx, cy);
      // the tail: three small circles from the cloud towards the head, never longer than ~30 px
      const is = c.e.querySelectorAll("i"), sx0 = clamp(a.ax - cx, 12, c.w - 12), dx = a.ax - cx - sx0, dy = a.ay - cy - c.h, dl = hyp(dx, dy) || 1, k = min(1, 30 / dl);
      [[0.25, 10], [0.6, 7], [0.95, 5]].forEach(([f, sz], i) => { is[i].style.left = (sx0 + dx * k * f - sz / 2).toFixed(1) + "px"; is[i].style.top = (c.h + 3 + max(0, dy) * k * f - sz / 2).toFixed(1) + "px"; is[i].style.display = dy < -4 ? "none" : ""; });
    }
  }
  // a tag's leader line: 0 hides it, [dx, dy] runs from the tag's bottom centre to the head
  function lead(te, v) {
    const key = v ? v[0].toFixed(0) + "," + v[1].toFixed(0) : "";
    if (te.leadKey === key) return;
    te.leadKey = key;
    if (!v) { if (te.lead) te.lead.style.display = "none"; return; }
    if (!te.lead) te.lead = el("i", "cp-p-lead", te.el);
    const L = hyp(v[0], v[1]), ang = Math.atan2(-v[0], v[1]);
    Object.assign(te.lead.style, { display: "", height: L.toFixed(1) + "px", transform: `rotate(${ang.toFixed(3)}rad)` });
  }
  // a speech bubble's place: above the anchor (centred, then sideways, then higher), else beside the
  // head at its height, else below the chin; when all collide, the place that covers least, and never
  // the speaker's own face. Returns [x, y, tail side: "" below the bubble, "t" above, "l"/"r" beside]
  function bubbleSpot(boxes, a, bw, bh, w, h) {
    const T0 = 6, cx = (x) => clamp(x, 6, max(6, w - bw - 6)), hw = max(18, (a.cy - a.y) * 0.75), mid = (a.y + a.cy) / 2;
    const C2 = [];
    for (const dy of [0, 1, 2]) for (const dx of [0, -0.6, 0.6, -1.2, 1.2]) C2.push([cx(a.ax - bw / 2 + dx * bw), a.ay - 10 - bh - dy * (bh * 0.6 + 8), ""]);
    C2.push([a.x + hw + 22, mid - bh / 2, "l"], [a.x - hw - 22 - bw, mid - bh / 2, "r"]);
    for (const dx of [0, -0.6, 0.6]) C2.push([cx(a.x - bw / 2 + dx * bw), a.cy + 14, "t"]);
    let best = null, bestCost = Infinity;
    for (const [x, y, side] of C2) {
      if (y < T0 || y + bh > h - 6 || x < 2 || x + bw > w - 2) continue;
      let cost = 0;
      for (const r of boxes) {
        const ox = min(x + bw + 4, r.x + r.w) - max(x - 4, r.x), oy = min(y + bh + 4, r.y + r.h) - max(y - 4, r.y);
        if (ox > 0 && oy > 0) cost += ox * oy * (r.head ? 12 : 1);
      }
      if (!cost) return [x, y, side];
      if (cost < bestCost) { bestCost = cost; best = [x, y, side]; }
    }
    return best || [cx(a.ax - bw / 2), clamp(a.ay - 10 - bh, T0, max(T0, h - bh - 6)), ""];
  }
  // the first free place for a thought cloud above an anchor: centred, then sideways, then higher, then
  // below the head, or null
  function freeSpot(boxes, ax, ay, bw, bh, w, h) {
    const hit = (x, y) => boxes.some((r) => x < r.x + r.w + 4 && x + bw + 4 > r.x && y < r.y + r.h + 4 && y + bh + 4 > r.y), T0 = 6;
    for (const dy of [0, 1, 2, -1, -2]) for (const dx of [0, -0.6, 0.6, -1.2, 1.2]) {
      const x = clamp(ax - bw / 2 + dx * bw, 6, max(6, w - bw - 6)), y = dy >= 0 ? ay - bh - dy * (bh * 0.6 + 8) : ay + 70 + (-dy - 1) * (bh + 8);
      if (y >= T0 && y + bh <= h - 6 && !hit(x, y)) return [x, y];
    }
    return null;
  }
  function renderGrades(p) {
    const gr = p.tagEl && p.tagEl.gr;
    if (!gr) return;
    gr.textContent = "";
    const v = p.grades;
    if (!v) return;
    const compact = overlayEl && overlayEl.classList.contains("cp-p-compact");
    const r = U.toNum(v.ragionamento), d = U.toNum(v.disciplina);
    if (compact) { if (U.isNum(r) || U.isNum(d)) { const e = el("em", null, gr); e.textContent = (U.isNum(r) ? r : "?") + "·" + (U.isNum(d) ? d : "?"); } }
    else for (const [n, val] of [["ragionamento", r], ["disciplina", d]]) if (U.isNum(val)) { const e = el("em", null, gr); e.title = n; e.textContent = n[0].toUpperCase() + " " + val; }
    p.tagEl.w = 0;
  }

  // ---- the public API
  const P = {
    ready: false,
    init(c) {
      ctx = c; T = c.THREE || window.THREE;
      if (!T || !c.scene) throw new Error("people: no THREE scene");
      V1 = _v(); V2 = _v(); V3 = _v(); Q1 = new T.Quaternion(); E1 = new T.Euler(); M1 = M4();
      RIM.value = new T.Color(0.06, 0.06, 0.07); SSS.value = new T.Color(0.05, 0.014, 0.008);
      detail = C.render && LV[C.render.quality] != null ? C.render.quality : "medium";
      MAT = material();
      PROXY = Cyl(0.3, 0.3, 1, 8).translate(0, 0.5, 0);
      for (const k of KEYS) {
        const p = (PP[k] = makePerson(k));
        p.bones.forEach((b) => (b.userData.b0 = [b.position.x, b.position.y, b.position.z]));
        c.scene.add(p.root);
        const g = goalOf("dorm_" + k + ".spot") || { x: -21 + 6 * KEYS.indexOf(k), z: 16, face: 0, posture: "stand", ax: 0, az: 0, anchor: null, states: ["idle"] };
        placeAt(p, g, "idle");
      }
      // contact shadows (one instanced draw call) and the follow ring
      const bm = new T.ShaderMaterial({
        uniforms: { uO: { value: 0.3 } }, transparent: true, depthWrite: false,
        vertexShader: "varying vec2 vUv;void main(){vUv=uv;vec4 p=vec4(position,1.0);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\ngl_Position=projectionMatrix*modelViewMatrix*p;}",
        fragmentShader: "varying vec2 vUv;uniform float uO;void main(){float d=length(vUv-0.5)*2.0;gl_FragColor=vec4(0.0,0.0,0.0,(1.0-smoothstep(0.15,1.0,d))*uO);}",
      });
      BLOBS = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-PI / 2), bm, KEYS.length);
      BLOBS.frustumCulled = false; BLOBS.renderOrder = 1; BLOBS.name = "people.blobs";
      c.scene.add(BLOBS);
      RING = new T.Mesh(new T.RingGeometry(0.42, 0.56, 40).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
      RING.visible = false; RING.renderOrder = 2; RING.name = "people.ring";
      c.scene.add(RING);
      makeOverlay();
      setDetail(detail, true);
      // bubbles and clouds keep their time even when the frame loop is not running
      setInterval(() => { try { if (performance.now() - lastUpd > 300) { flush(); tickBubbles(); } } catch (e) { /* ignore */ } }, 250);
      bus.on("campus:visibility", (v) => { if (v && v.visible) for (const k of KEYS) PP[k].snap = true; });
      P.ready = true;
    },
    update(dt, t) {
      if (!P.ready) return;
      lastUpd = performance.now();
      dt = clamp(dt || 0, 0, 0.1);
      clk += dt;
      flush();
      const cam = ctx.camera;
      if (cam) cam.getWorldPosition(V3);
      const lvl = LV[detail], far = lvl === 0 ? 25 : lvl === 1 ? 30 : 1e9, rate = lvl === 0 ? 1 / 15 : 1 / 30;
      for (const k of KEYS) {
        const p = PP[k];
        locomote(p, dt);
        p.acc += dt;
        const d = cam ? hyp(p.x - V3.x, p.top.y - V3.y, p.z - V3.z) : 0;
        if (d > far && p.acc < rate && !p.snap) continue;
        animate(p, clk, p.acc);
        p.acc = 0;
        p.root.updateMatrixWorld(true);
        const hb = p.bones[B.head].matrixWorld;
        V2.set(0, p.J.hc - p.J.head + p.J.hb + (p.items.hat ? HAT[k] : 0.012), 0).applyMatrix4(hb);
        p.top.x = V2.x; p.top.y = V2.y; p.top.z = V2.z;
        p.fade = U.damp(p.fade, p.fadeT, 6, dt);
      }
      // contact shadows and the follow ring
      for (let i = 0; i < KEYS.length; i++) {
        const p = PP[KEYS[i]], lie = postureNow(p) === "lie", bs = (lie ? 0.0001 : postureNow(p) === "sit" ? 0.9 : 0.75) * p.J.k;
        M1.compose(V2.set(p.x + sin(p.yaw) * (postureNow(p) === "sit" ? 0.18 : 0), 0.012, p.z + cos(p.yaw) * (postureNow(p) === "sit" ? 0.18 : 0)), Q1.identity(), V1.set(bs, 1, bs * 1.1));
        BLOBS.setMatrixAt(i, M1);
      }
      BLOBS.instanceMatrix.needsUpdate = true;
      BLOBS.material.uniforms.uO.value = detail === "low" ? 0.42 : 0.26;
      if (followed && PP[followed]) {
        const p = PP[followed];
        RING.visible = true; RING.position.set(p.x, 0.02, p.z);
        RING.material.opacity = 0.45 + (ctx.reduceMotion ? 0 : 0.15 * sin(clk * 3));
      } else RING.visible = false;
      // a soft rim light, cooler and stronger at night
      const night = C.render && C.render.sky ? U.toNum(C.render.sky.night) || 0 : 0;
      RIM.value.setRGB(lerp(0.05, 0.05, night), lerp(0.05, 0.075, night), lerp(0.055, 0.13, night));
      SSS.value.setRGB(lerp(0.06, 0.012, night), lerp(0.016, 0.004, night), lerp(0.008, 0.003, night));
      tickBubbles();
    },
    updateOverlay(camera, w, h) { try { updateOverlay(camera, w, h); } catch (e) { console.warn("people overlay", e); } },
    setDetail(level) { setDetail(level); },
    positionOf(key) { const p = PP[key]; return p ? { x: p.x, y: 0, z: p.z } : null; },
    headOf(key) { const p = PP[key]; return p ? { x: p.top.x, y: p.top.y, z: p.top.z } : null; },
    yawOf(key) { const p = PP[key]; return p ? U.wrapAngle(postureNow(p) === "lie" ? p.yaw - PI : p.yaw) : null; },
    stateOf(key) { const p = PP[key]; return p ? (p.phase ? "walk" : p.state) : null; },
    postureOf(key) { const p = PP[key]; return p ? (p.phase === 2 ? "stand" : postureNow(p)) : null; },
    isBusy(key) { const p = PP[key]; return !!(p && (p.phase || p.tr)); },
    anchorOf(key) { const p = PP[key]; return p && !p.phase ? p.at || null : null; },
    pickables() { return KEYS.filter((k) => PP[k]).map((k) => PP[k].proxy); },
    command,
    place(key, where, state) {
      const p = PP[key]; if (!p) return;
      const g = goalOf(where); if (!g) return;
      if (g.face == null) g.face = p.yaw;
      p.cmd = null;
      placeAt(p, g, state);
    },
    stop(key) { const p = PP[key]; if (!p) return; halt(p); p.state = mapState(p.posture, "idle"); },
    setState(key, st) { const p = PP[key]; if (p && typeof st === "string" && st !== "walk") { if (p.phase) { if (p.cmd) p.cmd.state = st; } else p.state = mapState(p.posture, st); } },
    lookAt(key, target) { const p = PP[key]; if (p) p.look = target == null ? null : target; },
    setMood(key, mood) { const p = PP[key]; if (p && typeof mood === "string") p.mood = mood; },
    setTag(key, tag) {
      const p = PP[key]; if (!p || !tag || !p.tagEl) return;
      if ("act" in tag) { const a = tag.act == null ? "" : String(tag.act); if (p.tagEl.act.textContent !== a) { p.tagEl.act.textContent = a; p.tagEl.w = 0; } }
      if ("grades" in tag) { p.grades = U.obj(tag.grades) ? { ragionamento: tag.grades.ragionamento, disciplina: tag.grades.disciplina } : null; renderGrades(p); }
    },
    say, hush, think, unthink,
    setHighlight(key) {
      followed = key && PP[key] ? key : null;
      if (RING) { RING.material.color.copy(followed ? U.col(C.COLORS[followed]) : new T.Color(0xffffff)); }
    },
    // test hooks
    _info(key) {
      const p = PP[key]; if (!p) return null;
      p.root.updateMatrixWorld(true);
      const hp = new T.Vector3().setFromMatrixPosition(p.bones[B.hips].matrixWorld);
      return { x: p.x, z: p.z, yaw: p.yaw, posture: p.posture, state: p.state, phase: p.phase, pelvisY: hp.y, pelvisSeatY: hp.y - 0.05 * p.J.h * p.J.k, seat: p.seat * p.J.k, lid: p.lidv, lidPeak: p.lidPeak || 0, mouthPeak: p.mouthPeak || 0, blinks: p.blinks || 0, mouth: p.mouth, tris: p.mesh.geometry.index.count / 3, bubble: !!p.bubble, cloud: !!p.cloud, items: { ...p.items } };
    },
    _people: () => PP,
    _clock: () => clk,
  };
  const HAT = { preside: 0.075, falco: 0.03, tartaruga: 0.012, spazzino: 0.03, ragioniere: 0.03, guardiano: 0.085, cronista: 0.1, scettico: 0.012 };
  function flush() { while (pending.length) { const [n, pl] = pending.shift(); bus.emit(n, pl); } }
  function setDetail(level, force) {
    if (LV[level] == null || (!force && level === detail)) return;
    detail = level;
    DET.value = level === "low" ? 0 : 1;
    if (!MAT) return;
    for (const k of KEYS) {
      const p = PP[k]; if (!p) continue;
      if (!force || p.mesh.userData.lvl !== LV[level]) {
        const old = p.mesh.geometry;
        p.mesh.geometry = buildGeo(k, LV[level]);
        fixBounds(p.mesh, p.J);
        if (old && old !== p.mesh.geometry) old.dispose();
        p.mesh.userData.lvl = LV[level];
      }
      p.mesh.castShadow = true;
      p.snap = true;
    }
  }
  C.people = P;
})();
