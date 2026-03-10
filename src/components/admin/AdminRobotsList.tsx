import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRobots, updateRobot } from "@/services/robotsService"
import type { Robot } from "@/services/robotsService"
import {
  getFolderStructureFlat,
  buildFolderTree,
} from "@/services/folderStructureService"
import type { FolderStructureNodeTree } from "@/types/folderStructure"
import { pathSegmentsToNode } from "@/types/folderStructure"
import type { FolderStructureNodeRow } from "@/types/folderStructure"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Bot, Pencil, Loader2, Circle, Folder, FolderOpen, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

function statusLabel(s: Robot["status"]): string {
  switch (s) {
    case "active":
      return "Ativo"
    case "inactive":
      return "Inativo"
    case "processing":
      return "Executando"
    default:
      return s
  }
}

function statusClass(s: Robot["status"]): string {
  switch (s) {
    case "active":
      return "bg-success/20 text-success"
    case "inactive":
      return "bg-muted text-muted-foreground"
    case "processing":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function DepartmentTreeItem({
  node,
  depth,
  flatNodes,
  selectedPath,
  onSelect,
}: {
  node: FolderStructureNodeTree
  depth: number
  flatNodes: FolderStructureNodeRow[]
  selectedPath: string
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const path = pathSegmentsToNode(flatNodes, node.id).join("/")
  const isSelected = path === selectedPath

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1 py-0.5 rounded group" style={{ paddingLeft: `${depth * 14}px` }}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 min-w-0 flex-1 text-left hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
          >
            {hasChildren ? (
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            {hasChildren ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={`text-xs truncate ${isSelected ? "font-semibold text-primary" : ""}`}>{node.name}</span>
          </button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(path)
          }}
        >
          Selecionar
        </Button>
      </div>
      <CollapsibleContent>
        {node.children.map((child) => (
          <DepartmentTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            flatNodes={flatNodes}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AdminRobotsList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Robot | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [segmentPath, setSegmentPath] = useState("")
  const [notesMode, setNotesMode] = useState<"recebidas" | "emitidas" | "both">("recebidas")
  const [dateExecutionMode, setDateExecutionMode] = useState<"competencia" | "interval">("interval")
  const [initialPeriodStart, setInitialPeriodStart] = useState("")
  const [initialPeriodEnd, setInitialPeriodEnd] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: robots = [], isLoading } = useQuery({
    queryKey: ["admin-robots"],
    queryFn: getRobots,
    refetchOnWindowFocus: true,
  })

  const { data: flatNodes = [] } = useQuery({
    queryKey: ["folder-structure-flat"],
    queryFn: getFolderStructureFlat,
  })
  const folderTree = flatNodes.length > 0 ? buildFolderTree(flatNodes) : []

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !displayName.trim()) return
    setSaving(true)
    try {
      await updateRobot(editing.id, {
        display_name: displayName.trim(),
        segment_path: segmentPath.trim() || null,
        notes_mode: notesMode,
        date_execution_mode: dateExecutionMode,
        initial_period_start: dateExecutionMode === "interval" && initialPeriodStart ? initialPeriodStart : null,
        initial_period_end: dateExecutionMode === "interval" && initialPeriodEnd ? initialPeriodEnd : null,
      })
      queryClient.invalidateQueries({ queryKey: ["admin-robots"] })
      setEditing(null)
      toast.success("Robô atualizado")
    } catch {
      toast.error("Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const openRename = (r: Robot) => {
    setEditing(r)
    setDisplayName(r.display_name)
    setSegmentPath(r.segment_path ?? "")
    setNotesMode((r.notes_mode === "emitidas" || r.notes_mode === "both" ? r.notes_mode : "recebidas") as "recebidas" | "emitidas" | "both")
    setDateExecutionMode((r.date_execution_mode === "competencia" ? "competencia" : "interval") as "competencia" | "interval")
    setInitialPeriodStart(r.initial_period_start ?? "")
    setInitialPeriodEnd(r.initial_period_end ?? "")
  }

  return (
    <>
      <GlassCard className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold font-display">Robôs vinculados</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nome de exibição, departamento (estrutura de pastas) e modo de execução de datas.
          </p>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : robots.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhum robô vinculado. Abra um robô configurado com .env (Supabase) para ele aparecer aqui.
            </div>
          ) : (
            robots.map((r) => (
              <div
                key={r.id}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.display_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{r.technical_id}</p>
                    {r.segment_path && (
                      <p className="text-[10px] text-muted-foreground truncate">Departamento: {r.segment_path}</p>
                    )}
                    {r.status === "inactive" && r.last_heartbeat_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Última vez ativo: {format(new Date(r.last_heartbeat_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${statusClass(r.status)}`}>
                    <Circle className="h-1.5 w-1.5 fill-current" />
                    {statusLabel(r.status)}
                  </span>
                  {isSuperAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openRename(r)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      <Dialog open={!!editing} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar robô</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Identificador técnico: <code className="bg-muted px-1 rounded">{editing?.technical_id}</code>
            </p>
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex.: NFS Padrão - VM"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <p className="text-[10px] text-muted-foreground">
                Selecione na estrutura de pastas onde os arquivos do robô serão salvos (ex.: FISCAL / NFS).
              </p>
              <div className="rounded border border-input bg-muted/20 p-2 max-h-48 overflow-y-auto">
                {folderTree.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma pasta na estrutura. Configure em Estrutura de pastas.</p>
                ) : (
                  folderTree.map((node) => (
                    <DepartmentTreeItem
                      key={node.id}
                      node={node}
                      depth={0}
                      flatNodes={flatNodes}
                      selectedPath={segmentPath}
                      onSelect={setSegmentPath}
                    />
                  ))
                )}
              </div>
              {segmentPath && (
                <p className="text-xs text-primary font-medium">Selecionado: {segmentPath}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Modo de execução de datas</Label>
              <select
                value={dateExecutionMode}
                onChange={(e) => setDateExecutionMode(e.target.value as "competencia" | "interval")}
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="competencia">Por competência</option>
                <option value="interval">Por intervalo de datas</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                {dateExecutionMode === "competencia"
                  ? "Executa para uma competência mensal (ex.: 03/2026)."
                  : "Primeira execução usa o intervalo abaixo; depois o sistema usa apenas o dia anterior (incremental)."}
              </p>
            </div>
            {dateExecutionMode === "interval" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Data inicial (primeiro intervalo)</Label>
                  <input
                    type="date"
                    value={initialPeriodStart}
                    onChange={(e) => setInitialPeriodStart(e.target.value)}
                    disabled={saving}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Data final (primeiro intervalo)</Label>
                  <input
                    type="date"
                    value={initialPeriodEnd}
                    onChange={(e) => setInitialPeriodEnd(e.target.value)}
                    disabled={saving}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Modo de notas</Label>
              <select
                value={notesMode}
                onChange={(e) => setNotesMode(e.target.value as "recebidas" | "emitidas" | "both")}
                disabled={saving}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="recebidas">Recebidas</option>
                <option value="emitidas">Emitidas</option>
                <option value="both">Emitidas + Recebidas</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Define se o robô baixa recebidas, emitidas ou ambas ao rodar.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !displayName.trim()}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
