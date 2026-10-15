import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import InviteModal from '../components/InviteModal';
import SaveProjectModal from '../components/SaveProjectModal';
import {
  Play, Save, Share2, Users, MessageSquare, Terminal,
  Lock, Unlock, Copy, Check, Send, Trash2,
  ChevronRight, ChevronLeft, Zap
} from 'lucide-react';

export default function EditorView({ sessionCode = 'collab-live-demo', onSwitchSession, addToast }) {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const socket = getSocket();

  const [session,      setSession]      = useState(null);
  const [loadError,    setLoadError]    = useState(null);
  const [code,         setCode]         = useState('// Loading collaborative workspace…\n');
  const [language,     setLanguage]     = useState('javascript');
  const [isLocked,     setIsLocked]     = useState(false);
  const [participants, setParticipants] = useState([]);
  const [chats,        setChats]        = useState([]);
  const [chatInput,    setChatInput]    = useState('');
  const [invites,      setInvites]      = useState([]);
  const [sidebarTab,   setSidebarTab]   = useState('chat');
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [copiedCode,   setCopiedCode]   = useState(false);
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const [saveOpen,     setSaveOpen]     = useState(false);
  const [consoleOut,   setConsoleOut]   = useState([]);
  const [isRunning,    setIsRunning]    = useState(false);
  const [unread,       setUnread]       = useState(0);

  const editorRef      = useRef(null);
  const isRemote       = useRef(false);
  const chatBottomRef  = useRef(null);
  const userRef        = useRef(user);  // always holds latest user, avoids stale closures

  // Keep userRef in sync with user state
  useEffect(() => { userRef.current = user; }, [user]);

  /* ── Load session data ── */
  const loadSession = async () => {
    try {
      setLoadError(null);
      const d = await api.getSession(sessionCode);
      setSession(d.session);
      setLanguage(d.session.language || 'javascript');
      setIsLocked(Boolean(d.session.is_locked));
      if (d.files?.length) setCode(d.files[0].content || '');
      setChats(d.chats || []);
      setInvites(d.invites || []);
    } catch (err) {
      setLoadError(err.message || 'Session not found');
      addToast?.(err.message || 'Error loading session', 'danger');
    }
  };

  useEffect(() => { loadSession(); }, [sessionCode]);

  /* ── Socket.IO real-time ── */
  useEffect(() => {
    if (!socket || !sessionCode) return;

    // Use userRef.current so we always send the latest name even if state batched
    const currentUser = userRef.current || { id: 'guest', username: 'Guest', avatar_color: '#6366f1', role: 'user' };

    socket.emit('join_session', {
      sessionCode,
      user: currentUser
    });

    const onInit    = (d) => {
      if (d.content != null) setCode(d.content);
      if (d.isLocked != null) setIsLocked(d.isLocked);
      if (d.participants) setParticipants(d.participants);
    };
    const onUpdate  = (d) => {
      if (d.senderId === socket.id) return;
      isRemote.current = true;
      setCode(d.content);
      if (editorRef.current && editorRef.current.getValue() !== d.content) {
        const pos = editorRef.current.getPosition();
        editorRef.current.setValue(d.content);
        if (pos) editorRef.current.setPosition(pos);
      }
      setTimeout(() => { isRemote.current = false; }, 50);
    };
    const onJoined  = (d) => {
      setParticipants(d.participants);
      addToast?.(`🎉 ${d.user?.username || 'A collaborator'} joined the session!`, 'success');
    };
    const onLeft    = (d) => {
      setParticipants(d.participants);
      if (d.user) addToast?.(`👋 ${d.user.username} left`, 'info');
    };
    const onParticipantsUpdated = (d) => {
      setParticipants(d.participants);
      if (d.updatedUser && user && d.updatedUser.id !== user.id) {
        addToast?.(`👤 Collaborator updated name to "${d.updatedUser.username}"`, 'info');
      }
    };
    const onChat    = (m) => {
      setChats(p => [...p, m]);
      if (sidebarTab !== 'chat') setUnread(p => p + 1);
    };
    const onLock    = (d) => { setIsLocked(d.isLocked); addToast?.(d.isLocked ? 'Session locked (read-only)' : 'Session unlocked', 'info'); };
    const onKill    = (d) => { setIsLocked(true); addToast?.(d.message, 'danger'); };

    socket.on('session_init',               onInit);
    socket.on('code_update',                onUpdate);
    socket.on('user_joined',                onJoined);
    socket.on('user_left',                  onLeft);
    socket.on('participants_updated',       onParticipantsUpdated);
    socket.on('new_chat_message',           onChat);
    socket.on('lock_state_changed',         onLock);
    socket.on('session_terminated_by_admin', onKill);

    return () => {
      socket.off('session_init',               onInit);
      socket.off('code_update',                onUpdate);
      socket.off('user_joined',                onJoined);
      socket.off('user_left',                  onLeft);
      socket.off('participants_updated',       onParticipantsUpdated);
      socket.off('new_chat_message',           onChat);
      socket.off('lock_state_changed',         onLock);
      socket.off('session_terminated_by_admin', onKill);
    };
  }, [socket, sessionCode, user, sidebarTab]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats]);
  useEffect(() => { if (sidebarTab === 'chat') setUnread(0); }, [sidebarTab]);

  // When the user's display name or color changes AFTER joining, push the update to all peers
  const prevUsernameRef = useRef(null);
  useEffect(() => {
    if (!socket || !sessionCode || !user?.username) return;
    if (prevUsernameRef.current === null) {
      // First render — just record, don't emit (join_session already handled it)
      prevUsernameRef.current = user.username;
      return;
    }
    if (prevUsernameRef.current === user.username) return;
    // Name changed — broadcast to everyone
    prevUsernameRef.current = user.username;
    socket.emit('update_user_profile', {
      sessionCode,
      user: { ...user }
    });
  }, [user?.username, user?.avatar_color]);

  const handleEditorChange = (val) => {
    if (isRemote.current) return;
    setCode(val);
    socket.emit('code_change', { sessionCode, content: val, senderId: socket.id });
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      socket.emit('cursor_move', { sessionCode, position: e.position });
    });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('send_chat', { sessionCode, message: chatInput.trim() });
    setChatInput('');
  };

  const handleToggleLock = async () => {
    try {
      const r = await api.toggleSessionLock(sessionCode);
      setIsLocked(r.isLocked);
      socket.emit('toggle_lock', { sessionCode, isLocked: r.isLocked });
      addToast?.(r.message, 'info');
    } catch (err) { addToast?.(err.message, 'danger'); }
  };

  /* ── Code Runner ── */
  function fmt(x) {
    if (typeof x === 'object' && x !== null) { try { return JSON.stringify(x, null, 2); } catch { return String(x); } }
    return String(x);
  }

  const handleRun = () => {
    setSidebarTab('console');
    setSidebarOpen(true);
    setIsRunning(true);
    setConsoleOut([]);
    const logs = [];
    const t = performance.now();
    const cc = {
      log:   (...a) => logs.push({ type: 'log',   text: a.map(fmt).join(' ') }),
      info:  (...a) => logs.push({ type: 'info',  text: a.map(fmt).join(' ') }),
      warn:  (...a) => logs.push({ type: 'warn',  text: a.map(fmt).join(' ') }),
      error: (...a) => logs.push({ type: 'error', text: a.map(fmt).join(' ') }),
    };
    try {
      if (language === 'javascript') {
        const res = new Function('console', code)(cc);
        if (res !== undefined) logs.push({ type: 'result', text: `↩ ${fmt(res)}` });
      } else {
        logs.push({ type: 'info', text: `[Runner] Simulating ${language.toUpperCase()} output…` });
        const rx = /print\((.*?)\)/g;
        let m; let printed = false;
        while ((m = rx.exec(code)) !== null) {
          try   { logs.push({ type: 'log', text: String(new Function('return ' + m[1])()) }); }
          catch { logs.push({ type: 'log', text: m[1].replace(/["']/g, '') }); }
          printed = true;
        }
        if (!printed) logs.push({ type: 'log', text: 'Program completed without output.' });
      }
      logs.push({ type: 'system', text: `✔ Done in ${(performance.now() - t).toFixed(2)} ms` });
    } catch (err) {
      logs.push({ type: 'error', text: `RuntimeError: ${err.message}` });
    } finally {
      setConsoleOut(logs);
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    addToast?.(`Copied "${sessionCode}"`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isHost = user && session && (user.id === session.host_user_id || isAdmin);

  const langClass = { javascript:'lang-js', python:'lang-py', typescript:'lang-ts', html:'lang-html', css:'lang-css', json:'lang-json' };

  if (loadError) {
    return (
      <div className="page-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: '2.5rem 2rem', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-white)' }}>
            Session Not Found or Expired
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            The session room <code style={{ color: 'var(--indigo-500)', background: 'var(--bg-card-2)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{sessionCode}</code> could not be loaded. It may have ended or the invite link has expired.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onSwitchSession?.('collab-live-demo')}>
              Return to Live Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-layout">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-session-title">
            {session?.title || 'Collaborative Session'}
          </span>

          <button className="session-code-badge" onClick={copyCode} title="Click to copy session code">
            {sessionCode}
            {copiedCode ? <Check size={12} color="var(--emerald)" /> : <Copy size={12} />}
          </button>

          {/* Language selector */}
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.28rem 0.6rem', fontSize: '0.78rem' }}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {['javascript','python','typescript','html','css','json'].map(l => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>

          {isLocked && (
            <span className="lock-warning"><Lock size={11} /> Read-Only</span>
          )}

          {/* Active Collaborators Presence Cluster */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              cursor: 'pointer', 
              padding: '0.15rem 0.5rem', 
              borderRadius: 'var(--r-md)', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-subtle)',
              marginLeft: '0.2rem'
            }}
            onClick={() => { setSidebarTab('users'); setSidebarOpen(true); }}
            title="Click to view all collaborators"
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {participants.slice(0, 4).map((p, idx) => (
                <div
                  key={p.socketId || idx}
                  className="avatar-badge"
                  style={{
                    width: 22,
                    height: 22,
                    marginLeft: idx > 0 ? -6 : 0,
                    border: '2px solid var(--bg-surface)',
                    background: p.user?.avatar_color || '#6366f1',
                    zIndex: 10 - idx,
                    fontSize: '0.62rem'
                  }}
                  title={`${p.user?.username || 'Collaborator'} (${p.user?.id === user?.id ? 'You' : 'Collaborator'})`}
                >
                  {p.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              ))}
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-bright)' }}>
              {participants.length} {participants.length === 1 ? 'dev' : 'devs'}
            </span>
          </div>
        </div>

        <div className="toolbar-right">
          <button className="btn btn-success btn-sm" onClick={handleRun} disabled={isRunning}>
            <Zap size={13} />
            {isRunning ? 'Running…' : 'Run'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSaveOpen(true)}>
            <Save size={13} />
            Save
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            <Share2 size={13} />
            Invite
          </button>
          {isHost && (
            <button
              className={`btn btn-sm ${isLocked ? 'btn-danger' : 'btn-secondary'}`}
              onClick={handleToggleLock}
            >
              {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
              {isLocked ? 'Locked' : 'Lock'}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {sidebarOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className="editor-workspace">
        {/* Monaco */}
        <div className="monaco-wrapper">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme={theme === 'light' ? 'vs' : 'vs-dark'}
            options={{
              fontSize: 14,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              readOnly: isLocked && !isHost,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <aside className="editor-sidebar">
            <div className="sidebar-tabs">
              <button className={`sidebar-tab-btn ${sidebarTab === 'chat'    ? 'active' : ''}`} onClick={() => setSidebarTab('chat')}>
                <MessageSquare size={13} />
                Chat
                {unread > 0 && (
                  <span style={{ background: 'var(--indigo-500)', color: '#fff', borderRadius: '999px', padding: '0.05rem 0.38rem', fontSize: '0.62rem', fontWeight: 700, marginLeft: 2 }}>
                    {unread}
                  </span>
                )}
              </button>
              <button className={`sidebar-tab-btn ${sidebarTab === 'users'   ? 'active' : ''}`} onClick={() => setSidebarTab('users')}>
                <Users size={13} />
                People ({participants.length})
              </button>
              <button className={`sidebar-tab-btn ${sidebarTab === 'console' ? 'active' : ''}`} onClick={() => setSidebarTab('console')}>
                <Terminal size={13} />
                Console
                {consoleOut.length > 0 && <span className="badge badge-live" style={{ padding: '0.05rem 0.35rem', fontSize: '0.62rem', marginLeft: 2 }}>{consoleOut.length}</span>}
              </button>
            </div>

            <div className="sidebar-tab-content">
              {/* ── CHAT ── */}
              {sidebarTab === 'chat' && (
                <div className="chat-container">
                  <div className="chat-messages">
                    {chats.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem', padding: '2rem 1rem' }}>
                        No messages yet.<br />Say hello to your collaborators!
                      </div>
                    ) : chats.map((c, i) => {
                      const mine = user && (c.user?.id === user.id || c.user_id === user.id);
                      return (
                        <div key={c.id || i} className={`chat-bubble ${mine ? 'mine' : ''}`}>
                          <div className="chat-meta">
                            <span style={{ fontWeight: 700, color: c.user?.avatar_color || '#818cf8' }}>
                              {c.user?.username || c.username || 'User'}
                            </span>
                            <span>{c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}</span>
                          </div>
                          <div className="chat-text">{c.message}</div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="chat-input-bar">
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem' }}
                      placeholder="Send a message…"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.48rem 0.65rem' }}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}

              {/* ── COLLABORATORS ── */}
              {sidebarTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="section-heading">Online right now</div>

                  {participants.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem', padding: '1.5rem 0' }}>
                      No one else is connected yet.
                    </div>
                  ) : participants.map((p, i) => {
                    const isSelf  = user && p.user?.id === user.id;
                    const isH     = session && p.user?.id === session.host_user_id;
                    return (
                      <div key={p.socketId || i} className="participant-item">
                        <div className="participant-info">
                          <div className="avatar-badge" style={{ width: 28, height: 28, background: p.user?.avatar_color || '#6366f1' }}>
                            {p.user?.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="participant-name">
                              {p.user?.username || 'User'} {isSelf && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(you)</span>}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                              {isH ? '👑 Host' : 'Collaborator'}
                            </div>
                          </div>
                        </div>
                        <div className="flex-row">
                          {p.user?.role === 'admin' && <span className="role-badge admin">Admin</span>}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.78rem' }} onClick={() => setInviteOpen(true)}>
                      <Share2 size={13} /> Invite More Developers
                    </button>
                  </div>
                </div>
              )}

              {/* ── CONSOLE ── */}
              {sidebarTab === 'console' && (
                <div className="console-container">
                  <div className="console-header">
                    <span>Output</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConsoleOut([])}>
                      <Trash2 size={12} /> Clear
                    </button>
                  </div>
                  <div className="console-output-box">
                    {consoleOut.length === 0
                      ? <span style={{ color: 'var(--text-dim)' }}>Click "Run" to execute and see output here.</span>
                      : consoleOut.map((o, i) => (
                          <div key={i} style={{
                            color: o.type === 'error' ? '#f87171' : o.type === 'warn' ? '#fbbf24' : o.type === 'system' ? '#34d399' : o.type === 'result' ? '#818cf8' : '#e2e8f0',
                            marginBottom: '0.3rem'
                          }}>
                            {o.text}
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Modals ── */}
      <InviteModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} sessionCode={sessionCode} invites={invites} onInviteSent={loadSession} addToast={addToast} />
      <SaveProjectModal isOpen={saveOpen} onClose={() => setSaveOpen(false)} session={session} currentCode={code} addToast={addToast} onProjectSaved={loadSession} />
    </div>
  );
}
