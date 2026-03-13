import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Building2,
  Clock3,
  Crown,
  FileBadge2,
  FolderClock,
  Landmark,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanies } from "@/hooks/useCompanies"
import {
  QUALIFICACAO_DISPLAY,
  fetchSalarioMinimoBCB,
  qualificacaoFromHonorario,
  type QualificacaoPlano,
} from "@/services/bcbSalarioMinimoService"
import {
  CERTIFICATE_EXPIRY_WARNING_DAYS,
  getParalegalCertificates,
  getParalegalCertificateSummary,
  type CertificateStatus,
} from "@/services/paralegalService"
import {
  getLatestMunicipalTaxRuns,
  getMunicipalTaxDebts,
  getMunicipalTaxSummary,
  type MunicipalTaxDebtView,
  type MunicipalTaxStatusClass,
} from "@/services/municipalTaxesService"
import { cn } from "@/utils"

type Topic = "overview" | "certificados" | "tarefas" | "clientes" | "taxas-impostos"
type CertificateFilter = "todos" | CertificateStatus
type ClientTier = QualificacaoPlano

type MockTask = {
  id: string
  titulo: string
  empresa: string
  prioridade: "alta" | "media" | "baixa"
  prazo: string
  responsavel: string
  status: "em_dia" | "vence_hoje" | "atrasada"
}

type MunicipalTaxFiltersState = {
  search: string
  companyId: string
  year: string
  status: "todos" | MunicipalTaxStatusClass
  periodFrom: string
  periodTo: string
}

const CLIENT_TIER_ORDER: ClientTier[] = ["DIAMANTE", "OURO", "PRATA", "BRONZE"]

const TOPIC_LINKS: Array<{ label: string; path: string; topic: Topic }> = [
  { label: "Visao Geral", path: "/paralegal", topic: "overview" },
  { label: "Certificados", path: "/paralegal/certificados", topic: "certificados" },
  { label: "Tarefas", path: "/paralegal/tarefas", topic: "tarefas" },
  { label: "Clientes", path: "/paralegal/clientes", topic: "clientes" },
  { label: "Taxas e Impostos", path: "/paralegal/taxas-impostos", topic: "taxas-impostos" },
]

const CERTIFICATE_STATUS_META: Record<CertificateStatus, { label: string; tone: string; chartColor: string }> = {
  ativo: { label: "Ativo", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", chartColor: "#10B981" },
  vence_em_breve: { label: "Perto de vencer", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", chartColor: "#F59E0B" },
  vencido: { label: "Vencido", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300", chartColor: "#F43F5E" },
  sem_certificado: { label: "Sem certificado", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300", chartColor: "#64748B" },
}

const MUNICIPAL_TAX_META: Record<MunicipalTaxStatusClass, { label: string; tone: string; color: string }> = {
  vencido: { label: "Vencido", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300", color: "#F43F5E" },
  a_vencer: { label: "A vencer em ate 30 dias", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", color: "#F59E0B" },
  regular: { label: "Regular", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", color: "#10B981" },
}

const MOCK_TASKS: MockTask[] = [
  { id: "1", titulo: "Alteracao contratual", empresa: "Grupo Fleury", prioridade: "alta", prazo: "2026-03-12", responsavel: "Julia", status: "vence_hoje" },
  { id: "2", titulo: "Baixa estadual", empresa: "Tech Solutions Ltda", prioridade: "alta", prazo: "2026-03-10", responsavel: "Victor", status: "atrasada" },
  { id: "3", titulo: "Atualizacao cadastral na junta", empresa: "Comercio ABC", prioridade: "media", prazo: "2026-03-15", responsavel: "Carla", status: "em_dia" },
  { id: "4", titulo: "Renovacao de alvara", empresa: "Industria XYZ", prioridade: "baixa", prazo: "2026-03-21", responsavel: "Leandro", status: "em_dia" },
  { id: "5", titulo: "Assinatura de procuracao", empresa: "Nova Era Servicos", prioridade: "media", prazo: "2026-03-13", responsavel: "Julia", status: "vence_hoje" },
]

const MOCK_CLIENT_TIERS: Array<{ empresa: string; honorario: number; carteira: string }> = [
  { empresa: "Grupo Fleury", honorario: 3600, carteira: "Holding e societario" },
  { empresa: "Industria XYZ", honorario: 1800, carteira: "Societario e licencas" },
  { empresa: "Tech Solutions Ltda", honorario: 920, carteira: "Legalizacao" },
  { empresa: "Comercio ABC", honorario: 420, carteira: "Rotina basica" },
  { empresa: "Nova Era Servicos", honorario: 760, carteira: "Procuracoes e certidoes" },
]

const MOCK_SALARIO_MINIMO = 1518

function getTopicFromPath(pathname: string): Topic {
  if (pathname === "/paralegal/certificados") return "certificados"
  if (pathname === "/paralegal/tarefas") return "tarefas"
  if (pathname === "/paralegal/clientes") return "clientes"
  if (pathname === "/paralegal/taxas-impostos") return "taxas-impostos"
  return "overview"
}

function statusAccentColor(status: CertificateStatus) {
  if (status === "ativo") return "bg-emerald-500"
  if (status === "vence_em_breve") return "bg-amber-500"
  if (status === "vencido") return "bg-rose-500"
  return "bg-slate-400"
}

function formatDate(value: string | null) {
  if (!value) return "-"
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function formatDaysToExpiry(days: number | null) {
  if (days == null) return "Sem validade cadastrada"
  if (days < 0) return `Venceu ha ${Math.abs(days)} dia(s)`
  if (days === 0) return "Vence hoje"
  return `${days} dia(s) restantes`
}

function formatCnpj(value: string | null) {
  if (!value) return "-"
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function sortTableByDueDate(items: MunicipalTaxDebtView[]) {
  return [...items].sort((a, b) => {
    const aDate = a.data_vencimento ?? "9999-12-31"
    const bDate = b.data_vencimento ?? "9999-12-31"
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    return a.company_name.localeCompare(b.company_name)
  })
}

function TasksPanel() {
  const taskSummary = MOCK_TASKS.reduce(
    (acc, task) => {
      acc.total += 1
      if (task.prioridade === "alta") acc.alta += 1
      if (task.status === "atrasada") acc.atrasadas += 1
      if (task.status === "vence_hoje") acc.venceHoje += 1
      return acc
    },
    { total: 0, alta: 0, atrasadas: 0, venceHoje: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Tarefas no front" value={taskSummary.total.toString()} icon={FolderClock} />
        <StatsCard title="Prioridade alta" value={taskSummary.alta.toString()} icon={AlertTriangle} />
        <StatsCard title="Vencem hoje" value={taskSummary.venceHoje.toString()} icon={Clock3} />
        <StatsCard title="Atrasadas" value={taskSummary.atrasadas.toString()} icon={ShieldAlert} />
      </div>
    </div>
  )
}

function ClientsPanel({ salarioMinimo, salarioMinimoLoading }: { salarioMinimo: number; salarioMinimoLoading: boolean }) {
  const clientsWithTier = MOCK_CLIENT_TIERS.map((item) => {
    const tier = qualificacaoFromHonorario(item.honorario, salarioMinimo)
    return { ...item, tier, percentualSalarioMinimo: (item.honorario / salarioMinimo) * 100 }
  })

  const tierCounts = clientsWithTier.reduce<Record<ClientTier, number>>(
    (acc, item) => {
      acc[item.tier] += 1
      return acc
    },
    { BRONZE: 0, PRATA: 0, OURO: 0, DIAMANTE: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={QUALIFICACAO_DISPLAY.DIAMANTE.label} value={tierCounts.DIAMANTE.toString()} icon={Crown} />
        <StatsCard title={QUALIFICACAO_DISPLAY.OURO.label} value={tierCounts.OURO.toString()} icon={Crown} />
        <StatsCard title={QUALIFICACAO_DISPLAY.PRATA.label} value={tierCounts.PRATA.toString()} icon={Users} />
        <StatsCard title={QUALIFICACAO_DISPLAY.BRONZE.label} value={tierCounts.BRONZE.toString()} icon={Users} />
      </div>
      <GlassCard className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold font-display">Qualificacao por honorario</h3>
            <p className="mt-1 text-xs text-muted-foreground">Front apenas, usando a mesma logica do formulario baseada no salario minimo.</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-xs">
            <p className="text-muted-foreground">Salario minimo de referencia</p>
            <p className="mt-1 text-sm font-semibold">{salarioMinimoLoading ? "Consultando..." : formatCurrencyBRL(salarioMinimo)}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

function MunicipalTaxesPanel({
  filters,
  setFilters,
  items,
  isLoading,
  companies,
  latestRuns,
}: {
  filters: MunicipalTaxFiltersState
  setFilters: Dispatch<SetStateAction<MunicipalTaxFiltersState>>
  items: MunicipalTaxDebtView[]
  isLoading: boolean
  companies: Array<{ id: string; name: string }>
  latestRuns: Array<{ id: string; status: string; company_name: string | null; debts_found: number | null; created_at: string }>
}) {
  const summary = useMemo(() => getMunicipalTaxSummary(items), [items])
  const itemsSorted = useMemo(() => sortTableByDueDate(items), [items])

  const yearOptions = useMemo(() => {
    const values = [...new Set(items.map((item) => item.ano).filter((value): value is number => typeof value === "number"))]
    return values.sort((a, b) => b - a)
  }, [items])

  const statusChartData = useMemo(
    () =>
      (["vencido", "a_vencer", "regular"] as MunicipalTaxStatusClass[]).map((status) => ({
        key: status,
        name: MUNICIPAL_TAX_META[status].label,
        total: items.filter((item) => item.status_class === status).length,
        fill: MUNICIPAL_TAX_META[status].color,
      })),
    [items]
  )

  const companyChartData = useMemo(() => {
    const totals = new Map<string, number>()
    items.forEach((item) => {
      totals.set(item.company_name, (totals.get(item.company_name) ?? 0) + Number(item.valor || 0))
    })
    return [...totals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [items])

  const yearChartData = useMemo(() => {
    const totals = new Map<number, number>()
    items.forEach((item) => {
      const year = item.ano ?? 0
      totals.set(year, (totals.get(year) ?? 0) + Number(item.valor || 0))
    })
    return [...totals.entries()].map(([year, total]) => ({ name: String(year), total })).sort((a, b) => Number(a.name) - Number(b.name))
  }, [items])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total de debitos" value={formatCurrencyBRL(summary.totalValor)} icon={Landmark} />
        <StatsCard title="Total vencido" value={formatCurrencyBRL(summary.totalVencido)} icon={ShieldAlert} />
        <StatsCard title="Total a vencer" value={formatCurrencyBRL(summary.totalAVencer)} icon={Clock3} />
        <StatsCard title="Quantidade de debitos" value={summary.quantidadeDebitos.toString()} icon={FileBadge2} />
      </div>

      <GlassCard className="p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold font-display">Filtros da consulta municipal</h3>
          <p className="mt-1 text-xs text-muted-foreground">Filtre por empresa, ano, classificacao de vencimento e periodo.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Buscar por empresa, tributo ou documento..." className="pl-9" />
            </div>
          </div>
          <Select value={filters.companyId} onValueChange={(value) => setFilters((current) => ({ ...current, companyId: value }))}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as empresas</SelectItem>
              {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.year} onValueChange={(value) => setFilters((current) => ({ ...current, year: value }))}>
            <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {yearOptions.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value as MunicipalTaxFiltersState["status"] }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="a_vencer">A vencer em ate 30 dias</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
            </SelectContent>
          </Select>
          <Input value={filters.periodFrom} onChange={(event) => setFilters((current) => ({ ...current, periodFrom: event.target.value }))} type="date" />
          <Input value={filters.periodTo} onChange={(event) => setFilters((current) => ({ ...current, periodTo: event.target.value }))} type="date" />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Classificacao automatica</h3>
            <p className="mt-1 text-xs text-muted-foreground">Percentual de debitos vencidos, a vencer e regulares.</p>
          </div>
          <ChartContainer className="h-[280px] w-full" config={{ total: { label: "Debitos", color: "#2563EB" } }}>
            <PieChart>
              <Pie data={statusChartData} dataKey="total" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={3}>
                {statusChartData.map((entry) => <Cell key={entry.key} fill={entry.fill} />)}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {statusChartData.map((entry) => (
              <div key={entry.key} className="rounded-xl border border-border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
                <p className="mt-2 text-sm font-semibold">{entry.total}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Ultimas execucoes do robo</h3>
            <p className="mt-1 text-xs text-muted-foreground">Historico resumido da coleta municipal em Goiania.</p>
          </div>
          <div className="space-y-3">
            {latestRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma execucao registrada ainda.</p>
            ) : (
              latestRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{run.company_name || "Execucao geral"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(run.created_at.slice(0, 10))}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", run.status === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : run.status === "running" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : run.status === "failed" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")}>
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Debitos encontrados: {run.debts_found ?? 0}</p>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Distribuicao por empresa</h3>
            <p className="mt-1 text-xs text-muted-foreground">Top empresas com maior valor em debitos municipais.</p>
          </div>
          <ChartContainer className="h-[280px] w-full" config={{ total: { label: "Valor", color: "#2563EB" } }}>
            <BarChart data={companyChartData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatCurrencyBRL(Number(value))} />
              <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrencyBRL(Number(value))} />} />
              <Bar dataKey="total" fill="#2563EB" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ChartContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Distribuicao por ano</h3>
            <p className="mt-1 text-xs text-muted-foreground">Soma de valores agrupada pelo ano do debito.</p>
          </div>
          <ChartContainer className="h-[280px] w-full" config={{ total: { label: "Valor", color: "#0F766E" } }}>
            <BarChart data={yearChartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => formatCurrencyBRL(Number(value))} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrencyBRL(Number(value))} />} />
              <Bar dataKey="total" fill="#0F766E" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold font-display">Tabela completa de debitos</h3>
          <p className="mt-1 text-xs text-muted-foreground">Consulta consolidada de taxas e impostos municipais da Prefeitura de Goiania.</p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Carregando debitos municipais...</div>
          ) : itemsSorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum debito encontrado para os filtros informados.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Tributo</th>
                  <th className="px-4 py-3 font-medium">Ano</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Data de vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Situacao</th>
                  <th className="px-4 py-3 font-medium">Classificacao</th>
                </tr>
              </thead>
              <tbody>
                {itemsSorted.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-4 py-3 align-top"><p className="font-medium">{item.company_name}</p><p className="mt-1 text-xs text-muted-foreground">{formatCnpj(item.company_document)}</p></td>
                    <td className="px-4 py-3 align-top">{item.tributo || "-"}</td>
                    <td className="px-4 py-3 align-top">{item.ano || "-"}</td>
                    <td className="px-4 py-3 align-top">{item.numero_documento || "-"}</td>
                    <td className="px-4 py-3 align-top">{formatDate(item.data_vencimento)}</td>
                    <td className="px-4 py-3 align-top">{formatCurrencyBRL(Number(item.valor || 0))}</td>
                    <td className="px-4 py-3 align-top">{item.situacao || "-"}</td>
                    <td className="px-4 py-3 align-top"><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", MUNICIPAL_TAX_META[item.status_class].tone)}>{MUNICIPAL_TAX_META[item.status_class].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>
    </div>
  )
}

export default function ParalegalPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const topic = getTopicFromPath(location.pathname)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<CertificateFilter>("todos")
  const [municipalFilters, setMunicipalFilters] = useState<MunicipalTaxFiltersState>({
    search: "",
    companyId: "todos",
    year: "todos",
    status: "todos",
    periodFrom: "",
    periodTo: "",
  })

  const { data: companies = [] } = useCompanies()
  const { data: certificateItems = [], isLoading } = useQuery({
    queryKey: ["paralegal-certificates"],
    queryFn: () => getParalegalCertificates(null),
  })
  const { data: salarioMinimoData, isLoading: salarioMinimoLoading } = useQuery({
    queryKey: ["paralegal-salario-minimo"],
    queryFn: fetchSalarioMinimoBCB,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  })
  const { data: municipalDebts = [], isLoading: municipalDebtsLoading } = useQuery({
    queryKey: ["paralegal-municipal-taxes", municipalFilters],
    queryFn: () =>
      getMunicipalTaxDebts({
        companyIds: municipalFilters.companyId === "todos" ? null : [municipalFilters.companyId],
        year: municipalFilters.year,
        status: municipalFilters.status,
        dateFrom: municipalFilters.periodFrom || undefined,
        dateTo: municipalFilters.periodTo || undefined,
        search: municipalFilters.search,
      }),
  })
  const { data: municipalRuns = [] } = useQuery({
    queryKey: ["paralegal-municipal-tax-runs"],
    queryFn: () => getLatestMunicipalTaxRuns(8),
  })

  const salarioMinimo = salarioMinimoData ?? MOCK_SALARIO_MINIMO
  const certificateSummary = useMemo(() => getParalegalCertificateSummary(certificateItems), [certificateItems])
  const municipalSummary = useMemo(() => getMunicipalTaxSummary(municipalDebts), [municipalDebts])

  const filteredCertificates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return certificateItems.filter((item) => {
      const matchesFilter = filter === "todos" || item.certificate_status === filter
      const normalizedDocument = (item.document ?? "").replace(/\D/g, "")
      const normalizedQuery = query.replace(/\D/g, "")
      const matchesSearch = query.length === 0 || item.name.toLowerCase().includes(query) || normalizedDocument.includes(normalizedQuery)
      return matchesFilter && matchesSearch
    })
  }, [certificateItems, filter, search])

  const certificateBarData = useMemo(
    () => [
      { name: "Ativos", key: "ativo", total: certificateSummary.ativos, fill: CERTIFICATE_STATUS_META.ativo.chartColor },
      { name: "Perto de vencer", key: "vence_em_breve", total: certificateSummary.venceEmBreve, fill: CERTIFICATE_STATUS_META.vence_em_breve.chartColor },
      { name: "Vencidos", key: "vencido", total: certificateSummary.vencidos, fill: CERTIFICATE_STATUS_META.vencido.chartColor },
      { name: "Sem certificado", key: "sem_certificado", total: certificateSummary.semCertificado, fill: CERTIFICATE_STATUS_META.sem_certificado.chartColor },
    ],
    [certificateSummary]
  )

  const certificatePieData = useMemo(() => certificateBarData.filter((item) => item.total > 0), [certificateBarData])

  const overviewCards = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatsCard title="Certificados ativos" value={certificateSummary.ativos.toString()} icon={ShieldCheck} />
      <StatsCard title={`Vencem em ate ${CERTIFICATE_EXPIRY_WARNING_DAYS} dias`} value={certificateSummary.venceEmBreve.toString()} icon={AlertTriangle} />
      <StatsCard title="Certificados vencidos" value={certificateSummary.vencidos.toString()} icon={ShieldAlert} />
      <StatsCard title="Sem certificado" value={certificateSummary.semCertificado.toString()} icon={FileBadge2} />
    </div>
  )

  const certificatesPanel = (
    <div className="space-y-4">
      {overviewCards}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Status dos certificados</h3>
            <p className="mt-1 text-xs text-muted-foreground">Dados reais vindos das empresas cadastradas.</p>
          </div>
          <ChartContainer className="h-[280px] w-full" config={{ total: { label: "Empresas", color: "#2563EB" } }}>
            <BarChart data={certificateBarData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                {certificateBarData.map((entry) => <Cell key={entry.key} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </GlassCard>
        <GlassCard className="p-6">
          <h3 className="mb-4 text-sm font-semibold font-display">Distribuicao</h3>
          <ChartContainer className="h-[280px] w-full" config={{ ativo: { label: "Ativos", color: CERTIFICATE_STATUS_META.ativo.chartColor }, vence_em_breve: { label: "Perto de vencer", color: CERTIFICATE_STATUS_META.vence_em_breve.chartColor }, vencido: { label: "Vencidos", color: CERTIFICATE_STATUS_META.vencido.chartColor }, sem_certificado: { label: "Sem certificado", color: CERTIFICATE_STATUS_META.sem_certificado.chartColor } }}>
            <PieChart>
              <Pie data={certificatePieData} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {certificatePieData.map((entry) => <Cell key={entry.key} fill={entry.fill} />)}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
            </PieChart>
          </ChartContainer>
        </GlassCard>
      </div>
      <GlassCard className="overflow-hidden">
        <div className="space-y-3 border-b border-border p-4">
          <div>
            <h3 className="text-sm font-semibold font-display">Controle de certificados</h3>
            <p className="mt-1 text-xs text-muted-foreground">Filtre por status e abra a empresa no cadastro quando precisar renovar.</p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por empresa ou CNPJ..." className="xl:max-w-sm" />
            <div className="flex flex-wrap gap-2">
              {([
                { value: "todos", label: "Todos" },
                { value: "ativo", label: "Ativos" },
                { value: "vence_em_breve", label: "Perto de vencer" },
                { value: "vencido", label: "Vencidos" },
                { value: "sem_certificado", label: "Sem certificado" },
              ] as Array<{ value: CertificateFilter; label: string }>).map((option) => (
                <button key={option.value} type="button" onClick={() => setFilter(option.value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30", filter === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground")}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Carregando certificados...</div>
          ) : filteredCertificates.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum certificado encontrado para este filtro.</div>
          ) : (
            <div className="space-y-2.5">
              {filteredCertificates.map((item) => (
                <div key={item.id} className={cn("group relative overflow-hidden rounded-2xl border border-border bg-background/40 backdrop-blur-sm", "transition-colors hover:bg-background/60 hover:shadow-sm")}>
                  <div className={cn("absolute left-0 top-0 h-full w-1.5", statusAccentColor(item.certificate_status))} />
                  <div className="pl-4 pr-3 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13px] font-semibold">{item.name}</p>
                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", CERTIFICATE_STATUS_META[item.certificate_status].tone)}>{CERTIFICATE_STATUS_META[item.certificate_status].label}</span>
                          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", item.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300")}>{item.active ? "Empresa ativa" : "Empresa inativa"}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                          <div className="rounded-xl border border-border bg-background/40 px-2.5 py-1.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CNPJ</p><p className="mt-1 truncate font-medium text-foreground">{item.document ? formatCnpj(item.document) : "Nao informado"}</p></div>
                          <div className="rounded-xl border border-border bg-background/40 px-2.5 py-1.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Validade</p><p className="mt-1 font-medium text-foreground">{formatDate(item.cert_valid_until)}</p></div>
                          <div className="rounded-xl border border-border bg-background/40 px-2.5 py-1.5"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prazo</p><p className="mt-1 font-medium text-foreground">{formatDaysToExpiry(item.days_to_expiry)}</p></div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button type="button" size="sm" className="h-8 px-3 text-xs shadow-sm" onClick={() => navigate(`/empresas?editCompany=${item.id}&focus=certificate&mode=renew`)}>Renovar certificado</Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs bg-background/40" onClick={() => navigate(`/empresas?editCompany=${item.id}`)}>Abrir empresa</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Paralegal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle de certificados, tarefas, clientes e taxas municipais.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TOPIC_LINKS.map((item) => (
          <Link key={item.path} to={item.path} className={cn("rounded-lg border px-4 py-2 text-xs font-medium transition-colors", topic === item.topic ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
            {item.label}
          </Link>
        ))}
      </div>
      {topic === "overview" && (
        <div className="space-y-4">
          {overviewCards}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard className="p-6 lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold font-display">Resumo rapido do Paralegal</h3>
              <div className="space-y-3">
                {certificateBarData.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">{item.name}</span><span className="font-medium">{item.total}</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${certificateSummary.total ? (item.total / certificateSummary.total) * 100 : 0}%`, backgroundColor: item.fill }} /></div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="mb-3 text-sm font-semibold font-display">Taxas e impostos</h3>
              <div className="space-y-3 text-xs text-muted-foreground">
                <p>Empresas com debitos vencidos: <span className="font-semibold text-foreground">{municipalSummary.empresasComVencidos}</span></p>
                <p>Empresas com vencimento proximo: <span className="font-semibold text-foreground">{municipalSummary.empresasProximasVencimento}</span></p>
                <p>Total de debitos municipais: <span className="font-semibold text-foreground">{municipalSummary.quantidadeDebitos}</span></p>
                <p>Valor total monitorado: <span className="font-semibold text-foreground">{formatCurrencyBRL(municipalSummary.totalValor)}</span></p>
              </div>
            </GlassCard>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <StatsCard title="Empresas com debitos vencidos" value={municipalSummary.empresasComVencidos.toString()} icon={Building2} />
            <StatsCard title="Debitos proximos do vencimento" value={municipalDebts.filter((item) => item.status_class === "a_vencer").length.toString()} icon={Clock3} />
            <StatsCard title="Total de debitos municipais" value={municipalSummary.quantidadeDebitos.toString()} icon={Landmark} />
            <StatsCard title="Valor total em aberto" value={formatCurrencyBRL(municipalSummary.totalValor)} icon={AlertTriangle} />
          </div>
          <div className="space-y-4">
            <TasksPanel />
            <ClientsPanel salarioMinimo={salarioMinimo} salarioMinimoLoading={salarioMinimoLoading} />
          </div>
        </div>
      )}
      {topic === "certificados" && certificatesPanel}
      {topic === "tarefas" && <TasksPanel />}
      {topic === "clientes" && <ClientsPanel salarioMinimo={salarioMinimo} salarioMinimoLoading={salarioMinimoLoading} />}
      {topic === "taxas-impostos" && <MunicipalTaxesPanel filters={municipalFilters} setFilters={setMunicipalFilters} items={municipalDebts} isLoading={municipalDebtsLoading} companies={companies.map((company) => ({ id: company.id, name: company.name }))} latestRuns={municipalRuns.map((run) => ({ id: run.id, status: run.status, company_name: run.company_name, debts_found: run.debts_found, created_at: run.created_at }))} />}
    </div>
  )
}
