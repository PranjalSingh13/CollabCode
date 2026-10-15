import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Copy, Check, Mail, UserPlus, Share2, Users, Trash2, Sparkles } from 'lucide-react';

export default function InviteModal({ isOpen, onClose, sessionCode, invites = [], onInviteSent, addToast }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const sessionUrl = `${window.location.origin}?session=${sessionCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    addToast?.('Direct session link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    addToast?.(`Session code "${sessionCode}" copied!`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendInvite = async (targetEmail) => {
    const toSend = (targetEmail || email).trim();
    if (!toSend) return;

    setLoading(true);
    try {
      await api.inviteToSession(sessionCode, toSend);
      addToast?.(`Invitation successfully sent to ${toSend}`, 'success');
      setEmail('');
      onInviteSent?.();
    } catch (err) {
      addToast?.(err.message || 'Failed to send invite', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeInvite = async (id) => {
    try {
      await api.revokeInvite(sessionCode, id);
      addToast?.('Invitation revoked', 'info');
      onInviteSent?.();
    } catch (err) {
      addToast?.(err.message || 'Failed to revoke invite', 'danger');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Share2 size={18} color="var(--indigo-500)" />
            <span>Invite Collaborators</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Shareable Link Box */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Direct Session Invite Link</label>
              <button 
                type="button" 
                onClick={handleCopyCode}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', color: 'var(--indigo-500)' }}
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                <span>Copy Code Only</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                readOnly
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                value={sessionUrl}
              />
              <button className="btn btn-primary" onClick={handleCopyLink} title="Copy link to clipboard">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Same Wi-Fi Link for Real Devices/People in same network */}
            <div style={{ marginTop: '0.5rem', padding: '0.55rem 0.75rem', background: 'var(--bg-card-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--indigo-500)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  📶 Same Wi-Fi / Local Network Link (Phones, Laptops):
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                  onClick={() => {
                    navigator.clipboard.writeText(`http://192.168.75.186:5173/?session=${sessionCode}`);
                    addToast?.('Wi-Fi network link copied to clipboard!', 'success');
                  }}
                >
                  <Copy size={12} /> Copy Wi-Fi Link
                </button>
              </div>
              <code style={{ fontSize: '0.74rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                http://192.168.75.186:5173/?session={sessionCode}
              </code>
            </div>

            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              Anyone with this link or session code <strong style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>{sessionCode}</strong> can join and pair program with you in real time.
            </span>
          </div>

          <div style={{ height: '1px', background: 'var(--border-dim)', margin: '0.35rem 0' }} />

          {/* Quick Team Chips */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
              <Sparkles size={13} color="var(--amber)" />
              <span>Quick Invite Demo Teammates</span>
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { name: 'Alice', email: 'alice@collabcode.dev', color: '#6366f1' },
                { name: 'Bob', email: 'bob@collabcode.dev', color: '#10b981' },
                { name: 'Admin', email: 'admin@collabcode.dev', color: '#ec4899' },
              ].map(member => (
                <button
                  key={member.email}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => handleSendInvite(member.email)}
                  disabled={loading}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.color }} />
                  <span>{member.name}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>({member.email})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Email Invite Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendInvite(); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Send Email / In-App Invite</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. teammate@example.com or username"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={loading || !email.trim()}>
                  <Mail size={16} />
                  <span>{loading ? 'Sending...' : 'Invite'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Invites list */}
          {invites && invites.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Sent Invitations ({invites.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '140px', overflowY: 'auto' }}>
                {invites.map((inv) => (
                  <div 
                    key={inv.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--r-md)',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{inv.invited_email}</span>
                      <span className={`badge ${inv.status === 'accepted' ? 'badge-live' : 'badge-active'}`} style={{ fontSize: '0.675rem' }}>
                        {inv.status}
                      </span>
                    </div>
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleRevokeInvite(inv.id)}
                        title="Revoke invitation"
                        style={{ color: 'var(--rose)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
