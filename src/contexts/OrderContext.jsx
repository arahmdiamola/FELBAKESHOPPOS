import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
import { useProducts } from './ProductContext';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, orderCount: 0, hourlyPulse: [] });
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
      // 1. Transactions
      api.get('/transactions?limit=200&summary=true')
        .then(data => setTransactions(data || []))
        .catch(e => console.error('Transactions fetch failed', e));

      // 2. Pre-orders
      api.get('/preorders')
        .then(data => setPreOrders(data || []))
        .catch(e => console.error('Preorders fetch failed', e));

      // 3. Analytics Summary
      api.get('/analytics/today-summary')
        .then(data => setStats(data || { revenue: 0, orderCount: 0, hourlyPulse: [] }))
        .catch(e => console.error('Analytics fetch failed', e));
    } catch (e) {
      console.error('[OrderContext] General fetch failure', e);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();

    // --- REAL-TIME BACKGROUND POLLING (10 SECONDS) ---
    // Only active for high-level roles who need the Live Dashboard
    const isOwnerOrAdmin = ['system_admin', 'owner'].includes(currentUser?.role);
    let interval;

    if (currentUser && isOwnerOrAdmin) {
      console.log('[OrderContext] Starting 30s background polling...');
      interval = setInterval(() => {
        fetchData();
      }, 30000); // Relaxed for stable performance
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchData, currentUser?.id, activeBranch, currentUser?.role]);

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
      const order = (preOrders || []).find(o => o.id === id);
      if (order && order.status !== 'picked_up') {
        try {
          // 1. Deduct Stock
          if (Array.isArray(order.items) && order.items.length > 0) {
            await deductStock(order.items.map(i => ({ 
              productId: i.productId, 
              quantity: i.quantity || 1 
            }))).catch(err => console.error('Stock deduction failed but proceeding', err));
          }

          // 2. Create permanent transaction record
          const transaction = {
            id: uuidv4(),
            branchId: order.branchId, // Source of truth: the order's originating branch
            receiptNumber: `PRE-${(order.id || '').slice(0, 8).toUpperCase()}`,
            date: new Date().toISOString(),
            customerName: order.customerName || 'Walk-in Customer',
            customerId: order.customerId || null,
            items: (Array.isArray(order.items) ? order.items : []).map(i => ({
              ...i,
              id: uuidv4(),
              productId: i.productId,
              name: i.name,
              price: Number(i.price || 0),
              quantity: Number(i.quantity || 1),
              discount: 0,
              total: Number(i.price || 0) * Number(i.quantity || 1)
            })),
            total: Number(order.totalPrice || 0),
            subtotal: Number(order.totalPrice || 0),
            discount: 0,
            tax: 0,
            amountPaid: Number(order.totalPrice || 0),
            change: 0,
            paymentMethod: 'prepaid/balance',
            cashierId: currentUser?.id || 'system',
            cashierName: currentUser?.name || 'System',
            isPreorder: true,
            status: 'completed',
            notes: order.notes || ''
          };

          // Save transaction first
          await api.post('/transactions', transaction);
          setTransactions(prev => [transaction, ...prev]);
          
          // Then update preorder status
          await api.put(`/preorders/${id}`, updates);
          await fetchData();
          return transaction;
        } catch (e) {
          console.error('[Pre-order Pickup Error]', e);
          throw e; // Pass to component for toast
        }
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
    return {
      revenue: stats.revenue || 0,
      count: stats.orderCount || 0,
      items: 0,
      hourlyPulse: stats.hourlyPulse || []
    };
  }, [stats]);

  const allSales = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions]);

  const dueTodayOrders = useMemo(() => {
    const todayStr = new Date().toDateString();
    return preOrders.filter(o => 
      !['picked_up', 'cancelled'].includes(o.status) && 
      new Date(o.dueDate).toDateString() === todayStr
    );
  }, [preOrders]);

  const dueTodayCount = dueTodayOrders.length;

  return (
    <OrderContext.Provider value={{
      transactions, preOrders, allSales, dueTodayOrders, dueTodayCount,
      addTransaction, addPreOrder, updatePreOrder, deletePreOrder, completePreOrder, getTodayStats,
      refetch: fetchData
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrders = () => useContext(OrderContext);
