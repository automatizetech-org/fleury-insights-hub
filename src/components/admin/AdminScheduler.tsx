import { useState, useEffect, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getCompaniesForUser } from "@/services/companiesService"
import { getRobots } from "@/services/robotsService"
import { createExecutionRequest } from "@/services/executionRequestsService"
import {
  getScheduleRules,
  getActiveScheduleRules,
  createScheduleRule,
  updateScheduleRule,
  pauseScheduleRule,
} from "@/services/scheduleRulesService"
import { getRunningExecutionRequests } from "@/services/executionRequestsService"
import {
  upsertRobotDisplayConfigForRobots,
} from "@/services/robotDisplayConfigService"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarClock, Play, Loader2, Bot, Building2, Square } from "lucide-react"
import { toast } from "sonner"
import { format, subDays } from "date-fns"

const DEBOUNCE_MS = 800

export function AdminScheduler({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [companyIds, setCompanyIds] = useState<Set<string>>(new Set())
  const [robotIds, setRobotIds] = useState<Set<string>>(new Set())
  const [allRobots, setAllRobots] = useState(false)
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"))
  const [periodEnd, setPeriodEnd] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd"))
  const [runDaily, setRunDaily] = useState(false)
  const [dailyTime, setDailyTime] = useState("08:00")
  const [submitting, setSubmitting] = useState(false)
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null)

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies-scheduler"],
    queryFn: () => getCompaniesForUser("all"),
  })

  const { data: robots = [] } = useQuery({
    queryKey: ["admin-robots"],
    queryFn: getRobots,
  })

  const { data: scheduleRules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["schedule-rules"],
    queryFn: getScheduleRules,
    refetchOnWindowFocus: true,
  })

  const { data: activeRules = [] } = useQuery({
    queryKey: ["schedule-rules-active"],
    queryFn: getActiveScheduleRules,
    refetchOnWindowFocus: true,
  })

  const activeRule = activeRules.length > 0 ? activeRules[0] : null

  const { data: runningExecutions = [] } = useQuery({
    queryKey: ["execution-requests-running", activeRule?.id],
    queryFn: () => getRunningExecutionRequests(activeRule?.id ?? undefined),
    enabled: !!activeRule?.id,
    refetchOnWindowFocus: true,
  })

  const isExecutingNow = runningExecutions.length > 0

  useEffect(() => {
    if (activeRule && !activeRuleId) {
      setActiveRuleId(activeRule.id)
      setCompanyIds(new Set(activeRule.company_ids || []))
      setRobotIds(new Set(activeRule.robot_technical_ids?.filter((id) => id !== "all") || []))
      setAllRobots(activeRule.robot_technical_ids?.includes("all") ?? false)
      setPeriodStart(activeRule.period_start || periodStart)
      setPeriodEnd(activeRule.period_end || periodEnd)
      const t = String(activeRule.run_at_time).slice(0, 5)
      setDailyTime(t)
      setRunDaily(true)
    }
  }, [activeRule?.id])

  const techIds = allRobots ? ["all"] : Array.from(robotIds)
  const firstRobotNotesMode = allRobots ? null : (robots.find((r) => robotIds.has(r.technical_id))?.notes_mode ?? null)
  const robotIdsForConfig = allRobots ? (robots.map((r) => r.technical_id)) : Array.from(robotIds)

  const persistDisplayConfig = useCallback(() => {
    const robotIdsToUpdate = robotIdsForConfig.length > 0 ? robotIdsForConfig : robots.map((r) => r.technical_id)
    if (robotIdsToUpdate.length === 0) return
    upsertRobotDisplayConfigForRobots(robotIdsToUpdate, {
      companyIds: Array.from(companyIds),
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      notesMode: firstRobotNotesMode ?? undefined,
    }).catch(() => {})
  }, [companyIds, periodStart, periodEnd, firstRobotNotesMode, robotIdsForConfig, robots])

  useEffect(() => {
    const t = setTimeout(persistDisplayConfig, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [companyIds, periodStart, periodEnd, firstRobotNotesMode, robotIdsForConfig, persistDisplayConfig])

  const toggleCompany = (id: string) => {
    setCompanyIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRobot = (technicalId: string) => {
    setRobotIds((prev) => {
      const next = new Set(prev)
      if (next.has(technicalId)) next.delete(technicalId)
      else next.add(technicalId)
      return next
    })
  }

  const selectAllCompanies = () => {
    if (companyIds.size === companies.length) setCompanyIds(new Set())
    else setCompanyIds(new Set(companies.map((c) => c.id)))
  }

  const handleRun = async () => {
    if (companyIds.size === 0) {
      toast.error("Selecione ao menos uma empresa.")
      return
    }
    if (techIds.length === 0) {
      toast.error("Selecione ao menos um robô ou marque 'Todos os robôs'.")
      return
    }
    setSubmitting(true)
    try {
      if (runDaily) {
        const payload = {
          companyIds: Array.from(companyIds),
          robotTechnicalIds: techIds,
          notesMode: firstRobotNotesMode ?? undefined,
          periodStart,
          periodEnd,
          runAtTime: dailyTime,
          runDaily: true,
        }
        if (scheduleRules.length > 0) {
          await updateScheduleRule(scheduleRules[0].id, payload)
          toast.success("Agendamento atualizado. O sistema executará automaticamente no horário definido.")
        } else {
          await createScheduleRule(payload)
          toast.success("Agendamento diário ativado. O sistema executará automaticamente no horário definido.")
        }
        await upsertRobotDisplayConfigForRobots(robotIdsForConfig, {
          companyIds: Array.from(companyIds),
          periodStart,
          periodEnd,
          notesMode: firstRobotNotesMode ?? undefined,
        })
        queryClient.invalidateQueries({ queryKey: ["schedule-rules"] })
        queryClient.invalidateQueries({ queryKey: ["schedule-rules-active"] })
      } else {
        await createExecutionRequest({
          companyIds: Array.from(companyIds),
          robotTechnicalIds: techIds,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          notesMode: firstRobotNotesMode ?? undefined,
        })
        await upsertRobotDisplayConfigForRobots(robotIdsForConfig, {
          companyIds: Array.from(companyIds),
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          notesMode: firstRobotNotesMode ?? undefined,
        })
        queryClient.invalidateQueries({ queryKey: ["execution-requests"] })
        queryClient.invalidateQueries({ queryKey: ["execution-requests-running"] })
        toast.success("Execução disparada. Os robôs em execução irão processar a fila.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao disparar.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleStop = async () => {
    if (!activeRule?.id) return
    setSubmitting(true)
    try {
      await pauseScheduleRule(activeRule.id)
      setActiveRuleId(null)
      queryClient.invalidateQueries({ queryKey: ["schedule-rules"] })
      queryClient.invalidateQueries({ queryKey: ["schedule-rules-active"] })
      toast.success("Agendamento pausado.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao pausar.")
    } finally {
      setSubmitting(false)
    }
  }

  const isActive = activeRule != null

  if (!isSuperAdmin) return null

  return (
    <GlassCard className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold font-display">Agendador — Executar robôs</h3>
      </div>
      <div className="p-4 space-y-4">
            {isActive && (
              <>
                {isExecutingNow && (
                  <div className="rounded-md bg-amber-500/20 border border-amber-500/50 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    Executando agora — robôs processando a fila. Status dos robôs: &quot;Executando&quot;.
                  </div>
                )}
                {!isExecutingNow && (
                  <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    Aguardando — rotina diária ativa. Os robôs executarão no horário configurado (ou já executaram hoje).
                  </div>
                )}
                <div className="rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-primary">
                  Rotina diária ativa: {activeRule.run_at_time} (período {activeRule.period_start} a {activeRule.period_end}). O Supabase dispara a execução automaticamente a cada minuto.
                </div>
              </>
            )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Empresas
            </Label>
            <Button type="button" variant="ghost" size="sm" className="text-[10px] h-7" onClick={selectAllCompanies}>
              {companyIds.size === companies.length ? "Desmarcar todas" : "Marcar todas"}
            </Button>
          </div>
          <div className="max-h-32 overflow-y-auto rounded border border-border bg-muted/30 p-2 space-y-1">
            {companies.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada.</p>
            ) : (
              companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                  <Checkbox
                    checked={companyIds.has(c.id)}
                    onCheckedChange={() => toggleCompany(c.id)}
                  />
                  <span className="text-xs truncate">{c.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium flex items-center gap-1 mb-2">
            <Bot className="h-3.5 w-3.5" />
            Robôs
          </Label>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <Checkbox
              checked={allRobots}
              onCheckedChange={(c) => setAllRobots(!!c)}
            />
            <span className="text-xs font-medium">Todos os robôs</span>
          </label>
          {!allRobots && (
            <div className="max-h-24 overflow-y-auto rounded border border-border bg-muted/30 p-2 space-y-1">
              {robots.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum robô vinculado.</p>
              ) : (
                robots.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                    <Checkbox
                      checked={robotIds.has(r.technical_id)}
                      onCheckedChange={() => toggleRobot(r.technical_id)}
                    />
                    <span className="text-xs truncate">{r.display_name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Data inicial</Label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Data final</Label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={runDaily}
            onChange={(e) => setRunDaily(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-xs font-medium">Rodar diariamente no horário abaixo</span>
        </label>
        {runDaily && (
          <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-[10px] text-muted-foreground space-y-1">
            <p><strong>Primeira execução:</strong> usa o período completo (data inicial → data final) que você definiu.</p>
            <p><strong>Próximas execuções (24h depois):</strong> roda só o dia anterior, para manter tudo em dia.</p>
          </div>
        )}
        {runDaily && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Horário da execução</Label>
            <input
              type="time"
              value={dailyTime}
              onChange={(e) => setDailyTime(e.target.value)}
              className="mt-0.5 w-full max-w-[120px] rounded border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        )}

        <div className="flex gap-2">
          {isActive ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleStop}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
              Parar agendamento
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRun}
              disabled={submitting || companyIds.size === 0 || (robotIds.size === 0 && !allRobots)}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Executar
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
