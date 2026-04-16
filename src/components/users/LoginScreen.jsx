import { useState, useMemo } from 'react';
import { Search, X, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

export default function LoginScreen() {
  const { users, login, loading, syncRequired } = useAuth();
  const { settings } = useSettings();
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [devMode, setDevMode] = useState(false);
  const [devClicks, setDevClicks] = useState(0);

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
    let list = searchTerm 
      ? users.filter(u => 
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          u.role.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : users;

    // Secret Reveal: If devMode is triggered (7 logo clicks), inject the Dev User
    if (devMode) {
      list = [...list, {
        id: 'dev-001',
        name: 'System Developer',
        role: 'system_admin',
        pin: '9999',
        branch_id: null,
        image: null
      }];
    }
    return list;
  }, [users, searchTerm, devMode]);

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
        <div 
          onClick={() => {
            const newCount = devClicks + 1;
            setDevClicks(newCount);
            if (newCount >= 7) {
              setDevMode(true);
            }
          }}
          style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {settings.storeLogo ? (
            <img src={settings.storeLogo} alt="Logo" className="login-logo" style={{ background: '#fff', objectFit: 'contain', padding: 4 }} />
          ) : (
            <div className="login-logo">🧁</div>
          )}
        </div>
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
          right: 12px;
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

        /* Keypad Styles */
        .numeric-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 8px;
        }

        .key-btn {
          height: 60px;
          border-radius: 16px;
          border: 1px solid var(--border-light);
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .key-btn:active {
          transform: scale(0.92);
          background: var(--accent-light);
          border-color: var(--accent);
          color: var(--accent);
        }

        .key-btn.secondary {
          font-size: 0.9rem;
          color: var(--text-muted);
          background: var(--bg-secondary);
        }

        .pin-display {
           height: 48px;
           align-items: center;
        }

        .pin-bubble {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--border);
          transition: all 0.2s;
        }

        .pin-bubble.filled {
          background: var(--accent);
          border-color: var(--accent);
          transform: scale(1.1);
          box-shadow: 0 0 10px rgba(212, 118, 60, 0.3);
        }

        .shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
