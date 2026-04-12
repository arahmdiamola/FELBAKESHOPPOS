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
  const [targetProduct, setTargetProduct] = useState(null);
  const [quantityToProduce, setQuantityToProduce] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [tempQty, setTempQty] = useState('');

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

  const filteredMaterials = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q));
  }, [materials, search]);

  const addToBatch = (material) => {
    setSelectedMaterial(material);
    setTempQty('');
    setShowQtyModal(true);
  };

  const confirmAdd = () => {
    const qty = parseFloat(tempQty);
    if (!qty || qty <= 0) return addToast('Please enter a valid quantity', 'error');

    setActiveBatch(prev => {
      const existing = prev.find(item => item.materialId === selectedMaterial.id);
      if (existing) {
        return prev.map(item => item.materialId === selectedMaterial.id 
          ? { ...item, quantityUsed: item.quantityUsed + qty } 
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

      await api.post('/api/production/log', payload);
      
      addToast(`Success! Logged production of ${quantityToProduce} ${targetProduct.name}`, 'success');
      
      // Reset State
      setActiveBatch([]);
      setTargetProduct(null);
      setQuantityToProduce(1);
      fetchMaterials(); // Refresh stock levels
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSaving(false);
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
          
          <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {filteredMaterials.map(m => (
                <button 
                  key={m.id}
                  className="card hover-scale"
                  onClick={() => addToBatch(m)}
                  style={{ 
                    padding: '16px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border-light)',
                    background: 'var(--card-bg)', transition: 'all 0.2s', position: 'relative'
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{m.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-xs)', color: 'var(--text-main)', marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: '0.7rem', color: m.stock <= m.reorderPoint ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {m.stock} {m.unit}
                  </div>
                  {activeBatch.some(item => item.materialId === m.id) && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--success)', color: 'white', borderRadius: 'full', padding: 2 }}>
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Batch Summary */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', border: '2px solid var(--border-light)' }}>
          <div className="card-header flex items-center gap-4" style={{ background: 'var(--accent)', color: 'white' }}>
            <ChefHat size={20} />
            <h3 className="card-title" style={{ color: 'white' }}>Active Baking Log</h3>
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

          <div style={{ padding: 16, borderTop: '2px dashed var(--border-light)', background: 'var(--card-bg)' }}>
            <div className="input-group mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2">1. What are you baking?</label>
              <select 
                className="select" 
                value={targetProduct?.id || ''} 
                onChange={e => setTargetProduct(products.find(p => p.id === e.target.value))}
                style={{ fontWeight: 800 }}
              >
                <option value="">-- Choose Product --</option>
                {products.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-muted mb-2">2. Quantity Produced ({targetProduct?.unit || 'pcs'})</label>
              <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl">
                 <button 
                   className="btn btn-secondary btn-sm p-2" 
                   onClick={() => setQuantityToProduce(Math.max(1, quantityToProduce - 1))}
                   style={{ height: 40, width: 40 }}
                 >
                   <Minus size={20} />
                 </button>
                 <input 
                   type="number" 
                   className="text-center bg-transparent border-none font-black text-2xl w-full" 
                   value={quantityToProduce}
                   onChange={e => setQuantityToProduce(parseFloat(e.target.value) || 0)}
                 />
                 <button 
                   className="btn btn-secondary btn-sm p-2" 
                   onClick={() => setQuantityToProduce(quantityToProduce + 1)}
                   style={{ height: 40, width: 40 }}
                 >
                   <Plus size={20} />
                 </button>
              </div>
            </div>

            <button 
              className={`btn btn-primary w-full py-4 text-xl font-black uppercase tracking-widest shadow-lg ${isSaving ? 'loading' : ''}`}
              disabled={activeBatch.length === 0 || !targetProduct || isSaving}
              onClick={handleFinishBaking}
              style={{ display: 'flex', gap: 12, justifyContent: 'center', height: 'auto' }}
            >
              {isSaving ? 'Logging Batch...' : (
                <>
                  <Save size={24} /> Finish Baking
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Touch-Friendly Quantity Modal */}
      <Modal 
        isOpen={showQtyModal} 
        onClose={() => setShowQtyModal(false)}
        title={`Add ${selectedMaterial?.name}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ textAlign: 'center', fontSize: '3rem', background: 'var(--bg-main)', padding: 20, borderRadius: 16, fontWeight: 900, color: 'var(--accent)' }}>
            {tempQty || '0'} <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-muted)' }}>{selectedMaterial?.unit}</span>
          </div>
          
          {/* Numeric Keypad Simulation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
              <button 
                key={n} 
                className="btn btn-secondary" 
                style={{ height: 60, fontSize: 'var(--font-lg)', fontWeight: 800 }}
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
            Add to Batch
          </button>
        </div>
      </Modal>

      <style>{`
        .pos-container {
          background-color: var(--bg-main);
        }
        .hover-scale:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(212,118,60,0.15) !important;
          border-color: var(--accent) !important;
        }
        .pos-container input::-webkit-outer-spin-button,
        .pos-container input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </>
  );
}
