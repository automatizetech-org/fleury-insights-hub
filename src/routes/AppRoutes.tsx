import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { ProtectedAdminRoute } from "@/components/layout/ProtectedAdminRoute";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import FiscalPage from "@/pages/FiscalPage";
import FiscalDetailPage from "@/pages/FiscalDetailPage";
import DPPage from "@/pages/DPPage";
import DPTopicPage from "@/pages/DPTopicPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import OperacoesPage from "@/pages/OperacoesPage";
import DocumentosPage from "@/pages/DocumentosPage";
import SyncPage from "@/pages/SyncPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";
import EmpresasNovaPage from "@/pages/EmpresasNovaPage";
import EmpresasPage from "@/pages/EmpresasPage";
import ContabilPage from "@/pages/ContabilPage";
import ContabilDetailPage from "@/pages/ContabilDetailPage";
import AlteracaoEmpresarialPage from "@/pages/AlteracaoEmpresarialPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
      <Route path="/fiscal" element={<AppLayout><FiscalPage /></AppLayout>} />
      <Route path="/fiscal/:type" element={<AppLayout><FiscalDetailPage /></AppLayout>} />
      <Route path="/dp" element={<AppLayout><DPPage /></AppLayout>} />
      <Route path="/dp/:topic" element={<AppLayout><DPTopicPage /></AppLayout>} />
      <Route path="/contabil" element={<AppLayout><ContabilPage /></AppLayout>} />
      <Route path="/contabil/:topic" element={<AppLayout><ContabilDetailPage /></AppLayout>} />
      <Route path="/alteracao-empresarial" element={<AppLayout><AlteracaoEmpresarialPage /></AppLayout>} />
      <Route path="/alteracao-empresarial/contratos" element={<AppLayout><AlteracaoEmpresarialPage /></AppLayout>} />
      <Route path="/financeiro" element={<AppLayout><FinanceiroPage /></AppLayout>} />
      <Route path="/operacoes" element={<AppLayout><OperacoesPage /></AppLayout>} />
      <Route path="/documentos" element={<AppLayout><DocumentosPage /></AppLayout>} />
      <Route path="/sync" element={<AppLayout><SyncPage /></AppLayout>} />
      <Route path="/admin" element={<AppLayout><ProtectedAdminRoute><AdminPage /></ProtectedAdminRoute></AppLayout>} />
      <Route path="/empresas" element={<AppLayout><EmpresasPage /></AppLayout>} />
      <Route path="/empresas/nova" element={<AppLayout><EmpresasNovaPage /></AppLayout>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
