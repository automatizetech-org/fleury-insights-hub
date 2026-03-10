# Agendador no Supabase (pg_cron)

O agendamento diário dos robôs roda **dentro do Supabase**, sem cron externo (cron-job.org) e sem depender do server-api.

## Como funciona

1. **pg_cron** executa a cada **1 minuto** o job `process_schedules`.
2. O job chama **`public.process_schedules_cron()`**, que **apenas verifica** se alguma regra atingiu a "próxima execução":
   - **Próxima execução** = primeira vez: `run_at_date` + `run_at_time`; depois: `last_run_at` + 24h.
   - Se **agora < próxima execução** → não faz nada.
   - Se **agora >= próxima execução** e não há `execution_requests` pending/running dessa regra → cria os `execution_requests` (um por robô) e atualiza `last_run_at` na regra (próxima execução = daqui a 24h).
3. **Sem agendamento ativo** (nenhuma regra com `status = 'active'` e `run_daily = true`) → o cron não cria nenhum request.
4. Os **robôs** fazem poll na fila; só reivindicam jobs de regras ainda ativas (ou jobs manuais sem `schedule_rule_id`).

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
