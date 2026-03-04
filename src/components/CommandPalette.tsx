import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  Settings,
  Activity,
  FileSpreadsheet,
  Search,
} from "lucide-react";

const pages = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "Navegação" },
  { name: "Fiscal", path: "/fiscal", icon: FileText, group: "Navegação" },
  { name: "Fiscal - NFS", path: "/fiscal/nfs", icon: FileText, group: "Fiscal" },
  { name: "Fiscal - NFE", path: "/fiscal/nfe", icon: FileText, group: "Fiscal" },
  { name: "Fiscal - NFC", path: "/fiscal/nfc", icon: FileText, group: "Fiscal" },
  { name: "Departamento Pessoal", path: "/dp", icon: Users, group: "Navegação" },
  { name: "Financeiro", path: "/financeiro", icon: DollarSign, group: "Navegação" },
  { name: "Operações", path: "/operacoes", icon: Activity, group: "Navegação" },
  { name: "Documentos", path: "/documentos", icon: FileSpreadsheet, group: "Navegação" },
  { name: "Sincronização", path: "/sync", icon: Activity, group: "Sistema" },
  { name: "Administração", path: "/admin", icon: Settings, group: "Sistema" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const groups = [...new Set(pages.map((p) => p.group))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, empresas, documentos..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {pages
              .filter((p) => p.group === group)
              .map((page) => (
                <CommandItem
                  key={page.path}
                  onSelect={() => {
                    navigate(page.path);
                    setOpen(false);
                  }}
                >
                  <page.icon className="mr-2 h-4 w-4" />
                  <span>{page.name}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
