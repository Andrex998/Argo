CREATE OR REPLACE FUNCTION public.desk_scout_gecko()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  u record;
  v_resp extensions.http_response;
  v_body jsonb;
  v_n int;
  v_new int := 0;
  v_calls int := 0;
  v_err text := null;
begin
  if (select paused from public.desk_state where id = 1) then
    return jsonb_build_object('ok', false, 'reason', 'paused');
  end if;

  insert into public.desk_sources (id) values ('geckoterminal') on conflict (id) do nothing;
  update public.desk_sources set state = 'closed'
   where id = 'geckoterminal' and state = 'open' and open_until <= now();
  if (select state from public.desk_sources where id = 'geckoterminal') = 'open' then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');

  for u in
    select * from (values
      ('geckoterminal:new',      '/new_pools?page=1',                   5000::numeric),
      ('geckoterminal:trending', '/trending_pools?page=1&duration=1h',  0::numeric)
    ) t(source, path, min_reserve)
  loop
    v_calls := v_calls + 1;
    begin
      v_resp := extensions.http_get('https://api.geckoterminal.com/api/v2/networks/solana' || u.path);
      if v_resp.status <> 200 then
        v_err := 'HTTP ' || v_resp.status;
        continue;
      end if;
      v_body := v_resp.content::jsonb;

      with pools as (
        select d
        from jsonb_array_elements(coalesce(v_body->'data', '[]'::jsonb)) d
        where (d->'attributes'->>'pool_created_at')::timestamptz > now() - interval '72 hours'
          and coalesce((d->'attributes'->>'reserve_in_usd')::numeric, 0) >= u.min_reserve
      ), cand as (
        select distinct (
          select m
          from unnest(array[
                 replace(d->'relationships'->'base_token'->'data'->>'id', 'solana_', ''),
                 replace(d->'relationships'->'quote_token'->'data'->>'id', 'solana_', '')
               ]) with ordinality as x(m, ord)
          where m is not null
            and m not in ('So11111111111111111111111111111111111111112',
                          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
          order by ord limit 1
        ) as mint
        from pools
      ), ins as (
        insert into public.desk_tokens (mint, source)
        select mint, u.source from cand
        where mint is not null and length(mint) between 32 and 44
        on conflict (mint) do nothing
        returning mint, source
      ), lg as (
        insert into public.desk_decisions (agent, action, mint, reason_code, reason, data)
        select 'SCOUT', 'seen', mint, 'NEW', 'nuovo token da ' || source, jsonb_build_object('src', source)
        from ins
        returning 1
      )
      select count(*) into v_n from lg;
      v_new := v_new + v_n;
    exception when others then
      v_err := left(sqlerrm, 160);
    end;
  end loop;

  if v_err is null then
    update public.desk_sources
       set fail_count = 0, last_ok_at = now(), calls = calls + v_calls
     where id = 'geckoterminal';
  else
    update public.desk_sources
       set fail_count = fail_count + 1, calls = calls + v_calls, errors = errors + 1,
           last_error = v_err, last_error_at = now(),
           state = case when fail_count + 1 >= 3 then 'open' else state end,
           open_until = case when fail_count + 1 >= 3 then now() + interval '5 minutes' else open_until end
     where id = 'geckoterminal';
  end if;

  return jsonb_build_object('ok', v_err is null, 'new_tokens', v_new, 'calls', v_calls, 'error', v_err);
end;
$function$
