const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// GET /api/reports/compliance
router.get('/compliance', (req, res) => {
    const db = getDb();
    try {
        const { framework } = req.query;
        let where = [];
        let params = [];
        if (framework) { where.push('framework = ?'); params.push(framework); }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const checks = db.prepare(`SELECT * FROM compliance_checks ${whereClause} ORDER BY framework, control_id`).all(...params);

        // Group by framework
        const grouped = {};
        for (const c of checks) {
            if (!grouped[c.framework]) grouped[c.framework] = { framework: c.framework, controls: [], pass: 0, fail: 0, warning: 0, pending: 0 };
            grouped[c.framework].controls.push(c);
            grouped[c.framework][c.status]++;
        }

        const frameworks = Object.values(grouped).map(fw => ({
            ...fw,
            total: fw.controls.length,
            score: Math.round((fw.pass / fw.controls.length) * 100),
        }));

        res.json({ frameworks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

// GET /api/reports/summary
router.get('/summary', (req, res) => {
    const db = getDb();
    try {
        const last24h = new Date(Date.now() - 86400000).toISOString();
        const last7d = new Date(Date.now() - 7 * 86400000).toISOString();

        const summary = {
            events_24h: db.prepare('SELECT COUNT(*) as count FROM events WHERE timestamp > ?').get(last24h).count,
            events_7d: db.prepare('SELECT COUNT(*) as count FROM events WHERE timestamp > ?').get(last7d).count,
            alerts_24h: db.prepare('SELECT COUNT(*) as count FROM alerts WHERE created_at > ?').get(last24h).count,
            critical_alerts: db.prepare("SELECT COUNT(*) as count FROM alerts WHERE severity = 'critical' AND status = 'open'").get().count,
            active_incidents: db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status NOT IN ('closed','resolved')").get().count,
            top_event_types: db.prepare('SELECT event_type, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY event_type ORDER BY count DESC LIMIT 5').all(last24h),
            top_mitre: db.prepare('SELECT mitre_tactic, COUNT(*) as count FROM events WHERE timestamp > ? AND mitre_tactic IS NOT NULL GROUP BY mitre_tactic ORDER BY count DESC LIMIT 5').all(last24h),
        };

        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
