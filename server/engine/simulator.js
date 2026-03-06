const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const geoip = require('geoip-lite');
const { getDb } = require('../db/schema');

// Threat intelligence feeds mapped to action types (used to populate the DB on startup)
const THREAT_FEEDS = [
    { url: 'http://cinsscore.com/list/ci-badguys.txt', type: 'CINS_Army' },
    { url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt', type: 'Feodo_Tracker' }
];

let DYNAMIC_INTERNAL_IPS = [];
let DYNAMIC_HOSTNAMES = [];
const FALLBACK_IPS = ['45.33.32.156', '185.220.101.1', '104.248.50.87', '91.219.236.222', '23.129.64.100', '198.51.100.22', '77.247.181.163'];
const USERNAMES = ['jsmith', 'jdoe', 'admin', 'svc_backup', 'analyst01', 'root', 'webadmin'];

const MITRE_TACTICS = [
    { id: 'TA0001', techniques: ['T1566', 'T1190', 'T1078'] },
    { id: 'TA0002', techniques: ['T1059', 'T1204', 'T1053'] },
    { id: 'TA0006', techniques: ['T1110', 'T1003', 'T1555'] },
    { id: 'TA0007', techniques: ['T1087', 'T1082', 'T1046'] },
    { id: 'TA0008', techniques: ['T1021', 'T1570', 'T1550'] },
    { id: 'TA0010', techniques: ['T1041', 'T1048', 'T1567'] },
    { id: 'TA0011', techniques: ['T1071', 'T1573', 'T1105'] },
    { id: 'TA0040', techniques: ['T1486', 'T1490', 'T1489'] },
];

const EVENT_TYPES = [
    { type: 'authentication', category: 'Identity', subcategory: 'Login', severity: ['info', 'low', 'medium'], action: 'login', outcomes: ['success', 'failure'], descriptions: ['User login attempt', 'SSH authentication', 'RDP session initiated', 'VPN connection'] },
    { type: 'firewall', category: 'Network', subcategory: 'Traffic', severity: ['info', 'low', 'medium'], action: 'allow', outcomes: ['allow', 'deny'], descriptions: ['Firewall rule evaluation', 'Traffic inspection', 'Connection filtered'] },
    { type: 'ids', category: 'Threat', subcategory: 'Intrusion', severity: ['high', 'critical'], action: 'alert', outcomes: ['detected'], descriptions: ['SQL injection attempt', 'XSS payload detected', 'Command injection', 'Directory traversal'] },
    { type: 'malware', category: 'Threat', subcategory: 'Malware', severity: ['high', 'critical'], action: 'quarantine', outcomes: ['quarantined', 'blocked'], descriptions: ['Ransomware detected', 'Trojan identified', 'Cryptominer detected', 'Rootkit matched'] },
    { type: 'endpoint', category: 'Endpoint', subcategory: 'Process', severity: ['medium', 'high'], action: 'monitor', outcomes: ['detected'], descriptions: ['Suspicious process', 'PowerShell encoded command', 'Unauthorized installation', 'Registry modification'] },
    { type: 'network', category: 'Network', subcategory: 'Scan', severity: ['medium', 'high'], action: 'detect', outcomes: ['detected'], descriptions: ['Port scan detected', 'Network reconnaissance', 'Service enumeration', 'DNS tunneling attempt'] },
    { type: 'dlp', category: 'Data', subcategory: 'Data Loss', severity: ['high', 'critical'], action: 'block', outcomes: ['blocked'], descriptions: ['Data exfiltration attempt', 'PII transfer blocked', 'Unauthorized upload'] },
    { type: 'email', category: 'Email', subcategory: 'Phishing', severity: ['high'], action: 'block', outcomes: ['blocked', 'quarantined'], descriptions: ['Phishing email detected', 'Malicious attachment', 'Spoofed sender'] },
    { type: 'cloud', category: 'Cloud', subcategory: 'IAM', severity: ['medium', 'high'], action: 'monitor', outcomes: ['success', 'failure'], descriptions: ['IAM role assumption', 'API key from new region', 'Security group modified'] },
    { type: 'system', category: 'System', subcategory: 'Audit', severity: ['info', 'low'], action: 'audit', outcomes: ['success'], descriptions: ['Config change', 'Service started', 'Scheduled task', 'Audit policy modified'] },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Refresh the internal configuration from the database dynamically
let _configErrorLogged = false;
function refreshSimulatorConfig() {
    let db;
    try {
        db = getDb();
        const assets = db.prepare("SELECT ip_address, hostname FROM assets WHERE status = 'active'").all();
        DYNAMIC_INTERNAL_IPS = assets.map(a => a.ip_address).filter(Boolean);
        DYNAMIC_HOSTNAMES = assets.map(a => a.hostname).filter(Boolean);

        // Safety fallback if DB is empty
        if (DYNAMIC_INTERNAL_IPS.length === 0) DYNAMIC_INTERNAL_IPS = ['10.0.1.10', '192.168.1.100'];
        if (DYNAMIC_HOSTNAMES.length === 0) DYNAMIC_HOSTNAMES = ['dc-01.corp.local', 'web-01.corp.local'];
        _configErrorLogged = false;
    } catch (e) {
        if (!_configErrorLogged) {
            console.error('[Simulator] DB config fetch failed:', e.message, '— using fallback IPs. Run "npm run seed" if DB is empty.');
            _configErrorLogged = true;
        }
        // Ensure fallbacks so simulator doesn't break
        if (DYNAMIC_INTERNAL_IPS.length === 0) DYNAMIC_INTERNAL_IPS = ['10.0.1.10', '192.168.1.100'];
        if (DYNAMIC_HOSTNAMES.length === 0) DYNAMIC_HOSTNAMES = ['dc-01.corp.local', 'web-01.corp.local'];
    } finally {
        if (db) db.close();
    }
}

// Initialize threat feeds on startup by pushing them into the DB
async function initThreatFeeds() {
    console.log('[Simulator] Syncing Real Threat Intelligence Feeds to DB...');
    const db = getDb();
    const insertTI = db.prepare(`INSERT OR IGNORE INTO threat_intel (id, ioc_type, ioc_value, threat_type, confidence, source, description) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    try {
        let addedCount = 0;
        const insertMany = db.transaction((ips, sourceName) => {
            for (const ip of ips) {
                // simple deduplication happens via UNIQUE constraints / ignoring duplicates, 
                // but since we only have ID as PK, we check explicitly
                const exists = db.prepare('SELECT id FROM threat_intel WHERE ioc_value = ?').get(ip);
                if (!exists) {
                    insertTI.run(uuidv4(), 'ip', ip, 'Malicious IP', 90, sourceName, `Sourced from ${sourceName}`);
                    addedCount++;
                }
            }
        });

        for (const feed of THREAT_FEEDS) {
            console.log(`[Simulator] Fetching ${feed.type}...`);
            const response = await axios.get(feed.url, { timeout: 10000 });
            const lines = response.data.split('\n');
            const newIps = [];

            for (const line of lines) {
                const trimmed = line.trim();
                // Basic IPv4 regex
                if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed) && trimmed !== '127.0.0.1') {
                    newIps.push(trimmed);
                }
            }
            insertMany(newIps, feed.type);
        }
        console.log(`[Simulator] Seeded ${addedCount} new malicious IPs globally into DB.`);
    } catch (err) {
        console.error('[Simulator] Failed to load remote feeds. DB Threat Intel will rely on seeded data.', err.message);
    } finally {
        db.close();
    }

    // Initial config load for event generator
    refreshSimulatorConfig();

    // Refresh the dynamic IP config every 5 minutes in case assets change
    setInterval(refreshSimulatorConfig, 300000);
}

function generateLiveEvent({ useRealFeeds = true, timestamp = null } = {}) {
    // Force a config refresh if empty
    if (DYNAMIC_INTERNAL_IPS.length === 0) refreshSimulatorConfig();

    const template = pick(EVENT_TYPES);
    const isExternal = Math.random() > 0.4;

    let sourceIp = pick(DYNAMIC_INTERNAL_IPS);
    let geoCountry = 'US';
    let geoCity = 'Internal';
    let geoLat = 40.71;
    let geoLon = -74.01;

    if (isExternal) {
        // We pull external attackers dynamically from the DB's threat intel table occasionally,
        // otherwise we fallback so we don't spam the DB synchronously every second.
        let attackerPool = FALLBACK_IPS;
        if (useRealFeeds && Math.random() < 0.2) {
            const db = getDb();
            try {
                // Get a random active IP from threat intel
                const row = db.prepare("SELECT ioc_value FROM threat_intel WHERE ioc_type = 'ip' AND active = 1 ORDER BY RANDOM() LIMIT 1").get();
                if (row) attackerPool = [row.ioc_value];
            } catch (e) { } finally {
                db.close();
            }
        }

        sourceIp = pick(attackerPool);

        // Dynamically resolve real geolocation
        const geo = geoip.lookup(sourceIp);
        if (geo) {
            geoCountry = geo.country || 'Unknown';
            geoCity = geo.city || 'Unknown';
            geoLat = geo.ll ? geo.ll[0] : geoLat;
            geoLon = geo.ll ? geo.ll[1] : geoLon;
        } else {
            // Unmapped IPs default to somewhat randomized locations for visual demo
            geoCountry = 'US';
            geoCity = 'Unknown';
            geoLat = 39.8283;
            geoLon = -98.5795;
        }
    }

    const tactic = pick(MITRE_TACTICS);
    const sev = pick(template.severity);
    const sevMap = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

    const eventTime = timestamp || new Date().toISOString();

    return {
        id: uuidv4(),
        timestamp: eventTime,
        source_ip: sourceIp,
        dest_ip: pick(DYNAMIC_INTERNAL_IPS),
        source_port: randInt(1024, 65535),
        dest_port: pick([22, 80, 443, 445, 3389, 8080, 3306, 5432]),
        protocol: pick(['TCP', 'UDP', 'HTTP', 'HTTPS', 'SSH', 'DNS', 'RDP']),
        event_type: template.type,
        severity: sev,
        category: template.category,
        subcategory: template.subcategory,
        description: pick(template.descriptions),
        raw_log: `<${randInt(0, 191)}>${eventTime} ${pick(DYNAMIC_HOSTNAMES)} ${template.type}[${randInt(1000, 9999)}]: ${pick(template.descriptions)}`,
        hostname: pick(DYNAMIC_HOSTNAMES),
        username: Math.random() > 0.3 ? pick(USERNAMES) : null,
        action: template.action,
        outcome: pick(template.outcomes),
        mitre_tactic: tactic.id,
        mitre_technique: pick(tactic.techniques),
        geo_country: geoCountry,
        geo_city: geoCity,
        geo_lat: geoLat,
        geo_lon: geoLon,
        risk_score: Math.round((sevMap[sev] / 4) * 100 * (0.5 + Math.random() * 0.5)),
    };
}

module.exports = { generateLiveEvent, initThreatFeeds };
