import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, Shield, UserCheck, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, addToast }) {
  const { user, login, register, quickSwitchDemo } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'switch'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(formData.username || formData.email, formData.password);
        addToast?.('Logged in successfully', 'success');
        onClose();
      } else if (tab === 'register') {
        await register(formData.username, formData.email, formData.password);
        addToast?.('Account created and logged in!', 'success');
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (accountType) => {
    try {
      await quickSwitchDemo(accountType);
      addToast?.(`Switched active user to ${accountType}`, 'info');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {tab === 'login' && 'Sign In to CollabCode'}
            {tab === 'register' && 'Create New Developer Account'}
            {tab === 'switch' && 'Quick Persona Switcher'}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          <button
            onClick={() => { setTab('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              background: tab === 'login' ? 'var(--bg-surface)' : 'transparent',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid var(--accent-primary)' : 'none',
              color: tab === 'login' ? 'var(--text-main)' : 'var(--text-dim)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.825rem'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              background: tab === 'register' ? 'var(--bg-surface)' : 'transparent',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid var(--accent-primary)' : 'none',
              color: tab === 'register' ? 'var(--text-main)' : 'var(--text-dim)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.825rem'
            }}
          >
            Register
          </button>
          <button
            onClick={() => { setTab('switch'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.65rem',
              background: tab === 'switch' ? 'var(--bg-surface)' : 'transparent',
              border: 'none',
              borderBottom: tab === 'switch' ? '2px solid var(--accent-primary)' : 'none',
              color: tab === 'switch' ? 'var(--text-main)' : 'var(--text-dim)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.825rem'
            }}
          >
            Demo Accounts
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              color: '#fda4af',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {tab === 'switch' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Select a pre-seeded account to test multi-user collaboration and admin features instantly without typing passwords:
              </p>

              <div 
                onClick={() => handleQuickSwitch('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="avatar-badge" style={{ backgroundColor: '#ec4899' }}>A</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Admin (Operator)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>admin@collabcode.dev</div>
                  </div>
                </div>
                <span className="role-badge admin">Full Control</span>
              </div>

              <div 
                onClick={() => handleQuickSwitch('alice')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="avatar-badge" style={{ backgroundColor: '#6366f1' }}>A</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Alice (Host Collaborator)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>alice@collabcode.dev</div>
                  </div>
                </div>
                <span className="role-badge user">Standard User</span>
              </div>

              <div 
                onClick={() => handleQuickSwitch('bob')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="avatar-badge" style={{ backgroundColor: '#10b981' }}>B</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Bob (Collaborator)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>bob@collabcode.dev</div>
                  </div>
                </div>
                <span className="role-badge user">Standard User</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tab === 'register' && (
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. dev_ninja"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{tab === 'login' ? 'Email or Username' : 'Email Address'}</label>
                <input
                  type={tab === 'login' ? 'text' : 'email'}
                  required
                  className="form-input"
                  placeholder={tab === 'login' ? 'admin or alice@collabcode.dev' : 'you@example.com'}
                  value={tab === 'login' ? formData.username : formData.email}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [tab === 'login' ? 'username' : 'email']: e.target.value 
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.7rem' }} disabled={loading}>
                {loading ? 'Authenticating...' : (tab === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
