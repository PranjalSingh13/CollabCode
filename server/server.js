const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const { initDb } = require('./db');
const { registerSocketHandlers } = require('./socketHandler');

const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const sessionsRoutes = require('./routes/sessions');
const adminRoutes = require('./routes/admin');

// Initialize database schema and pre-seeded accounts
initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Provide socket.io instance to Express routes
app.set('io', io);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CollabCode API Engine',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'CollabCode Collaborative Code Editor API is running!',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      sessions: '/api/sessions',
      admin: '/api/admin',
      health: '/api/health'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Register real-time Socket.IO collaboration handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CollabCode Backend Server running on http://localhost:${PORT}`);
});
