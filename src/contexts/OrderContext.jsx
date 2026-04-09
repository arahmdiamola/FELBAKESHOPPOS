import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [preOrders, setPreOrders] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [tx, po] = await Promise.all([
        api.get('/transactions?limit=100'),
        api.get('/preorders')
      ]);
      setTransactions(tx || []);
      setPreOrders(po || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTransaction = useCallback(async (transaction) => {
    await api.post('/transactions', transaction);
    await fetchData();
  }, [fetchData]);

  const addPreOrder = useCallback(async (preOrder) => {
    await api.post('/preorders', preOrder);
    await fetchData();
  }, [fetchData]);

  const updatePreOrder = useCallback(async (id, updates) => {
    await api.put(`/preorders/${id}`, updates);
    await fetchData();
  }, [fetchData]);

  const deletePreOrder = useCallback(async (id) => {
    await api.del(`/preorders/${id}`);
    await fetchData();
  }, [fetchData]);

  const completePreOrder = useCallback(async (id) => {
    await updatePreOrder(id, { status: 'picked_up' });
  }, [updatePreOrder]);

  const getTodayStats = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= today && d < tomorrow;
    });

    return {
      revenue: todayTxns.reduce((sum, t) => sum + t.total, 0),
      count: todayTxns.length,
      items: todayTxns.reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + i.quantity, 0), 0),
    };
  }, [transactions]);

  return (
    <OrderContext.Provider value={{
      transactions, preOrders,
      addTransaction, addPreOrder, updatePreOrder, deletePreOrder, completePreOrder, getTodayStats
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrders = () => useContext(OrderContext);
