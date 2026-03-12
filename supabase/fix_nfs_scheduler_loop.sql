-- Corrige loop do agendador NFS e limpa backlog antigo.
-- Execute no SQL Editor do Supabase.

begin;

-- 1) Remove requests pendentes e em execucao do robo NFS.
delete from public.execution_requests
where robot_technical_ids @> array['nfs_padrao']::text[]
  and status in ('pending', 'running');

-- 2) Forca a regra ativa do NFS a esperar 24h a partir de agora.
update public.schedule_rules
set
  last_run_at = now(),
  updated_at = now()
where status = 'active'
  and run_daily = true
  and robot_technical_ids @> array['nfs_padrao']::text[];

commit;

-- Verificacao:
select
  id,
  robot_technical_ids,
  run_daily,
  status,
  run_at_date,
  run_at_time,
  last_run_at,
  (last_run_at + interval '24 hours') as next_expected_run_at
from public.schedule_rules
where robot_technical_ids @> array['nfs_padrao']::text[];
