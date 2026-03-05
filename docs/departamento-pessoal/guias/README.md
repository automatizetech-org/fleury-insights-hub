# Guias — FGTS, DARF e demais

Todas as guias do DP usam a **mesma tabela** (`dp_guias`) e o **mesmo endpoint** (`GET /api/dp-guias/:id/download`). A diferença é a convenção de pasta e, se quiser, um campo de tipo/categoria na tabela para filtrar no site.

| Subtipo | Config      | Convenção de file_path     |
|---------|-------------|----------------------------|
| FGTS    | [fgts/](./fgts/) | `departamento-pessoal/guias/fgts/...` |
| DARF    | [darf/](./darf/) | `departamento-pessoal/guias/darf/...` |

Env centralizado: [../../env.example](../../env.example) (`SERVER_API_URL`).
