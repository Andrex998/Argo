-- 18/11/2026: FILTRO v2. Due bracci nuovi con i filtri dell'analisi del 18/11 (stesso schema di inserimento
-- usato dal consiglio del 17/11), e stop ai nuovi acquisti di piccoli, corto e corto_largo.
-- Le posizioni aperte dei bracci fermati continuano a essere gestite dalle loro uscite. Nulla viene cancellato.
insert into public.desk_strategies (id, name, description, params, starting_cash, cash, equity)
values
('filtro', 'FILTRO v2',
 'Nata dall''analisi del 18/11/2026 su 243 token. Compra solo token tra 1 e 72 ore di vita, con liquidità di almeno 5 mila $, LP bloccata almeno al 50% e top 10 wallet tra il 15% e il 40% della supply. Scarta i token con dati di mercato non credibili, quelli in cui nell''ultima ora gli acquisti sono il 90% o più delle transazioni (possibile honeypot) e quelli con punteggio fuori dalla fascia 65-85. 2% del capitale per trade, stop -60%, take profit +120%, uscita a tempo dopo 24 ore, costi simulati 0,5% per lato più 0,02 $. Prova di 2 settimane avviata il 18/11/2026: il verdetto si dà solo dopo almeno 200 token distinti comprati.',
 '{"costs": {"fee_pct_per_side": 0.5, "fixed_usd_per_tx": 0.02},
   "exits": {"stop_pct": 60, "take_profit_pct": 120, "max_hold_h": 24},
   "sizing": {"pct_of_equity": 2},
   "window": {"min_age_min": 60, "max_age_h": 72},
   "filter": {"min_liq": 5000, "gate_lp_min_pct": 50, "gate_top10_max_pct": 40, "data_sanity": true, "min_top10_pct": 15, "max_buy_share_pct": 90},
   "analyst": {"mode": "argo56", "min_score": 65, "max_score": 85}}'::jsonb,
 1000, 1000, 1000),
('filtro_piccoli', 'FILTRO v2 piccoli',
 'Come FILTRO v2, ma solo token con market cap fino a 30 mila $ e meno di 3 ore di vita. È un''ipotesi trovata a posteriori nell''analisi del 18/11/2026 (84 token, nessun rug, +4,1% medio prima dei costi), non un risultato. Avviata il 18/11/2026: si giudica solo dopo 2 settimane e almeno 200 token distinti comprati.',
 '{"costs": {"fee_pct_per_side": 0.5, "fixed_usd_per_tx": 0.02},
   "exits": {"stop_pct": 60, "take_profit_pct": 120, "max_hold_h": 24},
   "sizing": {"pct_of_equity": 2},
   "window": {"min_age_min": 60, "max_age_h": 3, "max_mcap": 30000},
   "filter": {"min_liq": 5000, "gate_lp_min_pct": 50, "gate_top10_max_pct": 40, "data_sanity": true, "min_top10_pct": 15, "max_buy_share_pct": 90},
   "analyst": {"mode": "argo56", "min_score": 65, "max_score": 85}}'::jsonb,
 1000, 1000, 1000)
on conflict (id) do nothing;

-- Stop ai nuovi acquisti come per argo, controllo e corto_15s il 17/11 (e come fa desk_guard):
-- guard.halted + motivo, e quota per trade a 0 così il tick non continua a proporre acquisti che il commit scarterebbe.
-- Quote originali per un eventuale ripristino: piccoli 2, corto 1, corto_largo 1.
update public.desk_strategies set
  params = jsonb_set(jsonb_set(params, '{sizing,pct_of_equity}', '0'),
                     '{guard}', coalesce(params->'guard', '{}'::jsonb) || '{"halted": true, "reason": "sostituita da FILTRO v2 il 18/11/2026"}'::jsonb),
  updated_at = now()
where id in ('piccoli', 'corto', 'corto_largo')
  and not coalesce((params->'guard'->>'halted')::boolean, false);
