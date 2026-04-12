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
            <div className="card-header-elegant">
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
            
            <div className="card-content-elegant">
              <div className="materials-grid-elegant">
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
            <div className="card-elegant oven-monitor-container">
              <div className="glass-oven-header">
                  <div className="oven-header-left">
                    <div className="oven-dot" /> <span className="oven-label-main">Studio Oven Monitor</span>
                  </div>
                  <span className="oven-label-sub">{activeBatches.length} Batches Active</span>
              </div>
              
              <div className="oven-content-grid">
                <div className="batches-grid">
                  {activeBatches.map(batch => {
                    const product = products.find(p => p.id === batch.productId);
                    const startTime = new Date(batch.date);
                    const diffMs = Math.max(0, now - startTime);
                    const mins = Math.floor(diffMs / 60000);
                    const secs = Math.floor((diffMs % 60000) / 1000);

                    return (
                      <div key={batch.id} className="oven-batch-card">
                        <div className="batch-header-box">
                          <div className="oven-product-emoji">
                            {product?.emoji || '🥧'}
                          </div>
                          <div className="batch-core-info">
                            <h5 className="batch-title-lux">{batch.productName || 'Batch'}</h5>
                            <div className="batch-meta-row">
                               <span className="batch-yield-tag">Target: {batch.estimatedYield || 0} {batch.unit || 'pcs'}</span>
                               <span className="batch-timer-tag pulse-animation">
                                 <ChefHat size={12} /> {mins}m {secs}s
                               </span>
                            </div>
                          </div>
                          <div className="batch-time-tag">
                             {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        <div className="batch-action-row">
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
            <div className="history-tabs-header">
              <div className="tabs-container-lux">
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
            
            <div className="card-content-elegant no-padding">
               {history.length === 0 ? (
                 <div className="p-12 text-center opacity-30 italic text-sm">No recent records found in this category</div>
               ) : (
                 <div className="history-list">
                    {history.slice(0, 10).map(log => (
                      <div key={log.id} className="history-item">
                        <div className="history-icon-box">
                           {products.find(p => p.id === log.productId)?.emoji || '📌'}
                        </div>
                        <div className="history-info-box">
                          <div className="history-header-row">
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
                             <span className="meta-separator">•</span>
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
          <div className="card-elegant side-log-container">
            <div className="card-header-elegant">
              <div className="header-label-box">
                <ChefHat size={20} className="text-mocha" />
                <h3 className="card-title-elegant">Studio Log</h3>
              </div>
              {activeBatch.length > 0 && (
                <button onClick={clearBatch} className="clear-batch-btn">
                  Clear All
                </button>
              )}
            </div>

            <div className="side-log-content">
              {activeBatch.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                  <Scale size={48} strokeWidth={1} />
                  <p className="mt-4 text-sm font-bold">Select ingredients to prep batch</p>
                </div>
              ) : (
                <div className="sidebar-list-gap">
                  {activeBatch.map((item, index) => (
                    <div key={item.materialId} className="sidebar-ingredient-card animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="ingredient-icon-box">
                        {item.emoji || '📦'}
                      </div>
                      <div className="ingredient-info-box">
                        <div className="ingredient-name-lux">{item.materialName}</div>
                        <div className="ingredient-qty-lux">{item.quantityUsed} {item.unit}</div>
                      </div>
                      <button className="ingredient-remove-btn" onClick={() => removeFromBatch(item.materialId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="side-log-footer">
              <div className="footer-inputs-box">
                <div className="input-group-lux">
                  <label className="input-label-lux">Target Product</label>
                  {!targetProduct ? (
                    <button className="choose-product-btn-placeholder" onClick={() => setShowProductModal(true)}>
                      <Plus size={16} /> Choose Product
                    </button>
                  ) : (
                    <div className="selected-product-box">
                      <span className="product-visual-lux">{targetProduct.emoji}</span>
                      <div className="product-details-lux">
                        <div className="product-name-lux">{targetProduct.name}</div>
                        <div className="product-unit-lux">{targetProduct.unit || 'pcs'} target</div>
                      </div>
                      <button onClick={() => setTargetProduct(null)} className="product-reset-btn">
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="input-group-lux">
                  <label className="input-label-lux">Expected Yield</label>
                  <div className="yield-stepper-box" onClick={openProductionKeypad}>
                     <button className="stepper-btn" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(Math.max(1, quantityToProduce - 1)); }}>
                       <Minus size={18} />
                     </button>
                     <div className="stepper-display">
                        <span className="stepper-val">{quantityToProduce}</span>
                        <span className="stepper-unit">{targetProduct?.unit || 'pcs'}</span>
                     </div>
                     <button className="stepper-btn" onClick={(e) => { e.stopPropagation(); setQuantityToProduce(quantityToProduce + 1); }}>
                       <Plus size={18} />
                     </button>
                  </div>
                </div>
              </div>

              <button 
                className={`place-in-oven-btn ${activeBatch.length === 0 || !targetProduct || isSaving ? 'disabled' : ''}`}
                disabled={activeBatch.length === 0 || !targetProduct || isSaving}
                onClick={handleStartBatch}
              >
                {isSaving ? 'Processing...' : 'Place in Oven'}
              </button>
            </div>
          </div>

          {/* Alert Widget */}
          <div className="alert-widget-elegant">
             <div className="alert-header-lux">
                <div className="header-label-box">
                   <Info size={16} />
                   <span className="alert-label-main">Spoilage Alerts</span>
                </div>
                {alerts.length > 0 && <span className="alert-ping-dot" />}
             </div>
             <div className="alert-content-box">
                {alerts.length === 0 ? (
                   <p className="no-alerts-placeholder">No recent production losses</p>
                ) : (
                   alerts.slice(0, 3).map(alert => (
                      <div key={alert.id} className="spoilage-card-lux animate-shake">
                         <div className="spoilage-card-top">
                            <span className="spoilage-card-title truncate">{alert.productName}</span>
                            <span className="spoilage-card-status">Ruined</span>
                         </div>
                         <p className="spoilage-card-reason capitalize truncate">Reason: {alert.notes || 'Unknown'}</p>
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
          overflow: hidden;
        }
        .card-header-elegant {
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(74, 55, 40, 0.05);
        }
        .card-content-elegant {
          padding: 24px;
          flex: 1;
        }
        .card-title-elegant {
          color: var(--mocha);
          font-size: 0.85rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0;
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
          width: 200px;
        }
        .search-bar-elegant input { border: none; background: transparent; font-size: 0.8rem; font-weight: 700; width: 100%; outline: none; }
        
        .materials-grid-elegant {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 16px;
        }

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

        /* Oven Monitor Styles */
        .oven-monitor-container { background: linear-gradient(to bottom right, #fff, #FDFBF7); }
        .glass-oven-header {
           background: rgba(212, 118, 60, 0.05);
           padding: 16px 32px;
           border-bottom: 1px solid rgba(212, 118, 60, 0.1);
           display: flex;
           justify-content: space-between;
           align-items: center;
        }
        .oven-header-left { display: flex; align-items: center; gap: 12px; }
        .oven-dot { width: 8px; height: 8px; background: #D4763C; border-radius: 50%; animation: pulse-live 1.5s infinite; }
        .oven-label-main { font-weight: 900; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #D4763C; }
        .oven-label-sub { font-size: 10px; font-weight: 900; text-transform: uppercase; color: var(--mocha); opacity: 0.5; }
        
        .oven-content-grid { padding: 32px; background: radial-gradient(circle at top right, rgba(212, 118, 60, 0.03), transparent); }
        .batches-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
        
        .oven-batch-card {
           background: white;
           border-radius: 28px;
           padding: 24px;
           border: 1px solid rgba(0,0,0,0.03);
           transition: all 0.3s;
           box-shadow: 0 10px 30px rgba(212, 118, 60, 0.05);
        }
        .batch-header-box { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
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
        .batch-core-info { flex: 1; }
        .batch-title-lux { font-size: 1rem; font-weight: 900; color: var(--mocha); margin-bottom: 4px; }
        .batch-meta-row { display: flex; gap: 8px; }
        .batch-yield-tag { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: var(--accent); background: rgba(var(--accent-rgb), 0.1); padding: 2px 8px; border-radius: 8px; }
        .batch-timer-tag { font-size: 10px; font-weight: 900; text-transform: uppercase; color: var(--sage); background: rgba(var(--sage-rgb), 0.1); padding: 2px 8px; border-radius: 8px; display: flex; align-items: center; gap: 6px; }
        .batch-time-tag { font-size: 10px; font-weight: 900; color: var(--mocha); opacity: 0.3; margin-left: auto; }
        
        .batch-action-row { display: flex; gap: 12px; }
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
           flex: 1;
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

        .history-tabs-header { padding: 0 24px; border-bottom: 1px solid rgba(74, 55, 40, 0.05); }
        .tabs-container-lux { display: flex; gap: 24px; }
        .history-tab {
           padding: 24px 0;
           font-size: 0.7rem;
           font-weight: 900;
           text-transform: uppercase;
           letter-spacing: 0.1em;
           color: #A0938A;
           border-bottom: 3px solid transparent;
           background: none;
           border-left: none;
           border-right: none;
           border-top: none;
           cursor: pointer;
           transition: all 0.2s;
        }
        .history-tab.active { color: var(--mocha); border-bottom-color: var(--mocha); }
        .history-list { display: flex; flex-direction: column; }
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

        /* Sidebar Log Styles */
        .side-log-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .header-label-box { display: flex; align-items: center; gap: 12px; }
        .clear-batch-btn { background: none; border: none; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #ef4444; cursor: pointer; opacity: 0.8; }
        .clear-batch-btn:hover { opacity: 1; }
        
        .side-log-content { flex: 1; overflow-y: auto; padding: 24px; }
        .sidebar-list-gap { display: flex; flex-direction: column; gap: 12px; }
        .sidebar-ingredient-card {
           background: white;
           padding: 12px;
           border-radius: 18px;
           display: flex;
           align-items: center;
           gap: 12px;
           border: 1px solid rgba(0,0,0,0.02);
           box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }
        .ingredient-icon-box { width: 40px; height: 40px; background: #F8F5F2; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .ingredient-info-box { flex: 1; min-width: 0; }
        .ingredient-name-lux { font-size: 11px; font-weight: 900; color: var(--mocha); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ingredient-qty-lux { font-size: 10px; font-weight: 800; color: var(--sage); }
        .ingredient-remove-btn { width: 32px; height: 32px; border-radius: 10px; background: #FFF5F5; border: none; color: #ef4444; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .ingredient-remove-btn:hover { background: #ef4444; color: white; }

        .side-log-footer { padding: 24px; background: rgba(253, 251, 247, 0.5); border-top: 1px solid rgba(74, 55, 40, 0.05); }
        .footer-inputs-box { margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; }
        .input-group-lux { display: flex; flex-direction: column; gap: 8px; }
        .input-label-lux { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(74, 55, 40, 0.4); }
        
        .choose-product-btn-placeholder { width: 100%; padding: 16px; border: 2px dashed rgba(74, 55, 40, 0.1); border-radius: 20px; background: none; font-size: 11px; font-weight: 800; color: rgba(74, 55, 40, 0.4); cursor: pointer; transition: all 0.2s; border-radius: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .choose-product-btn-placeholder:hover { border-color: rgba(74, 55, 40, 0.3); color: rgba(74, 55, 40, 0.6); }
        
        .selected-product-box { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--mocha); border-radius: 20px; color: white; box-shadow: 0 10px 20px rgba(74, 55, 40, 0.2); }
        .product-visual-lux { font-size: 1.5rem; }
        .product-details-lux { flex: 1; }
        .product-name-lux { font-size: 11px; font-weight: 900; }
        .product-unit-lux { font-size: 9px; font-weight: 800; text-transform: uppercase; opacity: 0.6; }
        .product-reset-btn { width: 32px; height: 32px; border: none; background: rgba(255,255,255,0.1); border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .product-reset-btn:hover { background: rgba(255,255,255,0.2); }

        .yield-stepper-box { display: flex; align-items: center; background: white; border-radius: 20px; border: 1px solid rgba(74, 55, 40, 0.05); padding: 4px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.02); }
        .stepper-btn { width: 48px; height: 48px; border: none; background: none; color: var(--mocha); border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
        .stepper-btn:hover { background: #F8F5F2; }
        .stepper-display { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .stepper-val { font-size: 1.2rem; font-weight: 900; color: var(--mocha); line-height: 1; }
        .stepper-unit { font-size: 9px; font-weight: 800; text-transform: uppercase; color: rgba(74, 55, 40, 0.3); }
        
        .place-in-oven-btn { width: 100%; padding: 20px; background: var(--sage); color: white; border: none; border-radius: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; font-size: 12px; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 25px rgba(116, 151, 57, 0.2); }
        .place-in-oven-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(116, 151, 57, 0.3); }
        .place-in-oven-btn.disabled { background: rgba(74, 55, 40, 0.05); color: rgba(74, 55, 40, 0.2); box-shadow: none; cursor: not-allowed; transform: none; }
        
        /* Alert Widget */
        .alert-widget-elegant { border-radius: 32px; overflow: hidden; background: rgba(239, 68, 68, 0.02); border: 1px solid rgba(239, 68, 68, 0.08); }
        .alert-header-lux { padding: 16px 20px; background: #ef4444; color: white; display: flex; align-items: center; justify-content: space-between; }
        .alert-label-main { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
        .alert-ping-dot { width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse-live 1.2s infinite; }
        .alert-content-box { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .spoilage-card-lux { padding: 12px; background: white; border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .spoilage-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .spoilage-card-title { font-size: 10px; font-weight: 900; color: var(--mocha); }
        .spoilage-card-status { font-size: 8px; font-weight: 900; color: #ef4444; text-transform: uppercase; }
        .spoilage-card-reason { font-size: 9px; font-weight: 800; color: #A0938A; }
        
        .card-content-elegant.no-padding { padding: 0; }
        .history-info-box { flex: 1; }
        .history-header-row { display: flex; align-items: center; justify-content: space-between; }
        .meta-separator { margin: 0 8px; }

        .pulse-animation { animation: pulse-opacity 1.5s infinite; }
        @keyframes pulse-opacity {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
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
        @keyframes pulse-live {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
      `}</style>
    </>
  );
}
