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
      if (order && order.status !== 'picked_up') {
        // 1. Deduct Stock
        if (Array.isArray(order.items)) {
          await deductStock(order.items.map(i => ({ 
            productId: i.productId, 
            quantity: i.quantity || 1 
          })));
        }

        // 2. Create permanent transaction record
        const transaction = {
          id: `TX-${uuidv4()}`,
          receiptNumber: `PRE-${order.id.slice(0, 8).toUpperCase()}`,
          date: new Date().toISOString(),
          customerName: order.customerName,
          customerId: order.customerId || null,
          items: Array.isArray(order.items) ? order.items : [],
          total: order.totalPrice,
          subtotal: order.totalPrice, // Simplified for pre-orders
          discount: 0,
          tax: 0,
          paymentMethod: 'prepaid/balance',
          cashierName: 'System (Pre-order)',
          isPreorder: true,
          status: 'completed'
        };

        await api.post('/transactions', transaction);
        setTransactions(prev => [transaction, ...prev]);
        
        await api.put(`/preorders/${id}`, updates);
        await fetchData();
        return transaction; // RETURN FOR UI
      }
    }

    await api.put(`/preorders/${id}`, updates);
    await fetchData();
    return null;
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

    const revenue = todayTxns.reduce((sum, t) => sum + Number(t.total || 0), 0);

    return {
      revenue,
      count: todayTxns.length,
      items: todayTxns.reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0),
    };
  }, [transactions, preOrders]);

  const allSales = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions]);

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
