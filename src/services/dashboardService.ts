import { supabase } from "./supabaseClient"

export async function getDashboardCounts(companyIds: string[] | null) {
  const filterByCompany = companyIds && companyIds.length > 0
  const companyFilter = filterByCompany ? companyIds : undefined

  const [companiesRes, docsRes] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    companyFilter
      ? supabase.from("fiscal_documents").select("id", { count: "exact", head: true }).in("company_id", companyFilter)
      : supabase.from("fiscal_documents").select("id", { count: "exact", head: true }),
  ])

  return {
    companiesCount: companiesRes.count ?? 0,
    documentsCount: docsRes.count ?? 0,
  }
}

export async function getRecentFiscalDocuments(companyIds: string[] | null, limit: number) {
  let q = supabase
    .from("fiscal_documents")
    .select("id, company_id, type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const list = data ?? []
  const companyIdsList = [...new Set(list.map((d) => d.company_id))]
  if (companyIdsList.length === 0) return []
  const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIdsList)
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]))
  return list.map((d) => ({
    ...d,
    companyName: names.get(d.company_id) ?? "",
  }))
}

export async function getFiscalDocumentsByType(
  type: "NFS" | "NFE" | "NFC",
  companyIds: string[] | null
) {
  // file_path omitido do select para não quebrar em projetos sem a coluna.
  // Para habilitar download por caminho, rode a migration 00000002_fiscal_documents_file_path.sql
  // e descomente file_path no select e use: file_path: d.file_path ?? null no return.
  let q = supabase
    .from("fiscal_documents")
    .select("id, company_id, type, chave, periodo, status, document_date, file_path, created_at")
    .eq("type", type)
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const list = data ?? []
  const companyIdsList = [...new Set(list.map((d) => d.company_id))]
  if (companyIdsList.length === 0) return []
  const { data: companies } = await supabase.from("companies").select("id, name, document").in("id", companyIdsList)
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]))
  const documents = new Map((companies ?? []).map((c) => [c.id, c.document]))
  return list.map((d) => ({
    ...d,
    empresa: names.get(d.company_id) ?? "",
    cnpj: documents.get(d.company_id) ?? "",
    file_path: (d as { file_path?: string | null }).file_path ?? null,
  }))
}

/** Lista documentos NFE e NFC juntos (para o tópico unificado NFE/NFC). */
export async function getFiscalDocumentsNfeNfc(companyIds: string[] | null) {
  let q = supabase
    .from("fiscal_documents")
    .select("id, company_id, type, chave, periodo, status, document_date, file_path, created_at")
    .in("type", ["NFE", "NFC"])
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const list = data ?? []
  const companyIdsList = [...new Set(list.map((d) => d.company_id))]
  if (companyIdsList.length === 0) return []
  const { data: companies } = await supabase.from("companies").select("id, name, document").in("id", companyIdsList)
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]))
  const documents = new Map((companies ?? []).map((c) => [c.id, c.document]))
  return list.map((d) => ({
    ...d,
    empresa: names.get(d.company_id) ?? "",
    cnpj: documents.get(d.company_id) ?? "",
    file_path: (d as { file_path?: string | null }).file_path ?? null,
  }))
}

/** Resumo fiscal para a visão geral: totais por tipo (NFS, NFE, NFC) com métricas (total, disponíveis, este mês). Opcional: period YYYY-MM para filtrar por período. */
export async function getFiscalSummary(companyIds: string[] | null, period?: string) {
  let q = supabase.from("fiscal_documents").select("type, file_path, created_at, periodo")
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  const periodFilter = period && /^\d{4}-\d{2}$/.test(period) ? period : null
  const rowsFiltered = periodFilter
    ? rows.filter((r) => (r.periodo || "").trim() === periodFilter)
    : rows
  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  type ByTypeMetric = { total: number; disponiveis: number; esteMes: number }
  const byType: Record<string, ByTypeMetric> = {
    NFS: { total: 0, disponiveis: 0, esteMes: 0 },
    NFE: { total: 0, disponiveis: 0, esteMes: 0 },
    NFC: { total: 0, disponiveis: 0, esteMes: 0 },
  }
  for (const r of rowsFiltered) {
    const t = (r.type || "NFS").toUpperCase() as "NFS" | "NFE" | "NFC"
    if (!byType[t]) byType[t] = { total: 0, disponiveis: 0, esteMes: 0 }
    byType[t].total++
    if (r.file_path && String(r.file_path).trim()) byType[t].disponiveis++
    const p = (r.periodo || "").trim()
    if (/^\d{4}-\d{2}$/.test(p) && p === mesAtual) byType[t].esteMes++
  }
  const totalXmls = rowsFiltered.length
  const totalDisponiveis = rowsFiltered.filter((r) => r.file_path && String(r.file_path).trim()).length
  const totalEsteMes = rowsFiltered.filter((r) => {
    const p = (r.periodo || "").trim()
    return /^\d{4}-\d{2}$/.test(p) && p === mesAtual
  }).length
  return {
    byType,
    totalXmls,
    totalDisponiveis,
    totalEsteMes,
  }
}

/** Lista todos os documentos fiscais (NFS, NFE, NFC) para a página Documentos. */
export async function getAllFiscalDocuments(companyIds: string[] | null) {
  let q = supabase
    .from("fiscal_documents")
    .select("id, company_id, type, chave, periodo, status, document_date, file_path, created_at")
    .in("type", ["NFS", "NFE", "NFC"])
    .order("created_at", { ascending: false })
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const list = data ?? []
  const companyIdsList = [...new Set(list.map((d) => d.company_id))]
  if (companyIdsList.length === 0) return []
  const { data: companies } = await supabase.from("companies").select("id, name, document").in("id", companyIdsList)
  const names = new Map((companies ?? []).map((c) => [c.id, c.name]))
  const documents = new Map((companies ?? []).map((c) => [c.id, c.document]))
  return list.map((d) => ({
    ...d,
    empresa: names.get(d.company_id) ?? "",
    cnpj: documents.get(d.company_id) ?? "",
    file_path: (d as { file_path?: string | null }).file_path ?? null,
  }))
}
