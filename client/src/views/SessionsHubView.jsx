import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import NewSessionModal from '../components/NewSessionModal';
import { Radio, Plus, ArrowRight, Copy, Check, XCircle, Play, X } from 'lucide-react';

export default function SessionsHubView({ onJoinSession, addToast }) {
  const { user, isAdmin } = useAuth();
  const [sessions,      setSessions]      = useState([]);
  const [myInvites,     setMyInvites]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [joinCode,      setJoinCode]      = useState('');
  const [newModalOpen,  setNewModalOpen]  = useState(false);
  const [copiedCode,    setCopiedCode]    = useState('');

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const r = await api.getSessions();
      setSessions(r.sessions || []);
    } catch { addToast?.('Failed to fetch sessions', 'danger'); }
    finally { setLoading(false); }
  };

  const fetchMyInvites = async () => {
    if (!user) {
      setMyInvites([]);
      return;
    }
    try {
      const res = await api.getMyInvites();
      setMyInvites(res.invites || []);
    } catch (err) {
      console.warn('Could not fetch user invites:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchMyInvites();
  }, [user]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinSession(joinCode.trim());
  };

  const handleAcceptInvite = async (inviteId, code) => {
    try {
      await api.acceptInvite(inviteId);
      addToast?.('Invitation accepted! Entering session…', 'success');
      fetchMyInvites();
      onJoinSession(code);
    } catch (err) {
      addToast?.(err.message || 'Failed to accept invite', 'danger');
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      await api.declineInvite(inviteId);
      addToast?.('Invitation declined', 'info');
      fetchMyInvites();
    } catch (err) {
      addToast?.(err.message || 'Failed to decline invite', 'danger');
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addToast?.(`Copied "${code}"`, 'success');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleEnd = async (code) => {
    if (!window.confirm('Close this session for all participants?')) return;
    try { await api.endSession(code); addToast?.('Session closed', 'info'); fetchSessions(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const active  = sessions.filter(s => s.is_active);
  const ended   = sessions.filter(s => !s.is_active);

  return (
    <div className="page-view">
      <div className="page-inner">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Coding Sessions</h1>
            <p className="page-subtitle">Join an active pair-programming room or create a new real-time collaborative workspace.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setNewModalOpen(true)}>
            <Plus size={15} /> New Session
          </button>
        </div>

        {/* Incoming Invitations Notice */}
        {myInvites.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))',
            border: '1px solid rgba(99,102,241,0.32)',
            borderRadius: 'var(--r-xl)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📬</span>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-white)', margin: 0 }}>
                    You Have {myInvites.length} Pending Session Invitation{myInvites.length > 1 ? 's' : ''}!
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Collaborators have invited you to pair program in these live rooms.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {myInvites.map(inv => (
                <div
                  key={inv.invite_id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--r-lg)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span className="badge badge-live" style={{ fontSize: '0.65rem' }}>{inv.language || 'code'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-white)', marginBottom: '0.2rem' }}>
                      {inv.session_title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Invited by <strong style={{ color: inv.host_avatar_color || 'var(--indigo-500)' }}>@{inv.host_username}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.2rem' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleAcceptInvite(inv.invite_id, inv.session_code)}
                    >
                      <Play size={13} /> Accept & Join
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeclineInvite(inv.invite_id)}
                      title="Decline invite"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Join Hero */}
        <div className="join-hero">
          <div className="join-hero-text">
            <h3>Have a session code?</h3>
            <p>Enter the code shared by your teammate to join instantly.</p>
          </div>
          <form className="join-form" onSubmit={handleJoin}>
            <input
              type="text"
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
              placeholder="e.g. collab-live-demo"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Join <ArrowRight size={14} />
            </button>
          </form>
        </div>

        {/* Active sessions */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }}></div>
            Loading sessions…
          </div>
        ) : (
          <>
            {/* Active */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-heading">
                🟢 Active Sessions ({active.length})
              </div>

              {active.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Radio size={32} /></div>
                  <div className="empty-state-title">No active sessions</div>
                  <p className="empty-state-desc">Be the first to start a room!</p>
                  <button className="btn btn-primary" onClick={() => setNewModalOpen(true)}><Plus size={14} /> Create Session</button>
                </div>
              ) : (
                <div className="card-grid">
                  {active.map(s => (
                    <SessionCard key={s.id} session={s} user={user} isAdmin={isAdmin} onJoin={onJoinSession} onCopy={handleCopy} onEnd={handleEnd} copiedCode={copiedCode} />
                  ))}
                </div>
              )}
            </div>

            {/* Ended */}
            {ended.length > 0 && (
              <div>
                <div className="section-heading">Past Sessions ({ended.length})</div>
                <div className="card-grid">
                  {ended.map(s => (
                    <SessionCard key={s.id} session={s} user={user} isAdmin={isAdmin} onJoin={onJoinSession} onCopy={handleCopy} onEnd={handleEnd} copiedCode={copiedCode} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NewSessionModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSessionCreated={(code) => { fetchSessions(); onJoinSession(code); }}
        addToast={addToast}
      />
    </div>
  );
}

function SessionCard({ session: s, user, isAdmin, onJoin, onCopy, onEnd, copiedCode }) {
  const isHost = user && (s.host_user_id === user.id || isAdmin);

  return (
    <div className="card">
      <div className="card-top">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className={`badge ${s.is_active ? 'badge-live' : 'badge-ended'}`}>
            {s.is_active ? '● Live' : 'Ended'}
          </span>
          <button className="session-code-badge" onClick={() => onCopy(s.session_code)} title="Copy session code">
            {s.session_code}
            {copiedCode === s.session_code ? <Check size={11} color="var(--emerald)" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      <div className="card-body">
        <div className="card-name">{s.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
          <span className={`lang-badge ${s.language === 'javascript' ? 'lang-js' : s.language === 'python' ? 'lang-py' : 'lang-ts'}`}>{s.language}</span>
          {s.project_name && <span>📁 {s.project_name}</span>}
        </div>
      </div>

      <div className="card-footer">
        <div className="card-meta" style={{ marginBottom: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className="avatar-badge" style={{ width: 20, height: 20, fontSize: '0.65rem', background: s.host_avatar_color || '#6366f1' }}>
              {s.host_username?.charAt(0)}
            </div>
            <span>{s.host_username}</span>
          </div>
          <span>{new Date(s.created_at).toLocaleDateString()}</span>
        </div>

        <div className="card-actions">
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onJoin(s.session_code)}>
            <Play size={12} /> {s.is_active ? 'Enter Room' : 'View Code'}
          </button>
          {isHost && s.is_active === 1 && (
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => onEnd(s.session_code)} title="End session">
              <XCircle size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
