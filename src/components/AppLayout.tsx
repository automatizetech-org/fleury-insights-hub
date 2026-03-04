import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex w-full min-h-[100dvh] overflow-x-hidden bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
      <AppSidebar />
      <CommandPalette />

      <main className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden relative pt-16 md:pt-0 md:ml-64">
        {/* Dark Mode Toggle + Sair — top right (WK exact) */}
        <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all hover:bg-[#2563EB]/10 dark:hover:bg-[#2563EB]/20"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-gray-600" />}
          </button>
          <button className="text-xs md:text-sm text-gray-500 hover:text-[#2563EB] dark:text-gray-400 dark:hover:text-[#2563EB] transition-colors px-2 md:px-3 py-1.5 rounded-lg hover:bg-[#2563EB]/10 touch-manipulation active:scale-95">
            Sair
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}
