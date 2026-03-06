export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; role: string; created_at: string; panel_access: Record<string, boolean> }
        Insert: { id: string; username: string; role: string; created_at?: string; panel_access?: Record<string, boolean> }
        Update: { id?: string; username?: string; role?: string; created_at?: string; panel_access?: Record<string, boolean> }
      }
      companies: {
        Row: { id: string; name: string; document: string | null; created_by: string | null; created_at: string; active: boolean; auth_mode: string | null; cert_blob_b64: string | null; cert_password: string | null; cert_valid_until: string | null; contador_nome: string | null; contador_cpf: string | null }
        Insert: { id?: string; name: string; document?: string | null; created_by?: string | null; created_at?: string; active?: boolean; auth_mode?: string | null; cert_blob_b64?: string | null; cert_password?: string | null; cert_valid_until?: string | null; contador_nome?: string | null; contador_cpf?: string | null }
        Update: { id?: string; name?: string; document?: string | null; created_by?: string | null; created_at?: string; active?: boolean; auth_mode?: string | null; cert_blob_b64?: string | null; cert_password?: string | null; cert_valid_until?: string | null; contador_nome?: string | null; contador_cpf?: string | null }
      }
      company_memberships: {
        Row: { company_id: string; user_id: string; member_role: string; created_at: string }
        Insert: { company_id: string; user_id: string; member_role: string; created_at?: string }
        Update: { company_id?: string; user_id?: string; member_role?: string; created_at?: string }
      }
      fiscal_documents: {
        Row: { id: string; company_id: string; type: string; chave: string | null; periodo: string; status: string; document_date: string | null; file_path: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; type: string; chave?: string | null; periodo: string; status?: string; document_date?: string | null; file_path?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; company_id?: string; type?: string; chave?: string | null; periodo?: string; status?: string; document_date?: string | null; file_path?: string | null; created_at?: string; updated_at?: string }
      }
      fiscal_pendencias: { Row: { id: string; company_id: string; tipo: string; periodo: string; status: string; created_at: string }; Insert: { id?: string; company_id: string; tipo: string; periodo: string; status: string; created_at?: string }; Update: Partial<{ id: string; company_id: string; tipo: string; periodo: string; status: string; created_at: string }> }
      dp_checklist: { Row: { id: string; company_id: string; tarefa: string; competencia: string; status: string; created_at: string }; Insert: { id?: string; company_id: string; tarefa: string; competencia: string; status?: string; created_at?: string }; Update: Partial<{ id: string; company_id: string; tarefa: string; competencia: string; status: string; created_at: string }> }
      dp_guias: { Row: { id: string; company_id: string; nome: string; tipo: string; data: string; file_path: string | null; created_at: string }; Insert: { id?: string; company_id: string; nome: string; tipo?: string; data: string; file_path?: string | null; created_at?: string }; Update: Partial<{ id: string; company_id: string; nome: string; tipo: string; data: string; file_path: string | null; created_at: string }> }
      financial_records: { Row: { id: string; company_id: string; periodo: string; valor_cents: number; status: string; pendencias_count: number; created_at: string; updated_at: string }; Insert: { id?: string; company_id: string; periodo: string; valor_cents?: number; status?: string; pendencias_count?: number; created_at?: string; updated_at?: string }; Update: Partial<{ id: string; company_id: string; periodo: string; valor_cents: number; status: string; pendencias_count: number; created_at: string; updated_at: string }> }
      sync_events: { Row: { id: string; company_id: string | null; tipo: string; payload: string | null; status: string; idempotency_key: string | null; retries: number; created_at: string }; Insert: { id?: string; company_id?: string | null; tipo: string; payload?: string | null; status: string; idempotency_key?: string | null; retries?: number; created_at?: string }; Update: Partial<{ id: string; company_id: string | null; tipo: string; payload: string | null; status: string; idempotency_key: string | null; retries: number; created_at: string }> }
      documents: { Row: { id: string; company_id: string; tipo: string; periodo: string; status: string; origem: string; document_date: string | null; arquivos: string[]; created_at: string }; Insert: { id?: string; company_id: string; tipo: string; periodo: string; status?: string; origem?: string; document_date?: string | null; arquivos?: string[]; created_at?: string }; Update: Partial<{ id: string; company_id: string; tipo: string; periodo: string; status: string; origem: string; document_date: string | null; arquivos: string[]; created_at: string }> }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
