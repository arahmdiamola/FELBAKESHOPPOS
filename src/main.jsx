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

// Register Service Worker for PWA / Offline usage
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered', reg))
      .catch(err => console.error('[SW] Registration failed', err));
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
