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
  const [activeBatches, setActiveBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [keypadMode, setKeypadMode] = useState('material'); // 'material' or 'production'
  const [tempQty, setTempQty] = useState('');

  useEffect(() => {
    fetchMaterials();
    fetchHistory();
    fetchActiveBatches();
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
      const data = await api.get('/production/logs?status=completed');
      setHistory(data);
    } catch (err) {}
  };

  const fetchActiveBatches = async () => {
    try {
      const data = await api.get('/production/logs?status=in_oven');
      setActiveBatches(data);
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
      if (selectedBatch) {
        handleFinalizeBatch(selectedBatch.id, qty);
        setSelectedBatch(null);
      } else {
        setQuantityToProduce(qty);
      }
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
        emoji: selectedMaterial.emoji,
        image: selectedMaterial.image
      }];
    });
    
    setShowQtyModal(false);
    addToast(`${selectedMaterial.name} added to batch`, 'success');
  };

  const removeFromBatch = (id) => {
    setActiveBatch(prev => prev.filter(item => item.materialId !== id));
  };

  const handleStartBatch = async () => {
    if (activeBatch.length === 0) return addToast('Please add ingredients first', 'error');
    if (!targetProduct) return addToast('Please select what you are baking', 'error');
    if (!quantityToProduce || quantityToProduce <= 0) return addToast('Estimated yield must be > 0', 'error');

    setIsSaving(true);
    try {
      const payload = {
        id: uuidv4(),
        productId: targetProduct.id,
        productName: targetProduct.name,
        estimatedYield: parseFloat(quantityToProduce),
        items: activeBatch,
        date: new Date().toISOString(),
        notes: `Started batch for ${targetProduct.name}`,
        status: 'in_oven'
      };

      await api.post('/production/log', payload);
      addToast(`Batch for ${targetProduct.name} is now IN THE OVEN 🥧`, 'success');
      
      setActiveBatch([]);
      setTargetProduct(null);
      setQuantityToProduce(1);
      fetchMaterials();
      fetchActiveBatches();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalizeBatch = async (logId, actual) => {
    try {
      await api.post('/production/finalize', { logId, actualYield: actual });
      addToast('Production Completed & Inventory Synced!', 'success');
      fetchActiveBatches();
      fetchHistory();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleVoidBatch = async (logId) => {
    const reason = prompt("Why is this batch being voided? (Burned, Spilled, etc.)");
    if (!reason) return;

    try {
      await api.post('/production/void', { logId, reason });
      addToast('Batch Ruined. Spoilage Alert sent to Manager/Owner.', 'warning');
      fetchActiveBatches();
    } catch (err) {
      addToast(err.message, 'error');
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
                    {m.image ? (
                      <div className="material-image-lux" style={{ backgroundImage: `url(${m.image})` }} />
                    ) : (
                      <div className="material-emoji">{m.emoji}</div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-xs)', color: 'var(--text-mocha)', marginBottom: 4, zIndex: 2, position: 'relative' }}>{m.name}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: m.stock <= m.reorderPoint ? 'var(--danger)' : 'var(--sage)', zIndex: 2, position: 'relative' }}>
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

            {/* Live Oven Subsection */}
            {activeBatches.length > 0 && (
              <div className="mt-12 p-6 glass-oven animate-pulse-slow">
                <h4 className="text-sm font-black uppercase tracking-widest text-mocha mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="oven-dot" /> 🥧 In the Oven (Live)
                  </div>
                  <span className="text-[10px] bg-mocha-light px-2 py-1 rounded-full">{activeBatches.length} active</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeBatches.map(batch => (
                    <div key={batch.id} className="batch-live-card">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-black text-mocha text-sm">{batch.productName || 'Batch Production'}</p>
                          <p className="text-[11px] font-black uppercase text-accent mt-1">
                            Estimated: {batch.estimatedYield || 0} {batch.unit || 'pcs'}
                          </p>
                        </div>
                        <div className="live-timer-lux">
                           {new Date(batch.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="flex-1 btn-lux-green py-3 text-xs font-black uppercase tracking-widest"
                          onClick={() => {
                            setSelectedBatch(batch);
                            setKeypadMode('production');
                            setTempQty((batch.estimatedYield || 0).toString());
                            setShowQtyModal(true);
                          }}
                        >
                          Finish
                        </button>
                        <button 
                          className="px-4 btn-lux-ruin"
                          onClick={() => handleVoidBatch(batch.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                          <td className="font-bold text-xs">{log.productName || 'Batch'}</td>
                          <td className="text-xs font-black text-accent">{log.quantityProduced || 0}</td>
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
          <div className="card-header flex items-center justify-between" style={{ background: 'transparent', borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '24px' }}>
            <div className="flex items-center gap-3">
              <ChefHat size={22} className="text-mocha" />
              <h3 className="card-title" style={{ color: '#4A3728', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Studio Log</h3>
            </div>
            {activeBatch.length > 0 && (
              <button onClick={clearBatch} className="clear-batch-minimal">
                <Trash2 size={16} />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="batch-content-luxury">
            {activeBatch.length === 0 ? (
              <div className="empty-luxury animate-fade-in">
                <div className="empty-icon-wrapper">
                  <Scale size={42} strokeWidth={1} />
                </div>
                <p className="empty-text">Select ingredients to begin your craft</p>
                <div className="empty-dot-grid"></div>
              </div>
            ) : (
              <div className="ingredient-stack">
                {activeBatch.map((item, index) => (
                  <div 
                    key={item.materialId} 
                    className="ingredient-luxury-card animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {item.image ? (
                       <div className="luxury-image-box-sidebar" style={{ backgroundImage: `url(${item.image})` }} />
                    ) : (
                       <div className="luxury-emoji-box">{item.emoji}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="luxury-material-name truncate">{item.materialName}</div>
                      <div className="luxury-material-qty">{item.quantityUsed} {item.unit}</div>
                    </div>
                    <div className="flex items-center">
                      <button className="luxury-remove-btn shadow-sm" onClick={() => removeFromBatch(item.materialId)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sidebar-footer-luxury">
            <div className="luxury-input-section">
              <label className="luxury-label">Production Target</label>
              {!targetProduct ? (
                <button className="luxury-picker-btn" onClick={() => setShowProductModal(true)}>
                  <Plus size={18} />
                  <span>Tap to choose product</span>
                </button>
              ) : (
                <div className="luxury-selected-card animate-scale-in">
                  <span className="luxury-selected-emoji">{targetProduct.emoji}</span>
                  <div className="flex-1">
                     <div className="luxury-selected-name">{targetProduct.name}</div>
                     <div className="luxury-selected-meta">{targetProduct.unit || 'pcs'}</div>
                  </div>
                  <button onClick={() => setTargetProduct(null)} className="luxury-reset-btn">
                     <RotateCcw size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="luxury-input-section">
              <label className="luxury-label">Expected Yield</label>
              <div className="luxury-qty-wrapper" onClick={openProductionKeypad}>
                 <button className="qty-lux-btn" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(Math.max(1, quantityToProduce - 1)); }}>
                   <Minus size={18} />
                 </button>
                 <div className="qty-lux-display">
                    <span className="qty-lux-val">{quantityToProduce}</span>
                    <span className="qty-lux-unit">{targetProduct?.unit || 'pcs'}</span>
                 </div>
                 <button className="qty-lux-btn" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(quantityToProduce + 1); }}>
                   <Plus size={18} />
                 </button>
              </div>
            </div>

            <button 
              className={`luxury-submit-btn ${isSaving ? 'loading' : ''}`}
              disabled={activeBatch.length === 0 || !targetProduct || isSaving}
              onClick={handleStartBatch}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">Processing...</span>
              ) : (
                <div className="flex items-center justify-center gap-3 w-full">
                  <PackageCheck size={24} strokeWidth={2.5} /> 
                  <span className="text-base font-black">Start & Place in Oven</span>
                </div>
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

      <Modal 
        isOpen={showQtyModal} 
        onClose={() => setShowQtyModal(false)}
        title={keypadMode === 'production' ? `Finish: ${targetProduct?.name}` : `Add ${selectedMaterial?.name}`}
      >
        <div className="keypad-container-luxury">
          <div className="keypad-display-luxury">
            <span className="keypad-val">{tempQty || '0'}</span>
            <span className="keypad-unit">{keypadMode === 'production' ? targetProduct?.unit : selectedMaterial?.unit}</span>
          </div>
          
          <div className="keypad-grid-luxury">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
              <button 
                key={n} 
                className="lux-num-btn" 
                onClick={() => setTempQty(p => p + n.toString())}
              >
                {n}
              </button>
            ))}
            <button 
              className="lux-num-btn reset" 
              onClick={() => setTempQty('')}
            >
              <RotateCcw size={24} />
            </button>
          </div>

          <button 
            className="lux-confirm-btn"
            onClick={confirmAdd}
          >
            {keypadMode === 'production' ? 'Confirm Production' : 'Add to Batch'}
          </button>
        </div>
      </Modal>

      <style>{`
        :root {
          --mocha: #4A3728;
          --mocha-light: #F5E6D3;
          --sage: #6B8E23;
          --cream: #FAF9F6;
        }
        .pos-container {
          background-color: #F8F5F2;
          background-image: 
            radial-gradient(at 0% 0%, hsla(28,100%,74%,0.15) 0, transparent 50%), 
            radial-gradient(at 50% 0%, hsla(180,100%,74%,0.05) 0, transparent 50%), 
            radial-gradient(at 100% 0%, hsla(28,100%,74%,0.15) 0, transparent 50%);
          background-attachment: fixed;
        }
        .card {
          background: rgba(255, 255, 255, 0.6) !important;
          backdrop-filter: blur(15px) !important;
          -webkit-backdrop-filter: blur(15px) !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07) !important;
          border-radius: 32px !important;
        }
        .batch-sidebar {
          background: rgba(255, 255, 255, 0.4) !important;
          border-left: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .clear-batch-minimal {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--mocha-light);
          color: var(--mocha);
          border: none;
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .clear-batch-minimal:hover { transform: scale(1.05); background: #eddec9; }

        .batch-content-luxury {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          position: relative;
        }
        .empty-luxury {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--mocha);
          opacity: 0.4;
        }
        .empty-icon-wrapper {
          width: 80px;
          height: 80px;
          border: 1px dashed var(--mocha);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .empty-text {
          font-size: 0.8rem;
          font-weight: 600;
          max-width: 150px;
          line-height: 1.5;
        }
        
        .ingredient-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ingredient-luxury-card {
           background: rgba(255, 255, 255, 0.5);
           backdrop-filter: blur(5px);
           padding: 16px;
           border-radius: 20px;
           display: flex;
           align-items: center;
           gap: 16px;
           box-shadow: 0 4px 12px rgba(0,0,0,0.02);
           border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .material-image-lux {
           height: 80px;
           width: 100%;
           background-size: cover;
           background-position: center;
           margin-bottom: 12px;
           border-radius: 12px;
           box-shadow: 0 8px 20px rgba(0,0,0,0.1);
           position: relative;
           z-index: 2;
        }

        .luxury-image-box-sidebar {
           width: 44px;
           height: 44px;
           background-size: cover;
           background-position: center;
           border-radius: 14px;
           box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .luxury-emoji-box {
          width: 44px;
          height: 44px;
          background: #FDFBF7;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
        }
        .luxury-material-name {
          font-weight: 800;
          font-size: 0.85rem;
          color: var(--mocha);
        }
        .luxury-material-qty {
          font-size: 0.75rem;
          color: var(--sage);
          font-weight: 700;
        }
        .luxury-remove-btn {
          color: #ef4444;
          background: #fff5f5;
          border: 1px solid #fee2e2;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .luxury-remove-btn:hover { background: #ef4444; color: white; transform: scale(1.1); }

        .sidebar-footer-luxury {
          padding: 24px;
          background: white;
          border-top: 1px solid rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .luxury-input-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .luxury-label {
          font-size: 0.65rem;
          font-weight: 900;
          text-transform: uppercase;
          color: #A0938A;
          letter-spacing: 0.15em;
        }
        .luxury-picker-btn {
           background: #FDFBF7;
           border: 1px dashed #E5E1DA;
           padding: 16px;
           border-radius: 16px;
           color: #8B837E;
           font-size: 0.75rem;
           font-weight: 700;
           display: flex;
           align-items: center;
           justify-content: center;
           gap: 10px;
           cursor: pointer;
           transition: all 0.2s;
        }
        .luxury-picker-btn:hover { border-color: var(--mocha); color: var(--mocha); background: white; }

        .luxury-selected-card {
           background: var(--mocha);
           padding: 16px;
           border-radius: 18px;
           color: white;
           display: flex;
           align-items: center;
           gap: 12px;
           box-shadow: 0 10px 25px rgba(74, 55, 40, 0.2);
        }
        .luxury-selected-emoji { font-size: 1.8rem; }
        .luxury-selected-name { font-weight: 800; font-size: 0.85rem; }
        .luxury-selected-meta { font-size: 0.65rem; opacity: 0.6; font-weight: 600; text-transform: uppercase; }
        .luxury-reset-btn { background: rgba(255,255,255,0.1); border: none; width: 28px; height: 28px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .luxury-reset-btn:hover { background: rgba(255,255,255,0.2); }

        .luxury-qty-wrapper {
          background: #FDFBF7;
          border-radius: 18px;
          display: flex;
          align-items: center;
          padding: 6px;
          cursor: pointer;
        }
        .qty-lux-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          background: white;
          color: var(--mocha);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.03);
          transition: all 0.2s;
        }
        .qty-lux-btn:active { transform: scale(0.9); }
        .qty-lux-display {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .qty-lux-val { font-size: 1.4rem; font-weight: 900; color: var(--mocha); line-height: 1; }
        .qty-lux-unit { font-size: 0.6rem; font-weight: 800; color: #BBB0A8; text-transform: uppercase; }

        .luxury-submit-btn {
          width: 100%;
          background: var(--sage);
          color: white;
          padding: 20px;
          border-radius: 20px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 800;
          font-size: 0.9rem;
          box-shadow: 0 10px 30px rgba(107, 142, 35, 0.25);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .luxury-submit-btn:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 15px 40px rgba(107, 142, 35, 0.35);
          background: #7ca529;
        }
        .luxury-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(1); }

        .material-card {
           background: rgba(255, 255, 255, 0.4) !important;
           border-radius: 24px !important;
           border: 1px solid rgba(255, 255, 255, 0.5) !important;
           backdrop-filter: blur(10px);
        }
        .material-card:hover {
           background: rgba(255, 255, 255, 0.6) !important;
           border-color: var(--mocha) !important;
        }
        .material-emoji { font-size: 3rem; margin-bottom: 12px; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.1)); transition: transform 0.3s; }
        .material-card:hover .material-emoji { transform: translateY(-5px) scale(1.1); }
        
        .keypad-container-luxury {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding: 10px;
        }
        .keypad-display-luxury {
          text-align: center;
          padding: 20px;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 12px;
        }
        .keypad-val { font-size: 5rem; font-weight: 900; color: #D4763C; line-height: 1; }
        .keypad-unit { font-size: 1.5rem; font-weight: 800; color: #BBB0A8; }

        .keypad-grid-luxury {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .lux-num-btn {
          height: 80px;
          background: white;
          border: 1px solid rgba(0,0,0,0.05);
          border-radius: 24px;
          font-size: 2rem;
          font-weight: 900;
          color: #4A3728;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .lux-num-btn:active { transform: scale(0.95); background: #FDFBF7; }
        .lux-num-btn.reset { background: #ef4444; color: white; }
        .lux-num-btn.reset:hover { background: #dc2626; }

        .lux-confirm-btn {
          width: 100%;
          padding: 24px;
          background: #E68D50;
          color: white;
          border-radius: 20px;
          border: none;
          font-size: 1.2rem;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 10px 25px rgba(230, 141, 80, 0.2);
        }
        .lux-confirm-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(230, 141, 80, 0.3); }
        .lux-confirm-btn:active { transform: translateY(0); }
        .glass-oven {
          background: rgba(255, 120, 0, 0.05);
          border: 1px dashed rgba(212, 118, 60, 0.3);
          border-radius: 24px;
        }
        .oven-dot {
          width: 8px;
          height: 8px;
          background: #ff4d00;
          border-radius: 50%;
          box-shadow: 0 0 10px #ff4d00;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
        .animate-pulse-slow {
          animation: pulse 4s infinite ease-in-out;
        }
        
        .batch-live-card {
           background: white;
           padding: 20px;
           border-radius: 20px;
           box-shadow: 0 4px 15px rgba(0,0,0,0.02);
           border: 1px solid rgba(0,0,0,0.03);
        }
        .live-timer-lux {
           font-size: 0.7rem;
           font-weight: 900;
           color: white;
           background: var(--mocha);
           padding: 6px 14px;
           border-radius: 50px;
           box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        
        .btn-lux-green {
           background: var(--sage);
           color: white;
           border-radius: 14px;
           border: none;
           cursor: pointer;
           transition: all 0.2s;
        }
        .btn-lux-green:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(107, 142, 35, 0.2); }
        
        .btn-lux-ruin {
           background: #fee2e2;
           color: #ef4444;
           border: none;
           border-radius: 14px;
           cursor: pointer;
           transition: all 0.2s;
        }
        .btn-lux-ruin:hover { background: #ef4444; color: white; }
      `}</style>
    </>
  );
}
