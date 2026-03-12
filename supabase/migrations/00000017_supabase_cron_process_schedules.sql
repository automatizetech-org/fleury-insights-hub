create extension if not exists pg_cron;
create extension if not exists pgcrypto;

alter table public.schedule_rules
  add column if not exists execution_mode text not null default 'sequential';

alter table public.execution_requests
  add column if not exists execution_mode text not null default 'sequential',
  add column if not exists execution_group_id uuid null,
  add column if not exists execution_order integer null;

update public.execution_requests
set execution_order = 0
where execution_order is null;

create or replace function public.process_schedules_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_now_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_rule public.schedule_rules%rowtype;
  v_robot public.robots%rowtype;
  v_next_run_at timestamptz;
  v_next_run_local timestamp;
  v_execution_group_id uuid;
  v_execution_order integer := 0;
  v_robot_ids text[];
  v_robot_technical_id text;
  v_period_start date;
  v_period_end date;
  v_yesterday date := ((now() at time zone 'America/Sao_Paulo')::date - interval '1 day')::date;
begin
  for v_rule in
    select *
    from public.schedule_rules
    where status = 'active'
      and run_daily = true
    order by created_at
  loop
    v_next_run_local := case
      when v_rule.last_run_at is not null then ((v_rule.last_run_at at time zone 'America/Sao_Paulo')::date + interval '1 day') + v_rule.run_at_time::time
      when v_rule.run_at_date is not null then (v_rule.run_at_date::date + v_rule.run_at_time::time)
      else null
    end;

    if v_next_run_local is null then
      continue;
    end if;

    v_next_run_at := v_next_run_local at time zone 'America/Sao_Paulo';

    if v_now_local < v_next_run_local then
      continue;
    end if;

    if exists (
      select 1
      from public.execution_requests er
      where er.schedule_rule_id = v_rule.id
        and er.status in ('pending', 'running')
    ) then
      continue;
    end if;

    if coalesce(array_length(v_rule.robot_technical_ids, 1), 0) = 0
       or 'all' = any(v_rule.robot_technical_ids) then
      select array_agg(r.technical_id order by r.display_name, r.technical_id)
        into v_robot_ids
      from public.robots r;
    else
      v_robot_ids := v_rule.robot_technical_ids;
    end if;

    if coalesce(array_length(v_robot_ids, 1), 0) = 0 then
      update public.schedule_rules
      set last_run_at = v_now,
          updated_at = v_now
      where id = v_rule.id;
      continue;
    end if;

    v_execution_group_id := gen_random_uuid();

    v_execution_order := 0;

    foreach v_robot_technical_id in array v_robot_ids loop
      select *
        into v_robot
      from public.robots r
      where r.technical_id = v_robot_technical_id
      limit 1;

      if not found then
        continue;
      end if;

      if v_robot.date_execution_mode = 'competencia' then
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
      elsif (
        coalesce(v_robot.is_fiscal_notes_robot, false) = true
        or v_robot.fiscal_notes_kind is not null
        or v_robot.notes_mode is not null
        or upper(coalesce(v_robot.segment_path, '')) like '%FISCAL/NFS%'
        or upper(coalesce(v_robot.segment_path, '')) like '%FISCAL/NFE%'
        or upper(coalesce(v_robot.segment_path, '')) like '%FISCAL/NFC%'
      ) and v_robot.date_execution_mode = 'interval' then
        v_period_start := v_yesterday;
        v_period_end := v_yesterday;
      elsif v_robot.date_execution_mode = 'interval' and v_robot.last_period_end is not null then
        v_period_start := v_yesterday;
        v_period_end := v_yesterday;
      elsif v_robot.date_execution_mode = 'interval'
            and v_robot.initial_period_start is not null
            and v_robot.initial_period_end is not null then
        v_period_start := v_robot.initial_period_start;
        v_period_end := v_robot.initial_period_end;
      else
        v_period_start := v_yesterday;
        v_period_end := v_yesterday;
      end if;

      insert into public.execution_requests (
        company_ids,
        robot_technical_ids,
        status,
        period_start,
        period_end,
        notes_mode,
        schedule_rule_id,
        execution_mode,
        execution_group_id,
        execution_order,
        created_by
      ) values (
        v_rule.company_ids,
        array[v_robot.technical_id],
        'pending',
        v_period_start,
        v_period_end,
        coalesce(v_rule.notes_mode, v_robot.notes_mode),
        v_rule.id,
        coalesce(v_rule.execution_mode, 'sequential'),
        v_execution_group_id,
        v_execution_order,
        v_rule.created_by
      );

      v_execution_order := v_execution_order + 1;

      delete from public.execution_requests
      where status = 'pending'
        and id <> (
          select er.id
          from public.execution_requests er
          where er.status = 'pending'
            and er.robot_technical_ids @> array[v_robot.technical_id]
          order by er.created_at desc
          limit 1
        )
        and robot_technical_ids @> array[v_robot.technical_id];
    end loop;

    update public.schedule_rules
    set last_run_at = v_next_run_at,
        updated_at = v_now
    where id = v_rule.id;
  end loop;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'process_schedules'
  order by jobid desc
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
exception
  when undefined_table then
    null;
end
$$;

select cron.schedule(
  'process_schedules',
  '* * * * *',
  $$select public.process_schedules_cron();$$
);
