# Documentação — Fleury Insights Hub

Toda a documentação de **API, robôs e download de documentos** fica aqui, organizada por pasta. Um único ponto de configuração de ambiente garante que site e robôs usem a mesma URL da API.

## Configuração central (use em todo o projeto)

- **[env.example](./env.example)** — **Único .env de referência** para a URL da API.  
  Robôs e o site devem usar o mesmo valor. No frontend, copie `VITE_SERVER_API_URL` para o `.env` na **raiz do projeto**.

## Estrutura de pastas

```
docs/
├── env.example          ← URL da API (centralizado)
├── README.md            ← este arquivo
├── api/                 ← Contrato da API e visão geral
│   └── README.md
├── fiscal/              ← Documentos fiscais (NFe/NFC, NFS)
│   ├── README.md
│   ├── nfe-nfc/         ← Robô NFe + NFC (mesmo robô)
│   └── nfs/             ← Robô NFS
└── departamento-pessoal/
    ├── README.md
    └── guias/
        ├── README.md
        ├── fgts/
        └── darf/
```

Cada subpasta (nfe-nfc, nfs, guias/fgts, guias/darf) tem sua própria configuração de **caminho no disco**, **tabela no Supabase** e **endpoint** que a API expõe. Tudo usa o mesmo `SERVER_API_URL` do [env.example](./env.example).

## Índice rápido

| Área            | Pasta                          | Endpoint da API                    |
|-----------------|---------------------------------|------------------------------------|
| Fiscal NFe/NFC  | [fiscal/nfe-nfc](./fiscal/nfe-nfc/) | `GET /api/fiscal-documents/:id/download` |
| Fiscal NFS      | [fiscal/nfs](./fiscal/nfs/)    | `GET /api/fiscal-documents/:id/download` |
| DP Guias FGTS   | [departamento-pessoal/guias/fgts](./departamento-pessoal/guias/fgts/) | `GET /api/dp-guias/:id/download` |
| DP Guias DARF   | [departamento-pessoal/guias/darf](./departamento-pessoal/guias/darf/) | `GET /api/dp-guias/:id/download` |

Detalhes do contrato (headers, erros, estrutura de pastas no servidor): [api/README.md](./api/README.md).
