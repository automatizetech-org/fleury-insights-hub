import { StatsCard } from "@/components/dashboard/StatsCard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, CheckCircle2, Clock, FileWarning, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies";
import { getFiscalSummary, getRecentFiscalDocuments } from "@/services/dashboardService";
import { fiscalSyncAll, hasServerApi } from "@/services/serverFileService";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const topicos = [
  { label: "NFS", path: "/fiscal/nfs" },
  { label: "NFE", path: "/fiscal/nfe" },
  { label: "NFC", path: "/fiscal/nfc" },
  { label: "Simples Nacional", path: "/fiscal/simples-nacional" },
  { label: "DIFAL", path: "/fiscal/difal" },
  { label: "IRRF/CSLL", path: "/fiscal/irrf-csll" },
  { label: "Certidões", path: "/fiscal/certidoes" },
];

export default function FiscalPage() {
  const { selectedCompanyIds } = useSelectedCompanyIds();
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["fiscal-summary", companyFilter],
    queryFn: () => getFiscalSummary(companyFilter),
  });
  const { data: recentDocs = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["fiscal-recent", companyFilter],
    queryFn: () => getRecentFiscalDocuments(companyFilter, 10),
  });

  const canSync = hasServerApi();
  const handleSyncClick = () => {
    if (!canSync) {
      toast.error(
        "Configure SERVER_API_URL no arquivo .env na raiz do projeto (URL do server-api, ex: do ngrok) e reinicie o app (npm run dev) para sincronizar os arquivos da VM."
      );
      return;
    }
    setSyncing(true);
    fiscalSyncAll()
      .then((r) => {
        queryClient.invalidateQueries({ queryKey: ["fiscal-summary"] });
        queryClient.invalidateQueries({ queryKey: ["fiscal-recent"] });
        queryClient.invalidateQueries({ queryKey: ["fiscal-documents"] });
        const parts = [];
        if (r.inserted > 0) parts.push(`${r.inserted} inserido(s)`);
        if (r.deleted > 0) parts.push(`${r.deleted} removido(s)`);
        toast.success(parts.length ? parts.join(", ") + "." : "Sincronização concluída.");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar"))
      .finally(() => setSyncing(false));
  };

  const byType = summary?.byType ?? { NFS: { total: 0, validados: 0, novos: 0, processando: 0, divergentes: 0, pendentes: 0 }, NFE: { total: 0, validados: 0, novos: 0, processando: 0, divergentes: 0, pendentes: 0 }, NFC: { total: 0, validados: 0, novos: 0, processando: 0, divergentes: 0, pendentes: 0 } };
  const totalXmls = summary?.totalXmls ?? 0;
  const totalValidados = summary?.totalValidados ?? 0;
  const totalDivergentes = summary?.totalDivergentes ?? 0;
  const totalPendentes = summary?.totalPendentes ?? 0;

  const cardsPorTipo = [
    { tipo: "NFS", ...byType.NFS, path: "/fiscal/nfs" },
    { tipo: "NFE", ...byType.NFE, path: "/fiscal/nfe" },
    { tipo: "NFC", ...byType.NFC, path: "/fiscal/nfc" },
    { tipo: "Simples Nacional", path: "/fiscal/simples-nacional", obrigacao: true },
    { tipo: "DIFAL", path: "/fiscal/difal", obrigacao: true },
    { tipo: "IRRF/CSLL", path: "/fiscal/irrf-csll", obrigacao: true },
    { tipo: "Certidões", path: "/fiscal/certidoes", obrigacao: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">Apuração fiscal por empresa e período — NFS, NFE, NFC, Simples Nacional, DIFAL, IRRF/CSLL e Certidões</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncClick}
            disabled={syncing && canSync}
            title={!canSync ? "Adicione SERVER_API_URL no .env (ex: URL do ngrok) e reinicie o app" : undefined}
          >
            {syncing && canSync ? "Sincronizando…" : "Sincronizar"}
          </Button>
          {!canSync && (
            <span className="text-xs text-muted-foreground" title="Variável SERVER_API_URL não definida no .env">
              (configure .env para trazer arquivos da VM)
            </span>
          )}
          {topicos.map((item) => (
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

      {(loadingSummary || loadingRecent) && !summary ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="XMLs recebidos" value={totalXmls.toLocaleString()} change={totalXmls ? "total" : undefined} changeType="neutral" icon={FileText} />
            <StatsCard title="Validados" value={totalValidados.toLocaleString()} change={totalXmls ? `${((totalValidados / totalXmls) * 100).toFixed(1)}%` : "0%"} changeType="positive" icon={CheckCircle2} />
            <StatsCard title="Divergentes" value={totalDivergentes.toString()} changeType="negative" icon={FileWarning} />
            <StatsCard title="Pendentes" value={totalPendentes.toString()} changeType="neutral" icon={Clock} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-6">
              <h3 className="text-sm font-semibold font-display mb-4">Últimos XMLs</h3>
              {recentDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum documento recente. Use Sincronizar para trazer arquivos da VM.</p>
              ) : (
                <div className="space-y-3">
                  {recentDocs.map((d) => (
                    <Link key={d.id} to={`/fiscal/${(d.type || "nfs").toLowerCase()}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{d.companyName || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{d.type} · {d.status}</p>
                        </div>
                      </div>
                      <StatusBadge status={d.status as "validado" | "novo" | "processando" | "pendente" | "divergente"} />
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold font-display">Documentos por tipo</h3>
                <FileWarning className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {["NFS", "NFE", "NFC"].map((t) => {
                  const item = byType[t as keyof typeof byType];
                  if (!item || item.total === 0) return null;
                  return (
                    <Link key={t} to={`/fiscal/${t.toLowerCase()}`} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                      <div>
                        <p className="text-xs font-medium">{t}</p>
                        <p className="text-[10px] text-muted-foreground">{item.total} documento(s) · {item.validados} validado(s)</p>
                      </div>
                      <span className="text-xs font-semibold">{item.total}</span>
                    </Link>
                  );
                })}
                {totalXmls === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum documento. Sincronize para trazer XMLs da pasta da VM.</p>
                )}
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cardsPorTipo.map((item) => (
              <Link key={item.tipo} to={item.path}>
                <GlassCard className="p-5 cursor-pointer h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold font-display">{item.tipo}</h4>
                    {"total" in item && item.total != null ? (
                      <span className="text-lg font-bold font-display">{item.total.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Acessar</span>
                    )}
                  </div>
                  {"obrigacao" in item && item.obrigacao ? (
                    <p className="text-xs text-muted-foreground">Obrigações e apurações deste tópico</p>
                  ) : (
                    "total" in item && item.total != null && item.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Validados</span>
                          <span className="text-success font-medium">{(item as { validados: number }).validados.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Novos</span>
                          <span className="font-medium">{(item as { novos: number }).novos}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Processando</span>
                          <span className="font-medium">{(item as { processando: number }).processando}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${((item as { validados: number }).validados) / (item as { total: number }).total * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </GlassCard>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
