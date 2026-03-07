# API unificada — Fleury Insights Hub

Roda na **VM na porta 3001**. Atende **arquivos** (list, download, fiscal-sync) e **repassa o restante** para o backend do WhatsApp — mesma porta, um único ngrok.

- **Rotas de arquivos** → server-api responde
- **Demais rotas** (WhatsApp, etc.) → proxy para `WHATSAPP_BACKEND_URL` (ex.: porta 3010)

Na VM: o **backend do WhatsApp** deve rodar na porta **3010**; o **server-api** na **3001**; ngrok aponta para **3001**.

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
2. Ajuste `BASE_PATH` se na VM a raiz for outra
3. **WHATSAPP_BACKEND_URL** — URL do backend WhatsApp na VM (ex.: `http://localhost:3010`). O backend do WhatsApp deve rodar nessa porta; o server-api repassa para ela as rotas que não são de arquivos.

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/files/list?path=EMPRESAS/Grupo Fleury/NFS` | Lista XML/PDF da pasta |
| GET | `/api/files/download?path=...` | Baixa arquivo por path (teste) |
| GET | `/api/fiscal-documents/:id/download` | Baixa por ID (JWT obrigatório) |
| POST | `/api/fiscal-sync` | Sincroniza pasta → `fiscal_documents` |

## Rodar na VM

1. **Backend do WhatsApp** — subir na porta **3010** (não mexer no código; só configurar a porta onde ele escuta, ex.: 3010).
2. **server-api** — na pasta `server-api`:
   ```bash
   cd server-api
   npm install
   npm start
   ```
   (Escuta na 3001 e repassa para 3010 o que não for arquivos.)
3. **ngrok** (já em uso):
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
```

Depois acesse **Fiscal → NFS** no site para ver os documentos.
