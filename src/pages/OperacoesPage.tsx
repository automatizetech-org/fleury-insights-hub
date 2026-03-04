import { StatsCard } from "@/components/dashboard/StatsCard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MiniChart } from "@/components/dashboard/Charts";
import { Activity, Clock, AlertTriangle, CheckCircle2, Zap, Server } from "lucide-react";

const processingData = [
  { name: "00h", value: 12 },
  { name: "04h", value: 8 },
  { name: "08h", value: 45 },
  { name: "12h", value: 38 },
  { name: "16h", value: 52 },
  { name: "20h", value: 28 },
  { name: "24h", value: 15 },
];

const syncEvents = [
  { evento: "Coleta XMLs - Lote #4521", status: "sucesso" as const, duracao: "2.3s", hora: "14:32", detalhes: "142 documentos" },
  { evento: "Processamento NFE - Lote #4520", status: "sucesso" as const, duracao: "5.1s", hora: "14:28", detalhes: "89 documentos" },
  { evento: "Validação NFS - Lote #4519", status: "erro" as const, duracao: "0.8s", hora: "14:15", detalhes: "Timeout na validação" },
  { evento: "Cálculo Preço - Lote #4518", status: "sucesso" as const, duracao: "1.2s", hora: "14:10", detalhes: "32 empresas" },
  { evento: "Coleta XMLs - Lote #4517", status: "sucesso" as const, duracao: "3.7s", hora: "13:58", detalhes: "198 documentos" },
  { evento: "Sync Storage - Lote #4516", status: "sucesso" as const, duracao: "12.4s", hora: "13:45", detalhes: "54 PDFs" },
];

export default function OperacoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Operações</h1>
        <p className="text-sm text-muted-foreground mt-1">Status do sincronismo, SLA e monitoramento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Uptime Sync" value="99.8%" change="Últimos 30 dias" changeType="positive" icon={Activity} />
        <StatsCard title="Tempo Médio" value="3.2s" change="-0.5s vs semana passada" changeType="positive" icon={Clock} />
        <StatsCard title="Taxa de Falhas" value="0.3%" change="2 erros hoje" changeType="negative" icon={AlertTriangle} />
        <StatsCard title="Docs/hora" value="1.847" change="Pico: 3.200/h" changeType="neutral" icon={Zap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold font-display mb-4">Volume de Processamento (24h)</h3>
          <MiniChart data={processingData} type="area" color="hsl(152, 60%, 42%)" height={220} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold font-display">Status dos Serviços</h3>
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {[
              { nome: "Worker de Coleta", status: "online", latencia: "45ms" },
              { nome: "Processador XML", status: "online", latencia: "120ms" },
              { nome: "Calculadora de Preço", status: "online", latencia: "89ms" },
              { nome: "Storage Sync", status: "online", latencia: "200ms" },
              { nome: "Webhook Receiver", status: "online", latencia: "32ms" },
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-medium">{service.nome}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-muted-foreground">{service.latencia}</span>
                  <span className="text-[10px] text-success font-medium uppercase">{service.status}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold font-display">Log de Eventos de Sincronização</h3>
          <p className="text-xs text-muted-foreground">Últimos eventos processados</p>
        </div>
        <div className="divide-y divide-border">
          {syncEvents.map((event, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <StatusBadge status={event.status} />
                <div>
                  <p className="text-xs font-medium">{event.evento}</p>
                  <p className="text-[10px] text-muted-foreground">{event.detalhes}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>{event.duracao}</span>
                <span>{event.hora}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
