import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, setCurrentUser, getCurrentUser, getAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyOrAutoLogin() {
      try {
        const storedToken = getAuthToken();
        const customName = localStorage.getItem('collabcode_custom_name');
        if (storedToken) {
          const res = await api.getMe();
          const u = customName ? { ...res.user, username: customName } : res.user;
          setUser(u);
          setCurrentUser(u);
        } else {
          // If a custom name was chosen on this laptop, keep it!
          const loginRes = await api.login('alice', 'alice123');
          const u = customName ? { ...loginRes.user, username: customName } : loginRes.user;
          setToken(loginRes.token);
          setUser(u);
          setAuthToken(loginRes.token);
          setCurrentUser(u);
        }
      } catch (err) {
        console.warn('Auto auth check notice:', err.message);
        try {
          const customName = localStorage.getItem('collabcode_custom_name');
          const loginRes = await api.login('alice', 'alice123');
          const u = customName ? { ...loginRes.user, username: customName } : loginRes.user;
          setToken(loginRes.token);
          setUser(u);
          setAuthToken(loginRes.token);
          setCurrentUser(u);
        } catch (e) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    }

    verifyOrAutoLogin();
  }, []);

  const login = async (loginId, password) => {
    const res = await api.login(loginId, password);
    setToken(res.token);
    setUser(res.user);
    setAuthToken(res.token);
    setCurrentUser(res.user);
    return res;
  };

  const register = async (username, email, password) => {
    const res = await api.register(username, email, password);
    setToken(res.token);
    setUser(res.user);
    setAuthToken(res.token);
    setCurrentUser(res.user);
    return res;
  };

  const quickSwitchDemo = async (accountType) => {
    const credentials = {
      admin: { login: 'admin', pass: 'admin123' },
      alice: { login: 'alice', pass: 'alice123' },
      bob: { login: 'bob', pass: 'bob123' }
    }[accountType] || { login: 'alice', pass: 'alice123' };

    return await login(credentials.login, credentials.pass);
  };

  const setDisplayName = (name, forcedColor) => {
    if (!name || !name.trim()) return;
    const clean = name.trim();
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Try to use explicitly passed color, then saved prefs, then existing, then random
    const savedPrefs = JSON.parse(localStorage.getItem('collabcode_user_prefs') || '{}');
    const resolvedColor = forcedColor || savedPrefs.avatar_color || user?.avatar_color || randomColor;

    const updated = {
      ...(user || {}),
      id: user?.id || `user-${Date.now().toString().slice(-4)}`,
      username: clean,
      avatar_color: resolvedColor,
      role: user?.role || 'user'
    };

    setUser(updated);
    setCurrentUser(updated);
    localStorage.setItem('collabcode_custom_name', clean);
    return updated;
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('collabcode_custom_name');
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isAdmin: Boolean(user && user.role === 'admin'),
    loading,
    login,
    register,
    quickSwitchDemo,
    setDisplayName,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
