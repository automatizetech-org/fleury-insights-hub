# VM — O que precisa estar lá e o que rodar

## Resumo do fluxo

- **Ngrok** (porta 3001) → **server-api** (Express, 3001) → repassa WhatsApp para **backend whatsapp-emissor** (3010).
- O front usa a URL do ngrok como `WHATSAPP_API`; tudo passa pelo server-api, que faz proxy para o WhatsApp.

---

## 1. Pastas na VM

| Pasta | Caminho na VM | Conteúdo |
|-------|----------------|----------|
| **server-api** | `C:\Users\ROBO\Documents\server-api` | API unificada (arquivos + proxy WhatsApp). **Já está.** |
| **backend** | `C:\Users\ROBO\Documents\backend` | Contém a pasta `whatsapp-emissor`. **Já está.** |

Estrutura esperada:

```
C:\Users\ROBO\Documents\
├── server-api\          ← API (porta 3001), ngrok aponta aqui
│   ├── index.js
│   ├── package.json
│   └── .env
└── backend\
    ├── ecosystem.config.cjs
    └── whatsapp-emissor\
        ├── server.js
        ├── launcher.js
        ├── package.json
        └── ...
```

---

## 2. Arquivos que precisam estar atualizados na VM

- **server-api:**  
  `server-api/index.js` — com a correção que **não consome o body** nas rotas do WhatsApp (`/send`, `/status`, `/groups`, `/qr`, `/connect`, `/disconnect`). Sem isso o proxy envia body vazio e o backend devolve 408.

- **backend whatsapp-emissor:**  
  `backend/whatsapp-emissor/server.js` — versão atual (resposta rápida para POST /send, timeout de body 45s, etc.).

Copie do seu projeto (onde você desenvolve) para esses caminhos na VM e sobrescreva.

---

## 3. .env na VM

### server-api (`C:\Users\ROBO\Documents\server-api\.env`)

```env
PORT=3001
BASE_PATH=C:\Users\ROBO\Documents
WHATSAPP_BACKEND_URL=http://localhost:3010
SUPABASE_URL=<sua_url>
SUPABASE_ANON_KEY=<sua_key>
SUPABASE_SERVICE_ROLE_KEY=<se_usar_fiscal_watcher>
```

### backend/whatsapp-emissor

Não precisa de .env para porta; usa 3010 por padrão. Se quiser:

```env
WA_SERVER_PORT=3010
```

---

## 4. O que rodar na VM (e em que ordem)

### A) Backend WhatsApp (porta 3010)

**Opção 1 — PM2 (recomendado)**

```powershell
cd C:\Users\ROBO\Documents\backend
pm2 start ecosystem.config.cjs
```

Para reiniciar depois de atualizar `server.js`:

```powershell
pm2 restart whatsapp-emissor
```

**Opção 2 — Terminal**

```powershell
cd C:\Users\ROBO\Documents\backend\whatsapp-emissor
node launcher.js
```

Deixe o processo rodando. Deve aparecer algo como: `[API] WhatsApp API em http://localhost:3010`.

---

### B) server-api (porta 3001)

Em **outro** terminal (ou outro processo PM2):

```powershell
cd C:\Users\ROBO\Documents\server-api
npm install
npm start
```

Deve aparecer: `API unificada em http://localhost:3001` e `Proxy WhatsApp: http://localhost:3010`.

---

### C) Ngrok (apontando para 3001)

```powershell
ngrok http 3001
```

Ou com domínio fixo:

```powershell
ngrok http --domain=plagiaristic-elinore-ungloomily.ngrok-free.dev 3001
```

---

## 5. Frontend (.env no seu PC / onde roda o site)

Use a **URL do ngrok** como API de WhatsApp (que já bate na 3001 = server-api):

```env
WHATSAPP_API=https://SEU-DOMINIO.ngrok-free.dev
```

Não use `http://localhost:3010` quando o site estiver acessando a VM via ngrok; nesse caso o tráfego tem que passar por ngrok → server-api → 3010.

---

## 6. Conferir se está certo

1. **WhatsApp (3010):**  
   Abra no navegador: `http://localhost:3010/status` (na VM). Deve retornar JSON com `connected: true/false`.

2. **server-api (3001):**  
   `http://localhost:3001/health` → `{"ok":true,...}`.

3. **Proxy:**  
   `http://localhost:3001/status` (na VM) deve retornar o mesmo que 3010/status (proxy repassou para o WhatsApp).

4. **Pelo site (ngrok):**  
   No navegador onde você usa o site, abra a aba do formulário de alteração empresarial, conecte o WhatsApp e clique em **Finalizado**. O POST deve retornar **200** e a mensagem deve ser enviada; não deve dar mais 408.

---

## 7. Por que dava 408

O **server-api** usa `express.json()`, que lia o body de **todas** as requisições. O proxy repassava o pedido ao backend WhatsApp **sem body** (já consumido). O backend esperava o body, não recebia em 45s e respondia **408**.  
A correção foi **não** usar `express.json()` nas rotas que são repassadas ao WhatsApp (`/send`, `/status`, `/groups`, `/qr`, `/connect`, `/disconnect`), para o proxy enviar o body inteiro para o backend na 3010.
