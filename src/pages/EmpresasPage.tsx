import { useState, useMemo, useRef } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Pencil, Plus, Building2, Loader2 } from "lucide-react"
import { cn } from "@/utils"
import { getPfxInfo } from "@/lib/validatePfxPassword"
import { toast } from "sonner"

type FilterStatus = "active" | "inactive" | "all"

type CompanyWithCert = Company & { auth_mode?: string | null; cert_blob_b64?: string | null; cert_password?: string | null; cert_valid_until?: string | null; contador_nome?: string | null; contador_cpf?: string | null }

const CONTADORES = [
  { nome: "ELIANDERSON GOMES FLEURY", cpf: "71361170115" },
  { nome: "EDER GOMES FLEURY", cpf: "86873598100" },
] as const

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        resolve(btoa(binary))
      } else reject(new Error("Leitura do arquivo falhou"))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export default function EmpresasPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterStatus>("active")
  const [search, setSearch] = useState("")
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editName, setEditName] = useState("")
  const [editDocument, setEditDocument] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [editUseCertificate, setEditUseCertificate] = useState(false)
  const [editCertReplacing, setEditCertReplacing] = useState(false)
  const [editCertFile, setEditCertFile] = useState<File | null>(null)
  const [editCertPassword, setEditCertPassword] = useState("")
  const editCertInputRef = useRef<HTMLInputElement>(null)
  const [editContadorCpf, setEditContadorCpf] = useState<string>("")
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
    setEditActive((c as CompanyWithCert).active !== false)
    const withCert = c as CompanyWithCert
    setEditUseCertificate(!!(withCert.cert_blob_b64 || withCert.auth_mode === "certificate"))
    setEditCertReplacing(false)
    setEditCertFile(null)
    setEditCertPassword("")
    setEditContadorCpf(withCert.contador_cpf ?? "")
    setEditError("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCompany) return
    setEditError("")
    if (editUseCertificate && (editCertFile || editCertPassword) && (!editCertFile || !editCertPassword.trim())) {
      setEditError("Selecione o arquivo .pfx e informe a senha do certificado.")
      return
    }
    setEditSaving(true)
    try {
      const updates: Parameters<typeof updateCompany>[1] = {
        name: editName.trim(),
        document: editDocument.trim() || null,
        active: editActive,
      }
      if (!editUseCertificate) {
        updates.auth_mode = null
        updates.cert_blob_b64 = null
        updates.cert_password = null
        updates.cert_valid_until = null
      } else if (editCertFile && editCertPassword.trim()) {
        updates.auth_mode = "certificate"
        const b64 = await fileToBase64(editCertFile)
        const pwd = editCertPassword.trim()
        const info = getPfxInfo(b64, pwd)
        if (!info.valid) {
          setEditError("Senha do certificado incorreta. Não foi possível salvar.")
          toast.error("Senha do certificado incorreta.")
          return
        }
        updates.cert_blob_b64 = b64
        updates.cert_password = pwd
        updates.cert_valid_until = info.validUntil ?? null
      } else if (editUseCertificate && (editingCompany as CompanyWithCert).cert_blob_b64) {
        updates.auth_mode = "certificate"
        // mantém certificado existente (não envia cert_blob_b64/cert_password)
      }
      const contador = CONTADORES.find((x) => x.cpf === editContadorCpf)
      updates.contador_nome = contador ? contador.nome : null
      updates.contador_cpf = editContadorCpf || null
      await updateCompany(editingCompany.id, updates)
      queryClient.invalidateQueries({ queryKey: ["companies-list"] })
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
      setEditingCompany(null)
      toast.success("Empresa salva com sucesso. Certificado enviado ao Supabase.")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar"
      setEditError(msg)
      toast.error(msg)
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
                    {(emp as CompanyWithCert).contador_nome && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Contador: {(emp as CompanyWithCert).contador_nome}
                      </p>
                    )}
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

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && !editSaving && setEditingCompany(null)}>
        <DialogContent aria-describedby={undefined}>
          {editSaving && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Salvando empresa e enviando certificado ao Supabase...</p>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 min-w-0 overflow-hidden">
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
            <div className="space-y-2">
              <Label>Contador responsável</Label>
              <Select
                value={editContadorCpf || "none"}
                onValueChange={(v) => setEditContadorCpf(v === "none" ? "" : v)}
                disabled={editSaving}
              >
                <SelectTrigger className="min-h-10 [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:text-left py-2">
                  <SelectValue placeholder="Selecione o contador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {CONTADORES.map((c) => (
                    <SelectItem key={c.cpf} value={c.cpf}>
                      {c.nome} — CPF {c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emp-edit-cert"
                  checked={editUseCertificate}
                  onChange={(e) => {
                    setEditUseCertificate(e.target.checked)
                    if (!e.target.checked) setEditCertReplacing(false)
                  }}
                  disabled={editSaving}
                  className="rounded border-input"
                />
                <Label htmlFor="emp-edit-cert" className="font-normal cursor-pointer">Certificado digital (uso geral)</Label>
              </div>
              {editUseCertificate && (
                <div className="pl-4 border-l-2 border-border space-y-2">
                  {(!!(editingCompany as CompanyWithCert)?.cert_blob_b64 || (editingCompany as CompanyWithCert)?.auth_mode === "certificate") && !editCertReplacing ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">Certificado cadastrado</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setEditCertReplacing(true); setEditCertFile(null); setEditCertPassword(""); editCertInputRef.current?.click(); }} disabled={editSaving}>
                          Substituir
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditUseCertificate(false)} disabled={editSaving}>
                          Remover
                        </Button>
                      </div>
                      {(editingCompany as CompanyWithCert)?.cert_valid_until && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Certificado ativo — Válido até {(() => {
                            const [y, m, d] = (editingCompany as CompanyWithCert).cert_valid_until!.split("-")
                            return `${d}/${m}/${y}`
                          })()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={editCertInputRef}
                        type="file"
                        accept=".pfx"
                        onChange={(e) => setEditCertFile(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                      <div className="space-y-1">
                        <Label>Arquivo .pfx</Label>
                        <div className="flex gap-2 items-center min-w-0 overflow-hidden">
                          <Button type="button" variant="outline" size="sm" onClick={() => editCertInputRef.current?.click()} disabled={editSaving} className="w-full min-w-0 overflow-hidden justify-start text-left">
                            <span className="truncate block w-full" title={editCertFile?.name ?? undefined}>
                              {editCertFile ? editCertFile.name : "Selecionar"}
                            </span>
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Senha do certificado</Label>
                        <Input
                          type="password"
                          value={editCertPassword}
                          onChange={(e) => setEditCertPassword(e.target.value)}
                          placeholder="Senha do .pfx"
                          disabled={editSaving}
                          autoComplete="off"
                        />
                      </div>
                      {(!!(editingCompany as CompanyWithCert)?.cert_blob_b64 || (editingCompany as CompanyWithCert)?.auth_mode === "certificate") && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditCertReplacing(false); setEditCertFile(null); setEditCertPassword(""); }} disabled={editSaving}>
                          Manter certificado atual
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
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
