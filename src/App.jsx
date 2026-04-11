import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import LoginScreen from './components/users/LoginScreen';
import POSTerminal from './components/pos/POSTerminal';
import DashboardPage from './components/reports/DashboardPage';
import ProductsPage from './components/products/ProductsPage';
import InventoryPage from './components/inventory/InventoryPage';
import PreOrdersPage from './components/preorders/PreOrdersPage';
import CustomersPage from './components/customers/CustomersPage';
import ExpensesPage from './components/expenses/ExpensesPage';
import UsersPage from './components/users/UsersPage';
import SettingsPage from './components/settings/SettingsPage';
import ReportsPage from './components/reports/ReportsPage';
import CommandCenter from './components/reports/CommandCenter';
import ToastContainer from './components/shared/ToastContainer';

function AppRoutes() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Routes>
          <Route path="/pos" element={<POSTerminal />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/preorders" element={<PreOrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
