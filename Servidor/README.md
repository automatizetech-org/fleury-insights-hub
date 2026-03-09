# Servidor — VM (uma pasta, uma tarefa no Agendador)

Tudo que roda na VM fica aqui: **whatsapp-emissor** (porta 3010) e **server-api** (porta 3001).

## O que fazer na VM (resumo)

1. **Copiar a pasta `Servidor`** para a VM (ex.: `C:\Users\ROBO\Documents\Servidor`).

2. **Criar o .env do server-api**  
   Na VM:
   ```
   C:\Users\ROBO\Documents\Servidor\server-api\
   ```
   Copie `.env.example` para `.env` e ajuste se precisar (BASE_PATH, WHATSAPP_BACKEND_URL=http://localhost:3010, Supabase).

3. **Instalar dependências** (uma vez):
   ```
   cd C:\Users\ROBO\Documents\Servidor\whatsapp-emissor
   npm install

   cd C:\Users\ROBO\Documents\Servidor\server-api
   npm install
   ```

4. **Uma única tarefa no Agendador de Tarefas**
   - **Ação:** Iniciar um programa  
   - **Programa/script:** `C:\Windows\System32\cmd.exe`  
   - **Argumentos:** `/c cd /d C:\Users\ROBO\Documents\Servidor && pm2 start ecosystem.config.cjs`  
   - (Ajuste o caminho se a pasta Servidor estiver em outro lugar.)
   - Assim sobem os dois processos: WhatsApp (3010) e server-api (3001).

5. **Ngrok** continua apontando para a porta **3001** (server-api).

## Estrutura

```
Servidor/
├── ecosystem.config.cjs   ← PM2 sobe os dois apps
├── start.bat              ← atalho: abre cmd, roda pm2 start
├── whatsapp-emissor/      ← porta 3010 (QR, grupos, envio WhatsApp)
│   ├── server.js
│   ├── launcher.js
│   ├── ecosystem.config.cjs   ← só este app (opcional)
│   └── package.json
└── server-api/            ← porta 3001 (arquivos + proxy para WhatsApp)
    ├── index.js
    ├── .env
    └── package.json
```

## Comandos úteis na VM

- Reiniciar tudo: `cd C:\Users\ROBO\Documents\Servidor` e `pm2 restart all`
- Ver logs: `pm2 logs`
- Só WhatsApp: `pm2 restart whatsapp-emissor`
- Só API: `pm2 restart server-api`
