import { StatsCard } from "@/components/dashboard/StatsCard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, FileDown, CalendarDays, Link2 } from "lucide-react";
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
  { label: "NFE/NFC", path: "/fiscal/nfe-nfc" },
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
  const [period, setPeriod] = useState<string>("");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["fiscal-summary", companyFilter, period || null],
    queryFn: () => getFiscalSummary(companyFilter, period || undefined),
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
        queryClient.invalidateQueries({ queryKey: ["fiscal-documents-nfe-nfc"] });
        queryClient.invalidateQueries({ queryKey: ["nfs-stats"] });
        const parts = [];
        if (r.inserted > 0) parts.push(`${r.inserted} inserido(s)`);
        if (r.deleted > 0) parts.push(`${r.deleted} removido(s)`);
        toast.success(parts.length ? parts.join(", ") + "." : "Sincronização concluída.");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar"))
      .finally(() => setSyncing(false));
  };

  const byType = summary?.byType ?? { NFS: { total: 0, disponiveis: 0, esteMes: 0 }, NFE: { total: 0, disponiveis: 0, esteMes: 0 }, NFC: { total: 0, disponiveis: 0, esteMes: 0 } };
  const totalXmls = summary?.totalXmls ?? 0;
  const totalDisponiveis = summary?.totalDisponiveis ?? 0;
  const totalEsteMes = summary?.totalEsteMes ?? 0;

  const nfeNfcTotal = (byType.NFE?.total ?? 0) + (byType.NFC?.total ?? 0);
  const nfeNfcDisponiveis = (byType.NFE?.disponiveis ?? 0) + (byType.NFC?.disponiveis ?? 0);
  const nfeNfcEsteMes = (byType.NFE?.esteMes ?? 0) + (byType.NFC?.esteMes ?? 0);

  const cardsPorTipo = [
    { tipo: "NFS", total: byType.NFS?.total ?? 0, disponiveis: byType.NFS?.disponiveis ?? 0, esteMes: byType.NFS?.esteMes ?? 0, path: "/fiscal/nfs" },
    { tipo: "NFE/NFC", total: nfeNfcTotal, disponiveis: nfeNfcDisponiveis, esteMes: nfeNfcEsteMes, path: "/fiscal/nfe-nfc", nfeCount: byType.NFE?.total ?? 0, nfcCount: byType.NFC?.total ?? 0 },
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
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Filtrar por período"
          >
            <option value="">Todos os períodos</option>
            {(() => {
              const opts: string[] = [];
              const now = new Date();
              for (let i = 0; i < 24; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                opts.push(v);
              }
              return opts.map((v) => (
                <option key={v} value={v}>{v.slice(0, 7) === new Date().toISOString().slice(0, 7) ? `${v} (atual)` : v}</option>
              ));
            })()}
          </select>
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
            <StatsCard title="Total de notas" value={totalXmls.toLocaleString()} change={totalXmls ? "total" : undefined} changeType="neutral" icon={FileText} />
            <StatsCard title="Disponíveis" value={totalDisponiveis.toLocaleString()} change={totalXmls ? `${((totalDisponiveis / totalXmls) * 100).toFixed(1)}%` : "0%"} changeType="positive" icon={FileDown} />
            <StatsCard title="Este mês" value={totalEsteMes.toString()} changeType="neutral" icon={CalendarDays} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-6">
              <h3 className="text-sm font-semibold font-display mb-4">Últimos XMLs</h3>
              {recentDocs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum documento recente. Use Sincronizar para trazer arquivos da VM.</p>
              ) : (
                <div className="space-y-3">
                  {recentDocs.map((d) => (
                    <Link key={d.id} to={d.type === "NFE" || d.type === "NFC" ? "/fiscal/nfe-nfc" : `/fiscal/${(d.type || "nfs").toLowerCase()}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{d.companyName || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{d.type}</p>
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
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {byType.NFS && byType.NFS.total > 0 && (
                  <Link to="/fiscal/nfs" className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                    <div>
                      <p className="text-xs font-medium">NFS</p>
                      <p className="text-[10px] text-muted-foreground">{byType.NFS.total} documento(s) · {byType.NFS.disponiveis} disponíveis · {byType.NFS.esteMes} este mês</p>
                    </div>
                    <span className="text-xs font-semibold">{byType.NFS.total}</span>
                  </Link>
                )}
                {(nfeNfcTotal > 0) && (
                  <Link to="/fiscal/nfe-nfc" className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                    <div>
                      <p className="text-xs font-medium">NFE/NFC</p>
                      <p className="text-[10px] text-muted-foreground">NFE: {byType.NFE?.total ?? 0} · NFC: {byType.NFC?.total ?? 0} · {nfeNfcDisponiveis} disponíveis · {nfeNfcEsteMes} este mês</p>
                    </div>
                    <span className="text-xs font-semibold">{nfeNfcTotal}</span>
                  </Link>
                )}
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
                        {"nfeCount" in item && "nfcCount" in item && (
                          <div className="flex justify-between text-xs gap-2">
                            <span className="text-muted-foreground">NFE</span>
                            <span className="font-medium">{(item as { nfeCount: number }).nfeCount}</span>
                          </div>
                        )}
                        {"nfeCount" in item && "nfcCount" in item && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">NFC</span>
                            <span className="font-medium">{(item as { nfcCount: number }).nfcCount}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Disponíveis</span>
                          <span className="text-success font-medium">{(item as { disponiveis: number }).disponiveis.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Este mês</span>
                          <span className="font-medium">{(item as { esteMes: number }).esteMes}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${((item as { disponiveis: number }).disponiveis) / (item as { total: number }).total * 100}%` }}
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
