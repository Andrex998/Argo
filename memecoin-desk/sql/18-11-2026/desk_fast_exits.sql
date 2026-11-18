CREATE OR REPLACE FUNCTION public.desk_fast_exits()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  c_src constant text := 'dexscreener:fast';
  c_num constant text := '^[0-9]+([.][0-9]+)?(e[-+]?[0-9]+)?$';
  v_mints text[];
  v_resp extensions.http_response;
  v_pairs jsonb;
  v_err text := null;
  q record;
  pos public.desk_positions;
  v_fee numeric; v_fix numeric; v_tp numeric;
  v_liq numeric; v_gross numeric; v_after numeric;
  v_proceeds numeric; v_costs numeric; v_pnl numeric; v_chg numeric;
  v_code text; v_reason text;
  v_anom boolean;
  v_checked int := 0; v_sells int := 0; v_busy int := 0; v_noprice int := 0;
  v_touched text[] := '{}';
  v_rows jsonb := '[]'::jsonb;
begin
  if (select paused from public.desk_state where id = 1) then
    return jsonb_build_object('ok', false, 'reason', 'paused');
  end if;
  -- una sola esecuzione alla volta
  if not pg_try_advisory_xact_lock(72710161) then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- al più 30 token per chiamata (limite di DexScreener): prima quelli col prezzo più vecchio
  select array_agg(m.mint) into v_mints
  from (
    select p.mint
    from public.desk_positions p
    join public.desk_strategies st on st.id = p.strategy_id
    where p.status = 'open' and (st.params->'exits'->>'fast_check_s') is not null
    group by p.mint
    order by min(p.last_mark_at) nulls first
    limit 30
  ) m;
  if v_mints is null then
    return jsonb_build_object('ok', true, 'checked', 0);
  end if;

  -- interruttore proprio: tre errori di fila sospendono il controllo rapido per 2 minuti
  insert into public.desk_sources (id) values (c_src) on conflict (id) do nothing;
  update public.desk_sources set state = 'closed'
   where id = c_src and state = 'open' and open_until <= now();
  if (select state from public.desk_sources where id = c_src) = 'open' then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '5');
  begin
    v_resp := extensions.http_get(
      'https://api.dexscreener.com/tokens/v1/solana/' || array_to_string(v_mints, ','));
    if v_resp.status <> 200 then
      v_err := 'HTTP ' || v_resp.status;
    else
      v_pairs := v_resp.content::jsonb;
      if jsonb_typeof(v_pairs) <> 'array' then
        v_err := 'risposta non valida';
      end if;
    end if;
  exception when others then
    v_err := left(sqlerrm, 160);
  end;

  if v_err is not null then
    -- sorgente non raggiunta: nessuna decisione su dati che non ho
    update public.desk_sources set
      fail_count = fail_count + 1, calls = calls + 1, errors = errors + 1,
      last_error = v_err, last_error_at = now(),
      state = case when fail_count + 1 >= 3 then 'open' else state end,
      open_until = case when fail_count + 1 >= 3 then now() + interval '2 minutes' else open_until end
    where id = c_src;
    return jsonb_build_object('ok', false, 'reason', v_err);
  end if;
  update public.desk_sources set
    fail_count = 0, state = 'closed', open_until = null, last_ok_at = now(), calls = calls + 1
  where id = c_src;

  -- mai aspettare il giro al minuto: se una riga è occupata si rinuncia subito
  perform set_config('lock_timeout', '200ms', true);

  for q in
    with best as (
      -- come pickBestPair: tra le pair del token, quella con più liquidità dichiarata
      select distinct on (x.mint) x.mint, x.price, x.liq
      from (
        select e->'baseToken'->>'address' as mint,
               case when (e->>'priceUsd') ~* c_num then (e->>'priceUsd')::numeric end as price,
               case when (e->'liquidity'->>'usd') ~* c_num then (e->'liquidity'->>'usd')::numeric end as liq
        from jsonb_array_elements(v_pairs) e
        where jsonb_typeof(e) = 'object'
      ) x
      where x.mint is not null
      order by x.mint, coalesce(x.liq, -1) desc
    )
    select p.id, st.params, b.price, b.liq
    from public.desk_positions p
    join public.desk_strategies st on st.id = p.strategy_id
    left join best b on b.mint = p.mint
    where p.status = 'open'
      and (st.params->'exits'->>'fast_check_s') is not null
      and p.mint = any(v_mints)
    order by p.id
  loop
    v_checked := v_checked + 1;
    if q.price is null or q.price <= 0 then
      -- prezzo mancante: il conteggio dei dati persi resta al giro al minuto
      v_noprice := v_noprice + 1;
      continue;
    end if;

    begin
      select * into pos from public.desk_positions
        where id = q.id and status = 'open' for update skip locked;
      if not found or coalesce(pos.entry_mid, 0) <= 0 then
        v_busy := v_busy + 1;
      else
        v_fee := coalesce((q.params->'costs'->>'fee_pct_per_side')::numeric, 0);
        v_fix := coalesce((q.params->'costs'->>'fixed_usd_per_tx')::numeric, 0);
        v_tp  := (q.params->'exits'->>'take_profit_pct')::numeric;

        -- come simSell: impatto da pool a prodotto costante, poi commissione e costo fisso
        v_liq := coalesce(case when q.liq > 0 then q.liq end, pos.last_liq_usd, pos.entry_liq_usd);
        v_gross := pos.qty * q.price;
        v_after := case when v_liq > 0 then v_gross / (1 + v_gross / (v_liq / 2)) else 0 end;
        v_proceeds := greatest(0, v_after - v_after * v_fee / 100 - v_fix);
        v_costs := v_gross - v_proceeds;
        v_chg := round((q.price / pos.entry_mid - 1) * 100, 1);

        -- come checkExit: lo stop scatta sul prezzo osservato, non sul livello
        v_code := null;
        if pos.stop_price is not null and q.price <= pos.stop_price then
          v_code := case when pos.trailing_active then 'TRAIL_STOP' else 'STOP_LOSS' end;
          v_reason := case when pos.trailing_active
            then 'trailing stop: prezzo ' || v_chg || '% dall''ingresso, sotto lo stop mobile'
            else 'stop loss: prezzo ' || v_chg || '% dall''ingresso' end || ' (controllo ogni 15 s)';
        elsif v_tp is not null and q.price >= pos.entry_mid * (1 + v_tp / 100) then
          v_code := 'TAKE_PROFIT';
          v_reason := 'take profit: prezzo +' || v_chg || '% dall''ingresso (controllo ogni 15 s)';
        end if;

        if v_code is null then
          update public.desk_positions set
            last_price = q.price, last_liq_usd = v_liq, last_value_usd = v_proceeds, last_mark_at = now(),
            peak_price = greatest(coalesce(peak_price, entry_mid), q.price), missing_ticks = 0
          where id = pos.id;
        else
          v_anom := q.price > 5 * pos.entry_mid;
          if v_anom then
            -- ANOMALY_CAP: lettura anomala, uscita contata al livello del take profit
            v_proceeds := least(v_proceeds, pos.cost_usd * (1 + coalesce(v_tp, 120) / 100));
            -- 18/11: anche i costi si contano al livello del take profit, non al prezzo anomalo; e non conta come vincita
            v_costs := greatest(0, least(v_costs, pos.qty * pos.entry_mid * (1 + coalesce(v_tp, 120) / 100) - v_proceeds));
            v_reason := v_reason || ' [prezzo letto anomalo: uscita contata al livello del take profit, non conta come vincita]';
          end if;
          v_pnl := v_proceeds - pos.cost_usd;
          update public.desk_positions set
            status = 'closed', closed_at = now(),
            exit_mid = q.price, last_price = q.price, last_liq_usd = v_liq,
            proceeds_usd = v_proceeds, exit_costs_usd = v_costs,
            pnl_usd = v_pnl,
            pnl_pct = case when pos.cost_usd > 0 then v_pnl / pos.cost_usd * 100 end,
            exit_reason = v_code,
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
          values (pos.strategy_id, pos.mint, pos.symbol, 'EXECUTOR', 'sell', v_code, v_reason,
                  jsonb_build_object(
                    'at', now(), 'via', 'fast15',
                    'market', jsonb_build_object('src', 'dexscreener', 'price', q.price, 'liq', v_liq),
                    'prev_price', pos.last_price, 'prev_mark_at', pos.last_mark_at,
                    'entry_mid', pos.entry_mid, 'qty', pos.qty, 'stop_price', pos.stop_price,
                    'position_id', pos.id, 'cost_usd', pos.cost_usd, 'proceeds_usd', round(v_proceeds, 4),
                    'pnl_usd', round(v_pnl, 4),
                    'pnl_pct', case when pos.cost_usd > 0 then round(v_pnl / pos.cost_usd * 100, 2) end)
                  || case when v_anom then jsonb_build_object('anomalia_prezzo', true) else '{}'::jsonb end);
          v_sells := v_sells + 1;
          v_touched := array_append(v_touched, pos.strategy_id);
        end if;

        v_rows := v_rows || jsonb_build_object(
          'id', pos.id, 's', pos.strategy_id, 'sym', pos.symbol, 'price', q.price, 'liq', v_liq,
          'value', round(v_proceeds, 4), 'chg', v_chg, 'exit', v_code);
      end if;
    exception when lock_not_available or deadlock_detected then
      v_busy := v_busy + 1;
    end;
  end loop;

  if v_sells > 0 then
    -- capitale e fotografia subito, come fa il giro al minuto quando vende
    begin
      update public.desk_strategies st set
        equity = st.cash + coalesce((
          select sum(coalesce(ps.last_value_usd, 0)) from public.desk_positions ps
          where ps.strategy_id = st.id and ps.status = 'open'), 0)
      where st.id = any(v_touched);
      insert into public.desk_equity (ts, strategy_id, cash, positions_value, equity, open_positions)
      select date_trunc('minute', now()), st.id, st.cash, st.equity - st.cash, st.equity,
             (select count(*) from public.desk_positions ps where ps.strategy_id = st.id and ps.status = 'open')
      from public.desk_strategies st
      where st.id = any(v_touched)
      on conflict (strategy_id, ts) do update set
        cash = excluded.cash, positions_value = excluded.positions_value,
        equity = excluded.equity, open_positions = excluded.open_positions;
    exception when lock_not_available or deadlock_detected then
      null; -- ci pensa il giro al minuto, entro 60 secondi
    end;
  end if;

  return jsonb_build_object('ok', true, 'checked', v_checked, 'sells', v_sells,
                            'busy', v_busy, 'no_price', v_noprice, 'rows', v_rows);
end;
$function$
