import { useState, useMemo } from 'react';
import { useOrders } from '../../contexts/OrderContext';
import { useProducts } from '../../contexts/ProductContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { CalendarClock, Plus, Clock, CheckCircle2, ChefHat, PackageCheck, Search, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import ProcessingOverlay from '../shared/ProcessingOverlay';
import ReceiptPreview from '../pos/ReceiptPreview';

const STATUSES = ['pending', 'confirmed', 'in_progress', 'ready', 'picked_up', 'cancelled'];
const STATUS_CONFIG = {
  pending: { label: 'Pending', badge: 'badge-orange', icon: Clock },
  confirmed: { label: 'Confirmed', badge: 'badge-blue', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', badge: 'badge-amber', icon: ChefHat },
  ready: { label: 'Ready', badge: 'badge-green', icon: PackageCheck },
  picked_up: { label: 'Picked Up', badge: 'badge-gray', icon: PackageCheck },
  cancelled: { label: 'Cancelled', badge: 'badge-red', icon: Clock },
};

const emptyForm = { customerName: '', customerPhone: '', items: [], deposit: '', dueDate: '', notes: '' };

export default function PreOrdersPage() {
  const { preOrders: preorders, addPreOrder, updatePreOrder, deletePreOrder } = useOrders();
  const { products } = useProducts();
  const { settings } = useSettings();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successTransaction, setSuccessTransaction] = useState(null);

  const filtered = filterStatus ? preorders.filter(o => o.status === filterStatus) : preorders;

  const searchedProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5);
  }, [products, productSearch]);

  const totalPrice = useMemo(() => {
    return form.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  }, [form.items]);

  const addProductToOrder = (p) => {
    setForm(prev => {
      const existing = prev.items.find(i => i.productId === p.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return {
        ...prev,
        items: [...prev.items, { productId: p.id, name: p.name, price: p.price, quantity: 1, unit: p.unit, emoji: p.emoji }]
      };
    });
    setProductSearch('');
  };

  const removeProductFromOrder = (id) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(i => i.productId !== id) }));
  };

  const addPreorder = async () => {
    if (isProcessing) return;
    if (localStorage.getItem('fel_active_branch') === 'all') {
      addToast('Please select a specific branch from the sidebar to create pre-orders', 'warning');
      return;
    }
    if (!form.customerName || form.items.length === 0 || !form.dueDate) {
      addToast('Please fill required fields (Name, Items, Date)', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      await addPreOrder({
        ...form,
        id: uuidv4(),
        totalPrice: totalPrice,
        deposit: parseFloat(form.deposit) || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setForm(emptyForm);
      addToast('Pre-order created!', 'success');
    } catch (e) {
      addToast('Failed to create pre-order. Check your branch assignment.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const transaction = await updatePreOrder(id, { status: newStatus });
      if (newStatus === 'picked_up' && transaction) {
        setSuccessTransaction(transaction);
      }
      addToast(`Status updated to ${STATUS_CONFIG[newStatus].label}`, 'success');
    } catch (e) {
      addToast('Failed to update status', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this pre-order?')) {
      await deletePreOrder(id);
      addToast('Pre-order deleted', 'success');
    }
  };

  return (
    <>
      <ProcessingOverlay isProcessing={isProcessing} message="Saving Order..." />
      <Header
        title="Pre-Orders"
        subtitle={`${preorders.length} pre-orders`}
        actions={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New Pre-Order</button>}
      />
      <div className="page-content animate-fade-in">
        <div className="filter-bar mb-4 flex flex-wrap gap-2">
          <button className={`btn ${!filterStatus ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFilterStatus('')}>All ({preorders.length})</button>
          {['pending', 'confirmed', 'in_progress', 'ready'].map(s => (
            <button key={s} className={`btn ${filterStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setFilterStatus(filterStatus === s ? '' : s)}>
              {STATUS_CONFIG[s].label} ({preorders.filter(o => o.status === s).length})
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map(order => {
            const sc = STATUS_CONFIG[order.status];
            const isOverdue = new Date(order.dueDate) < new Date() && !['picked_up', 'cancelled'].includes(order.status);

            return (
              <div key={order.id} className="card" style={{ borderLeft: `5px solid var(--${order.status === 'ready' ? 'success' : order.status === 'pending' ? 'warning' : 'accent'})` }}>
                <div className="card-body">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`badge ${sc.badge}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <sc.icon size={12} /> {sc.label}
                    </span>
                    {isOverdue && <span className="badge badge-red">⚠ Overdue</span>}
                  </div>

                  <h3 style={{ fontWeight: 800, fontSize: 'var(--font-base)', marginBottom: 4 }}>{order.customerName}</h3>
                  <div className="text-sm text-muted mb-2">{order.customerPhone}</div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 12, fontSize: 'var(--font-sm)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>🛒 Order Items:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Array.isArray(order.items) ? order.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between border-b" style={{ paddingBottom: 4, borderColor: 'var(--border-light)' }}>
                          <span>{i.emoji} {i.name} x {i.quantity}</span>
                          <span className="text-muted">{formatCurrency(i.price * i.quantity)}</span>
                        </div>
                      )) : (
                        <div>📋 {order.items}</div>
                      )}
                    </div>
                    {order.notes && (
                      <div className="text-xs text-muted mt-3" style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                        💬 <strong>Notes:</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="stat-mini">
                      <div className="label">Total</div>
                      <div className="value">{formatCurrency(order.totalPrice)}</div>
                    </div>
                    <div className="stat-mini">
                      <div className="label">Paid Deposit</div>
                      <div className="value" style={{ color: 'var(--success)' }}>{formatCurrency(order.deposit)}</div>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm mb-4" style={{ background: 'var(--danger-light)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="font-bold">Remaining Balance:</span>
                    <span className="font-bold" style={{ color: 'var(--danger)' }}>{formatCurrency(Math.max(0, order.totalPrice - order.deposit))}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-4" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 8, borderRadius: 4 }}>
                    <CalendarClock size={14} />
                    <strong>Pickup:</strong> {formatDateTime(order.dueDate)}
                  </div>

                  {!['picked_up', 'cancelled'].includes(order.status) && (
                    <div className="flex gap-2">
                       {order.status === 'pending' && <button className={`btn btn-primary btn-sm ${isProcessing ? 'loading' : ''}`} style={{ flex: 1 }} disabled={isProcessing} onClick={() => updateStatus(order.id, 'confirmed')}>{isProcessing ? 'Saving...' : 'Confirm'}</button>}
                       {order.status === 'confirmed' && <button className={`btn btn-primary btn-sm ${isProcessing ? 'loading' : ''}`} style={{ flex: 1 }} disabled={isProcessing} onClick={() => updateStatus(order.id, 'in_progress')}>{isProcessing ? 'Working...' : 'Start Baking'}</button>}
                       {order.status === 'in_progress' && <button className={`btn btn-success btn-sm ${isProcessing ? 'loading' : ''}`} style={{ flex: 1 }} disabled={isProcessing} onClick={() => updateStatus(order.id, 'ready')}>{isProcessing ? 'Saving...' : 'Mark Ready'}</button>}
                       {order.status === 'ready' && <button className={`btn btn-success btn-sm ${isProcessing ? 'loading' : ''}`} style={{ flex: 1 }} disabled={isProcessing} onClick={() => updateStatus(order.id, 'picked_up')}>{isProcessing ? 'Saving...' : 'Picked Up'}</button>}
                       <button className="btn btn-ghost btn-sm" disabled={isProcessing} onClick={() => updateStatus(order.id, 'cancelled')}>Cancel</button>
                    </div>
                  )}
                  {['picked_up', 'cancelled'].includes(order.status) && (
                    <button className="btn btn-ghost btn-sm w-full" onClick={() => handleDelete(order.id)}>Remove from View</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Pre-Order" large
        footer={<div className="flex justify-between items-center w-full">
          <div className="text-lg font-bold">Total: {formatCurrency(totalPrice)}</div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={isProcessing}>Cancel</button>
            <button className={`btn btn-primary ${isProcessing ? 'loading' : ''}`} onClick={addPreorder} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Create Pre-Order'}
            </button>
          </div>
        </div>}>
        <div className="form-grid">
          <div className="input-group"><label>Customer Name *</label><input className="input" value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} placeholder="Enter name..." /></div>
          <div className="input-group"><label>Phone</label><input className="input" value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} placeholder="Contact number..." /></div>
          
          <div className="input-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
            <label>Add Products to Order *</label>
            <div className="search-bar mb-2">
              <Search size={16} />
              <input className="input" placeholder="Search by product name..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
            {searchedProducts.length > 0 && (
              <div className="dropdown-panel mb-4">
                {searchedProducts.map(p => (
                  <button key={p.id} className="dropdown-item" onClick={() => addProductToOrder(p)}>
                    <span>{p.emoji} {p.name}</span>
                    <span>{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
            
            <div className="table-container mb-4 luxury-table-shield" style={{ minHeight: 120 }}>
              <table className="table table-sm">
                <thead><tr><th>Product</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
                <tbody>
                  {form.items.map(item => (
                    <tr key={item.productId}>
                      <td>{item.emoji} {item.name}</td>
                      <td>
                        <input type="number" className="input text-center" style={{ width: 60, height: 28, padding: 0 }} 
                          value={item.quantity} min="1" 
                          onChange={(e) => setForm(prev => ({
                            ...prev,
                            items: prev.items.map(i => i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value) || 1 } : i)
                          }))}
                        />
                      </td>
                      <td className="font-bold">{formatCurrency(item.price * item.quantity)}</td>
                      <td><button className="btn btn-ghost btn-sm text-red" onClick={() => removeProductFromOrder(item.productId)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                  {form.items.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-4">No products added yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="input-group"><label>Pickup Date & Time *</label><input className="input" type="datetime-local" value={form.dueDate || ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
          <div className="input-group"><label>Initial Deposit Paid (₱)</label><input className="input" type="number" value={form.deposit} onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))} placeholder="0.00" /></div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}><label>Special Instructions / Customizations</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Decoration, flavor, packaging details..." /></div>
        </div>
      </Modal>

      {/* Fulfillment Receipt Modal */}
      {successTransaction && (
        <Modal 
          onClose={() => setSuccessTransaction(null)}
          title="Fulfillment Success"
          maxWidth="500px"
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div className="success-check-anim" style={{ marginBottom: 15 }}>
              <CheckCircle size={40} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 8 }}>Order Picked Up!</h2>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Balance Collected: <span style={{ fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(successTransaction.total)}</span>
            </div>
            
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, overflow: 'hidden', marginBottom: 20, maxHeight: 350, overflowY: 'auto', background: '#fff' }}>
              <ReceiptPreview 
                transaction={successTransaction} 
                settings={settings} 
                onClose={() => {}} 
                isEmbed 
              />
            </div>
            
            <button 
              className="btn btn-primary btn-block" 
              style={{ padding: 14, fontSize: '1.1rem', fontWeight: 800 }}
              onClick={() => setSuccessTransaction(null)}
            >
              CLOSE PRE-ORDER
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
