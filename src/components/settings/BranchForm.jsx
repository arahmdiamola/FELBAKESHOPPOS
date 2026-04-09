import { useState, useEffect } from 'react';
import Modal from '../shared/Modal';

export default function BranchForm({ isOpen, onClose, onSave, branch }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (branch) {
      setName(branch.name || '');
      setAddress(branch.address || '');
    } else {
      setName('');
      setAddress('');
    }
  }, [branch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave({ name, address });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={branch ? 'Edit Branch' : 'Add New Branch'}>
      <form onSubmit={handleSubmit} className="animate-fade-in">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label>Branch Name *</label>
            <input 
              className="input" 
              placeholder="e.g. Makati Branch"
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              autoFocus
            />
          </div>

          <div className="input-group">
            <label>Address</label>
            <textarea 
              className="input" 
              placeholder="Street or Area"
              value={address} 
              onChange={e => setAddress(e.target.value)} 
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : 'Save Branch'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
