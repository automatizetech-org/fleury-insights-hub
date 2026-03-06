/**
 * API de arquivos — Fleury Insights Hub
 * Roda na VM (porta 3001). Expõe listagem de pastas e download de documentos fiscais.
 *
 * Estrutura esperada no disco:
 *   BASE_PATH/
 *   └── EMPRESAS/
 *       └── Grupo Fleury/
 *           └── NFS/
 *               ├── arquivo.xml
 *               └── arquivo.pdf
 *
 * Configure BASE_PATH no .env (ex: C:\Users\ROBO\Documents)
 */

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3001;

// Base path dos arquivos na VM (ex: C:\Users\ROBO\Documents)
const BASE_PATH = process.env.BASE_PATH || "C:\\Users\\ROBO\\Documents";

app.use(cors());
app.use(express.json());

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
  const relPath = req.query.path;
  if (!relPath || typeof relPath !== "string") {
    return res.status(400).json({ error: "Query 'path' é obrigatória" });
  }
  const fullPath = path.join(BASE_PATH, relPath);
  if (!path.resolve(fullPath).startsWith(path.resolve(BASE_PATH))) {
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
    for (const f of files) {
      const fileRelPath = path.join(relPath, f.name).replace(/\\/g, "/");
      const chave = path.basename(f.name, path.extname(f.name));
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
        .select("id")
        .single();
      if (!error) inserted.push({ id: data.id, name: f.name });
    }
    return res.json({ inserted: inserted.length, files: inserted });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, basePath: BASE_PATH }));

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  console.log(`BASE_PATH: ${BASE_PATH}`);
});
