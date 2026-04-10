import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import { idb } from '../utils/idb';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  storeName: 'FEL Bakeshop',
  storeAddress: 'Brgy. San Jose, Quezon City',
  storePhone: '0917-123-4567',
  taxRate: 0,
  receiptFooter: 'Thank you for choosing FEL Bakeshop! 🧁',
  storeLogo: '',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.get('/settings');
        setSettings(prev => ({ ...prev, ...data }));
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  const updateSettings = async (updates) => {
    await api.post('/settings', updates);
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetData = async (targets) => {
    if (!targets || targets.length === 0) return;

    try {
        // 1. Wipe Cloud
        await api.post('/reset', { targets });
        
        // 2. Wipe Local Cache for selected items
        const storeMap = {
          'transactions': ['cache_transactions'],
          'products': ['cache_products', 'cache_categories'],
          'customers': ['cache_customers'],
          'expenses': [],
          'preorders': ['cache_preorders']
        };

        for (const t of targets) {
          const stores = storeMap[t] || [];
          for (const s of stores) {
            await idb.clear(s);
          }
        }
        
        // Success - clear local storage keys that might hold stale cached counts
        // but DO NOT clear fel_currentUser to stay logged in
        localStorage.removeItem('fel_active_branch'); // Force re-selection/refresh
        
        window.location.reload(); // Refresh to clear context states
    } catch (err) {
        console.error("Reset Failed:", err);
        throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetData }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
