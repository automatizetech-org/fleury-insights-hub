/**
 * Cliente da API WhatsApp (QR, grupos, envio).
 * Servidor: backend/whatsapp-emissor/server.js — mesma lógica de conexão do WhatsApp_emissor.
 * Base URL: VITE_WHATSAPP_API (ex: http://localhost:3010)
 * Endpoints: GET /status, GET /qr, GET /groups, POST /send { groupId, message } — envia apenas para o grupo selecionado.
 */

const BASE = (import.meta as unknown as { env?: { VITE_WHATSAPP_API?: string } }).env?.VITE_WHATSAPP_API ?? "";

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
    const res = await fetch(`${BASE}/status`, { method: "GET" });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: !!data?.connected };
  } catch {
    return { connected: false };
  }
}

/** Retorna a imagem do QR atual (base64 data URL). Atualiza quando o whatsapp-web.js emite novo QR (~20s). */
export async function getQrImage(): Promise<string | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/qr`, { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const qr = data?.qr ?? data?.image ?? null;
    if (typeof qr !== "string") return null;
    // Só retornar se for um data URL válido de imagem com conteúdo (evita mostrar placeholder quebrado)
    if (!qr.startsWith("data:image/") || qr.length < 200) return null;
    return qr;
  } catch {
    return null;
  }
}

/** URL do QR em PNG (sem cache). */
export function getQrImageUrl(): string {
  if (!BASE) return "";
  return `${BASE.replace(/\/$/, "")}/qr.png?t=${Date.now()}`;
}

export async function getGroups(): Promise<WhatsAppGroup[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/groups`, { method: "GET" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.groups) ? data.groups : [];
  } catch {
    return [];
  }
}

export async function sendToGroup(groupId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "API não configurada" };
  try {
    const res = await fetch(`${BASE}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: string }).error ?? "Falha ao enviar" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

/** Conectar WhatsApp (inicia o cliente; sessão é mantida). */
export async function connectWhatsApp(): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "API não configurada" };
  try {
    const res = await fetch(`${BASE}/connect`, { method: "POST" });
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
    const res = await fetch(`${BASE}/disconnect`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Falha ao desconectar" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}
