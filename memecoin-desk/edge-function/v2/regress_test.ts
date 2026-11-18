// Regression test: original vs new logic.ts evaluate() on real tokens + random fuzz.
// Usage: deno run --allow-read regress.ts <orig_logic> <new_logic> <strategies.json> <real_tokens.json>
const [origPath, newPath, stratPath, realPath] = Deno.args;
const O = await import(new URL(origPath, `file://${Deno.cwd()}/`).href);
const N = await import(new URL(newPath, `file://${Deno.cwd()}/`).href);

const existing = JSON.parse(await Deno.readTextFile(stratPath)).map((s: any) => ({ id: s.id, params: s.params }));
const filtroParams = {
  costs: { fee_pct_per_side: 0.5, fixed_usd_per_tx: 0.02 },
  exits: { stop_pct: 60, take_profit_pct: 120, max_hold_h: 24 },
  sizing: { pct_of_equity: 2 },
  window: { min_age_min: 60, max_age_h: 72 },
  filter: { min_liq: 5000, gate_lp_min_pct: 50, gate_top10_max_pct: 40, data_sanity: true, min_top10_pct: 15, max_buy_share_pct: 90 },
  analyst: { mode: "argo56", min_score: 65, max_score: 85 },
};
const filtroPiccoli = structuredClone(filtroParams);
filtroPiccoli.window = { min_age_min: 60, max_age_h: 3, max_mcap: 30000 } as any;
const newArms = [{ id: "filtro", params: filtroParams }, { id: "filtro_piccoli", params: filtroPiccoli }];

const real = JSON.parse(await Deno.readTextFile(realPath));
const cases: any[] = [];
for (const r of real) {
  const [price, liq, mcap, vol_h1, buys, sells, chg_m5, chg_h1, age_h, smint, sfreeze, lp, top10, dev, rugged, hasSec] = r;
  const m = { price: price > 0 ? price : null, liq: liq > 0 ? liq : null, mcap: mcap > 0 ? mcap : null, vol_h1, buys_h1: buys, sells_h1: sells, chg_m5, chg_h1, age_h };
  const sec = hasSec ? { mint: smint ?? "na", freeze: sfreeze ?? "na", lp, top10, dev_pct: dev, rugged } : null;
  cases.push({ m, sec, fresh: true, src: "real" });
  cases.push({ m, sec, fresh: false, src: "real-stale" });
}
// fuzz
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr: any[]) => arr[Math.floor(rnd() * arr.length)];
const maybe = (v: any, p = 0.15) => (rnd() < p ? null : v);
for (let i = 0; i < 40000; i++) {
  const buys = maybe(Math.floor(rnd() * 400));
  const sells = maybe(pick([0, 0, 1, 5, Math.floor(rnd() * 400)]));
  const m = rnd() < 0.03 ? null : {
    price: maybe(rnd() * 0.01, 0.05), liq: maybe(rnd() * 200000, 0.05), mcap: maybe(rnd() * 3e6, 0.1),
    vol_h1: maybe(rnd() * 500000), buys_h1: buys, sells_h1: sells,
    chg_m5: maybe(rnd() * 200 - 100), chg_h1: maybe(rnd() * 400 - 100), age_h: maybe(rnd() * 100, 0.05),
  };
  const sec = rnd() < 0.1 ? null : {
    mint: pick(["ok", "ok", "ok", "na", "fail"]), freeze: pick(["ok", "ok", "ok", "na", "fail"]),
    lp: maybe(pick([0, 30, 50, 80, 100, rnd() * 100])), top10: maybe(pick([0, 5, 14.99, 15, 15.01, 30, 40, 41, rnd() * 100])),
    dev_pct: maybe(rnd() * 10), rugged: pick([null, false, false, true]),
  };
  cases.push({ m, sec, fresh: rnd() < 0.9, src: "fuzz" });
}

let diffs = 0;
let compared = 0;
for (const c of cases) {
  for (const S of existing) {
    const a = O.evaluate(S, c.m, c.sec, { secFresh: c.fresh });
    const b = N.evaluate(S, c.m, c.sec, { secFresh: c.fresh });
    compared++;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs++;
      if (diffs <= 5) console.log("DIFF", S.id, JSON.stringify(c), JSON.stringify(a), JSON.stringify(b));
    }
  }
}
console.log(`existing strategies: ${compared} evaluations compared, ${diffs} differences`);

// Same check for the score: new arms with the new keys removed must equal the original code
let d2 = 0;
for (const c of cases) {
  for (const S of newArms) {
    const P = structuredClone(S.params);
    delete P.filter.min_top10_pct; delete P.filter.max_buy_share_pct; delete P.analyst.max_score;
    const a = O.evaluate({ id: S.id, params: P }, c.m, c.sec, { secFresh: c.fresh });
    const b = N.evaluate({ id: S.id, params: P }, c.m, c.sec, { secFresh: c.fresh });
    if (JSON.stringify(a) !== JSON.stringify(b)) d2++;
  }
}
console.log(`new arms without the new keys: ${d2} differences vs original`);

// Distribution of outcomes for the new arms on real (fresh) tokens, and invariants on all cases
for (const S of newArms) {
  const cnt: Record<string, number> = {};
  for (const c of cases.filter((x) => x.src === "real")) {
    const r = N.evaluate(S, c.m, c.sec, { secFresh: true });
    cnt[r.reason_code] = (cnt[r.reason_code] || 0) + 1;
  }
  console.log(S.id, JSON.stringify(cnt));
}
let bad = 0;
const samples: Record<string, string> = {};
for (const c of cases) {
  for (const S of newArms) {
    const r = N.evaluate(S, c.m, c.sec, { secFresh: c.fresh });
    if (r.reason_code === "PASS") {
      const F = S.params.filter, A = S.params.analyst;
      if (c.sec.top10 != null && c.sec.top10 < F.min_top10_pct) bad++;
      const t = (c.m.buys_h1 ?? 0) + (c.m.sells_h1 ?? 0);
      if (c.m.buys_h1 != null && c.m.sells_h1 != null && t > 0 && c.m.buys_h1 / t >= 0.9) bad++;
      if (r.score > A.max_score) bad++;
    }
    if (["TOP10_LOW", "HONEYPOT", "SCORE_HIGH"].includes(r.reason_code)) {
      samples[r.reason_code] ??= `${r.agent} ${r.verdict} final=${r.final} next=${r.next_min} :: ${r.reason}`;
      if (r.final) bad++;
    }
  }
}
console.log(`invariant violations on new arms: ${bad}`);
for (const k of Object.keys(samples)) console.log(k, "->", samples[k]);
// boundary checks
const mm = { price: 1, liq: 10000, mcap: 50000, vol_h1: 20000, buys_h1: 90, sells_h1: 10, chg_m5: 1, chg_h1: 1, age_h: 2 };
const ss = { mint: "ok", freeze: "ok", lp: 100, top10: 15, dev_pct: 1, rugged: false };
console.log("buy share exactly 90% ->", N.evaluate(newArms[0], mm, ss, { secFresh: true }).reason_code);
console.log("buy share 89/100 ->", N.evaluate(newArms[0], { ...mm, buys_h1: 89, sells_h1: 11 }, ss, { secFresh: true }).reason_code);
console.log("top10 exactly 15 ->", N.evaluate(newArms[0], { ...mm, buys_h1: 60, sells_h1: 40 }, ss, { secFresh: true }).reason_code);
console.log("top10 14.99 ->", N.evaluate(newArms[0], { ...mm, buys_h1: 60, sells_h1: 40 }, { ...ss, top10: 14.99 }, { secFresh: true }).reason_code);
console.log("sells 0 (100% buys) ->", N.evaluate(newArms[0], { ...mm, buys_h1: 5, sells_h1: 0 }, ss, { secFresh: true }).reason_code);
console.log("no txs (0/0) ->", N.evaluate(newArms[0], { ...mm, buys_h1: 0, sells_h1: 0 }, ss, { secFresh: true }).reason_code);
