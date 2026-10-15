const { db } = require('./db');

// In-memory session tracking for ultra-fast sync and presence
const sessionRooms = new Map();
// sessionCode -> { participants: Map(socketId -> userObj), latestCode: string, fileId: number, debounceTimer: null }

function getOrCreateRoom(sessionCode) {
  if (!sessionRooms.has(sessionCode)) {
    // Attempt to load current code from DB
    const session = db.prepare('SELECT id, is_locked FROM coding_sessions WHERE session_code = ?').get(sessionCode);
    let initialCode = '';
    let fileId = null;

    if (session) {
      const codeRow = db.prepare('SELECT id, content FROM source_code WHERE session_id = ? LIMIT 1').get(session.id);
      if (codeRow) {
        initialCode = codeRow.content || '';
        fileId = codeRow.id;
      }
    }

    sessionRooms.set(sessionCode, {
      participants: new Map(),
      latestCode: initialCode,
      fileId,
      isLocked: session ? Boolean(session.is_locked) : false,
      saveTimer: null
    });
  }
  return sessionRooms.get(sessionCode);
}

function persistCodeToDb(sessionCode, room) {
  try {
    const session = db.prepare('SELECT id FROM coding_sessions WHERE session_code = ?').get(sessionCode);
    if (!session) return;

    if (room.fileId) {
      db.prepare(`
        UPDATE source_code 
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(room.latestCode, room.fileId);
    } else {
      const insert = db.prepare(`
        INSERT INTO source_code (session_id, file_name, language, content)
        VALUES (?, 'main.js', 'javascript', ?)
      `).run(session.id, room.latestCode);
      room.fileId = Number(insert.lastInsertRowid);
    }
  } catch (err) {
    console.error(`Error saving code for session ${sessionCode}:`, err);
  }
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    let currentSessionCode = null;
    let currentUser = null;

    // Join collaborative session
    socket.on('join_session', ({ sessionCode, user }) => {
      if (!sessionCode) return;

      currentSessionCode = sessionCode;
      currentUser = user || {
        id: 'anon-' + socket.id.slice(0, 5),
        username: 'Guest-' + socket.id.slice(0, 4),
        avatar_color: '#6366f1',
        role: 'user'
      };

      socket.join(sessionCode);
      const room = getOrCreateRoom(sessionCode);

      const alreadyInRoom = room.participants.has(socket.id);

      // Add/update participant in room
      room.participants.set(socket.id, {
        socketId: socket.id,
        user: currentUser,
        cursor: null,
        joinedAt: alreadyInRoom
          ? room.participants.get(socket.id).joinedAt
          : new Date().toISOString()
      });

      // Send initial state to the joining user
      socket.emit('session_init', {
        sessionCode,
        content: room.latestCode,
        fileId: room.fileId,
        isLocked: room.isLocked,
        participants: Array.from(room.participants.values())
      });

      if (alreadyInRoom) {
        // Same socket re-joined (e.g. after name update) — just sync participants for everyone
        io.to(sessionCode).emit('participants_updated', {
          participants: Array.from(room.participants.values()),
          updatedUser: currentUser
        });
      } else {
        // New participant — broadcast join to others
        socket.to(sessionCode).emit('user_joined', {
          user: currentUser,
          participants: Array.from(room.participants.values())
        });
      }

      console.log(`User ${currentUser.username} (${socket.id}) ${alreadyInRoom ? 're-joined' : 'joined'} session ${sessionCode}. Total: ${room.participants.size}`);
    });

    // Update collaborator profile / display name in real time
    socket.on('update_user_profile', ({ sessionCode, user }) => {
      if (!sessionCode || !sessionRooms.has(sessionCode)) return;
      currentUser = user;
      const room = sessionRooms.get(sessionCode);
      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.user = user;
      }
      io.to(sessionCode).emit('participants_updated', {
        participants: Array.from(room.participants.values()),
        updatedUser: user
      });
    });

    // Real-time code change event
    socket.on('code_change', ({ sessionCode, content, senderId }) => {
      const room = sessionRooms.get(sessionCode);
      if (!room) return;

      if (room.isLocked && currentUser && currentUser.role !== 'admin') {
        // Disallow edit if locked and not admin
        return;
      }

      room.latestCode = content;

      // Broadcast changes to all other peers in the room
      socket.to(sessionCode).emit('code_update', {
        content,
        senderId: socket.id,
        senderUsername: currentUser ? currentUser.username : 'Collaborator'
      });

      // Debounce saving to SQLite database every 2 seconds
      if (room.saveTimer) clearTimeout(room.saveTimer);
      room.saveTimer = setTimeout(() => {
        persistCodeToDb(sessionCode, room);
      }, 2000);
    });

    // Cursor position & selection sync
    socket.on('cursor_move', ({ sessionCode, position, selection }) => {
      const room = sessionRooms.get(sessionCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.cursor = { position, selection };
      }

      socket.to(sessionCode).emit('cursor_update', {
        socketId: socket.id,
        user: currentUser,
        position,
        selection
      });
    });

    // Live in-session chat
    socket.on('send_chat', ({ sessionCode, message }) => {
      if (!sessionCode || !message || !message.trim()) return;

      const trimmedMsg = message.trim();
      let savedId = null;

      try {
        const session = db.prepare('SELECT id FROM coding_sessions WHERE session_code = ?').get(sessionCode);
        if (session && currentUser && typeof currentUser.id === 'number') {
          const insert = db.prepare(`
            INSERT INTO chat_messages (session_id, user_id, message)
            VALUES (?, ?, ?)
          `).run(session.id, currentUser.id, trimmedMsg);
          savedId = Number(insert.lastInsertRowid);
        }
      } catch (err) {
        console.error('Save chat error:', err);
      }

      const chatPayload = {
        id: savedId || Date.now(),
        message: trimmedMsg,
        user: currentUser,
        created_at: new Date().toISOString()
      };

      // Broadcast chat message to everyone in the room (including sender)
      io.to(sessionCode).emit('new_chat_message', chatPayload);
    });

    // Toggle session lock
    socket.on('toggle_lock', ({ sessionCode, isLocked }) => {
      const room = sessionRooms.get(sessionCode);
      if (!room) return;

      room.isLocked = isLocked;
      io.to(sessionCode).emit('lock_state_changed', { isLocked });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (currentSessionCode && sessionRooms.has(currentSessionCode)) {
        const room = sessionRooms.get(currentSessionCode);
        room.participants.delete(socket.id);

        // Notify room
        socket.to(currentSessionCode).emit('user_left', {
          socketId: socket.id,
          user: currentUser,
          participants: Array.from(room.participants.values())
        });

        // If no more participants, immediately flush unsaved changes to DB
        if (room.participants.size === 0) {
          if (room.saveTimer) clearTimeout(room.saveTimer);
          persistCodeToDb(currentSessionCode, room);
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = {
  registerSocketHandlers,
  sessionRooms
};
