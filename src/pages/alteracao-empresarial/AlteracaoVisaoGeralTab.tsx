import { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Search, Loader2, AlertCircle, QrCode, Send, Link, Unlink, RefreshCw, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchCnpjPublica, CnpjFormData } from "@/services/cnpjPublicaService";
import { OPCOES_PARCELAMENTO } from "@/constants/parcelamentoOpcoes";
import {
  formatAlteracaoMessage,
  getConnectionStatus,
  getQrImage,
  getGroups,
  sendToGroup,
  connectWhatsApp,
  disconnectWhatsApp,
} from "@/services/whatsapp";
import {
  onlyDigits,
  validateCNPJ,
  validateCPF,
  validateEmail,
  formatCNPJ,
  formatCPF,
  formatCompetencia,
  formatDataDDMMAAAA,
  formatCurrencyBRL,
  currencyToDigits,
  formatTelefoneInput,
} from "@/lib/validators";

const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_informado", label: "Não informado" },
];

const WA_GROUP_STORAGE_KEY = "alteracao-empresarial-wa-group-id";

const TIPO_CONTABILIDADE = [
  { value: "Planilha", label: "Planilha" },
  { value: "Documentos", label: "Documentos" },
];

export function AlteracaoVisaoGeralTab() {
  const [cnpjBusca, setCnpjBusca] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const cacheRef = useRef<Record<string, CnpjFormData | null>>({});

  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waApiError, setWaApiError] = useState<string | null>(null);
  const [waGroups, setWaGroups] = useState<{ id: string; name: string }[]>([]);
  const [waGroupId, setWaGroupId] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState("");
  const [waConnecting, setWaConnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [waGroupsLoading, setWaGroupsLoading] = useState(false);
  const waAutoConnectTried = useRef(false);
  const lastQrFetchTime = useRef(0);
  const waQrRef = useRef<string | null>(null);

  const [form, setForm] = useState({
    razao_social: "",
    cnpj: "",
    qualificacao_plano: "",
    data_abertura: "",
    tipo_atividade: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    competencia_inicial: "",
    tributacao: "",
    possui_st: "nao_informado",
    socios: [{ nome_socio: "", cpf_socio: "" }],
    contatos: [{ nome_contato: "", email_contato: "", telefone_contato: "" }],
    possui_prolabore: "nao_informado",
    possui_empregados: "nao_informado",
    possui_contabilidade: "nao_informado",
    tipo_contabilidade: "",
    regime_contabil: "",
    possui_parcelamento: "nao_informado",
    tipo_parcelamento: "",
    valor_honorario: "",
    vencimento_honorario: "",
    data_primeiro_honorario: "",
    observacao: "",
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const updateSocio = (index: number, field: "nome_socio" | "cpf_socio", value: string) => {
    setForm((p) => {
      const next = [...p.socios];
      next[index] = { ...next[index], [field]: value };
      return { ...p, socios: next };
    });
  };
  const addSocio = () => setForm((p) => ({ ...p, socios: [...p.socios, { nome_socio: "", cpf_socio: "" }] }));
  const removeSocio = (index: number) => {
    setForm((p) => ({ ...p, socios: p.socios.filter((_, i) => i !== index) }));
  };

  const updateContato = (index: number, field: "nome_contato" | "email_contato" | "telefone_contato", value: string) => {
    setForm((p) => {
      const next = [...p.contatos];
      next[index] = { ...next[index], [field]: value };
      return { ...p, contatos: next };
    });
  };
  const addContato = () => setForm((p) => ({ ...p, contatos: [...p.contatos, { nome_contato: "", email_contato: "", telefone_contato: "" }] }));
  const removeContato = (index: number) => {
    setForm((p) => ({ ...p, contatos: p.contatos.filter((_, i) => i !== index) }));
  };

  useEffect(() => {
    waQrRef.current = waQr;
  }, [waQr]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setWaConnected(false);
    }, 8000);
    getConnectionStatus()
      .then((s) => { if (!cancelled) setWaConnected(s.connected); })
      .catch(() => { if (!cancelled) setWaConnected(false); })
      .finally(() => { clearTimeout(timeout); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  // Ao abrir a página: tenta conectar automaticamente se estiver desconectado (e API acessível). Se não conseguir, o polling traz o QR.
  useEffect(() => {
    if (waConnected === true) {
      waAutoConnectTried.current = false;
      return;
    }
    if (waConnected !== false || waApiError) return;
    if (waAutoConnectTried.current) return;
    waAutoConnectTried.current = true;
    connectWhatsApp().then(() => {});
  }, [waConnected, waApiError]);

  useEffect(() => {
    if (waConnected === true) {
      setWaQr(null);
      setWaApiError(null);
      const load = () =>
        getGroups().then((g) => {
          setWaGroups(g);
          const saved = localStorage.getItem(WA_GROUP_STORAGE_KEY);
          if (saved && g.some((gr) => gr.id === saved)) setWaGroupId(saved);
        });
      load();
      const t1 = setTimeout(load, 3000);
      const t2 = setTimeout(load, 8000);
      const t3 = setTimeout(load, 15000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    if (waConnected !== false) return;
    setWaGroups([]);
    setWaGroupId("");
    const tick = async () => {
      try {
        const status = await getConnectionStatus();
        setWaApiError(null);
        setWaConnected(status.connected);
        if (status.connected) {
          setWaQr(null);
          return;
        }
        const now = Date.now();
        const hasQr = waQrRef.current != null && waQrRef.current.length > 0;
        const qrExpired = hasQr && now - lastQrFetchTime.current >= 55000;
        const needQr = !hasQr || qrExpired;
        if (!needQr) return;
        const qr = await getQrImage();
        if (qr) {
          lastQrFetchTime.current = now;
          setWaQr(qr);
        } else {
          setWaQr(null);
        }
      } catch {
        setWaApiError("Servidor inacessível. Confira: 1) .env com WHATSAPP_API=http://IP_DA_VM:3010 2) Site HTTPS só funciona se a API for HTTPS 3) Firewall da VM com porta 3010 liberada.");
        setWaConnected(false);
        setWaQr(null);
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, [waConnected]);

  const handleBuscarCnpj = async () => {
    const digits = onlyDigits(cnpjBusca);
    setCnpjError("");
    if (digits.length !== 14) {
      setCnpjError("CNPJ deve ter 14 dígitos.");
      return;
    }
    if (!validateCNPJ(digits)) {
      setCnpjError("CNPJ inválido (dígitos verificadores).");
      return;
    }
    if (cacheRef.current[digits]) {
      applyCnpjData(cacheRef.current[digits]!);
      return;
    }
    setLoadingCnpj(true);
    try {
      const data = await Promise.race([
        fetchCnpjPublica(digits),
        new Promise<CnpjFormData | null>((_, rej) => setTimeout(() => rej(new Error("Timeout")), 15000)),
      ]);
      if (data) {
        cacheRef.current[digits] = data;
        applyCnpjData(data);
        toast.success("Dados preenchidos pela Receita.");
      } else {
        setCnpjError("Resposta da API sem dados utilizáveis.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar CNPJ.";
      setCnpjError(msg);
      toast.error(msg);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const applyCnpjData = (data: CnpjFormData) => {
    if (!data) return;
    const socios = data.socios?.length ? data.socios.map((s) => ({ nome_socio: s.nome, cpf_socio: s.cpf_socio })) : [{ nome_socio: "", cpf_socio: "" }];
    setForm((p) => {
      const nextContatos = [...p.contatos];
      if (nextContatos.length > 0) {
        nextContatos[0] = {
          ...nextContatos[0],
          email_contato: data.email ?? nextContatos[0].email_contato,
          telefone_contato: data.telefone ?? nextContatos[0].telefone_contato,
        };
      }
      return {
        ...p,
        razao_social: data.razao_social || p.razao_social,
        cnpj: data.cnpj || p.cnpj,
        data_abertura: data.data_abertura || p.data_abertura,
        tipo_atividade: data.tipo_atividade || p.tipo_atividade,
        inscricao_estadual: data.inscricao_estadual || p.inscricao_estadual,
        tributacao: data.tributacao || p.tributacao,
        socios,
        contatos: nextContatos,
      };
    });
  };

  const handleFinalizado = async () => {
    for (let i = 0; i < form.socios.length; i++) {
      const s = form.socios[i];
      const d = onlyDigits(s.cpf_socio);
      if (d.length === 11 && !validateCPF(s.cpf_socio)) {
        toast.error(`CPF do sócio ${form.socios.length > 1 ? i + 1 : ""} inválido.`);
        return;
      }
    }
    for (const c of form.contatos) {
      const email = (c.email_contato ?? "").trim();
      if (email && !validateEmail(email)) {
        toast.error("E-mail do contato inválido.");
        return;
      }
    }
    const message = formatAlteracaoMessage(form);
    if (waConnected && waGroupId) {
      setWaError("");
      setWaLoading(true);
      try {
        const result = await sendToGroup(waGroupId, message);
        if (result.ok) {
          toast.success("Mensagem enviada ao grupo no WhatsApp.");
        } else {
          setWaError(result.error ?? "Falha ao enviar");
          toast.error(result.error ?? "Falha ao enviar");
        }
      } finally {
        setWaLoading(false);
      }
    } else {
      toast.success("Formulário validado. Conecte o WhatsApp e selecione um grupo para enviar.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Métricas placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Contratos" value="—" icon={FileText} />
        <StatsCard title="Formulários" value="—" icon={FileText} />
        <StatsCard title="Pendências" value="—" icon={FileText} />
      </div>

      {/* Formulário principal */}
      <GlassCard className="p-6 space-y-8">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Buscar por CNPJ</Label>
            <Input
              placeholder="00.000.000/0001-00"
              value={formatCNPJ(cnpjBusca)}
              onChange={(e) => setCnpjBusca(onlyDigits(e.target.value).slice(0, 14))}
              className="font-mono"
              maxLength={18}
            />
            {cnpjError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {cnpjError}
              </p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={handleBuscarCnpj} disabled={loadingCnpj}>
            {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loadingCnpj ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {/* 1) Identificação da Empresa */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* 1. Identificação da Empresa *</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razão Social</Label>
              <Input value={form.razao_social} onChange={(e) => update("razao_social", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={formatCNPJ(form.cnpj)}
                onChange={(e) => update("cnpj", onlyDigits(e.target.value).slice(0, 14))}
                placeholder="00.000.000/0001-00"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Qualificação do Plano</Label>
              <Input value={form.qualificacao_plano} onChange={(e) => update("qualificacao_plano", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de Abertura</Label>
              <Input
                value={form.data_abertura}
                onChange={(e) => update("data_abertura", formatDataDDMMAAAA(e.target.value))}
                placeholder="DD/MM/AAAA"
                className="font-mono"
                maxLength={10}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Tipo de Atividade</Label>
              <Input value={form.tipo_atividade} onChange={(e) => update("tipo_atividade", e.target.value)} />
            </div>
          </div>
        </section>

        {/* 2) Inscrições e Enquadramento */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* 2. Inscrições e Enquadramento *</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input value={form.inscricao_estadual} onChange={(e) => update("inscricao_estadual", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Municipal</Label>
              <Input value={form.inscricao_municipal} onChange={(e) => update("inscricao_municipal", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Competência Inicial</Label>
              <Input
                value={form.competencia_inicial}
                onChange={(e) => update("competencia_inicial", formatCompetencia(e.target.value))}
                placeholder="MM/AAAA"
                className="font-mono"
                maxLength={7}
              />
            </div>
            <div className="space-y-2">
              <Label>Tributação</Label>
              <Input value={form.tributacao} onChange={(e) => update("tributacao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Possui Substituição Tributária</Label>
              <Select value={form.possui_st} onValueChange={(v) => update("possui_st", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIM_NAO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 3) Dados Societários e Contato */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* 3. Dados Societários e Contato *</h3>
          <div className="space-y-4">
            {form.socios.map((socio, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg border border-border/60 bg-muted/20">
                {form.socios.length > 1 && (
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Sócio {idx + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSocio(idx)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Nome do Sócio</Label>
                  <Input value={socio.nome_socio} onChange={(e) => updateSocio(idx, "nome_socio", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF do Sócio</Label>
                  <Input
                    value={socio.cpf_socio}
                    onChange={(e) => updateSocio(idx, "cpf_socio", formatCPF(onlyDigits(e.target.value).slice(0, 11)))}
                    placeholder="000.000.000-00"
                    className="font-mono"
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSocio} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar sócio
            </Button>
          </div>
          <div className="space-y-4 pt-2">
            <Label>Contatos</Label>
            {form.contatos.map((contato, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Contato {form.contatos.length > 1 ? idx + 1 : ""}</span>
                  {form.contatos.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeContato(idx)} title="Remover contato" className="text-destructive hover:text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nome do Contato Responsável</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={contato.nome_contato}
                        onChange={(e) => updateContato(idx, "nome_contato", e.target.value)}
                        placeholder="Nome do responsável"
                        className="flex-1"
                      />
                      {idx === form.contatos.length - 1 && (
                        <Button type="button" variant="outline" size="icon" onClick={addContato} title="Adicionar contato">
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail(s) do Contato</Label>
                    <Input
                      type="email"
                      value={contato.email_contato}
                      onChange={(e) => updateContato(idx, "email_contato", e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone(s) do Contato</Label>
                    <Input
                      value={contato.telefone_contato}
                      onChange={(e) => updateContato(idx, "telefone_contato", formatTelefoneInput(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
            {form.contatos.length <= 1 && (
              <Button type="button" variant="outline" size="sm" onClick={addContato} className="gap-1">
                <Plus className="h-4 w-4" /> Adicionar contato
              </Button>
            )}
          </div>
        </section>

        {/* 4) Kits de obrigações */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* 4. Kits de obrigações *</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Possui Pró-labore</Label>
              <Select value={form.possui_prolabore} onValueChange={(v) => update("possui_prolabore", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIM_NAO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Possui Empregados</Label>
              <Select value={form.possui_empregados} onValueChange={(v) => update("possui_empregados", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIM_NAO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Possui Contabilidade</Label>
              <Select value={form.possui_contabilidade} onValueChange={(v) => update("possui_contabilidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIM_NAO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.possui_contabilidade === "sim" && (
              <div className="space-y-2">
                <Label>Tipo de Contabilidade</Label>
                <Select value={form.tipo_contabilidade} onValueChange={(v) => update("tipo_contabilidade", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPO_CONTABILIDADE.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Regime Contábil</Label>
              <Input value={form.regime_contabil} onChange={(e) => update("regime_contabil", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Possui Parcelamento</Label>
              <Select value={form.possui_parcelamento} onValueChange={(v) => update("possui_parcelamento", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIM_NAO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.possui_parcelamento === "sim" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Tipo de Parcelamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {form.tipo_parcelamento || "Buscar ou selecionar..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar parcelamento..." />
                      <CommandList>
                        <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                        <CommandGroup>
                          {OPCOES_PARCELAMENTO.map((o) => (
                            <CommandItem
                              key={o.value}
                              value={o.label}
                              onSelect={() => update("tipo_parcelamento", o.label)}
                            >
                              {o.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Digite para buscar ou escolha uma opção.</p>
              </div>
            )}
          </div>
        </section>

        {/* 5) Honorários */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* 5. Honorários *</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor do Honorário Mensal (R$)</Label>
              <Input
                value={formatCurrencyBRL(form.valor_honorario)}
                onChange={(e) => update("valor_honorario", currencyToDigits(e.target.value))}
                placeholder="0,00"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento do Honorário (dia)</Label>
              <Input value={form.vencimento_honorario} onChange={(e) => update("vencimento_honorario", e.target.value)} placeholder="Ex: 20" />
            </div>
            <div className="space-y-2">
              <Label>Data do Primeiro Honorário</Label>
              <Input
                value={form.data_primeiro_honorario}
                onChange={(e) => update("data_primeiro_honorario", formatDataDDMMAAAA(e.target.value))}
                placeholder="DD/MM/AAAA"
                className="font-mono"
                maxLength={10}
              />
            </div>
          </div>
        </section>

        {/* Observação */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold font-display border-b-2 border-primary/30 pb-2">* Observação *</h3>
          <div className="space-y-2">
            <Label>Observação (texto livre)</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => update("observacao", e.target.value)}
              placeholder="Informações adicionais em texto livre..."
              className="min-h-[100px]"
            />
          </div>
        </section>

        <div className="pt-4 border-t flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleFinalizado} disabled={waLoading}>
            {waLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Finalizado
          </Button>
        </div>
      </GlassCard>

      {/* Seção WhatsApp: conexão, QR, grupos, envio ao clicar Finalizado */}
      <GlassCard className="p-6 space-y-4">
        <h3 className="text-sm font-semibold font-display">WhatsApp</h3>
        {waConnected === null && (
          <p className="text-sm text-muted-foreground">Verificando conexão...</p>
        )}
        {waConnected === false && (
          <div className="space-y-2">
            {waApiError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 shrink-0" /> {waApiError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={!!waApiError || waConnecting}
                onClick={async () => {
                  setWaConnecting(true);
                  setWaError("");
                  try {
                    const r = await connectWhatsApp();
                    if (r.ok) {
                      const s = await getConnectionStatus();
                      setWaConnected(s.connected);
                      if (s.connected) setWaQr(null);
                      if (!s.connected) toast.info("Cliente iniciando. Aguarde o QR ou a reconexão pela sessão.");
                    } else toast.error(r.error || "Falha ao conectar");
                  } finally {
                    setWaConnecting(false);
                  }
                }}
              >
                {waConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                Conectar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code com o WhatsApp (Dispositivos conectados). O QR é renovado automaticamente quando expirar. A sessão é mantida ao desconectar.
            </p>
            {waQr ? (
              <img
                src={waQr}
                alt="QR Code WhatsApp Web"
                className="w-[280px] h-[280px] border border-border rounded-lg bg-white object-contain p-2"
                style={{ imageRendering: "crisp-edges" }}
              />
            ) : (
              <div className="w-64 h-64 border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 bg-muted/30 p-4">
                <QrCode className="h-12 w-12 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">Aguardando QR. Inicie o backend (npm run dev ou node server.js em backend/whatsapp-emissor). Se desconectou no celular, clique em Conectar acima para gerar um novo QR.</p>
              </div>
            )}
          </div>
        )}
        {waConnected === true && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={waDisconnecting}
                onClick={async () => {
                  setWaDisconnecting(true);
                  setWaError("");
                  try {
                    const r = await disconnectWhatsApp();
                    if (r.ok) {
                      setWaConnected(false);
                      setWaQr(null);
                      setWaGroups([]);
                      setWaGroupId("");
                      toast.success("Desconectado. Sessão mantida — use Conectar para reconectar.");
                    } else toast.error(r.error || "Falha ao desconectar");
                  } finally {
                    setWaDisconnecting(false);
                  }
                }}
              >
                {waDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Desconectar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Conectado. Selecione o grupo e clique em &quot;Finalizado&quot; para enviar o formulário.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={waGroupId}
                onValueChange={(id) => {
                  setWaGroupId(id);
                  if (id) localStorage.setItem(WA_GROUP_STORAGE_KEY, id);
                }}
              >
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  {waGroups.length === 0 ? (
                    <SelectItem value="_empty" disabled>Nenhum grupo disponível</SelectItem>
                  ) : (
                    waGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={waGroupsLoading}
                onClick={async () => {
                  setWaGroupsLoading(true);
                  try {
                    const g = await getGroups();
                    setWaGroups(g);
                    const saved = localStorage.getItem(WA_GROUP_STORAGE_KEY);
                    if (saved && g.some((gr) => gr.id === saved)) setWaGroupId(saved);
                    if (g.length > 0) toast.success(`${g.length} grupo(s) carregado(s).`);
                    else toast.info("Nenhum grupo encontrado. Aguarde a sincronização ou tente novamente.");
                  } finally {
                    setWaGroupsLoading(false);
                  }
                }}
              >
                {waGroupsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar grupos
              </Button>
            </div>
            {waError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {waError}
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
