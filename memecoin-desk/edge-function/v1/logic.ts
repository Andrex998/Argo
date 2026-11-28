// ARGO//DESK v0 — logica pura (nessuna rete, nessun DB): testabile da sola.
// Punteggio on-chain e gate di sicurezza sono portati da ARGO//RADAR.
// Regola madre: il dato che manca non si inventa. Tre esiti, mai due: PASS / KILL / UNKNOWN (+ WAIT).

export const num = (x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

const usd = (n) => {
  if (n == null) return "n.d.";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "k";
  return "$" + Number(n).toFixed(2);
};

// ── MERCATO (DexScreener) ───────────────────────────────────────────────────

// Tra le pair restituite sceglie quella del token con più liquidità dichiarata.
export function pickBestPair(pairs, mint) {
  let best = null;
  let bestLiq = -2;
  for (const p of pairs || []) {
    if (!p || !p.baseToken || p.baseToken.address !== mint) continue;
    const liq = num(p.liquidity && p.liquidity.usd);
    const rank = liq == null ? -1 : liq;
    if (rank > bestLiq) {
      best = p;
      bestLiq = rank;
    }
  }
  return best;
}

export function marketFromPair(p, nowMs) {
  const mc = num(p.marketCap);
  const fdv = num(p.fdv);
  const liq = num(p.liquidity && p.liquidity.usd);
  const v = p.volume || {};
  const tx = (p.txns && p.txns.h1) || null;
  const ch = p.priceChange || {};
  const created = num(p.pairCreatedAt);
  const price = num(p.priceUsd);
  return {
    price: price != null && price > 0 ? price : null,
    liq: liq != null && liq > 0 ? liq : null,
    mcap: mc != null && mc > 0 ? mc : fdv != null && fdv > 0 ? fdv : null,
    vol_m5: num(v.m5),
    vol_h1: num(v.h1),
    vol_h24: num(v.h24),
    buys_h1: tx ? num(tx.buys) : null,
    sells_h1: tx ? num(tx.sells) : null,
    chg_m5: num(ch.m5),
    chg_h1: num(ch.h1),
    chg_h24: num(ch.h24),
    age_h: created ? (nowMs - created) / 36e5 : null,
    pair_created_at: created ? new Date(created).toISOString() : null,
    pair_address: p.pairAddress || null,
    dex_id: p.dexId || null,
    symbol: (p.baseToken && p.baseToken.symbol) || null,
    name: (p.baseToken && p.baseToken.name) || null,
  };
}

// ── ANALYST: punteggio on-chain di ARGO//RADAR (solo voci automatiche, max 36) ──
export function onchainScore(m) {
  const items = [];
  const add = (id, max, pts, known, flag) =>
    items.push({ id, max, pts: known ? pts : 0, known, flag: flag || null });

  {
    const ok = m.mcap != null && m.mcap > 0 && m.vol_h1 != null;
    const r = ok ? m.vol_h1 / m.mcap : null;
    let pts = 0;
    if (ok) pts = r >= 0.5 ? 10 : r >= 0.2 ? 7 : r >= 0.05 ? 4 : r > 0 ? 1 : 0;
    add("volm", 10, pts, ok, ok && r < 0.05 ? "volume anemico vs mcap" : null);
  }
  {
    const ok = m.mcap != null && m.mcap > 0 && m.liq != null;
    const r = ok ? m.liq / m.mcap : null;
    let pts = 0;
    let flag = null;
    if (ok) {
      if (r >= 0.05 && r <= 0.5) pts = 8;
      else if (r >= 0.02 || r > 0.5) pts = 4;
      else {
        pts = 1;
        flag = "liquidità sottile: uscita = slippage";
      }
    }
    add("liq", 8, pts, ok, flag);
  }
  {
    const ok = m.buys_h1 != null && m.sells_h1 != null && m.buys_h1 + m.sells_h1 > 0;
    const bp = ok ? m.buys_h1 / (m.buys_h1 + m.sells_h1) : null;
    let pts = 0;
    let flag = null;
    if (ok) {
      if (bp >= 0.6) pts = 7;
      else if (bp >= 0.5) pts = 4;
      else if (bp >= 0.4) pts = 2;
      else {
        pts = 0;
        flag = "pressione di vendita dominante (1h)";
      }
    }
    add("bp", 7, pts, ok, flag);
  }
  {
    const ok = m.chg_h1 != null || m.chg_m5 != null;
    let pts = 0;
    if (ok) {
      if ((m.chg_m5 || 0) > 0 && (m.chg_h1 || 0) > 0) pts = 7;
      else if ((m.chg_h1 || 0) > 0) pts = 4;
    }
    add("mom", 7, pts, ok, null);
  }
  {
    const ok = m.age_h != null;
    let pts = 0;
    let flag = null;
    if (ok) {
      if (m.age_h < 1) {
        pts = 0;
        flag = "ultra-early (<1h): sniper in vantaggio";
      } else if (m.age_h <= 72) pts = 4;
      else if (m.age_h <= 168) pts = 2;
      else pts = 0;
    }
    add("age", 4, pts, ok, flag);
  }
  return { pts: items.reduce((s, i) => s + i.pts, 0), max: 36, items };
}

// ── FILTER: sicurezza normalizzata dal report RugCheck ─────────────────────
export function normSec(rep, pairAddress) {
  const out = {
    mint: "na", // ok | fail | na
    freeze: "na",
    lp: null, // % LP bloccata/bruciata sul mercato principale
    lp_market: null,
    top10: null, // % supply nei primi 10 wallet, pool AMM esclusi
    top10_raw: null, // come la calcolava ARGO//RADAR (pool inclusi)
    pools_excluded: 0,
    dev_pct: null,
    rugged: null,
    score_norm: null,
    holders: null,
    insiders: null,
    risks: [],
  };
  if (!rep || typeof rep !== "object") return out;
  const t = rep.token || {};
  if ("mintAuthority" in t) out.mint = t.mintAuthority ? "fail" : "ok";
  else if ("mintAuthority" in rep) out.mint = rep.mintAuthority ? "fail" : "ok";
  if ("freezeAuthority" in t) out.freeze = t.freezeAuthority ? "fail" : "ok";
  else if ("freezeAuthority" in rep) out.freeze = rep.freezeAuthority ? "fail" : "ok";

  const markets = Array.isArray(rep.markets) ? rep.markets.filter((m) => m && typeof m === "object") : [];
  let main = markets.find((m) => pairAddress && m.pubkey === pairAddress) || null;
  if (!main) {
    let bestL = -1;
    for (const m of markets) {
      const lp = m.lp || {};
      const l = (num(lp.baseUSD) || 0) + (num(lp.quoteUSD) || 0);
      if (l > bestL) {
        bestL = l;
        main = m;
      }
    }
  }
  if (main && main.lp) {
    const lp = num(main.lp.lpLockedPct);
    if (lp != null) {
      out.lp = lp;
      out.lp_market = main.marketType || null;
    }
  }

  // I conti dei pool (AMM) non sono "holder": vanno esclusi dalla concentrazione.
  const pools = new Set();
  for (const m of markets) if (m.pubkey) pools.add(m.pubkey);
  const ka = rep.knownAccounts && typeof rep.knownAccounts === "object" ? rep.knownAccounts : {};
  for (const k of Object.keys(ka)) if (ka[k] && ka[k].type === "AMM") pools.add(k);

  const holders = Array.isArray(rep.topHolders) ? rep.topHolders.filter((h) => h && typeof h === "object") : [];
  if (holders.length) {
    const sum10 = (arr) => arr.slice(0, 10).reduce((s, h) => s + (Number(h.pct) || 0), 0);
    out.top10_raw = sum10(holders);
    const real = holders.filter((h) => !(pools.has(h.owner) || pools.has(h.address)));
    out.pools_excluded = holders.length - real.length;
    out.top10 = sum10(real);
  }

  const creator = typeof rep.creator === "string" && rep.creator ? rep.creator : null;
  if (creator) {
    const h = holders.find((x) => x.owner === creator || x.address === creator);
    if (h) out.dev_pct = Number(h.pct) || 0;
    else {
      const bal = num(rep.creatorBalance);
      const sup = num(t.supply);
      if (bal != null && sup != null && sup > 0) out.dev_pct = (bal / sup) * 100;
    }
  }

  if (typeof rep.rugged === "boolean") out.rugged = rep.rugged;
  out.score_norm = num(rep.score_normalised);
  out.holders = num(rep.totalHolders);
  out.insiders = num(rep.graphInsidersDetected);
  if (Array.isArray(rep.risks)) {
    out.risks = rep.risks
      .slice(0, 8)
      .map((r) => ({ name: String((r && r.name) || "").slice(0, 80), level: String((r && r.level) || "").toLowerCase() }));
  }
  return out;
}

// Punti sicurezza di ARGO//RADAR (max 20): dato mancante = 0 punti.
export function secPointsArgo(sec) {
  let pts = 0;
  if (sec.mint === "ok") pts += 5;
  if (sec.freeze === "ok") pts += 5;
  if (sec.lp != null) pts += sec.lp >= 80 ? 5 : sec.lp >= 50 ? 2 : 0;
  if (sec.top10 != null) pts += sec.top10 < 15 ? 5 : sec.top10 <= 30 ? 2 : 0;
  return pts;
}

// ── Valutazione di un token per una strategia ──────────────────────────────
// Ritorna: {agent, verdict, reason_code, reason, final, score, next_min, need_sec, breakdown}
export function evaluate(strat, m, sec, opts) {
  const P = strat.params || {};
  const W = P.window || {};
  const F = P.filter || {};
  const A = P.analyst || {};
  const R = (agent, verdict, reason_code, reason, extra) =>
    Object.assign(
      { agent, verdict, reason_code, reason, final: false, score: null, next_min: 10, need_sec: false, breakdown: null },
      extra || {},
    );

  // SCOUT: il token è dentro la finestra?
  if (!m) return R("SCOUT", "UNKNOWN", "NO_MARKET", "nessun dato di mercato da DexScreener", { next_min: 15 });
  if (m.age_h == null) return R("SCOUT", "UNKNOWN", "NO_AGE", "età della pair non disponibile", { next_min: 15 });
  if (W.max_age_h != null && m.age_h > W.max_age_h) {
    return R("SCOUT", "KILL", "TOO_OLD", `pair più vecchia di ${W.max_age_h}h`, { final: true });
  }
  if (W.min_age_min != null && m.age_h * 60 < W.min_age_min) {
    const wait = Math.max(1, Math.min(10, Math.ceil(W.min_age_min - m.age_h * 60)));
    return R("SCOUT", "WAIT", "TOO_YOUNG", `pair più giovane di ${W.min_age_min} min`, { next_min: wait });
  }
  if (m.price == null) return R("SCOUT", "UNKNOWN", "NO_PRICE", "prezzo non disponibile", { next_min: 10 });
  if (W.min_mcap != null || W.max_mcap != null) {
    if (m.mcap == null) return R("SCOUT", "UNKNOWN", "NO_MCAP", "market cap non disponibile", { next_min: 15 });
    if (W.min_mcap != null && m.mcap < W.min_mcap) {
      return R("SCOUT", "WAIT", "MCAP_LOW", `mcap ${usd(m.mcap)} sotto ${usd(W.min_mcap)}`, {
        next_min: m.mcap < 0.2 * W.min_mcap ? 30 : 10,
      });
    }
    if (W.max_mcap != null && m.mcap > W.max_mcap) {
      return R("SCOUT", "WAIT", "MCAP_HIGH", `mcap ${usd(m.mcap)} sopra ${usd(W.max_mcap)}`, { next_min: 60 });
    }
  }

  // FILTER: liquidità
  if (m.liq == null) {
    return R("FILTER", "UNKNOWN", "NO_LIQ", "liquidità non dichiarata: dato mancante, niente trade", { next_min: 10 });
  }
  if (F.min_liq != null && m.liq < F.min_liq) {
    return R("FILTER", "WAIT", "LIQ_LOW", `liquidità ${usd(m.liq)} sotto ${usd(F.min_liq)}`, {
      next_min: m.liq < 0.25 * F.min_liq ? 30 : 10,
    });
  }

  // FILTER: sicurezza (RugCheck)
  if (!sec || !opts || !opts.secFresh) {
    return R("FILTER", "UNKNOWN", "SEC_PENDING", "sicurezza da verificare su RugCheck", { next_min: 1, need_sec: true });
  }
  if (sec.rugged === true) return R("FILTER", "KILL", "RUGGED", "RugCheck lo segna come rug", { final: true });
  if (sec.mint === "fail") {
    return R("FILTER", "KILL", "MINT_ACTIVE", "mint authority attiva: il dev può stampare supply", { final: true });
  }
  if (sec.freeze === "fail") {
    return R("FILTER", "KILL", "FREEZE_ACTIVE", "freeze authority attiva: i wallet possono essere congelati", { final: true });
  }

  if (A.mode === "onchain36") {
    // Regole delle slide
    if (sec.mint === "na" || sec.freeze === "na") {
      return R("FILTER", "UNKNOWN", "SEC_UNKNOWN", "authority non verificabili", { next_min: 30 });
    }
    if (sec.lp == null) return R("FILTER", "UNKNOWN", "LP_UNKNOWN", "stato della LP non verificabile", { next_min: 30 });
    if (F.lp_min_locked_pct != null && sec.lp < F.lp_min_locked_pct) {
      return R("FILTER", "KILL", "LP_NOT_BURNED", `LP bloccata/bruciata ${sec.lp.toFixed(0)}% < ${F.lp_min_locked_pct}%`, {
        next_min: 60,
      });
    }
    if (sec.top10 == null) {
      return R("FILTER", "UNKNOWN", "TOP10_UNKNOWN", "distribuzione holder non verificabile", { next_min: 30 });
    }
    if (F.max_top10_pct != null && sec.top10 > F.max_top10_pct) {
      return R("FILTER", "KILL", "TOP10_HIGH", `top 10 wallet ${sec.top10.toFixed(1)}% > ${F.max_top10_pct}%`, { next_min: 60 });
    }
    if (sec.dev_pct == null) {
      if (F.require_dev_known) {
        return R("FILTER", "UNKNOWN", "DEV_UNKNOWN", "quota del dev non verificabile", { next_min: 60 });
      }
    } else if (F.max_dev_pct != null && sec.dev_pct > F.max_dev_pct) {
      return R("FILTER", "KILL", "DEV_HIGH", `dev ${sec.dev_pct.toFixed(1)}% > ${F.max_dev_pct}%`, { next_min: 60 });
    }
    const oc = onchainScore(m);
    const s = oc.pts / oc.max;
    if (s < A.min_score) {
      return R("ANALYST", "WAIT", "SCORE_LOW", `punteggio ${s.toFixed(2)} < ${A.min_score}`, {
        score: s, next_min: 3, breakdown: oc.items,
      });
    }
    return R("ANALYST", "PASS", "PASS", `punteggio ${s.toFixed(2)} ≥ ${A.min_score}`, { score: s, breakdown: oc.items });
  }

  if (A.mode === "argo56") {
    // Gate di ARGO//RADAR
    if (sec.lp != null && F.gate_lp_min_pct != null && sec.lp < F.gate_lp_min_pct) {
      return R("FILTER", "KILL", "LP_GATE", `LP bloccata ${sec.lp.toFixed(0)}% < ${F.gate_lp_min_pct}%: rug a un click`, { next_min: 60 });
    }
    if (sec.top10 != null && F.gate_top10_max_pct != null && sec.top10 > F.gate_top10_max_pct) {
      return R("FILTER", "KILL", "TOP10_GATE", `top 10 wallet ${sec.top10.toFixed(0)}% > ${F.gate_top10_max_pct}%`, { next_min: 60 });
    }
    if (sec.mint === "na" && sec.freeze === "na" && sec.lp == null && sec.top10 == null) {
      return R("FILTER", "UNKNOWN", "SEC_UNKNOWN", "sicurezza non verificata: rating cappato, niente trade", { next_min: 30 });
    }
    const oc = onchainScore(m);
    const sp = secPointsArgo(sec);
    const s = ((oc.pts + sp) / 56) * 100;
    const bd = oc.items.concat([{ id: "sec", max: 20, pts: sp, known: true, flag: null }]);
    if (s < A.min_score) {
      return R("ANALYST", "WAIT", "SCORE_LOW", `punteggio ${s.toFixed(0)}/100 < ${A.min_score}`, {
        score: s, next_min: 3, breakdown: bd,
      });
    }
    return R("ANALYST", "PASS", "PASS", `punteggio ${s.toFixed(0)}/100 ≥ ${A.min_score}`, { score: s, breakdown: bd });
  }

  return R("ANALYST", "UNKNOWN", "NO_ANALYST", "modalità analyst non configurata", { next_min: 60 });
}

// ── EXECUTOR finto: costi e impatto sul prezzo ─────────────────────────────
// Modello: commissione % per lato + costo fisso per transazione + impatto da pool a prodotto costante
// (riserva lato quote = metà della liquidità dichiarata).
export function simBuy(P, equity, cash, m) {
  const pct = ((P.sizing && P.sizing.pct_of_equity) || 0) / 100;
  const budget = Math.min(equity * pct, cash);
  if (!(budget >= 1)) return null; // sotto 1$ non si apre
  if (m.price == null || m.liq == null) return null;
  const c = P.costs || {};
  const fee = (budget * (c.fee_pct_per_side || 0)) / 100;
  const net = budget - fee - (c.fixed_usd_per_tx || 0);
  if (!(net > 0)) return null;
  const Y = m.liq / 2;
  const qty = net / m.price / (1 + net / Y);
  return { cost_usd: budget, qty, entry_costs_usd: budget - qty * m.price };
}

export function simSell(P, qty, price, liq) {
  const gross = qty * price;
  if (!(gross > 0)) return { proceeds: 0, costs: 0, gross: 0 };
  const c = P.costs || {};
  const Y = liq != null && liq > 0 ? liq / 2 : 0;
  const afterImpact = Y > 0 ? gross / (1 + gross / Y) : 0;
  const fee = (afterImpact * (c.fee_pct_per_side || 0)) / 100;
  const proceeds = Math.max(0, afterImpact - fee - (c.fixed_usd_per_tx || 0));
  return { proceeds, costs: gross - proceeds, gross };
}

export function initialStop(P, entryMid) {
  const E = P.exits || {};
  return E.stop_pct != null ? entryMid * (1 - E.stop_pct / 100) : null;
}

// ── RISK: gestione delle posizioni aperte ──────────────────────────────────
// Lo stop scatta sul prezzo osservato, non sul livello: se il prezzo lo salta, si esce al prezzo peggiore.
export const MAX_MISSING_TICKS = 15;

export function checkExit(P, pos, m, nowMs) {
  const E = P.exits || {};
  const entry = num(pos.entry_mid);
  const qty = num(pos.qty);

  if (!m || m.price == null) {
    const miss = (num(pos.missing_ticks) || 0) + 1;
    if (miss >= MAX_MISSING_TICKS) {
      return {
        mark: { position_id: pos.id, missing_ticks: miss, last_value_usd: 0 },
        close: {
          position_id: pos.id, exit_mid: 0, proceeds_usd: 0, exit_costs_usd: 0, exit_reason: "DATA_LOST",
          reason: `nessun prezzo per ${miss} controlli di fila: chiusa a zero (dato mancante = zero)`,
        },
      };
    }
    return { mark: { position_id: pos.id, missing_ticks: miss }, close: null };
  }

  const price = m.price;
  let liq = m.liq;
  if (liq == null) liq = num(pos.last_liq_usd);
  if (liq == null) liq = num(pos.entry_liq_usd);
  const prevPeak = num(pos.peak_price);
  const peak = Math.max(prevPeak != null ? prevPeak : entry, price);
  let stop = num(pos.stop_price);
  let trailing = !!pos.trailing_active;

  if (E.trail_activate_pct != null && E.trail_pct != null) {
    if (!trailing && price >= entry * (1 + E.trail_activate_pct / 100)) trailing = true;
    if (trailing) stop = Math.max(stop != null ? stop : 0, peak * (1 - E.trail_pct / 100));
  }

  const sell = simSell(P, qty, price, liq);
  const chg = ((price / entry - 1) * 100).toFixed(1);
  let code = null;
  let text = null;
  if (stop != null && price <= stop) {
    code = trailing ? "TRAIL_STOP" : "STOP_LOSS";
    text = trailing
      ? `trailing stop: prezzo ${chg}% dall'ingresso, sotto lo stop mobile`
      : `stop loss: prezzo ${chg}% dall'ingresso`;
  } else if (E.take_profit_pct != null && price >= entry * (1 + E.take_profit_pct / 100)) {
    code = "TAKE_PROFIT";
    text = `take profit: prezzo +${chg}% dall'ingresso`;
  } else if (E.max_hold_h != null && (nowMs - Date.parse(pos.opened_at)) / 36e5 >= E.max_hold_h) {
    code = "TIME_STOP";
    text = `uscita a tempo dopo ${E.max_hold_h}h: prezzo ${chg}% dall'ingresso`;
  }

  const mark = {
    position_id: pos.id, last_price: price, last_liq_usd: liq, last_value_usd: sell.proceeds,
    peak_price: peak, stop_price: stop, trailing_active: trailing, missing_ticks: 0,
  };
  const close = code
    ? { position_id: pos.id, exit_mid: price, proceeds_usd: sell.proceeds, exit_costs_usd: sell.costs, exit_reason: code, reason: text }
    : null;
  return { mark, close };
}

export const VERDICT_ACTION = { PASS: "pass", KILL: "kill", UNKNOWN: "unknown", WAIT: "wait" };
