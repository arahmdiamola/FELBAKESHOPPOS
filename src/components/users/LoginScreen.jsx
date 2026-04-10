import { useState, useRef, useEffect, useCallback } from 'react';
import { Fingerprint, Loader2, Delete, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

export default function LoginScreen() {
  const { users, login, loading, syncRequired } = useAuth();
  const { settings } = useSettings();
  const [activeUserIndex, setActiveUserIndex] = useState(0);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const carouselRef = useRef(null);

  const activeUser = users[activeUserIndex] || users[0];

  // Auto-detect active user on scroll snap
  const handleScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const itemWidth = 110 + 24; // width + gap from CSS
    const index = Math.round(scrollLeft / itemWidth);
    if (index !== activeUserIndex && index >= 0 && index < users.length) {
      setActiveUserIndex(index);
      setPin('');
      setError('');
    }
  }, [activeUserIndex, users.length]);

  const handleKeyClick = (val) => {
    if (pin.length < 6) {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 4) { // Auto-submit if PIN is 4 digits? Usually bakeries use 4.
         // handleAutoSubmit(newPin); 
      }
    }
  };

  const handleDelete = () => setPin(prev => prev.slice(0, -1));
  const handleClear = () => setPin('');

  const submitLogin = async (finalPin) => {
    if (!activeUser || isAuthenticating) return;
    setIsAuthenticating(true);
    setError('');
    const success = await login(activeUser.id, finalPin || pin);
    if (!success) {
      setError('Incorrect Password');
      setPin('');
    }
    setIsAuthenticating(false);
  };

  useEffect(() => {
    if (pin.length >= 4) {
        // Optional: Auto-submit on 4/6 digits depending on store config
    }
  }, [pin]);

  if (loading) {
    return <div className="login-screen"><div className="glass-panel"><Loader2 className="animate-spin" /> Loading Users...</div></div>;
  }

  return (
    <div className="login-screen">
      <div className="glass-panel">
        <div className="login-brand">
          <div className="login-logo-xl">
             {settings.storeLogo ? (
               <img src={settings.storeLogo} alt="Logo" style={{ width: 100, height: 100, objectFit: 'contain' }} />
             ) : '🧁'}
          </div>
          <h1 className="store-title">{settings.storeName || 'FEL Bakeshop'}</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Swipe to select account</p>
        </div>

        {syncRequired ? (
          <div className="text-center p-6" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20 }}>
             <h3 style={{ color: '#fff' }}>Sync Required</h3>
             <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Please connect to internet once to load accounts.</p>
             <button className="btn btn-primary mt-4 w-full" onClick={() => window.location.reload()}>Reload</button>
          </div>
        ) : (
          <>
            <div 
                className="user-carousel" 
                ref={carouselRef}
                onScroll={handleScroll}
            >
              {/* Spacer for centering first item */}
              <div style={{ flex: '0 0 auto', width: 'calc(50% - 67px)' }}></div>
              
              {users.map((user, idx) => (
                <div key={user.id} className={`user-snap-item ${idx === activeUserIndex ? 'active' : ''}`}>
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="user-avatar-large" />
                  ) : (
                    <div className="user-avatar-large">{user.name.charAt(0)}</div>
                  )}
                  <span className="user-name">{user.name}</span>
                </div>
              ))}

              {/* Spacer for centering last item */}
              <div style={{ flex: '0 0 auto', width: 'calc(50% - 67px)' }}></div>
            </div>

            <div className="pin-indicator">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className={`dot ${pin.length > i ? 'active' : ''}`}></div>
                ))}
            </div>

            <div className="pin-pad-grid">
               {[1,2,3,4,5,6,7,8,9].map(n => (
                   <button key={n} className="pin-btn" onClick={() => handleKeyClick(n.toString())}>{n}</button>
               ))}
               <button className="pin-btn btn-action" onClick={handleClear}><X size={20} /></button>
               <button className="pin-btn" onClick={() => handleKeyClick('0')}>0</button>
               <button className="pin-btn btn-action" onClick={handleDelete}><Delete size={20} /></button>
            </div>

            <button 
                className="btn btn-primary mt-8 w-full" 
                style={{ padding: '16px', borderRadius: '30px', fontSize: '1.1rem' }}
                disabled={pin.length < 4 || isAuthenticating}
                onClick={() => submitLogin()}
            >
                {isAuthenticating ? <Loader2 className="animate-spin" /> : 'Sign In'}
            </button>
            
            {error && <div className="login-error-msg">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
