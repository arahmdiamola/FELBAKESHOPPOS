import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { Search, Wheat, Plus, Edit3, Trash2, AlertTriangle, ArrowUpDown, Scale, Star } from 'lucide-react';

const BAKING_EMOJIS = [
  '🌾', '🧪', '🍚', '🧉', '🍶', '🧂', '🧊', '🥣', '🥢', '🥄', '🔪', 
  '🥚', '🥛', '🧈', '🧀', '🥥', '🍫', '🌰', '🍯', '🍯', '🥃', '🍊', 
  '🍋', '🍎', '🫐', '🍓', '🍌', '🥔', '📦', '🥡', '🧴', '🛁'
];

export default function RawMaterialsPage() {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', stock: 0, unit: 'kg', reorderPoint: 0, emoji: '📦', image: null });
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
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [materials, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', stock: 0, unit: 'kg', reorderPoint: 0, emoji: '📦' });
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m.id);
    setForm({ name: m.name, stock: m.stock, unit: m.unit, reorderPoint: m.reorderPoint, emoji: m.emoji, image: m.image });
    setShowForm(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) return addToast('Image too large (max 1MB)', 'error');
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, image: reader.result });
      reader.readAsDataURL(file);
    }
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

      <div className="pos-glass-layout animate-fade-in">
        <div className="filter-bar-luxury mb-6">
          <div className="search-bar-glass" style={{ flex: 1, maxWidth: 460 }}>
            <Search size={18} />
            <input 
              placeholder="Filter by material name..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          {isAdmin && (
             <button className="luxury-add-btn" onClick={openAdd}>
                <Plus size={18} />
                <span>New Material</span>
             </button>
          )}
        </div>

        <div className="glass-table-container">
          <table className="luxury-table">
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
               {filtered.map((m, index) => {
                const isLow = m.reorderPoint > 0 && m.stock <= m.reorderPoint;
                return (
                  <tr key={m.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                    <td className="luxury-td-emoji">
                      {m.image ? (
                        <div className="luxury-image-badge" style={{ backgroundImage: `url(${m.image})` }} />
                      ) : (
                        <div className="luxury-emoji-badge">{m.emoji}</div>
                      )}
                    </td>
                    <td className="luxury-td-name">
                       <div className="name-main">{m.name}</div>
                       <div className="name-sub">Baking Ingredient</div>
                    </td>
                    <td>
                      <div className={`luxury-stock-pill ${isLow ? 'low' : 'optimal'}`}>
                        <span className="stock-val">{m.stock}</span>
                        <span className="stock-unit">{m.unit}</span>
                      </div>
                    </td>
                    <td className="luxury-td-reorder">
                       <div className="reorder-label">Threshold</div>
                       <div className="reorder-val">{m.reorderPoint} {m.unit}</div>
                    </td>
                    <td>
                      {isLow ? (
                        <div className="luxury-status-badge critical">
                          <AlertTriangle size={12} />
                          <span>Needs Restock</span>
                        </div>
                      ) : (
                        <div className="luxury-status-badge healthy">
                          <div className="status-dot" />
                          <span>Healthy Stock</span>
                        </div>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-2">
                          <button className="action-btn-circle edit" onClick={() => openEdit(m)}>
                            <Edit3 size={14} />
                          </button>
                          <button className="action-btn-circle delete" onClick={() => handleDelete(m.id, m.name)}>
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
        title={editing ? `Edit ${form.name}` : 'New Material'}
        footer={<button className="luxury-add-btn" style={{ width: '100%' }} onClick={handleSave}>Save Material Integrity</button>}
      >
        <div className="luxury-form-wrap">
          <div className="image-upload-zone">
            {form.image ? (
              <div className="image-preview-lux" style={{ backgroundImage: `url(${form.image})` }}>
                <button className="remove-image-btn" onClick={() => setForm({ ...form, image: null })}>
                   <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="upload-placeholder-lux">
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                <Plus size={24} className="mb-2" />
                <span>Upload Material Photo</span>
                <p className="text-[10px] opacity-60 mt-1">Snap a photo of the sack/box</p>
              </label>
            )}
          </div>

          <div className="form-grid mt-6">
          <div className="input-group full-width">
            <label>Select Icon</label>
            <div className="emoji-grid">
              {BAKING_EMOJIS.map(e => (
                <button 
                  key={e} 
                  className={`emoji-btn ${form.emoji === e ? 'active' : ''}`}
                  onClick={() => setForm({...form, emoji: e})}
                >
                  {e}
                </button>
              ))}
            </div>
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
        </div>
      </Modal>
      <style>{`
        :root {
          --mocha: #4A3728;
          --mocha-light: #F5E6D3;
          --sage: #6B8E23;
          --cream: #FAF9F6;
        }
        .pos-glass-layout {
          padding: 32px;
          min-height: calc(100vh - 120px);
          background-color: #F8F5F2;
          background-image: 
            radial-gradient(at 0% 0%, hsla(28,100%,74%,0.1) 0, transparent 50%), 
            radial-gradient(at 100% 0%, hsla(180,100%,74%,0.08) 0, transparent 50%),
            radial-gradient(at 50% 100%, hsla(28,100%,74%,0.05) 0, transparent 50%);
          background-attachment: fixed;
        }

        .filter-bar-luxury {
           display: flex;
           align-items: center;
           justify-content: space-between;
           gap: 20px;
        }
        
        .search-bar-glass {
           background: rgba(255, 255, 255, 0.4);
           backdrop-filter: blur(10px);
           border: 1px solid rgba(255, 255, 255, 0.6);
           border-radius: 20px;
           padding: 12px 20px;
           display: flex;
           align-items: center;
           gap: 12px;
           color: var(--mocha);
           box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
        }
        .search-bar-glass input {
           background: transparent;
           border: none;
           width: 100%;
           outline: none;
           font-weight: 700;
           color: var(--mocha);
        }

        .luxury-add-btn {
           background: var(--mocha);
           color: white;
           padding: 14px 24px;
           border-radius: 20px;
           border: none;
           display: flex;
           align-items: center;
           gap: 10px;
           font-weight: 800;
           font-size: 0.85rem;
           cursor: pointer;
           box-shadow: 0 10px 25px rgba(74, 55, 40, 0.2);
           transition: all 0.2s;
        }
        .luxury-add-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(74, 55, 40, 0.3); }

        .glass-table-container {
           background: rgba(255, 255, 255, 0.4);
           backdrop-filter: blur(20px);
           border: 1px solid rgba(255, 255, 255, 0.4);
           border-radius: 32px;
           box-shadow: 0 20px 60px rgba(0,0,0,0.04);
           overflow: hidden;
        }

        .luxury-table {
           width: 100%;
           border-collapse: collapse;
        }
        .luxury-table th {
           padding: 24px;
           text-align: left;
           font-size: 0.7rem;
           font-weight: 900;
           text-transform: uppercase;
           color: #A0938A;
           letter-spacing: 0.15em;
           border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .luxury-table td {
           padding: 24px;
           border-bottom: 1px solid rgba(0,0,0,0.03);
        }

        .luxury-td-emoji { text-align: center; }
        .luxury-emoji-badge {
           width: 50px;
           height: 50px;
           background: white;
           border-radius: 18px;
           display: flex;
           align-items: center;
           justify-content: center;
           font-size: 1.8rem;
           box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        
        .luxury-td-name .name-main { font-weight: 800; color: var(--mocha); font-size: 1rem; }
        .luxury-td-name .name-sub { font-size: 0.7rem; color: #BBB0A8; font-weight: 600; }

        .luxury-stock-pill {
           padding: 10px 18px;
           border-radius: 16px;
           display: inline-flex;
           align-items: baseline;
           gap: 6px;
           font-weight: 900;
           box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .luxury-stock-pill.optimal { background: #dcfce7; color: #166534; }
        .luxury-stock-pill.low { background: #fee2e2; color: #991b1b; }
        .stock-val { font-size: 1.2rem; }
        .stock-unit { font-size: 0.6rem; opacity: 0.7; text-transform: uppercase; }

        .luxury-td-reorder .reorder-label { font-size: 0.6rem; color: #BBB0A8; font-weight: 700; text-transform: uppercase; }
        .luxury-td-reorder .reorder-val { font-weight: 800; color: var(--mocha); font-size: 0.9rem; }

        .luxury-status-badge {
           padding: 8px 14px;
           border-radius: 12px;
           display: inline-flex;
           align-items: center;
           gap: 8px;
           font-size: 0.75rem;
           font-weight: 800;
        }
        .luxury-status-badge.healthy { background: rgba(107, 142, 35, 0.1); color: var(--sage); }
        .luxury-status-badge.healthy .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sage); box-shadow: 0 0 10px var(--sage); }
        .luxury-status-badge.critical { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .action-btn-circle {
           width: 36px;
           height: 36px;
           border-radius: 50%;
           border: none;
           display: flex;
           align-items: center;
           justify-content: center;
           cursor: pointer;
           transition: all 0.2s;
        }
        .action-btn-circle.edit { background: white; color: var(--mocha); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .action-btn-circle.edit:hover { background: var(--mocha); color: white; transform: rotate(15deg); }
        .action-btn-circle.delete { background: transparent; color: #D1D1D1; }
        .action-btn-circle.delete:hover { background: #fee2e2; color: #ef4444; }

        .luxury-image-badge {
           width: 50px;
           height: 50px;
           border-radius: 18px;
           background-size: cover;
           background-position: center;
           box-shadow: 0 8px 16px rgba(0,0,0,0.1);
           border: 2px solid white;
        }

        .luxury-form-wrap {
           display: flex;
           flex-direction: column;
           gap: 12px;
        }
        .image-upload-zone {
           height: 180px;
           background: #FDFBF7;
           border: 2px dashed #E5E1DA;
           border-radius: 24px;
           overflow: hidden;
           position: relative;
        }
        .upload-placeholder-lux {
           width: 100%;
           height: 100%;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           cursor: pointer;
           color: #8B837E;
           font-weight: 800;
           font-size: 0.8rem;
           transition: all 0.2s;
        }
        .upload-placeholder-lux:hover { background: white; color: var(--mocha); }
        .image-preview-lux {
           width: 100%;
           height: 100%;
           background-size: cover;
           background-position: center;
        }
        .remove-image-btn {
           position: absolute;
           top: 12px;
           right: 12px;
           background: rgba(0,0,0,0.5);
           color: white;
           border: none;
           width: 24px;
           height: 24px;
           border-radius: 50%;
           display: flex;
           align-items: center;
           justify-content: center;
           cursor: pointer;
           backdrop-filter: blur(4px);
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 10px;
          padding: 16px;
          background: #FDFBF7;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .emoji-btn {
          font-size: 1.8rem;
          padding: 10px;
          border-radius: 14px;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        .emoji-btn:hover { background: white; transform: scale(1.1); }
        .emoji-btn.active { border-color: var(--mocha); background: white; box-shadow: 0 10px 25px rgba(74, 55, 40, 0.15); }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
      `}</style>
    </>
  );
}
