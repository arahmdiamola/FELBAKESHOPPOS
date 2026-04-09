import { useState } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { CalendarClock, Plus, Clock, CheckCircle2, ChefHat, PackageCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';

const STATUSES = ['pending', 'confirmed', 'in_progress', 'ready', 'picked_up', 'cancelled'];
const STATUS_CONFIG = {
  pending: { label: 'Pending', badge: 'badge-orange', icon: Clock },
  confirmed: { label: 'Confirmed', badge: 'badge-blue', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', badge: 'badge-amber', icon: ChefHat },
  ready: { label: 'Ready', badge: 'badge-green', icon: PackageCheck },
  picked_up: { label: 'Picked Up', badge: 'badge-gray', icon: PackageCheck },
  cancelled: { label: 'Cancelled', badge: 'badge-red', icon: Clock },
};

const emptyForm = { customerName: '', customerPhone: '', items: '', quantity: '', totalPrice: '', deposit: '', dueDate: '', notes: '' };

export default function PreOrdersPage() {
  const { preOrders: preorders, addPreOrder, updatePreOrder, deletePreOrder } = useOrders();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = filterStatus ? preorders.filter(o => o.status === filterStatus) : preorders;

  const addPreorder = async () => {
    if (localStorage.getItem('fel_active_branch') === 'all') {
      addToast('Please select a specific branch from the sidebar to create pre-orders', 'warning');
      return;
    }
    if (!form.customerName || !form.items || !form.dueDate) {
      addToast('Please fill required fields', 'error');
      return;
    }
    try {
      await addPreOrder({
        ...form,
        id: uuidv4(),
        quantity: parseInt(form.quantity) || 1,
        totalPrice: parseFloat(form.totalPrice) || 0,
        deposit: parseFloat(form.deposit) || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setForm(emptyForm);
      addToast('Pre-order created!', 'success');
    } catch (e) {
      addToast('Failed to create pre-order. Check your branch assignment.', 'error');
    }
  };

  const updateStatus = async (id, newStatus) => {
    await updatePreOrder(id, { status: newStatus });
    addToast(`Status updated to ${STATUS_CONFIG[newStatus].label}`, 'success');
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this pre-order?')) {
      await deletePreOrder(id);
      addToast('Pre-order deleted', 'success');
    }
  };

  return (
    <>
      <Header
        title="Pre-Orders"
        subtitle={`${preorders.length} pre-orders`}
        actions={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New Pre-Order</button>}
      />
      <div className="page-content animate-fade-in">
        <div className="filter-bar mb-4">
          <button className={`btn ${!filterStatus ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFilterStatus('')}>All ({preorders.length})</button>
          {['pending', 'confirmed', 'in_progress', 'ready'].map(s => (
            <button key={s} className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}>
              {STATUS_CONFIG[s].label} ({preorders.filter(o => o.status === s).length})
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(order => {
            const sc = STATUS_CONFIG[order.status];
            const isOverdue = new Date(order.dueDate) < new Date() && !['picked_up', 'cancelled'].includes(order.status);

            return (
              <div key={order.id} className="card" style={{ borderLeft: `4px solid var(--${order.status === 'ready' ? 'success' : order.status === 'pending' ? 'warning' : 'accent'})` }}>
                <div className="card-body">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`badge ${sc.badge}`}>{sc.label}</span>
                    {isOverdue && <span className="badge badge-red">⚠ Overdue</span>}
                  </div>

                  <h3 style={{ fontWeight: 800, fontSize: 'var(--font-base)', marginBottom: 4 }}>{order.customerName}</h3>
                  <div className="text-sm text-muted mb-2">{order.customerPhone}</div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 12, fontSize: 'var(--font-sm)' }}>
                    📋 {order.items}
                    {order.notes && (
                      <div className="text-xs text-muted mt-2">💬 {order.notes}</div>
                    )}
                  </div>

                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">Total:</span>
                    <span className="font-bold">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted">Deposit:</span>
                    <span className="font-bold" style={{ color: 'var(--success)' }}>{formatCurrency(order.deposit)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-muted">Balance:</span>
                    <span className="font-bold" style={{ color: 'var(--danger)' }}>{formatCurrency(order.totalPrice - order.deposit)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-3" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    <CalendarClock size={14} />
                    Pickup: {formatDateTime(order.dueDate)}
                  </div>

                  {!['picked_up', 'cancelled'].includes(order.status) && (
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(order.id, 'confirmed')}>Confirm</button>
                      )}
                      {order.status === 'confirmed' && (
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(order.id, 'in_progress')}>Start Baking</button>
                      )}
                      {order.status === 'in_progress' && (
                        <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(order.id, 'ready')}>Mark Ready</button>
                      )}
                      {order.status === 'ready' && (
                        <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => updateStatus(order.id, 'picked_up')}>Picked Up</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(order.id, 'cancelled')}>Cancel</button>
                    </div>
                  )}
                  {['picked_up', 'cancelled'].includes(order.status) && (
                    <button className="btn btn-ghost btn-sm w-full" onClick={() => handleDelete(order.id)}>Remove</button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <CalendarClock size={48} />
              <h3>No pre-orders</h3>
              <p>Create one for custom cakes, bulk orders, or events</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Pre-Order" large
        footer={<div className="flex gap-2"><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" onClick={addPreorder}>Create Pre-Order</button></div>}>
        <div className="form-grid">
          <div className="input-group"><label>Customer Name *</label><input className="input" value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} /></div>
          <div className="input-group"><label>Phone</label><input className="input" value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} /></div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}><label>Items / Description *</label><textarea className="input" rows={3} value={form.items} onChange={e => setForm(p => ({ ...p, items: e.target.value }))} placeholder="e.g. Mocha Cake 8 inches with Happy Birthday topper" /></div>
          <div className="input-group"><label>Total Price (₱)</label><input className="input" type="number" value={form.totalPrice} onChange={e => setForm(p => ({ ...p, totalPrice: e.target.value }))} /></div>
          <div className="input-group"><label>Deposit (₱)</label><input className="input" type="number" value={form.deposit} onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))} /></div>
          <div className="input-group"><label>Pickup Date & Time *</label><input className="input" type="datetime-local" value={form.dueDate || ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
          <div className="input-group"><label>Quantity</label><input className="input" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}><label>Special Instructions</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Decoration, flavor, packaging details..." /></div>
        </div>
      </Modal>
    </>
  );
}
