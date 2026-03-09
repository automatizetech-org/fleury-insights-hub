import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MiniChart } from "@/components/dashboard/Charts";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useParams } from "react-router-dom";
import { FileText, FileDown, CalendarDays, Download, AlertCircle, XCircle, ThumbsUp, Copy, Eye, FileArchive } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedCompanyIds } from "@/hooks/useSelectedCompanies";
import { getFiscalDocumentsByType, getFiscalDocumentsNfeNfc } from "@/services/dashboardService";
import { downloadFiscalDocument, hasServerApi, markFiscalDocumentDownloaded, downloadFiscalDocumentsZip } from "@/services/serverFileService";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const typeLabels: Record<string, string> = {
  nfs: "NFS - Notas Fiscais de Serviço",
  nfe: "NFE - Notas Fiscais Eletrônicas",
  nfc: "NFC - Notas Fiscais ao Consumidor",
  "nfe-nfc": "NFE / NFC - Notas Fiscais Eletrônicas e ao Consumidor",
  "simples-nacional": "Simples Nacional",
  difal: "DIFAL",
  "irrf-csll": "IRRF/CSLL",
  certidoes: "Certidões",
};

const OBRIGACOES_FISCAIS = ["simples-nacional", "difal", "irrf-csll", "certidoes"];

const typeToDb = (t: string): "NFS" | "NFE" | "NFC" | "NFE_NFC" => {
  const u = t?.toLowerCase();
  if (u === "nfe-nfc") return "NFE_NFC";
  if (u === "nfs" || u === "nfe" || u === "nfc") return t?.toUpperCase() as "NFS" | "NFE" | "NFC";
  return "NFS";
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Extrai data do file_path quando a pasta segue .../Recebidas ou .../Emitidas/YYYY/MM/DD/... */
function getDocumentDateFromPath(filePath: string | null): string | null {
  if (!filePath || typeof filePath !== "string") return null;
  const match = filePath.match(/\/(Recebidas|Emitidas)\/(\d{4})\/(\d{2})\/(\d{1,2})(?:\/|$)/i);
  if (!match) return null;
  const [, , y, m, d] = match;
  const day = d.padStart(2, "0");
  if (parseInt(m, 10) < 1 || parseInt(m, 10) > 12) return null;
  if (parseInt(day, 10) < 1 || parseInt(day, 10) > 31) return null;
  return `${y}-${m}-${day}`;
}

/** Retorna data para exibição: document_date ou extraída do path (NFS Recebidas/Emitidas/YYYY/MM/DD). */
function getDocumentDisplayDate(doc: { document_date?: string | null; file_path?: string | null }): string | null {
  if (doc.document_date) return doc.document_date;
  return getDocumentDateFromPath(doc.file_path ?? null);
}

/** Para NFS (e NFE/NFC se o path tiver a mesma estrutura): retorna "recebidas" | "emitidas" a partir do path. */
function getDocumentOrigem(filePath: string | null, _docType: string): "recebidas" | "emitidas" | null {
  if (!filePath) return null;
  if (/\/Recebidas\//i.test(filePath)) return "recebidas";
  if (/\/Emitidas\//i.test(filePath)) return "emitidas";
  return null;
}

/** Gera dados do gráfico Volume Mensal a partir dos documentos (campo periodo = YYYY-MM). Últimos 12 meses. */
function buildVolumeMensalData(documents: { periodo?: string | null }[]): { name: string; value: number }[] {
  const byPeriodo = new Map<string, number>();
  for (const d of documents) {
    const p = (d.periodo || "").trim();
    if (!p || !/^\d{4}-\d{2}$/.test(p)) continue;
    byPeriodo.set(p, (byPeriodo.get(p) ?? 0) + 1);
  }
  const now = new Date();
  const result: { name: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    result.push({ name: label, value: byPeriodo.get(key) ?? 0 });
  }
  return result;
}

/** Dados mock para gráfico de certidões (totais por situação). */
const CERTIDOES_CHART_DATA = [
  { name: "Negativas (sem débito)", value: 10, color: "hsl(160, 84%, 39%)" },
  { name: "Próximas do vencimento", value: 4, color: "hsl(38, 92%, 50%)" },
  { name: "Vencidas", value: 2, color: "hsl(0, 72%, 51%)" },
];

type CertidaoStatus = "negativa" | "proxima_vencimento" | "vencida";

interface CertidaoMock {
  id: string;
  empresa: string;
  tipo: string;
  dataAtualizacao: string;
  status: CertidaoStatus;
  temPdf: boolean;
  debitos?: string[];
}

/** Lista mock de certidões (front apenas; integração virá depois). */
const CERTIDOES_LIST_MOCK: CertidaoMock[] = [
  { id: "c1", empresa: "Empresa Alpha Ltda", tipo: "Federal", dataAtualizacao: "2025-03-09", status: "negativa", temPdf: true },
  { id: "c2", empresa: "Empresa Alpha Ltda", tipo: "Estadual (GO)", dataAtualizacao: "2025-03-08", status: "proxima_vencimento", temPdf: true },
  { id: "c3", empresa: "Empresa Beta S.A.", tipo: "Federal", dataAtualizacao: "2025-03-07", status: "vencida", temPdf: true, debitos: ["INSS – competência 01/2025 – R$ 2.340,00", "FGTS – competência 01/2025 – R$ 1.150,00", "IRRF – competência 02/2025 – R$ 890,50"] },
  { id: "c4", empresa: "Empresa Beta S.A.", tipo: "Estadual (GO)", dataAtualizacao: "2025-03-05", status: "negativa", temPdf: true },
  { id: "c5", empresa: "Empresa Gama ME", tipo: "Federal", dataAtualizacao: "2025-03-01", status: "vencida", temPdf: true, debitos: ["PIS – competência 12/2024 – R$ 450,00", "COFINS – competência 12/2024 – R$ 1.220,00"] },
  { id: "c6", empresa: "Empresa Gama ME", tipo: "Estadual (GO)", dataAtualizacao: "2025-02-28", status: "proxima_vencimento", temPdf: false },
];

function formatarDataCertidao(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Formata débitos para colar no WhatsApp (organizado e legível). */
function formatarDebitosParaWhatsApp(empresa: string, tipo: string, dataAtualizacao: string, debitos: string[]): string {
  const dataFmt = formatarDataCertidao(dataAtualizacao);
  const linhas = [
    `*Débitos – ${tipo}*`,
    `${empresa}`,
    `_Atualizado em: ${dataFmt}_`,
    "",
    ...debitos.map((d) => `• ${d}`),
  ];
  return linhas.join("\n");
}

function CertidoesContent() {
  const [search, setSearch] = useState("");
  const [debitosAberto, setDebitosAberto] = useState<CertidaoMock | null>(null);

  const filteredList = useMemo(() => {
    if (!search.trim()) return CERTIDOES_LIST_MOCK;
    const q = search.toLowerCase();
    return CERTIDOES_LIST_MOCK.filter(
      (c) =>
        c.empresa.toLowerCase().includes(q) ||
        c.tipo.toLowerCase().includes(q)
    );
  }, [search]);

  const handleCopiarDebitos = (cert: CertidaoMock) => {
    if (!cert.debitos?.length) return;
    const texto = formatarDebitosParaWhatsApp(cert.empresa, cert.tipo, cert.dataAtualizacao, cert.debitos);
    navigator.clipboard.writeText(texto).then(
      () => toast.success("Débitos copiados! Cole no WhatsApp para enviar ao cliente."),
      () => toast.error("Não foi possível copiar.")
    );
  };

  const handleBaixarPdf = (cert: CertidaoMock) => {
    if (!cert.temPdf) {
      toast.error("PDF ainda não disponível para esta certidão.");
      return;
    }
    toast.info("Download do PDF será implementado com a integração das certidões.");
  };

  const totalProximas = CERTIDOES_CHART_DATA.find((d) => d.name === "Próximas do vencimento")?.value ?? 0;
  const totalVencidas = CERTIDOES_CHART_DATA.find((d) => d.name === "Vencidas")?.value ?? 0;
  const totalNegativas = CERTIDOES_CHART_DATA.find((d) => d.name === "Negativas (sem débito)")?.value ?? 0;

  return (
    <div className="space-y-6">
      {/* Resumo visual: donut + cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <GlassCard className="lg:col-span-5 p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold font-display mb-2 w-full text-left">Situação das certidões</h3>
          <p className="text-xs text-muted-foreground mb-4 w-full text-left">Visão geral por situação</p>
          <div className="w-full max-w-[260px] h-[240px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 36, right: 36, left: 36, bottom: 36 }}>
                <Pie
                  data={CERTIDOES_CHART_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="transparent"
                  label={({ value }) => value}
                  labelLine={false}
                >
                  {CERTIDOES_CHART_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, "certidões"]}
                  contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                  labelFormatter={(label) => label}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-xs">
            {CERTIDOES_CHART_DATA.map((entry) => (
              <span key={entry.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
            ))}
          </div>
        </GlassCard>
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-5 border-l-4 border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Próximas do vencimento</span>
            </div>
            <p className="text-2xl font-bold mt-2">{totalProximas}</p>
            <p className="text-xs text-muted-foreground mt-1">Certidões que vencem em breve</p>
          </GlassCard>
          <GlassCard className="p-5 border-l-4 border-l-red-500 bg-red-500/5 dark:bg-red-500/10">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
              <XCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Vencidas</span>
            </div>
            <p className="text-2xl font-bold mt-2">{totalVencidas}</p>
            <p className="text-xs text-muted-foreground mt-1">Requerem renovação</p>
          </GlassCard>
          <GlassCard className="p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <ThumbsUp className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Negativas</span>
            </div>
            <p className="text-2xl font-bold mt-2">{totalNegativas}</p>
            <p className="text-xs text-muted-foreground mt-1">Sem débito (em dia)</p>
          </GlassCard>
        </div>
      </div>

      {/* Lista de certidões */}
      <GlassCard className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold font-display">Certidões</h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa ou tipo..."
            className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-full min-w-0 sm:w-48 sm:max-w-[16rem]"
          />
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma certidão encontrada.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data atualização</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Situação</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((cert) => (
                  <tr key={cert.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{cert.empresa}</td>
                    <td className="px-4 py-3 text-muted-foreground">{cert.tipo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatarDataCertidao(cert.dataAtualizacao)}</td>
                    <td className="px-4 py-3">
                      {cert.status === "negativa" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Negativa</span>
                      )}
                      {cert.status === "proxima_vencimento" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Próxima do vencimento</span>
                      )}
                      {cert.status === "vencida" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">Vencida</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleBaixarPdf(cert)}
                          disabled={!cert.temPdf}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        {cert.status !== "negativa" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setDebitosAberto(cert)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver débitos
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

      {/* Modal débitos */}
      <Dialog open={!!debitosAberto} onOpenChange={(open) => !open && setDebitosAberto(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Débitos identificados</DialogTitle>
            <DialogDescription>
              {debitosAberto && `${debitosAberto.empresa} – ${debitosAberto.tipo}. Atualizado em ${formatarDataCertidao(debitosAberto.dataAtualizacao)}.`}
            </DialogDescription>
          </DialogHeader>
          {debitosAberto && (
            <div className="space-y-3">
              {debitosAberto.debitos && debitosAberto.debitos.length > 0 ? (
                <>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 max-h-48 overflow-y-auto pr-2">
                    {debitosAberto.debitos.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      handleCopiarDebitos(debitosAberto);
                      setDebitosAberto(null);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar para WhatsApp
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    O texto será copiado formatado (negrito, itálico e marcadores) para colar no WhatsApp e enviar ao cliente.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum débito informado para esta certidão.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FiscalDetailPage() {
  const { type } = useParams<{ type: string }>();
  const [search, setSearch] = useState("");
  const { selectedCompanyIds } = useSelectedCompanyIds();
  const companyFilter = selectedCompanyIds.length > 0 ? selectedCompanyIds : null;
  const dbType = typeToDb(type ?? "");
  const label = typeLabels[type ?? "nfs"] || "Documentos Fiscais";
  const isObrigacao = type && OBRIGACOES_FISCAIS.includes(type);
  const isNfeNfc = type === "nfe-nfc";

  const { data: documentsByType = [], isLoading: loadingByType } = useQuery({
    queryKey: ["fiscal-documents", dbType, companyFilter],
    queryFn: () => getFiscalDocumentsByType(dbType as "NFS" | "NFE" | "NFC", companyFilter),
    enabled: !isObrigacao && !isNfeNfc,
  });

  const { data: documentsNfeNfc = [], isLoading: loadingNfeNfc } = useQuery({
    queryKey: ["fiscal-documents-nfe-nfc", companyFilter],
    queryFn: () => getFiscalDocumentsNfeNfc(companyFilter),
    enabled: !isObrigacao && isNfeNfc,
  });

  const documents = isNfeNfc ? documentsNfeNfc : documentsByType;
  const isLoading = isNfeNfc ? loadingNfeNfc : loadingByType;

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterFileType, setFilterFileType] = useState<"all" | "xml" | "pdf">("all");
  const [filterOrigem, setFilterOrigem] = useState<"all" | "recebidas" | "emitidas">("all");
  const [downloadingZip, setDownloadingZip] = useState(false);

  const filteredDocuments = useMemo(() => {
    let list = documents;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          (d.empresa && d.empresa.toLowerCase().includes(q)) ||
          (d.cnpj && d.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))) ||
          (d.chave && d.chave.includes(q))
      );
    }
    if (filterDateFrom || filterDateTo) {
      list = list.filter((d) => {
        const date = getDocumentDisplayDate(d) ?? d.periodo ?? "";
        if (!date) return true;
        const docDate = date.slice(0, 10);
        if (filterDateFrom && docDate < filterDateFrom) return false;
        if (filterDateTo && docDate > filterDateTo) return false;
        return true;
      });
    }
    if (filterFileType !== "all") {
      list = list.filter((d) => {
        const fp = (d.file_path || "").toLowerCase();
        if (filterFileType === "xml") return fp.endsWith(".xml");
        if (filterFileType === "pdf") return fp.endsWith(".pdf");
        return true;
      });
    }
    if (filterOrigem !== "all") {
      list = list.filter((d) => getDocumentOrigem(d.file_path ?? null, d.type) === filterOrigem);
    }
    return list;
  }, [documents, search, filterDateFrom, filterDateTo, filterFileType, filterOrigem, type]);

  const canDownload = hasServerApi();
  const mesAtual = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const comArquivo = documents.filter((d) => d.file_path && String(d.file_path).trim()).length;
  const disponiveisCount = comArquivo;
  const esteMes = documents.filter((d) => {
    const p = (d.periodo || "").trim();
    return /^\d{4}-\d{2}$/.test(p) && p === mesAtual;
  }).length;
  const nfeCount = isNfeNfc ? documents.filter((d) => d.type === "NFE").length : 0;
  const nfcCount = isNfeNfc ? documents.filter((d) => d.type === "NFC").length : 0;

  const volumeMensalData = useMemo(() => buildVolumeMensalData(documents), [documents]);

  const handleDownload = async (id: string, chave: string | null, filePath: string | null) => {
    try {
      const suggestedName = filePath ? filePath.split("/").pop() || (chave ? `documento-${chave}` : undefined) : undefined;
      await downloadFiscalDocument(id, suggestedName);
      await markFiscalDocumentDownloaded(id);
      toast.success("Download iniciado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar o arquivo.");
    }
  };

  const getDownloadLabel = (filePath: string | null) => {
    if (!filePath) return "Baixar";
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".pdf")) return "Baixar PDF";
    if (lower.endsWith(".xml")) return "Baixar XML";
    return "Baixar";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">{label}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isObrigacao ? (type === "certidoes" ? "Emitir e consultar certidões fiscais e negativas de débito." : "Obrigações e apurações deste tópico") : "Detalhamento de XMLs e status. Baixe o XML pelo servidor quando disponível."}
        </p>
      </div>

      {isObrigacao ? (
        type === "certidoes" ? (
          <CertidoesContent />
        ) : (
          <GlassCard className="p-8">
            <p className="text-sm text-muted-foreground">Conteúdo específico desta obrigação será exibido aqui.</p>
          </GlassCard>
        )
      ) : (
        <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total" value={documents.length.toString()} icon={FileText} />
        <StatsCard title="Disponíveis" value={disponiveisCount.toString()} icon={FileDown} change={documents.length ? `${((disponiveisCount / documents.length) * 100).toFixed(1)}%` : "0%"} changeType="positive" />
        <StatsCard title="Este mês" value={esteMes.toString()} icon={CalendarDays} changeType="neutral" />
        {isNfeNfc && (
          <>
            <StatsCard title="NFE" value={nfeCount.toString()} icon={FileText} changeType="neutral" />
            <StatsCard title="NFC" value={nfcCount.toString()} icon={FileText} changeType="neutral" />
          </>
        )}
      </div>

      <GlassCard className="p-6">
        <h3 className="text-sm font-semibold font-display mb-4">Volume Mensal</h3>
        <MiniChart data={volumeMensalData} type="area" height={200} />
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col gap-3">
          <h3 className="text-sm font-semibold font-display">Documentos</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por empresa ou chave..."
              className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-full min-w-0 sm:w-40 max-w-[12rem]"
            />
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              title="Data a partir de"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              title="Data até"
            />
            <select
              value={filterFileType}
              onChange={(e) => setFilterFileType(e.target.value as "all" | "xml" | "pdf")}
              className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              title="Tipo de arquivo"
            >
              <option value="all">Todos (XML e PDF)</option>
              <option value="xml">Só XML</option>
              <option value="pdf">Só PDF</option>
            </select>
            {type === "nfs" && (
              <select
                value={filterOrigem}
                onChange={(e) => setFilterOrigem(e.target.value as "all" | "recebidas" | "emitidas")}
                className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                title="Origem"
              >
                <option value="all">NFS Tomada e Prestada</option>
                <option value="recebidas">NFS Tomada (Recebidas)</option>
                <option value="emitidas">NFS Prestada (Emitidas)</option>
              </select>
            )}
            {(type === "nfe-nfc" || isNfeNfc) && (
              <select
                value={filterOrigem}
                onChange={(e) => setFilterOrigem(e.target.value as "all" | "recebidas" | "emitidas")}
                className="rounded-lg border border-border bg-background px-3 py-2 sm:py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                title="Origem"
              >
                <option value="all">Recebidas e Emitidas</option>
                <option value="recebidas">Recebidas</option>
                <option value="emitidas">Emitidas</option>
              </select>
            )}
            {canDownload && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={downloadingZip || filteredDocuments.filter((d) => d.file_path).length === 0}
                onClick={async () => {
                  const ids = filteredDocuments.filter((d) => d.file_path && String(d.file_path).trim()).map((d) => d.id);
                  if (ids.length === 0) {
                    toast.error("Nenhum documento com arquivo nos filtros selecionados.");
                    return;
                  }
                  setDownloadingZip(true);
                  try {
                    await downloadFiscalDocumentsZip(ids);
                    toast.success(`Download iniciado: ${ids.length} arquivo(s) em documentos-fiscais.zip`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erro ao baixar ZIP.");
                  } finally {
                    setDownloadingZip(false);
                  }
                }}
              >
                <FileArchive className="h-3.5 w-3.5" />
                {downloadingZip ? "Gerando…" : "Baixar tudo (ZIP)"}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
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
                  {(type === "nfs" || isNfeNfc) && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chave</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                  {canDownload && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => {
                  const displayDate = getDocumentDisplayDate(doc);
                  const origem = getDocumentOrigem(doc.file_path ?? null, doc.type);
                  return (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{doc.empresa}</td>
                    <td className="px-4 py-3 text-muted-foreground">{doc.cnpj ?? "—"}</td>
                    <td className="px-4 py-3">{doc.periodo}</td>
                    {(type === "nfs" || isNfeNfc) && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {origem === "recebidas" ? "Tomada (Recebidas)" : origem === "emitidas" ? "Prestada (Emitidas)" : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{doc.chave ? `${doc.chave.slice(0, 20)}...` : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status as "validado" | "novo" | "divergente" | "processando" | "pendente"} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{displayDate ?? "—"}</td>
                    {canDownload && (
                      <td className="px-4 py-3">
                        {doc.file_path ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.chave, doc.file_path)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" /> {getDownloadLabel(doc.file_path)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Sem arquivo</span>
                        )}
                      </td>
                    )}
                  </tr>
                );})}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>
        </>
      )}
    </div>
  );
}
