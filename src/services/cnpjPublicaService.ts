/**
 * Consulta CNPJ na API pública publica.cnpj.ws.
 * Usar apenas dígitos (sem máscara) na URL.
 */

const BASE = "https://publica.cnpj.ws/cnpj";

export interface CnpjPublicaEstabelecimento {
  cnpj: string;
  cnpj_raiz: string;
  nome_fantasia?: string;
  data_inicio_atividade?: string;
  data_situacao_cadastral?: string;
  email?: string;
  ddd1?: string;
  telefone1?: string;
  ddd2?: string;
  telefone2?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  atividade_principal?: { id: string; descricao: string };
  atividades_secundarias?: Array<{ id: string; descricao: string }>;
  inscricoes_estaduais?: Array<{ inscricao_estadual: string; estado?: { sigla: string } }>;
  tipo_logradouro?: string;
  estado?: { sigla: string };
  cidade?: { nome: string };
}

export interface CnpjPublicaSocio {
  nome: string;
  cpf_cnpj_socio?: string;
  tipo?: string;
  data_entrada?: string;
}

export interface CnpjPublicaResponse {
  cnpj_raiz: string;
  razao_social: string;
  capital_social?: string;
  estabelecimento: CnpjPublicaEstabelecimento;
  socios?: CnpjPublicaSocio[];
  natureza_juridica?: { descricao: string };
  porte?: { descricao: string };
  simples?: {
    simples?: string;
    data_opcao_simples?: string | null;
    data_exclusao_simples?: string | null;
  };
}

/** Dados mapeados para o formulário de Alteração Empresarial */
export interface CnpjFormData {
  razao_social: string;
  cnpj: string;
  data_abertura: string;
  tipo_atividade: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  /** Lista de sócios (nome + CPF); pode vir mais de um da API */
  socios: Array<{ nome: string; cpf_socio: string }>;
  nome_fantasia: string;
  capital_social: string;
  natureza_juridica: string;
  porte: string;
  situacao_cadastral: string;
  tributacao: string;
}

function onlyDigits(s: string): string {
  return String(s ?? "").replace(/\D/g, "");
}

function formatIE(ie: string): string {
  const d = onlyDigits(ie);
  if (d.length < 9) return ie;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
}

/** Formata data YYYY-MM-DD para DD/MM/YYYY */
function formatData(s: string | undefined): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Formata valor monetário (capital_social vem como "105000.00") */
function formatCapital(s: string | undefined): string {
  if (!s) return "";
  const n = parseFloat(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function fetchCnpjPublica(cnpjApenasDigitos: string): Promise<CnpjFormData | null> {
  const digits = onlyDigits(cnpjApenasDigitos);
  if (digits.length !== 14) return null;
  const res = await fetch(`${BASE}/${digits}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado.");
    throw new Error("API indisponível ou sem retorno.");
  }
  const data: CnpjPublicaResponse = await res.json();
  const est = data.estabelecimento;
  const ie = est?.inscricoes_estaduais?.[0]?.inscricao_estadual;
  let telefone = "";
  if (est?.ddd1 && est?.telefone1) {
    const n = String(est.telefone1).replace(/\D/g, "");
    telefone = n.length > 8 ? `(${est.ddd1}) ${n.slice(0, 5)}-${n.slice(5)}` : `(${est.ddd1}) ${n}`;
  }
  if (!telefone && est?.ddd2 && est?.telefone2) {
    const n = String(est.telefone2).replace(/\D/g, "");
    telefone = n.length > 8 ? `(${est.ddd2}) ${n.slice(0, 5)}-${n.slice(5)}` : `(${est.ddd2}) ${n}`;
  }
  const simples = data.simples?.simples;
  let tributacao = "";
  if (simples === "Sim") tributacao = "Simples Nacional";
  const cnpjRaw = est?.cnpj ?? data.cnpj_raiz;
  const cnpjDigits = cnpjRaw ? onlyDigits(cnpjRaw) : digits;
  const socios = (data.socios ?? []).map((s) => ({
    nome: s.nome ?? "",
    cpf_socio: s.cpf_cnpj_socio ?? "",
  }));
  return {
    razao_social: data.razao_social ?? "",
    cnpj: cnpjDigits.length === 14 ? cnpjDigits : digits,
    data_abertura: formatData(est?.data_inicio_atividade),
    tipo_atividade: est?.atividade_principal?.descricao ?? "",
    inscricao_estadual: ie ? formatIE(ie) : "",
    email: est?.email ?? "",
    telefone,
    socios: socios.length > 0 ? socios : [{ nome: "", cpf_socio: "" }],
    nome_fantasia: est?.nome_fantasia ?? "",
    capital_social: formatCapital(data.capital_social),
    natureza_juridica: data.natureza_juridica?.descricao ?? "",
    porte: data.porte?.descricao ?? "",
    situacao_cadastral: est?.situacao_cadastral ?? "",
    tributacao,
  };
}
