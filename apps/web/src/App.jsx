import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { PartnerProvider } from './partners.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import SettlementPage from './pages/SettlementPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';

function ProtectedLayout() {
  const { loading, user } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">កំពុងផ្ទុក...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <ToastProvider>
      <PartnerProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="settlement" element={<SettlementPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PartnerProvider>
    </ToastProvider>
  );
}
