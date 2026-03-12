begin;

-- Tabela flexível para armazenar métricas de automações por empresa.
-- Usada pelos robôs fiscais (ex.: Sefaz Xml) para salvar dados diários e consolidados em JSON.

create table if not exists public.automation_data (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  automation_id text not null,
  date date not null,

  -- Contadores genéricos (o robô mapeia para xml/nf/nfc etc.)
  count_1 bigint null,
  count_2 bigint null,
  count_3 bigint null,

  -- Valores genéricos (ex.: total_amount)
  amount_1 numeric null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Evita duplicar registros diários para mesma empresa/automação/data
create unique index if not exists automation_data_company_automation_date_uidx
  on public.automation_data(company_id, automation_id, date);

commit;

