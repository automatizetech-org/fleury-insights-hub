/**
 * Cliente da API WhatsApp (QR, grupos, envio).
 * Servidor: backend/whatsapp-emissor/server.js — mesma lógica de conexão do WhatsApp_emissor.
 * Base URL: WHATSAPP_API (ex: http://localhost:3010)
 * Endpoints: GET /status, GET /qr, GET /groups, POST /send { groupId, message } — envia apenas para o grupo selecionado.
 */

const BASE = (import.meta as unknown as { env?: { WHATSAPP_API?: string } }).env?.WHATSAPP_API ?? "";

/** Headers para requisições. Inclui header do ngrok para pular página de aviso quando a base for ngrok. */
function getHeaders(extra?: HeadersInit): HeadersInit {
  const base = BASE.toLowerCase();
  const isNgrok = base.includes("ngrok");
  return {
    ...(extra as object),
    ...(isNgrok ? { "ngrok-skip-browser-warning": "true" } : {}),
  };
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

export interface ConnectionStatus {
  connected: boolean;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  if (!BASE) return { connected: false };
  try {
    const res = await fetch(`${BASE}/status`, { method: "GET", headers: getHeaders() });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: !!data?.connected };
  } catch {
    return { connected: false };
  }
}

/** Retorna a imagem do QR atual (base64 data URL). Retorna null se já conectado ou se o backend ainda não tem QR. */
export async function getQrImage(): Promise<string | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/qr`, { method: "GET", cache: "no-store", headers: getHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.connected) return null;
    const qr = data?.qr ?? data?.image ?? null;
    if (typeof qr === "string" && qr.startsWith("data:image/") && qr.length >= 200) return qr;
    // Backend retornou que não tem QR ainda — não chamar /qr.png para evitar dezenas de requisições
    if (qr === null || qr === undefined) return null;
    const pngRes = await fetch(`${BASE.replace(/\/$/, "")}/qr.png?t=${Date.now()}`, { cache: "no-store", headers: getHeaders() });
    if (pngRes.ok && pngRes.headers.get("content-type")?.startsWith("image/")) {
      const blob = await pngRes.blob();
      return await new Promise<string | null>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    }
    return null;
  } catch {
    return null;
  }
}

/** URL do QR em PNG (sem cache). */
export function getQrImageUrl(): string {
  if (!BASE) return "";
  return `${BASE.replace(/\/$/, "")}/qr.png?t=${Date.now()}`;
}

/** URL do QR com timestamp controlado (para refresh periódico no img). */
export function getQrImageUrlWithTimestamp(ts: number): string {
  if (!BASE) return "";
  return `${BASE.replace(/\/$/, "")}/qr.png?t=${ts}`;
}

export async function getGroups(forceRefresh = false): Promise<WhatsAppGroup[]> {
  if (!BASE) return [];
  try {
    const url = forceRefresh ? `${BASE}/groups?refresh=1` : `${BASE}/groups`;
    const res = await fetch(url, { method: "GET", headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.groups) ? data.groups : [];
  } catch {
    return [];
  }
}

export interface WhatsAppAttachment {
  filename: string;
  mimetype: string;
  dataBase64: string;
}

export async function sendToGroup(
  groupId: string,
  message: string,
  attachments?: WhatsAppAttachment[]
): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "API não configurada" };
  const controller = new AbortController();
  const timeoutMs = 90_000; // 90s para envio com anexos
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: { groupId: string; message: string; attachments?: WhatsAppAttachment[] } = {
      groupId,
      message,
    };
    if (attachments && attachments.length > 0) body.attachments = attachments;
    const res = await fetch(`${BASE}/send`, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: string }).error ?? "Falha ao enviar";
      return { ok: false, error: res.status === 408 ? "Demorou para conectar na API. Tente de novo." : msg };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === "AbortError") return { ok: false, error: "Tempo esgotado. Verifique a conexão com a API WhatsApp e tente novamente." };
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Erro de conexão" };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Conectar WhatsApp (inicia o cliente; sessão é mantida). */
export async function connectWhatsApp(): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "API não configurada" };
  try {
    const res = await fetch(`${BASE}/connect`, { method: "POST", headers: getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Falha ao conectar" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

/** Desconectar WhatsApp (mantém a sessão para reconectar depois). */
export async function disconnectWhatsApp(): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "API não configurada" };
  try {
    const res = await fetch(`${BASE}/disconnect`, { method: "POST", headers: getHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Falha ao desconectar" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}
