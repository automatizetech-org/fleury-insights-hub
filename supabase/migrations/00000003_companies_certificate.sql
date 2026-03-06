-- Certificado digital (NFS-e): auth_mode, cert_blob_b64, cert_password
-- O robô NFS carrega empresas do Supabase quando "Rodar em servidor" está ativo.
alter table public.companies
  add column if not exists auth_mode text null check (auth_mode is null or auth_mode in ('password', 'certificate')),
  add column if not exists cert_blob_b64 text null,
  add column if not exists cert_password text null;

comment on column public.companies.auth_mode is 'password = usuario/senha; certificate = certificado A1 .pfx (NFS-e)';
comment on column public.companies.cert_blob_b64 is 'Certificado .pfx em base64 (quando auth_mode = certificate)';
comment on column public.companies.cert_password is 'Senha do certificado (quando auth_mode = certificate)';
