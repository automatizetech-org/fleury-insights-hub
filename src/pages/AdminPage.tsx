import { GlassCard } from "@/components/dashboard/GlassCard";
import { Users, Building2, Shield, Key } from "lucide-react";

const users = [
  { nome: "Carlos Fleury", email: "carlos@grupofleury.com", role: "Admin", status: "Ativo" },
  { nome: "Ana Silva", email: "ana@grupofleury.com", role: "Gestor", status: "Ativo" },
  { nome: "Pedro Santos", email: "pedro@grupofleury.com", role: "Colaborador Fiscal", status: "Ativo" },
  { nome: "Maria Oliveira", email: "maria@grupofleury.com", role: "Colaborador DP", status: "Ativo" },
  { nome: "João Costa", email: "joao@grupofleury.com", role: "Financeiro", status: "Ativo" },
  { nome: "Lucas Lima", email: "lucas@grupofleury.com", role: "Leitura", status: "Inativo" },
];

const empresas = [
  { nome: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", status: "Ativa", docs: 342 },
  { nome: "Comércio ABC", cnpj: "98.765.432/0001-10", status: "Ativa", docs: 128 },
  { nome: "Indústria XYZ", cnpj: "45.678.901/0001-23", status: "Ativa", docs: 567 },
  { nome: "Serviços Delta", cnpj: "11.223.344/0001-55", status: "Ativa", docs: 89 },
  { nome: "Logística Beta", cnpj: "99.887.766/0001-99", status: "Ativa", docs: 234 },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerenciamento de usuários, empresas e permissões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-2xl font-bold font-display">6</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-accent/20 p-3"><Building2 className="h-5 w-5 text-accent" /></div>
          <div>
            <p className="text-2xl font-bold font-display">142</p>
            <p className="text-xs text-muted-foreground">Empresas</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-success/15 p-3"><Shield className="h-5 w-5 text-success" /></div>
          <div>
            <p className="text-2xl font-bold font-display">6</p>
            <p className="text-xs text-muted-foreground">Perfis de Acesso</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-info/15 p-3"><Key className="h-5 w-5 text-info" /></div>
          <div>
            <p className="text-2xl font-bold font-display">2</p>
            <p className="text-xs text-muted-foreground">Integrações</p>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold font-display">Usuários</h3>
          </div>
          <div className="divide-y divide-border">
            {users.map((user, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full gradient-navy flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {user.nome.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{user.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{user.role}</span>
                  <span className={`text-[10px] font-medium ${user.status === "Ativo" ? "text-success" : "text-muted-foreground"}`}>
                    {user.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold font-display">Empresas</h3>
          </div>
          <div className="divide-y divide-border">
            {empresas.map((emp, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-xs font-medium">{emp.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{emp.cnpj}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{emp.docs} docs</p>
                  <p className="text-[10px] text-success">{emp.status}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Permissions Matrix */}
      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold font-display">Matriz de Permissões</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Dashboard</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Fiscal</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">DP</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Financeiro</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Operações</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Admin</th>
              </tr>
            </thead>
            <tbody>
              {[
                { perfil: "Admin", perms: [true, true, true, true, true, true] },
                { perfil: "Gestor", perms: [true, true, true, true, true, false] },
                { perfil: "Colaborador Fiscal", perms: [true, true, false, false, false, false] },
                { perfil: "Colaborador DP", perms: [true, false, true, false, false, false] },
                { perfil: "Financeiro", perms: [true, false, false, true, false, false] },
                { perfil: "Leitura", perms: [true, true, true, true, true, false] },
              ].map((row, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3 font-medium">{row.perfil}</td>
                  {row.perms.map((perm, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      {perm ? (
                        <span className="inline-block h-4 w-4 rounded-full bg-success/20 text-success text-[10px] leading-4">✓</span>
                      ) : (
                        <span className="inline-block h-4 w-4 rounded-full bg-muted text-muted-foreground text-[10px] leading-4">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
