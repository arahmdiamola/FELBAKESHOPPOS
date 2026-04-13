import { useState, useMemo } from 'react';
import { Search, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import './LoginScreen.css';

export default function LoginScreen() {
  const { users, login, loading, syncRequired } = useAuth();
  const { settings } = useSettings();
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

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
            <div className="selected-user-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 16, marginBottom: 16 }}>
               {selectedUser.image ? (
                 <img src={selectedUser.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
               ) : (
                 <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{selectedUser.name.charAt(0)}</div>
               )}
               <div style={{ flex: 1, textAlign: 'left' }}>
                 <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{selectedUser.name}</div>
                 <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{selectedUser.role}</div>
               </div>
               <button className="btn-icon" onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}>
                 <X size={18} />
               </button>
            </div>

            {/* PIN Bubbles Display */}
            <div className={`pin-display ${error ? 'shake' : ''}`} style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
               {[...Array(4)].map((_, i) => (
                 <div key={i} className={`pin-bubble ${pin.length > i ? 'filled' : ''}`} />
               ))}
               {pin.length > 4 && [...Array(pin.length - 4)].map((_, i) => (
                 <div key={i + 4} className="pin-bubble filled" />
               ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="numeric-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} className="key-btn" onClick={() => { setError(''); setPin(p => p + num); }}>{num}</button>
              ))}
              <button className="key-btn secondary" onClick={() => { setPin(''); setError(''); }}>CLR</button>
              <button className="key-btn" onClick={() => { setError(''); setPin(p => p + '0'); }}>0</button>
              <button className="key-btn secondary" onClick={() => { setError(''); setPin(p => p.slice(0, -1)); }}>DEL</button>
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: 14, fontWeight: 800 }} 
                onClick={handlePasswordSubmit}
                disabled={!pin}
              >
                LOGIN
              </button>
            </div>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
