const { getDb } = require('../db/schema');

class CorrelationEngine {
    constructor() {
        this.windowMs = 300000; // 5 min window
    }

    correlateByIP(sourceIp, minutes = 5) {
        const db = getDb();
        const since = new Date(Date.now() - minutes * 60000).toISOString();
        const events = db.prepare(
            'SELECT * FROM events WHERE source_ip = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 100'
        ).all(sourceIp, since);
        db.close();

        const types = [...new Set(events.map(e => e.event_type))];
        const tactics = [...new Set(events.map(e => e.mitre_tactic).filter(Boolean))];

        return {
            source_ip: sourceIp,
            event_count: events.length,
            event_types: types,
            mitre_tactics: tactics,
            is_attack_chain: tactics.length >= 3,
            earliest: events[events.length - 1]?.timestamp,
            latest: events[0]?.timestamp,
            risk_score: Math.min(100, events.reduce((sum, e) => sum + (e.risk_score || 0), 0) / events.length),
        };
    }

    correlateByUser(username, minutes = 30) {
        const db = getDb();
        const since = new Date(Date.now() - minutes * 60000).toISOString();
        const events = db.prepare(
            'SELECT * FROM events WHERE username = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 100'
        ).all(username, since);
        db.close();

        const ips = [...new Set(events.map(e => e.source_ip))];
        const hosts = [...new Set(events.map(e => e.hostname))];
        const failedLogins = events.filter(e => e.event_type === 'authentication' && e.outcome === 'failure');

        return {
            username,
            event_count: events.length,
            unique_ips: ips.length,
            unique_hosts: hosts.length,
            source_ips: ips,
            hostnames: hosts,
            failed_logins: failedLogins.length,
            is_suspicious: ips.length > 3 || failedLogins.length > 5,
            risk_score: Math.min(100, (ips.length * 10) + (failedLogins.length * 15)),
        };
    }

    getAttackChains() {
        const db = getDb();
        const since = new Date(Date.now() - 3600000).toISOString(); // last hour
        const events = db.prepare(
            `SELECT source_ip, GROUP_CONCAT(DISTINCT mitre_tactic) as tactics, COUNT(*) as cnt
       FROM events WHERE timestamp > ? AND mitre_tactic IS NOT NULL
       GROUP BY source_ip HAVING COUNT(DISTINCT mitre_tactic) >= 3
       ORDER BY cnt DESC LIMIT 20`
        ).all(since);
        db.close();
        return events.map(e => ({ ...e, tactics: e.tactics.split(',') }));
    }
}

module.exports = CorrelationEngine;
