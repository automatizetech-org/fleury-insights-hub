import { ReactNode } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { useProfile } from "@/hooks/useProfile";
import { pathToPanelKey } from "@/lib/panelAccess";
import { cn } from "@/utils";
import { Moon, Sun, PanelLeftClose, PanelLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/services/supabaseClient";

const SIDEBAR_OPEN_KEY = "sidebar-open";

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, profile } = useProfile();
  const panelKey = pathToPanelKey(location.pathname);
  const noAccess =
    !isSuperAdmin &&
    profile &&
    panelKey &&
    (profile.panel_access as Record<string, boolean>)?.[panelKey] === false;
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored === "dark";
    return true; // padrão: tema escuro
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (stored === "true" || stored === "false") return stored === "true";
    return true;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className={cn(
        "grid w-full min-w-0 h-dvh overflow-x-hidden bg-gray-50 dark:bg-slate-900 transition-colors duration-500",
        "grid-cols-1 md:transition-[grid-template-columns] md:duration-300 md:ease-in-out",
        sidebarOpen ? "md:grid-cols-[16rem_1fr]" : "md:grid-cols-[0_1fr]"
      )}
    >
      <div className="hidden md:block min-w-0 w-64 shrink-0 overflow-visible h-dvh">
        <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      </div>

      <main className="min-w-0 w-full flex flex-col overflow-x-hidden relative min-h-0">
        <header className="flex-shrink-0 h-14 flex items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm pl-14 sm:pl-4 md:pl-4 pr-4 md:pr-6 min-w-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 dark:text-slate-400 hover:text-[#2563EB] hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
            aria-label={sidebarOpen ? "Recolher painel lateral" : "Exibir painel lateral"}
          >
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <button
              onClick={() => setDark(!dark)}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors shrink-0 touch-manipulation"
              aria-label="Alternar tema"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center h-9 px-3 sm:px-4 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-[#2563EB] hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors shrink-0 touch-manipulation"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0">
          <CommandPalette />
          <div className="p-3 sm:p-4 md:p-6 w-full min-w-0 max-w-none animate-fade-in-up box-border">
            {noAccess ? <Navigate to="/dashboard" replace /> : children}
          </div>
        </div>
      </main>
    </div>
  );
}
