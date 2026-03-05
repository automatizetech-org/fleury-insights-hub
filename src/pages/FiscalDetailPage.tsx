import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MiniChart } from "@/components/dashboard/Charts";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useParams } from "react-router-dom";
import { FileText, CheckCircle2, AlertTriangle, Clock, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies";
import { getFiscalDocumentsByType } from "@/services/dashboardService";
import { downloadFiscalDocument, hasServerApi } from "@/services/serverFileService";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  nfs: "NFS - Notas Fiscais de Serviço",
  nfe: "NFE - Notas Fiscais Eletrônicas",
  nfc: "NFC - Notas Fiscais ao Consumidor",
};

const typeToDb = (t: string): "NFS" | "NFE" | "NFC" => {
  const u = t?.toUpperCase();
  if (u === "NFS" || u === "NFE" || u === "NFC") return u;
  return "NFE";
};

const chartData = [
  { name: "Jan", value: 180 },
  { name: "Fev", value: 220 },
  { name: "Mar", value: 195 },
  { name: "Abr", value: 310 },
  { name: "Mai", value: 280 },
  { name: "Jun", value: 340 },
];

export default function FiscalDetailPage() {
  const { type } = useParams<{ type: string }>();
  const [search, setSearch] = useState("");
  const { selectedCompanyIds } = useSelectedCompanyIds();
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null;
  const dbType = typeToDb(type ?? "");
  const label = typeLabels[type ?? "nfs"] || "Documentos Fiscais";

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["fiscal-documents", dbType, companyFilter],
    queryFn: () => getFiscalDocumentsByType(dbType, companyFilter),
  });

  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        (d.empresa && d.empresa.toLowerCase().includes(q)) ||
        (d.cnpj && d.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))) ||
        (d.chave && d.chave.includes(q))
    );
  }, [documents, search]);

  const canDownload = hasServerApi();
  const validados = documents.filter((d) => d.status === "validado").length;
  const pendentes = documents.filter((d) => d.status === "pendente").length;
  const divergentes = documents.filter((d) => d.status === "divergente").length;

  const handleDownload = async (id: string, chave: string | null) => {
    try {
      const name = chave ? `nfe-${chave}.xml` : undefined;
      await downloadFiscalDocument(id, name);
      toast.success("Download iniciado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar o arquivo.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">{label}</h1>
        <p className="text-sm text-muted-foreground mt-1">Detalhamento de XMLs e status. Baixe o XML pelo servidor quando disponível.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total" value={documents.length.toString()} icon={FileText} />
        <StatsCard title="Validados" value={validados.toString()} icon={CheckCircle2} change={documents.length ? `${((validados / documents.length) * 100).toFixed(1)}%` : "0%"} changeType="positive" />
        <StatsCard title="Divergentes" value={divergentes.toString()} icon={AlertTriangle} changeType="negative" />
        <StatsCard title="Pendentes" value={pendentes.toString()} icon={Clock} changeType="neutral" />
      </div>

      <GlassCard className="p-6">
        <h3 className="text-sm font-semibold font-display mb-4">Volume Mensal</h3>
        <MiniChart data={chartData} type="area" height={200} />
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold font-display">Documentos</h3>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por empresa ou chave..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-48 sm:w-64 max-w-full"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum documento encontrado. Os robôs podem popular os dados ao processar XMLs.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">CNPJ</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chave</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  {canDownload && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{doc.empresa}</td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.cnpj ?? "—"}</td>
                    <td className="px-4 py-3">{doc.periodo}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{doc.chave ? `${doc.chave.slice(0, 20)}...` : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status as "validado" | "novo" | "divergente" | "processando" | "pendente"} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.document_date ?? "—"}</td>
                    {canDownload && (
                      <td className="px-4 py-3">
                        {doc.file_path ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.chave)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" /> Baixar XML
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Sem arquivo</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
