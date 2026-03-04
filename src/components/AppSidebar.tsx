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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  description?: string;
  children?: { name: string; path: string }[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, description: "Visão consolidada" },
  {
    name: "Fiscal",
    path: "/fiscal",
    icon: FileText,
    description: "NFS, NFE e NFC",
    children: [
      { name: "Visão Geral", path: "/fiscal" },
      { name: "NFS", path: "/fiscal/nfs" },
      { name: "NFE", path: "/fiscal/nfe" },
      { name: "NFC", path: "/fiscal/nfc" },
    ],
  },
  { name: "Depto. Pessoal", path: "/dp", icon: Users, description: "RH e Folha" },
  { name: "Financeiro", path: "/financeiro", icon: DollarSign, description: "Contas e Receita" },
  { name: "Operações", path: "/operacoes", icon: Activity, description: "SLA e monitoramento" },
  { name: "Documentos", path: "/documentos", icon: FileSpreadsheet, description: "Gestão documental" },
  { name: "Sincronização", path: "/sync", icon: RefreshCw, description: "Status de sync" },
  { name: "Administração", path: "/admin", icon: Settings, description: "Usuários e config" },
];

export function AppSidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/fiscal"]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleExpand = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => location.pathname === child.path) || location.pathname === item.path;

  // Close mobile drawer on route change
  useEffect(() => {
    if (window.innerWidth < 768) {
      setMobileOpen(false);
    }
  }, [location.pathname]);

  const sidebarContent = (
    <>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/5 via-transparent to-[#7C3AED]/5 dark:from-[#2563EB]/10 dark:to-[#7C3AED]/10 pointer-events-none transition-opacity duration-500" />

      {/* Logo / Header */}
      <div className="relative p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-[#2563EB]/10 via-[#2563EB]/5 to-transparent dark:from-[#2563EB]/20 dark:via-[#2563EB]/10 z-10 transition-colors duration-500">
        <div className="flex flex-col items-center gap-3">
          <div className="relative wk-sidebar-brand">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-[#2563EB] shadow-lg">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="wk-sidebar-title dark:text-white font-bold tracking-tight">
              Departamentos
            </h2>
            <div className="wk-sidebar-subtitle dark:text-slate-400">Selecione uma área para começar</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 relative z-10">
        {navItems.map((item) => (
          <div key={item.path} className="mb-3">
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpand(item.path)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all duration-300 card-3d relative",
                    isParentActive(item)
                      ? "bg-gradient-to-r from-[#2563EB] via-[#2563EB] to-[#1E40AF] text-white shadow-3d transform scale-105"
                      : "bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm text-foreground hover:bg-gradient-to-r hover:from-[#2563EB]/20 hover:via-[#2563EB]/10 hover:to-transparent dark:hover:from-[#2563EB]/30 dark:hover:via-[#2563EB]/20 hover:shadow-3d-hover border border-gray-200/50 dark:border-slate-600"
                  )}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="flex items-center gap-2">
                    <item.icon size={18} />
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-auto">
                      {expandedItems.includes(item.path) ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </div>
                  {item.description && (
                    <p className={cn(
                      "text-sm mt-1",
                      isParentActive(item) ? "text-white/80" : "text-muted-foreground"
                    )}>
                      {item.description}
                    </p>
                  )}
                </button>
                {expandedItems.includes(item.path) && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-[#2563EB]/20 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                          isActive(child.path)
                            ? "bg-[#2563EB]/10 text-[#2563EB] font-semibold"
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
                  "w-full text-left p-4 rounded-xl transition-all duration-300 card-3d relative block",
                  isActive(item.path)
                    ? "bg-gradient-to-r from-[#2563EB] via-[#2563EB] to-[#1E40AF] text-white shadow-3d transform scale-105"
                    : "bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm text-foreground hover:bg-gradient-to-r hover:from-[#2563EB]/20 hover:via-[#2563EB]/10 hover:to-transparent dark:hover:from-[#2563EB]/30 dark:hover:via-[#2563EB]/20 hover:shadow-3d-hover border border-gray-200/50 dark:border-slate-600"
                )}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="flex items-center gap-2">
                  <item.icon size={18} />
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.description && (
                  <p className={cn(
                    "text-sm mt-1",
                    isActive(item.path) ? "text-white/80" : "text-muted-foreground"
                  )}>
                    {item.description}
                  </p>
                )}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-3 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 hover:bg-[#2563EB]/10 dark:hover:bg-[#2563EB]/20 transition-all"
        aria-label="Abrir menu"
      >
        <Menu size={24} className="text-foreground" />
      </button>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-opacity duration-300",
          mobileOpen
            ? "opacity-100 bg-black/50 pointer-events-auto"
            : "opacity-0 bg-black/50 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 bg-gradient-to-b from-white via-white to-gray-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 border-r border-gray-200 dark:border-slate-700 flex-col shadow-3d relative overflow-hidden transition-colors duration-500 fixed left-0 top-0 h-screen z-40">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white via-white to-gray-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col shadow-3d overflow-hidden md:hidden transform-gpu transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 hover:bg-white/20 dark:hover:bg-slate-700/50 rounded-lg transition-colors touch-manipulation active:scale-95"
            aria-label="Fechar menu"
          >
            <X size={20} className="text-foreground" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
