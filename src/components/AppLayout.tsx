import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { Bell, Search, Command, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/fiscal": "Fiscal",
  "/fiscal/nfs": "Fiscal / NFS",
  "/fiscal/nfe": "Fiscal / NFE",
  "/fiscal/nfc": "Fiscal / NFC",
  "/dp": "Departamento Pessoal",
  "/financeiro": "Financeiro",
  "/operacoes": "Operações",
  "/documentos": "Documentos",
  "/sync": "Sincronização",
  "/admin": "Administração",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const breadcrumb = breadcrumbMap[location.pathname] || "Dashboard";
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <CommandPalette />

      <div className="pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-3d border-b border-border h-14 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">{breadcrumb}</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors shadow-sm">
              <Search className="h-3.5 w-3.5" />
              <span>Buscar</span>
              <kbd className="ml-4 flex items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
            <button className="relative rounded-xl p-2 hover:bg-secondary transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <button
              onClick={() => setDark(!dark)}
              className="rounded-xl p-2 hover:bg-secondary transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
