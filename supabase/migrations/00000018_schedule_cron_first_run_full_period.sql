-- =============================================================================
-- Ajuste da lógica do agendador:
-- - Primeira execução (last_run_at é null): usa o período completo da regra
--   (period_start até period_end) — ex.: 01/03 a 06/03.
-- - Execuções diárias seguintes: roda só o dia anterior (ontem).
-- =============================================================================

create or replace function public.process_schedules_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := 'America/Sao_Paulo';
  today date := (current_timestamp at time zone tz)::date;
  now_time time := (current_timestamp at time zone tz)::time;
  yesterday date := today - interval '1 day';
  r record;
  period_start_exec date;
  period_end_exec date;
begin
  for r in
    select id, company_ids, robot_technical_ids, notes_mode, period_start, period_end, last_run_at
    from public.schedule_rules
    where status = 'active'
      and run_daily = true
      and (last_run_at is null or last_run_at::date < today)
      and run_at_time <= now_time
  loop
    -- Primeira execução: período completo (data inicial a data final da regra).
    -- Execuções seguintes: só o dia anterior.
    if r.last_run_at is null then
      period_start_exec := r.period_start::date;
      period_end_exec := r.period_end::date;
    else
      period_start_exec := yesterday;
      period_end_exec := yesterday;
    end if;

    insert into public.execution_requests (
      company_ids,
      robot_technical_ids,
      period_start,
      period_end,
      notes_mode,
      status,
      schedule_rule_id
    )
    values (
      r.company_ids,
      r.robot_technical_ids,
      period_start_exec,
      period_end_exec,
      r.notes_mode,
      'pending',
      r.id
    );

    update public.schedule_rules
    set last_run_at = today
    where id = r.id;
  end loop;
end;
$$;

comment on function public.process_schedules_cron() is 'Cron: primeira execução usa período completo (period_start a period_end); nas seguintes roda só o dia anterior.';
