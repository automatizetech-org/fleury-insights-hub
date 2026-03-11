import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AlertTriangle, Clock3, Crown, FileBadge2, FolderClock, ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { cn } from "@/utils"
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies"
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

type Topic = "overview" | "certificados" | "tarefas" | "clientes"
type CertificateFilter = "todos" | CertificateStatus

type MockTask = {
  id: string
  titulo: string
  empresa: string
  prioridade: "alta" | "media" | "baixa"
  prazo: string
  responsavel: string
  status: "em_dia" | "vence_hoje" | "atrasada"
}

type ClientTier = QualificacaoPlano

const CLIENT_TIER_ORDER: ClientTier[] = ["DIAMANTE", "OURO", "PRATA", "BRONZE"]

const CLIENT_TIER_META: Record<ClientTier, { label: string; emoji: string }> = {
  Bronze: { label: "Bronze", emoji: "🥉" },
  Prata: { label: "Prata", emoji: "🥈" },
  Ouro: { label: "Ouro", emoji: "🥇" },
  Diamante: { label: "Diamante", emoji: "💎" },
}

const TOPIC_LINKS: Array<{ label: string; path: string; topic: Topic }> = [
  { label: "Visao Geral", path: "/paralegal", topic: "overview" },
  { label: "Certificados", path: "/paralegal/certificados", topic: "certificados" },
  { label: "Tarefas", path: "/paralegal/tarefas", topic: "tarefas" },
  { label: "Clientes", path: "/paralegal/clientes", topic: "clientes" },
]

const CERTIFICATE_STATUS_META: Record<CertificateStatus, { label: string; tone: string; chartColor: string }> = {
  ativo: {
    label: "Ativo",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    chartColor: "#10B981",
  },
  vence_em_breve: {
    label: "Perto de vencer",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    chartColor: "#F59E0B",
  },
  vencido: {
    label: "Vencido",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    chartColor: "#F43F5E",
  },
  sem_certificado: {
    label: "Sem certificado",
    tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    chartColor: "#64748B",
  },
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
  return "overview"
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

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Tarefas no front" value={taskSummary.total.toString()} icon={FolderClock} />
        <StatsCard title="Prioridade alta" value={taskSummary.alta.toString()} icon={AlertTriangle} />
        <StatsCard title="Vencem hoje" value={taskSummary.venceHoje.toString()} icon={Clock3} />
        <StatsCard title="Atrasadas" value={taskSummary.atrasadas.toString()} icon={ShieldAlert} />
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold font-display">Fila de tarefas paralegal</h3>
            <p className="text-xs text-muted-foreground mt-1">Front-end demonstrativo com prioridade, prazo e responsavel.</p>
          </div>
          <span className="text-[11px] rounded-full border border-border px-3 py-1 text-muted-foreground">Sem backend por enquanto</span>
        </div>
        <div className="space-y-3">
          {MOCK_TASKS.map((task) => (
            <div key={task.id} className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">{task.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1">{task.empresa} • {task.responsavel}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={cn("rounded-full px-2.5 py-1 font-medium", task.prioridade === "alta" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : task.prioridade === "media" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>
                    Prioridade {task.prioridade}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-1 font-medium", task.status === "atrasada" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : task.status === "vence_hoje" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
                    {task.status === "atrasada" ? "Atrasada" : task.status === "vence_hoje" ? "Vence hoje" : "Em dia"}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">Prazo {formatDate(task.prazo)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

function ClientsPanel({
  salarioMinimo,
  salarioMinimoLoading,
}: {
  salarioMinimo: number
  salarioMinimoLoading: boolean
}) {
  const clientsWithTier = MOCK_CLIENT_TIERS.map((item) => {
    const tier = qualificacaoFromHonorario(item.honorario, salarioMinimo)
    return {
      ...item,
      tier,
      percentualSalarioMinimo: (item.honorario / salarioMinimo) * 100,
    }
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title={`${QUALIFICACAO_DISPLAY.DIAMANTE.emoji} ${QUALIFICACAO_DISPLAY.DIAMANTE.label}`} value={tierCounts.DIAMANTE.toString()} icon={Crown} />
        <StatsCard title={`${QUALIFICACAO_DISPLAY.OURO.emoji} ${QUALIFICACAO_DISPLAY.OURO.label}`} value={tierCounts.OURO.toString()} icon={Crown} />
        <StatsCard title={`${QUALIFICACAO_DISPLAY.PRATA.emoji} ${QUALIFICACAO_DISPLAY.PRATA.label}`} value={tierCounts.PRATA.toString()} icon={Users} />
        <StatsCard title={`${QUALIFICACAO_DISPLAY.BRONZE.emoji} ${QUALIFICACAO_DISPLAY.BRONZE.label}`} value={tierCounts.BRONZE.toString()} icon={Users} />
      </div>

      <GlassCard className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold font-display">Qualificacao por honorario</h3>
            <p className="text-xs text-muted-foreground mt-1">Front apenas, usando a mesma logica do formulario baseada no salario minimo.</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-xs">
            <p className="text-muted-foreground">Salario minimo de referencia</p>
            <p className="mt-1 text-sm font-semibold">
              {salarioMinimoLoading ? "Consultando..." : formatCurrencyBRL(salarioMinimo)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="font-semibold">{QUALIFICACAO_DISPLAY.DIAMANTE.emoji} DIAMANTE</p>
            <p className="text-muted-foreground mt-1">Acima de 100% do salario minimo</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="font-semibold">{QUALIFICACAO_DISPLAY.OURO.emoji} OURO</p>
            <p className="text-muted-foreground mt-1">De 50,01% ate 100%</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="font-semibold">{QUALIFICACAO_DISPLAY.PRATA.emoji} PRATA</p>
            <p className="text-muted-foreground mt-1">De 30,01% ate 50%</p>
          </div>
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="font-semibold">{QUALIFICACAO_DISPLAY.BRONZE.emoji} BRONZE</p>
            <p className="text-muted-foreground mt-1">Ate 30% do salario minimo</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CLIENT_TIER_ORDER.map((tier) => (
          <GlassCard key={tier} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold font-display">{QUALIFICACAO_DISPLAY[tier].emoji} {QUALIFICACAO_DISPLAY[tier].label}</h3>
                <p className="text-xs text-muted-foreground mt-1">Qualificacao por honorario mensal no front.</p>
              </div>
              <span className="text-lg font-bold font-display">{tierCounts[tier]}</span>
            </div>
            <div className="mt-4 space-y-3">
              {clientsWithTier.filter((item) => item.tier === tier).map((item) => (
                <div key={item.empresa} className="rounded-xl border border-border bg-background/70 px-4 py-3">
                  <p className="text-sm font-medium">{item.empresa}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.carteira}</p>
                  <p className="text-xs mt-2">{QUALIFICACAO_DISPLAY[item.tier].emoji} {QUALIFICACAO_DISPLAY[item.tier].label}</p>
                  <p className="text-xs mt-2">Honorario: {formatCurrencyBRL(item.honorario)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.percentualSalarioMinimo.toFixed(1)}% do salario minimo</p>
                </div>
              ))}
              {tierCounts[tier] === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente nessa faixa.</p>}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

export default function ParalegalPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<CertificateFilter>("todos")
  const location = useLocation()
  const navigate = useNavigate()
  const topic = getTopicFromPath(location.pathname)
  const { selectedCompanyIds } = useSelectedCompanyIds()
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null

  const { data: certificateItems = [], isLoading } = useQuery({
    queryKey: ["paralegal-certificates", companyFilter],
    queryFn: () => getParalegalCertificates(companyFilter),
  })
  const { data: salarioMinimoData, isLoading: salarioMinimoLoading } = useQuery({
    queryKey: ["paralegal-salario-minimo"],
    queryFn: fetchSalarioMinimoBCB,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  })

  const salarioMinimo = salarioMinimoData ?? MOCK_SALARIO_MINIMO

  const certificateSummary = useMemo(() => getParalegalCertificateSummary(certificateItems), [certificateItems])

  const filteredCertificates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return certificateItems.filter((item) => {
      const matchesFilter = filter === "todos" || item.certificate_status === filter
      const normalizedDocument = (item.document ?? "").replace(/\D/g, "")
      const normalizedQuery = query.replace(/\D/g, "")
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        normalizedDocument.includes(normalizedQuery)
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatsCard title="Certificados ativos" value={certificateSummary.ativos.toString()} icon={ShieldCheck} />
      <StatsCard title={`Vencem em ate ${CERTIFICATE_EXPIRY_WARNING_DAYS} dias`} value={certificateSummary.venceEmBreve.toString()} icon={AlertTriangle} />
      <StatsCard title="Certificados vencidos" value={certificateSummary.vencidos.toString()} icon={ShieldAlert} />
      <StatsCard title="Sem certificado" value={certificateSummary.semCertificado.toString()} icon={FileBadge2} />
    </div>
  )

  const certificatesPanel = (
    <div className="space-y-4">
      {overviewCards}

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-4">
        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Status dos certificados</h3>
            <p className="text-xs text-muted-foreground mt-1">Dados reais vindos das empresas cadastradas no backend atual.</p>
          </div>
          <ChartContainer className="h-[280px] w-full" config={{ total: { label: "Empresas", color: "#2563EB" } }}>
            <BarChart data={certificateBarData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                {certificateBarData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold font-display mb-4">Distribuicao</h3>
          <ChartContainer
            className="h-[280px] w-full"
            config={{
              ativo: { label: "Ativos", color: CERTIFICATE_STATUS_META.ativo.chartColor },
              vence_em_breve: { label: "Perto de vencer", color: CERTIFICATE_STATUS_META.vence_em_breve.chartColor },
              vencido: { label: "Vencidos", color: CERTIFICATE_STATUS_META.vencido.chartColor },
              sem_certificado: { label: "Sem certificado", color: CERTIFICATE_STATUS_META.sem_certificado.chartColor },
            }}
          >
            <PieChart>
              <Pie data={certificatePieData} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                {certificatePieData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
            </PieChart>
          </ChartContainer>
          <div className="grid grid-cols-2 gap-2">
            {certificateBarData.map((entry) => (
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
      </div>

      <GlassCard className="overflow-hidden">
        <div className="border-b border-border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold font-display">Controle de certificados</h3>
            <p className="text-xs text-muted-foreground mt-1">Filtre por status e clique em renovar para abrir a empresa correta na edicao do certificado.</p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empresa ou CNPJ..." className="xl:max-w-sm" />
            <div className="flex flex-wrap gap-2">
              {([
                { value: "todos", label: "Todos" },
                { value: "ativo", label: "Ativos" },
                { value: "vence_em_breve", label: "Perto de vencer" },
                { value: "vencido", label: "Vencidos" },
                { value: "sem_certificado", label: "Sem certificado" },
              ] as Array<{ value: CertificateFilter; label: string }>).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    filter === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">Carregando certificados...</div>
          ) : filteredCertificates.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhum certificado encontrado para este filtro.</div>
          ) : (
            filteredCertificates.map((item) => (
              <div key={item.id} className="px-4 py-4 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", CERTIFICATE_STATUS_META[item.certificate_status].tone)}>
                      {CERTIFICATE_STATUS_META[item.certificate_status].label}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", item.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300")}>
                      {item.active ? "Empresa ativa" : "Empresa inativa"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">{item.document ?? "CNPJ nao informado"}</p>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Validade</p>
                      <p className="text-[10px] font-medium leading-tight text-foreground">{formatDate(item.cert_valid_until)}</p>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-primary">Status do prazo</p>
                      <p className="text-[10px] font-medium leading-tight text-foreground">{formatDaysToExpiry(item.days_to_expiry)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/empresas?editCompany=${item.id}&focus=certificate&mode=renew`)}>
                    Renovar certificado
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/empresas?editCompany=${item.id}`)}>
                    Abrir empresa
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Paralegal</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de certificados, tarefas do paralegal e segmentacao de clientes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPIC_LINKS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
              topic === item.topic ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {topic === "overview" && (
        <div className="space-y-4">
          {overviewCards}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard className="p-6 lg:col-span-2">
              <h3 className="text-sm font-semibold font-display mb-3">Resumo rapido dos certificados</h3>
              <div className="space-y-3">
                {certificateBarData.map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.total}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${certificateSummary.total ? (item.total / certificateSummary.total) * 100 : 0}%`, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="text-sm font-semibold font-display mb-3">Escopo entregue agora</h3>
              <div className="space-y-3 text-xs text-muted-foreground">
                <p>Certificados com dados reais do cadastro das empresas.</p>
                <p>Tarefas com prioridade e prazo em front demonstrativo.</p>
                <p>Clientes Bronze, Prata, Ouro e Diamante em front demonstrativo.</p>
                <p>Acao de renovar leva direto para a edicao da empresa.</p>
              </div>
            </GlassCard>
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
    </div>
  )
}
