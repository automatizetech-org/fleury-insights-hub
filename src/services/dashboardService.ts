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

/** Resumo NFS: totais e ranking de códigos de serviço (nfs_stats, preenchido pelo robô). period = YYYY-MM. */
export async function getNfsStats(companyIds: string[] | null, period?: string) {
  const periodFilter = period && /^\d{4}-\d{2}$/.test(period) ? period : null
  const now = new Date()
  const defPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const p = periodFilter || defPeriod
  let q = supabase
    .from("nfs_stats")
    .select("qty_emitidas, qty_recebidas, valor_emitidas, valor_recebidas, service_codes")
    .eq("period", p)
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  let totalQty = 0
  let valorEmitidas = 0
  let valorRecebidas = 0
  const codeIndex = new Map<string, { code: string; description: string; total_value: number }>()
  for (const r of rows) {
    totalQty += Number(r.qty_emitidas ?? 0) + Number(r.qty_recebidas ?? 0)
    valorEmitidas += Number(r.valor_emitidas ?? 0)
    valorRecebidas += Number(r.valor_recebidas ?? 0)
    const codes = (r.service_codes as { code?: string; description?: string; total_value?: number }[]) ?? []
    for (const c of codes) {
      const key = `${c.code ?? ""}|${c.description ?? ""}`
      const existing = codeIndex.get(key)
      const val = Number(c.total_value ?? 0)
      if (existing) {
        existing.total_value += val
      } else {
        codeIndex.set(key, {
          code: String(c.code ?? ""),
          description: String(c.description ?? ""),
          total_value: val,
        })
      }
    }
  }
  const serviceCodesRanking = [...codeIndex.values()]
    .filter((x) => x.code || x.description)
    .sort((a, b) => b.total_value - a.total_value)
  return {
    period: p,
    totalQty,
    valorEmitidas,
    valorRecebidas,
    serviceCodesRanking,
  }
}

/** Agrega nfs_stats para todos os meses entre dateFrom e dateTo (YYYY-MM-DD). */
export async function getNfsStatsByDateRange(companyIds: string[] | null, dateFrom: string, dateTo: string) {
  const from = dateFrom.slice(0, 7)
  const to = dateTo.slice(0, 7)
  if (from > to) return getNfsStatsByDateRange(companyIds, dateTo, dateFrom)
  const months: string[] = []
  const yFrom = parseInt(from.slice(0, 4), 10)
  const mFrom = parseInt(from.slice(5, 7), 10)
  const yTo = parseInt(to.slice(0, 4), 10)
  const mTo = parseInt(to.slice(5, 7), 10)
  for (let y = yFrom; y <= yTo; y++) {
    const mStart = y === yFrom ? mFrom : 1
    const mEnd = y === yTo ? mTo : 12
    for (let m = mStart; m <= mEnd; m++) {
      months.push(`${y}-${String(m).padStart(2, "0")}`)
    }
  }
  if (months.length === 0) {
    const now = new Date()
    months.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  }
  let q = supabase
    .from("nfs_stats")
    .select("qty_emitidas, qty_recebidas, valor_emitidas, valor_recebidas, service_codes, service_codes_emitidas, service_codes_recebidas")
    .in("period", months)
  if (companyIds && companyIds.length > 0) {
    q = q.in("company_id", companyIds)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  let totalQty = 0
  let valorEmitidas = 0
  let valorRecebidas = 0
  const codeIndex = new Map<string, { code: string; description: string; total_value: number }>()
  const codeIndexEmitidas = new Map<string, { code: string; description: string; total_value: number }>()
  const codeIndexRecebidas = new Map<string, { code: string; description: string; total_value: number }>()
  for (const r of rows) {
    totalQty += Number(r.qty_emitidas ?? 0) + Number(r.qty_recebidas ?? 0)
    valorEmitidas += Number(r.valor_emitidas ?? 0)
    valorRecebidas += Number(r.valor_recebidas ?? 0)
    const codes = (r.service_codes as { code?: string; description?: string; total_value?: number }[]) ?? []
    for (const c of codes) {
      const key = `${c.code ?? ""}|${c.description ?? ""}`
      const existing = codeIndex.get(key)
      const val = Number(c.total_value ?? 0)
      if (existing) {
        existing.total_value += val
      } else {
        codeIndex.set(key, {
          code: String(c.code ?? ""),
          description: String(c.description ?? ""),
          total_value: val,
        })
      }
    }
    const codesEmitidas = (r.service_codes_emitidas as { code?: string; description?: string; total_value?: number }[] | null) ?? []
    for (const c of codesEmitidas) {
      const key = `${c.code ?? ""}|${c.description ?? ""}`
      const existing = codeIndexEmitidas.get(key)
      const val = Number(c.total_value ?? 0)
      if (existing) {
        existing.total_value += val
      } else {
        codeIndexEmitidas.set(key, {
          code: String(c.code ?? ""),
          description: String(c.description ?? ""),
          total_value: val,
        })
      }
    }
    const codesRecebidas = (r.service_codes_recebidas as { code?: string; description?: string; total_value?: number }[] | null) ?? []
    for (const c of codesRecebidas) {
      const key = `${c.code ?? ""}|${c.description ?? ""}`
      const existing = codeIndexRecebidas.get(key)
      const val = Number(c.total_value ?? 0)
      if (existing) {
        existing.total_value += val
      } else {
        codeIndexRecebidas.set(key, {
          code: String(c.code ?? ""),
          description: String(c.description ?? ""),
          total_value: val,
        })
      }
    }
  }
  const serviceCodesRanking = [...codeIndex.values()]
    .filter((x) => x.code || x.description)
    .sort((a, b) => b.total_value - a.total_value)
  const serviceCodesRankingPrestadas = [...codeIndexEmitidas.values()]
    .filter((x) => x.code || x.description)
    .sort((a, b) => b.total_value - a.total_value)
  const serviceCodesRankingTomadas = [...codeIndexRecebidas.values()]
    .filter((x) => x.code || x.description)
    .sort((a, b) => b.total_value - a.total_value)
  return {
    period: months.length === 1 ? months[0] : `${months[0]} a ${months[months.length - 1]}`,
    totalQty,
    valorEmitidas,
    valorRecebidas,
    serviceCodesRanking,
    serviceCodesRankingPrestadas,
    serviceCodesRankingTomadas,
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
