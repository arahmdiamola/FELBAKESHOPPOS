import { useState, useMemo } from 'react';
import { Fingerprint, Loader2, Search, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

export default function LoginScreen() {
  const { users, login, loading, syncRequired } = useAuth();
  const { settings } = useSettings();
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  // Get recent users from localStorage
  const recentIds = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('fel_recent_users') || '[]');
    } catch { return []; }
  }, []);

  const quickPicks = useMemo(() => {
    return users.filter(u => recentIds.includes(u.id))
      .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
  }, [users, recentIds]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handlePasswordSubmit = async () => {
    if (!pin || !selectedUser) return;
    setError('');
    const success = await login(selectedUser.id, pin);
    if (!success) {
      setError('Incorrect Password');
      setPin('');
    }
  };

  const handleFingerprint = async () => {
    if (!selectedUser) return;
    setScanning(true);
    setError('');
    setTimeout(async () => {
      setScanning(false);
      const success = await login(selectedUser.id, selectedUser.pin);
      if (!success) setError('Biometric authentication failed');
    }, 1500);
  };

  if (loading) {
    return <div className="login-screen"><div className="login-card">Loading...</div></div>;
  }

  return (
    <div className="login-screen">
      <div className="login-card" style={{ width: '400px', maxWidth: '95vw' }}>
        {settings.storeLogo ? (
          <img src={settings.storeLogo} alt="Logo" className="login-logo" style={{ background: '#fff', objectFit: 'contain', padding: 4 }} />
        ) : (
          <div className="login-logo">🧁</div>
        )}
        <h1>{settings.storeName}</h1>
        
        {syncRequired ? (
          <div className="sync-required-msg animate-fade-in">
            <div className="msg-icon">📡</div>
            <h3>Sync Required</h3>
            <p>Please connect to the internet to sync accounts.</p>
            <button className="btn btn-primary btn-block mt-4" onClick={() => window.location.reload()}>Reload Now</button>
          </div>
        ) : !selectedUser ? (
          <div className="user-selection-area animate-fade-in">
            <p style={{ marginBottom: 16 }}>Select your account</p>
            
            {/* Quick Picks for frequent users */}
            {quickPicks.length > 0 && !searchTerm && (
              <div className="quick-picks" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                {quickPicks.map(u => (
                  <button key={u.id} className="quick-pick-btn" onClick={() => setSelectedUser(u)}>
                    {u.image ? (
                      <img src={u.image} alt={u.name} />
                    ) : (
                      <div className="avatar-placeholder">{u.name.charAt(0)}</div>
                    )}
                    <span>{u.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search Bar */}
            <div className="search-container" style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input 
                type="text" 
                className="input" 
                placeholder="Search your name..." 
                style={{ paddingLeft: 40, width: '100%', borderRadius: 12 }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && <X size={18} className="clear-search" onClick={() => setSearchTerm('')} />}
            </div>

            {/* Scrollable User List */}
            <div className="user-scroll-list" style={{ maxHeight: '250px', overflowY: 'auto', textAlign: 'left', borderRadius: 12, border: '1px solid var(--border-light)' }}>
              {filteredUsers.length > 0 ? filteredUsers.map(u => (
                <div key={u.id} className="user-list-item" onClick={() => setSelectedUser(u)}>
                   <div className="item-avatar">
                     {u.image ? <img src={u.image} alt="" /> : <span>{u.name.charAt(0)}</span>}
                   </div>
                   <div className="item-info">
                     <span className="name">{u.name}</span>
                     <span className="role">{u.role}</span>
                   </div>
                </div>
              )) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
              )}
            </div>
          </div>
        ) : (
          <div className="password-area animate-fade-in">
            <div className="selected-user-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 16, marginBottom: 20 }}>
               {selectedUser.image ? (
                 <img src={selectedUser.image} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
               ) : (
                 <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{selectedUser.name.charAt(0)}</div>
               )}
               <div style={{ flex: 1, textAlign: 'left' }}>
                 <div style={{ fontWeight: 800, fontSize: '1rem' }}>{selectedUser.name}</div>
                 <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{selectedUser.role}</div>
               </div>
               <button className="btn-icon" onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}>
                 <X size={18} />
               </button>
            </div>

            <input 
              type="password" 
              className="input" 
              placeholder="Enter Password" 
              autoFocus
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: 4, padding: 12, width: '100%' }}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') handlePasswordSubmit(); }}
            />
            
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: 14 }} onClick={handlePasswordSubmit}>Login</button>
              <button className={`btn btn-secondary ${scanning ? 'pulse-safe' : ''}`} style={{ aspectRatio: '1', padding: 14 }} onClick={handleFingerprint} disabled={scanning}>
                {scanning ? <Loader2 className="animate-spin" /> : <Fingerprint />}
              </button>
            </div>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>

      <style jsx>{`
        .quick-pick-btn {
          background: transparent;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .quick-pick-btn:hover { transform: translateY(-2px); }
        .quick-pick-btn img, .avatar-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid transparent;
          transition: border-color 0.2s;
        }
        .quick-pick-btn:hover img, .quick-pick-btn:hover .avatar-placeholder { border-color: var(--accent); }
        .avatar-placeholder {
          background: var(--accent-soft);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
        }
        .quick-pick-btn span { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); }

        .clear-search {
          position: absolute;
          right: 12,
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          cursor: pointer;
        }

        .user-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-light);
          transition: background 0.2s;
        }
        .user-list-item:hover { background: var(--bg-hover); }
        .user-list-item:last-child { border-bottom: none; }
        .item-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          overflow: hidden;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: bold;
          color: var(--text-tertiary);
        }
        .item-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .item-info { display: flex; flex-direction: column; line-height: 1.2; }
        .item-info .name { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); }
        .item-info .role { font-size: 0.7rem; color: var(--text-muted); text-transform: capitalize; }

        .btn-icon {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
        }
        .btn-icon:hover { color: var(--danger); }
      `}</style>
    </div>
  );
}
