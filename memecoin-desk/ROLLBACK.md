# Rollback for the 18/11/2026 FILTRO v2 changes (project kahquskcjnkmdnrboqww)

Each step is independent; do only what is needed. Recommended order: 1, 2, 3.

1. Halts and new arms
   - Undo the halts: run the lines for piccoli, corto and corto_largo from strategie/rollback_params_exact.sql
     (exact params as of ~01:10 UTC 18/11, before the change).
   - Stop the new arms without deleting anything (their rows are referenced by verdicts/decisions/equity):
       update public.desk_strategies
          set params = jsonb_set(jsonb_set(params, '{sizing,pct_of_equity}', '0'),
                                 '{guard}', coalesce(params->'guard','{}'::jsonb) || '{"halted": true, "reason": "rollback"}'::jsonb),
              updated_at = now()
        where id in ('filtro', 'filtro_piccoli');

2. Edge function argo-desk
   deploy_edge_function name=argo-desk, entrypoint_path=index.ts, verify_jwt=false, no import map,
   files = edge-function/v1/index.ts + edge-function/v1/logic.ts (the version-1 source).
   Version 1 ignores filter.min_top10_pct, filter.max_buy_share_pct and analyst.max_score, so halt
   filtro / filtro_piccoli first (step 1) or they would buy without those filters.

3. SQL functions desk_commit_tick and desk_fast_exits
   Apply sql/prima-del-18-11-2026/desk_commit_tick.sql and sql/prima-del-18-11-2026/desk_fast_exits.sql (pre-change definitions, md5-verified
   against the database before the change; listed in sql/prima-del-18-11-2026/expected.md5).
   The same definitions are also stored in the database:
     select name, saved_at, def from analisi.fn_backup
      where name in ('desk_commit_tick', 'desk_fast_exits') and saved_at > '2026-11-18';
