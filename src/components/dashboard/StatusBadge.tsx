import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "novo" | "validado" | "divergente" | "pendente" | "erro" | "sucesso" | "processando";
  className?: string;
}

const statusConfig = {
  novo: { label: "Novo", className: "bg-info/15 text-info border-info/30" },
  validado: { label: "Validado", className: "bg-success/15 text-success border-success/30" },
  divergente: { label: "Divergente", className: "bg-warning/15 text-warning border-warning/30" },
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/30" },
  sucesso: { label: "Sucesso", className: "bg-success/15 text-success border-success/30" },
  processando: { label: "Processando", className: "bg-info/15 text-info border-info/30" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      config.className,
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "processando" && "animate-pulse",
        status === "novo" && "bg-info",
        status === "validado" && "bg-success",
        status === "divergente" && "bg-warning",
        status === "pendente" && "bg-muted-foreground",
        status === "erro" && "bg-destructive",
        status === "sucesso" && "bg-success",
        status === "processando" && "bg-info",
      )} />
      {config.label}
    </span>
  );
}
