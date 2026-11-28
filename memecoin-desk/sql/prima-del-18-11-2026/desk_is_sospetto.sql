CREATE OR REPLACE FUNCTION public.desk_is_sospetto(m jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with v as (
    select
      case when m->>'liq' ~ '^[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' then (m->>'liq')::numeric end as liq,
      case when m->>'vol_h1' ~ '^[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' then (m->>'vol_h1')::numeric end as vol,
      case when m->>'mcap' ~ '^[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' then (m->>'mcap')::numeric end as mcap
  )
  select liq is null or liq <= 0 or vol is null or vol < 0.1 * liq or (mcap > 0 and liq >= 0.95 * mcap)
  from v
$function$
