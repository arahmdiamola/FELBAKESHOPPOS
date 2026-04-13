import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ToastContainer from './components/shared/ToastContainer';
import LoginScreen from './components/users/LoginScreen';

// Lazy load heavy components
const Sidebar = lazy(() => import('./components/layout/Sidebar'));
const POSTerminal = lazy(() => import('./components/pos/POSTerminal'));
const DashboardPage = lazy(() => import('./components/reports/DashboardPage'));
const ProductsPage = lazy(() => import('./components/products/ProductsPage'));
const InventoryPage = lazy(() => import('./components/inventory/InventoryPage'));
const PreOrdersPage = lazy(() => import('./components/preorders/PreOrdersPage'));
const CustomersPage = lazy(() => import('./components/customers/CustomersPage'));
const ExpensesPage = lazy(() => import('./components/expenses/ExpensesPage'));
const UsersPage = lazy(() => import('./components/users/UsersPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const ReportsPage = lazy(() => import('./components/reports/ReportsPage'));
const CommandCenter = lazy(() => import('./components/reports/CommandCenter'));
const BakingPage = lazy(() => import('./components/baking/BakingPage'));
const RawMaterialsPage = lazy(() => import('./components/inventory/RawMaterialsPage'));

const PageLoader = () => (
  <div style={{ 
    display: 'flex', justifyContent: 'center', alignItems: 'center', 
    height: '100vh', background: 'var(--bg-main)', color: 'var(--accent-gold)' 
  }}>
    <div className="shimmer" style={{ width: 150, height: 2, borderRadius: 1 }}></div>
  </div>
);

function AppRoutes() {
  const { currentUser } = useAuth();
  const location = useLocation();

  // --- PUBLIC OVERRIDE (FOR DEMO) ---
  if (location.pathname === '/demo') {
    return (
      <>
        <Routes>
          <Route path="/demo" element={<CommandCenter isPublic={true} />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  // --- STANDALONE FULLSCREEN DASHBOARD (NO SIDEBAR) ---
  if (location.pathname === '/command-center') {
    return (
      <>
        <Routes>
          <Route path="/command-center" element={<CommandCenter isPublic={false} />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  // --- STANDARD POS LAYOUT WITH SIDEBAR ---
  return (
    <Suspense fallback={<PageLoader />}>
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
            <Route path="/baking" element={<BakingPage />} />
            <Route path="/raw-materials" element={<RawMaterialsPage />} />
            <Route path="*" element={<Navigate to={currentUser.role === 'baker' ? '/baking' : '/pos'} replace />} />
          </Routes>
        </div>
        <ToastContainer />
      </div>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
