import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useOrders } from './contexts/OrderContext';
import { useProducts } from './contexts/ProductContext';
import { useExpenses } from './contexts/ExpenseContext';
import { useSettings } from './contexts/SettingsContext';
import ToastContainer from './components/shared/ToastContainer';
import PullToRefresh from './components/shared/PullToRefresh';
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

const FeatureGate = ({ moduleId, children }) => {
  const { currentUser } = useAuth();
  const { settings, isLoaded } = useSettings();
  
  // v1.2.65: ADMINISTRATIVE BYPASS - Ensure Owners and Admins always see Analytics/Reports
  const isGlobalAdmin = ['system_admin', 'owner'].includes(currentUser?.role);
  const isMaintenanceRoute = ['module_users', 'module_settings', 'module_analytics'].includes(moduleId);
  if (isGlobalAdmin && isMaintenanceRoute) return children;

  // Grace Period: Wait for settings
  if (!isLoaded) return <PageLoader />;

  const licenseFeatures = (() => {
    try {
      return typeof settings.license_features === 'string' 
        ? JSON.parse(settings.license_features) 
        : (settings.license_features || []);
    } catch (e) { return []; }
  })();

  if (!licenseFeatures.includes(moduleId)) {
    console.warn(`[Licensing] Access denied to gated module: ${moduleId}`);
    // If blocked, send to the neutral hub (Settings) where they can fix the license
    return <Navigate to="/settings" replace />;
  }

  return children;
};

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
  const { refetch: refetchOrders } = useOrders();
  const { refetch: refetchProducts } = useProducts();
  const { refetch: refetchExpenses } = useExpenses();
  const location = useLocation();

  const handleGlobalRefresh = async () => {
    console.log('[App] Coordinated refresh triggered...');
    await Promise.all([
      refetchOrders().catch(e => console.warn('Order refresh failed', e)),
      refetchProducts().catch(e => console.warn('Product refresh failed', e)),
      refetchExpenses().catch(e => console.warn('Expense refresh failed', e))
    ]);
  };

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
          <Route path="/command-center" element={
            <FeatureGate moduleId="module_mission_control">
              <CommandCenter isPublic={false} />
            </FeatureGate>
          } />
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
          <PullToRefresh onRefresh={handleGlobalRefresh}>
            <Routes>
              <Route path="/pos" element={
                <FeatureGate moduleId="module_pos">
                  <POSTerminal />
                </FeatureGate>
              } />
              <Route path="/dashboard" element={
                <FeatureGate moduleId="module_dashboard">
                  <DashboardPage />
                </FeatureGate>
              } />
              <Route path="/products" element={
                <FeatureGate moduleId="module_products">
                  <ProductsPage />
                </FeatureGate>
              } />
              <Route path="/inventory" element={
                <FeatureGate moduleId="module_bakery">
                  <InventoryPage />
                </FeatureGate>
              } />
              <Route path="/preorders" element={
                <FeatureGate moduleId="module_preorders">
                  <PreOrdersPage />
                </FeatureGate>
              } />
              <Route path="/customers" element={
                <FeatureGate moduleId="module_customers">
                  <CustomersPage />
                </FeatureGate>
              } />
              <Route path="/expenses" element={
                <FeatureGate moduleId="module_expenses">
                  <ExpensesPage />
                </FeatureGate>
              } />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={
                <FeatureGate moduleId="module_analytics">
                  <ReportsPage />
                </FeatureGate>
              } />
              <Route path="/baking" element={
                <FeatureGate moduleId="module_bakery">
                  <BakingPage />
                </FeatureGate>
              } />
              <Route path="/raw-materials" element={
                <FeatureGate moduleId="module_bakery">
                  <RawMaterialsPage />
                </FeatureGate>
               } />
              <Route path="*" element={<Navigate to={currentUser.role === 'baker' ? '/baking' : currentUser.role === 'system_admin' ? '/settings' : '/pos'} replace />} />
            </Routes>
          </PullToRefresh>
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
