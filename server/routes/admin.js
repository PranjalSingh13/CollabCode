const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/stats - System stats
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM coding_sessions').get().count;
    const activeSessions = db.prepare('SELECT COUNT(*) as count FROM coding_sessions WHERE is_active = 1').get().count;
    const totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
    const totalSourceFiles = db.prepare('SELECT COUNT(*) as count FROM source_code').get().count;

    const recentSessions = db.prepare(`
      SELECT cs.id, cs.session_code, cs.title, cs.language, cs.is_active, cs.created_at, u.username as host_username
      FROM coding_sessions cs
      JOIN users u ON cs.host_user_id = u.id
      ORDER BY cs.created_at DESC
      LIMIT 5
    `).all();

    const recentUsers = db.prepare(`
      SELECT id, username, email, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalSessions,
        activeSessions,
        totalProjects,
        totalSourceFiles
      },
      recentSessions,
      recentUsers
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats.' });
  }
});

// GET /api/admin/users - Manage Users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.role, 
        u.status, 
        u.avatar_color, 
        u.created_at,
        (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) as projects_count,
        (SELECT COUNT(*) FROM coding_sessions cs WHERE cs.host_user_id = u.id) as sessions_hosted
      FROM users u
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// POST /api/admin/users - Create User as Admin
router.post('/users', (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username.trim(), email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, status, avatar_color)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(username.trim(), email.trim().toLowerCase(), passwordHash, role === 'admin' ? 'admin' : 'user', avatarColor);

    const createdUser = db.prepare('SELECT id, username, email, role, status, avatar_color, created_at FROM users WHERE id = ?').get(Number(insert.lastInsertRowid));

    res.status(201).json({
      message: 'User created successfully',
      user: createdUser
    });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PUT /api/admin/users/:id/role - Toggle / Update Role
router.put('/users/:id/role', (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: "Role must be 'admin' or 'user'." });
    }

    if (targetUserId === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote your own admin account.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetUserId);
    const updated = db.prepare('SELECT id, username, email, role, status FROM users WHERE id = ?').get(targetUserId);

    res.json({ message: `Role updated to ${role}`, user: updated });
  } catch (err) {
    console.error('Admin role update error:', err);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// PUT /api/admin/users/:id/status - Toggle Status (active / suspended)
router.put('/users/:id/status', (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'active' or 'suspended'." });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    }

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, targetUserId);
    const updated = db.prepare('SELECT id, username, email, role, status FROM users WHERE id = ?').get(targetUserId);

    res.json({ message: `User status set to ${status}`, user: updated });
  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// DELETE /api/admin/users/:id - Delete User
router.delete('/users/:id', (req, res) => {
  try {
    const targetUserId = Number(req.params.id);

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/sessions - Manage Coding Sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT 
        cs.*,
        u.username as host_username,
        u.email as host_email,
        u.avatar_color as host_avatar_color,
        p.name as project_name,
        (SELECT COUNT(*) FROM session_invites si WHERE si.session_id = cs.id) as invite_count,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) as chat_count
      FROM coding_sessions cs
      JOIN users u ON cs.host_user_id = u.id
      LEFT JOIN projects p ON cs.project_id = p.id
      ORDER BY cs.is_active DESC, cs.created_at DESC
    `).all();

    res.json({ sessions });
  } catch (err) {
    console.error('Admin get sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
});

// POST /api/admin/sessions/:id/terminate - Force terminate session
router.post('/sessions/:id/terminate', (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const session = db.prepare('SELECT * FROM coding_sessions WHERE id = ?').get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    db.prepare('UPDATE coding_sessions SET is_active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);

    // If socket io is attached to app, notify room
    const io = req.app.get('io');
    if (io) {
      io.to(session.session_code).emit('session_terminated_by_admin', {
        message: 'This session was terminated by an administrator.'
      });
    }

    res.json({ message: 'Session forcefully terminated by admin.' });
  } catch (err) {
    console.error('Admin terminate session error:', err);
    res.status(500).json({ error: 'Failed to terminate session.' });
  }
});

// DELETE /api/admin/sessions/:id - Delete session
router.delete('/sessions/:id', (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    db.prepare('DELETE FROM coding_sessions WHERE id = ?').run(sessionId);
    res.json({ message: 'Session deleted successfully.' });
  } catch (err) {
    console.error('Admin delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

module.exports = router;
