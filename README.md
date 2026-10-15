# ⚡ CollabCode — Real-Time Collaborative Code Editor & Workspace

A full-stack real-time collaborative code editor application built with **React**, **Monaco Editor**, **Node.js**, **Express**, **Socket.IO**, and **SQLite**.

---

## 🚀 Key Modules & Capabilities

### 👑 Admin Module
- **Manage Users**:
  - View all registered users with system activity (projects count, sessions hosted, creation date).
  - Promote / Demote user roles (`admin` ↔ `user`).
  - Toggle user account status (`active` ↔ `suspended`).
  - Create new users directly with temporary credentials.
  - Delete user accounts with safety checks.
- **Manage Coding Sessions**:
  - Live inspection of all active and historical sessions.
  - Force-terminate any live session in real time with WebSocket broadcast to connected peers.
  - Delete sessions and inspect host participant logs.
- **Database & Telemetry Overview**:
  - Live table statistics and schema telemetry for all 4 primary database tables.

---

### 💻 User Module
- **Create Coding Session**:
  - Spin up live collaborative rooms with custom titles and language presets (`JavaScript`, `Python`, `TypeScript`, `HTML`, `CSS`, `JSON`).
  - Optionally preload code from an existing saved project.
- **Invite Collaborators**:
  - Generate instant shareable session invite links (`?session=code`).
  - 1-click copy session code badge.
  - In-app and email collaborator invitations with status tracking (`pending`, `accepted`).
- **Edit Code (Real-Time)**:
  - Monaco code editor (same engine powering VS Code) with syntax highlighting, line numbers, and minimap.
  - Ultra-fast real-time synchronization across multiple collaborators via Socket.IO.
  - Multi-user cursor tracking and active collaborator presence list with custom avatar colors.
  - Host session lock / unlock toggle (set read-only mode for demonstrations or pair-programming interviews).
- **Save Projects**:
  - Save any live collaborative session snapshot directly into the permanent `projects` and `source_code` database tables.
  - Manage saved projects repository (filter by My Projects, Public Projects, All).
  - Launch brand new live coding sessions directly from any saved project.
  - Fork projects into personal workspace or download source code files locally with 1 click.

---

### 🌟 Bonus Features Included
- **In-Browser Code Runner Sandbox**:
  - Click **"Run Code"** to execute JavaScript or Python scripts in a safe client sandbox with captured standard output, return values, runtime duration in milliseconds, and formatted error stack traces.
- **Real-Time In-Session Chat**:
  - Instant live messaging sidebar with user timestamps and unread message counter badge.
- **1-Click Persona Switcher**:
  - Easily toggle between `Admin`, `Alice`, and `Bob` in 1 click from the navigation bar to test multi-user pairing in two tabs or windows without typing passwords!

---

## 🗄️ Relational Database Schema (`collabcode.db`)

The database consists of the 4 requested tables:

```sql
-- 1. Users Table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
  avatar_color TEXT DEFAULT '#6366f1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Project Table
CREATE TABLE projects (
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

-- 3. Coding Sessions Table
CREATE TABLE coding_sessions (
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

-- 4. Source Code Table
CREATE TABLE source_code (
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
```

---

## 🔑 Pre-Seeded Test Accounts

| Persona | Username | Email | Password | Role | Permissions |
|---|---|---|---|---|---|
| **Admin** | `admin` | `admin@collabcode.dev` | `admin123` | `admin` | Full user & session administration, termination controls |
| **Alice** | `alice` | `alice@collabcode.dev` | `alice123` | `user` | Standard developer, default session host |
| **Bob** | `bob` | `bob@collabcode.dev` | `bob123` | `user` | Collaborator, pair-programming peer |

*(Tip: You can use the **Persona Switcher** in the top navigation bar to switch between accounts instantly.)*

---

## 🛠️ How to Run Locally

### 1. Backend Server (Port 5000)
```bash
cd server
npm install
npm run dev
# Server will run at http://localhost:5000
```

### 2. Frontend Client (Port 5173)
```bash
cd client
npm install
npm run dev
# Open http://localhost:5173 in your browser
```
