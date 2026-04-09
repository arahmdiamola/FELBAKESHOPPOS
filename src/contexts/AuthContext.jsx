import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fel_currentUser')) || null; } catch { return null; }
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get('/users');
      setUsers(data || []);
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const login = async (userId, pin) => {
    try {
      const user = await api.post('/auth/login', { id: userId, pin });
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('fel_currentUser', JSON.stringify(user));
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
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
      currentUser, users, loading,
      login, logout,
      addUser, updateUser, deleteUser, changePin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
