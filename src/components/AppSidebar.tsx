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
  BarChart3,
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gradient-to-b from-sidebar to-secondary/30 dark:from-sidebar dark:to-secondary/20 border-r border-sidebar-border flex flex-col">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-accent/[0.03] pointer-events-none" />

      {/* Logo */}
      <div className="relative flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-destructive to-primary shadow-md">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold font-display text-sidebar-foreground">Fleury Analytics</h1>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Departamentos</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.path}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpand(item.path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isParentActive(item)
                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                      : "card-3d bg-card/80 backdrop-blur-sm text-sidebar-foreground hover:shadow-3d-hover"
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
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-primary/20 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                          isActive(child.path)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive(item.path)
                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                    : "card-3d bg-card/80 backdrop-blur-sm text-sidebar-foreground hover:shadow-3d-hover"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Brand Footer */}
      <div className="relative border-t border-sidebar-border p-4">
        <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-border/50 p-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
              FA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">admin@fleury.com</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
