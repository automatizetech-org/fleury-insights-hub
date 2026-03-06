# API do servidor — Contrato central

Uma **única API** (mesma base URL definida em [../env.example](../env.example), parametrizada pelo IP em [../SERVER_CONFIG.md](../SERVER_CONFIG.md)) atende todos os tipos de documento. Cada tipo (fiscal NFe/NFC, NFS, guias DP etc.) usa um endpoint e uma convenção de `file_path`; os robôs gravam no disco e no Supabase seguindo a pasta correspondente em `docs/`.

## Variável de ambiente

- **Robôs e frontend:** usar a URL definida em **`docs/env.example`** (`SERVER_API_URL`). O frontend precisa ter `SERVER_API_URL` e `WHATSAPP_API` no `.env` da **raiz do projeto** (valores centralizados em `docs/env.example`, IP do servidor em `docs/SERVER_CONFIG.md`).

## Endpoints (todos sob a mesma base URL)

| Recurso       | Método | Endpoint                              | Tabela Supabase   | Config por tipo          |
|---------------|--------|----------------------------------------|-------------------|--------------------------|
| Documento fiscal | GET  | `/api/fiscal-documents/:id/download`   | `fiscal_documents`| [../fiscal/nfe-nfc/](../fiscal/nfe-nfc/), [../fiscal/nfs/](../fiscal/nfs/) |
| Guia DP       | GET    | `/api/dp-guias/:id/download`           | `dp_guias`        | [../departamento-pessoal/guias/](../departamento-pessoal/guias/) |

## Contrato comum a todos os endpoints

- **Header obrigatório:** `Authorization: Bearer <supabase_access_token>` (JWT do usuário logado no site).
- **Resposta de sucesso (200):** corpo = arquivo; header `Content-Disposition: attachment; filename="..."`.
- **Erros:** `401` (token inválido), `403` (sem permissão para a empresa), `404` (registro ou arquivo não encontrado).

## Lógica sugerida no servidor (resumo)

1. Extrair e validar o JWT (Supabase).
2. Buscar o registro no Supabase pelo `id` (tabela do endpoint).
3. Verificar se o usuário tem acesso ao `company_id` desse registro (ex.: `company_memberships`).
4. Montar o path absoluto no disco: `BASE_PATH + file_path` (o `file_path` segue a convenção da pasta em `docs/` do tipo).
5. Enviar o arquivo com `Content-Disposition: attachment`.

## Estrutura base no disco (exemplo)

A raiz dos arquivos (ex.: `D:\dados\fleury` ou `/var/dados/fleury`) é configurada no servidor. Os robôs gravam em subpastas conforme cada README em `docs/fiscal/` e `docs/departamento-pessoal/`. O campo `file_path` no Supabase é **relativo** a essa raiz, por exemplo:

- Fiscal NFe/NFC: `fiscal/nfe-nfc/{company_id}/{periodo}/{chave}.xml`
- Fiscal NFS: `fiscal/nfs/{company_id}/{periodo}/{chave}.xml`
- Guias DP: `departamento-pessoal/guias/{tipo}/{company_id}/{periodo}/...`

Documentação detalhada (URL fixa, túnel, etc.): [SERVER_FILES_API.md](./SERVER_FILES_API.md).
