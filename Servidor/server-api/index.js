/**
 * API unificada — Fleury Insights Hub
 * Roda na VM na porta 3001. Atende rotas de arquivos e repassa o restante ao backend WhatsApp.
 * BASE_PATH: lido do Supabase (admin_settings.base_path) na inicialização; fallback para .env BASE_PATH.
 * Configure WHATSAPP_BACKEND_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import archiver from "archiver";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3001;

// Base path: Supabase (admin) na inicialização; fallback para .env
let BASE_PATH = (process.env.BASE_PATH || "C:\\Users\\ROBO\\Documents").trim();

async function loadBasePathFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  try {
    const supabase = createClient(url, serviceKey);
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "base_path").maybeSingle();
    if (data?.value && String(data.value).trim()) BASE_PATH = String(data.value).trim();
  } catch (_) {}
}

/** Dado path lógico (ex.: FISCAL/NFS), encontra date_rule no nó folha da árvore. */
function findDateRuleByPath(nodes, pathLogical) {
  const parts = pathLogical.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const byParentAndSlug = new Map();
  for (const n of nodes) {
    const slug = (n.slug || n.name || "").toLowerCase();
    const key = `${n.parent_id ?? "root"}:${slug}`;
    byParentAndSlug.set(key, n);
  }
  let parentId = null;
  let node = null;
  for (const part of parts) {
    const key = `${parentId ?? "root"}:${part.toLowerCase()}`;
    node = byParentAndSlug.get(key) ?? null;
    if (!node) return null;
    parentId = node.id;
  }
  return node?.date_rule ?? null;
}

app.use(cors());

// Não consumir o body nas rotas que o proxy repassa ao WhatsApp (senão o backend recebe body vazio e dá 408)
const whatsappPaths = ["/send", "/status", "/groups", "/qr", "/connect", "/disconnect"];
app.use((req, res, next) => {
  const isWhatsApp = whatsappPaths.includes(req.path) || req.path.startsWith("/qr");
  if (isWhatsApp) return next();
  express.json()(req, res, next);
});

// Header para ngrok não bloquear
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

/**
 * GET /api/files/list?path=EMPRESAS/Grupo Fleury/NFS
 * Lista arquivos (XML, PDF) de uma pasta. Path é relativo a BASE_PATH.
 */
app.get("/api/files/list", (req, res) => {
  const relPath = req.query.path;
  if (!relPath || typeof relPath !== "string") {
    return res.status(400).json({ error: "Query 'path' é obrigatória" });
  }
  const fullPath = path.join(BASE_PATH, relPath);
  if (!path.resolve(fullPath).startsWith(path.resolve(BASE_PATH))) {
    return res.status(403).json({ error: "Path fora do diretório base" });
  }
  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .filter((e) => /\.(xml|pdf)$/i.test(e.name))
      .map((e) => ({
        name: e.name,
        ext: path.extname(e.name).toLowerCase(),
        path: path.join(relPath, e.name).replace(/\\/g, "/"),
      }));
    return res.json({ files });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Pasta não encontrada" });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/files/download?path=EMPRESAS/Grupo Fleury/NFS/arquivo.xml
 * Baixa um arquivo por path direto (para testes, sem JWT).
 */
app.get("/api/files/download", (req, res) => {
  const inputPath = req.query.path;
  if (!inputPath || typeof inputPath !== "string") {
    return res.status(400).json({ error: "Query 'path' é obrigatória" });
  }
  const baseResolved = path.resolve(BASE_PATH);
  const normalizedInput = inputPath.trim();
  const fullPath = path.isAbsolute(normalizedInput)
    ? path.resolve(normalizedInput)
    : path.resolve(path.join(BASE_PATH, normalizedInput));
  if (!fullPath.startsWith(baseResolved)) {
    return res.status(403).json({ error: "Path fora do diretório base" });
  }
  try {
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
    const filename = path.basename(fullPath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".xml" ? "application/xml" : ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fiscal-documents/:id/download
 * Baixa arquivo fiscal por ID (busca file_path no Supabase). Requer JWT.
 */
app.get("/api/fiscal-documents/:id/download", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }
  const token = authHeader.slice(7);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase não configurado" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: doc, error } = await supabase
    .from("fiscal_documents")
    .select("file_path")
    .eq("id", req.params.id)
    .single();
  if (error || !doc?.file_path) {
    return res.status(404).json({ error: "Documento não encontrado" });
  }
  const fullPath = path.join(BASE_PATH, doc.file_path);
  if (!path.resolve(fullPath).startsWith(path.resolve(BASE_PATH))) {
    return res.status(403).json({ error: "Path inválido" });
  }
  try {
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: "Arquivo não encontrado no disco" });
    }
    const filename = path.basename(fullPath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".xml" ? "application/xml" : ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fiscal-documents/download-zip
 * Cria um ZIP temporário na VM com os arquivos dos documentos solicitados (mesma lista/filtro da tela),
 * envia o ZIP na resposta e apaga o arquivo temporário em seguida.
 * Body: { ids: string[] }. Requer JWT.
 */
app.post("/api/fiscal-documents/download-zip", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }
  const token = authHeader.slice(7);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => id && String(id).trim()) : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: "Nenhum documento selecionado para baixar." });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase não configurado" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: rows, error } = await supabase
    .from("fiscal_documents")
    .select("id, file_path")
    .in("id", ids);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  const docs = (rows || []).filter((r) => r?.file_path && String(r.file_path).trim());
  const baseResolved = path.resolve(BASE_PATH);
  const toAdd = [];
  for (const doc of docs) {
    const fullPath = path.join(BASE_PATH, doc.file_path);
    if (!path.resolve(fullPath).startsWith(baseResolved)) continue;
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;
    toAdd.push({ fullPath, name: path.basename(doc.file_path) });
  }
  if (toAdd.length === 0) {
    return res.status(404).json({ error: "Nenhum arquivo encontrado no disco para os documentos solicitados." });
  }
  const usedNames = new Set();
  const makeUniqueName = (name) => {
    let n = name;
    let i = 0;
    while (usedNames.has(n)) {
      i++;
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      n = `${base} (${i})${ext}`;
    }
    usedNames.add(n);
    return n;
  };
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="documentos-fiscais.zip"');
  const archive = archiver("zip", { zlib: { level: 0 } });
  archive.on("error", (err) => {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });
  archive.pipe(res);
  for (const { fullPath, name } of toAdd) {
    archive.file(fullPath, { name: makeUniqueName(name) });
  }
  archive.finalize();
});

/**
 * POST /api/fiscal-sync
 * Sincroniza arquivos de uma pasta para fiscal_documents.
 * Body: { path, company_id, type }
 * Requer Authorization: Bearer <jwt_do_usuario> — usa só anon key; RLS valida permissão.
 */
app.post("/api/fiscal-sync", async (req, res) => {
  const { path: relPath, company_id, type = "NFS" } = req.body || {};
  if (!relPath || !company_id) {
    return res.status(400).json({ error: "path e company_id são obrigatórios" });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente. Envie Authorization: Bearer <jwt>." });
  }
  const token = authHeader.slice(7);
  const fullPath = path.join(BASE_PATH, relPath);
  if (!path.resolve(fullPath).startsWith(path.resolve(BASE_PATH))) {
    return res.status(403).json({ error: "Path fora do diretório base" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase não configurado (SUPABASE_URL e SUPABASE_ANON_KEY)" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .filter((e) => /\.(xml|pdf)$/i.test(e.name));
    const periodo = new Date().toISOString().slice(0, 7);
    const inserted = [];
    const errors = [];
    for (const f of files) {
      const fileRelPath = path.join(relPath, f.name).replace(/\\/g, "/");
      const chave = path.basename(f.name, path.extname(f.name));
      const { data: existingRows } = await supabase
        .from("fiscal_documents")
        .select("id")
        .eq("company_id", company_id)
        .eq("file_path", fileRelPath)
        .limit(1);
      if (existingRows && existingRows.length > 0) continue;
      const { data, error } = await supabase
        .from("fiscal_documents")
        .insert({
          company_id,
          type: type.toUpperCase(),
          chave,
          periodo,
          status: "novo",
          file_path: fileRelPath,
        })
        .select("id");
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.id) inserted.push({ id: row.id, name: f.name });
      else if (error?.code === "23505") { /* duplicata, ignorar */ }
      else if (error) errors.push({ name: f.name, error: error.message });
    }
    return res.json({
      found: files.length,
      inserted: inserted.length,
      files: inserted,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fiscal-sync-all
 * Escaneia BASE_PATH/EMPRESAS, associa cada pasta ao company_id pelo nome da empresa,
 * e sincroniza arquivos XML/PDF de FISCAL/NFS/Recebidas e FISCAL/NFS/Emitidas para fiscal_documents.
 * Requer Authorization: Bearer <jwt>.
 * Normaliza nomes (remove acentos/cedilha) para casar pasta "SERVICOS" com empresa "SERVIÇOS".
 */
function normalizeCompanyName(name) {
  if (typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function walkDir(dir, baseDir) {
  const results = [];
  const fullDir = path.join(baseDir, dir);
  if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) return results;
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const e of entries) {
    const rel = path.join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) {
      results.push(...walkDir(rel, baseDir));
    } else if (e.isFile() && /\.(xml|pdf)$/i.test(e.name)) {
      results.push(rel);
    }
  }
  return results;
}

/**
 * Executa a sincronização completa EMPRESAS -> fiscal_documents.
 * Inclui remoção: registros cujo arquivo não existe mais na pasta são removidos do banco.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Cliente Supabase (JWT do usuário ou service role)
 * @returns {{ inserted: number, skipped: number, deleted: number, errors: Array<{ file: string, error: string }> }}
 */
async function runFiscalSyncAll(supabase) {
  const result = { inserted: 0, skipped: 0, deleted: 0, errors: [] };
  const empresasPath = BASE_PATH;
  const empresasExists = fs.existsSync(empresasPath) && fs.statSync(empresasPath).isDirectory();
  const allPathsOnDisk = empresasExists ? new Set(walkDir("", BASE_PATH)) : new Set();

  const { data: companies } = await supabase.from("companies").select("id, name");
  const nameToId = new Map((companies || []).map((c) => [normalizeCompanyName(c.name), c.id]));
  /** Por company_id: Set de file_path que existem no disco. Inicializa para todas as empresas (vazio se pasta não existir). */
  const pathsOnDiskByCompany = new Map((companies || []).map((c) => [c.id, new Set()]));

  if (!empresasExists) {
    // Pasta base não existe: espelhar “zerando” para qualquer documento salvo no fiscal_documents.
    const { data: rows } = await supabase
      .from("fiscal_documents")
      .select("id, file_path")
      .not("file_path", "is", null);
    const idsToDelete = (rows || []).map((r) => r.id);
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("fiscal_documents").delete().in("id", idsToDelete);
      if (!deleteError) result.deleted += idsToDelete.length;
    }
    return result;
  }

  const companyDirs = fs.readdirSync(empresasPath, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const companyDir of companyDirs) {
    const companyName = companyDir.name;
    const companyId = nameToId.get(normalizeCompanyName(companyName));
    if (!companyId) continue;
    const pathsOnDisk = pathsOnDiskByCompany.get(companyId);

    for (const sub of ["Recebidas", "Emitidas"]) {
      const segment = path.join(companyName, "FISCAL", "NFS", sub).replace(/\\/g, "/");
      const files = walkDir(segment, BASE_PATH);
      for (const fileRel of files) {
        pathsOnDisk.add(fileRel);
        const chave = path.basename(fileRel, path.extname(fileRel));
        const parts = fileRel.split(/[/\\]/);
        let periodo = new Date().toISOString().slice(0, 7);
        const y = parts.find((p) => /^\d{4}$/.test(p));
        const m = parts.find((p) => /^\d{2}$/.test(p) && parseInt(p, 10) >= 1 && parseInt(p, 10) <= 12);
        if (y && m) periodo = `${y}-${m}`;
        const { data: existingRows } = await supabase
          .from("fiscal_documents")
          .select("id")
          .eq("company_id", companyId)
          .eq("file_path", fileRel)
          .limit(1);
        if (existingRows && existingRows.length > 0) {
          result.skipped++;
          continue;
        }
        const { error } = await supabase.from("fiscal_documents").insert({
          company_id: companyId,
          type: "NFS",
          chave,
          periodo,
          status: "novo",
          file_path: fileRel,
        });
        if (error) {
          if (error.code === "23505") {
            result.skipped++;
          } else {
            result.errors.push({ file: fileRel, error: error.message });
          }
        } else {
          result.inserted++;
        }
      }
    }
  }

  // Espelhamento genérico: remover do banco todo registro cujo arquivo não existe mais no disco.
  const { data: rowsToMirrorDelete } = await supabase
    .from("fiscal_documents")
    .select("id, file_path")
    .not("file_path", "is", null);
  const idsToDelete = (rowsToMirrorDelete || [])
    .filter((r) => !allPathsOnDisk.has(r.file_path))
    .map((r) => r.id);
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from("fiscal_documents").delete().in("id", idsToDelete);
    if (!deleteError) result.deleted += idsToDelete.length;
  }

  return result;
}

app.post("/api/fiscal-sync-all", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente. Envie Authorization: Bearer <jwt>." });
  }
  const token = authHeader.slice(7);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase não configurado no server-api. No .env da VM defina SUPABASE_URL e SUPABASE_ANON_KEY.",
    });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    const { inserted, skipped, deleted, errors } = await runFiscalSyncAll(supabase);
    return res.json({ ok: true, inserted, skipped, deleted: deleted ?? 0, errors: errors.length ? errors : undefined });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, basePath: BASE_PATH }));

/**
 * GET /api/folder-structure
 * Retorna a árvore de pastas (flat) para robôs montarem o path.
 * Path na VM: BASE_PATH/EMPRESAS/{nome_empresa}/{segmentos do nó}
 * Leitura pública (anon) para robôs sem JWT.
 */
app.get("/api/folder-structure", async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase não configurado" });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("folder_structure_nodes")
      .select("id, parent_id, name, slug, date_rule, position")
      .order("parent_id", { nullsFirst: true })
      .order("position", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ nodes: data ?? [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/robot-config?technical_id=xxx
 * Retorna configuração para o robô na VM: base_path (global), segment_path e date_rule do robô.
 * Robôs usam isso em vez de BASE_PATH e ROBOT_SEGMENT_PATH no .env (que passam a ser opcionais).
 */
app.get("/api/robot-config", async (req, res) => {
  const technicalId = (req.query.technical_id || "").toString().trim();
  if (!technicalId) {
    return res.status(400).json({ error: "technical_id é obrigatório" });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase não configurado" });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: robot, error: robotErr } = await supabase
      .from("robots")
      .select("segment_path, notes_mode")
      .eq("technical_id", technicalId)
      .maybeSingle();
    if (robotErr) return res.status(500).json({ error: robotErr.message });
    const segmentPath = (robot?.segment_path || "").trim() || null;
    const notesMode = (robot?.notes_mode || "").trim() || null;
    const { data: nodes, error: nodesErr } = await supabase
      .from("folder_structure_nodes")
      .select("id, parent_id, name, slug, date_rule, position")
      .order("parent_id", { nullsFirst: true })
      .order("position", { ascending: true });
    if (nodesErr) return res.status(500).json({ error: nodesErr.message });
    const dateRule = segmentPath ? findDateRuleByPath(nodes ?? [], segmentPath) : null;
    return res.json({
      base_path: BASE_PATH,
      segment_path: segmentPath,
      date_rule: dateRule,
      notes_mode: notesMode,
      folder_structure: nodes ?? [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Repassa todo o restante para o backend WhatsApp (não mexe no backend; ele roda em outra porta na VM)
const WHATSAPP_BACKEND_URL = process.env.WHATSAPP_BACKEND_URL || "http://localhost:3010";
app.use(
  createProxyMiddleware({
    target: WHATSAPP_BACKEND_URL,
    changeOrigin: true,
    onError: (err, req, res) => {
      res.status(502).json({ error: "Backend WhatsApp indisponível", detail: err.message });
    },
  })
);

/** Monitoramento automático: quando novos arquivos chegam em EMPRESAS, sincroniza com Supabase. */
function startFiscalWatcher() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log("[fiscal-watcher] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente; monitoramento automático desligado.");
    return;
  }
  const empresasPath = BASE_PATH;
  if (!fs.existsSync(empresasPath) || !fs.statSync(empresasPath).isDirectory()) {
    console.log("[fiscal-watcher] Pasta base da VM não encontrada; monitoramento desligado.");
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  let debounceTimer = null;
  const DEBOUNCE_MS = 4000;

  const runSync = () => {
    runFiscalSyncAll(supabase)
      .then(({ inserted, skipped, deleted, errors }) => {
        if (inserted > 0 || deleted > 0 || errors.length > 0) {
          console.log(`[fiscal-watcher] Sync: ${inserted} inseridos, ${skipped} já existentes${deleted ? `, ${deleted} removidos` : ""}${errors.length ? `, ${errors.length} erros` : ""}`);
        }
      })
      .catch((err) => console.error("[fiscal-watcher] Erro ao sincronizar:", err.message));
  };

  try {
    fs.watch(empresasPath, { recursive: true }, (eventType, filename) => {
      if (!filename || !/\.(xml|pdf)$/i.test(filename)) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runSync();
      }, DEBOUNCE_MS);
    });
    console.log("[fiscal-watcher] Monitorando a pasta base da VM — novos XML/PDF serão sincronizados automaticamente.");
  } catch (err) {
    console.error("[fiscal-watcher] Não foi possível monitorar a pasta base da VM:", err.message);
  }
}

loadBasePathFromSupabase().then(() => {
  app.listen(PORT, () => {
    console.log(`API unificada em http://localhost:${PORT}`);
    console.log(`BASE_PATH: ${BASE_PATH}`);
    console.log(`Proxy WhatsApp: ${WHATSAPP_BACKEND_URL}`);
    startFiscalWatcher();
  });
});


