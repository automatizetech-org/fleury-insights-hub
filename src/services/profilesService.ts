import { supabase } from "./supabaseClient"
import type { Database } from "@/types/database"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Company = Database["public"]["Tables"]["companies"]["Row"]
export type CompanyMembership = Database["public"]["Tables"]["company_memberships"]["Row"]

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function getProfilesForAdmin() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return data as Profile[]
}

export async function updateProfile(
  id: string,
  updates: { username?: string; role?: string; panel_access?: Record<string, boolean> }
) {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data as Profile
}

export type AdminUser = Profile & { email: string | null }

const SUPABASE_URL = import.meta.env.SUPABASE_URL ?? ""
const ANON_KEY = import.meta.env.SUPABASE_ANON_KEY ?? ""

export async function getUsersForAdmin(): Promise<AdminUser[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("Não autenticado")
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-users-admin`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      "X-User-Token": session.access_token,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || data?.detail || "Falha ao listar usuários")
  return Array.isArray(data) ? data : []
}
