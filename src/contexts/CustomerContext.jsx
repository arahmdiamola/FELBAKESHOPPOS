import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const CustomerContext = createContext();

export function CustomerProvider({ children }) {
  const [customers, setCustomers] = useState([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await api.get('/customers');
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const addCustomer = useCallback(async (customer) => {
    await api.post('/customers', customer);
    await fetchCustomers();
  }, [fetchCustomers]);

  const updateCustomer = useCallback(async (id, updates) => {
    await api.put(`/customers/${id}`, updates);
    await fetchCustomers();
  }, [fetchCustomers]);

  const deleteCustomer = useCallback(async (id) => {
    await api.del(`/customers/${id}`);
    await fetchCustomers();
  }, [fetchCustomers]);

  const adjustBalance = useCallback(async (id, amount) => {
    await api.put(`/customers/${id}/balance`, { amount });
    await fetchCustomers();
  }, [fetchCustomers]);

  const recordVisit = useCallback(async (id, amount) => {
    await api.put(`/customers/${id}/visit`, { amount });
    await fetchCustomers();
  }, [fetchCustomers]);

  return (
    <CustomerContext.Provider value={{
      customers, addCustomer, updateCustomer, deleteCustomer,
      adjustBalance, recordVisit,
    }}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomers = () => useContext(CustomerContext);
