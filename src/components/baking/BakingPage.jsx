import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProducts } from '../../contexts/ProductContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { 
  Plus, Minus, ChefHat, Check, Trash2, Search, Scale, 
  PackageCheck, Info, RotateCcw, ArrowRight, Save
} from 'lucide-react';

export default function BakingPage() {
  const { currentUser } = useAuth();
  const { products } = useProducts();
  const { addToast } = useToast();
  
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [activeBatch, setActiveBatch] = useState([]);
  const [history, setHistory] = useState([]);
  const [targetProduct, setTargetProduct] = useState(null);
  const [quantityToProduce, setQuantityToProduce] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [keypadMode, setKeypadMode] = useState('material'); // 'material' or 'production'
  const [tempQty, setTempQty] = useState('');

  useEffect(() => {
    fetchMaterials();
    fetchHistory();
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

  const fetchHistory = async () => {
    try {
      const data = await api.get('/production/logs');
      setHistory(data);
    } catch (err) {}
  };

  const filteredMaterials = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q));
  }, [materials, search]);

  const addToBatch = (material) => {
    setSelectedMaterial(material);
    setKeypadMode('material');
    setTempQty('');
    setShowQtyModal(true);
  };

  const openProductionKeypad = () => {
    if (!targetProduct) return addToast('Please select a product first', 'info');
    setKeypadMode('production');
    setTempQty(quantityToProduce.toString());
    setShowQtyModal(true);
  };

  const confirmAdd = () => {
    const qty = parseFloat(tempQty);
    if (!qty || qty <= 0) return addToast('Please enter a valid quantity', 'error');

    if (keypadMode === 'production') {
      setQuantityToProduce(qty);
      setShowQtyModal(false);
      return;
    }

    // Material logic
    if (qty > selectedMaterial.stock) {
      return addToast(`Insufficient stock! Only ${selectedMaterial.stock} ${selectedMaterial.unit} available.`, 'error');
    }

    setActiveBatch(prev => {
      const existing = prev.find(item => item.materialId === selectedMaterial.id);
      const totalNewQty = existing ? existing.quantityUsed + qty : qty;
      
      if (totalNewQty > selectedMaterial.stock) {
        addToast(`Warning: Total usage exceeds stock`, 'warning');
      }

      if (existing) {
        return prev.map(item => item.materialId === selectedMaterial.id 
          ? { ...item, quantityUsed: totalNewQty } 
          : item
        );
      }
      return [...prev, { 
        materialId: selectedMaterial.id, 
        materialName: selectedMaterial.name, 
        quantityUsed: qty, 
        unit: selectedMaterial.unit,
        emoji: selectedMaterial.emoji
      }];
    });
    
    setShowQtyModal(false);
    addToast(`${selectedMaterial.name} added to batch`, 'success');
  };

  const removeFromBatch = (id) => {
    setActiveBatch(prev => prev.filter(item => item.materialId !== id));
  };

  const handleFinishBaking = async () => {
    if (activeBatch.length === 0) return addToast('Please add ingredients to your batch', 'error');
    if (!targetProduct) return addToast('Please select what you are baking', 'error');
    if (!quantityToProduce || quantityToProduce <= 0) return addToast('Quantity produced must be greater than 0', 'error');

    setIsSaving(true);
    try {
      const payload = {
        id: uuidv4(),
        productId: targetProduct.id,
        productName: targetProduct.name,
        quantityProduced: parseFloat(quantityToProduce),
        items: activeBatch,
        date: new Date().toISOString(),
        notes: `Baking session for ${targetProduct.name}`
      };

      await api.post('/production/log', payload);
      
      addToast(`Success! Logged production of ${quantityToProduce} ${targetProduct.name}`, 'success');
      
      // Reset State
      setActiveBatch([]);
      setTargetProduct(null);
      setQuantityToProduce(1);
      fetchMaterials(); // Refresh stock levels
      fetchHistory();   // Refresh history list
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const clearBatch = () => {
    if (activeBatch.length > 0 && confirm('Clear current selection?')) {
      setActiveBatch([]);
    }
  };

  return (
    <>
      <Header 
        title="Baking Batch POS" 
        subtitle="Log production and ingredient usage"
        actions={<ChefHat className="text-accent" size={32} />}
      />

      <div className="pos-container animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(360px, 1.2fr)', gap: 20, padding: 20 }}>
        
        {/* Left Side: Ingredients Grid */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header flex items-center justify-between">
            <h3 className="card-title">Select Ingredients</h3>
            <div className="search-bar" style={{ width: 250 }}>
              <Search size={16} />
              <input 
                placeholder="Search raw materials..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {filteredMaterials.map(m => (
                <button 
                  key={m.id}
                  className="card hover-scale material-card"
                  onClick={() => addToBatch(m)}
                  style={{ 
                    padding: '24px 12px', textAlign: 'center', cursor: 'pointer',
                    background: 'var(--card-bg)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
                    border: '1px solid var(--border-light)', overflow: 'hidden'
                  }}
                >
                  <div className="material-emoji">{m.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-xs)', color: 'var(--text-main)', marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: m.stock <= m.reorderPoint ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {m.stock} {m.unit}
                  </div>
                  {activeBatch.some(item => item.materialId === m.id) && (
                    <div className="batch-check">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                  {m.stock <= m.reorderPoint && <div className="low-stock-dot" />}
                </button>
              ))}
            </div>

            {/* Recent History Subsection */}
            {history.length > 0 && (
              <div className="mt-12">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                  <RotateCcw size={14} /> Recent Productions
                </h4>
                <div className="table-container">
                  <table className="table mini-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 5).map(log => (
                        <tr key={log.id}>
                          <td className="font-bold text-xs">{log.productName}</td>
                          <td className="text-xs font-black text-accent">{log.quantityProduced}</td>
                          <td className="text-xs text-muted">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className="badge badge-green text-xs">Logged</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Batch Summary */}
        <div className="card batch-sidebar">
          <div className="card-header flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #D45D1D 100%)', color: 'white', border: 'none' }}>
            <div className="flex items-center gap-3">
              <ChefHat size={20} />
              <h3 className="card-title" style={{ color: 'white' }}>Live Baking Log</h3>
            </div>
            {activeBatch.length > 0 && (
              <button onClick={clearBatch} className="text-white/80 hover:text-white transition-colors">
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {activeBatch.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Scale size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
                <p>Tap ingredients to add to batch</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBatch.map(item => (
                  <div key={item.materialId} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: '1.2rem' }}>{item.emoji}</span>
                      <div>
                        <div className="font-bold text-sm text-gray-800">{item.materialName}</div>
                        <div className="text-xs font-bold text-accent">{item.quantityUsed} {item.unit}</div>
                      </div>
                    </div>
                    <button className="text-red-400 hover:text-red-600 transition-colors" onClick={() => removeFromBatch(item.materialId)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: 24, paddingBottom: 32, borderTop: '2px dashed var(--border-light)', background: 'white' }}>
            <div className="input-group mb-6">
              <label className="text-xs font-black uppercase tracking-widest text-muted mb-3 block">1. What are you baking?</label>
              
              {!targetProduct ? (
                <button 
                  className="product-picker-btn"
                  onClick={() => setShowProductModal(true)}
                >
                  <Plus size={20} />
                  <span>Choose Product</span>
                </button>
              ) : (
                <div className="selected-product-card animate-scale-in">
                  <div className="flex items-center gap-4">
                    <span className="selected-emoji">{targetProduct.emoji}</span>
                    <div className="flex-1">
                       <div className="font-black text-sm text-gray-800">{targetProduct.name}</div>
                       <div className="text-[10px] font-bold text-muted uppercase tracking-tighter">Unit: {targetProduct.unit || 'pcs'}</div>
                    </div>
                    <button onClick={() => setTargetProduct(null)} className="text-red-400 hover:text-red-600 transition-colors">
                       <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="input-group mb-8">
              <label className="text-xs font-black uppercase tracking-widest text-muted mb-3 block">2. Quantity Produced</label>
              <div className="qty-control-wrapper shadow-inner">
                 <button 
                   className="qty-btn minus" 
                   onClick={() => setQuantityToProduce(Math.max(1, quantityToProduce - 1))}
                 >
                   <Minus size={22} />
                 </button>
                 <div className="qty-display" onClick={openProductionKeypad} style={{ cursor: 'pointer' }}>
                    <input 
                      type="number" 
                      className="qty-input" 
                      value={quantityToProduce}
                      readOnly
                    />
                    <span className="qty-unit">{targetProduct?.unit || 'pcs'} (Tap to edit)</span>
                 </div>
                 <button 
                   className="qty-btn plus" 
                   onClick={() => setQuantityToProduce(quantityToProduce + 1)}
                 >
                   <Plus size={22} />
                 </button>
              </div>
            </div>

            <button 
              className={`finish-baking-btn ${isSaving ? 'loading' : ''}`}
              disabled={activeBatch.length === 0 || !targetProduct || isSaving}
              onClick={handleFinishBaking}
            >
              {isSaving ? 'Logging...' : (
                <>
                  <PackageCheck size={24} /> 
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-lg font-black uppercase tracking-widest">Finish Baking</span>
                    <span className="text-[10px] opacity-70 font-bold tracking-tight">Sync Inventory & Product Stock</span>
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Choose Production Target"
      >
        <div style={{ padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            {[...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(p => (
              <button 
                key={p.id}
                className="card hover-scale material-card"
                onClick={() => { setTargetProduct(p); setShowProductModal(false); }}
                style={{ padding: '20px 10px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-main)' }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{p.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: '0.7rem', color: 'var(--text-main)' }}>{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Touch-Friendly Quantity Modal */}
      <Modal 
        isOpen={showQtyModal} 
        onClose={() => setShowQtyModal(false)}
        title={keypadMode === 'production' ? `Production Qty: ${targetProduct?.name}` : `Add ${selectedMaterial?.name}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ textAlign: 'center', fontSize: '3rem', background: 'var(--bg-main)', padding: 20, borderRadius: 16, fontWeight: 900, color: 'var(--accent)' }}>
            {tempQty || '0'} <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-muted)' }}>{keypadMode === 'production' ? targetProduct?.unit : selectedMaterial?.unit}</span>
          </div>
          
          {/* Numeric Keypad Simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
              <button 
                key={n} 
                className="num-btn" 
                style={{ height: 60 }}
                onClick={() => setTempQty(p => p + n.toString())}
              >
                {n}
              </button>
            ))}
            <button 
              className="btn btn-danger" 
              style={{ height: 60 }}
              onClick={() => setTempQty('')}
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <button 
            className="btn btn-primary w-full py-4 text-lg font-bold"
            onClick={confirmAdd}
          >
            {keypadMode === 'production' ? 'Update Production Qty' : 'Add to Batch'}
          </button>
        </div>
      </Modal>

      <style>{`
        .pos-container {
          background-color: var(--bg-main);
        }
        .batch-sidebar {
          display: flex;
          flex-direction: column;
          background: white;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-xl);
          border-radius: 24px;
          overflow: hidden;
        }
        .material-card {
           border-radius: 18px !important;
        }
        .material-emoji {
          font-size: 2.8rem;
          margin-bottom: 12px;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .material-card:hover .material-emoji {
          transform: scale(1.15) rotate(5deg);
        }
        .batch-check {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--success);
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(34,197,94,0.3);
          animation: scaleIn 0.3s ease;
        }
        .low-stock-dot {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 8px;
          height: 8px;
          background: var(--danger);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--danger);
          animation: pulse 2s infinite;
        }
        .mini-table th {
          font-size: 0.65rem;
          color: var(--text-muted);
          padding: 8px;
        }
        .mini-table td {
          padding: 10px 8px;
          border-bottom: 1px solid var(--bg-main);
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .hover-scale:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(212,118,60,0.12) !important;
          border-color: var(--accent) !important;
        }
        .num-btn {
           background: var(--bg-main);
           border: 1px solid var(--border-light);
           color: var(--text-main);
           font-weight: 800;
           font-size: 1.4rem;
           border-radius: 12px;
           transition: all 0.2s;
        }
        .num-btn:active {
           background: var(--border-light);
           transform: translateY(2px);
        }
        .product-picker-btn {
           width: 100%;
           padding: 20px;
           border: 2px dashed var(--border-light);
           background: var(--bg-main);
           color: var(--text-muted);
           border-radius: 16px;
           display: flex;
           flex-direction: column;
           align-items: center;
           gap: 8px;
           transition: all 0.2s;
           font-weight: 800;
           font-size: 0.8rem;
        }
        .product-picker-btn:hover {
           border-color: var(--accent);
           background: white;
           color: var(--accent);
        }
        .selected-product-card {
           background: var(--bg-main);
           padding: 16px;
           border-radius: 20px;
           border: 2px solid var(--accent);
           box-shadow: 0 4px 15px rgba(212,118,60,0.1);
        }
        .selected-emoji {
           font-size: 2rem;
           filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        }
        .qty-control-wrapper {
           background: var(--bg-main);
           padding: 8px;
           border-radius: 20px;
           display: flex;
           align-items: center;
           gap: 12px;
        }
        .qty-btn {
           width: 50px;
           height: 50px;
           border-radius: 16px;
           border: none;
           display: flex;
           align-items: center;
           justify-content: center;
           transition: all 0.2s;
           cursor: pointer;
        }
        .qty-btn.minus { color: var(--danger); background: #fee2e2; }
        .qty-btn.plus { color: var(--success); background: #dcfce7; }
        .qty-btn:active { transform: scale(0.9); }
        .qty-display {
           flex: 1;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           gap: 1px;
        }
        .qty-input {
           width: 100%;
           text-align: center;
           font-weight: 900;
           font-size: 2rem;
           background: transparent;
           border: none;
           color: var(--text-main);
           outline: none;
           height: 40px;
        }
        .qty-unit {
           font-size: 0.6rem;
           font-weight: 800;
           color: var(--text-muted);
           text-transform: uppercase;
           letter-spacing: 0.1em;
        }
        .finish-baking-btn {
           width: 100%;
           background: linear-gradient(135deg, #10b981 0%, #059669 100%);
           color: white;
           padding: 24px;
           border-radius: 20px;
           border: none;
           display: flex;
           align-items: center;
           justify-content: center;
           gap: 16px;
           box-shadow: 0 10px 20px rgba(16,185,129,0.25);
           transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
           cursor: pointer;
        }
        .finish-baking-btn:hover {
           transform: translateY(-4px);
           box-shadow: 0 15px 30px rgba(16,185,129,0.35);
        }
        .finish-baking-btn:disabled {
           background: var(--bg-main);
           color: var(--text-muted);
           box-shadow: none;
           cursor: not-allowed;
           transform: none;
        }
        @keyframes scaleIn {
           from { transform: scale(0.8); opacity: 0; }
           to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
           animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </>
  );
}
