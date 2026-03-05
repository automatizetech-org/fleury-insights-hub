# Departamento Pessoal — Guias e documentos

Documentos do DP (guias FGTS, DARF, etc.) são servidos pelo endpoint `GET /api/dp-guias/:id/download`. A **mesma URL da API** (em [../env.example](../env.example)) é usada; cada tipo de guia tem sua subpasta em `guias/` com a convenção de `file_path`.

| Tipo  | Pasta de config           | Tabela    | Uso no site   |
|-------|----------------------------|-----------|----------------|
| FGTS  | [guias/fgts/](./guias/fgts/) | `dp_guias`| Módulo DP      |
| DARF  | [guias/darf/](./guias/darf/) | `dp_guias`| Módulo DP      |

A tabela `dp_guias` já possui o campo `file_path`. O robô de cada tipo grava no disco conforme a convenção da sua pasta e preenche `file_path` (relativo à raiz do servidor).
