import { useState, useMemo } from 'react';
import { useCustomers } from '../../contexts/CustomerContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Search, Plus, Edit3, Trash2, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';

const emptyForm = { name: '', phone: '', email: '', address: '' };

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [customers, search]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c) => { setEditing(c.id); setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' }); setShowForm(true); };

  const save = async () => {
    const activeBranch = localStorage.getItem('fel_active_branch') || 'all';
    if (activeBranch === 'all' && !editing) {
      addToast('Please select a specific branch from the sidebar to add new customers', 'warning');
      return;
    }
    if (!form.name.trim()) { addToast('Name is required', 'error'); return; }
    
    try {
      if (editing) {
        await updateCustomer(editing, form);
        addToast('Customer updated', 'success');
      } else {
        await addCustomer({ ...form, id: uuidv4(), totalSpent: 0, visits: 0, balance: 0, createdAt: new Date().toISOString() });
        addToast('Customer added', 'success');
      }
      setShowForm(false);
    } catch (e) {
      addToast('Error saving: Verify branch assignment', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCustomer(id);
      addToast('Customer deleted', 'success');
    } catch (e) {
      addToast('Failed to delete customer', 'error');
    }
  };

  return (
    <>
      <Header title="Customers" subtitle={`${customers.length} registered customers`}
        actions={<button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Customer</button>}
      />
      <div className="page-content animate-fade-in">
        <div className="filter-bar mb-4">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search />
            <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Total Spent</th><th>Visits</th><th>Balance</th><th>Since</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="primary">{c.name}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td className="primary">{formatCurrency(c.totalSpent || 0)}</td>
                  <td><span className="badge badge-blue">{c.visits || 0}</span></td>
                  <td>{c.balance > 0 ? <span className="badge badge-red">{formatCurrency(c.balance)}</span> : <span className="badge badge-green">Paid</span>}</td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Edit3 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><Users size={48} /><h3>No customers found</h3></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Customer' : 'Add Customer'}
        footer={<div className="flex gap-2"><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Add'}</button></div>}>
        <div className="form-grid">
          <div className="input-group"><label>Name *</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="input-group"><label>Phone</label><input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div className="input-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div className="input-group"><label>Address</label><input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
        </div>
      </Modal>
    </>
  );
}
