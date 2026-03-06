/**
 * PM2: WhatsApp emissor com restart automático ao desconectar.
 * Uso: na pasta do projeto:
 *   pm2 start ecosystem.config.cjs
 *
 * Com WA_RESTART_ON_DISCONNECT=1, ao receber POST /disconnect o processo
 * encerra e o PM2 reinicia; ao subir de novo, o server.js inicia o cliente
 * e gera um novo QR para reconectar.
 */
module.exports = {
  apps: [
    {
      name: "whatsapp-emissor",
      script: "server.js",
      cwd: "./backend/whatsapp-emissor",
      env: {
        WA_RESTART_ON_DISCONNECT: "1",
      },
      restart_delay: 3000,
      max_restarts: 50,
      min_uptime: "5s",
    },
  ],
};
