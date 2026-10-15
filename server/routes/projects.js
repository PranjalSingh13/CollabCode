const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// GET /api/projects - list user's projects and public projects
router.get('/', optionalAuth, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : 0;
    const query = `
      SELECT 
        p.*,
        u.username as owner_username,
        u.avatar_color as owner_avatar_color,
        (SELECT COUNT(*) FROM source_code sc WHERE sc.project_id = p.id) as file_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.owner_id = ? OR p.is_public = 1
      ORDER BY p.updated_at DESC
    `;

    const projects = db.prepare(query).all(currentUserId);
    res.json({ projects });
  } catch (err) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

// GET /api/projects/:id - get single project and its source files
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare(`
      SELECT p.*, u.username as owner_username, u.avatar_color as owner_avatar_color
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Permission check
    const currentUserId = req.user ? req.user.id : null;
    const isOwner = currentUserId && project.owner_id === currentUserId;
    const isAdmin = req.user && req.user.role === 'admin';

    if (!project.is_public && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied to private project.' });
    }

    const files = db.prepare(`
      SELECT id, file_name, language, content, version, updated_at
      FROM source_code
      WHERE project_id = ?
      ORDER BY id ASC
    `).all(projectId);

    res.json({
      project,
      files,
      isOwner: Boolean(isOwner || isAdmin)
    });
  } catch (err) {
    console.error('Fetch project detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
});

// POST /api/projects - create new project
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, description, language = 'javascript', is_public = 1, initialCode, fileName } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const insertProj = db.prepare(`
      INSERT INTO projects (name, description, owner_id, language, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insertProj.run(name.trim(), description || '', req.user.id, language, is_public ? 1 : 0);
    const projectId = Number(result.lastInsertRowid);

    // Create default source code file
    const file = fileName || (language === 'python' ? 'main.py' : 'main.js');
    const defaultSnippet = initialCode || (
      language === 'python' 
        ? '# Welcome to your new Python project\nprint("Hello from CollabCode!")' 
        : '// Welcome to your new JavaScript project\nconsole.log("Hello from CollabCode!");'
    );

    db.prepare(`
      INSERT INTO source_code (project_id, file_name, language, content, last_modified_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, file, language, defaultSnippet, req.user.id);

    const createdProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.status(201).json({
      message: 'Project created successfully',
      project: createdProject
    });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// PUT /api/projects/:id - update project
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to edit this project.' });
    }

    const { name, description, is_public, language } = req.body;

    db.prepare(`
      UPDATE projects
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          is_public = COALESCE(?, is_public),
          language = COALESCE(?, language),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      description !== undefined ? description : null,
      is_public !== undefined ? (is_public ? 1 : 0) : null,
      language || null,
      projectId
    );

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.json({ message: 'Project updated successfully', project: updated });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to delete this project.' });
    }

    // Cascade deletes source_code via FK
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// POST /api/projects/:id/files - Add or update a file in project
router.post('/:id/files', authenticateToken, (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to modify this project.' });
    }

    const { file_name, language, content } = req.body;
    if (!file_name || !file_name.trim()) {
      return res.status(400).json({ error: 'File name is required.' });
    }

    // Check if file already exists
    const existing = db.prepare('SELECT id FROM source_code WHERE project_id = ? AND file_name = ?').get(projectId, file_name.trim());
    if (existing) {
      db.prepare(`
        UPDATE source_code
        SET content = ?, language = ?, last_modified_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(content || '', language || 'javascript', req.user.id, existing.id);

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
      return res.json({ message: 'File updated', fileId: existing.id });
    }

    const insert = db.prepare(`
      INSERT INTO source_code (project_id, file_name, language, content, last_modified_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, file_name.trim(), language || 'javascript', content || '', req.user.id);

    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
    res.status(201).json({ message: 'File created', fileId: Number(insert.lastInsertRowid) });
  } catch (err) {
    console.error('Project file error:', err);
    res.status(500).json({ error: 'Failed to save project file.' });
  }
});

// POST /api/projects/:id/fork - fork a project
router.post('/:id/fork', authenticateToken, (req, res) => {
  try {
    const sourceId = req.params.id;
    const sourceProj = db.prepare('SELECT * FROM projects WHERE id = ?').get(sourceId);

    if (!sourceProj) {
      return res.status(404).json({ error: 'Source project not found.' });
    }

    const forkedName = `${sourceProj.name} (Fork)`;
    const newProjRes = db.prepare(`
      INSERT INTO projects (name, description, owner_id, language, is_public)
      VALUES (?, ?, ?, ?, 1)
    `).run(forkedName, `Forked from ${sourceProj.name}`, req.user.id, sourceProj.language);

    const newProjectId = Number(newProjRes.lastInsertRowid);

    // Duplicate source files
    const files = db.prepare('SELECT * FROM source_code WHERE project_id = ?').all(sourceId);
    const insertFile = db.prepare(`
      INSERT INTO source_code (project_id, file_name, language, content, last_modified_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const f of files) {
      insertFile.run(newProjectId, f.file_name, f.language, f.content, req.user.id);
    }

    res.status(201).json({
      message: 'Project forked successfully!',
      projectId: newProjectId
    });
  } catch (err) {
    console.error('Fork error:', err);
    res.status(500).json({ error: 'Failed to fork project.' });
  }
});

module.exports = router;
