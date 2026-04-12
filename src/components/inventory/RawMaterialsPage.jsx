import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { Search, Wheat, Plus, Edit3, Trash2, AlertTriangle, ArrowUpDown, Scale } from 'lucide-react';

export default function RawMaterialsPage() {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', stock: 0, unit: 'kg', reorderPoint: 0, emoji: '📦' });
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = ['admin', 'system_admin', 'manager'].includes(currentUser?.role);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const data = await api.get('/raw-materials');
      setMaterials(data);
    } catch (err) {
      addToast('Failed to fetch raw materials', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = materials;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [materials, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', stock: 0, unit: 'kg', reorderPoint: 0, emoji: '📦' });
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m.id);
    setForm({ name: m.name, stock: m.stock, unit: m.unit, reorderPoint: m.reorderPoint, emoji: m.emoji });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return addToast('Name is required', 'error');
    
    try {
      if (editing) {
        await api.put(`/raw-materials/${editing}`, form);
        addToast('Material updated', 'success');
      } else {
        await api.post('/raw-materials', { ...form, id: uuidv4() });
        addToast('Material added', 'success');
      }
      setShowForm(false);
      fetchMaterials();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Delete material "${name}"?`)) {
      try {
        await api.delete(`/raw-materials/${id}`);
        addToast('Material deleted', 'success');
        fetchMaterials();
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  return (
    <>
      <Header 
        title="Raw Materials Inventory" 
        subtitle="Manage ingredients and supplies"
        actions={isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Material
          </button>
        )}
      />

      <div className="page-content animate-fade-in">
        <div className="filter-bar mb-4">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search />
            <input 
              placeholder="Search materials (e.g. Flour, Sugar...)" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th width="50"></th>
                <th>Material Name</th>
                <th>Current Stock</th>
                <th>Reorder Point</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const isLow = m.reorderPoint > 0 && m.stock <= m.reorderPoint;
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: '1.5rem' }}>{m.emoji}</td>
                    <td className="primary">{m.name}</td>
                    <td>
                      <span className={`badge ${isLow ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        {m.stock} {m.unit}
                      </span>
                    </td>
                    <td>{m.reorderPoint} {m.unit}</td>
                    <td>
                      {isLow ? (
                        <span className="text-danger flex items-center gap-1 font-bold">
                          <AlertTriangle size={14} /> Low Stock
                        </span>
                      ) : (
                        <span className="text-success font-medium">Optimal</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>
                            <Edit3 size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(m.id, m.name)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="text-muted">No materials found. {isAdmin && 'Add some to get started!'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={showForm} 
        onClose={() => setShowForm(false)} 
        title={editing ? 'Edit Material' : 'Add New Material'}
        footer={<button className="btn btn-primary" onClick={handleSave}>Save Material</button>}
      >
        <div className="form-grid">
          <div className="input-group">
            <label>Emoji Icon</label>
            <input 
              className="input" 
              value={form.emoji} 
              onChange={e => setForm({...form, emoji: e.target.value})}
              placeholder="🍞"
            />
          </div>
          <div className="input-group">
            <label>Material Name *</label>
            <input 
              className="input" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="e.g. All-Purpose Flour"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Current Stock</label>
            <input 
              className="input" 
              type="number" 
              value={form.stock} 
              onChange={e => setForm({...form, stock: parseFloat(e.target.value)})}
            />
          </div>
          <div className="input-group">
            <label>Unit (kg, g, pcs, liters)</label>
            <input 
              className="input" 
              value={form.unit} 
              onChange={e => setForm({...form, unit: e.target.value})}
            />
          </div>
          <div className="input-group">
            <label>Reorder Point</label>
            <input 
              className="input" 
              type="number" 
              value={form.reorderPoint} 
              onChange={e => setForm({...form, reorderPoint: parseFloat(e.target.value)})}
            />
            <span className="text-xs text-muted">Warn me when stock drops below this level</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
