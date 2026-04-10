import { useState, useMemo } from 'react';
import { useExpenses } from '../../contexts/ExpenseContext';
import { useToast } from '../../contexts/ToastContext';
import { EXPENSE_CATEGORIES } from '../../utils/seedData';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Wallet, Plus, Trash2, TrendingDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';

export default function ExpensesPage() {
  const { expenses, addExpense, deleteExpense, getTotalExpenses } = useExpenses();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const filtered = useMemo(() => {
    if (!filterCat) return expenses;
    return expenses.filter(e => e.category === filterCat);
  }, [expenses, filterCat]);

  const totalToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expenses.filter(e => new Date(e.date) >= today).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const totalWeek = getTotalExpenses(7);
  const totalMonth = getTotalExpenses(30);

  const catTotals = useMemo(() => {
    const map = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [expenses]);

  const { currentUser } = useAuth();
  const save = () => {
    const activeBranch = localStorage.getItem('fel_active_branch');
    if (activeBranch === 'all') {
      addToast('Please select a specific branch from the top-left menu to assign this expense.', 'warning');
      return;
    }
    if (!category || !description || !amount) {
      addToast('Please fill all fields', 'error');
      return;
    }
    
    addExpense({
      id: uuidv4(),
      branchId: activeBranch,
      category,
      description,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      addedBy: currentUser?.name || 'Admin',
    });
    setShowForm(false);
    setCategory('');
    setDescription('');
    setAmount('');
    addToast('Expense recorded', 'success');
  };

  const handleDelete = (id) => {
    if (confirm('Delete this expense?')) {
      deleteExpense(id);
      addToast('Expense deleted', 'success');
    }
  };

  const getCatLabel = (id) => EXPENSE_CATEGORIES.find(c => c.id === id);

  return (
    <>
      <Header title="Expenses" subtitle="Track your bakeshop operating costs"
        actions={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add Expense</button>}
      />
      <div className="page-content animate-fade-in">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon amber"><Wallet size={24} /></div>
            <div className="stat-card-content">
              <h3>Today</h3>
              <div className="stat-value">{formatCurrency(totalToday)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon blue"><TrendingDown size={24} /></div>
            <div className="stat-card-content">
              <h3>This Week</h3>
              <div className="stat-value">{formatCurrency(totalWeek)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red"><TrendingDown size={24} /></div>
            <div className="stat-card-content">
              <h3>This Month</h3>
              <div className="stat-value">{formatCurrency(totalMonth)}</div>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card mb-4">
          <div className="card-header"><h3 className="card-title">By Category</h3></div>
          <div className="card-body">
            <div className="expense-category-grid">
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`expense-cat-btn ${filterCat === cat.id ? 'active' : ''}`}
                  onClick={() => setFilterCat(filterCat === cat.id ? '' : cat.id)}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 'var(--font-xs)' }}>
                    {formatCurrency(catTotals[cat.id] || 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Added By</th><th></th></tr></thead>
            <tbody>
              {filtered.map(e => {
                const cat = getCatLabel(e.category);
                return (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td><span className="badge badge-amber">{cat?.emoji} {cat?.name}</span></td>
                    <td className="primary">{e.description}</td>
                    <td className="primary" style={{ color: 'var(--danger)' }}>{formatCurrency(e.amount)}</td>
                    <td>{e.addedBy}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(e.id)}><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><Wallet size={48} /><h3>No expenses recorded</h3></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Expense"
        footer={<button className="btn btn-primary" onClick={save}>Save Expense</button>}>
        <div className="mb-3">
          <label style={{ fontWeight: 700, fontSize: 'var(--font-sm)', display: 'block', marginBottom: 8 }}>Category *</label>
          <div className="expense-category-grid">
            {EXPENSE_CATEGORIES.map(cat => (
              <button key={cat.id} className={`expense-cat-btn ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id)}>
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="form-grid">
          <div className="input-group"><label>Description *</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Flour 25kg" /></div>
          <div className="input-group"><label>Amount (₱) *</label><input className="input" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
        </div>
      </Modal>
    </>
  );
}
