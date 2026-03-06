const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

// GET /api/incidents
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { status, severity, priority } = req.query;
        let where = [];
        let params = [];
        if (status) { where.push('status = ?'); params.push(status); }
        if (severity) { where.push('severity = ?'); params.push(severity); }
        if (priority) { where.push('priority = ?'); params.push(priority); }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const incidents = db.prepare(`SELECT * FROM incidents ${whereClause} ORDER BY created_at DESC`).all(...params);
        res.json({ incidents });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// POST /api/incidents
router.post('/', (req, res) => {
    const db = getDb();
    try {
        const { title, description, severity, priority, assigned_to, category, affected_assets } = req.body;
        const id = uuidv4();
        db.prepare(`INSERT INTO incidents (id, title, description, severity, priority, assigned_to, category, affected_assets) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, title, description, severity || 'medium', priority || 'medium', assigned_to, category, JSON.stringify(affected_assets || []));
        const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
        res.status(201).json(incident);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// PATCH /api/incidents/:id
router.patch('/:id', (req, res) => {
    const db = getDb();
    try {
        const { status, assigned_to, resolution, priority, description } = req.body;
        const updates = [];
        const params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to); }
        if (resolution !== undefined) { updates.push('resolution = ?'); params.push(resolution); }
        if (priority) { updates.push('priority = ?'); params.push(priority); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (status === 'closed') { updates.push("closed_at = datetime('now')"); }
        updates.push("updated_at = datetime('now')");
        params.push(req.params.id);
        db.prepare(`UPDATE incidents SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const inc = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
        res.json(inc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
