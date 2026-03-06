const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// GET /api/events - List events with pagination, search, filtering
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { page = 1, limit = 50, severity, event_type, source_ip, dest_ip, search, start_date, end_date, category } = req.query;
        const offset = (page - 1) * limit;
        let where = [];
        let params = [];

        if (severity) { where.push('severity = ?'); params.push(severity); }
        if (event_type) { where.push('event_type = ?'); params.push(event_type); }
        if (source_ip) { where.push('source_ip = ?'); params.push(source_ip); }
        if (dest_ip) { where.push('dest_ip = ?'); params.push(dest_ip); }
        if (category) { where.push('category = ?'); params.push(category); }
        if (search) { where.push('(description LIKE ? OR raw_log LIKE ? OR hostname LIKE ? OR username LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
        if (start_date) { where.push('timestamp >= ?'); params.push(start_date); }
        if (end_date) { where.push('timestamp <= ?'); params.push(end_date); }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const total = db.prepare(`SELECT COUNT(*) as count FROM events ${whereClause}`).get(...params).count;
        const events = db.prepare(`SELECT * FROM events ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));

        res.json({ events, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// GET /api/events/stats - Event statistics
router.get('/stats', (req, res) => {
    const db = getDb();
    try {
        const hours = Number(req.query.hours || 24);
        const since = new Date(Date.now() - hours * 3600000).toISOString();

        const bySeverity = db.prepare(`SELECT severity, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY severity`).all(since);
        const byType = db.prepare(`SELECT event_type, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY event_type ORDER BY count DESC`).all(since);
        const byHour = db.prepare(`SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) as hour, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY hour ORDER BY hour`).all(since);
        const topSourceIPs = db.prepare(`SELECT source_ip, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY source_ip ORDER BY count DESC LIMIT 10`).all(since);
        const topDestIPs = db.prepare(`SELECT dest_ip, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY dest_ip ORDER BY count DESC LIMIT 10`).all(since);
        const total = db.prepare(`SELECT COUNT(*) as count FROM events WHERE timestamp > ?`).get(since).count;

        res.json({ total, bySeverity, byType, byHour, topSourceIPs, topDestIPs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
    const db = getDb();
    try {
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
