-- =============================================================================
-- Garantir um único registro por (empresa, caminho do arquivo).
-- Remove duplicatas existentes e cria índice único para impedir novas.
-- =============================================================================

-- 1) Remover duplicatas: manter apenas um registro por (company_id, file_path)
--    quando file_path não é nulo, ficando o de menor id.
delete from public.fiscal_documents a
using public.fiscal_documents b
where a.company_id = b.company_id
  and a.file_path is not null
  and b.file_path is not null
  and a.file_path = b.file_path
  and a.id > b.id;

-- 2) Índice único: mesmo arquivo (mesmo caminho na mesma empresa) não pode
--    ser inserido mais de uma vez. Só se aplica quando file_path está preenchido.
create unique index if not exists fiscal_documents_company_file_path_key
  on public.fiscal_documents (company_id, file_path)
  where file_path is not null;

comment on index public.fiscal_documents_company_file_path_key is
  'Um único registro por empresa + caminho do arquivo; evita duplicatas na sincronização.';
