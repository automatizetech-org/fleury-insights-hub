# NFe + NFC — Mesmo robô, mesmo endpoint

Um único robô pode baixar **NF-e** e **NFC-e** e gravar os XMLs. A API e o site usam o mesmo endpoint para os dois; o tipo vem do campo `type` na tabela (`NFE` ou `NFC`).

## Env (centralizado)

Use a URL definida em **[../../env.example](../../env.example)** (`SERVER_API_URL`). O robô e o site usam a mesma base URL.

## Tabela Supabase

- **Tabela:** `fiscal_documents`
- **Campos relevantes:** `id`, `company_id`, `type` (`'NFE'` ou `'NFC'`), `chave`, `periodo`, `status`, `document_date`, **`file_path`**

O robô deve inserir/atualizar o registro após salvar o XML no disco e preencher `file_path` com o caminho **relativo** à raiz configurada no servidor.

## Convenção de file_path (no disco e no Supabase)

Caminho **relativo** que o robô grava e que a API usa para servir o arquivo:

```
fiscal/nfe-nfc/{company_id}/{periodo}/{chave}.xml
```

Exemplo: `fiscal/nfe-nfc/a1b2c3d4-.../2025-03/35250712345678000190550010001234561001234560.xml`

No Supabase, o campo `file_path` deve ser exatamente esse valor (relativo à raiz do servidor, ex.: `D:\dados\fleury` ou `/var/dados/fleury`).

## Endpoint

- **GET** `{SERVER_API_URL}/api/fiscal-documents/:id/download`
- Header: `Authorization: Bearer <supabase_jwt>`
- O site chama com o `id` do registro; a API lê `file_path`, valida permissão e devolve o XML.

## Resumo para o robô

1. Baixar XML (NFe ou NFC).
2. Salvar em: `{BASE_PATH}/fiscal/nfe-nfc/{company_id}/{periodo}/{chave}.xml`
3. Inserir ou atualizar em `fiscal_documents` com `company_id`, `type` = `'NFE'` ou `'NFC'`, `chave`, `periodo`, `file_path` = `fiscal/nfe-nfc/{company_id}/{periodo}/{chave}.xml`
