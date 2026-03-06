const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// GET /api/assets
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const { type, criticality, status } = req.query;
        let where = [];
        let params = [];
        if (type) { where.push('asset_type = ?'); params.push(type); }
        if (criticality) { where.push('criticality = ?'); params.push(criticality); }
        if (status) { where.push('status = ?'); params.push(status); }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const assets = db.prepare(`SELECT * FROM assets ${whereClause} ORDER BY risk_score DESC`).all(...params);
        res.json({ assets });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
