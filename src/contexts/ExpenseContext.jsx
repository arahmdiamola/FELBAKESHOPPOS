import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const ExpenseContext = createContext();

export function ExpenseProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const { currentUser, activeBranch } = useAuth();

  const fetchExpenses = useCallback(async () => {
    if (!currentUser) {
      setExpenses([]);
      return;
    }
    try {
      const data = await api.get('/expenses');
      setExpenses(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, currentUser?.id, activeBranch]);

  const addExpense = useCallback(async (expense) => {
    await api.post('/expenses', expense);
    await fetchExpenses();
  }, [fetchExpenses]);

  const deleteExpense = useCallback(async (id) => {
    await api.del(`/expenses/${id}`);
    await fetchExpenses();
  }, [fetchExpenses]);

  const getTotalExpenses = useCallback((days = 30) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return expenses
      .filter(e => new Date(e.date) >= cutoff)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <ExpenseContext.Provider value={{ expenses, addExpense, deleteExpense, getTotalExpenses }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export const useExpenses = () => useContext(ExpenseContext);
