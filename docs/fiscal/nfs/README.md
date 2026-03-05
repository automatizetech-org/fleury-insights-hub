# NFS — Notas Fiscais de Serviço

Robô específico para **NFS** (NFSe). Usa o mesmo endpoint de documentos fiscais; o tipo na tabela é `'NFS'`.

## Env (centralizado)

Use a URL definida em **[../../env.example](../../env.example)** (`SERVER_API_URL`).

## Tabela Supabase

- **Tabela:** `fiscal_documents`
- **Campos relevantes:** `id`, `company_id`, `type` = `'NFS'`, `chave`, `periodo`, `status`, `document_date`, **`file_path`**

## Convenção de file_path

Caminho **relativo**:

```
fiscal/nfs/{company_id}/{periodo}/{chave}.xml
```

Exemplo: `fiscal/nfs/a1b2c3d4-.../2025-03/12345678901234567890123456789012345678901234.xml`

No Supabase, `file_path` = esse valor relativo à raiz do servidor.

## Endpoint

- **GET** `{SERVER_API_URL}/api/fiscal-documents/:id/download`
- Header: `Authorization: Bearer <supabase_jwt>`

## Resumo para o robô

1. Baixar XML NFS.
2. Salvar em: `{BASE_PATH}/fiscal/nfs/{company_id}/{periodo}/{chave}.xml`
3. Inserir/atualizar em `fiscal_documents` com `type` = `'NFS'` e `file_path` = `fiscal/nfs/{company_id}/{periodo}/{chave}.xml`
