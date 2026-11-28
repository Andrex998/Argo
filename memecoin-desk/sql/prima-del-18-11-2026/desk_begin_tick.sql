CREATE OR REPLACE FUNCTION public.desk_begin_tick(p_secret text, p_limit integer DEFAULT 120)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  st public.desk_state;
  res jsonb;
begin
  select * into st from public.desk_state where id = 1 for update;
  if st.secret is distinct from p_secret then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if st.paused then
    return jsonb_build_object('ok', false, 'reason', 'paused');
  end if;
  if st.tick_started_at is not null
     and st.tick_started_at > now() - interval '45 seconds'
     and (st.tick_finished_at is null or st.tick_finished_at < st.tick_started_at) then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  update public.desk_state set tick_started_at = now() where id = 1;

  update public.desk_sources set state = 'closed' where state = 'open' and open_until <= now();

  select jsonb_build_object(
    'ok', true,
    'now', now(),
    'strategies', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.desk_strategies s),
    'positions',  (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.desk_positions p where p.status = 'open'),
    'sources',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.desk_sources x),
    'due', (
      select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from (
        select t.mint, t.symbol, t.first_seen, t.pair_created_at, t.sec, t.sec_at,
               t.missing_count, t.eval_count,
               (select coalesce(jsonb_object_agg(v.strategy_id,
                         jsonb_build_object('verdict', v.verdict, 'reason_code', v.reason_code, 'final', v.final)), '{}'::jsonb)
                  from public.desk_verdicts v where v.mint = t.mint) as verdicts
        from public.desk_tokens t
        where t.status = 'active' and t.next_eval_at <= now()
        order by t.next_eval_at
        limit p_limit
      ) d)
  ) into res;
  return res;
end;
$function$
