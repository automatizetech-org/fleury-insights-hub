import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import FiscalPage from "./pages/FiscalPage";
import FiscalDetailPage from "./pages/FiscalDetailPage";
import DPPage from "./pages/DPPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import OperacoesPage from "./pages/OperacoesPage";
import DocumentosPage from "./pages/DocumentosPage";
import SyncPage from "./pages/SyncPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes with layout */}
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/fiscal" element={<AppLayout><FiscalPage /></AppLayout>} />
          <Route path="/fiscal/:type" element={<AppLayout><FiscalDetailPage /></AppLayout>} />
          <Route path="/dp" element={<AppLayout><DPPage /></AppLayout>} />
          <Route path="/financeiro" element={<AppLayout><FinanceiroPage /></AppLayout>} />
          <Route path="/operacoes" element={<AppLayout><OperacoesPage /></AppLayout>} />
          <Route path="/documentos" element={<AppLayout><DocumentosPage /></AppLayout>} />
          <Route path="/sync" element={<AppLayout><SyncPage /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
