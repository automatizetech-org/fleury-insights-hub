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
