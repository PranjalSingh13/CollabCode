import React, { useState, useEffect } from 'react';
import { Users, ArrowRight, Sparkles } from 'lucide-react';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#14b8a6'
];

export default function JoinGate({ sessionCode, onJoin }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [shaking, setShaking] = useState(false);
  const [joining, setJoining] = useState(false);

  // Check if user already has a name stored
  useEffect(() => {
    const stored = localStorage.getItem('collabcode_custom_name');
    if (stored) setName(stored);
  }, []);

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    setJoining(true);
    // Small delay for the animation
    setTimeout(() => {
      onJoin(trimmed, color);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin();
  };

  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className="join-gate-overlay">
      {/* Animated background particles */}
      <div className="join-gate-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="join-gate-particle" style={{ '--delay': `${i * 0.8}s`, '--x': `${15 + i * 14}%` }} />
        ))}
      </div>

      <div className={`join-gate-card ${joining ? 'join-gate-card--joining' : ''}`}>
        {/* Glow accent */}
        <div className="join-gate-glow" />

        {/* Header */}
        <div className="join-gate-header">
          <div className="join-gate-logo">
            <div className="join-gate-logo-icon">
              <Users size={22} />
            </div>
            <span className="join-gate-brand">CollabCode</span>
          </div>
          <h1 className="join-gate-title">Join Session</h1>
          <p className="join-gate-subtitle">
            You're about to join <span className="join-gate-session-code">{sessionCode}</span>
          </p>
        </div>

        {/* Avatar Preview */}
        <div className="join-gate-avatar-section">
          <div className="join-gate-avatar" style={{ background: color }}>
            <span>{initial}</span>
          </div>
          <div className="join-gate-color-picker">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                className={`join-gate-color-dot ${color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={`Pick color ${c}`}
                type="button"
              />
            ))}
          </div>
        </div>

        {/* Name Input */}
        <div className="join-gate-form">
          <label className="join-gate-label" htmlFor="join-name-input">
            What should we call you?
          </label>
          <input
            id="join-name-input"
            type="text"
            className={`join-gate-input ${shaking ? 'join-gate-shake' : ''}`}
            placeholder="Enter your name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={30}
          />
          {shaking && (
            <span className="join-gate-error">Please enter your name to continue</span>
          )}
        </div>

        {/* Join Button */}
        <button
          className={`join-gate-btn ${joining ? 'join-gate-btn--loading' : ''}`}
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <>
              <div className="join-gate-spinner" />
              Joining…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Join Session
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="join-gate-footer">
          Your name will be visible to other collaborators in the session.
        </p>
      </div>
    </div>
  );
}
