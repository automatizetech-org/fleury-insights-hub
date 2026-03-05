/**
 * Servidor HTTP do módulo WhatsApp — conexão igual ao WhatsApp_emissor.
 * Expõe: GET /status, GET /qr, GET /groups, POST /send (envia apenas para o groupId informado).
 * Uso: node server.js (ou npm run dev:wa a partir da raiz).
 * Pastas (tudo dentro de backend/whatsapp-emissor): .wwebjs_auth, .wwebjs_cache, data/
 * Configure no frontend: VITE_WHATSAPP_API=http://localhost:3010
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrImage = require("qr-image");
const { spawnSync } = require("child_process");

const PORT = Number(process.env.WA_SERVER_PORT) || 3010;
const APP_ROOT = path.resolve(__dirname);
// Tudo (auth, cache, data) fica dentro de backend/whatsapp-emissor
process.chdir(APP_ROOT);
const DATA_ROOT = process.env.WA_APP_DATA_DIR
  ? path.resolve(process.env.WA_APP_DATA_DIR)
  : path.join(APP_ROOT, "data");
const authFolder = path.join(APP_ROOT, ".wwebjs_auth");
const cacheFolder = path.join(APP_ROOT, ".wwebjs_cache");
const sessionFolder = path.join(authFolder, "session");
const qrFile = path.join(DATA_ROOT, "json", "wa_qr.png");
const pwBrowsersDir = path.join(DATA_ROOT, "ms-playwright");

let client = null;
let isReady = false;
let lastQR = null;
let isStarting = false;

function clearChromeLocks() {
  const rootLocks = ["SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort"];
  rootLocks.forEach((name) => {
    const p = path.join(sessionFolder, name);
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    } catch (_) {}
  });
  try {
    if (fs.existsSync(sessionFolder)) {
      const stack = [sessionFolder];
      while (stack.length) {
        const dir = stack.pop();
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
          continue;
        }
        entries.forEach((e) => {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) stack.push(full);
          else {
            const upper = e.name.toUpperCase();
            if (upper === "LOCK" || upper.startsWith("SINGLETON") || e.name === "DevToolsActivePort") {
              try {
                fs.rmSync(full, { force: true });
              } catch (_) {}
            }
          }
        });
      }
    }
  } catch (_) {}
}

function killOrphanChrome() {
  if (process.platform !== "win32") return;
  const sessionPath = sessionFolder.replace(/'/g, "''");
  const authPath = authFolder.replace(/'/g, "''");
  const ps = [
    "Get-CimInstance Win32_Process |",
    "Where-Object { $_.CommandLine -and ( $_.CommandLine -like '*" + sessionPath + "*' -or $_.CommandLine -like '*" + authPath + "*' ) } |",
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
  ].join(" ");
  try {
    spawnSync("powershell", ["-NoProfile", "-Command", ps], {
      stdio: "ignore",
      timeout: 6000,
      windowsHide: true,
    });
  } catch (_) {}
}

function resolveBrowserExecutable() {
  try {
    if (!fs.existsSync(pwBrowsersDir)) return undefined;
    const found = [];
    const stack = [pwBrowsersDir];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      entries.forEach((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (
          e.isFile() &&
          e.name.toLowerCase() === "chrome.exe" &&
          full.includes("chromium-")
        ) {
          found.push(full);
        }
      });
    }
    if (!found.length) return undefined;
    found.sort((a, b) => {
      const ma = /chromium-(\d+)/i.exec(a);
      const mb = /chromium-(\d+)/i.exec(b);
      return (mb ? parseInt(mb[1], 10) : 0) - (ma ? parseInt(ma[1], 10) : 0);
    });
    return found[0];
  } catch (_) {
    return undefined;
  }
}

function buildClient() {
  const executablePath = resolveBrowserExecutable();
  const puppeteerOpts = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  };
  if (executablePath) puppeteerOpts.executablePath = executablePath;
  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: authFolder }),
    webVersionCache: { type: "local", path: cacheFolder },
    puppeteer: puppeteerOpts,
  });

  c.on("qr", (qr) => {
    // QR do evento = mesmo dado que a página WhatsApp Web exibe. Geramos PNG legível para a interface.
    const png = qrImage.imageSync(qr, {
      type: "png",
      size: 12,
      margin: 3,
      ec_level: "M",
    });
    lastQR = Buffer.isBuffer(png) ? png : Buffer.from(png);
    try {
      const qrDir = path.dirname(qrFile);
      if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
      fs.writeFileSync(qrFile, png);
      console.log("QR_READY");
    } catch (_) {}
    console.log("QR_BASE64:" + png.toString("base64"));
  });

  c.on("ready", () => {
    isReady = true;
    lastQR = null;
    try {
      if (fs.existsSync(qrFile)) fs.rmSync(qrFile, { force: true });
    } catch (_) {}
    console.log("[OK] WhatsApp conectado.");
  });

  c.on("disconnected", (reason) => {
    isReady = false;
    lastQR = null;
    console.log("[!] Desconectado:", reason || "");
  });

  c.on("auth_failure", () => {
    console.log("[!] Falha de autenticação.");
  });

  return c;
}

async function startClient() {
  if (client) return;
  isStarting = true;
  console.log("[INFO] Inicializando cliente WhatsApp...");
  try {
    if (fs.existsSync(qrFile)) fs.rmSync(qrFile, { force: true });
  } catch (_) {}
  killOrphanChrome();
  clearChromeLocks();
  await new Promise((r) => setTimeout(r, 3500));
  client = buildClient();
  try {
    await client.initialize();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("[ERRO] Falha ao inicializar:", msg);
    client = null;
    const isBrowserAlreadyRunning = /browser is already running|userDataDir/i.test(msg);
    if (isBrowserAlreadyRunning) {
      console.log("[INFO] Encerrando Chrome órfão e tentando novamente...");
      killOrphanChrome();
      clearChromeLocks();
      await new Promise((r) => setTimeout(r, 5000));
    } else if (fs.existsSync(cacheFolder)) {
      try {
        fs.rmSync(cacheFolder, { recursive: true, force: true });
      } catch (_) {}
      killOrphanChrome();
      await new Promise((r) => setTimeout(r, 3000));
    }
    client = buildClient();
    try {
      await client.initialize();
    } catch (e2) {
      client = null;
      console.error("[ERRO] Segunda tentativa falhou:", e2 && e2.message ? e2.message : e2);
    }
  } finally {
    isStarting = false;
  }
}

async function disconnectClient() {
  if (!client) return;
  try {
    await client.destroy();
  } catch (_) {}
  client = null;
  isReady = false;
  lastQR = null;
  try {
    if (fs.existsSync(qrFile)) fs.rmSync(qrFile, { force: true });
  } catch (_) {}
  console.log("[OK] Cliente desconectado. Sessão mantida para reconectar.");
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || "/";
  const pathname = url.split("?")[0];

  if (pathname === "/status") {
    sendJson(res, 200, { connected: isReady });
    return;
  }

  if (pathname === "/qr") {
    if (isReady) {
      sendJson(res, 200, { qr: null, connected: true });
      return;
    }
    if (!lastQR || !Buffer.isBuffer(lastQR)) {
      sendJson(res, 200, { qr: null, connected: false });
      return;
    }
    const base64 = lastQR.toString("base64");
    sendJson(res, 200, { qr: `data:image/png;base64,${base64}`, connected: false });
    return;
  }

  if (pathname === "/qr.png") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (isReady || !lastQR) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(lastQR);
    return;
  }

  if (pathname === "/groups") {
    if (!isReady || !client) {
      sendJson(res, 200, { groups: [] });
      return;
    }
    try {
      const chats = await client.getChats();
      const groups = chats
        .filter((c) => c.isGroup)
        .map((c) => ({
          id: c.id._serialized || c.id,
          name: c.name || "Sem nome",
        }));
      sendJson(res, 200, { groups });
    } catch (e) {
      console.error("[ERRO] Listar grupos:", e);
      sendJson(res, 500, { groups: [], error: (e && e.message) || "Erro ao listar grupos" });
    }
    return;
  }

  if (pathname === "/connect" && req.method === "POST") {
    if (client && isReady) {
      sendJson(res, 200, { ok: true, alreadyConnected: true });
      return;
    }
    if (client || isStarting) {
      sendJson(res, 200, { ok: true, starting: true });
      return;
    }
    startClient()
      .then(() => sendJson(res, 200, { ok: true }))
      .catch((e) => sendJson(res, 500, { ok: false, error: (e && e.message) ? e.message : "Falha ao iniciar" }));
    return;
  }

  if (pathname === "/disconnect" && req.method === "POST") {
    disconnectClient()
      .then(() => sendJson(res, 200, { ok: true }))
      .catch(() => sendJson(res, 200, { ok: true }));
    return;
  }

  if (pathname === "/send" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      if (!isReady || !client) {
        sendJson(res, 503, { ok: false, error: "WhatsApp desconectado" });
        return;
      }
      let data;
      try {
        data = JSON.parse(body || "{}");
      } catch (_) {
        sendJson(res, 400, { ok: false, error: "JSON inválido" });
        return;
      }
      const groupId = (data.groupId || "").trim();
      const message = typeof data.message === "string" ? data.message : "";
      if (!groupId) {
        sendJson(res, 400, { ok: false, error: "groupId obrigatório" });
        return;
      }
      const targetId = groupId.includes("@") ? groupId : `${groupId}@g.us`;
      try {
        await client.sendMessage(targetId, message || " ");
        sendJson(res, 200, { ok: true });
      } catch (e) {
        console.error("[ERRO] Enviar para grupo:", e);
        sendJson(res, 500, {
          ok: false,
          error: (e && e.message) || "Falha ao enviar",
        });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[API] WhatsApp API em http://localhost:${PORT}`);
  console.log("[API] Configure no .env do frontend: VITE_WHATSAPP_API=http://localhost:" + PORT);
  startClient().catch((e) => {
    console.error("[ERRO] Cliente não iniciou:", e);
  });
});
