import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { useProducts } from './ProductContext';
import { useAuth } from './AuthContext';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [preOrders, setPreOrders] = useState([]);
  const { deductStock } = useProducts();
  const { currentUser, activeBranch } = useAuth();

  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setTransactions([]);
      setPreOrders([]);
      return;
    }
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
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData, currentUser?.id, activeBranch]);

  const addTransaction = useCallback(async (transaction) => {
    // 1. Optimistic Update: Add to state instantly
    setTransactions(prev => [transaction, ...prev]);
    
    // 2. Fire and Forget (Background Sync)
    // We still await the API call to handle potential immediate errors, 
    // but we don't block the UI refresh
    try {
      await api.post('/transactions', transaction);
    } catch (e) {
      console.error('[Sync Error] Transaction failed, reverting state', e);
      setTransactions(prev => prev.filter(t => t.id !== transaction.id));
      throw e;
    }
  }, []);

  const addPreOrder = useCallback(async (preOrder) => {
    // 1. Optimistic Update
    setPreOrders(prev => [preOrder, ...prev]);

    try {
      await api.post('/preorders', preOrder);
    } catch (e) {
      setPreOrders(prev => prev.filter(o => o.id !== preOrder.id));
      throw e;
    }
  }, []);

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
    // Robust local midnight calculation
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayTxns = transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d >= todayStart && d <= todayEnd;
    });

    const todayPreOrders = preOrders.filter(o => {
      if (o.status !== 'picked_up' || !o.dueDate) return false;
      const d = new Date(o.dueDate); 
      return d >= todayStart && d <= todayEnd;
    });

    const posRevenue = todayTxns.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const preRevenue = todayPreOrders.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0);

    console.log(`[Stats Update] Today\'s Sales: ${todayTxns.length}, POS Revenue: ${posRevenue}`);

    return {
      revenue: posRevenue + preRevenue,
      count: todayTxns.length + todayPreOrders.length,
      items: todayTxns.reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0) +
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
