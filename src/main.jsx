import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { ProductProvider } from './contexts/ProductContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { OrderProvider } from './contexts/OrderContext';
import { ExpenseProvider } from './contexts/ExpenseContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';

import { SyncProvider } from './contexts/SyncContext';

// --- Resilience Shield for Rapid Deployments ---
window.addEventListener('error', (e) => {
  const isChunkError = e.message?.toLowerCase().includes('failed to fetch dynamically imported module') ||
                       e.target?.tagName?.toLowerCase() === 'script';
  
  if (isChunkError) {
    console.error('[Resilience Shield] Module load failure detected. Forcing clean reload...', e);
    // Use a small delay to avoid infinite reload loops
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}, true);

// --- NUCLEAR CACHE PURGE (Sync v13) ---
if ('serviceWorker' in navigator) {
  // 1. One-time clean sweep of all existing registrations
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().then(() => console.log('[SW Purge] Stale worker wiped.'));
    }
  });

  // 2. Register fresh v13 worker
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW v13] Registered', reg);
        // Force a one-time reload to ensure the browser switches to the fresh server version
        if (!localStorage.getItem('fel_v13_purged')) {
          localStorage.setItem('fel_v13_purged', 'true');
          window.location.reload();
        }
      })
      .catch(err => console.error('[SW Registration failed]', err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <SyncProvider>
        <SettingsProvider>
          <AuthProvider>
            <ProductProvider>
              <CustomerProvider>
                <OrderProvider>
                  <ExpenseProvider>
                    <App />
                  </ExpenseProvider>
                </OrderProvider>
              </CustomerProvider>
            </ProductProvider>
          </AuthProvider>
        </SettingsProvider>
      </SyncProvider>
    </ToastProvider>
  </StrictMode>
);
