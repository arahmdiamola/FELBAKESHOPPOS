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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
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
    </ToastProvider>
  </StrictMode>
);
