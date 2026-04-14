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
import './BakingPage.css';

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
  const [historyTab, setHistoryTab] = useState('success'); 
  const [alerts, setAlerts] = useState([]);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [keypadMode, setKeypadMode] = useState('material'); 
  const [tempQty, setTempQty] = useState('');
  const [activeTab, setActiveTab] = useState('prep'); // 'prep' or 'oven'

  useEffect(() => {
    fetchMaterials();
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
      const res = await api.get('/production/active-batches');
      // v1.2.21: Handle both raw array and diagnostic object structure
      const data = res.batches || res; 
      setActiveBatches(Array.isArray(data) ? data : []);
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

  const handleConfirmQuantity = () => {
    if (selectedMaterial && selectedMaterial.productName) {
      // Expected Yield case
      setQuantityToProduce(parseFloat(tempQty) || 1);
    } else if (selectedMaterial) {
      // Material ingredient case
      const qtyUsed = parseFloat(tempQty) || 0;
      setActiveBatch(prev => {
        const existing = prev.find(i => (i.materialId || i.id) === selectedMaterial.id);
        if (existing) {
          return prev.map(i => (i.materialId || i.id) === selectedMaterial.id ? { ...i, quantityUsed: qtyUsed } : i);
        }
        return [...prev, { 
          materialId: selectedMaterial.id, 
          materialName: selectedMaterial.name,
          quantityUsed: qtyUsed,
          unit: selectedMaterial.unit,
          emoji: selectedMaterial.emoji
        }];
      });
    }
    setShowQtyModal(false);
    setSelectedMaterial(null);
    setTempQty('');
  };

  const handleStartBatch = async () => {
    if (activeBatch.length === 0) return addToast('Please add ingredients first', 'error');
    if (!targetProduct) return addToast('Please select what you are baking', 'error');
    
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
        bakerId: currentUser?.id,
        bakerName: currentUser?.name,
        branchId: currentUser?.branchId,
        status: 'in_oven'
      };

      await api.post('/production/log', payload);
      addToast(`Batch for ${targetProduct.name} is now IN THE OVEN 🥧`, 'success');
      
      setActiveBatch([]);
      setTargetProduct(null);
      setQuantityToProduce(1);
      setActiveTab('oven'); // v1.2.18 AUTO-SWITCH: Show the oven immediately
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
      addToast('Batch Ruined. Spoilage Alert sent to Manager.', 'warning');
      fetchActiveBatches();
      fetchHistory();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <>
      <Header />
      <div className="studio-container">
        {/* Mobile Navbar */}
        <div className="baking-mobile-nav">
           <button className={`nav-btn ${activeTab === 'prep' ? 'active' : ''}`} onClick={() => setActiveTab('prep')}>
              <Scale size={18} /> PREPARATION
           </button>
           <button className={`nav-btn ${activeTab === 'oven' ? 'active' : ''}`} onClick={() => setActiveTab('oven')}>
              <ChefHat size={18} /> LIVE OVEN
           </button>
        </div>

        {/* Sidebar: Ingredients & Assembly */}
        <div className={`sidebar-studio ${activeTab !== 'prep' ? 'mobile-hidden' : ''}`}>
           <div className="sidebar-header">
              <h1 className="studio-heading">Ingredients</h1>
              <div className="studio-search">
                 <Search size={18} />
                 <input 
                    placeholder="Search materials..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                 />
              </div>
           </div>

           <div className="sidebar-scroll">
              <div className="material-grid">
                 {filteredMaterials.map(m => (
                    <button 
                       key={m.id}
                       className={`material-item ${activeBatch.find(i => i.materialId === m.id) ? 'active' : ''}`}
                       onClick={() => addToBatch(m)}
                    >
                       <span className="material-emoji">{m.emoji}</span>
                       <div className="material-details">
                          <span className="material-name">{m.name}</span>
                          <span className={`material-stock ${m.stock <= m.reorder_point ? 'low' : ''}`}>
                             {m.stock} {m.unit}
                          </span>
                       </div>
                    </button>
                 ))}
              </div>
           </div>

           <div className="studio-sidebar-footer">
              <div className="assembly-card">
                 <div className="assembly-title">Batch Assembly</div>
                 <div className="assembly-list">
                    {activeBatch.length === 0 ? (
                       <div className="empty-msg">No ingredients selected</div>
                    ) : (
                       activeBatch.map(item => (
                          <div key={item.materialId} className="assembly-item">
                             <span className="item-name">{item.name}</span>
                             <span className="item-qty">{item.quantity} {item.unit}</span>
                             <button className="item-del" onClick={() => setActiveBatch(prev => prev.filter(i => i.materialId !== item.materialId))}>
                                <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                             </button>
                          </div>
                       ))
                    )}
                 </div>
                 
                 <div className="assembly-config">
                    <label>Target Product</label>
                    <button 
                       className={`product-picker ${targetProduct ? 'picked' : ''}`}
                       onClick={() => setShowProductModal(true)}
                    >
                       {targetProduct ? (
                          <><span className="mini-emoji">{targetProduct.emoji}</span> {targetProduct.name}</>
                       ) : 'Choose Product...'}
                    </button>

                    <label>Expected Yield</label>
                    <div className="yield-stepper">
                      <button onClick={() => setQuantityToProduce(Math.max(1, quantityToProduce - 1))}><Minus size={14} /></button>
                    <div 
                      className="yield-num" 
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedMaterial({ productName: targetProduct?.name || 'Batch', unit: targetProduct?.unit || 'pcs' });
                        setTempQty(quantityToProduce.toString());
                        setShowQtyModal(true);
                      }}
                    >
                      {quantityToProduce}
                    </div>
                      <button onClick={() => setQuantityToProduce(quantityToProduce + 1)}><Plus size={14} /></button>
                    </div>

                    <button 
                       className="bake-btn" 
                       disabled={!targetProduct || activeBatch.length === 0 || isSaving}
                       onClick={handleStartBatch}
                    >
                       {isSaving ? 'Processing...' : 'Place in Oven'}
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Workspace: Oven & History */}
        <div className={`workspace-studio ${activeTab !== 'oven' ? 'mobile-hidden' : ''}`}>
           {/* Section 1: LIVE OVEN */}
           <div className="oven-monitor-glass">
              <div className="oven-header">
                 <div className="oven-status">
                    <div className="pulse-dot" /> LIVE OVEN MONITOR
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                       SIGNAL: {activeBatches.length}
                    </span>
                    <button 
                       onClick={fetchActiveBatches}
                       style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                    >RE-SYNC</button>
                 </div>
              </div>
              
              <div className="oven-grid">
                 {activeBatches.length === 0 ? (
                    <div className="oven-empty">
                       <ChefHat size={60} />
                       <h3>Oven is currently empty</h3>
                       <p>Start a new batch from the assembly sidebar to begin production.</p>
                    </div>
                 ) : (
                    activeBatches.map(batch => {
                       const elapsed = Math.floor((now - new Date(batch.date)) / 1000);
                       const m = Math.floor(elapsed / 60);
                       const s = elapsed % 60;
                       return (
                          <div key={batch.id} className="batch-card">
                             <div className="batch-header">
                                <div className="batch-emoji">{products.find(p => p.id === batch.productId)?.emoji || '🧁'}</div>
                                <div className="batch-info">
                                   <h4>{batch.productName}</h4>
                                   <div className="batch-meta">
                                      <span className="meta-yield">{batch.estimatedYield} {batch.unit}</span>
                                      <span className="meta-time pulse-text"><ChefHat size={14} /> {m}m {s}s</span>
                                   </div>
                                </div>
                             </div>
                             <div className="batch-ops">
                                <button className="finish-btn" onClick={() => {
                                   setSelectedBatch(batch);
                                   setTargetProduct(products.find(p => p.id === batch.productId));
                                   setTempQty(batch.estimatedYield.toString());
                                   setKeypadMode('production');
                                   setShowQtyModal(true);
                                }}>Finish</button>
                                <button className="void-btn" onClick={() => handleVoidBatch(batch.id)}><Trash2 size={18} /></button>
                             </div>
                          </div>
                       )
                    })
                 )}
              </div>
           </div>

           {/* Section 2: Production Logs */}
           <div className="history-studio">
              <div className="history-tabs">
                 <button className={`tab-btn ${historyTab === 'success' ? 'active' : ''}`} onClick={() => setHistoryTab('success')}>Success Logs</button>
                 <button className={`tab-btn ${historyTab === 'waste' ? 'active' : ''}`} onClick={() => setHistoryTab('waste')}>Spoilage Logs</button>
              </div>
              <div className="history-list">
                 {history.length === 0 ? (
                    <div className="history-empty">No activity found</div>
                 ) : (
                    history.map(log => (
                       <div key={log.id} className="history-row">
                          <span className="history-emoji">{products.find(p => p.id === log.productId)?.emoji || '🥧'}</span>
                          <div className="history-main">
                             <div className="history-top">
                                <span className="history-name">{log.productName}</span>
                                <span className={`history-badge ${log.status}`}>{log.status === 'ruined' ? 'WASTE' : 'PRODUCED'}</span>
                             </div>
                             <div className="history-meta">
                                <span>Yield: {log.quantityProduced} {log.unit}</span>
                                <span>•</span>
                                <span>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             </div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>

           {/* Alerts Footer */}
           {alerts.length > 0 && (
              <div className="alerts-strip-studio">
                 <div className="alert-count"><Info size={16} /> Spoilage Alerts</div>
                 <div className="alert-ticker">
                    {alerts.map(a => (
                       <span key={a.id} className="ticker-item">
                          <strong>{a.productName}</strong>: {a.notes || 'Ruined'}
                       </span>
                    ))}
                 </div>
              </div>
           )}
        </div>
      </div>

      <Modal isOpen={showProductModal} onClose={() => setShowProductModal(false)} title="Select Production Target">
         <div className="product-selection-grid">
            {products.map(p => (
               <button key={p.id} className="p-item" onClick={() => { setTargetProduct(p); setShowProductModal(false); }}>
                  <div className="p-emoji">{p.emoji}</div>
                  <div className="p-name">{p.name}</div>
               </button>
            ))}
         </div>
      </Modal>

      <Modal isOpen={showQtyModal} onClose={() => setShowQtyModal(false)} title={keypadMode === 'production' ? 'Confirm Final Yield' : 'Enter Quantity'}>
         <div className="keypad-ux">
            <div className="keypad-screen">
               <div className="val">{tempQty || '0'}<span className="unit">{selectedMaterial?.unit || 'kg'}</span></div>
            </div>
            <div className="keypad-btns">
               {[1,2,3,4,5,6,7,8,9,'.',0].map(n => (
                  <button key={n} onClick={() => setTempQty(prev => prev + n)}>{n}</button>
               ))}
               <button className="key-clear" onClick={() => setTempQty('')}>
                 <RotateCcw size={20} />
               </button>
            </div>
            <button className="confirm-btn-ux" style={{ marginTop: '20px' }} onClick={handleConfirmQuantity}>
              Confirm Action
            </button>
         </div>
      </Modal>

    </>
  );
}
