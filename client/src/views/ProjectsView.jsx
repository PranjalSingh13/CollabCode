import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FolderGit2, Plus, Play, GitFork, Download, Trash2, Globe, Lock, FileCode, Search, X } from 'lucide-react';

const LANG_CLASS = { javascript:'lang-js', python:'lang-py', typescript:'lang-ts', html:'lang-html', css:'lang-css', json:'lang-json' };

export default function ProjectsView({ onLaunchSessionFromProject, addToast }) {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]     = useState(false);
  const [form,     setForm]      = useState({ name: '', description: '', language: 'javascript', is_public: 1 });

  const fetch = async () => {
    try {
      setLoading(true);
      const r = await api.getProjects();
      setProjects(r.projects || []);
    } catch { addToast?.('Failed to load projects', 'danger'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createProject(form);
      addToast?.('Project created!', 'success');
      setModal(false);
      setForm({ name: '', description: '', language: 'javascript', is_public: 1 });
      fetch();
    } catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleFork = async (id) => {
    try { await api.forkProject(id); addToast?.('Project forked!', 'success'); fetch(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project? This is permanent.')) return;
    try { await api.deleteProject(id); addToast?.('Project deleted', 'info'); fetch(); }
    catch (err) { addToast?.(err.message, 'danger'); }
  };

  const handleDownload = async (proj) => {
    try {
      const d = await api.getProject(proj.id);
      const f = d.files?.[0];
      const blob = new Blob([f?.content || ''], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = f?.file_name || 'main.js';
      a.click();
      URL.revokeObjectURL(url);
      addToast?.('Downloaded!', 'success');
    } catch { addToast?.('Download failed', 'danger'); }
  };

  const mine   = projects.filter(p => user && p.owner_id === user.id);
  const pub    = projects.filter(p => p.is_public);

  const displayed = projects.filter(p => {
    if (filter === 'mine'   && !(user && p.owner_id === user.id)) return false;
    if (filter === 'public' && !p.is_public) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="page-view">
      <div className="page-inner">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects Repository</h1>
            <p className="page-subtitle">Manage your saved code projects, fork others, and launch collaborative sessions.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> New Project
          </button>
        </div>

        {/* Filter + Search row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="filter-bar">
            <button className={`filter-btn ${filter === 'all'    ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({projects.length})
            </button>
            <button className={`filter-btn ${filter === 'mine'   ? 'active' : ''}`} onClick={() => setFilter('mine')}>
              Mine ({mine.length})
            </button>
            <button className={`filter-btn ${filter === 'public' ? 'active' : ''}`} onClick={() => setFilter('public')}>
              Public ({pub.length})
            </button>
          </div>

          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }}></div>
            Loading projects…
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FolderGit2 size={36} /></div>
            <div className="empty-state-title">No projects found</div>
            <p className="empty-state-desc">Create a new project or save a live session to build your repository.</p>
            <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={14} /> Create Project</button>
          </div>
        ) : (
          <div className="card-grid">
            {displayed.map(proj => {
              const isOwner = user && (proj.owner_id === user.id || isAdmin);
              const lc = LANG_CLASS[proj.language] || 'lang-js';
              return (
                <div key={proj.id} className="card">
                  <div className="card-top">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className={`lang-badge ${lc}`}>{proj.language}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {proj.is_public ? <Globe size={12} /> : <Lock size={12} />}
                        <div className="avatar-badge" style={{ width: 18, height: 18, fontSize: '0.6rem', background: proj.owner_avatar_color || '#6366f1' }}>
                          {proj.owner_username?.charAt(0)}
                        </div>
                        <span>{proj.owner_username}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-name">{proj.name}</div>
                    <div className="card-desc">{proj.description || 'No description provided.'}</div>
                  </div>

                  <div className="card-footer">
                    <div className="card-meta" style={{ marginBottom: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileCode size={12} /> {proj.file_count || 1} file{proj.file_count !== 1 ? 's' : ''}
                      </span>
                      <span>{new Date(proj.updated_at || proj.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="card-actions">
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onLaunchSessionFromProject?.(proj)}>
                        <Play size={12} /> Launch
                      </button>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => handleFork(proj.id)} title="Fork">
                        <GitFork size={13} />
                      </button>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => handleDownload(proj)} title="Download">
                        <Download size={13} />
                      </button>
                      {isOwner && (
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(proj.id)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title"><Plus size={17} color="var(--indigo-500)" /> New Project</span>
              <button className="modal-close" onClick={() => setModal(false)}><X size={17} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input type="text" required className="form-input" placeholder="e.g. Graph Visualizer"
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" placeholder="What does this project do?"
                    value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select className="form-select" value={form.language} onChange={e => setForm({...form, language: e.target.value})}>
                    {['javascript','python','typescript','html','css','json'].map(l => (
                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Boolean(form.is_public)}
                    onChange={e => setForm({...form, is_public: e.target.checked ? 1 : 0})} />
                  Make this project public
                </label>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
