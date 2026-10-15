import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Sparkles, Code2, PlusCircle } from 'lucide-react';

export default function NewSessionModal({ isOpen, onClose, onSessionCreated, addToast }) {
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getProjects()
        .then((res) => setProjects(res.projects || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await api.createSession({
        title: title.trim(),
        language,
        projectId: selectedProjectId ? Number(selectedProjectId) : null
      });

      addToast?.(`Session "${res.session.title}" launched!`, 'success');
      onSessionCreated?.(res.sessionCode);
      onClose();
    } catch (err) {
      addToast?.(err.message || 'Failed to create session', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={18} color="var(--accent-primary)" />
            <span>Create Collaborative Coding Session</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Session Title</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Graph Algorithms Interview Prep"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Programming Language</label>
              <select
                className="form-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="javascript">JavaScript (Node / ES6)</option>
                <option value="python">Python 3</option>
                <option value="typescript">TypeScript</option>
                <option value="html">HTML5 / CSS</option>
                <option value="json">JSON Schema</option>
              </select>
            </div>

            {projects.length > 0 && (
              <div className="form-group">
                <label className="form-label">Load Code from Existing Project (Optional)</label>
                <select
                  className="form-select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    if (e.target.value) {
                      const p = projects.find((x) => x.id === Number(e.target.value));
                      if (p) setLanguage(p.language);
                    }
                  }}
                >
                  <option value="">-- Start with Blank Template --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.language})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', marginTop: '0.5rem' }} disabled={loading}>
              <Code2 size={16} />
              <span>{loading ? 'Creating Session...' : 'Launch Live Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
