-- =============================================================================
-- Agendador dentro do Supabase: pg_cron roda a cada minuto e cria
-- execution_requests para regras ativas cujo horário já passou hoje.
-- Não depende mais de cron externo (cron-job.org) nem do server-api.
--
-- Se "create extension pg_cron" falhar, ative a extensão em:
-- Dashboard → Database → Extensions → pg_cron → Enable.
-- =============================================================================

-- 1) Habilitar pg_cron (no Supabase pode precisar ser ativado no Dashboard → Database → Extensions)
create extension if not exists pg_cron with schema pg_catalog;

-- 2) Função que processa regras de agendamento (mesma lógica do server-api)
-- Roda com SECURITY DEFINER para poder inserir em execution_requests (RLS).
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
  period_run date := today - interval '1 day';
  r record;
begin
  for r in
    select id, company_ids, robot_technical_ids, notes_mode
    from public.schedule_rules
    where status = 'active'
      and run_daily = true
      and period_start <= today
      and period_end >= today
      and (last_run_at is null or last_run_at < today)
      and run_at_time <= now_time
  loop
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
      period_run,
      period_run,
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

comment on function public.process_schedules_cron() is 'Chamada pelo pg_cron a cada minuto: cria execution_requests para regras ativas cujo horário já passou hoje e atualiza last_run_at.';

-- 3) Agendar execução a cada minuto (só cria o job se ainda não existir)
-- Assim, ao reexecutar o script (ex.: para atualizar a função), o job não é recriado e o id não aumenta.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'process_schedules') then
    perform cron.schedule(
      'process_schedules',
      '* * * * *',
      $cmd$select public.process_schedules_cron()$cmd$
    );
  end if;
end;
$$;
