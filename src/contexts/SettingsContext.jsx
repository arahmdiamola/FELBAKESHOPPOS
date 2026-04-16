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
  flashSalePercent: 10,
  vipThreshold: 5,
  license_features: '[]',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.get('/settings');
        setSettings(prev => ({ ...prev, ...data }));
        setIsLoaded(true);
      } catch (e) {
        console.error(e);
        setIsLoaded(true); // Still mark as loaded to unblock UI on error
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
        // 1. Wipe Cloud (Filter out local-only targets)
        const cloudTargets = targets.filter(t => t !== 'syncQueue');
        if (cloudTargets.length > 0) {
            await api.post('/reset', { targets: cloudTargets });
        }
        
        // 2. Wipe Local Cache for selected items
        const storeMap = {
          'transactions': ['cache_transactions'],
          'products': ['cache_products', 'cache_categories'],
          'customers': ['cache_customers'],
          'expenses': ['cache_expenses'],
          'preorders': ['cache_preorders'],
          'syncQueue': ['sync_queue']
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
    <SettingsContext.Provider value={{ settings, isLoaded, updateSettings, resetData }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
