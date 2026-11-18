CREATE OR REPLACE FUNCTION public.desk_positions_track_trough()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.trough_price := least(new.entry_mid, new.last_price);
    new.trough_from := coalesce(new.opened_at, now());
  else
    -- least() ignora i null: un prezzo mancante non abbassa né alza il minimo
    new.trough_price := least(coalesce(old.trough_price, new.entry_mid), new.last_price, new.exit_mid);
    new.trough_from := coalesce(old.trough_from, now());
  end if;
  return new;
end;
$function$
