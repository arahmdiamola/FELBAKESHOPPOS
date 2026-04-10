import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { Save, RotateCcw, Store, Receipt, Percent, Database, MapPin, Edit2, Trash2, Plus, AlertTriangle, CheckCircle, Smartphone, Star, TrendingUp } from 'lucide-react';
import BranchForm from './BranchForm';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { settings, updateSettings, resetData } = useSettings();
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('store');

  const [branches, setBranches] = useState([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Selective Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargets, setResetTargets] = useState({
    transactions: true,
    products: false,
    customers: false,
    expenses: true,
    preorders: false,
    syncQueue: false
  });
  const [isResetting, setIsResetting] = useState(false);

  const fetchBranches = async () => {
    try {
      const data = await api.get('/branches');
      setBranches(data);
    } catch (e) {
      console.error(e);
      addToast('Failed to load branches', 'error');
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'system_admin' && activeTab === 'branches') {
      fetchBranches();
    }
  }, [currentUser, activeTab]);

  const handleSaveBranch = async (branchData) => {
    try {
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, branchData);
        addToast('Branch updated successfully', 'success');
      } else {
        await api.post('/branches', branchData);
        addToast('Branch created successfully', 'success');
      }
      fetchBranches();
    } catch (e) {
      addToast(e.message, 'error');
      throw e; // keep modal open if error
    }
  };

  const handleDeleteBranch = async (id, name) => {
    if (!confirm(`Are you sure you want to permanently delete the ${name} branch?`)) return;
    try {
      await api.del(`/branches/${id}`);
      addToast('Branch deleted successfully', 'success');
      fetchBranches();
    } catch (e) {
      addToast(e.message, 'error');
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(p => ({ ...p, storeLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const save = async () => {
    await updateSettings(form);
    addToast('Settings saved!', 'success');
  };

  const handlePerformReset = async () => {
    const targets = Object.keys(resetTargets).filter(k => resetTargets[k]);
    if (targets.length === 0) {
      addToast('Please select at least one category to reset', 'error');
      return;
    }

    if (!confirm(`CAUTION: You are about to permanently delete ${targets.join(', ')}. This cannot be undone. Proceed?`)) return;

    setIsResetting(true);
    try {
      await resetData(targets);
      addToast('System reset successfully', 'success');
      setIsResetModalOpen(false);
    } catch (e) {
      addToast(e.message || 'Reset failed', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Header title="Settings" subtitle="Configure your bakeshop" actions={
        <button className="btn btn-primary" onClick={save}><Save size={16} /> Save Changes</button>
      } />
      <div className="page-content animate-fade-in">
        <div className="tabs">
          <button className={`tab ${activeTab === 'store' ? 'active' : ''}`} onClick={() => setActiveTab('store')}>
            <Store size={18} /> Store Info
          </button>
          
          {currentUser?.role === 'system_admin' && (
            <button className={`tab ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>
              <MapPin size={18} /> Branches
            </button>
          )}

          <button className={`tab ${activeTab === 'receipt' ? 'active' : ''}`} onClick={() => setActiveTab('receipt')}>
            <Receipt size={14} style={{ marginRight: 6 }} />Receipt
          </button>
          <button className={`tab ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>
            <Percent size={14} style={{ marginRight: 6 }} />Tax
          </button>
          <button className={`tab ${activeTab === 'promos' ? 'active' : ''}`} onClick={() => setActiveTab('promos')}>
            <Star size={14} style={{ marginRight: 6 }} />Promos & VIP
          </button>
          <button className={`tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
            <Database size={14} style={{ marginRight: 6 }} />Data
          </button>
        </div>

        {activeTab === 'store' && (
          <div className="card">
            <div className="card-body">
              <div className="form-grid">
                <div className="input-group">
                  <label>Store Name</label>
                  <input className="input" value={form.storeName} onChange={e => setForm(p => ({ ...p, storeName: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label>Phone</label>
                  <input className="input" value={form.storePhone} onChange={e => setForm(p => ({ ...p, storePhone: e.target.value }))} />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <input className="input" value={form.storeAddress} onChange={e => setForm(p => ({ ...p, storeAddress: e.target.value }))} />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Store Logo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {form.storeLogo ? (
                      <img src={form.storeLogo} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🧁</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="input" style={{ width: 'auto' }} />
                      {form.storeLogo && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({ ...p, storeLogo: '' }))} style={{ alignSelf: 'flex-start' }}>Remove</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'receipt' && (
          <div className="card">
            <div className="card-body">
              <div className="input-group">
                <label>Receipt Footer Message</label>
                <textarea className="input" rows={3} value={form.receiptFooter} onChange={e => setForm(p => ({ ...p, receiptFooter: e.target.value }))} />
              </div>
              <div className="mt-4" style={{ maxWidth: 300, margin: '20px auto 0' }}>
                <div className="receipt-preview">
                  <div className="receipt-header">
                    {form.storeLogo && (
                      <img src={form.storeLogo} alt="Logo" style={{ width: 48, height: 48, objectFit: 'contain', margin: '0 auto 8px', display: 'block', filter: 'grayscale(100%)' }} />
                    )}
                    <h2>{form.storeName}</h2>
                    <div>{form.storeAddress}</div>
                    <div>{form.storePhone}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>— receipt items here —</div>
                  <div className="receipt-footer">{form.receiptFooter}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentUser?.role === 'system_admin' && activeTab === 'branches' && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Manage Branches</h2>
              <button className="btn btn-primary" onClick={() => {
                setEditingBranch(null);
                setIsBranchModalOpen(true);
              }}>
                <Plus size={16} /> Add Branch
              </button>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Branch Name</th>
                      <th>Address</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.id}>
                        <td className="font-bold">{b.name}</td>
                        <td className="text-muted">{b.address || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-icon" onClick={() => {
                              setEditingBranch(b);
                              setIsBranchModalOpen(true);
                            }}>
                              <Edit2 size={16} />
                            </button>
                            <button className="btn btn-icon btn-danger" onClick={() => handleDeleteBranch(b.id, b.name)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {branches.length === 0 && (
                  <div className="empty-state">No branches configured yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="card">
            <div className="card-body">
              <div className="form-grid">
                <div className="input-group">
                  <label className="flex items-center gap-2">
                    <Percent size={14} /> Flash Sale Discount (%)
                  </label>
                  <input 
                    className="input" 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={form.flashSalePercent} 
                    onChange={e => setForm(p => ({ ...p, flashSalePercent: parseFloat(e.target.value) || 0 }))} 
                  />
                  <div className="text-xs text-muted mt-1">
                    The discount percentage applied when the end-of-day toggle is active at the register.
                  </div>
                </div>

                <div className="input-group">
                  <label className="flex items-center gap-2">
                    <Star size={14} /> VIP Regular Threshold
                  </label>
                  <input 
                    className="input" 
                    type="number" 
                    min="1" 
                    value={form.vipThreshold} 
                    onChange={e => setForm(p => ({ ...p, vipThreshold: parseInt(e.target.value) || 1 }))} 
                  />
                  <div className="text-xs text-muted mt-1">
                    The number of orders a customer needs to earn a "Regular" status and gold star.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="card">
            <div className="card-body">
              <div className="input-group" style={{ maxWidth: 300 }}>
                <label>Tax Rate (%)</label>
                <input className="input" type="number" min="0" max="100" step="0.5"
                  value={form.taxRate}
                  onChange={e => setForm(p => ({ ...p, taxRate: parseFloat(e.target.value) || 0 }))}
                />
                <span className="text-sm text-muted">Set to 0 to disable tax</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="flex items-center justify-between" style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div className="font-bold flex items-center gap-2">
                       <Smartphone size={18} className="text-accent" />
                       Native Mobile App Experience
                    </div>
                    <div className="text-sm text-muted mt-1">Hide the browser address bar and run FEL POS in full-screen.</div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                       <div className="p-2 border rounded bg-white text-xs">
                          <div className="font-bold mb-1">iPhone / iPad</div>
                          Tap the <span className="font-bold">Share</span> icon (square with arrow) and select <span className="font-bold">"Add to Home Screen"</span>.
                       </div>
                       <div className="p-2 border rounded bg-white text-xs">
                          <div className="font-bold mb-1">Android / Tablet</div>
                          Tap the <span className="font-bold">3-dots</span> menu or <span className="font-bold">"Install App"</span> prompt in your browser.
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="font-bold">System Backup</div>
                    <div className="text-sm text-muted">Download a complete snapshot of all products, sales, and customers.</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => window.location.href = '/api/backup-full'}>
                    <Database size={16} /> Download Backup
                  </button>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 16, background: 'rgba(231, 76, 60, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(231, 76, 60, 0.1)' }}>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--danger)' }}>Selective System Reset</div>
                    <div className="text-sm text-muted">Cautiously wipe specific categories. Your user accounts are safe.</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => setIsResetModalOpen(true)}>
                    <RotateCcw size={16} /> Open Reset Tool
                  </button>
                </div>

                <div style={{ marginTop: 20, padding: 16, borderLeft: '4px solid #F1C40F', background: 'rgba(241, 196, 15, 0.05)', fontSize: '14px' }}>
                  <strong>Note:</strong> Wiping data is permanent. User accounts (logins) and branch setups are protected from this tool for your safety.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BranchForm 
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onSave={handleSaveBranch}
        branch={editingBranch}
      />

      <Modal 
        isOpen={isResetModalOpen} 
        onClose={() => !isResetting && setIsResetModalOpen(false)} 
        title="System Reset Control Panel"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button className="btn btn-secondary" onClick={() => setIsResetModalOpen(false)} disabled={isResetting}>Cancel</button>
            <button className="btn btn-danger" onClick={handlePerformReset} disabled={isResetting}>
              {isResetting ? 'Resetting...' : 'Permanently Delete Selected'}
            </button>
          </div>
        }
      >
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(231, 76, 60, 0.08)', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid rgba(231, 76, 60, 0.2)' }}>
            <AlertTriangle className="text-red-500" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              <span className="font-bold" style={{ color: 'var(--danger)' }}>CRITICAL ACTION:</span> Selecting these categories based on your needs. This will wipe all data from both the Cloud and this Device.
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.transactions} onChange={e => setResetTargets(p => ({ ...p, transactions: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">Sales & Transactions</div>
                <div className="text-xs text-muted">Wipes all ledger entries, receipts, and revenue data.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.products} onChange={e => setResetTargets(p => ({ ...p, products: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">Inventory & Products</div>
                <div className="text-xs text-muted">Wipes all cakes, breads, and categories.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.customers} onChange={e => setResetTargets(p => ({ ...p, customers: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">Customer Profiles</div>
                <div className="text-xs text-muted">Wipes customer names, balances, and history.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.expenses} onChange={e => setResetTargets(p => ({ ...p, expenses: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">Expenses</div>
                <div className="text-xs text-muted">Wipes all expenditure records.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.preorders} onChange={e => setResetTargets(p => ({ ...p, preorders: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">Pre-orders</div>
                <div className="text-xs text-muted">Wipes all active and pending advance orders.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-amber-50 cursor-pointer transition-colors" style={{ margin: 0, borderColor: 'var(--amber)' }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.syncQueue} onChange={e => setResetTargets(p => ({ ...p, syncQueue: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--amber-dark)' }}>Offline Sync Queue (Repair)</div>
                <div className="text-xs text-muted">Clears stuck transactions that are failing to sync. Use this if you see sync errors.</div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div className="text-xs font-bold flex items-center justify-center gap-2" style={{ color: 'var(--success)' }}>
              <CheckCircle size={14} /> User Accounts & Branches are protected and will NOT be deleted.
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
