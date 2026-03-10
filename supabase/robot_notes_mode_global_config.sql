-- Ajuste incremental para separar robos fiscais de robos nao fiscais
-- e distinguir NFS de NFE/NFC no editor global e no scheduler.

alter table public.robots
  add column if not exists is_fiscal_notes_robot boolean not null default false;

alter table public.robots
  add column if not exists fiscal_notes_kind text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'robots_fiscal_notes_kind_check'
  ) then
    alter table public.robots
      add constraint robots_fiscal_notes_kind_check
      check (fiscal_notes_kind is null or fiscal_notes_kind in ('nfs', 'nfe_nfc'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'robots_notes_mode_check'
  ) then
    alter table public.robots
      add constraint robots_notes_mode_check
      check (
        notes_mode is null
        or notes_mode in ('recebidas', 'emitidas', 'both', 'modelo_55', 'modelo_65', 'modelos_55_65')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_requests_notes_mode_check'
  ) then
    alter table public.execution_requests
      add constraint execution_requests_notes_mode_check
      check (
        notes_mode is null
        or notes_mode in ('recebidas', 'emitidas', 'both', 'modelo_55', 'modelo_65', 'modelos_55_65')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_rules_notes_mode_check'
  ) then
    alter table public.schedule_rules
      add constraint schedule_rules_notes_mode_check
      check (
        notes_mode is null
        or notes_mode in ('recebidas', 'emitidas', 'both', 'modelo_55', 'modelo_65', 'modelos_55_65')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'robot_display_config_notes_mode_check'
  ) then
    alter table public.robot_display_config
      add constraint robot_display_config_notes_mode_check
      check (
        notes_mode is null
        or notes_mode in ('recebidas', 'emitidas', 'both', 'modelo_55', 'modelo_65', 'modelos_55_65')
      );
  end if;
end $$;

update public.robots
set
  is_fiscal_notes_robot = case when notes_mode is not null then true else is_fiscal_notes_robot end,
  fiscal_notes_kind = case
    when notes_mode in ('recebidas', 'emitidas', 'both') then coalesce(fiscal_notes_kind, 'nfs')
    when notes_mode in ('modelo_55', 'modelo_65', 'modelos_55_65') then coalesce(fiscal_notes_kind, 'nfe_nfc')
    else fiscal_notes_kind
  end
where notes_mode is not null;
