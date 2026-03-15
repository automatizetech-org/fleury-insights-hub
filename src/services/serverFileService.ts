/**
 * ServiÃ§o para download de arquivos (XMLs, guias, etc.) via API do seu servidor.
 * Os arquivos ficam no servidor (onde os robÃ´s rodam); o Supabase guarda sÃ³ metadados.
 * Ver docs/SERVER_FILES_API.md para o contrato da API no servidor.
 */

import JSZip from "jszip";
import { supabase } from "./supabaseClient";

const SERVER_API_URL = import.meta.env.SERVER_API_URL?.replace(/\/$/, "") ?? "";

export function getServerApiUrl(): string {
  return SERVER_API_URL;
}

export function hasServerApi(): boolean {
  return SERVER_API_URL.length > 0;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function fetchServerFileByPath(filePath: string): Promise<{ blob: Blob; filename: string }> {
  if (!SERVER_API_URL) {
    throw new Error("SERVER_API_URL nÃ£o configurada.");
  }
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) {
    throw new Error("Caminho do arquivo nÃ£o informado.");
  }
  const url = new URL(`${SERVER_API_URL}/api/files/download`);
  url.searchParams.set("path", normalizedPath);
  const headers: Record<string, string> = {};
  if (SERVER_API_URL.toLowerCase().includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Arquivo nÃ£o encontrado no servidor.");
    if (res.status === 403) throw new Error("Sem permissÃ£o para baixar este arquivo.");
    throw new Error(`Erro ao baixar arquivo: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim() ||
    normalizedPath.split(/[\\/]/).pop() ||
    "arquivo.pdf";
  return { blob, filename };
}

/**
 * Baixa o XML de um documento fiscal via API do servidor.
 * O servidor valida o JWT e devolve o arquivo do disco.
 */
export async function downloadFiscalDocument(documentId: string, suggestedName?: string): Promise<void> {
  if (!SERVER_API_URL) {
    console.warn("SERVER_API_URL nÃ£o configurada; download nÃ£o disponÃ­vel.");
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("FaÃ§a login para baixar o arquivo.");
  }
  const url = `${SERVER_API_URL}/api/fiscal-documents/${encodeURIComponent(documentId)}/download`;
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (SERVER_API_URL.toLowerCase().includes("ngrok")) headers["ngrok-skip-browser-warning"] = "true";
  const res = await fetch(url, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Sem permissÃ£o para baixar este documento.");
    if (res.status === 404) throw new Error("Documento ou arquivo nÃ£o encontrado.");
    throw new Error(`Erro ao baixar: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim() ||
    suggestedName ||
    `documento-${documentId}.xml`;
  triggerBlobDownload(blob, filename);
}

export async function downloadServerFileByPath(filePath: string, suggestedName?: string): Promise<void> {
  const { blob, filename } = await fetchServerFileByPath(filePath);
  triggerBlobDownload(blob, suggestedName || filename);
}

export async function downloadServerFilesZip(filePaths: string[], suggestedName = "guias-municipais"): Promise<void> {
  const paths = filePaths.map((filePath) => String(filePath || "").trim()).filter(Boolean);
  if (paths.length === 0) {
    throw new Error("Nenhum arquivo selecionado para baixar.");
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const makeUniqueName = (name: string) => {
    let candidate = name;
    let i = 0;
    while (usedNames.has(candidate)) {
      i += 1;
      const dotIndex = name.lastIndexOf(".");
      const base = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
      const ext = dotIndex >= 0 ? name.slice(dotIndex) : "";
      candidate = `${base} (${i})${ext}`;
    }
    usedNames.add(candidate);
    return candidate;
  };

  await Promise.all(
    paths.map(async (filePath) => {
      const { blob, filename } = await fetchServerFileByPath(filePath);
      zip.file(makeUniqueName(filename), blob);
    })
  );

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  triggerBlobDownload(zipBlob, `${suggestedName}.zip`);
}

/** Marca o documento fiscal como baixado (atualiza last_downloaded_at para retenÃ§Ã£o). */
export async function markFiscalDocumentDownloaded(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("fiscal_documents")
    .update({ last_downloaded_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) console.warn("NÃ£o foi possÃ­vel atualizar last_downloaded_at:", error.message);
}

/**
 * Baixa vÃ¡rios documentos fiscais em um Ãºnico ZIP.
 * A VM cria um ZIP temporÃ¡rio com os arquivos da lista solicitada, envia na resposta e apaga o temp em seguida.
 * @param ids - IDs dos documentos
 * @param filenameSuffix - Sufixo do nome do arquivo (ex.: "nfs", "nfe-nfc"); o download serÃ¡ documentos-fiscais-{suffix}.zip
 */
export async function downloadFiscalDocumentsZip(ids: string[], filenameSuffix?: string): Promise<void> {
  if (!SERVER_API_URL) {
    throw new Error("SERVER_API_URL nÃ£o configurada.");
  }
  const idsFiltered = ids.filter((id) => id && String(id).trim());
  if (idsFiltered.length === 0) {
    throw new Error("Nenhum documento selecionado para baixar.");
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("FaÃ§a login para baixar.");
  }
  const url = `${SERVER_API_URL}/api/fiscal-documents/download-zip`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
  if (SERVER_API_URL.toLowerCase().includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids: idsFiltered }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const text = await res.text();
    const msg = text.length > 200 ? text.slice(0, 200) + "â€¦" : text;
    throw new Error(
      "A resposta veio em HTML em vez do ZIP. Verifique se SERVER_API_URL no .env aponta para a URL da API (ex.: do ngrok), nÃ£o para a pÃ¡gina do app. Detalhe: " + msg
    );
  }

  if (!res.ok) {
    let message = `Erro ${res.status} ao baixar ZIP`;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json && typeof json.error === "string") message = json.error;
    } catch {
      if (text && !text.startsWith("<")) message = text.slice(0, 150);
    }
    throw new Error(message);
  }

  if (!contentType.includes("application/zip") && !contentType.includes("application/octet-stream")) {
    throw new Error("Resposta nÃ£o Ã© um ZIP (content-type: " + contentType + "). Verifique SERVER_API_URL.");
  }

  const safeSuffix = filenameSuffix && /^[a-z0-9-]+$/i.test(filenameSuffix) ? filenameSuffix : "";
  const zipFilename = safeSuffix ? `documentos-fiscais-${safeSuffix}.zip` : "documentos-fiscais.zip";

  const blob = await res.blob();
  triggerBlobDownload(blob, zipFilename);

  for (const id of idsFiltered) {
    markFiscalDocumentDownloaded(id).catch(() => {});
  }
}

/**
 * Sincroniza todos os arquivos fiscais da pasta EMPRESAS na VM para fiscal_documents (Supabase).
 * Usa o JWT da sessÃ£o atual. Chamar ao abrir Fiscal/Documentos ou ao clicar em "Sincronizar".
 */
export async function fiscalSyncAll(): Promise<{ ok: boolean; inserted: number; skipped: number; deleted: number; errors?: Array<{ file: string; error: string }> }> {
  if (!SERVER_API_URL) {
    throw new Error("SERVER_API_URL nÃ£o configurada.");
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("FaÃ§a login para sincronizar.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  if (SERVER_API_URL.toLowerCase().includes("ngrok")) headers["ngrok-skip-browser-warning"] = "true";
  const res = await fetch(`${SERVER_API_URL}/api/fiscal-sync-all`, { method: "POST", headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error ?? body?.message ?? `Erro ${res.status} ao sincronizar`;
    throw new Error(msg);
  }
  return { ok: true, inserted: body.inserted ?? 0, skipped: body.skipped ?? 0, deleted: body.deleted ?? 0, errors: body.errors };
}
