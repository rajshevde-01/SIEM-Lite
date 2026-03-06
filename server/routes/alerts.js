const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

// GET /api/alerts
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { page = 1, limit = 50, severity, status, assigned_to, search } = req.query;
        const offset = (page - 1) * limit;
        let where = [];
        let params = [];

        if (severity) { where.push('severity = ?'); params.push(severity); }
        if (status) { where.push('status = ?'); params.push(status); }
        if (assigned_to) { where.push('assigned_to = ?'); params.push(assigned_to); }
        if (search) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const total = db.prepare(`SELECT COUNT(*) as count FROM alerts ${whereClause}`).get(...params).count;
        const alerts = db.prepare(`SELECT * FROM alerts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));

        res.json({ alerts, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// GET /api/alerts/stats
router.get('/stats', (req, res) => {
    const db = getDb();
    try {
        const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM alerts GROUP BY status').all();
        const bySeverity = db.prepare('SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity').all();
        const openCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('open', 'investigating')").get().count;
        const todayCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE date(created_at) = date('now')").get().count;
        const avgResolutionTime = db.prepare("SELECT AVG(julianday(resolved_at) - julianday(created_at)) * 24 as hours FROM alerts WHERE resolved_at IS NOT NULL").get();

        res.json({ byStatus, bySeverity, openCount, todayCount, avgResolutionHours: avgResolutionTime?.hours || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// PATCH /api/alerts/:id
router.patch('/:id', (req, res) => {
    const db = getDb();
    try {
        const { status, assigned_to, notes, false_positive } = req.body;
        const updates = [];
        const params = [];

        if (status) { updates.push('status = ?'); params.push(status); }
        if (assigned_to !== undefined) { updates.push('assigned_to = ?'); params.push(assigned_to); }
        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
        if (false_positive !== undefined) { updates.push('false_positive = ?'); params.push(false_positive ? 1 : 0); }
        if (status === 'resolved') { updates.push("resolved_at = datetime('now')"); }
        updates.push("updated_at = datetime('now')");
        params.push(req.params.id);

        db.prepare(`UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
