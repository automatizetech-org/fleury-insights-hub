-- Caminho do arquivo no servidor (robô grava o XML no disco e preenche aqui)
alter table public.fiscal_documents
  add column if not exists file_path text null;

comment on column public.fiscal_documents.file_path is 'Path relativo no servidor onde o XML está (ex: empresas/{company_id}/nfe/2025-03/{chave}.xml). Usado pela API do servidor para servir o download.';
