import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Code2, FolderGit2, Radio, ShieldCheck, LogOut, Wifi, WifiOff, Sun, Moon, Edit2, Check, X } from 'lucide-react';

export default function Navbar({ currentView, setCurrentView, isConnected, onOpenAuthModal }) {
  const { user, isAdmin, quickSwitchDemo, setDisplayName, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const handleDemoSwitch = async (role) => {
    try { await quickSwitchDemo(role); } catch (err) { console.error(err); }
  };

  const handleStartEdit = () => {
    setNameInput(user ? user.username : '');
    setIsEditingName(true);
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setDisplayName(nameInput.trim());
    }
    setIsEditingName(false);
  };

  const personaActive = (name) => {
    if (!user) return '';
    if (name === 'admin' && user.username === 'admin') return 'active-admin';
    if (name === 'alice' && user.username === 'alice') return 'active-alice';
    if (name === 'bob'   && user.username === 'bob')   return 'active-bob';
    return '';
  };

  return (
    <header className="navbar">
      {/* ── Brand ── */}
      <div className="nav-brand" onClick={() => setCurrentView('editor')}>
        <div className="brand-icon-wrapper">
          <Code2 size={18} />
        </div>
        <div>
          <div className="brand-text">CollabCode</div>
          <span className="brand-tag">Realtime</span>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <nav className="nav-links">
        <button className={`nav-tab-btn ${currentView === 'editor'   ? 'active' : ''}`} onClick={() => setCurrentView('editor')}>
          <Code2 size={14} />
          Editor
        </button>
        <button className={`nav-tab-btn ${currentView === 'projects' ? 'active' : ''}`} onClick={() => setCurrentView('projects')}>
          <FolderGit2 size={14} />
          Projects
        </button>
        <button className={`nav-tab-btn ${currentView === 'sessions' ? 'active' : ''}`} onClick={() => setCurrentView('sessions')}>
          <Radio size={14} />
          Sessions
        </button>
        <button className={`nav-tab-btn ${currentView === 'admin'    ? 'active' : ''}`} onClick={() => setCurrentView('admin')}>
          <ShieldCheck size={14} />
          Admin
          {isAdmin && <span className="role-badge admin" style={{ marginLeft: '0.1rem' }}>OP</span>}
        </button>
      </nav>

      {/* ── Right Controls ── */}
      <div className="nav-actions">
        {/* Live status */}
        <div className="status-indicator" title={isConnected ? 'Live collaboration active' : 'Connecting…'}>
          {isConnected
            ? <><span className="status-dot"></span><span>Live</span></>
            : <><span className="status-dot disconnected"></span><span>Offline</span></>
          }
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={15} className="theme-icon sun" />
          ) : (
            <Moon size={15} className="theme-icon moon" />
          )}
          <span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Persona switcher */}
        <div className="persona-switcher">
          <span className="persona-label">Switch</span>
          <button className={`persona-btn ${personaActive('admin')}`} onClick={() => handleDemoSwitch('admin')} title="Sign in as Admin">Admin</button>
          <button className={`persona-btn ${personaActive('alice')}`} onClick={() => handleDemoSwitch('alice')} title="Sign in as Alice">Alice</button>
          <button className={`persona-btn ${personaActive('bob')}`}   onClick={() => handleDemoSwitch('bob')}   title="Sign in as Bob">Bob</button>
        </div>

        {/* User pill / Name changer */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isEditingName ? (
              <form onSubmit={handleSaveName} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="text"
                  autoFocus
                  className="form-input"
                  style={{ width: 110, padding: '0.2rem 0.5rem', fontSize: '0.78rem', height: 28 }}
                  placeholder="Enter your name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm btn-icon" style={{ height: 28, width: 28 }} title="Save Name">
                  <Check size={13} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ height: 28, width: 28 }} onClick={() => setIsEditingName(false)}>
                  <X size={13} />
                </button>
              </form>
            ) : (
              <div className="user-profile-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div className="avatar-badge" style={{ width: 24, height: 24, background: user.avatar_color || '#6366f1' }}>
                  {user.username.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span style={{ maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={handleStartEdit}
                  title="Click to change your display name"
                  style={{ padding: '0.1rem', opacity: 0.7 }}
                >
                  <Edit2 size={12} />
                </button>
              </div>
            )}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={logout} title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onOpenAuthModal}>Sign In</button>
        )}
      </div>
    </header>
  );
}
