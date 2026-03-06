import { supabase } from "./supabaseClient"
import type { Company } from "./profilesService"

export async function getCompaniesForUser(activeFilter?: "active" | "inactive" | "all") {
  let q = supabase.from("companies").select("*").order("name")
  if (activeFilter === "active") q = q.eq("active", true)
  else if (activeFilter === "inactive") q = q.eq("active", false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Company[]
}

export async function createCompany(params: {
  name: string
  document?: string | null
  auth_mode?: "password" | "certificate" | null
  cert_blob_b64?: string | null
  cert_password?: string | null
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: params.name,
      document: params.document ?? null,
      auth_mode: params.auth_mode ?? null,
      cert_blob_b64: params.cert_blob_b64 ?? null,
      cert_password: params.cert_password ?? null,
      created_by: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return data as Company
}

export async function updateCompany(
  id: string,
  updates: {
    name?: string
    document?: string | null
    active?: boolean
    auth_mode?: "password" | "certificate" | null
    cert_blob_b64?: string | null
    cert_password?: string | null
  }
) {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Company
}
