import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { useProducts } from './ProductContext';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [preOrders, setPreOrders] = useState([]);
  const { deductStock } = useProducts();

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
    // Detect if we are marking a preorder as picked_up to deduct stock
    if (updates.status === 'picked_up') {
      const order = preOrders.find(o => o.id === id);
      if (order && order.status !== 'picked_up' && Array.isArray(order.items)) {
        // Only deduct if it wasn't already picked_up
        deductStock(order.items.map(i => ({ 
          productId: i.productId, 
          quantity: i.quantity || 1 
        })));
      }
    }

    await api.put(`/preorders/${id}`, updates);
    await fetchData();
  }, [fetchData, preOrders, deductStock]);

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

    const todayPreOrders = preOrders.filter(o => {
      if (o.status !== 'picked_up') return false;
      // Note: We don't have a specific 'completedAt' field yet, 
      // but usually 'createdAt' or 'dueDate' are proxies, 
      // or we can just filter by orders picked up today.
      // For now, let's use the current date as a simple proxy for 'picked_up' orders 
      // that are relevant if they were picked up recently.
      const d = new Date(o.dueDate); 
      return d >= today && d < tomorrow;
    });

    const posRevenue = todayTxns.reduce((sum, t) => sum + t.total, 0);
    const preRevenue = todayPreOrders.reduce((sum, o) => sum + o.totalPrice, 0);

    return {
      revenue: posRevenue + preRevenue,
      count: todayTxns.length + todayPreOrders.length,
      items: todayTxns.reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + i.quantity, 0), 0) +
             todayPreOrders.reduce((sum, o) => sum + (Array.isArray(o.items) ? o.items.reduce((s, i) => s + (i.quantity || 1), 0) : 1), 0),
    };
  }, [transactions, preOrders]);

  const allSales = useMemo(() => {
    const closedPreOrders = preOrders
      .filter(o => o.status === 'picked_up')
      .map(o => ({
        id: o.id,
        date: o.dueDate, 
        receiptNumber: `PRE-${o.id.slice(0, 4)}`,
        customerName: o.customerName,
        cashierName: 'Pre-order System',
        paymentMethod: 'prepaid',
        total: o.totalPrice,
        items: Array.isArray(o.items) ? o.items : [{ name: o.items, price: o.totalPrice, quantity: 1, productId: 'custom' }],
        isPreorder: true
      }));

    return [...transactions, ...closedPreOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, preOrders]);

  return (
    <OrderContext.Provider value={{
      transactions, preOrders, allSales,
      addTransaction, addPreOrder, updatePreOrder, deletePreOrder, completePreOrder, getTodayStats
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrders = () => useContext(OrderContext);
