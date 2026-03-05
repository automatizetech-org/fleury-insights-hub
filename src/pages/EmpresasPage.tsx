import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getCompaniesForUser, updateCompany } from "@/services/companiesService"
import type { Company } from "@/services/profilesService"
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
import { Search, Pencil, Plus, Building2 } from "lucide-react"
import { cn } from "@/utils"

type FilterStatus = "active" | "inactive" | "all"

export default function EmpresasPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterStatus>("active")
  const [search, setSearch] = useState("")
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editName, setEditName] = useState("")
  const [editDocument, setEditDocument] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-list", filter],
    queryFn: () => getCompaniesForUser(filter === "all" ? "all" : filter === "active" ? "active" : "inactive"),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.document ?? "").toLowerCase().replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    )
  }, [companies, search])

  const openEdit = (c: Company) => {
    setEditingCompany(c)
    setEditName(c.name)
    setEditDocument(c.document ?? "")
    setEditActive((c as { active?: boolean }).active !== false)
    setEditError("")
  }

  const handleSave = async (e: React.FormEvent) => {
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
      queryClient.invalidateQueries({ queryKey: ["companies-list"] })
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
      setEditingCompany(null)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">Lista de empresas que você gerencia</p>
        </div>
        <Link to="/empresas/nova">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova empresa
          </Button>
        </Link>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
              {[
                { value: "active" as const, label: "Ativas" },
                { value: "all" as const, label: "Todas" },
                { value: "inactive" as const, label: "Inativas" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    filter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {companies.length === 0
                ? "Nenhuma empresa encontrada para este filtro."
                : "Nenhum resultado para a busca."}
            </div>
          ) : (
            filtered.map((emp) => (
              <div
                key={emp.id}
                className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.document ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      (emp as { active?: boolean }).active !== false
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {(emp as { active?: boolean }).active !== false ? "Ativa" : "Inativa"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openEdit(emp)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={editSaving}
              />
            </div>
            <div className="space-y-2">
              <Label>Documento (CNPJ)</Label>
              <Input
                value={editDocument}
                onChange={(e) => setEditDocument(e.target.value)}
                disabled={editSaving}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emp-edit-active"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                disabled={editSaving}
                className="rounded border-input"
              />
              <Label htmlFor="emp-edit-active">Ativa</Label>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCompany(null)}
                disabled={editSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
