# Guias FGTS

Robô que baixa/gera guias **FGTS** e disponibiliza para download no site (módulo DP).

## Env (centralizado)

Use **[../../../env.example](../../../env.example)** (`SERVER_API_URL`).

## Tabela Supabase

- **Tabela:** `dp_guias`
- **Campos:** `id`, `company_id`, `nome`, `tipo` (ex.: `'PDF'`), `data`, **`file_path`**, `created_at`

Se quiser filtrar só FGTS no site, use o campo `nome` ou adicione um campo `categoria` com valor `'FGTS'`.

## Convenção de file_path

Caminho **relativo** à raiz do servidor:

```
departamento-pessoal/guias/fgts/{company_id}/{periodo}/{nome_arquivo}.pdf
```

Exemplo: `departamento-pessoal/guias/fgts/a1b2c3d4-.../2025-03/fgts-marco-2025.pdf`

No Supabase, `file_path` = esse valor.

## Endpoint

- **GET** `{SERVER_API_URL}/api/dp-guias/:id/download`
- Header: `Authorization: Bearer <supabase_jwt>`

## Resumo para o robô

1. Gerar/baixar a guia FGTS (PDF).
2. Salvar em: `{BASE_PATH}/departamento-pessoal/guias/fgts/{company_id}/{periodo}/{nome}.pdf`
3. Inserir em `dp_guias` com `company_id`, `nome`, `tipo`, `data`, `file_path` = `departamento-pessoal/guias/fgts/{company_id}/{periodo}/{nome}.pdf`
