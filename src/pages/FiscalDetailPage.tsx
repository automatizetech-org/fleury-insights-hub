import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MiniChart } from "@/components/dashboard/Charts";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useParams } from "react-router-dom";
import { FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const mockDocuments = [
  { chave: "35250712345678000190550010001234561001234560", empresa: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", periodo: "07/2025", status: "validado" as const, data: "2025-07-15" },
  { chave: "35250798765432000110550010005678901005678900", empresa: "Comércio ABC", cnpj: "98.765.432/0001-10", periodo: "07/2025", status: "novo" as const, data: "2025-07-14" },
  { chave: "35250745678901000123550010009876541009876540", empresa: "Indústria XYZ", cnpj: "45.678.901/0001-23", periodo: "07/2025", status: "divergente" as const, data: "2025-07-14" },
  { chave: "35250711223344000155550010001122331001122330", empresa: "Serviços Delta", cnpj: "11.223.344/0001-55", periodo: "07/2025", status: "processando" as const, data: "2025-07-13" },
  { chave: "35250799887766000199550010004455661004455660", empresa: "Logística Beta", cnpj: "99.887.766/0001-99", periodo: "06/2025", status: "validado" as const, data: "2025-07-12" },
  { chave: "35250733445566000177550010007788991007788990", empresa: "Alfa Comercial", cnpj: "33.445.566/0001-77", periodo: "06/2025", status: "pendente" as const, data: "2025-07-11" },
];

const chartData = [
  { name: "Jan", value: 180 },
  { name: "Fev", value: 220 },
  { name: "Mar", value: 195 },
  { name: "Abr", value: 310 },
  { name: "Mai", value: 280 },
  { name: "Jun", value: 340 },
];

const typeLabels: Record<string, string> = {
  nfs: "NFS - Notas Fiscais de Serviço",
  nfe: "NFE - Notas Fiscais Eletrônicas",
  nfc: "NFC - Notas Fiscais ao Consumidor",
};

export default function FiscalDetailPage() {
  const { type } = useParams<{ type: string }>();
  const label = typeLabels[type || "nfs"] || "Documentos Fiscais";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">{label}</h1>
        <p className="text-sm text-muted-foreground mt-1">Detalhamento de XMLs e status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total" value="1.240" icon={FileText} />
        <StatsCard title="Validados" value="1.180" icon={CheckCircle2} change="95.2%" changeType="positive" />
        <StatsCard title="Divergentes" value="18" icon={AlertTriangle} changeType="negative" />
        <StatsCard title="Pendentes" value="42" icon={Clock} changeType="neutral" />
      </div>

      <GlassCard className="p-6">
        <h3 className="text-sm font-semibold font-display mb-4">Volume Mensal</h3>
        <MiniChart data={chartData} type="area" height={200} />
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display">Documentos</h3>
          <div className="flex gap-2">
            <input
              placeholder="Buscar por empresa ou chave..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chave</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {mockDocuments.map((doc, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium">{doc.empresa}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.cnpj}</td>
                  <td className="px-4 py-3">{doc.periodo}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{doc.chave.slice(0, 20)}...</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
