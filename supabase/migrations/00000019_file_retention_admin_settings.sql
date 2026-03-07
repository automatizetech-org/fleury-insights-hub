-- =============================================================================
-- Retenção de arquivos (admin):
-- - last_downloaded_at em fiscal_documents para saber até quando guardar.
-- - admin_settings para guardar "guardar por quantos dias" (30, 60, 90, 120 ou 0 = nunca).
-- - Apenas super_admin pode ver/editar admin_settings e rodar a exclusão.
-- =============================================================================

-- 1) Coluna de data do último download (para retenção)
alter table public.fiscal_documents
  add column if not exists last_downloaded_at timestamptz null;

comment on column public.fiscal_documents.last_downloaded_at is 'Data do último download; usado para retenção (excluir após N dias).';

-- 2) Tabela de configurações do admin (só super_admin)
create table if not exists public.admin_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

-- Só super_admin pode ler e atualizar
create policy "admin_settings_select" on public.admin_settings
  for select using (public.is_super_admin());

create policy "admin_settings_update" on public.admin_settings
  for update using (public.is_super_admin());

create policy "admin_settings_insert" on public.admin_settings
  for insert with check (public.is_super_admin());

-- Valor padrão: guardar por 60 dias (0 = nunca excluir)
insert into public.admin_settings (key, value)
values ('file_retention_days', '60')
on conflict (key) do nothing;

comment on table public.admin_settings is 'Configurações do painel admin (ex.: retenção de arquivos). Apenas super_admin.';
