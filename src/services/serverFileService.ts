/**
 * Serviço para download de arquivos (XMLs, guias, etc.) via API do seu servidor.
 * Os arquivos ficam no servidor (onde os robôs rodam); o Supabase guarda só metadados.
 * Ver docs/SERVER_FILES_API.md para o contrato da API no servidor.
 */

import { supabase } from "./supabaseClient";

const SERVER_API_URL = import.meta.env.SERVER_API_URL?.replace(/\/$/, "") ?? "";

export function getServerApiUrl(): string {
  return SERVER_API_URL;
}

export function hasServerApi(): boolean {
  return SERVER_API_URL.length > 0;
}

/**
 * Baixa o XML de um documento fiscal via API do servidor.
 * O servidor valida o JWT e devolve o arquivo do disco.
 */
export async function downloadFiscalDocument(documentId: string, suggestedName?: string): Promise<void> {
  if (!SERVER_API_URL) {
    console.warn("SERVER_API_URL não configurada; download não disponível.");
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Faça login para baixar o arquivo.");
  }
  const url = `${SERVER_API_URL}/api/fiscal-documents/${encodeURIComponent(documentId)}/download`;
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (SERVER_API_URL.toLowerCase().includes("ngrok")) headers["ngrok-skip-browser-warning"] = "true";
  const res = await fetch(url, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Sem permissão para baixar este documento.");
    if (res.status === 404) throw new Error("Documento ou arquivo não encontrado.");
    throw new Error(`Erro ao baixar: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim() ||
    suggestedName ||
    `documento-${documentId}.xml`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Marca o documento fiscal como baixado (atualiza last_downloaded_at para retenção). */
export async function markFiscalDocumentDownloaded(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("fiscal_documents")
    .update({ last_downloaded_at: new Date().toISOString() })
    .eq("id", documentId)
  if (error) console.warn("Não foi possível atualizar last_downloaded_at:", error.message)
}

/**
 * Sincroniza todos os arquivos fiscais da pasta EMPRESAS na VM para fiscal_documents (Supabase).
 * Usa o JWT da sessão atual. Chamar ao abrir Fiscal/Documentos ou ao clicar em "Sincronizar".
 */
export async function fiscalSyncAll(): Promise<{ ok: boolean; inserted: number; skipped: number; deleted: number; errors?: Array<{ file: string; error: string }> }> {
  if (!SERVER_API_URL) {
    throw new Error("SERVER_API_URL não configurada.");
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Faça login para sincronizar.");
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
