const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

function generateSessionCode() {
  const adjectives = ['cyber', 'quantum', 'hyper', 'swift', 'stellar', 'neon', 'matrix', 'vector'];
  const nouns = ['hub', 'lab', 'node', 'core', 'byte', 'spark', 'flow', 'orbit'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

// GET /api/sessions - list active public / user sessions
router.get('/', optionalAuth, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : 0;
    const sessions = db.prepare(`
      SELECT 
        cs.*,
        u.username as host_username,
        u.avatar_color as host_avatar_color,
        p.name as project_name,
        (SELECT COUNT(*) FROM session_invites si WHERE si.session_id = cs.id) as invite_count
      FROM coding_sessions cs
      JOIN users u ON cs.host_user_id = u.id
      LEFT JOIN projects p ON cs.project_id = p.id
      WHERE cs.is_active = 1 OR cs.host_user_id = ?
      ORDER BY cs.is_active DESC, cs.created_at DESC
    `).all(currentUserId);

    res.json({ sessions });
  } catch (err) {
    console.error('Fetch sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
});

// POST /api/sessions - create coding session
router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, language = 'javascript', projectId, initialCode, fileName } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Session title is required.' });
    }

    const sessionCode = generateSessionCode();

    const insertSession = db.prepare(`
      INSERT INTO coding_sessions (session_code, project_id, host_user_id, title, language, is_active, is_locked)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `);

    const result = insertSession.run(sessionCode, projectId || null, req.user.id, title.trim(), language);
    const sessionId = Number(result.lastInsertRowid);

    // Initial code
    let codeContent = initialCode;
    let codeFile = fileName || (language === 'python' ? 'main.py' : 'main.js');

    if (!codeContent && projectId) {
      // Pull first file from existing project if linked
      const existingFile = db.prepare('SELECT file_name, language, content FROM source_code WHERE project_id = ? LIMIT 1').get(projectId);
      if (existingFile) {
        codeContent = existingFile.content;
        codeFile = existingFile.file_name;
      }
    }

    if (!codeContent) {
      codeContent = language === 'python'
        ? `# 🐍 Python Live Collaborative Session: ${title.trim()}
# Type code together and click "Run Code" to test!

def welcome(name):
    return f"Welcome {name} to CollabCode real-time editor!"

print(welcome("${req.user.username}"))
`
        : `// ⚡ Real-Time Collaborative Session: ${title.trim()}
// Share the session code or invite link with collaborators!

function calculateStats(numbers) {
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / numbers.length;
  return { sum, avg, count: numbers.length };
}

const scores = [88, 92, 79, 95, 100, 84];
console.log("Analysis:", calculateStats(scores));
`;
    }

    // Insert source code linked to this session
    db.prepare(`
      INSERT INTO source_code (project_id, session_id, file_name, language, content, last_modified_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId || null, sessionId, codeFile, language, codeContent, req.user.id);

    const session = db.prepare(`
      SELECT cs.*, u.username as host_username, u.avatar_color as host_avatar_color
      FROM coding_sessions cs
      JOIN users u ON cs.host_user_id = u.id
      WHERE cs.id = ?
    `).get(sessionId);

    res.status(201).json({
      message: 'Coding session created successfully',
      session,
      sessionCode
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create coding session.' });
  }
});

// GET /api/sessions/invites/my-invites - get pending invites for current user
router.get('/invites/my-invites', authenticateToken, (req, res) => {
  try {
    const myEmail = (req.user.email || '').toLowerCase().trim();
    const myUsername = (req.user.username || '').toLowerCase().trim();

    const invites = db.prepare(`
      SELECT 
        si.id as invite_id,
        si.invited_email,
        si.status,
        si.created_at,
        cs.session_code,
        cs.title as session_title,
        cs.language,
        cs.is_active,
        u.username as host_username,
        u.avatar_color as host_avatar_color
      FROM session_invites si
      JOIN coding_sessions cs ON si.session_id = cs.id
      JOIN users u ON cs.host_user_id = u.id
      WHERE (LOWER(si.invited_email) = ? OR LOWER(si.invited_email) = ?)
        AND si.status = 'pending'
        AND cs.is_active = 1
      ORDER BY si.created_at DESC
    `).all(myEmail, myUsername);

    res.json({ invites });
  } catch (err) {
    console.error('Fetch my invites error:', err);
    res.status(500).json({ error: 'Failed to retrieve your invitations.' });
  }
});

// PUT /api/sessions/invites/:id/accept - accept session invite
router.put('/invites/:id/accept', authenticateToken, (req, res) => {
  try {
    const inviteId = req.params.id;
    const invite = db.prepare(`
      SELECT si.*, cs.session_code, cs.is_active
      FROM session_invites si
      JOIN coding_sessions cs ON si.session_id = cs.id
      WHERE si.id = ?
    `).get(inviteId);

    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    db.prepare("UPDATE session_invites SET status = 'accepted' WHERE id = ?").run(inviteId);

    res.json({
      message: 'Invitation accepted!',
      sessionCode: invite.session_code
    });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
});

// PUT /api/sessions/invites/:id/decline - decline session invite
router.put('/invites/:id/decline', authenticateToken, (req, res) => {
  try {
    const inviteId = req.params.id;
    db.prepare("UPDATE session_invites SET status = 'revoked' WHERE id = ?").run(inviteId);
    res.json({ message: 'Invitation declined.' });
  } catch (err) {
    console.error('Decline invite error:', err);
    res.status(500).json({ error: 'Failed to decline invitation.' });
  }
});

// GET /api/sessions/:code - get session details and active code
router.get('/:code', optionalAuth, (req, res) => {
  try {
    const code = req.params.code;
    const session = db.prepare(`
      SELECT 
        cs.*,
        u.username as host_username,
        u.email as host_email,
        u.avatar_color as host_avatar_color,
        p.name as project_name
      FROM coding_sessions cs
      JOIN users u ON cs.host_user_id = u.id
      LEFT JOIN projects p ON cs.project_id = p.id
      WHERE cs.session_code = ?
    `).get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or has been expired.' });
    }

    // Get source code files for this session
    let files = db.prepare(`
      SELECT id, file_name, language, content, version, updated_at
      FROM source_code
      WHERE session_id = ?
      ORDER BY id ASC
    `).all(session.id);

    // Fallback to project files if none explicitly tied to session yet
    if (files.length === 0 && session.project_id) {
      files = db.prepare(`
        SELECT id, file_name, language, content, version, updated_at
        FROM source_code
        WHERE project_id = ?
        ORDER BY id ASC
      `).all(session.project_id);
    }

    // Recent chat history
    const chats = db.prepare(`
      SELECT cm.id, cm.message, cm.created_at, u.username, u.avatar_color, u.id as user_id
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.session_id = ?
      ORDER BY cm.created_at ASC
      LIMIT 100
    `).all(session.id);

    // Invites
    const invites = db.prepare(`
      SELECT id, invited_email, status, created_at
      FROM session_invites
      WHERE session_id = ?
      ORDER BY created_at DESC
    `).all(session.id);

    const isHost = req.user ? (req.user.id === session.host_user_id || req.user.role === 'admin') : false;

    res.json({
      session,
      files,
      chats,
      invites,
      isHost
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Failed to retrieve session details.' });
  }
});

// POST /api/sessions/:code/invite - invite collaborator
router.post('/:code/invite', authenticateToken, (req, res) => {
  try {
    const code = req.params.code;
    const session = db.prepare('SELECT id, host_user_id, title, is_active FROM coding_sessions WHERE session_code = ?').get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (!session.is_active) {
      return res.status(400).json({ error: 'Cannot send invites to an ended session.' });
    }

    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Collaborator email or username is required.' });
    }

    const targetInput = email.trim().toLowerCase();

    // Check if duplicate pending invite exists
    const existing = db.prepare(`
      SELECT id FROM session_invites
      WHERE session_id = ? AND LOWER(invited_email) = ? AND status = 'pending'
    `).get(session.id, targetInput);

    let inviteId;
    if (existing) {
      inviteId = existing.id;
    } else {
      const insert = db.prepare(`
        INSERT INTO session_invites (session_id, invited_email, status)
        VALUES (?, ?, 'pending')
      `).run(session.id, targetInput);
      inviteId = Number(insert.lastInsertRowid);
    }

    // Broadcast real-time invitation via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.emit('session_invite_received', {
        sessionCode: code,
        sessionTitle: session.title,
        invitedTarget: targetInput,
        invitedBy: req.user.username
      });
    }

    res.status(201).json({
      message: `Invitation sent to ${email.trim()}`,
      inviteId,
      sessionCode: code,
      inviteUrl: `/?session=${code}`
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to send invite.' });
  }
});

// DELETE /api/sessions/:code/invites/:id - revoke invite
router.delete('/:code/invites/:id', authenticateToken, (req, res) => {
  try {
    const { code, id } = req.params;
    const session = db.prepare('SELECT id, host_user_id FROM coding_sessions WHERE session_code = ?').get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    db.prepare('DELETE FROM session_invites WHERE id = ? AND session_id = ?').run(id, session.id);
    res.json({ message: 'Invitation revoked successfully.' });
  } catch (err) {
    console.error('Revoke invite error:', err);
    res.status(500).json({ error: 'Failed to revoke invitation.' });
  }
});

// POST /api/sessions/:code/save-project - Save current session code into Projects table
router.post('/:code/save-project', authenticateToken, (req, res) => {
  try {
    const code = req.params.code;
    const session = db.prepare('SELECT * FROM coding_sessions WHERE session_code = ?').get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const { projectName, description, codeContent, fileName } = req.body;
    const name = projectName ? projectName.trim() : `${session.title} (Snapshot)`;

    // Create a new project for this user
    const insertProj = db.prepare(`
      INSERT INTO projects (name, description, owner_id, language, is_public)
      VALUES (?, ?, ?, ?, 1)
    `).run(name, description || `Saved from collaborative session ${code}`, req.user.id, session.language);

    const newProjectId = Number(insertProj.lastInsertRowid);

    // Save source code
    const file = fileName || (session.language === 'python' ? 'main.py' : 'main.js');
    db.prepare(`
      INSERT INTO source_code (project_id, file_name, language, content, last_modified_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(newProjectId, file, session.language, codeContent || '', req.user.id);

    // Link session to this project if none was linked
    if (!session.project_id) {
      db.prepare('UPDATE coding_sessions SET project_id = ? WHERE id = ?').run(newProjectId, session.id);
    }

    res.status(201).json({
      message: 'Project saved successfully!',
      projectId: newProjectId
    });
  } catch (err) {
    console.error('Save project error:', err);
    res.status(500).json({ error: 'Failed to save project from session.' });
  }
});

// PUT /api/sessions/:code/toggle-lock - Lock / Unlock session editing
router.put('/:code/toggle-lock', authenticateToken, (req, res) => {
  try {
    const code = req.params.code;
    const session = db.prepare('SELECT id, host_user_id, is_locked FROM coding_sessions WHERE session_code = ?').get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.host_user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the host or admin can toggle lock.' });
    }

    const newLockedState = session.is_locked ? 0 : 1;
    db.prepare('UPDATE coding_sessions SET is_locked = ? WHERE id = ?').run(newLockedState, session.id);

    res.json({
      message: newLockedState ? 'Session locked to read-only' : 'Session unlocked for editing',
      isLocked: Boolean(newLockedState)
    });
  } catch (err) {
    console.error('Lock error:', err);
    res.status(500).json({ error: 'Failed to toggle lock.' });
  }
});

// PUT /api/sessions/:code/end - Host closes session
router.put('/:code/end', authenticateToken, (req, res) => {
  try {
    const code = req.params.code;
    const session = db.prepare('SELECT id, host_user_id FROM coding_sessions WHERE session_code = ?').get(code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.host_user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only host or admin can end this session.' });
    }

    db.prepare('UPDATE coding_sessions SET is_active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);
    res.json({ message: 'Session closed successfully.' });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ error: 'Failed to end session.' });
  }
});

module.exports = router;
