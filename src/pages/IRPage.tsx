import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { ArrowDownUp, FileCheck, FileClock, Landmark, Plus, Save, Wallet } from "lucide-react";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DataPagination } from "@/components/common/DataPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCnpjPublica } from "@/services/cnpjPublicaService";
import {
  createIrClient,
  getIrClients,
  type IrClient,
  type IrDeclarationStatus,
  type IrPaymentStatus,
  updateIrClient,
} from "@/services/irService";

type SortKey = "nome" | "cpf_cnpj" | "valor_servico" | "created_at" | null;
type SortDirection = "desc" | "asc" | null;
type SortState = { key: SortKey; direction: SortDirection };
type PaymentFilters = { status: "Todos" | IrPaymentStatus; dateFrom: string; dateTo: string; minValue: string; maxValue: string };
type ExecutionFilters = { status: "Todos" | IrDeclarationStatus; dateFrom: string; dateTo: string; minValue: string; maxValue: string };

const emptyForm = { nome: "", cpf_cnpj: "", responsavel_ir: "", vencimento: "", valor_servico: "", observacoes: "" };
const emptyPaymentFilters: PaymentFilters = { status: "Todos", dateFrom: "", dateTo: "", minValue: "", maxValue: "" };
const emptyExecutionFilters: ExecutionFilters = { status: "Todos", dateFrom: "", dateTo: "", minValue: "", maxValue: "" };
const paymentStatusOptions: Array<"Todos" | IrPaymentStatus> = ["Todos", "Pago", "Pendente"];
const executionStatusOptions: Array<"Todos" | IrDeclarationStatus> = ["Todos", "Concluido", "Pendente"];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function normalizeCurrencyInput(value: string) {
  return value.replace(",", ".").replace(/[^\d.]/g, "");
}
function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}
function formatIsoDate(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
}
function cycleSort(current: SortState, key: Exclude<SortKey, null>): SortState {
  if (current.key !== key) return { key, direction: "desc" };
  if (current.direction === "desc") return { key, direction: "asc" };
  if (current.direction === "asc") return { key: null, direction: null };
  return { key, direction: "desc" };
}
function compareClients(a: IrClient, b: IrClient, sort: SortState) {
  if (!sort.key || !sort.direction) return 0;
  const getValue = (client: IrClient) => {
    if (sort.key === "nome") return String(client.nome || "").toLowerCase();
    if (sort.key === "cpf_cnpj") return onlyDigits(client.cpf_cnpj || "");
    if (sort.key === "valor_servico") return Number(client.valor_servico || 0);
    return new Date(client.created_at).getTime();
  };
  const aValue = getValue(a);
  const bValue = getValue(b);
  const result =
    typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue), "pt-BR");
  return sort.direction === "desc" ? result * -1 : result;
}
function SortHeader({ label, column, sort, onToggle }: { label: string; column: Exclude<SortKey, null>; sort: SortState; onToggle: (key: Exclude<SortKey, null>) => void }) {
  const active = sort.key === column ? (sort.direction === "desc" ? " ↓" : sort.direction === "asc" ? " ↑" : "") : "";
  return (
    <button type="button" onClick={() => onToggle(column)} className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground">
      <span>{label}{active}</span>
      <ArrowDownUp className={`h-3.5 w-3.5 ${sort.key === column ? "text-foreground" : "opacity-50"}`} />
    </button>
  );
}

export default function IRPage() {
  const queryClient = useQueryClient();
  const [globalResponsible, setGlobalResponsible] = useState("Todos");
  const [paymentPageSize, setPaymentPageSize] = useState(10);
  const [paymentCurrentPage, setPaymentCurrentPage] = useState(1);
  const [executionPageSize, setExecutionPageSize] = useState(10);
  const [executionCurrentPage, setExecutionCurrentPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [paymentFilters, setPaymentFilters] = useState(emptyPaymentFilters);
  const [executionFilters, setExecutionFilters] = useState(emptyExecutionFilters);
  const [paymentSort, setPaymentSort] = useState<SortState>({ key: null, direction: null });
  const [executionSort, setExecutionSort] = useState<SortState>({ key: null, direction: null });
  const [autofillLoading, setAutofillLoading] = useState(false);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ["ir-clients"], queryFn: getIrClients });
  useEffect(() => setNotesDraft(Object.fromEntries(clients.map((client) => [client.id, client.observacoes ?? ""]))), [clients]);

  const refreshIrData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ir-clients"] }),
    ]);
  };

  const createClientMutation = useMutation({
    mutationFn: async () => {
      const valorServico = Number(normalizeCurrencyInput(form.valor_servico));
      if (!form.nome.trim() || !form.cpf_cnpj.trim() || Number.isNaN(valorServico)) {
        throw new Error("Preencha nome, CPF/CNPJ e valor do serviço.");
      }
      return createIrClient({
        nome: form.nome,
        cpf_cnpj: form.cpf_cnpj,
        responsavel_ir: form.responsavel_ir,
        vencimento: form.vencimento || null,
        valor_servico: valorServico,
        observacoes: form.observacoes,
      });
    },
    onSuccess: async () => {
      setForm(emptyForm);
      await refreshIrData();
      toast.success("Cliente de IR cadastrado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar o cliente."),
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, updates, successMessage }: { id: string; updates: Partial<Pick<IrClient, "status_pagamento" | "status_declaracao" | "observacoes">>; successMessage: string }) => {
      await updateIrClient(id, updates);
      return successMessage;
    },
    onSuccess: async (message) => {
      await refreshIrData();
      toast.success(message);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o cliente."),
  });

  const responsibleOptions = useMemo(() => Array.from(new Set(clients.map((c) => c.responsavel_ir?.trim() || "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [clients]);
  const clientsByResponsible = useMemo(() => globalResponsible === "Todos" ? clients : clients.filter((c) => (c.responsavel_ir?.trim() || "") === globalResponsible), [clients, globalResponsible]);
  const paymentSummary = useMemo(() => ({
    paid: clientsByResponsible.filter((c) => c.status_pagamento === "Pago").length,
    pending: clientsByResponsible.filter((c) => c.status_pagamento === "Pendente").length,
    totalValue: clientsByResponsible.reduce((sum, c) => sum + Number(c.valor_servico || 0), 0),
  }), [clientsByResponsible]);
  const executionSummary = useMemo(() => ({
    concluido: clientsByResponsible.filter((c) => c.status_declaracao === "Concluido").length,
    pendente: clientsByResponsible.filter((c) => c.status_declaracao !== "Concluido").length,
    total: clientsByResponsible.length,
  }), [clientsByResponsible]);

  const filteredPayments = useMemo(() => [...clientsByResponsible].filter((client) => {
    const createdAt = formatIsoDate(client.created_at);
    const value = Number(client.valor_servico || 0);
    if (paymentFilters.status !== "Todos" && client.status_pagamento !== paymentFilters.status) return false;
    if (paymentFilters.dateFrom && createdAt < paymentFilters.dateFrom) return false;
    if (paymentFilters.dateTo && createdAt > paymentFilters.dateTo) return false;
    if (paymentFilters.minValue && value < Number(normalizeCurrencyInput(paymentFilters.minValue) || "0")) return false;
    if (paymentFilters.maxValue && value > Number(normalizeCurrencyInput(paymentFilters.maxValue) || "0")) return false;
    return true;
  }).sort((a, b) => compareClients(a, b, paymentSort)), [clientsByResponsible, paymentFilters, paymentSort]);

  const filteredExecutions = useMemo(() => [...clientsByResponsible].filter((client) => {
    const createdAt = formatIsoDate(client.created_at);
    const value = Number(client.valor_servico || 0);
    if (executionFilters.status !== "Todos" && client.status_declaracao !== executionFilters.status) return false;
    if (executionFilters.dateFrom && createdAt < executionFilters.dateFrom) return false;
    if (executionFilters.dateTo && createdAt > executionFilters.dateTo) return false;
    if (executionFilters.minValue && value < Number(normalizeCurrencyInput(executionFilters.minValue) || "0")) return false;
    if (executionFilters.maxValue && value > Number(normalizeCurrencyInput(executionFilters.maxValue) || "0")) return false;
    return true;
  }).sort((a, b) => compareClients(a, b, executionSort)), [clientsByResponsible, executionFilters, executionSort]);

  const paymentPagination = useMemo(() => {
    const total = filteredPayments.length;
    const totalPages = Math.max(1, Math.ceil(total / paymentPageSize));
    const page = Math.min(paymentCurrentPage, totalPages);
    const fromIndex = (page - 1) * paymentPageSize;
    const toIndex = Math.min(fromIndex + paymentPageSize, total);
    return { list: filteredPayments.slice(fromIndex, toIndex), total, totalPages, currentPage: page, from: total ? fromIndex + 1 : 0, to: toIndex };
  }, [filteredPayments, paymentCurrentPage, paymentPageSize]);

  const executionPagination = useMemo(() => {
    const total = filteredExecutions.length;
    const totalPages = Math.max(1, Math.ceil(total / executionPageSize));
    const page = Math.min(executionCurrentPage, totalPages);
    const fromIndex = (page - 1) * executionPageSize;
    const toIndex = Math.min(fromIndex + executionPageSize, total);
    return { list: filteredExecutions.slice(fromIndex, toIndex), total, totalPages, currentPage: page, from: total ? fromIndex + 1 : 0, to: toIndex };
  }, [filteredExecutions, executionCurrentPage, executionPageSize]);

  const progressData = [
    { name: "Concluídos", value: executionSummary.concluido, color: "hsl(214, 84%, 56%)" },
    { name: "Pendentes", value: executionSummary.pendente, color: "hsl(38, 92%, 50%)" },
  ];
  const completionPercent = executionSummary.total ? Math.round((executionSummary.concluido / executionSummary.total) * 100) : 0;

  const handleCpfCnpjAutofill = async () => {
    const digits = onlyDigits(form.cpf_cnpj);
    if (digits.length !== 14 || autofillLoading) return;
    setAutofillLoading(true);
    try {
      const data = await fetchCnpjPublica(digits);
      if (data?.razao_social) {
        setForm((current) => ({ ...current, nome: current.nome.trim() || data.razao_social }));
        toast.success("Nome preenchido automaticamente pelo CNPJ.");
      }
    } catch {
      toast.error("Não foi possível consultar o CNPJ informado.");
    } finally {
      setAutofillLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">IR</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de clientes de imposto de renda, pagamentos e execução das declarações.</p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="ir-global-responsavel">Responsável pelo IR</Label>
          <Select value={globalResponsible} onValueChange={setGlobalResponsible}>
            <SelectTrigger id="ir-global-responsavel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {responsibleOptions.map((responsavel) => <SelectItem key={responsavel} value={responsavel}>{responsavel}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Clientes IR" value={clientsByResponsible.length.toString()} icon={Landmark} />
        <StatsCard title="Pagos" value={paymentSummary.paid.toString()} icon={Wallet} changeType="positive" />
        <StatsCard title="Pendentes" value={paymentSummary.pending.toString()} icon={FileClock} changeType="negative" />
        <StatsCard title="Concluídos" value={`${completionPercent}%`} icon={FileCheck} change={`${executionSummary.concluido}/${executionSummary.total}`} changeType="positive" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <GlassCard className="xl:col-span-2 p-6">
          <div className="mb-5">
            <h3 className="text-sm font-semibold font-display">Cadastro de clientes IR</h3>
            <p className="text-xs text-muted-foreground mt-1">Clientes de IR são cadastrados separadamente das empresas.</p>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(event) => { event.preventDefault(); createClientMutation.mutate(); }}>
            <div className="space-y-2"><Label htmlFor="ir-nome">Nome</Label><Input id="ir-nome" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome do cliente" /></div>
            <div className="space-y-2">
              <Label htmlFor="ir-cpf-cnpj">CPF ou CNPJ</Label>
              <Input id="ir-cpf-cnpj" value={form.cpf_cnpj} onChange={(event) => setForm((current) => ({ ...current, cpf_cnpj: event.target.value }))} onKeyDown={(event) => { if (event.key === "Tab") void handleCpfCnpjAutofill(); }} onBlur={() => { if (onlyDigits(form.cpf_cnpj).length === 14) void handleCpfCnpjAutofill(); }} placeholder="000.000.000-00" />
              <p className="text-[11px] text-muted-foreground">Autopreenchimento disponível para CNPJ. Para CPF não há integração pública confiável nesta implementação.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="ir-responsavel">Responsável pelo IR</Label><Input id="ir-responsavel" value={form.responsavel_ir} onChange={(event) => setForm((current) => ({ ...current, responsavel_ir: event.target.value }))} placeholder="Nome do responsável" /></div>
            <div className="space-y-2"><Label htmlFor="ir-valor">Valor do serviço</Label><Input id="ir-valor" value={form.valor_servico} onChange={(event) => setForm((current) => ({ ...current, valor_servico: event.target.value }))} placeholder="150,00" inputMode="decimal" /></div>
            <div className="space-y-2"><Label htmlFor="ir-vencimento">Vencimento</Label><Input id="ir-vencimento" type="date" value={form.vencimento} onChange={(event) => setForm((current) => ({ ...current, vencimento: event.target.value }))} /></div>
            <div className="md:col-span-2 space-y-2"><Label htmlFor="ir-observacoes">Observações</Label><Textarea id="ir-observacoes" value={form.observacoes} onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} placeholder="Informações complementares do cliente." rows={4} /></div>
            <div className="md:col-span-2 flex justify-end"><Button type="submit" disabled={createClientMutation.isPending || autofillLoading}><Plus className="mr-2 h-4 w-4" />Cadastrar cliente</Button></div>
          </form>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold font-display">Progresso do IR</h3>
          <p className="text-xs text-muted-foreground mt-1">Percentual de declarações concluídas e pendentes.</p>
          <div className="h-[220px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={progressData} cx="50%" cy="50%" innerRadius={54} outerRadius={82} paddingAngle={3} dataKey="value" label={({ value }) => value} labelLine={false}>
                  {progressData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "clientes"]} contentStyle={{ background: "#ffffff", color: "#111827", border: "1px solid rgba(15, 23, 42, 0.12)", borderRadius: "10px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs">
            {progressData.map((item) => <div key={item.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-medium">{item.value}</span></div>)}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 mt-4"><p className="text-[11px] text-muted-foreground">Valor total de serviços</p><p className="text-sm font-semibold mt-1">{formatCurrency(paymentSummary.totalValue)}</p></div>
          </div>
        </GlassCard>
      </div>

      <Tabs defaultValue="pagamentos" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="execucao">Execução</TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-border space-y-4">
              <div><h3 className="text-sm font-semibold font-display">Pagamentos</h3><p className="text-xs text-muted-foreground mt-1">Controle financeiro por cliente e vencimento individual.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Data inicial</Label><Input type="date" value={paymentFilters.dateFrom} onChange={(event) => { setPaymentFilters((current) => ({ ...current, dateFrom: event.target.value })); setPaymentCurrentPage(1); }} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Data final</Label><Input type="date" value={paymentFilters.dateTo} onChange={(event) => { setPaymentFilters((current) => ({ ...current, dateTo: event.target.value })); setPaymentCurrentPage(1); }} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Valor mínimo</Label><Input value={paymentFilters.minValue} onChange={(event) => { setPaymentFilters((current) => ({ ...current, minValue: event.target.value })); setPaymentCurrentPage(1); }} placeholder="0,00" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Valor máximo</Label><Input value={paymentFilters.maxValue} onChange={(event) => { setPaymentFilters((current) => ({ ...current, maxValue: event.target.value })); setPaymentCurrentPage(1); }} placeholder="999,99" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Status</Label><Select value={paymentFilters.status} onValueChange={(value) => { setPaymentFilters((current) => ({ ...current, status: value as PaymentFilters["status"] })); setPaymentCurrentPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentStatusOptions.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[920px]">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3"><SortHeader label="Nome" column="nome" sort={paymentSort} onToggle={(key) => setPaymentSort((current) => cycleSort(current, key))} /></th>
                  <th className="px-4 py-3"><SortHeader label="CPF/CNPJ" column="cpf_cnpj" sort={paymentSort} onToggle={(key) => setPaymentSort((current) => cycleSort(current, key))} /></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Responsável</th>
                  <th className="px-4 py-3"><SortHeader label="Valor do serviço" column="valor_servico" sort={paymentSort} onToggle={(key) => setPaymentSort((current) => cycleSort(current, key))} /></th>
                  <th className="px-4 py-3"><SortHeader label="Data" column="created_at" sort={paymentSort} onToggle={(key) => setPaymentSort((current) => cycleSort(current, key))} /></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status de pagamento</th>
                </tr></thead>
                <tbody>{paymentPagination.list.map((client) => (
                  <tr key={client.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{client.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.cpf_cnpj}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.responsavel_ir || "—"}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(client.valor_servico || 0))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatIsoDate(client.created_at) || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.vencimento || "—"}</td>
                    <td className="px-4 py-3"><Select value={client.status_pagamento} onValueChange={(value) => updateClientMutation.mutate({ id: client.id, updates: { status_pagamento: value as IrPaymentStatus }, successMessage: "Status de pagamento atualizado." })}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{paymentStatusOptions.filter((status) => status !== "Todos").map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {paymentPagination.total > 0 && <DataPagination currentPage={paymentPagination.currentPage} totalPages={paymentPagination.totalPages} totalItems={paymentPagination.total} from={paymentPagination.from} to={paymentPagination.to} pageSize={paymentPageSize} onPageChange={setPaymentCurrentPage} onPageSizeChange={(next) => { setPaymentPageSize(next); setPaymentCurrentPage(1); }} />}
            {!isLoading && paymentPagination.total === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado com os filtros de pagamentos.</div>}
          </GlassCard>
        </TabsContent>

        <TabsContent value="execucao" className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-border space-y-4">
              <div><h3 className="text-sm font-semibold font-display">Execução</h3><p className="text-xs text-muted-foreground mt-1">Controle das declarações e observações por cliente.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="space-y-1"><Label className="text-[11px]">Data inicial</Label><Input type="date" value={executionFilters.dateFrom} onChange={(event) => { setExecutionFilters((current) => ({ ...current, dateFrom: event.target.value })); setExecutionCurrentPage(1); }} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Data final</Label><Input type="date" value={executionFilters.dateTo} onChange={(event) => { setExecutionFilters((current) => ({ ...current, dateTo: event.target.value })); setExecutionCurrentPage(1); }} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Valor mínimo</Label><Input value={executionFilters.minValue} onChange={(event) => { setExecutionFilters((current) => ({ ...current, minValue: event.target.value })); setExecutionCurrentPage(1); }} placeholder="0,00" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Valor máximo</Label><Input value={executionFilters.maxValue} onChange={(event) => { setExecutionFilters((current) => ({ ...current, maxValue: event.target.value })); setExecutionCurrentPage(1); }} placeholder="999,99" /></div>
                <div className="space-y-1"><Label className="text-[11px]">Status</Label><Select value={executionFilters.status} onValueChange={(value) => { setExecutionFilters((current) => ({ ...current, status: value as ExecutionFilters["status"] })); setExecutionCurrentPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{executionStatusOptions.map((status) => <SelectItem key={status} value={status}>{status === "Concluido" ? "Concluído" : status}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1040px]">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3"><SortHeader label="Nome" column="nome" sort={executionSort} onToggle={(key) => setExecutionSort((current) => cycleSort(current, key))} /></th>
                  <th className="px-4 py-3"><SortHeader label="CPF/CNPJ" column="cpf_cnpj" sort={executionSort} onToggle={(key) => setExecutionSort((current) => cycleSort(current, key))} /></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Responsável</th>
                  <th className="px-4 py-3"><SortHeader label="Valor do serviço" column="valor_servico" sort={executionSort} onToggle={(key) => setExecutionSort((current) => cycleSort(current, key))} /></th>
                  <th className="px-4 py-3"><SortHeader label="Data" column="created_at" sort={executionSort} onToggle={(key) => setExecutionSort((current) => cycleSort(current, key))} /></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status da declaração</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Observações</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr></thead>
                <tbody>{executionPagination.list.map((client) => (
                  <tr key={client.id} className="border-b border-border align-top hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{client.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.cpf_cnpj}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.responsavel_ir || "—"}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(client.valor_servico || 0))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatIsoDate(client.created_at) || "—"}</td>
                    <td className="px-4 py-3"><Select value={client.status_declaracao} onValueChange={(value) => updateClientMutation.mutate({ id: client.id, updates: { status_declaracao: value as IrDeclarationStatus }, successMessage: "Status da declaração atualizado." })}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent>{executionStatusOptions.filter((status) => status !== "Todos").map((status) => <SelectItem key={status} value={status}>{status === "Concluido" ? "Concluído" : status}</SelectItem>)}</SelectContent></Select></td>
                    <td className="px-4 py-3"><Textarea value={notesDraft[client.id] ?? ""} onChange={(event) => setNotesDraft((current) => ({ ...current, [client.id]: event.target.value }))} rows={3} className="min-w-[280px]" /></td>
                    <td className="px-4 py-3"><Button type="button" variant="outline" onClick={() => updateClientMutation.mutate({ id: client.id, updates: { observacoes: notesDraft[client.id] ?? "" }, successMessage: "Observações atualizadas." })}><Save className="mr-2 h-4 w-4" />Salvar</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {executionPagination.total > 0 && <DataPagination currentPage={executionPagination.currentPage} totalPages={executionPagination.totalPages} totalItems={executionPagination.total} from={executionPagination.from} to={executionPagination.to} pageSize={executionPageSize} onPageChange={setExecutionCurrentPage} onPageSizeChange={(next) => { setExecutionPageSize(next); setExecutionCurrentPage(1); }} />}
            {!isLoading && executionPagination.total === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado com os filtros de execução.</div>}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
