CREATE OR REPLACE FUNCTION public.desk_guard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s record;
  v_halted int := 0;
begin
  for s in
    select id, equity, params from public.desk_strategies
    where (params->'guard'->>'halt_equity') is not null
      and not coalesce((params->'guard'->>'halted')::boolean, false)
  loop
    if s.equity <= (s.params->'guard'->>'halt_equity')::numeric then
      update public.desk_strategies
         set params = jsonb_set(jsonb_set(params, '{guard,halted}', 'true'::jsonb), '{sizing,pct_of_equity}', '0'::jsonb),
             updated_at = now()
       where id = s.id;
      insert into public.desk_decisions (strategy_id, agent, action, reason_code, reason, data)
      values (s.id, 'RISK', 'skip', 'HALTED',
              'interruttore: capitale sceso a ' || round(s.equity, 2) || ' $, nuovi acquisti fermati',
              jsonb_build_object('equity', s.equity, 'halt_equity', s.params->'guard'->'halt_equity'));
      v_halted := v_halted + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'halted', v_halted);
end;
$function$
