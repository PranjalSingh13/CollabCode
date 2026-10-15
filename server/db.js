const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'collabcode.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize database tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      avatar_color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      language TEXT DEFAULT 'javascript',
      is_public INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coding_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_code TEXT UNIQUE NOT NULL,
      project_id INTEGER,
      host_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      language TEXT DEFAULT 'javascript',
      is_active INTEGER DEFAULT 1,
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS source_code (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      session_id INTEGER,
      file_name TEXT NOT NULL DEFAULT 'main.js',
      language TEXT DEFAULT 'javascript',
      content TEXT DEFAULT '',
      version INTEGER DEFAULT 1,
      last_modified_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES coding_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS session_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      invited_email TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES coding_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES coding_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // already seeded

  console.log('🌱 Seeding initial database records...');

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, status, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminPass = bcrypt.hashSync('admin123', 10);
  const alicePass = bcrypt.hashSync('alice123', 10);
  const bobPass = bcrypt.hashSync('bob123', 10);

  const adminRes = insertUser.run('admin', 'admin@collabcode.dev', adminPass, 'admin', 'active', '#ec4899');
  const aliceRes = insertUser.run('alice', 'alice@collabcode.dev', alicePass, 'user', 'active', '#6366f1');
  const bobRes = insertUser.run('bob', 'bob@collabcode.dev', bobPass, 'user', 'active', '#10b981');

  const adminId = Number(adminRes.lastInsertRowid);
  const aliceId = Number(aliceRes.lastInsertRowid);
  const bobId = Number(bobRes.lastInsertRowid);

  // Seed sample projects
  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, owner_id, language, is_public)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSourceCode = db.prepare(`
    INSERT INTO source_code (project_id, session_id, file_name, language, content, last_modified_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const proj1 = insertProject.run(
    'Real-time Algorithms Suite',
    'Collection of sorting and searching algorithms with benchmarking for collaborative review.',
    aliceId,
    'javascript',
    1
  );
  const proj1Id = Number(proj1.lastInsertRowid);

  const sampleJsCode = `// ⚡ CollabCode - Real-time Sorting & Search Suite
// Multiple developers can edit this simultaneously!

function quicksort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quicksort(left), ...middle, ...quicksort(right)];
}

function binarySearch(arr, target) {
  let low = 0;
  let high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

// Quick Test execution
const sampleData = [45, 12, 85, 32, 89, 39, 69, 44, 42, 1, 99];
console.log("Original List:", sampleData);

const sorted = quicksort(sampleData);
console.log("Sorted Array:", sorted);

const target = 44;
const foundIdx = binarySearch(sorted, target);
console.log(\`Target \${target} found at sorted index: \${foundIdx}\`);
`;

  insertSourceCode.run(proj1Id, null, 'quicksort.js', 'javascript', sampleJsCode, aliceId);

  // Project 2: Python Data Analysis
  const proj2 = insertProject.run(
    'Async Event Pipeline',
    'Demonstration of publisher-subscriber message broker simulation in Python.',
    bobId,
    'python',
    1
  );
  const proj2Id = Number(proj2.lastInsertRowid);

  const samplePyCode = `# CollabCode Python Demo: Pub/Sub Event Hub
import time
import json

class EventBroker:
    def __init__(self):
        self.subscribers = {}

    def subscribe(self, topic, handler):
        if topic not in self.subscribers:
            self.subscribers[topic] = []
        self.subscribers[topic].append(handler)
        print(f"[Broker] New subscriber registered for topic: '{topic}'")

    def publish(self, topic, payload):
        print(f"\\n[Broker] Broadcast on '{topic}': {json.dumps(payload)}")
        if topic in self.subscribers:
            for handler in self.subscribers[topic]:
                handler(payload)

hub = EventBroker()
hub.subscribe("editor:sync", lambda data: print(f"  -> Collaborator {data.get('user')} edited line {data.get('line')}"))
hub.subscribe("editor:sync", lambda data: print(f"  -> Audit log saved snapshot version {data.get('version')}"))

hub.publish("editor:sync", {"user": "Alice", "line": 42, "version": 5})
print("\\nSession ready for collaborative development!")
`;
  insertSourceCode.run(proj2Id, null, 'broker.py', 'python', samplePyCode, bobId);

  // Seed active coding session
  const insertSession = db.prepare(`
    INSERT INTO coding_sessions (session_code, project_id, host_user_id, title, language, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sessRes = insertSession.run('collab-live-demo', proj1Id, aliceId, 'Live Algorithms Pair-Programming', 'javascript', 1);
  const sessId = Number(sessRes.lastInsertRowid);

  insertSourceCode.run(null, sessId, 'main.js', 'javascript', sampleJsCode, aliceId);

  // Seed a welcome chat message
  db.prepare(`
    INSERT INTO chat_messages (session_id, user_id, message)
    VALUES (?, ?, ?)
  `).run(sessId, aliceId, 'Welcome to the collaborative session! Feel free to edit code in real-time or run it.');

  console.log('✅ Database seeded successfully with demo users, projects, and active session.');
}

module.exports = {
  db,
  initDb
};
