import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  const refresh = useCallback(async () => {
    try {
      const { data } = await api('/auth/me');
      setState({ loading: false, user: data.user });
      return data.user;
    } catch {
      setState({ loading: false, user: null });
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (username, password) => {
    await api('/auth/login', { method: 'POST', body: { username, password } });
    return refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally {
      setState({ loading: false, user: null });
    }
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
