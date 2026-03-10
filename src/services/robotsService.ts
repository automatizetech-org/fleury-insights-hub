import { supabase } from "./supabaseClient"
import type { Tables, TablesUpdate } from "@/types/database"

export type Robot = Tables<"robots">
export type RobotStatus = Robot["status"]

export async function getRobots(): Promise<Robot[]> {
  const { data, error } = await supabase
    .from("robots")
    .select("*")
    .order("display_name")
  if (error) throw error
  return (data ?? []) as Robot[]
}

export async function updateRobotDisplayName(
  id: string,
  displayName: string
): Promise<Robot> {
  const { data, error } = await supabase
    .from("robots")
    .update({ display_name: displayName.trim() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Robot
}

export async function updateRobot(
  id: string,
  updates: {
    display_name?: string
    segment_path?: string | null
    notes_mode?: "recebidas" | "emitidas" | "both" | null
    date_execution_mode?: "competencia" | "interval" | null
    initial_period_start?: string | null
    initial_period_end?: string | null
    last_period_end?: string | null
  }
): Promise<Robot> {
  const { data, error } = await supabase
    .from("robots")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Robot
}
