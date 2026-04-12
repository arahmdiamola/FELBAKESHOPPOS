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
  const [now, setNow] = useState(new Date());
  const [historyTab, setHistoryTab] = useState('success'); // 'success' or 'waste'
  const [alerts, setAlerts] = useState([]);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [keypadMode, setKeypadMode] = useState('material'); // 'material' or 'production'
  const [tempQty, setTempQty] = useState('');

  useEffect(() => {
    fetchMaterials();
    fetchHistory();
    fetchActiveBatches();

    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [historyTab]);

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
      const status = historyTab === 'success' ? 'completed' : 'ruined';
      const data = await api.get(`/production/logs?status=${status}`);
      setHistory(data);
    } catch (err) {}
  };

  const fetchActiveBatches = async () => {
    try {
      const data = await api.get('/production/logs?status=in_oven');
      setActiveBatches(data);
      
      // Update alerts if we find ruined batches in recent history
      const recentRuined = await api.get('/production/logs?status=ruined&limit=5');
      setAlerts(recentRuined);
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

      <div className="pos-container animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(360px, 1fr)', gap: 24, padding: 24 }}>
        
        {/* Left Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', paddingRight: 10 }}>
          
          {/* Section 1: Ingredients Selection */}
          <div className="card-elegant">
            <div className="p-6 flex items-center justify-between border-b border-mocha/5">
              <h3 className="card-title-elegant">1. Select Ingredients</h3>
              <div className="search-bar-elegant">
                <Search size={16} />
                <input 
                  placeholder="Find materials..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="p-6">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 16 }}>
                {filteredMaterials.map(m => (
                    <button 
                      key={m.id}
                      className="material-card-elegant"
                      onClick={() => addToBatch(m)}
                    >
                      <div className="material-visual">
                        {m.image ? (
                          <div className="material-image-lux" style={{ backgroundImage: `url(${m.image})` }} />
                        ) : (
                          <div className="material-emoji-lux">{m.emoji}</div>
                        )}
                      </div>
                      <div className="material-info-lux">
                        <div className="material-name-lux truncate">{m.name}</div>
                        <div className={`material-stock-lux ${m.stock <= m.reorderPoint ? 'low' : ''}`}>
                          {m.stock} {m.unit}
                        </div>
                      </div>
                      {activeBatch.some(item => item.materialId === m.id) && (
                        <div className="batch-check-elegant">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Oven Monitor */}
          {activeBatches.length > 0 && (
            <div className="card-elegant overflow-hidden">
              <div className="glass-oven-header">
                  <div className="flex items-center gap-3">
                    <div className="oven-dot" /> <span className="font-black text-xs uppercase tracking-widest text-[#D4763C]">Studio Oven Monitor</span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-mocha opacity-50">{activeBatches.length} Batches Active</span>
              </div>
              
              <div className="p-8 bg-gradient-to-br from-orange-50/50 to-transparent">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {activeBatches.map(batch => {
                    const product = products.find(p => p.id === batch.productId);
                    const startTime = new Date(batch.date);
                    const diffMs = Math.max(0, now - startTime);
                    const mins = Math.floor(diffMs / 60000);
                    const secs = Math.floor((diffMs % 60000) / 1000);

                    return (
                      <div key={batch.id} className="oven-batch-card shadow-xl shadow-orange-900/5">
                        <div className="flex gap-4 items-center mb-6">
                          <div className="oven-product-emoji">
                            {product?.emoji || '🥧'}
                          </div>
                          <div className="flex-1">
                            <h5 className="batch-title-lux">{batch.productName || 'Batch'}</h5>
                            <div className="batch-meta-row">
                               <span className="batch-yield-tag">Target: {batch.estimatedYield || 0} {batch.unit || 'pcs'}</span>
                               <span className="batch-timer-tag animate-pulse">
                                 <ChefHat size={12} /> {mins}m {secs}s
                               </span>
                            </div>
                          </div>
                          <div className="batch-time-tag">
                             {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <button 
                            className="finish-btn-elegant flex-1"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setKeypadMode('production');
                              setTempQty((batch.estimatedYield || 0).toString());
                              setShowQtyModal(true);
                            }}
                          >
                            Finish & Log
                          </button>
                          <button 
                            className="void-btn-elegant"
                            onClick={() => handleVoidBatch(batch.id)}
                            title="Abort Batch"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: History & Waste Log */}
          <div className="card-elegant">
            <div className="px-6 pt-6 flex items-center justify-between border-b border-mocha/5">
              <div className="flex gap-6">
                <button 
                  className={`history-tab ${historyTab === 'success' ? 'active' : ''}`}
                  onClick={() => setHistoryTab('success')}
                >
                  Production Logs
                </button>
                <button 
                  className={`history-tab ${historyTab === 'waste' ? 'active' : ''}`}
                  onClick={() => setHistoryTab('waste')}
                >
                  Waste & Spoilage
                </button>
              </div>
            </div>
            
            <div className="p-0">
               {history.length === 0 ? (
                 <div className="p-12 text-center opacity-30 italic text-sm">No recent records found in this category</div>
               ) : (
                 <div className="history-list">
                    {history.slice(0, 10).map(log => (
                      <div key={log.id} className="history-item">
                        <div className="history-icon-box">
                           {products.find(p => p.id === log.productId)?.emoji || '📌'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                             <span className="history-name">{log.productName || 'Batch'}</span>
                             <span className={`history-status-badge ${log.status}`}>
                               {log.status === 'ruined' ? 'WASTE' : 'SUCCESS'}
                             </span>
                          </div>
                          <div className="history-meta">
                             {log.status === 'ruined' ? (
                               <span className="text-red-500 font-bold">LOSS: {log.notes || 'Unspecified'}</span>
                             ) : (
                               <span>Produced {log.quantityProduced} {log.unit || 'pcs'}</span>
                             )}
                             <span className="mx-2">•</span>
                             <span>{new Date(log.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Right Side: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Batch Sidebar */}
          <div className="card-elegant flex-1 flex flex-col overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-mocha/5">
              <div className="flex items-center gap-3">
                <ChefHat size={20} className="text-mocha" />
                <h3 className="card-title-elegant">Studio Log</h3>
              </div>
              {activeBatch.length > 0 && (
                <button onClick={clearBatch} className="text-[10px] font-black uppercase text-red-500 hover:opacity-70 transition-opacity">
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeBatch.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                  <Scale size={48} strokeWidth={1} />
                  <p className="mt-4 text-sm font-bold">Select ingredients to prep batch</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeBatch.map((item, index) => (
                    <div key={item.materialId} className="sidebar-ingredient-card animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="w-10 h-10 bg-mocha-light rounded-xl flex items-center justify-center text-xl">
                        {item.emoji || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-mocha truncate">{item.materialName}</div>
                        <div className="text-[10px] font-bold text-sage">{item.quantityUsed} {item.unit}</div>
                      </div>
                      <button className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm" onClick={() => removeFromBatch(item.materialId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-cream/50 border-t border-mocha/5">
              <div className="mb-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-mocha/40">Target Product</label>
                  {!targetProduct ? (
                    <button className="w-full py-4 border-2 border-dashed border-mocha/10 rounded-2xl text-[11px] font-bold text-mocha/40 hover:border-mocha/30 hover:text-mocha/60 transition-all flex items-center justify-center gap-2" onClick={() => setShowProductModal(true)}>
                      <Plus size={16} /> Choose Product
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-mocha rounded-2xl text-white shadow-lg">
                      <span className="text-2xl">{targetProduct.emoji}</span>
                      <div className="flex-1">
                        <div className="text-[11px] font-black">{targetProduct.name}</div>
                        <div className="text-[9px] opacity-60 font-bold uppercase tracking-tighter">{targetProduct.unit || 'pcs'} target</div>
                      </div>
                      <button onClick={() => setTargetProduct(null)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-mocha/40">Expected Yield</label>
                  <div className="flex items-center bg-white rounded-2xl p-1 border border-mocha/5 shadow-inner" onClick={openProductionKeypad}>
                     <button className="w-12 h-12 rounded-xl text-mocha hover:bg-mocha-light transition-colors" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(Math.max(1, quantityToProduce - 1)); }}>
                       <Minus size={18} />
                     </button>
                     <div className="flex-1 text-center">
                        <span className="text-xl font-black text-mocha leading-none">{quantityToProduce}</span>
                        <span className="text-[9px] block font-bold text-mocha/30 uppercase">{targetProduct?.unit || 'pcs'}</span>
                     </div>
                     <button className="w-12 h-12 rounded-xl text-mocha hover:bg-mocha-light transition-colors" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(quantityToProduce + 1); }}>
                       <Plus size={18} />
                     </button>
                  </div>
                </div>
              </div>

              <button 
                className={`w-full py-5 rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl transition-all ${activeBatch.length === 0 || !targetProduct || isSaving ? 'bg-mocha/10 text-mocha/30 cursor-not-allowed' : 'bg-sage text-white shadow-sage/20 hover:shadow-sage/40 hover:-translate-y-1'}`}
                disabled={activeBatch.length === 0 || !targetProduct || isSaving}
                onClick={handleStartBatch}
              >
                {isSaving ? 'Processing...' : 'Place in Oven'}
              </button>
            </div>
          </div>

          {/* Alert Widget */}
          <div className="card-elegant overflow-hidden bg-red-50/50 border-red-100/50">
             <div className="p-4 bg-red-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Info size={16} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Spoilage Alerts</span>
                </div>
                {alerts.length > 0 && <span className="animate-ping w-2 h-2 bg-white rounded-full" />}
             </div>
             <div className="p-4 flex flex-col gap-3">
                {alerts.length === 0 ? (
                   <p className="text-[10px] italic text-red-400 text-center py-4">No recent production losses</p>
                ) : (
                   alerts.slice(0, 3).map(alert => (
                      <div key={alert.id} className="p-3 bg-white border border-red-100 rounded-xl shadow-sm animate-shake">
                         <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-mocha truncate">{alert.productName}</span>
                            <span className="text-[8px] font-bold text-red-500 uppercase">Ruined</span>
                         </div>
                         <p className="text-[9px] font-bold text-red-400 capitalize truncate">Reason: {alert.notes || 'Unknown'}</p>
                      </div>
                   ))
                )}
             </div>
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

      <style jsx>{`
        .card-elegant {
          background: white;
          border-radius: 32px;
          border: 1px solid rgba(74, 55, 40, 0.05);
          box-shadow: 0 10px 40px rgba(74, 55, 40, 0.03);
          display: flex;
          flex-direction: column;
        }
        .card-title-elegant {
          color: var(--mocha);
          font-size: 0.85rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .search-bar-elegant {
          background: #F8F5F2;
          padding: 10px 20px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #A0938A;
          border: 1px solid rgba(0,0,0,0.02);
        }
        .search-bar-elegant input { border: none; background: transparent; font-size: 0.8rem; font-weight: 700; width: 100%; outline: none; }
        
        .material-card-elegant {
          background: #FDFBF7;
          border-radius: 24px;
          border: 1px solid transparent;
          padding: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .material-card-elegant:hover {
          background: white;
          border-color: var(--mocha);
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(74, 55, 40, 0.08);
        }
        .material-visual { margin-bottom: 12px; }
        .material-emoji-lux { font-size: 2.2rem; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1)); }
        .material-name-lux { font-weight: 800; font-size: 0.75rem; color: var(--mocha); margin-bottom: 2px; }
        .material-stock-lux { font-size: 0.65rem; font-weight: 700; color: var(--sage); }
        .material-stock-lux.low { color: #ef4444; }
        .batch-check-elegant {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 24px;
          height: 24px;
          background: var(--mocha);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(74, 55, 40, 0.3);
          border: 2px solid white;
        }

        .glass-oven-header {
           background: rgba(255, 120, 0, 0.05);
           padding: 16px 32px;
           border-bottom: 1px solid rgba(255, 120, 0, 0.1);
           display: flex;
           justify-content: space-between;
           align-items: center;
        }
        .oven-batch-card {
           background: white;
           border-radius: 28px;
           padding: 24px;
           border: 1px solid rgba(0,0,0,0.03);
           transition: all 0.3s;
        }
        .oven-batch-card:hover { transform: translateY(-3px); }
        .oven-product-emoji {
           width: 56px;
           height: 56px;
           background: #FDFBF7;
           border-radius: 20px;
           display: flex;
           align-items: center;
           justify-content: center;
           font-size: 1.8rem;
           box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
        }
        .batch-title-lux { font-size: 1rem; font-weight: 900; color: var(--mocha); margin-bottom: 4px; }
        .batch-meta-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .batch-yield-tag { font-size: 10px; font-black uppercase tracking-tight text-accent bg-accent/10 px-2 py-0.5 rounded-lg; }
        .batch-timer-tag { font-size: 10px; font-black uppercase text-sage bg-sage/10 px-2 py-0.5 rounded-lg flex items-center gap-1.5; }
        .batch-time-tag { font-size: 10px; font-black text-mocha/30; }

        .finish-btn-elegant { 
           background: var(--sage); 
           color: white; 
           border: none; 
           padding: 16px; 
           border-radius: 18px; 
           font-size: 0.7rem; 
           font-weight: 900; 
           text-transform: uppercase; 
           letter-spacing: 0.1em; 
           cursor: pointer;
           transition: all 0.2s;
        }
        .finish-btn-elegant:hover { background: #7ca529; transform: scale(1.02); }
        .void-btn-elegant {
           background: #FFF5F5;
           color: #EF4444;
           border: 1px solid #FEE2E2;
           width: 52px;
           border-radius: 18px;
           cursor: pointer;
           transition: all 0.2s;
           display: flex;
           align-items: center;
           justify-content: center;
        }
        .void-btn-elegant:hover { background: #EF4444; color: white; }

        .history-tab {
           padding: 20px 0;
           font-size: 0.7rem;
           font-weight: 900;
           text-transform: uppercase;
           letter-spacing: 0.1em;
           color: #A0938A;
           border-bottom: 3px solid transparent;
           cursor: pointer;
           transition: all 0.2s;
        }
        .history-tab.active { color: var(--mocha); border-bottom-color: var(--mocha); }
        .history-item {
           padding: 20px 24px;
           display: flex;
           align-items: center;
           gap: 20px;
           border-bottom: 1px solid rgba(0,0,0,0.02);
           transition: background 0.2s;
        }
        .history-item:hover { background: #FDFBF7; }
        .history-icon-box {
           width: 44px;
           height: 44px;
           background: #F8F5F2;
           border-radius: 16px;
           display: flex;
           align-items: center;
           justify-content: center;
           font-size: 1.2rem;
        }
        .history-name { font-size: 0.85rem; font-weight: 800; color: var(--mocha); }
        .history-status-badge { font-size: 8px; font-weight: 900; padding: 4px 10px; border-radius: 50px; text-transform: uppercase; }
        .history-status-badge.completed { background: #DCFCE7; color: #166534; }
        .history-status-badge.ruined { background: #FEE2E2; color: #991B1B; }
        .history-meta { font-size: 0.7rem; font-weight: 600; color: #A0938A; margin-top: 2px; }

        .sidebar-ingredient-card {
           background: white;
           padding: 12px;
           border-radius: 18px;
           display: flex;
           align-items: center;
           gap: 12px;
           border: 1px solid rgba(0,0,0,0.02);
           box-shadow: 0 4px 10px rgba(0,0,0,0.01);
        }
        
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
          40%, 60% { transform: translate3d(3px, 0, 0); }
        }
      `}</style>
    </>
  );
}
