import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceEditorPage } from './pages/InvoiceEditorPage';
import { ClientsPage } from './pages/ClientsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuthStore } from './store/auth';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route
      path="/"
      element={
        <RequireAuth>
          <Layout />
        </RequireAuth>
      }
    >
      <Route index element={<Navigate to="/invoices" replace />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="invoices/new" element={<InvoiceEditorPage />} />
      <Route path="invoices/:id" element={<InvoiceEditorPage />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/invoices" />} />
  </Routes>
);

export default App;
