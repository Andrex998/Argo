CREATE OR REPLACE FUNCTION public.desk_commit_tick(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r jsonb;
  s public.desk_strategies;
  pos public.desk_positions;
  v_new int := 0;
  v_buys int := 0;
  v_sells int := 0;
  v_skips int := 0;
  v_cost numeric;
  v_costs numeric;
  v_proceeds numeric;
  v_pnl numeric;
  v_id bigint;
  v_calls int;
  v_errs int;
  v_sosp boolean;
  v_late numeric;
  v_src text;
  v_flags jsonb;
  v_anom boolean;
  v_tp numeric;
begin
  with ins as (
    insert into public.desk_tokens (mint, source)
    select x->>'mint', coalesce(x->>'source', 'unknown')
    from jsonb_array_elements(coalesce(p->'new_tokens', '[]'::jsonb)) x
    where coalesce(x->>'mint', '') <> ''
    on conflict (mint) do nothing
    returning mint, source
  ), lg as (
    insert into public.desk_decisions (agent, action, mint, reason_code, reason, data)
    select 'SCOUT', 'seen', mint, 'NEW', 'nuovo token da ' || source,
           jsonb_build_object('src', source)
    from ins
    returning 1
  )
  select count(*) into v_new from lg;

  update public.desk_tokens t set
    symbol          = coalesce(u.symbol, t.symbol),
    name            = coalesce(u.name, t.name),
    pair_address    = coalesce(u.pair_address, t.pair_address),
    dex_id          = coalesce(u.dex_id, t.dex_id),
    pair_created_at = coalesce(u.pair_created_at, t.pair_created_at),
    price_usd       = coalesce(u.price_usd, t.price_usd),
    liq_usd         = case when u.market is not null then u.liq_usd else t.liq_usd end,
    mcap_usd        = case when u.market is not null then u.mcap_usd else t.mcap_usd end,
    market          = coalesce(u.market, t.market),
    market_at       = case when u.market is not null then now() else t.market_at end,
    sec             = coalesce(u.sec, t.sec),
    sec_at          = coalesce(u.sec_at, t.sec_at),
    missing_count   = coalesce(u.missing_count, t.missing_count),
    eval_count      = t.eval_count + 1,
    status          = coalesce(u.status, t.status),
    next_eval_at    = coalesce(u.next_eval_at, now() + interval '10 minutes'),
    last_eval_at    = now()
  from jsonb_to_recordset(coalesce(p->'token_updates', '[]'::jsonb)) as u(
    mint text, symbol text, name text, pair_address text, dex_id text, pair_created_at timestamptz,
    price_usd numeric, liq_usd numeric, mcap_usd numeric, market jsonb, sec jsonb, sec_at timestamptz,
    missing_count int, status text, next_eval_at timestamptz)
  where t.mint = u.mint;

  insert into public.desk_verdicts (strategy_id, mint, verdict, reason_code, reason, score, final, updated_at)
  select v.strategy_id, v.mint, v.verdict, v.reason_code, v.reason, v.score, coalesce(v.final, false), now()
  from jsonb_to_recordset(coalesce(p->'verdicts', '[]'::jsonb)) as v(
    strategy_id text, mint text, verdict text, reason_code text, reason text, score numeric, final boolean)
  where exists (select 1 from public.desk_tokens t where t.mint = v.mint)
  on conflict (strategy_id, mint) do update set
    verdict = excluded.verdict, reason_code = excluded.reason_code, reason = excluded.reason,
    score = excluded.score, final = excluded.final, updated_at = now();

  insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
  select d.strategy_id, d.mint, d.symbol, d.agent, d.action, d.reason_code, d.reason, d.data
  from jsonb_to_recordset(coalesce(p->'decisions', '[]'::jsonb)) as d(
    strategy_id text, mint text, symbol text, agent text, action text, reason_code text, reason text, data jsonb);

  update public.desk_positions ps set
    last_price      = coalesce(m.last_price, ps.last_price),
    last_liq_usd    = coalesce(m.last_liq_usd, ps.last_liq_usd),
    last_value_usd  = coalesce(m.last_value_usd, ps.last_value_usd),
    last_mark_at    = case when m.last_price is not null then now() else ps.last_mark_at end,
    peak_price      = coalesce(m.peak_price, ps.peak_price),
    stop_price      = coalesce(m.stop_price, ps.stop_price),
    trailing_active = coalesce(m.trailing_active, ps.trailing_active),
    missing_ticks   = coalesce(m.missing_ticks, ps.missing_ticks)
  from jsonb_to_recordset(coalesce(p->'marks', '[]'::jsonb)) as m(
    position_id bigint, last_price numeric, last_liq_usd numeric, last_value_usd numeric,
    peak_price numeric, stop_price numeric, trailing_active boolean, missing_ticks int)
  where ps.id = m.position_id and ps.status = 'open';

  for r in select * from jsonb_array_elements(coalesce(p->'closes', '[]'::jsonb)) loop
    select * into pos from public.desk_positions
      where id = (r->>'position_id')::bigint and status = 'open' for update;
    if not found then continue; end if;
    v_proceeds := greatest(coalesce((r->>'proceeds_usd')::numeric, 0), 0);
    v_costs := greatest(coalesce((r->>'exit_costs_usd')::numeric, 0), 0);
    v_anom := coalesce(pos.entry_mid > 0 and (r->>'exit_mid')::numeric > 5 * pos.entry_mid, false);
    if v_anom then
      -- ANOMALY_CAP: lettura anomala, uscita contata al livello del take profit
      v_tp := coalesce((
        select (st.params->'exits'->>'take_profit_pct')::numeric from public.desk_strategies st where st.id = pos.strategy_id), 120);
      v_proceeds := least(v_proceeds, pos.cost_usd * (1 + v_tp / 100));
      -- 18/11: anche i costi si contano al livello del take profit, non al prezzo anomalo; e non conta come vincita
      v_costs := greatest(0, least(v_costs, pos.qty * pos.entry_mid * (1 + v_tp / 100) - v_proceeds));
      r := r || jsonb_build_object('reason', coalesce(r->>'reason', '') || ' [prezzo letto anomalo: uscita contata al livello del take profit, non conta come vincita]',
                                   'data', coalesce(r->'data', '{}'::jsonb) || jsonb_build_object('anomalia_prezzo', true));
    end if;
    -- consiglio del 17/11: un'uscita a tempo su un token con dati non credibili non è un incasso attendibile
    -- 18/11: e si conta a zero, come le uscite senza dati (DATA_LOST) e come fa desk_v_prudente
    if r->>'exit_reason' = 'TIME_STOP'
       and coalesce((pos.entry_data->'flags'->>'sospetto')::boolean, public.desk_is_sospetto(pos.entry_data->'market')) then
      r := r || jsonb_build_object('reason', coalesce(r->>'reason', '') || ' [token con dati non credibili: incasso non attendibile, contato a zero]',
                                   'data', coalesce(r->'data', '{}'::jsonb) || jsonb_build_object('incasso_non_attendibile', true,
                                                                                               'incasso_simulato_usd', round(v_proceeds, 4)));
      v_proceeds := 0;
      v_costs := 0;
    end if;
    v_pnl := v_proceeds - pos.cost_usd;
    update public.desk_positions set
      status = 'closed', closed_at = now(),
      exit_mid = (r->>'exit_mid')::numeric,
      last_price = coalesce((r->>'exit_mid')::numeric, last_price),
      proceeds_usd = v_proceeds, exit_costs_usd = v_costs,
      pnl_usd = v_pnl,
      pnl_pct = case when pos.cost_usd > 0 then v_pnl / pos.cost_usd * 100 end,
      exit_reason = r->>'exit_reason',
      last_value_usd = 0
    where id = pos.id;
    update public.desk_strategies set
      cash = cash + v_proceeds,
      realized_pnl = realized_pnl + v_pnl,
      costs_paid = costs_paid + v_costs,
      trades_closed = trades_closed + 1,
      wins = wins + (case when v_pnl > 0 and not v_anom then 1 else 0 end),
      losses = losses + (case when v_pnl > 0 then 0 else 1 end),
      updated_at = now()
    where id = pos.strategy_id;
    insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
    values (pos.strategy_id, pos.mint, pos.symbol, 'EXECUTOR', 'sell', r->>'exit_reason', r->>'reason',
            coalesce(r->'data', '{}'::jsonb) || jsonb_build_object(
              'position_id', pos.id, 'cost_usd', pos.cost_usd, 'proceeds_usd', round(v_proceeds, 4),
              'pnl_usd', round(v_pnl, 4),
              'pnl_pct', case when pos.cost_usd > 0 then round(v_pnl / pos.cost_usd * 100, 2) end));
    v_sells := v_sells + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p->'opens', '[]'::jsonb)) loop
    v_cost := (r->>'cost_usd')::numeric;
    select * into s from public.desk_strategies where id = r->>'strategy_id' for update;
    if not found then continue; end if;
    if exists (select 1 from public.desk_positions where strategy_id = s.id and mint = r->>'mint') then
      continue;
    end if;
    -- tetto di posizioni aperte e interruttore, se la strategia li dichiara in params.guard
    if coalesce((s.params->'guard'->>'halted')::boolean, false) then
      v_skips := v_skips + 1;
      continue;
    end if;
    if (s.params->'guard'->>'max_open') is not null
       and (select count(*) from public.desk_positions where strategy_id = s.id and status = 'open')
           >= (s.params->'guard'->>'max_open')::int then
      insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
      values (s.id, r->>'mint', r->>'symbol', 'RISK', 'skip', 'MAX_OPEN', 'tetto di posizioni aperte raggiunto',
              jsonb_build_object('max_open', (s.params->'guard'->>'max_open')::int));
      v_skips := v_skips + 1;
      continue;
    end if;
    -- consiglio del 17/11: flag su ogni ingresso; filtro dati non credibili e filtro "tardi" se la strategia li chiede
    v_sosp := public.desk_is_sospetto(r->'data'->'market');
    v_src := null; v_late := null;
    select tk.source, extract(epoch from (tk.first_seen - tk.pair_created_at)) / 60 into v_src, v_late
      from public.desk_tokens tk where tk.mint = r->>'mint';
    v_flags := jsonb_build_object('sospetto', v_sosp, 'src', v_src, 'late_min', round(v_late, 1));
    if coalesce((s.params->'filter'->>'data_sanity')::boolean, false) and v_sosp then
      insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
      values (s.id, r->>'mint', r->>'symbol', 'FILTER', 'kill', 'DATA_SANITY',
              'dati di mercato non credibili: volume dell''ultima ora sotto il 10% della liquidità, o liquidità quasi pari alla mcap',
              jsonb_build_object('flags', v_flags, 'market', r->'data'->'market'));
      insert into public.desk_verdicts (strategy_id, mint, verdict, reason_code, reason, score, final, updated_at)
      values (s.id, r->>'mint', 'KILL', 'DATA_SANITY', 'dati di mercato non credibili', (r->>'score')::numeric, true, now())
      on conflict (strategy_id, mint) do update set verdict = 'KILL', reason_code = 'DATA_SANITY',
        reason = 'dati di mercato non credibili', final = true, updated_at = now();
      v_skips := v_skips + 1;
      continue;
    end if;
    if (s.params->'filter'->>'late_min') is not null
       and not (coalesce(v_src, '') like 'dexscreener:%' and coalesce(v_late, -1) > (s.params->'filter'->>'late_min')::numeric) then
      insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
      values (s.id, r->>'mint', r->>'symbol', 'FILTER', 'kill', 'NOT_LATE',
              'non è un token tardi: serve un profilo DexScreener comparso più di ' || (s.params->'filter'->>'late_min') || ' minuti dopo la nascita della pair',
              jsonb_build_object('flags', v_flags));
      insert into public.desk_verdicts (strategy_id, mint, verdict, reason_code, reason, score, final, updated_at)
      values (s.id, r->>'mint', 'KILL', 'NOT_LATE', 'non è un token tardi', (r->>'score')::numeric, true, now())
      on conflict (strategy_id, mint) do update set verdict = 'KILL', reason_code = 'NOT_LATE',
        reason = 'non è un token tardi', final = true, updated_at = now();
      v_skips := v_skips + 1;
      continue;
    end if;
    if v_cost is null or v_cost <= 0 or s.cash < v_cost then
      insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
      values (s.id, r->>'mint', r->>'symbol', 'RISK', 'skip', 'NO_CASH', 'cassa insufficiente per aprire',
              jsonb_build_object('cash', s.cash, 'cost_usd', v_cost));
      v_skips := v_skips + 1;
      continue;
    end if;
    v_costs := greatest(coalesce((r->>'entry_costs_usd')::numeric, 0), 0);
    insert into public.desk_positions (
      strategy_id, mint, symbol, pair_address, entry_mid, qty, cost_usd, entry_costs_usd, entry_liq_usd,
      last_price, last_liq_usd, last_value_usd, last_mark_at, peak_price, stop_price, entry_data)
    values (
      s.id, r->>'mint', r->>'symbol', r->>'pair_address', (r->>'entry_mid')::numeric, (r->>'qty')::numeric,
      v_cost, v_costs, (r->>'entry_liq_usd')::numeric,
      (r->>'entry_mid')::numeric, (r->>'entry_liq_usd')::numeric, (r->>'value_usd')::numeric, now(),
      (r->>'entry_mid')::numeric, (r->>'stop_price')::numeric,
      coalesce(r->'data', '{}'::jsonb) || jsonb_build_object('flags', v_flags))
    returning id into v_id;
    update public.desk_strategies set
      cash = cash - v_cost, costs_paid = costs_paid + v_costs,
      trades_opened = trades_opened + 1, updated_at = now()
    where id = s.id;
    insert into public.desk_decisions (strategy_id, mint, symbol, agent, action, reason_code, reason, data)
    values (s.id, r->>'mint', r->>'symbol', 'EXECUTOR', 'buy', 'BUY', r->>'reason',
            coalesce(r->'data', '{}'::jsonb) || jsonb_build_object(
              'position_id', v_id, 'cost_usd', v_cost, 'qty', (r->>'qty')::numeric,
              'entry_mid', (r->>'entry_mid')::numeric, 'stop_price', (r->>'stop_price')::numeric,
              'entry_costs_usd', v_costs));
    insert into public.desk_verdicts (strategy_id, mint, verdict, reason_code, reason, score, final, updated_at)
    values (s.id, r->>'mint', 'BOUGHT', 'BUY', 'posizione aperta', (r->>'score')::numeric, true, now())
    on conflict (strategy_id, mint) do update set
      verdict = 'BOUGHT', reason_code = 'BUY', reason = 'posizione aperta',
      score = excluded.score, final = true, updated_at = now();
    v_buys := v_buys + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p->'sources', '[]'::jsonb)) loop
    v_calls := coalesce((r->>'calls')::int, 0);
    v_errs := coalesce((r->>'errors')::int, 0);
    if v_calls = 0 then continue; end if;
    insert into public.desk_sources (id) values (r->>'id') on conflict (id) do nothing;
    if v_errs < v_calls then
      update public.desk_sources set
        calls = calls + v_calls, errors = errors + v_errs,
        fail_count = 0, state = 'closed', open_until = null, last_ok_at = now(),
        last_error = coalesce(r->>'last_error', last_error),
        last_error_at = case when r->>'last_error' is not null then now() else last_error_at end
      where id = r->>'id';
    else
      update public.desk_sources set
        calls = calls + v_calls, errors = errors + v_errs,
        last_error = r->>'last_error', last_error_at = now(),
        state = case when fail_count + 1 >= 3 then 'open' else state end,
        open_until = case when fail_count + 1 >= 3 then now() + interval '5 minutes' else open_until end,
        fail_count = fail_count + 1
      where id = r->>'id';
    end if;
  end loop;

  update public.desk_strategies st set
    equity = st.cash + coalesce((
      select sum(coalesce(ps.last_value_usd, 0)) from public.desk_positions ps
      where ps.strategy_id = st.id and ps.status = 'open'), 0)
  where st.id is not null;

  insert into public.desk_equity (ts, strategy_id, cash, positions_value, equity, open_positions)
  select date_trunc('minute', now()), st.id, st.cash, st.equity - st.cash, st.equity,
         (select count(*) from public.desk_positions ps where ps.strategy_id = st.id and ps.status = 'open')
  from public.desk_strategies st
  where v_buys + v_sells > 0 or extract(minute from now())::int % 5 = 0
  on conflict (strategy_id, ts) do update set
    cash = excluded.cash, positions_value = excluded.positions_value,
    equity = excluded.equity, open_positions = excluded.open_positions;

  insert into public.desk_ticks (started_at, duration_ms, scouted, new_tokens, refreshed, evaluated, rug_calls, buys, sells, ok, errors)
  values (
    coalesce((p->'tick'->>'started_at')::timestamptz, now()),
    (p->'tick'->>'duration_ms')::int,
    (p->'tick'->>'scouted')::int, v_new,
    (p->'tick'->>'refreshed')::int, (p->'tick'->>'evaluated')::int, (p->'tick'->>'rug_calls')::int,
    v_buys, v_sells,
    coalesce((p->'tick'->>'ok')::boolean, true),
    p->'tick'->'errors');

  update public.desk_state set tick_finished_at = now(), tick_count = tick_count + 1 where id = 1;
  delete from public.desk_ticks where finished_at < now() - interval '14 days';

  return jsonb_build_object('ok', true, 'new_tokens', v_new, 'buys', v_buys, 'sells', v_sells, 'skips', v_skips);
end;
$function$
