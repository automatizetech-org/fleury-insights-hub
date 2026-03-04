import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  Activity,
  FileSpreadsheet,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  children?: { name: string; path: string }[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    name: "Fiscal",
    path: "/fiscal",
    icon: FileText,
    children: [
      { name: "Visão Geral", path: "/fiscal" },
      { name: "NFS", path: "/fiscal/nfs" },
      { name: "NFE", path: "/fiscal/nfe" },
      { name: "NFC", path: "/fiscal/nfc" },
    ],
  },
  { name: "Depto. Pessoal", path: "/dp", icon: Users },
  { name: "Financeiro", path: "/financeiro", icon: DollarSign },
  { name: "Operações", path: "/operacoes", icon: Activity },
  { name: "Documentos", path: "/documentos", icon: FileSpreadsheet },
  { name: "Sincronização", path: "/sync", icon: RefreshCw },
  { name: "Administração", path: "/admin", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/fiscal"]);

  const toggleExpand = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname === child.path) || location.pathname === item.path;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 sidebar-gradient border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-gold">
          <Shield className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold font-display text-sidebar-primary">Grupo Fleury</h1>
          <p className="text-[10px] text-sidebar-foreground/60 tracking-wider uppercase">Contabilidade</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.path}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpand(item.path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isParentActive(item)
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.name}</span>
                  {expandedItems.includes(item.path) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                {expandedItems.includes(item.path) && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center rounded-md px-3 py-2 text-xs font-medium transition-all duration-200",
                          isActive(child.path)
                            ? "bg-sidebar-primary/10 text-sidebar-primary"
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                        )}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center text-xs font-bold text-accent-foreground">
            GF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">Admin</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">admin@grupofleury.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
