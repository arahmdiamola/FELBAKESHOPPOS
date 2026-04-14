import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ToastContainer from './components/shared/ToastContainer';
import LoginScreen from './components/users/LoginScreen';

// Helper to handle ChunkLoadErrors during deployments
const lazyWithRetry = (componentImport) => 
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      // If the module fails to load (due to hash mismatch on redeploy), force a reload
      console.error('Module load failed. Refreshing for latest version...', error);
      window.location.reload();
      return { default: () => null };
    }
  });

// Lazy load heavy components with retry harness
const Sidebar = lazyWithRetry(() => import('./components/layout/Sidebar'));
const POSTerminal = lazyWithRetry(() => import('./components/pos/POSTerminal'));
const DashboardPage = lazyWithRetry(() => import('./components/reports/DashboardPage'));
const ProductsPage = lazyWithRetry(() => import('./components/products/ProductsPage'));
const InventoryPage = lazyWithRetry(() => import('./components/inventory/InventoryPage'));
const PreOrdersPage = lazyWithRetry(() => import('./components/preorders/PreOrdersPage'));
const CustomersPage = lazyWithRetry(() => import('./components/customers/CustomersPage'));
const ExpensesPage = lazyWithRetry(() => import('./components/expenses/ExpensesPage'));
const UsersPage = lazyWithRetry(() => import('./components/users/UsersPage'));
const SettingsPage = lazyWithRetry(() => import('./components/settings/SettingsPage'));
const ReportsPage = lazyWithRetry(() => import('./components/reports/ReportsPage'));
const CommandCenter = lazyWithRetry(() => import('./components/reports/CommandCenter'));
const BakingPage = lazyWithRetry(() => import('./components/baking/BakingPage'));
const RawMaterialsPage = lazyWithRetry(() => import('./components/inventory/RawMaterialsPage'));

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
