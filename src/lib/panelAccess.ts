/**
 * Chave de painel para cada rota. Usado no sidebar (panel_access) e no guard de rota.
 * /admin não tem panelKey — controle só por role super_admin.
 */
export const PATH_TO_PANEL: Record<string, string> = {
  "/dashboard": "dashboard",
  "/fiscal": "fiscal",
  "/dp": "dp",
  "/contabil": "contabil",
  "/paralegal": "paralegal",
  "/financeiro": "financeiro",
  "/operacoes": "operacoes",
  "/documentos": "documentos",
  "/empresas": "empresas",
  "/alteracao-empresarial": "alteracao_empresarial",
  "/sync": "sync",
}

export const PANEL_KEYS = [
  "dashboard",
  "fiscal",
  "dp",
  "contabil",
  "paralegal",
  "financeiro",
  "operacoes",
  "documentos",
  "empresas",
  "alteracao_empresarial",
  "sync",
] as const

export type PanelKey = (typeof PANEL_KEYS)[number]

export const PANEL_LABELS: Record<PanelKey, string> = {
  dashboard: "Dashboard",
  fiscal: "Fiscal",
  dp: "Depto. Pessoal",
  contabil: "Contábil",
  paralegal: "Paralegal",
  financeiro: "Financeiro",
  operacoes: "Operações",
  documentos: "Documentos",
  empresas: "Empresas",
  alteracao_empresarial: "Alteração Empresarial",
  sync: "Sincronização",
}

/** Retorna a chave do painel para um path (ex: /fiscal/nfs -> fiscal). /admin não tem panelKey. */
export function pathToPanelKey(pathname: string): string | null {
  for (const [path, key] of Object.entries(PATH_TO_PANEL)) {
    if (pathname === path || pathname.startsWith(path + "/")) return key
  }
  return null
}
