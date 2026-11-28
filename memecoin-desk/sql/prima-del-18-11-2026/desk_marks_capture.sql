CREATE OR REPLACE FUNCTION public.desk_marks_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.desk_marks (position_id, strategy_id, ts, price, liq, value_usd, status)
    values (new.id, new.strategy_id, coalesce(new.opened_at, now()), new.entry_mid, new.entry_liq_usd, new.last_value_usd, 'open');
  elsif new.status = 'closed' and old.status = 'open' then
    insert into public.desk_marks (position_id, strategy_id, ts, price, liq, value_usd, status)
    values (new.id, new.strategy_id, coalesce(new.closed_at, now()), new.exit_mid, new.last_liq_usd, new.proceeds_usd, 'closed');
  elsif new.status = 'open'
        and new.last_mark_at is distinct from old.last_mark_at
        and (new.last_price is distinct from old.last_price or new.last_liq_usd is distinct from old.last_liq_usd) then
    insert into public.desk_marks (position_id, strategy_id, ts, price, liq, value_usd, status)
    values (new.id, new.strategy_id, new.last_mark_at, new.last_price, new.last_liq_usd, new.last_value_usd, 'open');
  end if;
  return null;
end;
$function$
