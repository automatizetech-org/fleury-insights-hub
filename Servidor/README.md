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
   - **Programa/script:** `node`
   - **Argumentos:** `start-wrapper.js`
   - **Iniciar em:** `C:\Users\ROBO\Documents\Servidor`
   - Assim, ao clicar em **Finalizar** na tarefa, o wrapper chama o **stop.bat** e tudo para. Se preferir usar **start.bat** como programa, pare tudo com **stop.bat** manualmente.  
   - O **start.bat** sobe o PM2 (whatsapp-emissor + server-api + ngrok) e fica em **pm2 logs**, então a tarefa permanece “Em execução”.
   - **Para parar tudo:** execute **stop.bat** (duplo clique).

5. **Pasta do Ngrok**  
   O ngrok fica **dentro** da pasta Servidor: `C:\Users\ROBO\Documents\Servidor\Ngrok\ngrok.exe`.  
   Coloque o executável do ngrok nessa pasta. O PM2 (ecosystem.config.cjs) inicia o ngrok automaticamente; não é preciso alterar a tarefa do Agendador.

## Estrutura

```
Servidor/
├── ecosystem.config.cjs   ← PM2 sobe os três apps (whatsapp-emissor, server-api, ngrok)
├── start.bat              ← chama start-wrapper.js (pode usar na tarefa ou para teste)
├── start-wrapper.js       ← sobe PM2 + pm2 logs; ao receber Finalizar tarefa, chama stop.bat
├── stop.bat               ← para tudo (PM2 + apps)
├── Ngrok/                 ← coloque ngrok.exe aqui
│   └── ngrok.exe
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

- **Parar tudo:** execute `stop.bat` (para PM2 e todos os apps; se a tarefa do Agendador estiver rodando start.bat, ela termina).
- Reiniciar tudo: `cd C:\Users\ROBO\Documents\Servidor` e `pm2 restart all`
- Ver logs: `pm2 logs`
- Só WhatsApp: `pm2 restart whatsapp-emissor`
- Só API: `pm2 restart server-api`
