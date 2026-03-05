-- =============================================================================
-- FLEURY INSIGHTS HUB — Migration única: schema completo para o app rodar
-- =============================================================================
-- Execute uma vez (Supabase aplica ao rodar migrations ou db reset).
-- Cria: profiles (panel_access), companies (active), company_memberships,
-- tabelas de negócio, RLS, triggers (owner em company, perfil→todas empresas,
-- empresa nova→todos usuários), handle_new_user.
-- =============================================================================

-- 1) Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2) Tabela profiles (id = auth.users.id)
drop table if exists public.company_memberships cascade;
drop table if exists public.company_users cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('super_admin', 'user')),
  panel_access jsonb not null default '{"dashboard":true,"fiscal":true,"dp":true,"financeiro":true,"operacoes":true,"documentos":true,"empresas":true,"sync":true}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_profiles_username on public.profiles(username);
create index idx_profiles_role on public.profiles(role);

-- 3) Tabela companies
drop table if exists public.documents cascade;
drop table if exists public.sync_events cascade;
drop table if exists public.financial_records cascade;
drop table if exists public.dp_guias cascade;
drop table if exists public.dp_checklist cascade;
drop table if exists public.fiscal_pendencias cascade;
drop table if exists public.fiscal_documents cascade;
drop table if exists public.companies cascade;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_companies_created_by on public.companies(created_by);

-- 4) Tabela company_memberships
create table public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index idx_company_memberships_user_id on public.company_memberships(user_id);
create index idx_company_memberships_company_id on public.company_memberships(company_id);

-- 5) Trigger: ao inserir company, owner para created_by e todos os demais como member
create or replace function public.on_company_created_add_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.company_memberships (company_id, user_id, member_role)
    values (new.id, new.created_by, 'owner')
    on conflict (company_id, user_id) do nothing;
  end if;
  insert into public.company_memberships (company_id, user_id, member_role)
  select new.id, p.id, 'member' from public.profiles p
  where p.id is distinct from new.created_by
  on conflict (company_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_company_add_owner on public.companies;
create trigger trg_company_add_owner
  after insert on public.companies
  for each row execute function public.on_company_created_add_owner();

-- 5b) Trigger: novo perfil → membro de todas as empresas
create or replace function public.on_profile_created_add_to_all_companies()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_memberships (company_id, user_id, member_role)
  select id, new.id, 'member' from public.companies
  on conflict (company_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profile_add_to_all_companies on public.profiles;
create trigger trg_profile_add_to_all_companies
  after insert on public.profiles
  for each row execute function public.on_profile_created_add_to_all_companies();

-- 6) Função RLS: company_ids do usuário
create or replace function public.user_company_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_memberships where user_id = auth.uid();
$$;

-- 7) Função: é super_admin?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

-- 8) RLS em profiles, companies, company_memberships
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_super_admin());

drop policy if exists "companies_insert_authenticated" on public.companies;
create policy "companies_insert_authenticated" on public.companies
  for insert with check (auth.uid() is not null);

drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies
  for select using (auth.uid() is not null);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update using (id in (select public.user_company_ids()) or public.is_super_admin());

drop policy if exists "companies_delete" on public.companies;
create policy "companies_delete" on public.companies
  for delete using (id in (select public.user_company_ids()) or public.is_super_admin());

drop policy if exists "company_memberships_select" on public.company_memberships;
create policy "company_memberships_select" on public.company_memberships
  for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());

drop policy if exists "company_memberships_insert" on public.company_memberships;
create policy "company_memberships_insert" on public.company_memberships
  for insert with check (
    public.is_super_admin()
    or exists (
      select 1 from public.company_memberships cm
      where cm.company_id = company_id and cm.user_id = auth.uid() and cm.member_role = 'owner'
    )
  );

drop policy if exists "company_memberships_update" on public.company_memberships;
create policy "company_memberships_update" on public.company_memberships
  for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());

drop policy if exists "company_memberships_delete" on public.company_memberships;
create policy "company_memberships_delete" on public.company_memberships
  for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());

-- 9) Tabelas de negócio (multi-tenant com company_id)
drop type if exists document_status cascade;
create type document_status as enum ('novo', 'processando', 'validado', 'pendente', 'divergente');
drop type if exists sync_event_status cascade;
create type sync_event_status as enum ('sucesso', 'erro');

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('NFS', 'NFE', 'NFC')),
  chave text,
  periodo text not null,
  status document_status not null default 'novo',
  document_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fiscal_documents_company on public.fiscal_documents(company_id);

create table public.fiscal_pendencias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tipo text not null check (tipo in ('NFS', 'NFE', 'NFC')),
  periodo text not null,
  status document_status not null,
  created_at timestamptz not null default now()
);
create index idx_fiscal_pendencias_company on public.fiscal_pendencias(company_id);

create table public.dp_checklist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tarefa text not null,
  competencia text not null,
  status document_status not null default 'pendente',
  created_at timestamptz not null default now()
);
create index idx_dp_checklist_company on public.dp_checklist(company_id);

create table public.dp_guias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  nome text not null,
  tipo text not null default 'PDF',
  data date not null,
  file_path text,
  created_at timestamptz not null default now()
);
create index idx_dp_guias_company on public.dp_guias(company_id);

create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  periodo text not null,
  valor_cents bigint not null default 0,
  status document_status not null default 'pendente',
  pendencias_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_financial_records_company on public.financial_records(company_id);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  tipo text not null,
  payload text,
  status sync_event_status not null,
  idempotency_key text,
  retries int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_sync_events_company on public.sync_events(company_id);
create index idx_sync_events_created on public.sync_events(created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tipo text not null check (tipo in ('NFS', 'NFE', 'NFC')),
  periodo text not null,
  status document_status not null default 'novo',
  origem text not null default 'Automação',
  document_date date,
  arquivos text[] default '{}',
  created_at timestamptz not null default now()
);
create index idx_documents_company on public.documents(company_id);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_fiscal_documents_updated before update on public.fiscal_documents for each row execute function public.set_updated_at();
create trigger trg_financial_records_updated before update on public.financial_records for each row execute function public.set_updated_at();

-- 10) RLS nas tabelas de negócio
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_pendencias enable row level security;
alter table public.dp_checklist enable row level security;
alter table public.dp_guias enable row level security;
alter table public.financial_records enable row level security;
alter table public.sync_events enable row level security;
alter table public.documents enable row level security;

create policy "fiscal_documents_rls" on public.fiscal_documents for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_documents_rls_insert" on public.fiscal_documents for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_documents_rls_update" on public.fiscal_documents for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_documents_rls_delete" on public.fiscal_documents for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_pendencias_rls" on public.fiscal_pendencias for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_pendencias_rls_insert" on public.fiscal_pendencias for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_pendencias_rls_update" on public.fiscal_pendencias for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "fiscal_pendencias_rls_delete" on public.fiscal_pendencias for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_checklist_rls" on public.dp_checklist for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_checklist_rls_insert" on public.dp_checklist for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_checklist_rls_update" on public.dp_checklist for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_checklist_rls_delete" on public.dp_checklist for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_guias_rls" on public.dp_guias for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_guias_rls_insert" on public.dp_guias for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_guias_rls_update" on public.dp_guias for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "dp_guias_rls_delete" on public.dp_guias for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "financial_records_rls" on public.financial_records for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "financial_records_rls_insert" on public.financial_records for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "financial_records_rls_update" on public.financial_records for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "financial_records_rls_delete" on public.financial_records for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "sync_events_rls" on public.sync_events for select using (company_id is null or company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "sync_events_rls_insert" on public.sync_events for insert with check (company_id is null or company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "sync_events_rls_update" on public.sync_events for update using (company_id is null or company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "sync_events_rls_delete" on public.sync_events for delete using (company_id is null or company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "documents_rls" on public.documents for select using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "documents_rls_insert" on public.documents for insert with check (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "documents_rls_update" on public.documents for update using (company_id in (select public.user_company_ids()) or public.is_super_admin());
create policy "documents_rls_delete" on public.documents for delete using (company_id in (select public.user_company_ids()) or public.is_super_admin());

-- 11) Trigger: criar profile ao inserir em auth.users (panel_access usa default da coluna)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', new.email, new.id::text),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do update set
    username = coalesce(excluded.username, profiles.username),
    role = coalesce(excluded.role, profiles.role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
