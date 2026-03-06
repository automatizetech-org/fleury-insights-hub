# API do servidor — Referência completa (túnel, URL fixa, contrato)

> **Configuração central:** o **IP do servidor** e as URLs da API estão em **[../env.example](../env.example)** (parametrizado por `SERVER_HOST`, ex.: `192.168.50.9`). Ver **[../SERVER_CONFIG.md](../SERVER_CONFIG.md)** para portas e como trocar o IP.

Os arquivos (XMLs de NF-e/NFC/NFSe, guias do DP, documentos) ficam no **seu servidor**, onde os robôs rodam. O Supabase guarda só **metadados** (incluindo o caminho do arquivo no servidor). O site chama uma API no seu servidor para baixar o arquivo; o servidor valida o JWT do usuário e devolve o arquivo do disco.

---

## Entendendo: "computador" (servidor) x "site no ar"

- **Site no ar** = o frontend (React) está hospedado em algum lugar da internet (Vercel, Netlify, etc.). O usuário abre no navegador e acessa de qualquer lugar.
- **Servidor** = o computador onde rodam os robôs e onde os XMLs ficam guardados em pastas. Esse computador precisa **expor uma API** (um programa que "escuta" pedidos na rede) para o site conseguir pedir os arquivos.

**O ponto central:** o site (que está na internet) só consegue chamar o seu computador se esse computador estiver **acessível** (rede local ou URL pública). A URL usada por todos (robôs + site) fica em **`docs/env.example`** (`SERVER_API_URL`), derivada do IP em **`docs/SERVER_CONFIG.md`** (ex.: `http://192.168.50.9:3001`).

---

## URL fixa (sem ficar mudando) — gratuito

Para **não precisar ficar mudando** a URL, use uma destas opções gratuitas em que a URL **não muda**:

### Opção 1: Ngrok com domínio fixo (recomendado)

O ngrok **dá 1 domínio fixo de graça** para quem tem conta. A URL é sempre a mesma, mesmo reiniciando.

1. Crie conta em [dashboard.ngrok.com](https://dashboard.ngrok.com) e baixe o ngrok em [ngrok.com/download](https://ngrok.com/download).
2. No dashboard: **Cloud Edge → Domains → Create Domain** (ou "Claim your free domain"). Você ganha um domínio tipo `seu-nome.ngrok-free.app`.
3. No PC onde a API roda (porta 3001): `ngrok http --domain=seu-nome.ngrok-free.app 3001`
4. Em **`docs/env.example`**: defina `SERVER_API_URL` com a URL do ngrok (ex.: `https://seu-nome.ngrok-free.app`). Para uso em rede local, use o IP do servidor: `http://192.168.50.9:3001` (conforme [../SERVER_CONFIG.md](../SERVER_CONFIG.md)).

### Opção 2: Cloudflare Tunnel com seu domínio

Com um domínio na Cloudflare (conta gratuita), crie um túnel nomeado e use uma URL fixa tipo `https://api.seudominio.com.br`. Configure em **`docs/env.example`**.

---

## Contrato da API (servidor)

### GET `/api/fiscal-documents/:id/download`

- **Headers:** `Authorization: Bearer <supabase_access_token>`
- **Resposta de sucesso (200):** `Content-Type: application/xml`, `Content-Disposition: attachment; filename="nfe-{chave}.xml"`, body = arquivo.
- **Erros:** `401`, `403`, `404`.

Lógica: validar JWT → buscar registro em `fiscal_documents` por `id` → verificar acesso ao `company_id` → ler arquivo do disco por `file_path` → retornar arquivo.

### GET `/api/files/list?path=...`

- **Query:** `path` = caminho relativo à raiz (ex.: `EMPRESAS/Grupo Fleury/NFS`)
- **Resposta (200):** `{ files: [{ name, ext, path }] }` — lista XML/PDF da pasta
- **Erros:** `400`, `403`, `404`, `500`

### GET `/api/files/download?path=...`

- **Query:** `path` = caminho relativo ao arquivo (ex.: `EMPRESAS/Grupo Fleury/NFS/arquivo.xml`)
- **Resposta (200):** arquivo com `Content-Disposition: attachment`
- Uso: teste rápido sem JWT

### POST `/api/fiscal-sync`

- **Body:** `{ path, company_id, type?: "NFS" }`
- **Headers:** `Authorization: Bearer <supabase_access_token>` (obrigatório; usa anon key + JWT; RLS valida)
- **Resposta (200):** `{ inserted, files }` — sincroniza pasta → `fiscal_documents`

### GET `/api/dp-guias/:id/download`

- **Headers:** `Authorization: Bearer <supabase_access_token>`
- **Resposta:** arquivo (PDF etc.) com `Content-Disposition: attachment`.
- **Tabela:** `dp_guias` (campo `file_path`). Config por tipo em [../departamento-pessoal/guias/](../departamento-pessoal/guias/).

---

## Estrutura base no disco

A raiz (ex.: `C:\Users\ROBO\Documents`) é configurada no servidor (`BASE_PATH`). O `file_path` no Supabase é **relativo** a essa raiz.

**Convenção:** as pastas das empresas dentro de `EMPRESAS\` na VM devem ter o **mesmo nome** da empresa cadastrada no dashboard (tabela `companies.name`). Ex.: empresa "Grupo Fleury" → pasta `EMPRESAS\Grupo Fleury\NFS\`.

Convenções por tipo:

- **Fiscal NFe/NFC:** [../fiscal/nfe-nfc/README.md](../fiscal/nfe-nfc/README.md)
- **Fiscal NFS:** [../fiscal/nfs/README.md](../fiscal/nfs/README.md)
- **DP Guias:** [../departamento-pessoal/guias/README.md](../departamento-pessoal/guias/README.md)

Assim você não usa o storage do Supabase para esses arquivos e mantém tudo no seu servidor, com uma única API e um único ponto de env em `docs/env.example`.
