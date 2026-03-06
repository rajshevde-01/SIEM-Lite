const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// GET /api/dashboard - Aggregated dashboard data
router.get('/', (req, res) => {
    const db = getDb();
    try {
        const hours = Number(req.query.hours || 24);
        const since = new Date(Date.now() - hours * 3600000).toISOString();

        // KPI counts
        const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events WHERE timestamp > ?').get(since).count;
        const criticalAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE severity = 'critical' AND status IN ('open','investigating')").get().count;
        const openAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('open','investigating')").get().count;
        const activeIncidents = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status NOT IN ('closed','resolved')").get().count;
        const totalAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'active'").get().count;
        const highRiskAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE risk_score > 70").get().count;
        const threatsBlocked = db.prepare("SELECT COUNT(*) as count FROM events WHERE timestamp > ? AND outcome IN ('blocked','quarantined','deny')").get(since).count;
        const avgRiskScore = db.prepare("SELECT AVG(risk_score) as avg FROM events WHERE timestamp > ?").get(since).avg || 0;

        // Time series - events per hour
        const eventTimeline = db.prepare(`SELECT strftime('%Y-%m-%dT%H:00:00', timestamp) as hour, COUNT(*) as count, severity FROM events WHERE timestamp > ? GROUP BY hour, severity ORDER BY hour`).all(since);

        // Severity distribution
        const severityDist = db.prepare('SELECT severity, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY severity').all(since);

        // Event type distribution
        const eventTypeDist = db.prepare('SELECT event_type, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY event_type ORDER BY count DESC').all(since);

        // Top attacking IPs
        const topAttackers = db.prepare(`SELECT source_ip, geo_country, COUNT(*) as count, AVG(risk_score) as avg_risk FROM events WHERE timestamp > ? AND source_ip NOT LIKE '10.%' AND source_ip NOT LIKE '192.168.%' AND source_ip NOT LIKE '172.16.%' GROUP BY source_ip ORDER BY count DESC LIMIT 10`).all(since);

        // Top targeted assets
        const topTargets = db.prepare(`SELECT dest_ip, hostname, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY dest_ip ORDER BY count DESC LIMIT 10`).all(since);

        // Geo distribution
        const geoDist = db.prepare(`SELECT geo_country, geo_city, geo_lat, geo_lon, COUNT(*) as count, AVG(risk_score) as avg_risk FROM events WHERE timestamp > ? AND geo_country != 'US' GROUP BY geo_country, geo_city ORDER BY count DESC LIMIT 20`).all(since);

        // MITRE ATT&CK distribution
        const mitreDist = db.prepare(`SELECT mitre_tactic, mitre_technique, COUNT(*) as count FROM events WHERE timestamp > ? AND mitre_tactic IS NOT NULL GROUP BY mitre_tactic, mitre_technique ORDER BY count DESC`).all(since);

        // Recent critical alerts
        const recentAlerts = db.prepare(`SELECT * FROM alerts WHERE severity IN ('critical','high') ORDER BY created_at DESC LIMIT 10`).all();

        // Recent incidents
        const recentIncidents = db.prepare(`SELECT * FROM incidents ORDER BY created_at DESC LIMIT 5`).all();

        // Protocol distribution
        const protocolDist = db.prepare('SELECT protocol, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY protocol ORDER BY count DESC').all(since);

        // Events per second (last 5 minutes)
        const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
        const recentCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE timestamp > ?').get(fiveMinAgo).count;
        const eps = (recentCount / 300).toFixed(2);

        res.json({
            kpi: { totalEvents, criticalAlerts, openAlerts, activeIncidents, totalAssets, highRiskAssets, threatsBlocked, avgRiskScore: Math.round(avgRiskScore), eps: Number(eps) },
            eventTimeline,
            severityDist,
            eventTypeDist,
            topAttackers,
            topTargets,
            geoDist,
            mitreDist,
            recentAlerts,
            recentIncidents,
            protocolDist,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        db.close();
    }
});

module.exports = router;
