import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { getSocket } from './services/socket';
import { api } from './services/api';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import JoinGate from './components/JoinGate';
import EditorView from './views/EditorView';
import ProjectsView from './views/ProjectsView';
import SessionsHubView from './views/SessionsHubView';
import AdminView from './views/AdminView';

function sanitizeSessionCode(raw) {
  if (!raw) return 'collab-live-demo';
  let val = String(raw).trim();
  if (val.includes('session=')) {
    const match = val.match(/[?&]session=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]).trim();
  }
  if (val.startsWith('http://') || val.startsWith('https://')) {
    try {
      const url = new URL(val);
      const param = url.searchParams.get('session');
      if (param) return param.trim();
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1].trim();
    } catch (e) {}
  }
  return val.replace(/^[/?#]+/, '').replace(/[/?#]+$/, '').trim();
}

function MainApp() {
  const { user, setDisplayName } = useAuth();
  const socket = getSocket();

  // Navigation and active session state
  const [currentView, setCurrentView] = useState('editor'); // 'editor' | 'projects' | 'sessions' | 'admin'
  const [activeSessionCode, setActiveSessionCode] = useState('collab-live-demo');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Join Gate: show name-entry screen when arriving via ?session= link
  const [gateSession, setGateSession] = useState(null);   // session code pending gate
  const [gateVisible, setGateVisible] = useState(false);  // show/hide gate

  // Check URL query param on mount e.g. ?session=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
      const cleanCode = sanitizeSessionCode(sessionParam);
      // Show the name gate ONLY if no custom name has been saved yet
      const storedName = localStorage.getItem('collabcode_custom_name');
      if (!storedName) {
        setGateSession(cleanCode);
        setGateVisible(true);
      } else {
        setActiveSessionCode(cleanCode);
        setCurrentView('editor');
      }
    }
  }, []);

  // Monitor socket connection status and listen for live invitations
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onInviteReceived = (data) => {
      if (!user) return;
      const myEmail = (user.email || '').toLowerCase();
      const myUser = (user.username || '').toLowerCase();
      const target = (data.invitedTarget || '').toLowerCase();

      if (target === myEmail || target === myUser) {
        addToast(
          `📬 ${data.invitedBy || 'A teammate'} invited you to join "${data.sessionTitle || data.sessionCode}"!`,
          'info'
        );
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session_invite_received', onInviteReceived);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session_invite_received', onInviteReceived);
    };
  }, [socket, user]);

  // Toast notification manager
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleJoinSession = (rawCode) => {
    const clean = sanitizeSessionCode(rawCode);
    setActiveSessionCode(clean);
    setCurrentView('editor');
    // Update browser URL without reload
    window.history.pushState({}, '', `?session=${clean}`);
  };

  const handleLaunchSessionFromProject = async (project) => {
    try {
      const res = await api.createSession({
        title: `${project.name} (Live Pair)`,
        language: project.language,
        projectId: project.id
      });
      addToast(`Session launched for ${project.name}`, 'success');
      handleJoinSession(res.sessionCode);
    } catch (err) {
      addToast(err.message || 'Failed to launch session', 'danger');
    }
  };

  // Called by JoinGate when the user submits their name
  const handleGateJoin = (name, color) => {
    // Persist prefs first so setDisplayName can read it
    const stored = JSON.parse(localStorage.getItem('collabcode_user_prefs') || '{}');
    localStorage.setItem('collabcode_user_prefs', JSON.stringify({ ...stored, avatar_color: color }));
    // Set name in state + localStorage
    setDisplayName(name, color);
    // Small delay lets the setDisplayName state update flush before EditorView mounts
    // and emits join_session — so the correct name is sent to the server from the start
    setTimeout(() => {
      setGateVisible(false);
      setActiveSessionCode(gateSession);
      setCurrentView('editor');
      window.history.replaceState({}, '', `?session=${gateSession}`);
    }, 80);
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isConnected={isConnected}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Join Gate — name entry lobby before entering a session */}
      {gateVisible && gateSession && (
        <JoinGate
          sessionCode={gateSession}
          onJoin={handleGateJoin}
        />
      )}

      {/* Main View Display */}
      <main className="main-view-container">
        {currentView === 'editor' && (
          <EditorView
            sessionCode={activeSessionCode}
            onSwitchSession={handleJoinSession}
            addToast={addToast}
          />
        )}

        {currentView === 'projects' && (
          <ProjectsView
            onLaunchSessionFromProject={handleLaunchSessionFromProject}
            addToast={addToast}
          />
        )}

        {currentView === 'sessions' && (
          <SessionsHubView
            onJoinSession={handleJoinSession}
            addToast={addToast}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            onJoinSession={handleJoinSession}
            addToast={addToast}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        addToast={addToast}
      />

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{
            borderLeft: `4px solid ${
              t.type === 'success' ? '#10b981' :
              t.type === 'danger' ? '#f43f5e' :
              t.type === 'info' ? '#6366f1' : '#3b82f6'
            }`
          }}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
