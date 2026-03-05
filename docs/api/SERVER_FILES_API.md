# API do servidor — Referência completa (túnel, URL fixa, contrato)

> **Configuração central:** a URL da API é definida em **[../env.example](../env.example)**. Use esse arquivo em todo o projeto (robôs e frontend).

Os arquivos (XMLs de NF-e/NFC/NFSe, guias do DP, documentos) ficam no **seu servidor**, onde os robôs rodam. O Supabase guarda só **metadados** (incluindo o caminho do arquivo no servidor). O site chama uma API no seu servidor para baixar o arquivo; o servidor valida o JWT do usuário e devolve o arquivo do disco.

---

## Entendendo: "computador" (servidor) x "site no ar"

- **Site no ar** = o frontend (React) está hospedado em algum lugar da internet (Vercel, Netlify, etc.). O usuário abre no navegador e acessa de qualquer lugar.
- **Servidor** = o computador onde rodam os robôs e onde os XMLs ficam guardados em pastas. Esse computador precisa **expor uma API** (um programa que "escuta" pedidos na rede) para o site conseguir pedir os arquivos.

**O ponto central:** o site (que está na internet) só consegue chamar o seu computador se esse computador estiver **acessível pela internet** com uma **URL pública**. A URL usada por todos (robôs + site) fica em **`docs/env.example`** (`SERVER_API_URL` / `VITE_SERVER_API_URL`).

---

## URL fixa (sem ficar mudando) — gratuito

Para **não precisar ficar mudando** a URL, use uma destas opções gratuitas em que a URL **não muda**:

### Opção 1: Ngrok com domínio fixo (recomendado)

O ngrok **dá 1 domínio fixo de graça** para quem tem conta. A URL é sempre a mesma, mesmo reiniciando.

1. Crie conta em [dashboard.ngrok.com](https://dashboard.ngrok.com) e baixe o ngrok em [ngrok.com/download](https://ngrok.com/download).
2. No dashboard: **Cloud Edge → Domains → Create Domain** (ou "Claim your free domain"). Você ganha um domínio tipo `seu-nome.ngrok-free.app`.
3. No PC onde a API roda (porta 3001): `ngrok http --domain=seu-nome.ngrok-free.app 3001`
4. Em **`docs/env.example`** (e no `.env` da raiz do projeto para o frontend): `VITE_SERVER_API_URL=https://seu-nome.ngrok-free.app`

### Opção 2: Cloudflare Tunnel com seu domínio

Com um domínio na Cloudflare (conta gratuita), crie um túnel nomeado e use uma URL fixa tipo `https://api.seudominio.com.br`. Configure em **`docs/env.example`**.

---

## Contrato da API (servidor)

### GET `/api/fiscal-documents/:id/download`

- **Headers:** `Authorization: Bearer <supabase_access_token>`
- **Resposta de sucesso (200):** `Content-Type: application/xml`, `Content-Disposition: attachment; filename="nfe-{chave}.xml"`, body = arquivo.
- **Erros:** `401`, `403`, `404`.

Lógica: validar JWT → buscar registro em `fiscal_documents` por `id` → verificar acesso ao `company_id` → ler arquivo do disco por `file_path` → retornar arquivo.

### GET `/api/dp-guias/:id/download`

- **Headers:** `Authorization: Bearer <supabase_access_token>`
- **Resposta:** arquivo (PDF etc.) com `Content-Disposition: attachment`.
- **Tabela:** `dp_guias` (campo `file_path`). Config por tipo em [../departamento-pessoal/guias/](../departamento-pessoal/guias/).

---

## Estrutura base no disco

A raiz (ex.: `D:\dados\fleury`) é configurada no servidor. O `file_path` no Supabase é **relativo** a essa raiz. Convenções por tipo:

- **Fiscal NFe/NFC:** [../fiscal/nfe-nfc/README.md](../fiscal/nfe-nfc/README.md)
- **Fiscal NFS:** [../fiscal/nfs/README.md](../fiscal/nfs/README.md)
- **DP Guias:** [../departamento-pessoal/guias/README.md](../departamento-pessoal/guias/README.md)

Assim você não usa o storage do Supabase para esses arquivos e mantém tudo no seu servidor, com uma única API e um único ponto de env em `docs/env.example`.
