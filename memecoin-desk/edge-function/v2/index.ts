// ARGO//DESK v0 — un tick del desk. PAPER TRADING: nessun wallet, nessun ordine reale.
// Scout -> Filter -> Analyst -> Risk -> Executor finto -> Logger. Chiamata ogni minuto da pg_cron.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as L from "./logic.ts";

const DEX = "https://api.dexscreener.com";
const RUG = "https://api.rugcheck.xyz/v1";
const SEC_TTL_MIN = 30; // dopo quanto la sicurezza va riverificata
const MAX_RUG_PER_TICK = 3; // budget chiamate RugCheck per tick
const DUE_LIMIT = 120; // token rivalutati per tick
const DEAD_AFTER_MISSING = 8; // controlli senza mercato prima di abbandonare un token

function adminKey() {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (k && typeof k === "object") {
      if (k.default) return k.default;
      const first = Object.values(k)[0];
      if (typeof first === "string" && first) return first;
    }
  } catch (_) { /* fallback sotto */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const iso = (ms) => new Date(ms).toISOString();
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const r4 = (x) => (x == null ? null : Number(Number(x).toPrecision(6)));

async function getJson(url, stat, ms = 9000) {
  stat.calls++;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!r.ok) {
      stat.errors++;
      stat.last_error = `HTTP ${r.status}`;
      try { await r.body?.cancel(); } catch (_) { /* niente */ }
      return null;
    }
    return await r.json();
  } catch (e) {
    stat.errors++;
    stat.last_error = String((e && e.message) || e).slice(0, 160);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Provenienza: ogni numero usato in una decisione, con sorgente e orario.
function provenance(m, sec, secAt, nowMs, extra) {
  const d = { at: iso(nowMs) };
  if (m) {
    d.market = {
      src: "dexscreener", pair: m.pair_address, dex: m.dex_id, price: m.price, liq: r4(m.liq), mcap: r4(m.mcap),
      age_h: m.age_h == null ? null : Number(m.age_h.toFixed(2)), vol_h1: r4(m.vol_h1),
      buys_h1: m.buys_h1, sells_h1: m.sells_h1, chg_m5: m.chg_m5, chg_h1: m.chg_h1,
    };
  }
  if (sec) {
    d.sec = {
      src: "rugcheck", at: secAt || null, mint: sec.mint, freeze: sec.freeze, lp: sec.lp,
      top10: sec.top10 == null ? null : Number(sec.top10.toFixed(2)),
      top10_raw: sec.top10_raw == null ? null : Number(sec.top10_raw.toFixed(2)),
      dev_pct: sec.dev_pct == null ? null : Number(sec.dev_pct.toFixed(3)), rugged: sec.rugged,
    };
  }
  return Object.assign(d, extra || {});
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const secret = req.headers.get("x-desk-secret") ?? "";
  if (!secret) return json({ ok: false, reason: "unauthorized" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const begin = await sb.rpc("desk_begin_tick", { p_secret: secret, p_limit: DUE_LIMIT });
  if (begin.error) return json({ ok: false, stage: "begin", error: begin.error.message }, 500);
  const st = begin.data;
  if (!st || !st.ok) return json(st ?? { ok: false }, st && st.reason === "unauthorized" ? 401 : 200);

  const now = Date.now();
  const errors = [];
  const stat = {
    dexscreener: { calls: 0, errors: 0, last_error: null },
    rugcheck: { calls: 0, errors: 0, last_error: null },
  };
  const srcState = Object.fromEntries((st.sources || []).map((s) => [s.id, s]));
  const dexSuspended = srcState.dexscreener && srcState.dexscreener.state === "open";
  const rugSuspended = srcState.rugcheck && srcState.rugcheck.state === "open";

  const strategies = st.strategies || [];
  const stratById = Object.fromEntries(strategies.map((s) => [s.id, s]));
  const positions = st.positions || [];
  const due = st.due || [];

  const payload = {
    new_tokens: [], token_updates: [], verdicts: [], decisions: [],
    marks: [], closes: [], opens: [], sources: [], tick: {},
  };

  try {
    // ── SCOUT: nuovi token Solana da DexScreener ─────────────────────────────
    let scouted = 0;
    if (!dexSuspended) {
      const [profiles, boosts] = await Promise.all([
        getJson(`${DEX}/token-profiles/latest/v1`, stat.dexscreener),
        getJson(`${DEX}/token-boosts/latest/v1`, stat.dexscreener),
      ]);
      const seen = new Set();
      for (const [list, name] of [[profiles, "dexscreener:profiles"], [boosts, "dexscreener:boosts"]]) {
        if (!Array.isArray(list)) continue;
        for (const it of list) {
          if (!it || it.chainId !== "solana" || typeof it.tokenAddress !== "string") continue;
          if (it.tokenAddress.length < 32 || it.tokenAddress.length > 44) continue;
          if (seen.has(it.tokenAddress)) continue;
          seen.add(it.tokenAddress);
          payload.new_tokens.push({ mint: it.tokenAddress, source: name });
        }
      }
      scouted = seen.size;
    } else {
      errors.push("dexscreener sospesa dal circuit breaker");
    }

    // ── Dati di mercato: posizioni aperte (sempre) + token in scadenza ───────
    const mints = [...new Set([...positions.map((p) => p.mint), ...due.map((d) => d.mint)])];
    const market = new Map();
    const fetchedOk = new Set();
    if (!dexSuspended && mints.length) {
      const chunks = chunk(mints, 30);
      const res = await Promise.all(
        chunks.map((c) => getJson(`${DEX}/tokens/v1/solana/${c.join(",")}`, stat.dexscreener)),
      );
      res.forEach((pairs, i) => {
        if (!Array.isArray(pairs)) return;
        for (const mint of chunks[i]) {
          fetchedOk.add(mint);
          const best = L.pickBestPair(pairs, mint);
          if (best) market.set(mint, L.marketFromPair(best, now));
        }
      });
    }

    // ── RISK: posizioni aperte ───────────────────────────────────────────────
    const cash = Object.fromEntries(strategies.map((s) => [s.id, Number(s.cash)]));
    const posValue = Object.fromEntries(strategies.map((s) => [s.id, 0]));
    for (const pos of positions) {
      const S = stratById[pos.strategy_id];
      if (!S) continue;
      if (!fetchedOk.has(pos.mint)) {
        // sorgente non raggiunta: nessuna decisione su dati che non ho
        posValue[S.id] += Number(pos.last_value_usd) || 0;
        continue;
      }
      const m = market.get(pos.mint) || null;
      const { mark, close } = L.checkExit(S.params, pos, m, now);
      payload.marks.push(mark);
      if (close) {
        close.data = provenance(m, null, null, now, { entry_mid: Number(pos.entry_mid), qty: Number(pos.qty) });
        payload.closes.push(close);
        cash[S.id] += close.proceeds_usd;
      } else {
        posValue[S.id] += mark.last_value_usd != null ? mark.last_value_usd : (Number(pos.last_value_usd) || 0);
      }
    }

    // ── Valutazione dei token in scadenza ────────────────────────────────────
    const secFreshFor = (d) => {
      if (!d.sec || !d.sec_at) return false;
      if (d.sec.mint === "fail" || d.sec.freeze === "fail" || d.sec.rugged === true) return true;
      return now - Date.parse(d.sec_at) < SEC_TTL_MIN * 60e3;
    };
    const active = (d) => strategies.filter((S) => !(d.verdicts && d.verdicts[S.id] && d.verdicts[S.id].final));

    const work = []; // {d, m, results:{sid:res}, secNew, secAt}
    for (const d of due) {
      if (!fetchedOk.has(d.mint)) {
        payload.token_updates.push({ mint: d.mint, next_eval_at: iso(now + 2 * 60e3) });
        continue;
      }
      const m = market.get(d.mint) || null;
      const results = {};
      try {
        for (const S of active(d)) results[S.id] = L.evaluate(S, m, d.sec, { secFresh: secFreshFor(d) });
      } catch (e) {
        errors.push(`valutazione ${d.mint.slice(0, 8)}: ${String((e && e.message) || e).slice(0, 120)}`);
        payload.token_updates.push({ mint: d.mint, next_eval_at: iso(now + 30 * 60e3) });
        continue;
      }
      work.push({ d, m, results, secNew: null, secAt: d.sec_at || null });
    }

    // RugCheck solo per chi ha superato finestra e liquidità, entro il budget del tick
    let rugCalls = 0;
    const needSec = work
      .filter((w) => Object.values(w.results).some((r) => r.need_sec))
      .sort((a, b) => ((b.m && b.m.liq) || 0) - ((a.m && a.m.liq) || 0));
    if (!rugSuspended) {
      const batch = needSec.slice(0, MAX_RUG_PER_TICK);
      const reports = await Promise.all(
        batch.map((w) => getJson(`${RUG}/tokens/${w.d.mint}/report`, stat.rugcheck, 12000)),
      );
      rugCalls = batch.length;
      batch.forEach((w, i) => {
        const rep = reports[i];
        if (!rep || typeof rep !== "object" || Array.isArray(rep)) return;
        try {
          const sec = L.normSec(rep, w.m && w.m.pair_address);
          const results = {};
          for (const S of active(w.d)) results[S.id] = L.evaluate(S, w.m, sec, { secFresh: true });
          w.secNew = sec;
          w.secAt = iso(now);
          w.d.sec = sec;
          w.results = results;
        } catch (e) {
          errors.push(`sicurezza ${w.d.mint.slice(0, 8)}: ${String((e && e.message) || e).slice(0, 120)}`);
        }
      });
    }

    // ── Verdetti, log e ordini finti ─────────────────────────────────────────
    let evaluated = 0;
    for (const w of work) {
      evaluated++;
      const { d, m } = w;
      const symbol = (m && m.symbol) || d.symbol || null;
      let nextMin = null;
      let allFinal = true;
      for (const S of strategies) {
        const prev = d.verdicts && d.verdicts[S.id];
        if (prev && prev.final) continue;
        let res = w.results[S.id];
        if (!res) continue;

        if (res.verdict === "PASS") {
          const equity = cash[S.id] + posValue[S.id];
          const buy = L.simBuy(S.params, equity, cash[S.id], m);
          if (buy || !prev || prev.reason_code !== "NO_CASH") {
            payload.decisions.push({
              strategy_id: S.id, mint: d.mint, symbol, agent: "ANALYST", action: "pass", reason_code: "PASS",
              reason: res.reason, data: provenance(m, d.sec, w.secAt, now, { score: res.score, breakdown: res.breakdown }),
            });
          }
          if (!buy) {
            res = Object.assign({}, res, {
              agent: "RISK", verdict: "WAIT", reason_code: "NO_CASH",
              reason: "cassa insufficiente per aprire una posizione", next_min: 5,
            });
          } else {
            const value = L.simSell(S.params, buy.qty, m.price, m.liq).proceeds;
            const stop = L.initialStop(S.params, m.price);
            payload.opens.push({
              strategy_id: S.id, mint: d.mint, symbol, pair_address: m.pair_address,
              entry_mid: m.price, qty: buy.qty, cost_usd: buy.cost_usd, entry_costs_usd: buy.entry_costs_usd,
              entry_liq_usd: m.liq, value_usd: value, stop_price: stop, score: res.score,
              reason: `compra ${symbol || d.mint.slice(0, 6)} per $${buy.cost_usd.toFixed(2)} (${S.params.sizing.pct_of_equity}% del capitale) — ${res.reason}`,
              data: provenance(m, d.sec, w.secAt, now, { score: res.score, equity: r4(equity) }),
            });
            cash[S.id] -= buy.cost_usd;
            posValue[S.id] += value;
            continue; // verdetto BOUGHT scritto dal commit
          }
        }

        if (!res.final) {
          allFinal = false;
          nextMin = nextMin == null ? res.next_min : Math.min(nextMin, res.next_min);
        }
        if (res.reason_code === "SEC_PENDING" && rugSuspended) nextMin = Math.max(nextMin || 0, 5);

        const changed = !prev || prev.reason_code !== res.reason_code || prev.verdict !== res.verdict;
        if (changed) {
          payload.verdicts.push({
            strategy_id: S.id, mint: d.mint, verdict: res.verdict, reason_code: res.reason_code,
            reason: res.reason, score: res.score, final: res.final,
          });
          payload.decisions.push({
            strategy_id: S.id, mint: d.mint, symbol, agent: res.agent,
            action: L.VERDICT_ACTION[res.verdict] || "unknown", reason_code: res.reason_code, reason: res.reason,
            data: provenance(m, d.sec, w.secAt, now, res.score != null ? { score: res.score, breakdown: res.breakdown } : null),
          });
        }
      }

      const missing = m ? 0 : (Number(d.missing_count) || 0) + 1;
      let status = null;
      if (allFinal) status = "expired";
      else if (!m && missing >= DEAD_AFTER_MISSING) status = "dead";
      payload.token_updates.push({
        mint: d.mint,
        symbol: m ? m.symbol : null,
        name: m ? m.name : null,
        pair_address: m ? m.pair_address : null,
        dex_id: m ? m.dex_id : null,
        pair_created_at: m ? m.pair_created_at : null,
        price_usd: m ? m.price : null,
        liq_usd: m ? m.liq : null,
        mcap_usd: m ? m.mcap : null,
        market: m
          ? {
            price: m.price, liq: m.liq, mcap: m.mcap, vol_h1: m.vol_h1, vol_h24: m.vol_h24,
            buys_h1: m.buys_h1, sells_h1: m.sells_h1, chg_m5: m.chg_m5, chg_h1: m.chg_h1, chg_h24: m.chg_h24,
          }
          : null,
        sec: w.secNew,
        sec_at: w.secNew ? w.secAt : null,
        missing_count: missing,
        status,
        next_eval_at: iso(now + (nextMin == null ? 60 : nextMin) * 60e3),
      });
    }

    payload.sources = Object.keys(stat).map((id) => Object.assign({ id }, stat[id]));
    if (stat.dexscreener.errors) errors.push(`dexscreener: ${stat.dexscreener.errors} errori (${stat.dexscreener.last_error})`);
    if (stat.rugcheck.errors) errors.push(`rugcheck: ${stat.rugcheck.errors} errori (${stat.rugcheck.last_error})`);
    payload.tick = {
      started_at: iso(t0), duration_ms: Date.now() - t0, scouted, refreshed: fetchedOk.size, evaluated,
      rug_calls: rugCalls, ok: errors.length === 0, errors: errors.length ? errors : null,
    };
  } catch (e) {
    errors.push("eccezione nel tick: " + String((e && e.message) || e).slice(0, 300));
    payload.sources = Object.keys(stat).map((id) => Object.assign({ id }, stat[id]));
    payload.tick = { started_at: iso(t0), duration_ms: Date.now() - t0, ok: false, errors };
  }

  const commit = await sb.rpc("desk_commit_tick", { p: payload });
  if (commit.error) return json({ ok: false, stage: "commit", error: commit.error.message, errors }, 500);
  return json(Object.assign({ ms: Date.now() - t0, errors }, commit.data, payload.tick));
});
