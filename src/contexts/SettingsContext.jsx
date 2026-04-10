import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

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

  const resetData = async () => {
    if (confirm('Are you sure you want to completely clear the entire database?')) {
        // Aggressive reset: Both Cloud and Local Device
        await api.post('/reset', {});
        await idb.clearAllData();
        
        // Clear login and settings but keep basic keys if needed
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fel_')) localStorage.removeItem(key);
        });

        window.location.href = '/login';
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetData }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
