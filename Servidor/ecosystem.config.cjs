/**
 * PM2: sobe os dois serviços do Servidor com um único comando.
 * Uso (na pasta Servidor): pm2 start ecosystem.config.cjs
 *
 * - whatsapp-emissor: porta 3010
 * - server-api: porta 3001 (ngrok aponta aqui)
 */
const path = require("path");
const servidorDir = __dirname;

module.exports = {
  apps: [
    {
      name: "whatsapp-emissor",
      script: "server.js",
      cwd: path.join(servidorDir, "whatsapp-emissor"),
      env: {
        WA_RESTART_ON_DISCONNECT: "1",
      },
      restart_delay: 3000,
      max_restarts: 50,
      min_uptime: "5s",
    },
    {
      name: "server-api",
      script: "index.js",
      cwd: path.join(servidorDir, "server-api"),
      interpreter: "node",
      env: {
        PORT: "3001",
      },
      restart_delay: 2000,
      max_restarts: 20,
    },
  ],
};
