import { supabase } from "./supabaseClient"
import type { Tables } from "@/types/database"
import { CONTADORES_RESPONSAVEIS } from "@/constants/contadoresResponsaveis"

export type Accountant = Tables<"accountants">

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return value
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function getFallbackAccountants(): Accountant[] {
  const now = new Date().toISOString()
  return CONTADORES_RESPONSAVEIS.map((contador) => ({
    id: `fallback-${contador.cpf}`,
    name: contador.nome,
    cpf: contador.cpf,
    active: true,
    created_at: now,
    updated_at: now,
  }))
}

export async function getAccountants(activeOnly = true): Promise<Accountant[]> {
  try {
    let query = supabase.from("accountants").select("*").order("name")
    if (activeOnly) query = query.eq("active", true)
    const { data, error } = await query
    if (error) throw error

    const dbRows = (data ?? []) as Accountant[]
    const merged = new Map<string, Accountant>()

    for (const fallback of getFallbackAccountants()) {
      if (!activeOnly || fallback.active) {
        merged.set(onlyDigits(fallback.cpf), fallback)
      }
    }
    for (const accountant of dbRows) {
      if (!activeOnly || accountant.active) {
        merged.set(onlyDigits(accountant.cpf), accountant)
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  } catch {
    return getFallbackAccountants().filter((accountant) => !activeOnly || accountant.active)
  }
}

export function findAccountantByCpf(accountants: Accountant[], cpf: string | null | undefined) {
  const digits = onlyDigits(cpf ?? "")
  if (!digits) return null
  return accountants.find((accountant) => onlyDigits(accountant.cpf) === digits) ?? null
}
