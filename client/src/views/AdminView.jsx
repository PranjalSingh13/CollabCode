import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Radio, ShieldCheck, Database, UserPlus, Trash2,
  ShieldAlert, UserX, UserCheck, AlertTriangle, Play,
  FileCode, FolderGit2, RefreshCw
} from 'lucide-react';

export default function AdminView({ onJoinSession, addToast }) {
  const { user } = useAuth();
  const [tab,      setTab]      = useState('users');
  const [stats,    setStats]    = useState(null);
  const [users,    setUsers]    = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [newUser,  setNewUser]  = useState({ username:'', email:'', password:'', role:'user' });

  const load = async () => {
    try {
      setLoading(true);
      const [s, u, ss] = await Promise.all([api.getAdminStats(), api.getAdminUsers(), api.getAdminSessions()]);
      setStats(s.stats);
      setUsers(u.users  || []);
      setSessions(ss.sessions || []);
    } catch (err) {
      addToast?.('Could not load admin data — are you an admin?', 'danger');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRoleToggle = async (u2) => {
    const newRole = u2.role === 'admin' ? 'user' : 'admin';
    try { await api.updateUserRole(u2.id, newRole); addToast?.(`${u2.username} is now ${newRole}`, 'success'); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleStatusToggle = async (u2) => {
    const newStatus = u2.status === 'active' ? 'suspended' : 'active';
    try { await api.updateUserStatus(u2.id, newStatus); addToast?.(`${u2.username} → ${newStatus}`, 'info'); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"? This is permanent.`)) return;
    try { await api.deleteUser(id); addToast?.(`${name} deleted`, 'info'); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try { await api.createAdminUser(newUser); addToast?.('User created!', 'success'); setAddModal(false); setNewUser({ username:'', email:'', password:'', role:'user' }); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleTerminate = async (s) => {
    if (!window.confirm(`Terminate session "${s.title}"?`)) return;
    try { await api.terminateSession(s.id); addToast?.('Session terminated by admin', 'info'); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleDeleteSess = async (id) => {
    if (!window.confirm('Delete this session record?')) return;
    try { await api.deleteAdminSession(id); addToast?.('Session deleted', 'info'); load(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  return (
    <div className="page-view">
      <div className="page-inner">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.3rem' }}>
              <ShieldCheck size={22} color="#f472b6" />
              <h1 className="page-title" style={{ margin: 0 }}>Admin Dashboard</h1>
            </div>
            <p className="page-subtitle">Manage users, sessions, and view live system telemetry.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
            {tab === 'users' && <button className="btn btn-primary" onClick={() => setAddModal(true)}><UserPlus size={14} /> Add User</button>}
          </div>
        </div>

        {/* ── Stats Row ── */}
        {stats && (
          <div className="stats-grid">
            {[
              { label: 'Total Users',      val: stats.totalUsers,      sub: `${stats.activeUsers} active`,    color: '#818cf8', bg: 'rgba(99,102,241,0.12)',  icon: <Users size={20} /> },
              { label: 'Sessions',         val: stats.totalSessions,   sub: `${stats.activeSessions} live`,   color: '#34d399', bg: 'rgba(16,185,129,0.12)',  icon: <Radio size={20} /> },
              { label: 'Projects',         val: stats.totalProjects,   sub: 'total saved',                    color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  icon: <FolderGit2 size={20} /> },
              { label: 'Source Files',     val: stats.totalSourceFiles,sub: 'in database',                    color: '#22d3ee', bg: 'rgba(6,182,212,0.12)',   icon: <FileCode size={20} /> },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <div>
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.1rem' }}>
          {[
            { id: 'users',    label: `Users (${users.length})`,          icon: <Users size={14} /> },
            { id: 'sessions', label: `Sessions (${sessions.length})`,    icon: <Radio size={14} /> },
            { id: 'database', label: 'Database Overview',                 icon: <Database size={14} /> },
          ].map(t => (
            <button key={t.id} className={`nav-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }}></div>
            Loading admin data…
          </div>
        )}

        {/* ── USERS TABLE ── */}
        {!loading && tab === 'users' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Projects</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u2 => {
                  const isSelf = user?.id === u2.id;
                  return (
                    <tr key={u2.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="avatar-badge" style={{ width: 28, height: 28, background: u2.avatar_color || '#6366f1' }}>
                            {u2.username.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u2.username}</div>
                            {isSelf && <div style={{ fontSize: '0.68rem', color: 'var(--indigo-500)' }}>You</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u2.email}</td>
                      <td><span className={`role-badge ${u2.role}`}>{u2.role}</span></td>
                      <td><span className={`badge ${u2.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>{u2.status}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{u2.projects_count}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{new Date(u2.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          {!isSelf && (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleRoleToggle(u2)}>
                                <ShieldCheck size={12} /> {u2.role === 'admin' ? 'Demote' : 'Promote'}
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleStatusToggle(u2)}>
                                {u2.status === 'active' ? <><UserX size={12} /> Suspend</> : <><UserCheck size={12} /> Activate</>}
                              </button>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteUser(u2.id, u2.username)}>
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── SESSIONS TABLE ── */}
        {!loading && tab === 'sessions' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Host</th>
                  <th>Lang</th>
                  <th>Status</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td>
                      <code style={{ color: 'var(--indigo-500)', fontSize: '0.78rem', fontWeight: 600 }}>{s.session_code}</code>
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div className="avatar-badge" style={{ width: 20, height: 20, fontSize: '0.62rem', background: s.host_avatar_color || '#6366f1' }}>
                          {s.host_username?.charAt(0)}
                        </div>
                        <span style={{ fontSize: '0.82rem' }}>{s.host_username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`lang-badge ${s.language === 'javascript' ? 'lang-js' : s.language === 'python' ? 'lang-py' : 'lang-ts'}`}>
                        {s.language}
                      </span>
                    </td>
                    <td><span className={`badge ${s.is_active ? 'badge-live' : 'badge-ended'}`}>{s.is_active ? 'Live' : 'Ended'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{s.project_name || '—'}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => onJoinSession(s.session_code)}>
                          <Play size={11} /> Inspect
                        </button>
                        {s.is_active === 1 && (
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleTerminate(s)} title="Force terminate">
                            <AlertTriangle size={12} />
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => handleDeleteSess(s.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DATABASE OVERVIEW ── */}
        {!loading && tab === 'database' && (
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderRadius: 'var(--r-lg)', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <Database size={18} color="var(--indigo-500)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>SQLite Relational Schema</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Persistent SQLite database stored at <code>server/collabcode.db</code> with foreign-key cascades and prepared statement sync.
              </p>
            </div>

            <div className="schema-grid">
              {[
                { name: '1. users', color: '#818cf8', count: stats?.totalUsers || 0, fields: 'id, username, email, password_hash, role, status, avatar_color, created_at' },
                { name: '2. projects', color: '#fbbf24', count: stats?.totalProjects || 0, fields: 'id, name, description, owner_id, language, is_public, created_at, updated_at' },
                { name: '3. coding_sessions', color: '#34d399', count: sessions.length, fields: 'id, session_code, project_id, host_user_id, title, language, is_active, is_locked, created_at, ended_at' },
                { name: '4. source_code', color: '#22d3ee', count: stats?.totalSourceFiles || 0, fields: 'id, project_id, session_id, file_name, language, content, version, last_modified_by, updated_at' },
              ].map(t => (
                <div key={t.name} className="schema-card">
                  <div className="schema-card-title" style={{ color: t.color }}>{t.name}</div>
                  <div className="schema-field">{t.fields.split(', ').map(f => <span key={f} style={{ display: 'inline-block', background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderRadius: 4, padding: '0.1rem 0.35rem', margin: '0.15rem', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{f}</span>)}</div>
                  <div className="schema-record-count">Records: <strong style={{ color: t.color }}>{t.count}</strong></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><UserPlus size={17} color="var(--indigo-500)" /> Create User</span>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {['username','email','password'].map(field => (
                  <div className="form-group" key={field}>
                    <label className="form-label">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                    <input
                      type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                      required
                      className="form-input"
                      value={newUser[field]}
                      onChange={e => setNewUser({...newUser, [field]: e.target.value})}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }}>Provision User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
