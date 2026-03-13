import { supabase } from "./supabaseClient";
import type { Tables } from "@/types/database";

export type IrClient = Tables<"ir_clients">;
export type IrSettings = Tables<"ir_settings">;
export type IrPaymentStatus = "PIX" | "DINHEIRO" | "TRANSFERÊNCIA POUPANÇA" | "PERMUTA" | "A PAGAR";
export type IrDeclarationStatus = "Concluido" | "Pendente";

export type SaveIrClientInput = {
  nome: string;
  cpf_cnpj: string;
  responsavel_ir?: string | null;
  vencimento?: string | null;
  valor_servico: number;
  status_pagamento?: IrPaymentStatus;
  status_declaracao?: IrDeclarationStatus;
  observacoes?: string | null;
};

function normalizeIrPaymentStatus(status: string | null | undefined): IrPaymentStatus {
  if (status === "Pendente" || status === "A Pagar") return "A PAGAR";
  if (status === "Pago") return "PIX";
  if (status === "PIX" || status === "DINHEIRO" || status === "TRANSFERÊNCIA POUPANÇA" || status === "PERMUTA" || status === "A PAGAR") {
    return status;
  }
  if (status === "Dinheiro") return "DINHEIRO";
  if (status === "Transferência Poupança") return "TRANSFERÊNCIA POUPANÇA";
  if (status === "Permuta") return "PERMUTA";
  if (status === "A PAGAR") {
    return status;
  }
  return "A PAGAR";
}

function normalizeIrClient(client: IrClient): IrClient {
  return {
    ...client,
    status_pagamento: normalizeIrPaymentStatus(client.status_pagamento),
  };
}

export async function getIrClients(): Promise<IrClient[]> {
  const { data, error } = await supabase
    .from("ir_clients")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((client) => normalizeIrClient(client as IrClient));
}

export async function createIrClient(input: SaveIrClientInput): Promise<IrClient> {
  const { data, error } = await supabase
    .from("ir_clients")
    .insert({
      nome: input.nome.trim(),
      cpf_cnpj: input.cpf_cnpj.trim(),
      responsavel_ir: input.responsavel_ir?.trim() || null,
      vencimento: input.vencimento || null,
      valor_servico: input.valor_servico,
      status_pagamento: input.status_pagamento ?? (input.vencimento ? "PIX" : "A PAGAR"),
      status_declaracao: input.status_declaracao ?? "Pendente",
      observacoes: input.observacoes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIrClient(data as IrClient);
}

export async function updateIrClient(
  id: string,
  updates: Partial<Pick<IrClient, "status_pagamento" | "status_declaracao" | "observacoes" | "valor_servico" | "nome" | "cpf_cnpj" | "responsavel_ir" | "vencimento">>,
): Promise<IrClient> {
  const { data, error } = await supabase
    .from("ir_clients")
    .update({
      ...updates,
      responsavel_ir:
        updates.responsavel_ir === undefined ? undefined : updates.responsavel_ir?.trim() || null,
      vencimento: updates.vencimento === undefined ? undefined : updates.vencimento || null,
      observacoes:
        updates.observacoes === undefined ? undefined : updates.observacoes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIrClient(data as IrClient);
}

export async function deleteIrClient(id: string): Promise<void> {
  const { error } = await supabase
    .from("ir_clients")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getIrSettings(): Promise<IrSettings | null> {
  const { data, error } = await supabase
    .from("ir_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertIrSettings(paymentDueDate: string | null): Promise<IrSettings> {
  const { data, error } = await supabase
    .from("ir_settings")
    .upsert(
      {
        singleton: true,
        payment_due_date: paymentDueDate || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "singleton" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
