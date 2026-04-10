import { useState, useMemo } from 'react';
import { useProducts } from '../../contexts/ProductContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { Search, Plus, Edit3, Trash2, Package } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import BatchUploadModal from './BatchUploadModal';
import ProcessingOverlay from '../shared/ProcessingOverlay';

const emptyProduct = { name: '', categoryId: '', price: '', costPrice: '', stock: '', unit: 'pc', reorderPoint: '', emoji: '🍞', image: '', isTopSelling: 0 };

export default function ProductsPage() {
  const { products, categories, addProduct, addProductsBatch, updateProduct, deleteProduct, addCategory, deleteCategory } = useProducts();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('📦');
  const [isProcessing, setIsProcessing] = useState(false);

  const filtered = useMemo(() => {
    let list = products;
    if (filterCat) list = list.filter(p => p.categoryId === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, filterCat, search]);

  const openAdd = () => { setEditing(null); setForm(emptyProduct); setShowForm(true); };
  const openEdit = (p) => { 
    setEditing(p.id); 
    setForm({ 
      ...p, 
      price: p.price != null ? String(p.price) : '', 
      costPrice: p.costPrice != null ? String(p.costPrice) : '', 
      stock: p.stock != null ? String(p.stock) : '', 
      reorderPoint: p.reorderPoint != null ? String(p.reorderPoint) : '', 
      isTopSelling: p.isTopSelling != null ? Number(p.isTopSelling) : 0,
      image: p.image || '' 
    }); 
    setShowForm(true); 
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(p => ({ ...p, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProduct = async () => {
    if (isProcessing) return;
    if (localStorage.getItem('fel_active_branch') === 'all') {
      addToast('Please select a specific branch from the sidebar to add products', 'warning');
      return;
    }
    if (!form.name || !form.categoryId || !form.price) {
      addToast('Please fill required fields', 'error');
      return;
    }
    const data = { 
      ...form, 
      price: parseFloat(form.price), 
      costPrice: parseFloat(form.costPrice) || 0, 
      stock: parseInt(form.stock) || 0, 
      reorderPoint: parseInt(form.reorderPoint) || 0,
      isTopSelling: Number(form.isTopSelling) || 0
    };
    
    setIsProcessing(true);
    try {
      if (editing) {
        await updateProduct(editing, data);
        addToast('Product updated', 'success');
      } else {
        await addProduct({ ...data, id: uuidv4() });
        addToast('Product added', 'success');
      }
      setShowForm(false);
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Delete this product?')) {
      deleteProduct(id);
      addToast('Product deleted', 'success');
    }
  };

  const saveCategory = async () => {
    if (isProcessing || !catName.trim()) return;
    setIsProcessing(true);
    try {
      await addCategory({ id: uuidv4(), name: catName, emoji: catEmoji });
      setCatName('');
      setCatEmoji('📦');
      setShowCatForm(false);
      addToast('Category added', 'success');
    } catch (e) {
      addToast('Failed to add category', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Unknown';

  return (
    <>
      <ProcessingOverlay isProcessing={isProcessing} message="Saving Product..." />
      <Header
        title="Products"
        subtitle={`${products.length} products in catalog`}
        actions={
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBatchModal(true)}>Upload CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCatForm(true)}>+ Category</button>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Product</button>
          </div>
        }
      />
      <div className="page-content animate-fade-in">
        <div className="filter-bar mb-4">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search />
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 200 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: '1.3rem', width: 40, textAlign: 'center' }}>
                    {p.image ? (
                      <img src={p.image} alt={p.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    ) : p.emoji}
                  </td>
                  <td className="primary">{p.name}</td>
                  <td><span className="badge badge-amber">{getCatName(p.categoryId)}</span></td>
                  <td className="primary">{formatCurrency(p.price)}</td>
                  <td>{formatCurrency(p.costPrice)}</td>
                  <td><span className={`badge ${p.stock <= p.reorderPoint ? 'badge-red' : 'badge-green'}`}>{p.stock}</span></td>
                  <td>{p.unit}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)}><Edit3 size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><Package size={48} /><h3>No products found</h3></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Product' : 'Add Product'} large
        footer={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={isProcessing}>Cancel</button>
            <button className={`btn btn-primary ${isProcessing ? 'loading' : ''}`} onClick={saveProduct} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : (editing ? 'Update' : 'Add Product')}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="input-group">
            <label>Product Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Pandesal" />
          </div>
          <div className="input-group">
            <label>Category *</label>
            <select className="select" value={form.categoryId} onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Price (₱) *</label>
            <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Cost Price (₱)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.costPrice} onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Stock</label>
            <input className="input" type="number" min="0" value={form.stock} onChange={e => setForm(prev => ({ ...prev, stock: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Unit</label>
            <select className="select" value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}>
              <option value="pc">Piece</option>
              <option value="box">Box</option>
              <option value="dozen">Dozen</option>
              <option value="tray">Tray</option>
              <option value="slice">Slice</option>
              <option value="cup">Cup</option>
            </select>
          </div>
          <div className="input-group">
            <label>Reorder Point</label>
            <input className="input" type="number" min="0" value={form.reorderPoint} onChange={e => setForm(prev => ({ ...prev, reorderPoint: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Emoji (Icon)</label>
            <input className="input" value={form.emoji} onChange={e => setForm(prev => ({ ...prev, emoji: e.target.value }))} style={{ fontSize: '1.5rem', textAlign: 'center' }} />
          </div>
          <div className="input-group">
            <label>Popularity Badge</label>
            <select className="select" value={form.isTopSelling} onChange={e => setForm(prev => ({ ...prev, isTopSelling: Number(e.target.value) }))}>
              <option value="0">None</option>
              <option value="1">👑 #1 Best Seller</option>
              <option value="2">🔥 Hot Item</option>
              <option value="3">⭐ Popular</option>
            </select>
          </div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label>Product Image (Optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {form.image ? (
                <img src={form.image} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
              ) : (
                <div style={{ width: 80, height: 80, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {form.emoji || '📸'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="input" style={{ width: 'auto' }} />
                {form.image && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, image: '' }))} style={{ alignSelf: 'flex-start' }}>Remove Image</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCatForm} onClose={() => setShowCatForm(false)} title="Add Category"
        footer={<button className="btn btn-primary" onClick={saveCategory}>Add Category</button>}>
        <div className="form-grid">
          <div className="input-group">
            <label>Category Name</label>
            <input className="input" value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Donuts" />
          </div>
          <div className="input-group">
            <label>Emoji</label>
            <input className="input" value={catEmoji} onChange={e => setCatEmoji(e.target.value)} style={{ fontSize: '1.5rem', textAlign: 'center' }} />
          </div>
        </div>
      </Modal>

      <BatchUploadModal 
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        categories={categories}
        onUpload={async (batch) => {
          if (localStorage.getItem('fel_active_branch') === 'all') {
            addToast('Please select a specific branch from the sidebar to inject batch products', 'warning');
            throw new Error('No branch selected');
          }
          await addProductsBatch(batch);
          addToast(`Successfully injected ${batch.length} products!`, 'success');
        }}
      />
    </>
  );
}
