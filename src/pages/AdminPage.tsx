import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getUsersForAdmin, getProfile, updateProfile } from "@/services/profilesService"
import { supabase } from "@/services/supabaseClient"
import { getCompaniesForUser, updateCompany } from "@/services/companiesService"
import type { Company, AdminUser } from "@/services/profilesService"
import { GlassCard } from "@/components/dashboard/GlassCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Users, Building2, Shield, Key, Pencil } from "lucide-react"
import { PANEL_KEYS, PANEL_LABELS } from "@/lib/panelAccess"

const SUPABASE_URL = import.meta.env.SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY ?? ""

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"user" | "super_admin">("user")
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bootstrapSecret, setBootstrapSecret] = useState("")
  const [bootstrapError, setBootstrapError] = useState("")
  const [bootstrapLoading, setBootstrapLoading] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editName, setEditName] = useState("")
  const [editDocument, setEditDocument] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState<"user" | "super_admin">("user")
  const [editPanelAccess, setEditPanelAccess] = useState<Record<string, boolean>>({})
  const [editUserSaving, setEditUserSaving] = useState(false)
  const [editUserError, setEditUserError] = useState("")

  const defaultPanelAccess: Record<string, boolean> = {
    dashboard: true,
    fiscal: true,
    dp: true,
    financeiro: true,
    operacoes: true,
    documentos: true,
    empresas: true,
    sync: true,
  }

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    },
  })
  const userId = session?.user?.id
  const { data: myProfile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  })

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      try {
        return await getUsersForAdmin()
      } catch {
        const list = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
        if (list.error) throw list.error
        return (list.data ?? []).map((p) => ({ ...p, email: null as string | null })) as AdminUser[]
      }
    },
  })
  const adminUsers = profiles as AdminUser[]

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => getCompaniesForUser("all"),
  })

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    setSubmitting(true)
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      const session = refreshData?.session ?? (await supabase.auth.getSession()).data.session
      if (!session?.access_token) throw new Error("Não autenticado. Faça login novamente.")
      const url = `${SUPABASE_URL}/functions/v1/create-user`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          "X-User-Token": session.access_token,
        },
        body: JSON.stringify({ email: email.trim(), password, username: username.trim(), role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          json?.detail ||
          json?.error ||
          (res.status === 401 ? "Sessão expirada ou inválida. Faça login novamente." : null) ||
          (res.status === 404 ? "Função create-user não encontrada. Execute: npx supabase functions deploy create-user" : null) ||
          "Falha ao criar usuário"
        throw new Error(msg)
      }
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] })
      setModalOpen(false)
      setUsername("")
      setEmail("")
      setPassword("")
      setRole("user")
    } catch (err: unknown) {
      if (err instanceof Error) setSubmitError(err.message)
      else if (typeof err === "object" && err !== null && "message" in err) setSubmitError(String((err as { message: string }).message))
      else setSubmitError("Erro ao criar usuário. Verifique a conexão e se a Edge Function create-user está publicada (npx supabase functions deploy create-user).")
    } finally {
      setSubmitting(false)
    }
  }

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBootstrapError("")
    setBootstrapLoading(true)
    try {
      if (!session?.access_token) throw new Error("Não autenticado")
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bootstrap_secret: bootstrapSecret }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.detail || "Falha ao definir admin")
      queryClient.invalidateQueries({ queryKey: ["profile", userId] })
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] })
      setBootstrapSecret("")
    } catch (err: unknown) {
      setBootstrapError(err instanceof Error ? err.message : "Erro")
    } finally {
      setBootstrapLoading(false)
    }
  }

  const handleSetRole = async (profileId: string, newRole: "super_admin" | "user") => {
    try {
      await updateProfile(profileId, { role: newRole })
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] })
    } catch {
      // toast or inline error
    }
  }

  const openEditCompany = (emp: (typeof companies)[0]) => {
    setEditingCompany(emp)
    setEditName(emp.name)
    setEditDocument(emp.document ?? "")
    setEditActive((emp as { active?: boolean }).active !== false)
    setEditError("")
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCompany) return
    setEditError("")
    setEditSaving(true)
    try {
      await updateCompany(editingCompany.id, {
        name: editName.trim(),
        document: editDocument.trim() || null,
        active: editActive,
      })
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
      setEditingCompany(null)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setEditSaving(false)
    }
  }

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user)
    setEditUsername(user.username)
    setEditEmail(user.email ?? "")
    setEditPassword("")
    setEditRole((user.role === "super_admin" ? "super_admin" : "user") as "user" | "super_admin")
    const current = (user.panel_access as Record<string, boolean>) || {}
    setEditPanelAccess({ ...defaultPanelAccess, ...current })
    setEditUserError("")
  }

  const handleSaveUserAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditUserError("")
    setEditUserSaving(true)
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      const session = refreshData?.session ?? (await supabase.auth.getSession()).data.session
      if (!session?.access_token) throw new Error("Não autenticado. Faça login novamente.")
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          "X-User-Token": session.access_token,
        },
        body: JSON.stringify({
          user_id: editingUser.id,
          username: editUsername.trim(),
          email: editEmail.trim() || undefined,
          password: editPassword ? editPassword : undefined,
          role: editRole,
          panel_access: editPanelAccess,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.detail || json?.error || "Falha ao atualizar usuário")
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] })
      queryClient.invalidateQueries({ queryKey: ["profile", editingUser.id] })
      setEditingUser(null)
    } catch (err: unknown) {
      setEditUserError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setEditUserSaving(false)
    }
  }

  const isSuperAdmin = myProfile?.role === "super_admin"

  return (
    <div className="space-y-6">
      {userId && myProfile && !isSuperAdmin && (
        <GlassCard className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <h3 className="text-sm font-semibold font-display mb-2">Definir primeiro administrador</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Você está logado mas ainda não há um administrador. Insira o segredo de bootstrap (configurado na Edge Function <code className="bg-muted px-1 rounded">auth</code>) para se tornar admin.
          </p>
          <form onSubmit={handleBootstrapAdmin} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="bootstrap-secret" className="sr-only">Segredo</Label>
              <Input
                id="bootstrap-secret"
                type="password"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="Segredo de bootstrap"
                disabled={bootstrapLoading}
              />
            </div>
            <Button type="submit" disabled={bootstrapLoading || !bootstrapSecret.trim()}>
              {bootstrapLoading ? "Enviando..." : "Definir como administrador"}
            </Button>
          </form>
          {bootstrapError && <p className="text-sm text-destructive mt-2">{bootstrapError}</p>}
        </GlassCard>
      )}

      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerenciamento de usuários, empresas e permissões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-2xl font-bold font-display">{profilesLoading ? "—" : adminUsers.length}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-accent/20 p-3"><Building2 className="h-5 w-5 text-accent" /></div>
          <div>
            <p className="text-2xl font-bold font-display">{companies.length}</p>
            <p className="text-xs text-muted-foreground">Empresas</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-success/15 p-3"><Shield className="h-5 w-5 text-success" /></div>
          <div>
            <p className="text-2xl font-bold font-display">{adminUsers.length}</p>
            <p className="text-xs text-muted-foreground">Perfis</p>
          </div>
        </GlassCard>
        <GlassCard className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-info/15 p-3"><Key className="h-5 w-5 text-info" /></div>
          <div>
            <p className="text-2xl font-bold font-display">—</p>
            <p className="text-xs text-muted-foreground">Integrações</p>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display">Usuários</h3>
            <Button size="sm" onClick={() => setModalOpen(true)}>Cadastrar novo usuário</Button>
          </div>
          <div className="divide-y divide-border">
            {profilesLoading
              ? <div className="px-4 py-6 text-center text-muted-foreground text-sm">Carregando...</div>
              : adminUsers.length === 0
                ? <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhum usuário.</div>
                : adminUsers.map((user) => (
                    <div key={user.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                          {(user.username || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{user.username}</p>
                          <p className="text-[10px] text-muted-foreground">{user.email ?? user.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-7 gap-1"
                            onClick={() => openEditUser(user)}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                        )}
                        {isSuperAdmin && user.id !== userId && (
                          user.role === "super_admin" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7"
                              onClick={() => handleSetRole(user.id, "user")}
                            >
                              Remover admin
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7"
                              onClick={() => handleSetRole(user.id, "super_admin")}
                            >
                              Tornar admin
                            </Button>
                          )
                        )}
                        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${user.role === "super_admin" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-primary/10 text-primary"}`}>
                          {user.role}
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
            {companies.length === 0
              ? <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma empresa.</div>
              : companies.map((emp) => (
                  <div key={emp.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-xs font-medium">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(emp as { document?: string | null }).document ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium ${(emp as { active?: boolean }).active !== false ? "text-success" : "text-muted-foreground"}`}>
                        {(emp as { active?: boolean }).active !== false ? "Ativa" : "Inativa"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditCompany(emp)}
                        aria-label="Editar empresa"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
          </div>
        </GlassCard>
      </div>

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
                { perfil: "super_admin", perms: [true, true, true, true, true, true] },
                { perfil: "user", perms: [true, true, true, true, true, false] },
              ].map((row) => (
                <tr key={row.perfil} className="border-b border-border">
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

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required disabled={editSaving} />
            </div>
            <div className="space-y-2">
              <Label>Documento (CNPJ)</Label>
              <Input value={editDocument} onChange={(e) => setEditDocument(e.target.value)} disabled={editSaving} placeholder="00.000.000/0001-00" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-active" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} disabled={editSaving} className="rounded border-input" />
              <Label htmlFor="edit-active">Ativa</Label>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCompany(null)} disabled={editSaving}>Cancelar</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário — {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUserAccess} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Usuário (nome)</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="username"
                required
                disabled={editUserSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={editUserSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova senha</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Deixar em branco para não alterar"
                disabled={editUserSaving}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "user" | "super_admin")} disabled={editUserSaving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {editRole === "super_admin"
                ? "Administradores têm acesso a todos os painéis."
                : "Ative ou desative os painéis que este usuário pode acessar:"}
            </p>
            {editRole === "user" && (
              <div className="space-y-3">
                {PANEL_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <Label htmlFor={`panel-${key}`} className="text-sm font-medium">
                      {PANEL_LABELS[key]}
                    </Label>
                    <Switch
                      id={`panel-${key}`}
                      checked={editPanelAccess[key] !== false}
                      onCheckedChange={(checked) => setEditPanelAccess((prev) => ({ ...prev, [key]: checked }))}
                      disabled={editUserSaving}
                    />
                  </div>
                ))}
              </div>
            )}
            {editUserError && <p className="text-sm text-destructive">{editUserError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)} disabled={editUserSaving}>
                Fechar
              </Button>
              <Button type="submit" disabled={editUserSaving}>
                {editUserSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Usuário</Label>
              <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Senha</Label>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={submitting} minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "user" | "super_admin")} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
