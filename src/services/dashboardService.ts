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
  }))
}
