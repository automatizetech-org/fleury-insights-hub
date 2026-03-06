# API de arquivos — Fleury Insights Hub

Servidor que roda na **VM** (porta 3001). Expõe listagem de pastas e download de documentos fiscais.

## Convenção: pastas = nomes do dashboard

**Os nomes das pastas das empresas na VM devem ser exatamente iguais aos nomes cadastrados no dashboard** (tabela `companies.name`).

| No dashboard (Empresas) | Na VM (pasta dentro de `EMPRESAS\`) |
|-------------------------|--------------------------------------|
| Grupo Fleury             | `EMPRESAS\Grupo Fleury\`             |
| Empresa XYZ Ltda        | `EMPRESAS\Empresa XYZ Ltda\`        |

Assim a API e os scripts conseguem localizar os arquivos pelo mesmo nome que o usuário vê no sistema.

## Estrutura no disco (VM)

```
C:\Users\ROBO\Documents\          ← BASE_PATH
└── EMPRESAS\
    └── Grupo Fleury\              ← mesmo nome da empresa no dashboard
        ├── NFS\                   ← Notas Fiscais de Serviço
        │   ├── nf-123.xml
        │   └── nf-123.pdf
        ├── NFE\
        ├── NFC\
        └── ...
```

## Configuração

1. Copie `.env.example` para `.env` na pasta `server-api`
2. Ajuste `BASE_PATH` se na VM a raiz for outra (Supabase já vem preenchido; só anon key)

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/files/list?path=EMPRESAS/Grupo Fleury/NFS` | Lista XML/PDF da pasta |
| GET | `/api/files/download?path=...` | Baixa arquivo por path (teste) |
| GET | `/api/fiscal-documents/:id/download` | Baixa por ID (JWT obrigatório) |
| POST | `/api/fiscal-sync` | Sincroniza pasta → `fiscal_documents` |

## Rodar na VM

```bash
cd server-api
npm install
npm start
```

Com ngrok (para acesso externo):

```bash
ngrok http --domain=plagiaristic-elinore-ungloomily.ngrok-free.dev 3001
```

## Teste rápido

No projeto principal:

```bash
# Listar arquivos da pasta Grupo Fleury/NFS
npm run test:ngrok:list

# Sincronizar para fiscal_documents (company_id da empresa no Supabase; exige JWT do usuário)
npm run test:ngrok:sync -- <uuid-da-empresa> [seu_jwt]
# Ou defina SYNC_TOKEN no .env com o access_token do usuário logado
# Ou defina SYNC_TOKEN no .env com o access_token do usuário logado
```

Depois acesse **Fiscal → NFS** no site para ver os documentos.
