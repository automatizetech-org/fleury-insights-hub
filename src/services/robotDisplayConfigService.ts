import { supabase } from "./supabaseClient"
import type { RobotNotesMode, Tables } from "@/types/database"

export type RobotDisplayConfig = Tables<"robot_display_config">

const ROBOT_NFS_ID = "nfs_padrao"

export async function getRobotDisplayConfig(
  robotTechnicalId: string = ROBOT_NFS_ID
): Promise<RobotDisplayConfig | null> {
  const { data, error } = await supabase
    .from("robot_display_config")
    .select("*")
    .eq("robot_technical_id", robotTechnicalId)
    .maybeSingle()
  if (error) throw error
  return data as RobotDisplayConfig | null
}

export async function upsertRobotDisplayConfig(params: {
  robotTechnicalId: string
  companyIds: string[]
  periodStart?: string | null
  periodEnd?: string | null
  notesMode?: RobotNotesMode | null
}): Promise<RobotDisplayConfig> {
  const { data, error } = await supabase
    .from("robot_display_config")
    .upsert(
      {
        robot_technical_id: params.robotTechnicalId,
        company_ids: params.companyIds,
        period_start: params.periodStart ?? null,
        period_end: params.periodEnd ?? null,
        notes_mode: params.notesMode ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "robot_technical_id" }
    )
    .select()
    .single()
  if (error) throw error
  return data as RobotDisplayConfig
}

export async function upsertRobotDisplayConfigForRobots(
  robotTechnicalIds: string[],
  params: {
    companyIds: string[]
    periodStart?: string | null
    periodEnd?: string | null
    notesMode?: RobotNotesMode | null
  }
): Promise<void> {
  for (const id of robotTechnicalIds) {
    await upsertRobotDisplayConfig({
      robotTechnicalId: id,
      companyIds: params.companyIds,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      notesMode: params.notesMode,
    })
  }
}
