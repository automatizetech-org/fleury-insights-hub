import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, Download, Filter, Search } from "lucide-react";
import { useState } from "react";

const documents = [
  { id: "1", empresa: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", tipo: "NFE", periodo: "07/2025", status: "validado" as const, origem: "Automação", data: "2025-07-15", arquivos: ["XML", "DANFE"] },
  { id: "2", empresa: "Comércio ABC", cnpj: "98.765.432/0001-10", tipo: "NFS", periodo: "07/2025", status: "novo" as const, origem: "Automação", data: "2025-07-14", arquivos: ["XML"] },
  { id: "3", empresa: "Indústria XYZ", cnpj: "45.678.901/0001-23", tipo: "NFC", periodo: "07/2025", status: "divergente" as const, origem: "Upload Manual", data: "2025-07-14", arquivos: ["XML", "DANFE"] },
  { id: "4", empresa: "Serviços Delta", cnpj: "11.223.344/0001-55", tipo: "NFE", periodo: "07/2025", status: "processando" as const, origem: "Automação", data: "2025-07-13", arquivos: ["XML"] },
  { id: "5", empresa: "Logística Beta", cnpj: "99.887.766/0001-99", tipo: "NFS", periodo: "06/2025", status: "validado" as const, origem: "Automação", data: "2025-07-12", arquivos: ["XML", "PDF Guia"] },
  { id: "6", empresa: "Alfa Comercial", cnpj: "33.445.566/0001-77", tipo: "NFE", periodo: "06/2025", status: "pendente" as const, origem: "Upload Manual", data: "2025-07-11", arquivos: ["XML"] },
  { id: "7", empresa: "Gama Indústria", cnpj: "55.667.788/0001-33", tipo: "NFC", periodo: "06/2025", status: "validado" as const, origem: "Automação", data: "2025-07-10", arquivos: ["XML", "DANFE"] },
  { id: "8", empresa: "Omega Services", cnpj: "77.889.900/0001-11", tipo: "NFS", periodo: "06/2025", status: "validado" as const, origem: "Automação", data: "2025-07-09", arquivos: ["XML"] },
];

const tipoFilters = ["Todos", "NFS", "NFE", "NFC"];

function exportToCsv(data: typeof documents) {
  const headers = ["Empresa", "CNPJ", "Tipo", "Período", "Status", "Origem", "Data", "Arquivos"];
  const rows = data.map((d) =>
    [d.empresa, d.cnpj, d.tipo, d.periodo, d.status, d.origem, d.data, d.arquivos.join("; ")].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
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

  const filtered = documents.filter((doc) => {
    const matchesTipo = filterTipo === "Todos" || doc.tipo === filterTipo;
    const matchesSearch = doc.empresa.toLowerCase().includes(search.toLowerCase()) || doc.cnpj.includes(search);
    return matchesTipo && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground mt-1">Lista unificada de documentos fiscais e operacionais</p>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {tipoFilters.map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFilterTipo(tipo)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all touch-manipulation min-h-[36px] ${
                  filterTipo === tipo
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa ou CNPJ..."
                className="rounded-lg border border-border bg-background pl-8 pr-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-full min-w-0 sm:w-56"
              />
            </div>
            <button
              onClick={() => exportToCsv(filtered)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 sm:py-1.5 text-xs font-medium hover:bg-muted transition-colors touch-manipulation min-h-[36px]"
            >
              <Download className="h-3 w-3 shrink-0" />
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Arquivos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium">{doc.empresa}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.cnpj}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{doc.tipo}</span>
                  </td>
                  <td className="px-4 py-3">{doc.periodo}</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.origem}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {doc.arquivos.map((arq) => (
                        <span key={arq} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{arq}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum documento encontrado</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
