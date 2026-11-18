CREATE OR REPLACE FUNCTION public.desk_record_entry_extra()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  c record;
  v_resp extensions.http_response;
  v_pairs text[];
  v_gmap jsonb := '{}'::jsonb;
  v_gerr text := null;
  v_data jsonb;
  v_body jsonb;
  v_done int := 0;
begin
  if not pg_try_advisory_xact_lock(7412001) then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');

  select array_agg(pair) into v_pairs from (
    select max(p.pair_address) as pair
    from public.desk_positions p
    where p.opened_at > now() - interval '20 minutes'
      and not exists (select 1 from public.desk_entry_extra e where e.mint = p.mint)
    group by p.mint order by min(p.opened_at) limit 4
  ) q where pair is not null;

  if v_pairs is null then
    return jsonb_build_object('ok', true, 'recorded', 0);
  end if;

  -- GeckoTerminal: una sola chiamata per tutti i pool (compratori e venditori unici)
  begin
    v_resp := extensions.http_get('https://api.geckoterminal.com/api/v2/networks/solana/pools/multi/' || array_to_string(v_pairs, ','));
    if v_resp.status = 200 then
      select coalesce(jsonb_object_agg(d->'attributes'->>'address', d->'attributes'->'transactions'), '{}'::jsonb)
        into v_gmap
        from jsonb_array_elements(coalesce((v_resp.content::jsonb)->'data', '[]'::jsonb)) d;
    else
      v_gerr := 'HTTP ' || v_resp.status;
    end if;
  exception when others then
    v_gerr := left(sqlerrm, 120);
  end;

  for c in
    select p.mint, min(p.opened_at) as opened_at, max(p.pair_address) as pair
    from public.desk_positions p
    where p.opened_at > now() - interval '20 minutes'
      and not exists (select 1 from public.desk_entry_extra e where e.mint = p.mint)
    group by p.mint order by min(p.opened_at) limit 4
  loop
    v_data := jsonb_build_object('lag_s', round(extract(epoch from now() - c.opened_at)));

    if v_gerr is not null then
      v_data := v_data || jsonb_build_object('gecko_error', v_gerr);
    elsif c.pair is not null and v_gmap ? c.pair then
      v_data := v_data || jsonb_build_object('gecko', jsonb_build_object(
        'm5', v_gmap->c.pair->'m5', 'm15', v_gmap->c.pair->'m15', 'h1', v_gmap->c.pair->'h1'));
    end if;

    -- DexScreener: ordini pagati (profilo, pubblicità, community takeover) e boost
    begin
      v_resp := extensions.http_get('https://api.dexscreener.com/orders/v1/solana/' || c.mint);
      if v_resp.status = 200 then
        v_body := v_resp.content::jsonb;
        v_data := v_data || jsonb_build_object('paid', jsonb_build_object(
          'orders', (select coalesce(jsonb_agg(jsonb_build_object('type', o->>'type', 'status', o->>'status', 'ts', o->'paymentTimestamp')), '[]'::jsonb)
                       from jsonb_array_elements(case when jsonb_typeof(v_body->'orders') = 'array' then v_body->'orders' else '[]'::jsonb end) o),
          'boost_amount', (select coalesce(sum((b->>'amount')::numeric), 0)
                             from jsonb_array_elements(case when jsonb_typeof(v_body->'boosts') = 'array' then v_body->'boosts' else '[]'::jsonb end) b)));
      else
        v_data := v_data || jsonb_build_object('paid_error', 'HTTP ' || v_resp.status);
      end if;
    exception when others then
      v_data := v_data || jsonb_build_object('paid_error', left(sqlerrm, 120));
    end;

    -- RugCheck: origine (launchpad) e reti di insider
    begin
      v_resp := extensions.http_get('https://api.rugcheck.xyz/v1/tokens/' || c.mint || '/report');
      if v_resp.status = 200 then
        v_body := v_resp.content::jsonb;
        v_data := v_data || jsonb_build_object('rug', jsonb_build_object(
          'launchpad', v_body->'launchpad'->>'platform',
          'graph_insiders', v_body->'graphInsidersDetected',
          'networks', (select count(*) from jsonb_array_elements(case when jsonb_typeof(v_body->'insiderNetworks') = 'array' then v_body->'insiderNetworks' else '[]'::jsonb end)),
          'insider_pct', (select round(100 * coalesce(sum((n->>'currentHolding')::numeric), 0) / nullif((v_body->'token'->>'supply')::numeric, 0), 2)
                            from jsonb_array_elements(case when jsonb_typeof(v_body->'insiderNetworks') = 'array' then v_body->'insiderNetworks' else '[]'::jsonb end) n)));
      else
        v_data := v_data || jsonb_build_object('rug_error', 'HTTP ' || v_resp.status);
      end if;
    exception when others then
      v_data := v_data || jsonb_build_object('rug_error', left(sqlerrm, 120));
    end;

    insert into public.desk_entry_extra (mint, first_opened_at, data)
    values (c.mint, c.opened_at, v_data)
    on conflict (mint) do nothing;
    v_done := v_done + 1;
  end loop;

  return jsonb_build_object('ok', true, 'recorded', v_done, 'gecko_error', v_gerr);
end;
$function$
