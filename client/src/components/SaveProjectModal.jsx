import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Save, FolderPlus, FileCode } from 'lucide-react';

export default function SaveProjectModal({ isOpen, onClose, session, currentCode, addToast, onProjectSaved }) {
  const [projectName, setProjectName] = useState(session ? `${session.title} (Snapshot)` : 'My Collaborative Project');
  const [description, setDescription] = useState(session ? `Saved from collaborative session ${session.session_code}` : '');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setLoading(true);
    try {
      if (session) {
        await api.saveSessionProject(session.session_code, {
          projectName: projectName.trim(),
          description: description.trim(),
          codeContent: currentCode,
          fileName: session.language === 'python' ? 'main.py' : 'main.js'
        });
      } else {
        await api.createProject({
          name: projectName.trim(),
          description: description.trim(),
          language: 'javascript',
          is_public: isPublic ? 1 : 0,
          initialCode: currentCode
        });
      }

      addToast?.('Project saved successfully to database!', 'success');
      onProjectSaved?.();
      onClose();
    } catch (err) {
      addToast?.(err.message || 'Failed to save project', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderPlus size={18} color="var(--accent-emerald)" />
            <span>Save as Permanent Project</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Distributed Cache Engine"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Explain the purpose of this project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>Make Project Public (Collaborators can discover and fork it)</span>
              </label>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              💾 This will store a permanent snapshot in the <strong>Project</strong> and <strong>Source code</strong> database tables linked to your account.
            </div>

            <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '0.65rem' }} disabled={loading}>
              <Save size={16} />
              <span>{loading ? 'Saving Project...' : 'Save Project to Database'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
