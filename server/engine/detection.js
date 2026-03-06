const { getDb } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

class DetectionEngine {
    constructor() {
        this.rules = [];
        this.threatIntelIps = new Set();
        this.eventWindow = {}; // { ruleId_sourceIp: [timestamp1, timestamp2] }
        this.loadData();

        // Reload threat intel every hour to keep it fresh
        setInterval(() => this.loadThreatIntel(), 3600000);
    }

    loadData() {
        this.loadRules();
        this.loadThreatIntel();
    }

    loadRules() {
        const db = getDb();
        this.rules = db.prepare('SELECT * FROM rules WHERE enabled = 1').all();
        db.close();
    }

    loadThreatIntel() {
        const db = getDb();
        try {
            const intel = db.prepare("SELECT ioc_value FROM threat_intel WHERE ioc_type = 'ip' AND active = 1").all();
            this.threatIntelIps = new Set(intel.map(i => i.ioc_value));
            console.log(`[DetectionEngine] Loaded ${this.threatIntelIps.size} active malicious IPs from Threat Intel`);
        } catch (err) {
            console.error('[DetectionEngine] Failed to load threat intel:', err.message);
        } finally {
            db.close();
        }
    }

    evaluate(event) {
        const alerts = [];
        const now = new Date(event.timestamp).getTime();

        // 1. Check Threat Intel (Dynamic IP Match)
        if (this.threatIntelIps.has(event.source_ip)) {
            alerts.push({
                rule_id: 'builtin-threat-intel',
                rule_name: 'Threat Intel Match',
                severity: 'critical',
                description: `Communication with known malicious IP (${event.source_ip})`,
                mitre_tactic: 'TA0011',
                mitre_technique: 'T1571',
            });
        }

        // 2. Evaluate User-Defined Rules
        for (const rule of this.rules) {
            try {
                const logic = JSON.parse(rule.logic);

                if (this.matchRule(event, logic)) {
                    // Check threshold and time window
                    const threshold = logic.threshold || rule.threshold || 1;
                    const timeWindow = logic.time_window || rule.time_window || 300; // default 5 mins

                    if (threshold > 1) {
                        const trackKey = `${rule.id}_${event.source_ip}`;
                        if (!this.eventWindow[trackKey]) this.eventWindow[trackKey] = [];

                        // Add current event time
                        this.eventWindow[trackKey].push(now);

                        // Remove old events outside the time window
                        const windowMs = timeWindow * 1000;
                        this.eventWindow[trackKey] = this.eventWindow[trackKey].filter(t => now - t <= windowMs);

                        if (this.eventWindow[trackKey].length >= threshold) {
                            alerts.push(this.createAlertPayload(rule, `Rule "${rule.name}" triggered: Threshold of ${threshold} events reached within ${timeWindow}s from ${event.source_ip}`));
                            // Clear window to prevent alert spamming immediately after
                            this.eventWindow[trackKey] = [];
                        }
                    } else {
                        // Instant match
                        alerts.push(this.createAlertPayload(rule, `Rule "${rule.name}" triggered: ${rule.description}`));
                    }
                }
            } catch (e) {
                // Ignore parse errors on individual rules
            }
        }

        // 3. Periodic cleanup of stale tracking data to prevent memory leaks
        this.cleanupStaleWindows(now);

        return alerts;
    }

    matchRule(event, logic) {
        const value = event[logic.field];
        if (!value) return false;
        switch (logic.operator) {
            case 'equals': return value === logic.value;
            case 'contains': return String(value).toLowerCase().includes(String(logic.value).toLowerCase());
            case 'regex': return new RegExp(logic.value, 'i').test(String(value));
            case 'gt': return Number(value) > Number(logic.value);
            case 'lt': return Number(value) < Number(logic.value);
            default: return false;
        }
    }

    createAlertPayload(rule, customDescription) {
        return {
            rule_id: rule.id,
            rule_name: rule.name,
            severity: rule.severity,
            description: customDescription,
            mitre_tactic: rule.mitre_tactic,
            mitre_technique: rule.mitre_technique,
        };
    }

    cleanupStaleWindows(now) {
        // Every 100th evaluation, perform garbage collection on the tracking object
        if (Math.random() < 0.01) {
            for (const key in this.eventWindow) {
                // We don't have the time_window readily available here without reparsing rules, 
                // so we use a generous 1-hour MAX cutoff to drop completely dead tracks
                this.eventWindow[key] = this.eventWindow[key].filter(t => now - t <= 3600000);
                if (this.eventWindow[key].length === 0) {
                    delete this.eventWindow[key];
                }
            }
        }
    }

    reloadRules() {
        this.loadRules();
    }
}

module.exports = DetectionEngine;
