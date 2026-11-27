import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { PartnerProvider } from './partners.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import { labels } from './strings.km.js';

function ProtectedLayout() {
  const { loading, user } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">{labels.loading}</div>;
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
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PartnerProvider>
    </ToastProvider>
  );
}
