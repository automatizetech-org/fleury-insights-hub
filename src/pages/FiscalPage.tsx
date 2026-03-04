import { StatsCard } from "@/components/dashboard/StatsCard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { MiniChart } from "@/components/dashboard/Charts";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, AlertTriangle, CheckCircle2, Clock, FileWarning } from "lucide-react";
import { Link } from "react-router-dom";

const xmlData = [
  { name: "Jan", value: 320 },
  { name: "Fev", value: 280 },
  { name: "Mar", value: 410 },
  { name: "Abr", value: 370 },
  { name: "Mai", value: 490 },
  { name: "Jun", value: 520 },
];

const pendencias = [
  { empresa: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", tipo: "NFE", periodo: "07/2025", status: "divergente" as const },
  { empresa: "Comércio ABC", cnpj: "98.765.432/0001-10", tipo: "NFS", periodo: "07/2025", status: "pendente" as const },
  { empresa: "Indústria XYZ", cnpj: "45.678.901/0001-23", tipo: "NFC", periodo: "06/2025", status: "divergente" as const },
];

export default function FiscalPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">Apuração fiscal por empresa e período</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: "NFS", path: "/fiscal/nfs" },
            { label: "NFE", path: "/fiscal/nfe" },
            { label: "NFC", path: "/fiscal/nfc" },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="XMLs Recebidos" value="5.580" change="+340 este mês" changeType="positive" icon={FileText} />
        <StatsCard title="Validados" value="5.210" change="93.4% taxa" changeType="positive" icon={CheckCircle2} />
        <StatsCard title="Divergências" value="48" change="0.86% do total" changeType="negative" icon={AlertTriangle} />
        <StatsCard title="Pendentes" value="322" change="5.7% do total" changeType="neutral" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold font-display mb-4">XMLs por Mês</h3>
          <MiniChart data={xmlData} type="bar" color="hsl(220, 65%, 18%)" height={220} />
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold font-display">Pendências e Divergências</h3>
            <FileWarning className="h-4 w-4 text-warning" />
          </div>
          <div className="space-y-3">
            {pendencias.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium">{p.empresa}</p>
                  <p className="text-[10px] text-muted-foreground">{p.cnpj} · {p.tipo} · {p.periodo}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Status por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { tipo: "NFS", total: 1240, validados: 1180, pendentes: 42, divergentes: 18, path: "/fiscal/nfs" },
          { tipo: "NFE", total: 3450, validados: 3280, pendentes: 140, divergentes: 30, path: "/fiscal/nfe" },
          { tipo: "NFC", total: 890, validados: 750, pendentes: 140, divergentes: 0, path: "/fiscal/nfc" },
        ].map((item) => (
          <Link key={item.tipo} to={item.path}>
            <GlassCard className="p-5 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold font-display">{item.tipo}</h4>
                <span className="text-lg font-bold font-display">{item.total.toLocaleString()}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Validados</span>
                  <span className="text-success font-medium">{item.validados.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pendentes</span>
                  <span className="text-warning font-medium">{item.pendentes}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Divergentes</span>
                  <span className="text-destructive font-medium">{item.divergentes}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{ width: `${(item.validados / item.total) * 100}%` }}
                  />
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
