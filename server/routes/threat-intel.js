const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// GET /api/threat-intel
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { type, search, active } = req.query;
        let where = [];
        let params = [];
        if (type) { where.push('ioc_type = ?'); params.push(type); }
        if (active !== undefined) { where.push('active = ?'); params.push(active === 'true' ? 1 : 0); }
        if (search) { where.push('(ioc_value LIKE ? OR description LIKE ? OR threat_type LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const iocs = db.prepare(`SELECT * FROM threat_intel ${whereClause} ORDER BY last_seen DESC`).all(...params);
        res.json({ iocs, total: iocs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// GET /api/threat-intel/lookup/:value
router.get('/lookup/:value', (req, res) => {
    const db = getDb();
    try {
        const ioc = db.prepare('SELECT * FROM threat_intel WHERE ioc_value = ?').get(req.params.value);
        const relatedEvents = db.prepare('SELECT * FROM events WHERE source_ip = ? OR dest_ip = ? ORDER BY timestamp DESC LIMIT 20').all(req.params.value, req.params.value);
        res.json({ ioc, relatedEvents, found: !!ioc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
