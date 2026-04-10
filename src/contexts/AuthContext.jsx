import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { idb } from '../utils/idb';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fel_currentUser')) || null; } catch { return null; }
  });
  const [activeBranch, setActiveBranch] = useState(() => localStorage.getItem('fel_active_branch') || 'all');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncRequired, setSyncRequired] = useState(false);

  const switchBranch = (branchId) => {
    setActiveBranch(branchId);
    localStorage.setItem('fel_active_branch', branchId);
  };

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get('/users');
      if (data && data.length > 0) {
        setUsers(data);
        setSyncRequired(false);
      } else {
        throw new Error('Empty user list');
      }
    } catch (e) {
      if (e.message === 'OFFLINE_CACHE_EMPTY') {
        setSyncRequired(true);
      }
      console.warn('[Auth] User fetch failed:', e.message);
      // Try IDB fallback anyway, just in case
      try {
        const cached = await idb.getAll('cache_users');
        if (cached && cached.length > 0) {
          setUsers(cached);
          setSyncRequired(false);
        }
      } catch (idbError) {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const login = async (userId, pin) => {
    const isOnline = navigator.onLine;

    // --- CASE 1: Online Login ---
    if (isOnline) {
      try {
        const user = await api.post('/auth/login', { id: userId, pin });
        if (user) {
          setCurrentUser(user);
          localStorage.setItem('fel_currentUser', JSON.stringify(user));
          
          // Cache for offline login
          await idb.put('cache_users', { ...user, cachedPin: pin, lastLogin: Date.now() });

          const initialBranch = user.branchId || 'all';
          setActiveBranch(initialBranch);
          localStorage.setItem('fel_active_branch', initialBranch);

          return true;
        }
      } catch (e) {
        console.error('Online login failed:', e);
      }
    }

    // --- CASE 2: Offline Fallback (or if online failed) ---
    console.log('[Auth] Attempting offline login fallback...');
    try {
      const cachedUser = await idb.get('cache_users', userId);
      // Check both the manually cached PIN (from a previous login) and the server-synced PIN
      const storedPin = cachedUser?.cachedPin || cachedUser?.pin;
      
      if (cachedUser && storedPin === pin) {
        setCurrentUser(cachedUser);
        localStorage.setItem('fel_currentUser', JSON.stringify(cachedUser));
        
        const initialBranch = cachedUser.branchId || 'all';
        setActiveBranch(initialBranch);
        localStorage.setItem('fel_active_branch', initialBranch);

        return true;
      }
    } catch (e) {
      console.error('Offline login failed:', e);
    }

    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveBranch('all');
    localStorage.removeItem('fel_currentUser');
    localStorage.removeItem('fel_active_branch');
  };

  const addUser = async (user) => {
    await api.post('/users', user);
    await fetchUsers();
  };

  const updateUser = async (id, updates) => {
    await api.put(`/users/${id}`, updates);
    await fetchUsers();
    if (currentUser?.id === id) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      localStorage.setItem('fel_currentUser', JSON.stringify(updatedUser));
    }
  };

  const deleteUser = async (id) => {
    await api.del(`/users/${id}`);
    await fetchUsers();
  };

  const changePin = async (id, newPin) => {
    await api.put(`/users/${id}/pin`, { pin: newPin });
    await fetchUsers();
  };

  return (
    <AuthContext.Provider value={{
      currentUser, users, loading, syncRequired, activeBranch,
      login, logout, switchBranch,
      addUser, updateUser, deleteUser, changePin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
