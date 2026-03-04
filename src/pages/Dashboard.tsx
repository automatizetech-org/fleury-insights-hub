import { StatsCard } from "@/components/dashboard/StatsCard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { MiniChart, DonutChart } from "@/components/dashboard/Charts";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  FileText,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const revenueData = [
  { name: "Jan", value: 45000 },
  { name: "Fev", value: 52000 },
  { name: "Mar", value: 48000 },
  { name: "Abr", value: 61000 },
  { name: "Mai", value: 55000 },
  { name: "Jun", value: 67000 },
  { name: "Jul", value: 72000 },
];

const documentsByType = [
  { name: "NFS", value: 1240 },
  { name: "NFE", value: 3450 },
  { name: "NFC", value: 890 },
];

const monthlyDocs = [
  { name: "Jan", value: 420 },
  { name: "Fev", value: 380 },
  { name: "Mar", value: 510 },
  { name: "Abr", value: 470 },
  { name: "Mai", value: 590 },
  { name: "Jun", value: 620 },
  { name: "Jul", value: 540 },
];

const recentEvents = [
  { empresa: "Tech Solutions Ltda", tipo: "NFE", status: "validado" as const, hora: "14:32" },
  { empresa: "Comércio ABC", tipo: "NFS", status: "novo" as const, hora: "14:28" },
  { empresa: "Indústria XYZ", tipo: "NFC", status: "divergente" as const, hora: "14:15" },
  { empresa: "Serviços Delta", tipo: "NFE", status: "processando" as const, hora: "14:10" },
  { empresa: "Logística Beta", tipo: "NFS", status: "validado" as const, hora: "13:58" },
  { empresa: "Alfa Comercial", tipo: "NFE", status: "pendente" as const, hora: "13:45" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral consolidada do Grupo Fleury</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Documentos Processados"
          value="5.580"
          change="+12.5% vs mês anterior"
          changeType="positive"
          icon={FileText}
          delay={0}
        />
        <StatsCard
          title="Empresas Ativas"
          value="142"
          change="+3 novas este mês"
          changeType="positive"
          icon={Users}
          delay={100}
        />
        <StatsCard
          title="Receita Consolidada"
          value="R$ 72.4k"
          change="+7.2% vs mês anterior"
          changeType="positive"
          icon={DollarSign}
          delay={200}
        />
        <StatsCard
          title="Taxa de Sincronismo"
          value="98.7%"
          change="2 falhas nas últimas 24h"
          changeType="negative"
          icon={Activity}
          delay={300}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Receita Mensal</h3>
              <p className="text-xs text-muted-foreground">Últimos 7 meses</p>
            </div>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <MiniChart data={revenueData} type="area" height={240} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display">Documentos por Tipo</h3>
            <p className="text-xs text-muted-foreground">Distribuição atual</p>
          </div>
          <DonutChart data={documentsByType} height={180} />
          <div className="mt-4 space-y-2">
            {documentsByType.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: ["hsl(42, 92%, 56%)", "hsl(220, 65%, 18%)", "hsl(152, 60%, 42%)"][i],
                    }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Documentos Processados</h3>
              <p className="text-xs text-muted-foreground">Volume mensal</p>
            </div>
          </div>
          <MiniChart data={monthlyDocs} type="bar" color="hsl(220, 65%, 18%)" height={200} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display">Atividade Recente</h3>
              <p className="text-xs text-muted-foreground">Últimos documentos processados</p>
            </div>
          </div>
          <div className="space-y-3">
            {recentEvents.map((event, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{event.empresa}</p>
                    <p className="text-[10px] text-muted-foreground">{event.tipo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={event.status} />
                  <span className="text-[10px] text-muted-foreground">{event.hora}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Quick Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-success/15 p-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fiscal em dia</p>
            <p className="text-xs text-muted-foreground">138 empresas sem pendências</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-warning/15 p-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">4 alertas DP</p>
            <p className="text-xs text-muted-foreground">Pendências de fechamento</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-full bg-info/15 p-3">
            <Clock className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sync ativo</p>
            <p className="text-xs text-muted-foreground">Última coleta: 2 min atrás</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
