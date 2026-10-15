const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', 
  '#8b5cf6', '#14b8a6', '#f43f5e', '#06b6d4', '#84cc16'
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check existing
    const existing = db.prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?').get(username.trim(), email.trim().toLowerCase());
    if (existing) {
      if (existing.username.toLowerCase() === username.trim().toLowerCase()) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const avatarColor = getRandomColor();

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, status, avatar_color)
      VALUES (?, ?, ?, 'user', 'active', ?)
    `);

    const result = insert.run(username.trim(), email.trim().toLowerCase(), passwordHash, avatarColor);
    const userId = Number(result.lastInsertRowid);

    const user = {
      id: userId,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      role: 'user',
      status: 'active',
      avatar_color: avatarColor
    };

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { login, password } = req.body; // login can be username or email

    if (!login || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required.' });
    }

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
    `).get(login.trim(), login.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    const userObj = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar_color: user.avatar_color
    };

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Logged in successfully',
      user: userObj,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/demo-accounts - For quick 1-click test login in demo mode
router.get('/demo-accounts', (req, res) => {
  res.json({
    accounts: [
      { role: 'admin', username: 'admin', email: 'admin@collabcode.dev', password: 'admin123', label: 'Admin (System Operator)' },
      { role: 'user', username: 'alice', email: 'alice@collabcode.dev', password: 'alice123', label: 'Collaborator Alice' },
      { role: 'user', username: 'bob', email: 'bob@collabcode.dev', password: 'bob123', label: 'Collaborator Bob' }
    ]
  });
});

module.exports = router;
