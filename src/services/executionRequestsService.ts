import { supabase } from "./supabaseClient"
import type { Tables } from "@/types/database"

export type ExecutionRequest = Tables<"execution_requests">

export async function createExecutionRequest(params: {
  companyIds: string[]
  robotTechnicalIds: string[]
  periodStart?: string | null
  periodEnd?: string | null
  notesMode?: "recebidas" | "emitidas" | "both" | null
}): Promise<ExecutionRequest> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("execution_requests")
    .insert({
      company_ids: params.companyIds,
      robot_technical_ids: params.robotTechnicalIds,
      period_start: params.periodStart ?? null,
      period_end: params.periodEnd ?? null,
      notes_mode: params.notesMode ?? null,
      status: "pending",
      created_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as ExecutionRequest
}

export async function getRecentExecutionRequests(limit = 20): Promise<ExecutionRequest[]> {
  const { data, error } = await supabase
    .from("execution_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ExecutionRequest[]
}

/** Execuções com status running; opcionalmente filtradas por regra de agendamento. */
export async function getRunningExecutionRequests(scheduleRuleId?: string | null): Promise<ExecutionRequest[]> {
  let q = supabase
    .from("execution_requests")
    .select("*")
    .eq("status", "running")
  if (scheduleRuleId) {
    q = q.eq("schedule_rule_id", scheduleRuleId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ExecutionRequest[]
}
