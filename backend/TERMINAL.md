# Comandos — análise e teste

**Reinício**  
Parar no agendador e iniciar de novo = reiniciar o processo. Funciona.

---

## Na máquina local (dev)

| O que | Comando |
|-------|--------|
| App + WhatsApp | `npm run dev` |
| Só frontend | `npm run dev:vite` |
| Só API WhatsApp | `npm run dev:wa` |
| Build produção | `npm run build` |
| Preview do build | `npm run preview` |
| Testes | `npm run test` |
| Lint | `npm run lint` |

**API WhatsApp:** `http://localhost:3010/status` e `/groups`

---

## Na VM (PM2)

| O que | Comando |
|-------|--------|
| Listar apps | `pm2 list` |
| Status de um app | `pm2 show <nome ou id>` |
| Logs (últimas linhas) | `pm2 logs` ou `pm2 logs <nome>` |
| Logs em tempo real | `pm2 logs <nome> --lines 100` |
| Reiniciar um app | `pm2 restart <nome>` |
| Reiniciar tudo | `pm2 restart all` |
| Parar | `pm2 stop <nome>` |
| Iniciar | `pm2 start <nome>` ou `pm2 start ecosystem.config.js` |
| Salvar lista atual (após restart all) | `pm2 save` |
| Restaurar após reboot | `pm2 resurrect` (ou configurar startup: `pm2 startup`) |

**Dica:** depois de `pm2 restart`, olhe `pm2 logs` para ver se subiu sem erro e se os anexos aparecem (`[SEND] POST /send recebido...`).
