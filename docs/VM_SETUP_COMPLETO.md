# VM — Setup completo (uma pasta Servidor, uma tarefa no Agendador)

## Fluxo

**Ngrok (3001)** → **server-api** (3001) → proxy → **whatsapp-emissor** (3010).

O front usa a URL do ngrok como `WHATSAPP_API`; tudo passa pelo server-api.

---

## O que fica na VM

Uma única pasta: **Servidor**, com dois subprojetos dentro.

```
C:\Users\ROBO\Documents\Servidor\
├── ecosystem.config.cjs   ← PM2 sobe os dois apps (uma tarefa)
├── start.bat              ← atalho: pm2 start ecosystem.config.cjs
├── README.md
├── whatsapp-emissor/      ← porta 3010
│   ├── server.js
│   ├── launcher.js
│   ├── ecosystem.config.cjs
│   └── package.json
└── server-api/            ← porta 3001 (ngrok aponta aqui)
    ├── index.js
    ├── .env
    └── package.json
```

---

## O que fazer na VM (passo a passo)

1. **Copiar a pasta `Servidor`** do projeto para a VM em `C:\Users\ROBO\Documents\Servidor` (ou outro caminho; ajuste o passo 4).

2. **.env do server-api**  
   Em `Servidor\server-api\`: copiar `.env.example` para `.env`.  
   Conferir: `BASE_PATH`, `WHATSAPP_BACKEND_URL=http://localhost:3010`, Supabase.

3. **Instalar dependências (uma vez)**  
   ```
   cd C:\Users\ROBO\Documents\Servidor\whatsapp-emissor
   npm install

   cd C:\Users\ROBO\Documents\Servidor\server-api
   npm install
   ```

4. **Uma única tarefa no Agendador de Tarefas**
   - **Nome:** Fleury Servidor (ou outro)
   - **Ação:** Iniciar um programa
   - **Programa:** `C:\Windows\System32\cmd.exe`
   - **Argumentos:** `/c cd /d C:\Users\ROBO\Documents\Servidor && pm2 start ecosystem.config.cjs`
   - **Iniciar em:** `C:\Users\ROBO\Documents\Servidor`
   - Configurar para rodar no logon (ou quando quiser).

5. **Ngrok** apontando para a porta **3001**.

---

## Comandos úteis

- Reiniciar tudo: `cd C:\Users\ROBO\Documents\Servidor` → `pm2 restart all`
- Logs: `pm2 logs`
- Só WhatsApp: `pm2 restart whatsapp-emissor`
- Só API: `pm2 restart server-api`

---

## Frontend (.env)

`WHATSAPP_API=https://SEU-DOMINIO.ngrok-free.dev` (mesma URL do ngrok que aponta para 3001).
