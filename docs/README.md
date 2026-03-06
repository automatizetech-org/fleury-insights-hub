# Documentação — Fleury Insights Hub

Toda a documentação de **API, robôs e download de documentos** fica aqui, organizada por pasta. Um único ponto de configuração de ambiente garante que site e robôs usem a mesma URL da API.

## Configuração central (use em todo o projeto)

- **[env.example](./env.example)** — **Único .env de referência**: IP do servidor (`SERVER_HOST=192.168.50.9`), URL da API de arquivos e URL do backend WhatsApp.  
  Robôs e o site devem usar os mesmos valores. No frontend, copie `SERVER_API_URL` e `WHATSAPP_API` para o `.env` na **raiz do projeto**.

- **[SERVER_CONFIG.md](./SERVER_CONFIG.md)** — Parâmetro único (IP do servidor), portas (3001 = API arquivos, 3010 = WhatsApp) e como trocar o IP ou usar túnel.

- **[VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)** — Deploy do frontend na Vercel: o que sobe, variáveis de ambiente e uso com API/WhatsApp (URL pública).

## Estrutura de pastas

```
docs/
├── env.example          ← IP do servidor + URLs da API e WhatsApp (centralizado)
├── SERVER_CONFIG.md     ← Parâmetros do servidor (IP, portas, como trocar)
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

Cada subpasta (nfe-nfc, nfs, guias/fgts, guias/darf) tem sua própria configuração de **caminho no disco**, **tabela no Supabase** e **endpoint** que a API expõe. Tudo usa o mesmo `SERVER_API_URL` do [env.example](./env.example) (derivado do IP em [SERVER_CONFIG.md](./SERVER_CONFIG.md)).

## Índice rápido

| Área            | Pasta                          | Endpoint da API                    |
|-----------------|---------------------------------|------------------------------------|
| Fiscal NFe/NFC  | [fiscal/nfe-nfc](./fiscal/nfe-nfc/) | `GET /api/fiscal-documents/:id/download` |
| Fiscal NFS      | [fiscal/nfs](./fiscal/nfs/)    | `GET /api/fiscal-documents/:id/download` |
| DP Guias FGTS   | [departamento-pessoal/guias/fgts](./departamento-pessoal/guias/fgts/) | `GET /api/dp-guias/:id/download` |
| DP Guias DARF   | [departamento-pessoal/guias/darf](./departamento-pessoal/guias/darf/) | `GET /api/dp-guias/:id/download` |

Detalhes do contrato (headers, erros, estrutura de pastas no servidor): [api/README.md](./api/README.md).
