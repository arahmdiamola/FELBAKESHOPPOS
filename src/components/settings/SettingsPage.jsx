import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { Save, RotateCcw, Store, Receipt, Percent, Database, MapPin, Edit2, Trash2, Plus, AlertTriangle, CheckCircle, Smartphone, Star, TrendingUp, List, History, Upload, DownloadCloud, ShieldCheck, Lock } from 'lucide-react';
import BranchForm from './BranchForm';
import { useSafetyShield } from '../../hooks/useSafetyShield';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { settings, updateSettings, resetData } = useSettings();
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('store');
  
  // Licensing State Helpers
  const currentFeatures = (() => {
    try {
      return typeof form.license_features === 'string' 
        ? JSON.parse(form.license_features) 
        : (form.license_features || []);
    } catch (e) { return []; }
  })();

  const toggleFeature = (featureKey) => {
    const updated = currentFeatures.includes(featureKey)
      ? currentFeatures.filter(f => f !== featureKey)
      : [...currentFeatures, featureKey];
    
    setForm(p => ({ ...p, license_features: JSON.stringify(updated) }));
  };

  const [branches, setBranches] = useState([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isMasterResetting, setIsMasterResetting] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const { lastBackupTime, triggerBackupDownload } = useSafetyShield();
  
  const [resetTargets, setResetTargets] = useState({
    transactions: false,
    products: false,
    customers: false,
    expenses: false,
    preorders: false,
    systemLogs: false,
    syncQueue: false
  });

  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const data = await api.get('/logs?limit=200');
      setSystemLogs(data);
    } catch (e) {
      addToast('Failed to load logs', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Safety Shield: Force backup before overwrite
    addToast('SAFETY SHIELD: Securing current data before restore...', 'info');
    const backupResult = await triggerBackupDownload('RECOVERY_PRE_RESTORE');
    if (!backupResult) {
       addToast('SAFETY SHIELD ERROR: Could not secure a backup. Restore aborted for your safety.', 'error');
       return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        if (!confirm("CRITICAL WARNING: This will DELETE all current data and replace it with this backup. Proceed? (A safety backup has been downloaded to your folder)")) return;
        
        setIsRestoring(true);
        await api.post('/restore', backupData);
        addToast('System Restored Successfully! Refreshing...', 'success');
        
        localStorage.clear(); 
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        addToast(`Restore failed: ${err.message}`, 'error');
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

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

    // Safety Shield: Force backup before wipe
    addToast('SAFETY SHIELD: Securing current data before reset...', 'info');
    const backupResult = await triggerBackupDownload('RECOVERY_PRE_RESET');
    if (!backupResult) {
       addToast('SAFETY SHIELD ERROR: Could not secure a backup. Reset aborted for your safety.', 'error');
       return;
    }

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

  const handleMasterReset = async () => {
    if (!confirm("🚨 EXTREME CAUTION: This will PERMANENTLY DELETE all Sales, Expenses, Customers, and Production Logs. ONLY Staff Accounts and Your Product Menu will remain. Inventory counts will be reset to 0. Proceed?")) return;
    
    const doubleCheck = prompt('Type "I_AM_SURE" to confirm this operation:');
    if (doubleCheck !== 'I_AM_SURE') {
      addToast('Reset cancelled: Confirmation mismatch.', 'warning');
      return;
    }

    // Safety Shield
    addToast('SAFETY SHIELD: Securing final state before master reset...', 'info');
    await triggerBackupDownload('FINAL_STATE_PRE_MASTER_RESET');

    setIsMasterResetting(true);
    try {
      await api.post('/admin/selective-reset', { confirm: 'I_AM_SURE' });
      addToast('Selective System Reset Successful! Users Preserved. Refreshing...', 'success');
      
      // Clear all local caches
      localStorage.removeItem('fel_active_branch');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      addToast(`Reset Failed: ${err.message}`, 'error');
    } finally {
      setIsMasterResetting(false);
    }
  };

   const handleDownloadBackup = () => {
    addToast('Preparing backup...', 'info');
    triggerBackupDownload('manual');
    addToast('Backup downloaded successfully', 'success');
  };

  const getActionColor = (action) => {
    if (action.includes('SALE')) return { bg: 'rgba(46, 204, 113, 0.1)', text: '#27ae60' };
    if (action.includes('PRODUCT') || action.includes('EXPENSE')) return { bg: 'rgba(52, 152, 219, 0.1)', text: '#2980b9' };
    if (action.includes('SYSTEM') || action.includes('RESTORE') || action.includes('RESET')) return { bg: 'rgba(231, 76, 60, 0.1)', text: '#c0392b' };
    if (action.includes('SETTINGS')) return { bg: 'rgba(155, 89, 182, 0.1)', text: '#8e44ad' };
    return { bg: 'rgba(149, 165, 166, 0.1)', text: '#7f8c8d' };
  };

  const formatLogDetails = (log) => {
    if (!log.details) return 'No details';
    try {
      const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      
      switch(log.action) {
        case 'SALE_COMPLETED':
          return `Receipt #${d.receiptNumber || 'N/A'} • Total: ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(d.total || 0)}`;
        case 'PRODUCT_UPDATED':
          return `Stock update: ${d.name || 'Product'} now at ${d.stock || 0}`;
        case 'EXPENSE_RECORDED':
          return `${d.category || 'Expense'}: ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(d.amount || 0)}`;
        case 'SETTINGS_UPDATED':
          return `Modified: ${d.updatedKeys?.join(', ') || 'Global settings'}`;
        case 'SYSTEM_RESTORE':
          return `Restored system from backup (TS: ${d.backupTimestamp})`;
        default:
          return typeof d === 'object' ? JSON.stringify(d) : String(d);
      }
    } catch (e) {
      return String(log.details);
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
          
          {currentUser?.role === 'system_admin' && (
            <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => { setActiveTab('logs'); fetchLogs(); }}>
              <History size={14} style={{ marginRight: 6 }} />Logs
            </button>
          )}

          {currentUser?.role === 'system_admin' && (
            <button className={`tab ${activeTab === 'licensing' ? 'active' : ''}`} onClick={() => setActiveTab('licensing')}>
              <ShieldCheck size={14} style={{ marginRight: 6 }} />Licensing
            </button>
          )}
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
                <div className="input-group">
                  <label className="flex items-center gap-2"><TrendingUp size={14} /> Daily Sales Goal (₱)</label>
                  <input className="input" type="number" value={form.branchGoal} onChange={e => setForm(p => ({ ...p, branchGoal: e.target.value }))} />
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
                    <div className="font-bold flex items-center gap-2">
                       <DownloadCloud size={18} className="text-success" />
                       Database Backup
                    </div>
                    <div className="text-sm text-muted mt-1">Export your entire empire's data to a .json file for safe-keeping.</div>
                    {lastBackupTime ? (
                      <div className="text-[10px] mt-2 flex items-center gap-1 font-bold" style={{ color: (Date.now() - new Date(lastBackupTime).getTime()) > 86400000 ? 'var(--warning)' : 'var(--success)' }}>
                         <CheckCircle size={10} /> LAST SECURED: {new Date(lastBackupTime).toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-[10px] mt-2 text-red-500 font-bold flex items-center gap-1">
                         <AlertTriangle size={10} /> SYSTEM UNSECURED: Please download a backup
                      </div>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={handleDownloadBackup}>
                    Download Full Backup
                  </button>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                       <Upload size={18} className="text-blue-500" />
                       System Restore
                    </div>
                    <div className="text-sm text-muted mt-1">Upload a .json backup to revert the entire system state. <span className="text-red-500 font-bold">DANGER: Wipes current data.</span></div>
                  </div>
                  <div>
                    <input type="file" id="restore-input" hidden accept=".json" onChange={handleRestoreBackup} />
                    <button className="btn btn-secondary" onClick={() => document.getElementById('restore-input').click()} disabled={isRestoring}>
                      {isRestoring ? 'Restoring...' : 'Upload & Restore'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 16, background: 'rgba(231, 76, 60, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(231, 76, 60, 0.1)' }}>
                  <div>
                    <div className="font-bold text-red-600">Selective System Reset</div>
                    <div className="text-sm text-muted">Cautiously wipe specific categories while keeping user accounts.</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => setIsResetModalOpen(true)}>
                    <RotateCcw size={16} /> Open Reset Tool
                  </button>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 16, background: 'rgba(231, 76, 60, 0.1)', borderRadius: 'var(--radius-md)', border: '2px dashed var(--danger)' }}>
                  <div>
                    <div className="font-bold text-red-700 uppercase tracking-tighter">Master Operational Reset</div>
                    <div className="text-xs text-muted mt-1">Purge ALL operational data (Sales, Logs, Customers, Expenses). <br/><span className="font-bold text-red-600">Preserves Staff Accounts (Users) and your Product Menu.</span></div>
                  </div>
                  <button className="btn btn-danger" onClick={handleMasterReset} disabled={isMasterResetting}>
                    {isMasterResetting ? 'Processing...' : 'Perform FULL Operational Wipe'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && currentUser?.role === 'system_admin' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold m-0 flex items-center gap-3">
                  <History size={24} className="text-blue-500" /> System Audit Logs
                </h2>
                <p className="text-muted text-sm mt-1">Comprehensive trace of all important system changes.</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchLogs} disabled={isLoadingLogs}>
                {isLoadingLogs ? 'Refreshing...' : 'Refresh Logs'}
              </button>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '12px' }}>Time</th>
                      <th style={{ padding: '12px' }}>User</th>
                      <th style={{ padding: '12px' }}>Action</th>
                      <th style={{ padding: '12px' }}>Details</th>
                      <th style={{ padding: '12px' }}>Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemLogs.length === 0 ? (
                      <tr><td colSpan="5" className="text-center p-10 text-muted">No logs recorded yet.</td></tr>
                    ) : (
                      systemLogs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-[11px] text-muted whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleDateString()}<br/>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-gray-800">{log.userName || 'System'}</div>
                            <div className="text-[10px] text-muted font-mono">{log.userId?.slice(0,8)}</div>
                          </td>
                          <td className="p-3">
                            <span style={{ 
                              padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '900', 
                              backgroundColor: getActionColor(log.action).bg, color: getActionColor(log.action).text,
                              textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-[12px] text-gray-700 leading-snug">
                               {formatLogDetails(log)}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                               <MapPin size={12} className="text-muted" />
                               <div className="text-[12px] font-semibold">
                                 {log.branchName || 'Global / System'}
                               </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'licensing' && currentUser?.role === 'system_admin' && (
          <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold m-0 flex items-center gap-3">
                  <ShieldCheck size={24} className="text-indigo-600" /> Empire Feature Licensing
                </h2>
                <p className="text-muted text-sm mt-1">Gatekeeping Control: Enable or restrict premium modules for this installation.</p>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-indigo-50 border-indigo-100 mb-4" style={{ background: 'rgba(79, 70, 229, 0.05)', borderRadius: 12, padding: 16, border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                <div className="flex gap-4 items-start">
                  <Lock className="text-indigo-600 mt-1" size={20} />
                  <div>
                    <div className="font-bold text-indigo-900">Developer Offering Model</div>
                    <div className="text-xs text-indigo-700 leading-relaxed mt-1">
                      Modules checked below will be visible to the Owner and staff. Uncheck a module to restrict access (useful for tiered subscriptions or phase-based rollouts). 
                      <strong> Note:</strong> You (System Developer) will always see all features for maintenance.
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'module_pos', label: 'POS Register (Core)', desc: 'The heart of sales and receipt generation.' },
                    { id: 'module_dashboard', label: 'Store Dashboard (Core)', desc: 'Daily stats, recent sales, and branch goals.' },
                    { id: 'module_mission_control', label: 'Mission Control (Executive)', desc: 'Sub-second real-time SSE alerting and total revenue pulse.', premium: true },
                    { id: 'module_analytics', label: 'Analytics Studio (Reports)', desc: 'Historical charts, comparative insights, and data exports.', premium: true },
                    { id: 'module_bakery', label: 'Baking & Raw Materials', desc: 'Inventory sync, batch logs, and materials tracking.', premium: true },
                    { id: 'module_data_reset', label: 'System Reset Tools', desc: 'Ability to wipe data. Powerful and dangerous.', premium: true },
                  ].map(f => (
                    <label key={f.id} className={`flex items-start gap-4 p-4 border rounded-xl transition-all cursor-pointer hover:shadow-md ${currentFeatures.includes(f.id) ? 'bg-white border-indigo-200 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                       <input 
                         type="checkbox" 
                         className="checkbox mt-1" 
                         checked={currentFeatures.includes(f.id)} 
                         onChange={() => toggleFeature(f.id)}
                       />
                       <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-sm text-gray-900">{f.label}</span>
                             {f.premium && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">Premium</span>}
                          </div>
                          <div className="text-xs text-muted mt-0.5">{f.desc}</div>
                       </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card-footer mt-6">
                <div className="text-xs text-muted italic flex items-center justify-center gap-2">
                  <AlertTriangle size={12} /> Changes here impact the Sidebar visibility for all non-developer users.
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

            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" style={{ margin: 0 }}>
              <input type="checkbox" className="checkbox" checked={resetTargets.systemLogs} onChange={e => setResetTargets(p => ({ ...p, systemLogs: e.target.checked }))} />
              <div>
                <div className="font-bold text-sm">System Activity Logs</div>
                <div className="text-xs text-muted">Wipes the audit trail of all staff actions and login history.</div>
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
