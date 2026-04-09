import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import Header from '../layout/Header';
import { Save, RotateCcw, Store, Receipt, Percent, Database, MapPin, Edit2, Trash2, Plus } from 'lucide-react';
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

  const fetchBranches = async () => {
    try {
      const data = await api.get('/api/branches');
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
        await api.put(`/api/branches/${editingBranch.id}`, branchData);
        addToast('Branch updated successfully', 'success');
      } else {
        await api.post('/api/branches', branchData);
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
      await api.del(`/api/branches/${id}`);
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

  const save = () => {
    updateSettings(form);
    addToast('Settings saved!', 'success');
  };

  const handleReset = () => {
    if (confirm('⚠️ This will clear ALL data and reset the app. Are you sure?')) {
      resetData();
    }
  };

  const handleExport = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('fel_')) {
        data[key] = JSON.parse(localStorage.getItem(key));
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fel-bakeshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Data exported successfully', 'success');
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
                <div className="flex items-center justify-between" style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div className="font-bold">Export Data</div>
                    <div className="text-sm text-muted">Download all your data as JSON backup</div>
                  </div>
                  <button className="btn btn-secondary" onClick={handleExport}>
                    <Database size={16} /> Export
                  </button>
                </div>
                <div className="flex items-center justify-between" style={{ padding: 16, background: 'var(--danger-light)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--danger)' }}>Reset All Data</div>
                    <div className="text-sm text-muted">Delete all products, transactions, customers, and expenses</div>
                  </div>
                  <button className="btn btn-danger" onClick={handleReset}>
                    <RotateCcw size={16} /> Reset
                  </button>
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
    </>
  );
}
