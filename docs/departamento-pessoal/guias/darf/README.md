# Guias DARF

Robô que baixa/gera guias **DARF** e disponibiliza para download no site (módulo DP).

## Env (centralizado)

Use **[../../../env.example](../../../env.example)** (`SERVER_API_URL`).

## Tabela Supabase

- **Tabela:** `dp_guias`
- **Campos:** `id`, `company_id`, `nome`, `tipo` (ex.: `'PDF'`), `data`, **`file_path`**, `created_at`

Para filtrar só DARF no site, use `nome` ou um campo `categoria` = `'DARF'`.

## Convenção de file_path

Caminho **relativo**:

```
departamento-pessoal/guias/darf/{company_id}/{periodo}/{nome_arquivo}.pdf
```

Exemplo: `departamento-pessoal/guias/darf/a1b2c3d4-.../2025-03/darf-marco-2025.pdf`

No Supabase, `file_path` = esse valor.

## Endpoint

- **GET** `{SERVER_API_URL}/api/dp-guias/:id/download`
- Header: `Authorization: Bearer <supabase_jwt>`

## Resumo para o robô

1. Gerar/baixar a guia DARF (PDF).
2. Salvar em: `{BASE_PATH}/departamento-pessoal/guias/darf/{company_id}/{periodo}/{nome}.pdf`
3. Inserir em `dp_guias` com `company_id`, `nome`, `tipo`, `data`, `file_path` = `departamento-pessoal/guias/darf/{company_id}/{periodo}/{nome}.pdf`
