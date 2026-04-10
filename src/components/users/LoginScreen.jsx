import { useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

export default function LoginScreen() {
  const { users, login, loading, syncRequired } = useAuth();
  const { settings } = useSettings();
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showUserSwitch, setShowUserSwitch] = useState(false);

  const [scanning, setScanning] = useState(false);

  const handlePasswordSubmit = async () => {
    if (!pin || !activeUser) return;
    setError('');
    const success = await login(activeUser.id, pin);
    if (!success) {
      setError('Incorrect Password');
      setPin('');
    }
  };

  const handleFingerprint = async () => {
    if (!activeUser) return;
    setScanning(true);
    setError('');
    // Simulate biometric scan delay, then auto-login using stored pin
    setTimeout(async () => {
      setScanning(false);
      const success = await login(activeUser.id, activeUser.pin);
      if (!success) setError('Biometric authentication failed');
    }, 1500);
  };

  if (loading) {
    return <div className="login-screen"><div className="login-card">Loading...</div></div>;
  }

  const activeUser = selectedUser || users[0];

  return (
    <div className="login-screen">
      <div className="login-card">
        {settings.storeLogo ? (
          <img src={settings.storeLogo} alt="Logo" className="login-logo" style={{ background: '#fff', objectFit: 'contain', padding: 4 }} />
        ) : (
          <div className="login-logo">🧁</div>
        )}
        <h1>{settings.storeName}</h1>
        <p>Select your account and enter password</p>

        <div className="login-users">
          {syncRequired ? (
            <div className="sync-required-msg animate-fade-in">
              <div className="msg-icon">📡</div>
              <h3>Sync Required</h3>
              <p>This appears to be a new device or the local cache is empty.</p>
              <p><strong>Please connect to the internet once</strong> to sync the user accounts for offline use.</p>
              <button 
                className="btn btn-primary btn-block mt-4" 
                onClick={() => window.location.reload()}
              >
                Reload & Sync Now
              </button>
            </div>
          ) : showUserSwitch || !activeUser ? (
            <>
              <select
                className="select"
                style={{ width: '100%', padding: '12px', fontSize: '1.1rem', textAlign: 'center', marginBottom: 16, background: 'var(--bg-input)' }}
                value={activeUser?.id || ''}
                onChange={(e) => {
                  const u = users.find(x => x.id === e.target.value);
                  setSelectedUser(u);
                  setShowUserSwitch(false);
                  setPin('');
                  setError('');
                }}
              >
                <option value="" disabled>-- Select account --</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name} • {user.role}</option>
                ))}
              </select>
            </>
          ) : (
            <button
              className="login-user-btn selected"
              onClick={() => setShowUserSwitch(true)}
            >
              {activeUser.image ? (
                <img src={activeUser.image} alt={activeUser.name} className="avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="avatar">{activeUser.name.charAt(0)}</div>
              )}
              <span className="name">{activeUser.name}</span>
              <span className="switch-text">tap to switch</span>
            </button>
          )}
        </div>

        {!showUserSwitch && activeUser && (
          <div className="login-form-container" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input 
              type="password" 
              className="input" 
              placeholder="Enter Password" 
              style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: 4, padding: 12 }}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') handlePasswordSubmit(); }}
            />
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: 14 }}
                onClick={handlePasswordSubmit}
              >
                Login
              </button>
              <button 
                className={`btn btn-secondary ${scanning ? 'pulse-safe' : ''}`} 
                style={{ aspectRatio: '1', padding: 14, color: scanning ? 'var(--success)' : '' }}
                onClick={handleFingerprint}
                disabled={scanning}
                title="Fingerprint Login"
              >
                {scanning ? <Loader2 className="animate-spin" /> : <Fingerprint />}
              </button>
            </div>
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
      </div>
      <style jsx>{`
        .sync-required-msg {
          background: rgba(44, 24, 16, 0.05);
          padding: 24px;
          border-radius: var(--radius-lg);
          border: 1px dashed var(--accent);
          text-align: center;
        }
        .msg-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          display: block;
        }
        .sync-required-msg h3 {
          color: var(--accent);
          font-weight: 800;
          margin-bottom: 8px;
        }
        .sync-required-msg p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
