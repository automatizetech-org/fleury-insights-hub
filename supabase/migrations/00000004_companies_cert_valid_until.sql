-- Data de vencimento do certificado (extraída do .pfx ao salvar)
alter table public.companies
  add column if not exists cert_valid_until date null;

comment on column public.companies.cert_valid_until is 'Data de vencimento do certificado (extraída do .pfx ao salvar)';
