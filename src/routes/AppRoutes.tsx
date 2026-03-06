import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
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
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/fiscal" element={<ProtectedRoute><AppLayout><FiscalPage /></AppLayout></ProtectedRoute>} />
      <Route path="/fiscal/:type" element={<ProtectedRoute><AppLayout><FiscalDetailPage /></AppLayout></ProtectedRoute>} />
      <Route path="/dp" element={<ProtectedRoute><AppLayout><DPPage /></AppLayout></ProtectedRoute>} />
      <Route path="/dp/:topic" element={<ProtectedRoute><AppLayout><DPTopicPage /></AppLayout></ProtectedRoute>} />
      <Route path="/contabil" element={<ProtectedRoute><AppLayout><ContabilPage /></AppLayout></ProtectedRoute>} />
      <Route path="/contabil/:topic" element={<ProtectedRoute><AppLayout><ContabilDetailPage /></AppLayout></ProtectedRoute>} />
      <Route path="/alteracao-empresarial" element={<ProtectedRoute><AppLayout><AlteracaoEmpresarialPage /></AppLayout></ProtectedRoute>} />
      <Route path="/alteracao-empresarial/contratos" element={<ProtectedRoute><AppLayout><AlteracaoEmpresarialPage /></AppLayout></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute><AppLayout><FinanceiroPage /></AppLayout></ProtectedRoute>} />
      <Route path="/operacoes" element={<ProtectedRoute><AppLayout><OperacoesPage /></AppLayout></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><AppLayout><DocumentosPage /></AppLayout></ProtectedRoute>} />
      <Route path="/sync" element={<ProtectedRoute><AppLayout><SyncPage /></AppLayout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AppLayout><ProtectedAdminRoute><AdminPage /></ProtectedAdminRoute></AppLayout></ProtectedRoute>} />
      <Route path="/empresas" element={<ProtectedRoute><AppLayout><EmpresasPage /></AppLayout></ProtectedRoute>} />
      <Route path="/empresas/nova" element={<ProtectedRoute><AppLayout><EmpresasNovaPage /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
