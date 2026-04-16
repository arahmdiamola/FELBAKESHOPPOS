import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { v4 as uuidv4 } from 'uuid';
import Header from '../layout/Header';
import Modal from '../shared/Modal';
import { Shield, Key, Plus, Edit3, Trash2, UserPlus, Lock } from 'lucide-react';

const roleColors = {
  owner: 'badge-amber',
  admin: 'badge-blue',
  manager: 'badge-blue',
  cashier: 'badge-green',
  baker: 'badge-purple',
};

const emptyForm = { name: '', role: 'cashier', pin: '', branchId: '', image: '' };

import ProcessingOverlay from '../shared/ProcessingOverlay';

export default function UsersPage() {
  const { users, currentUser, addUser, updateUser, deleteUser, changePin } = useAuth();
  const { addToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    api.get('/branches').then(setBranches).catch(console.error);
  }, []);

  const canEdit = (targetUser) => {
    if (currentUser?.id === targetUser.id) return true;
    if (currentUser?.role === 'admin' || currentUser?.role === 'system_admin' || currentUser?.role === 'owner') return true;
    if (currentUser?.role === 'manager' && ['cashier', 'baker'].includes(targetUser.role)) return true;
    return false;
  };

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinUserId, setPinUserId] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // ── Add / Edit User ──
  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, branchId: currentUser?.role !== 'system_admin' ? currentUser?.branchId : '' });
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditing(user.id);
    setForm({ name: user.name, role: user.role, pin: '', branchId: user.branchId || '', image: user.image || '' });
    setShowForm(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(p => ({ ...p, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveUser = async () => {
    if (isProcessing) return;
    if (!form.name.trim()) {
      addToast('Name is required', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      if (editing) {
        await updateUser(editing, { name: form.name, role: form.role, branchId: form.branchId, image: form.image });
        addToast(`${form.name} updated`, 'success');
      } else {
        // New user — PIN required
        if (!form.pin.trim()) {
          addToast('Password cannot be empty', 'error');
          return;
        }
        // Validation: Only force a branch for non-global roles
        const needsBranch = !['system_admin', 'owner'].includes(form.role);
        if (currentUser?.role === 'system_admin' && !form.branchId && needsBranch) {
          addToast('Please assign a branch for this role', 'error');
          return;
        }
        const id = uuidv4();
        await addUser({ id, name: form.name, role: form.role, pin: form.pin, branchId: form.branchId || null, image: form.image });
        addToast(`${form.name} added!`, 'success');
      }
      setShowForm(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Delete User ──
  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      addToast("You can't delete yourself!", 'error');
      return;
    }
    if (users.filter(u => u.role === 'admin').length <= 1 && user.role === 'admin') {
      addToast('Must keep at least one admin', 'error');
      return;
    }
    if (confirm(`Delete user "${user.name}"? This cannot be undone.`)) {
      try {
        await deleteUser(user.id);
        addToast(`${user.name} deleted`, 'success');
      } catch (err) {
        addToast(err.message, 'error');
      }
    }
  };

  // ── Change PIN ──
  const openChangePin = (userId) => {
    setPinUserId(userId);
    setNewPin('');
    setConfirmPin('');
    setShowPinModal(true);
  };

  const savePin = async () => {
    if (isProcessing) return;
    if (!newPin.trim()) {
      addToast('Password cannot be empty', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      addToast('Passwords do not match', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      await changePin(pinUserId, newPin);
      setShowPinModal(false);
      addToast('Password changed successfully', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <ProcessingOverlay isProcessing={isProcessing} message="Saving User Profile..." />
      <Header
        title="User Management"
        subtitle={`${users.length} users`}
        actions={
          <button className="btn btn-primary" onClick={openAdd}>
            <UserPlus size={16} /> Add User
          </button>
        }
      />
      <div className="page-content animate-fade-in">
        {/* User Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {users.map(user => (
            <div key={user.id} className="card" style={{ borderTop: `3px solid var(--accent)` }}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                {user.image ? (
                  <img src={user.image} alt={user.name} style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', objectFit: 'cover', margin: '0 auto 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'var(--accent-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 'var(--font-xl)', fontWeight: 800, margin: '0 auto 12px',
                    boxShadow: '0 4px 12px rgba(212,118,60,0.3)',
                  }}>
                    {user.name.charAt(0)}
                  </div>
                )}
                <h3 style={{ fontWeight: 800, fontSize: 'var(--font-md)' }}>
                  {user.name}
                  {currentUser?.id === user.id && <span className="text-xs text-muted"> (You)</span>}
                </h3>
                {user.branchId && (
                  <div className="text-sm text-muted mt-1">
                    🏢 {branches.find(b => b.id === user.branchId)?.name || 'Unknown Branch'}
                  </div>
                )}
                <span className={`badge ${roleColors[user.role] || 'badge-gray'}`} style={{ marginTop: 8 }}>
                  <Shield size={12} /> {user.role}
                </span>
                <div className="flex items-center justify-center gap-1 mt-4 text-sm text-muted">
                  <Key size={14} /> Password: {'•'.repeat(8)}
                </div>

                {/* Action buttons */}
                {canEdit(user) && (
                  <div className="flex gap-2 justify-center mt-4" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(user)}>
                      <Edit3 size={14} /> Edit
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openChangePin(user.id)}>
                      <Lock size={14} /> Password
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(user)}
                      disabled={user.id === currentUser?.id}
                      style={user.id === currentUser?.id ? { opacity: 0.3 } : {}}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Role Permissions Table */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Role Permissions</h3></div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead><tr><th>Feature</th><th>Owner</th><th>Admin</th><th>Manager</th><th>Cashier</th></tr></thead>
              <tbody>
                <tr><td className="primary">POS Register</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                <tr><td className="primary">Dashboard (All Branches)</td><td>✅</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td className="primary">Baking & Production</td><td>✅</td><td>✅</td><td>✅</td><td>❌</td></tr>
                <tr><td className="primary">Inventory Management</td><td>✅</td><td>✅</td><td>✅</td><td>View Only</td></tr>
                <tr><td className="primary">Raw Materials</td><td>✅</td><td>✅</td><td>✅</td><td>View Only</td></tr>
                <tr><td className="primary">Pre-Orders</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                <tr><td className="primary">Expenses</td><td>✅</td><td>✅</td><td>✅</td><td>❌</td></tr>
                <tr><td className="primary">User Management</td><td>✅</td><td>✅</td><td>❌</td><td>❌</td></tr>
                <tr><td className="primary">System Settings</td><td>✅</td><td>✅</td><td>❌</td><td>❌</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit User' : 'Add New User'}
        footer={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={isProcessing}>Cancel</button>
            <button className={`btn btn-primary ${isProcessing ? 'loading' : ''}`} onClick={saveUser} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : (editing ? 'Update User' : 'Create User')}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>Profile Picture</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.image && <img src={form.image} alt="Preview" style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', objectFit: 'cover' }} />}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="input" style={{ flex: 1 }} />
              {form.image && <button className="btn btn-ghost" onClick={() => setForm(p => ({ ...p, image: '' }))} title="Remove image" style={{ padding: 8 }}><Trash2 size={16}/></button>}
            </div>
          </div>
          <div className="input-group">
            <label>Full Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Maria Santos"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Role *</label>
            <select className="select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="baker">Baker</option>
              <option value="admin">Admin</option>
              <option value="owner">Global Owner</option>
              {/* STRICTOR SECURITY: Only show developer role if logged in as the master dev ID */}
              {currentUser?.id === 'dev-001' && <option value="system_admin">System Admin (Developer)</option>}
            </select>
          </div>
          <div className="input-group">
            <label>Designated Branch {currentUser?.role !== 'system_admin' ? '(Locked)' : '*'}</label>
            <select 
              className="select" 
              value={form.branchId} 
              onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
              disabled={currentUser?.role !== 'system_admin'}
            >
              <option value="">-- No Branch (Global) --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {currentUser?.role !== 'system_admin' && (
              <span className="text-xs text-muted">You can only create users for your own branch.</span>
            )}
          </div>
          {!editing && (
            <div className="input-group">
              <label>Password *</label>
              <input
                className="input"
                type="password"
                value={form.pin}
                onChange={e => setForm(p => ({ ...p, pin: e.target.value }))}
                placeholder="Enter Password"
                style={{ fontSize: 'var(--font-lg)', textAlign: 'center' }}
              />
              <span className="text-xs text-muted">This will be used to log into the POS</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Change Password"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setShowPinModal(false)} disabled={isProcessing}>Cancel</button>
            <button className={`btn btn-primary ${isProcessing ? 'loading' : ''}`} onClick={savePin} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Save New Password'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>New Password</label>
            <input
              className="input"
              type="password"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="Enter new password"
              style={{ fontSize: 'var(--font-lg)', textAlign: 'center' }}
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Confirm Password</label>
            <input
              className="input"
              type="password"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Re-enter password"
              style={{ fontSize: 'var(--font-lg)', textAlign: 'center' }}
            />
            {confirmPin.length > 0 && confirmPin !== newPin && (
              <span style={{ color: 'var(--danger)', fontSize: 'var(--font-xs)', fontWeight: 700 }}>Passwords do not match</span>
            )}
            {confirmPin.length === 4 && confirmPin === newPin && (
              <span style={{ color: 'var(--success)', fontSize: 'var(--font-xs)', fontWeight: 700 }}>✓ PINs match</span>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
