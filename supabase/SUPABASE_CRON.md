# Agendador no Supabase (pg_cron)

O agendamento diário dos robôs roda **dentro do Supabase**, sem cron externo (cron-job.org) e sem depender do server-api.

## Como funciona

1. **pg_cron** (extensão no Postgres) executa a cada **1 minuto** o job `process_schedules`.
2. O job chama a função **`public.process_schedules_cron()`**, que:
   - Busca regras em `schedule_rules` com `status = 'active'`, `run_daily = true`, período vigente e horário já passado hoje.
   - Para cada regra, insere uma linha em **`execution_requests`** (com `schedule_rule_id`) e atualiza **`last_run_at`** na regra.
3. Os **robôs** (NFS etc.) fazem poll na fila `execution_requests`, dão claim no job e executam. Ao terminar, fica **Aguardando** até o próximo dia.

## O que você precisa fazer

1. **Habilitar pg_cron** no projeto Supabase (se ainda não estiver):
   - Dashboard → **Database** → **Extensions** → procure **pg_cron** → Enable.

2. **Aplicar a migration** que cria a função e o job:
   - `supabase/migrations/00000017_supabase_cron_process_schedules.sql`
   - No CLI: `supabase db push` ou aplique o SQL pelo Editor SQL no Dashboard.

3. **Nada no server-api** — não é mais necessário CRON_SECRET nem endpoint de cron. O dashboard continua criando/atualizando `schedule_rules` e disparando execução manual (insert em `execution_requests`); o que roda sozinho no horário é o pg_cron.

## Status no painel

- **Executando agora**: há `execution_requests` com `status = 'running'` para a regra ativa (robôs processando).
- **Aguardando**: rotina diária ativa; naquele dia já rodou (ou ainda não deu o horário) — no dia seguinte o pg_cron dispara de novo.
