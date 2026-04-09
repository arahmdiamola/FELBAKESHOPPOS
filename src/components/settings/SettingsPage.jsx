import { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import Header from '../layout/Header';
import { Save, RotateCcw, Store, Receipt, Percent, Database } from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, resetData } = useSettings();
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('store');

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
            <Store size={14} style={{ marginRight: 6 }} />Store Info
          </button>
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
    </>
  );
}
