import { useState, useMemo } from 'react';
import { useProducts } from '../../contexts/ProductContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { Search, Boxes, ArrowUpDown, AlertTriangle } from 'lucide-react';
import Header from '../layout/Header';
import Modal from '../shared/Modal';

export default function InventoryPage() {
  const { products, categories, adjustStock, getLowStockProducts } = useProducts();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('received');

  const lowStock = getLowStockProducts();

  const filtered = useMemo(() => {
    let list = products;
    if (showLowOnly) list = list.filter(p => p.reorderPoint > 0 && p.stock <= p.reorderPoint);
    if (filterCat) list = list.filter(p => p.categoryId === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.stock - b.stock);
  }, [products, filterCat, search, showLowOnly]);

  const totalValue = useMemo(() => products.reduce((sum, p) => sum + p.costPrice * p.stock, 0), [products]);

  const openAdjust = (product) => {
    setAdjustProduct(product);
    setAdjustQty('');
    setAdjustReason('received');
    setShowAdjust(true);
  };

  const handleAdjust = () => {
    const qty = parseInt(adjustQty);
    if (!qty || qty === 0) {
      addToast('Enter a valid quantity', 'error');
      return;
    }
    const finalQty = adjustReason === 'received' ? Math.abs(qty) : -Math.abs(qty);
    adjustStock(adjustProduct.id, finalQty);
    addToast(`Stock ${finalQty > 0 ? 'added' : 'deducted'}: ${Math.abs(finalQty)} ${adjustProduct.unit}`, 'success');
    setShowAdjust(false);
  };

  const getCatName = (id) => categories.find(c => c.id === id)?.name || '';

  const getStockPercent = (p) => {
    if (p.reorderPoint <= 0) return 100;
    return Math.min(100, Math.round((p.stock / (p.reorderPoint * 3)) * 100));
  };

  return (
    <>
      <Header
        title="Inventory"
        subtitle={`${products.length} products • Total Value: ${formatCurrency(totalValue)}`}
      />
      <div className="page-content animate-fade-in">
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-card-icon blue"><Boxes size={24} /></div>
            <div className="stat-card-content">
              <h3>Total Products</h3>
              <div className="stat-value">{products.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon amber"><Boxes size={24} /></div>
            <div className="stat-card-content">
              <h3>Inventory Value</h3>
              <div className="stat-value">{formatCurrency(totalValue)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon red"><AlertTriangle size={24} /></div>
            <div className="stat-card-content">
              <h3>Low Stock Items</h3>
              <div className="stat-value">{lowStock.length}</div>
              <div className="stat-change negative">Need restock</div>
            </div>
          </div>
        </div>

        <div className="filter-bar mb-4">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search />
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 180 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <button className={`btn ${showLowOnly ? 'btn-danger' : 'btn-secondary'} btn-sm`} onClick={() => setShowLowOnly(!showLowOnly)}>
            <AlertTriangle size={14} /> {showLowOnly ? 'Show All' : 'Low Stock Only'}
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Level</th>
                <th>Reorder At</th>
                <th>Value</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: '1.3rem' }}>{p.emoji}</td>
                  <td className="primary">{p.name}</td>
                  <td><span className="badge badge-amber">{getCatName(p.categoryId)}</span></td>
                  <td><span className={`badge ${p.reorderPoint > 0 && p.stock <= p.reorderPoint ? 'badge-red' : 'badge-green'}`}>{p.stock} {p.unit}</span></td>
                  <td style={{ minWidth: 100 }}>
                    <div style={{ width: '100%', height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${getStockPercent(p)}%`, height: '100%', background: getStockPercent(p) < 30 ? 'var(--danger)' : getStockPercent(p) < 60 ? 'var(--warning)' : 'var(--success)', borderRadius: 4, transition: 'width 0.3s ease' }} />
                    </div>
                  </td>
                  <td>{p.reorderPoint} {p.unit}</td>
                  <td>{formatCurrency(p.costPrice * p.stock)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openAdjust(p)}>
                      <ArrowUpDown size={14} /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAdjust} onClose={() => setShowAdjust(false)} title={`Adjust Stock — ${adjustProduct?.name}`}
        footer={<button className="btn btn-primary" onClick={handleAdjust}>Confirm Adjustment</button>}>
        {adjustProduct && (
          <div className="form-grid">
            <div className="input-group">
              <label>Current Stock</label>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--accent)' }}>
                {adjustProduct.stock} {adjustProduct.unit}
              </div>
            </div>
            <div className="input-group">
              <label>Reason</label>
              <select className="select" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                <option value="received">Received Delivery</option>
                <option value="produced">Produced / Baked</option>
                <option value="damaged">Damaged / Expired</option>
                <option value="correction">Stock Correction</option>
              </select>
            </div>
            <div className="input-group">
              <label>Quantity to {adjustReason === 'received' || adjustReason === 'produced' ? 'Add' : 'Remove'}</label>
              <input className="input" type="number" min="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="Enter quantity..." autoFocus />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
