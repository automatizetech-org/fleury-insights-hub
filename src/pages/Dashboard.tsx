import { useQuery } from "@tanstack/react-query"
import { getDashboardCounts, getRecentFiscalDocuments } from "@/services/dashboardService"
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { MiniChart, DonutChart } from "@/components/dashboard/Charts"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import {
  FileText,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Sparkles,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

const emptyChart = [
  { name: "Jan", value: 0 },
  { name: "Fev", value: 0 },
  { name: "Mar", value: 0 },
  { name: "Abr", value: 0 },
  { name: "Mai", value: 0 },
  { name: "Jun", value: 0 },
  { name: "Jul", value: 0 },
]

export default function Dashboard() {
  const { selectedCompanyIds } = useSelectedCompanyIds()
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["dashboard-counts", companyFilter],
    queryFn: () => getDashboardCounts(companyFilter),
  })

  const { data: recentEvents = [], isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard-recent", companyFilter],
    queryFn: () => getRecentFiscalDocuments(companyFilter, 6),
  })

  const companiesCount = counts?.companiesCount ?? 0
  const documentsCount = counts?.documentsCount ?? 0
  const docsByType = [
    { name: "NFS", value: recentEvents.filter((e) => e.type === "NFS").length },
    { name: "NFE", value: recentEvents.filter((e) => e.type === "NFE").length },
    { name: "NFC", value: recentEvents.filter((e) => e.type === "NFC").length },
  ].filter((d) => d.value > 0)
  if (docsByType.length === 0) docsByType.push({ name: "NFS", value: 0 }, { name: "NFE", value: 0 }, { name: "NFC", value: 0 })

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl card-3d-elevated p-8">
        <div className="absolute top-4 right-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-float" />
        <div className="absolute bottom-4 left-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="relative flex items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl scale-150 animate-pulse-slow" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg animate-logo-float">
              <BarChart3 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold font-display text-gradient-animated">Fleury Analytics</h1>
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Insights em Tempo Real
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Plataforma de Análise e Gestão Empresarial</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Documentos Processados" value={countsLoading ? "—" : documentsCount.toLocaleString()} change="" changeType="positive" icon={FileText} delay={0} />
        <StatsCard title="Empresas" value={countsLoading ? "—" : companiesCount.toLocaleString()} change="" changeType="positive" icon={Users} delay={100} />
        <StatsCard title="Receita Consolidada" value="—" change="Conecte dados financeiros" changeType="neutral" icon={DollarSign} delay={200} />
        <StatsCard title="Taxa de Sincronismo" value="—" change="Conecte sync" changeType="neutral" icon={Activity} delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Receita Mensal</h3>
              <p className="text-xs text-muted-foreground">Dados do Supabase</p>
            </div>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <MiniChart data={emptyChart} type="area" height={240} />
        </GlassCard>
        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Documentos por Tipo</h3>
            <p className="text-xs text-muted-foreground">Distribuição (últimos)</p>
          </div>
          <DonutChart data={docsByType} height={180} />
          <div className="mt-4 space-y-2">
            {docsByType.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Documentos Processados</h3>
              <p className="text-xs text-muted-foreground">Volume (Supabase)</p>
            </div>
          </div>
          <MiniChart data={emptyChart} type="bar" color="hsl(var(--chart-2))" height={200} />
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Atividade Recente</h3>
              <p className="text-xs text-muted-foreground">Últimos documentos (Supabase)</p>
            </div>
          </div>
          <div className="space-y-3">
            {recentLoading
              ? "Carregando..."
              : recentEvents.length === 0
                ? "Nenhum documento recente."
                : recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{"companyName" in event ? String(event.companyName) || "—" : "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{event.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={event.status as "validado" | "novo" | "divergente" | "processando" | "pendente"} />
                        <span className="text-[10px] text-muted-foreground">
                          {event.created_at ? formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR }) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-success/15 p-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fiscal</p>
            <p className="text-xs text-muted-foreground">Dados por empresa no Supabase</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-warning/15 p-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">DP</p>
            <p className="text-xs text-muted-foreground">Pendências nas abas</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-info/15 p-3">
            <Clock className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sync</p>
            <p className="text-xs text-muted-foreground">Eventos na aba Sincronização</p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
