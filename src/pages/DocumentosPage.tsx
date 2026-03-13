import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, Download, Filter, Search, FileArchive } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies";
import { getAllFiscalDocuments } from "@/services/dashboardService";
import { downloadFiscalDocument, downloadFiscalDocumentsZip, hasServerApi, markFiscalDocumentDownloaded } from "@/services/serverFileService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/common/DataPagination";

const tipoFilters = ["Todos", "NFS", "NFE", "NFC"];

function exportToCsv(
  data: Array<{ empresa: string; cnpj: string | null; type: string; periodo: string; status: string; document_date: string | null; created_at: string }>
) {
  const headers = ["Empresa", "CNPJ", "Tipo", "Período", "Status", "Data"];
  const rows = data.map((d) =>
    [d.empresa, d.cnpj ?? "", d.type, d.periodo, d.status, (d.document_date ?? d.created_at ?? "").slice(0, 10)].map((c) =>
      `"${String(c).replace(/"/g, '""')}"`
    ).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documentos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentosPage() {
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const { selectedCompanyIds } = useSelectedCompanyIds();
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null;

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["fiscal-documents-all", companyFilter],
    queryFn: () => getAllFiscalDocuments(companyFilter),
  });

  const filtered = documents.filter((doc) => {
    const matchesTipo = filterTipo === "Todos" || doc.type === filterTipo;
    const docDate = String(doc.document_date ?? doc.created_at ?? "").slice(0, 10);
    const matchesDateFrom = !dateFrom || (docDate && docDate >= dateFrom);
    const matchesDateTo = !dateTo || (docDate && docDate <= dateTo);
    const matchesSearch =
      doc.empresa.toLowerCase().includes(search.toLowerCase()) ||
      (doc.cnpj && doc.cnpj.replace(/\D/g, "").includes(search.replace(/\D/g, ""))) ||
      (doc.chave && doc.chave.includes(search));
    return matchesTipo && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const pagination = useMemo(() => {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(currentPage, totalPages);
    const fromIndex = (page - 1) * pageSize;
    const toIndex = Math.min(fromIndex + pageSize, total);
    return {
      total,
      totalPages,
      currentPage: page,
      from: total ? fromIndex + 1 : 0,
      to: toIndex,
      list: filtered.slice(fromIndex, toIndex),
    };
  }, [filtered, pageSize, currentPage]);

  const pageDocuments = pagination.list;
  const canDownload = hasServerApi();

  const handleDownload = async (id: string, chave: string | null, filePath: string | null) => {
    try {
      const suggestedName = filePath ? filePath.split("/").pop() ?? (chave ? `documento-${chave}` : undefined) : undefined;
      await downloadFiscalDocument(id, suggestedName);
      await markFiscalDocumentDownloaded(id);
      toast.success("Download iniciado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar.");
    }
  };

  const handleZipDownload = async () => {
    if (!canDownload) {
      toast.error("Configure SERVER_API_URL para habilitar download em ZIP.");
      return;
    }
    const ids = pageDocuments.filter((doc) => doc.file_path && String(doc.file_path).trim()).map((doc) => doc.id);
    if (ids.length === 0) {
      toast.error("Nenhum documento com arquivo disponível na página atual.");
      return;
    }
    setDownloadingZip(true);
    try {
      await downloadFiscalDocumentsZip(ids, "documentos");
      toast.success(`Download em ZIP iniciado para ${ids.length} documento(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar ZIP.");
    } finally {
      setDownloadingZip(false);
    }
  };

  const getDownloadLabel = (filePath: string | null) => {
    if (!filePath) return "—";
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".pdf")) return "PDF";
    if (lower.endsWith(".xml")) return "XML";
    return "Arquivo";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">Documentos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            {companyFilter ? `Filtrado por ${companyFilter.length} empresa(s)` : "Todas as empresas"} — Lista unificada paginada de documentos fiscais
          </p>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            {tipoFilters.map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFilterTipo(tipo)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-manipulation min-h-[44px] min-w-[64px] ${
                  filterTipo === tipo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border hover:bg-muted active:bg-muted/80"
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa ou CNPJ..."
                className="rounded-xl border border-border bg-background pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 w-full min-w-0 touch-manipulation"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 touch-manipulation"
              title="Data inicial"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 touch-manipulation"
              title="Data final"
            />
            <button
              onClick={() => exportToCsv(filtered)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation min-h-[44px] shrink-0"
            >
              <Download className="h-4 w-4 shrink-0" />
              Exportar CSV
            </button>
            <Button
              type="button"
              onClick={handleZipDownload}
              disabled={downloadingZip || !canDownload || pageDocuments.filter((doc) => doc.file_path).length === 0}
              className="min-h-[44px] rounded-xl px-4 py-3 text-sm"
            >
              <FileArchive className="mr-2 h-4 w-4" />
              {downloadingZip ? "Gerando ZIP…" : "Baixar ZIP dos documentos listados"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-xs sm:text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">CNPJ</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Período</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Origem</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-3 sm:px-4 py-3 font-medium text-muted-foreground">Download</th>
                </tr>
              </thead>
              <tbody>
                {pageDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/30 active:bg-muted/50 transition-colors">
                    <td className="px-3 sm:px-4 py-3 font-medium">{doc.empresa}</td>
                    <td className="px-3 sm:px-4 py-3 text-muted-foreground">{doc.cnpj ?? "—"}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{doc.type}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3">{doc.periodo}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <StatusBadge status={doc.status as "validado" | "novo" | "divergente" | "processando" | "pendente"} />
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-muted-foreground">Automação</td>
                    <td className="px-3 sm:px-4 py-3 text-muted-foreground">{(doc.document_date ?? doc.created_at ?? "").toString().slice(0, 10)}</td>
                    <td className="px-3 sm:px-4 py-3">
                      {doc.file_path ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id, doc.chave, doc.file_path)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Download className="h-3 w-3" /> {getDownloadLabel(doc.file_path)}
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? "Nenhum documento encontrado."
                : "Nenhum documento encontrado com os filtros aplicados."}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <DataPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            from={pagination.from}
            to={pagination.to}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1);
            }}
          />
        )}
      </GlassCard>
    </div>
  );
}
