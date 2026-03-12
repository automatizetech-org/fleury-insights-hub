create extension if not exists pgcrypto;

alter table public.schedule_rules
  add column if not exists execution_mode text not null default 'sequential';

alter table public.execution_requests
  add column if not exists execution_mode text not null default 'sequential',
  add column if not exists execution_group_id uuid null,
  add column if not exists execution_order integer null;

update public.schedule_rules
set execution_mode = 'sequential'
where execution_mode is null;

update public.execution_requests
set execution_mode = 'sequential'
where execution_mode is null;

update public.execution_requests
set execution_order = 0
where execution_order is null;
