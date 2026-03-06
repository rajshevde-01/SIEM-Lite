const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');
const { initThreatFeeds, generateLiveEvent } = require('../engine/simulator');

const COUNTRIES = [
    { code: 'US', city: 'New York', lat: 40.71, lon: -74.01 },
    { code: 'US', city: 'San Francisco', lat: 37.77, lon: -122.42 },
    { code: 'CN', city: 'Beijing', lat: 39.90, lon: 116.40 },
    { code: 'CN', city: 'Shanghai', lat: 31.23, lon: 121.47 },
    { code: 'RU', city: 'Moscow', lat: 55.76, lon: 37.62 },
    { code: 'RU', city: 'St Petersburg', lat: 59.93, lon: 30.32 },
    { code: 'DE', city: 'Berlin', lat: 52.52, lon: 13.40 },
    { code: 'GB', city: 'London', lat: 51.51, lon: -0.13 },
    { code: 'IN', city: 'Mumbai', lat: 19.08, lon: 72.88 },
    { code: 'BR', city: 'São Paulo', lat: -23.55, lon: -46.63 },
    { code: 'JP', city: 'Tokyo', lat: 35.68, lon: 139.69 },
    { code: 'KR', city: 'Seoul', lat: 37.57, lon: 126.98 },
    { code: 'AU', city: 'Sydney', lat: -33.87, lon: 151.21 },
    { code: 'NL', city: 'Amsterdam', lat: 52.37, lon: 4.90 },
    { code: 'IR', city: 'Tehran', lat: 35.69, lon: 51.39 },
    { code: 'KP', city: 'Pyongyang', lat: 39.02, lon: 125.75 },
    { code: 'UA', city: 'Kyiv', lat: 50.45, lon: 30.52 },
    { code: 'NG', city: 'Lagos', lat: 6.52, lon: 3.38 },
    { code: 'ZA', city: 'Cape Town', lat: -33.92, lon: 18.42 },
    { code: 'SG', city: 'Singapore', lat: 1.35, lon: 103.82 },
];

const INTERNAL_IPS = [
    '10.0.1.10', '10.0.1.11', '10.0.1.15', '10.0.1.20', '10.0.1.25',
    '10.0.2.10', '10.0.2.11', '10.0.2.15', '10.0.2.20', '10.0.2.25',
    '10.0.3.5', '10.0.3.10', '10.0.3.15', '10.0.3.20',
    '192.168.1.100', '192.168.1.101', '192.168.1.150', '192.168.1.200',
    '172.16.0.10', '172.16.0.20', '172.16.0.30',
];

const EXTERNAL_IPS = [
    '45.33.32.156', '185.220.101.1', '104.248.50.87', '91.219.236.222',
    '23.129.64.100', '198.51.100.22', '203.0.113.55', '77.247.181.163',
    '62.210.105.116', '176.10.104.240', '193.23.244.244', '51.15.43.205',
    '199.249.230.75', '171.25.193.9', '128.31.0.34', '86.59.21.38',
    '37.187.129.166', '178.175.131.194', '94.230.208.147', '46.165.230.5',
];

const HOSTNAMES = [
    'dc-01.corp.local', 'dc-02.corp.local', 'web-01.corp.local', 'web-02.corp.local',
    'db-01.corp.local', 'db-02.corp.local', 'mail-01.corp.local', 'fw-01.corp.local',
    'fw-02.corp.local', 'vpn-01.corp.local', 'ids-01.corp.local', 'proxy-01.corp.local',
    'file-01.corp.local', 'app-01.corp.local', 'app-02.corp.local', 'backup-01.corp.local',
    'ws-jsmith.corp.local', 'ws-jdoe.corp.local', 'ws-admin01.corp.local', 'ws-dev01.corp.local',
];

const USERNAMES = [
    'jsmith', 'jdoe', 'admin', 'svc_backup', 'svc_monitor', 'root',
    'administrator', 'dbadmin', 'webadmin', 'analyst01', 'analyst02',
    'operator01', 'guest', 'test_user', 'deploy_bot',
];

const MITRE_TACTICS = [
    { id: 'TA0001', name: 'Initial Access', techniques: ['T1566', 'T1190', 'T1133', 'T1078'] },
    { id: 'TA0002', name: 'Execution', techniques: ['T1059', 'T1204', 'T1053', 'T1203'] },
    { id: 'TA0003', name: 'Persistence', techniques: ['T1547', 'T1053', 'T1136', 'T1543'] },
    { id: 'TA0004', name: 'Privilege Escalation', techniques: ['T1548', 'T1134', 'T1068', 'T1055'] },
    { id: 'TA0005', name: 'Defense Evasion', techniques: ['T1070', 'T1036', 'T1027', 'T1562'] },
    { id: 'TA0006', name: 'Credential Access', techniques: ['T1110', 'T1003', 'T1555', 'T1558'] },
    { id: 'TA0007', name: 'Discovery', techniques: ['T1087', 'T1082', 'T1083', 'T1046'] },
    { id: 'TA0008', name: 'Lateral Movement', techniques: ['T1021', 'T1570', 'T1080', 'T1550'] },
    { id: 'TA0009', name: 'Collection', techniques: ['T1560', 'T1119', 'T1005', 'T1074'] },
    { id: 'TA0010', name: 'Exfiltration', techniques: ['T1041', 'T1048', 'T1567', 'T1029'] },
    { id: 'TA0011', name: 'Command and Control', techniques: ['T1071', 'T1573', 'T1105', 'T1572'] },
    { id: 'TA0040', name: 'Impact', techniques: ['T1486', 'T1490', 'T1489', 'T1529'] },
];

const EVENT_TEMPLATES = [
    { type: 'authentication', category: 'Identity', subcategory: 'Login', severity: 'info', action: 'login', outcomes: ['success', 'success', 'success', 'failure', 'failure'], descriptions: ['User login attempt', 'SSH authentication', 'RDP session initiated', 'VPN connection established', 'Multi-factor authentication'] },
    { type: 'authentication', category: 'Identity', subcategory: 'Brute Force', severity: 'high', action: 'login', outcomes: ['failure'], descriptions: ['Multiple failed login attempts detected', 'Password spray attack detected', 'Brute force attempt from external IP'] },
    { type: 'firewall', category: 'Network', subcategory: 'Traffic', severity: 'info', action: 'allow', outcomes: ['allow', 'allow', 'deny'], descriptions: ['Firewall rule evaluation', 'Traffic passed inspection', 'Connection filtered'] },
    { type: 'firewall', category: 'Network', subcategory: 'Block', severity: 'medium', action: 'block', outcomes: ['deny'], descriptions: ['Blocked suspicious connection', 'Geo-blocked traffic from sanctioned country', 'Port scan blocked'] },
    { type: 'ids', category: 'Threat', subcategory: 'Intrusion', severity: 'high', action: 'alert', outcomes: ['detected'], descriptions: ['SQL injection attempt detected', 'XSS payload detected', 'Directory traversal attempt', 'Command injection detected'] },
    { type: 'malware', category: 'Threat', subcategory: 'Malware', severity: 'critical', action: 'quarantine', outcomes: ['quarantined', 'blocked', 'detected'], descriptions: ['Ransomware payload detected', 'Trojan horse identified', 'Cryptominer detected', 'Rootkit signature matched'] },
    { type: 'dlp', category: 'Data', subcategory: 'Data Loss', severity: 'high', action: 'block', outcomes: ['blocked', 'detected'], descriptions: ['Sensitive data exfiltration attempt', 'PII data transfer blocked', 'Unauthorized file upload detected'] },
    { type: 'endpoint', category: 'Endpoint', subcategory: 'Process', severity: 'medium', action: 'monitor', outcomes: ['detected'], descriptions: ['Suspicious process execution', 'PowerShell encoded command', 'Unauthorized software installation', 'Registry modification detected'] },
    { type: 'endpoint', category: 'Endpoint', subcategory: 'USB', severity: 'medium', action: 'detect', outcomes: ['detected', 'blocked'], descriptions: ['USB device connected', 'Removable media policy violation', 'Unauthorized device detected'] },
    { type: 'network', category: 'Network', subcategory: 'DNS', severity: 'medium', action: 'monitor', outcomes: ['detected'], descriptions: ['DNS tunneling attempt', 'Suspicious DNS query to known C2', 'DGA domain resolution detected'] },
    { type: 'network', category: 'Network', subcategory: 'Scan', severity: 'high', action: 'detect', outcomes: ['detected'], descriptions: ['Port scan detected', 'Network reconnaissance activity', 'Service enumeration attempt'] },
    { type: 'system', category: 'System', subcategory: 'Audit', severity: 'info', action: 'audit', outcomes: ['success'], descriptions: ['System configuration change', 'Service started', 'Scheduled task created', 'Audit policy modified'] },
    { type: 'system', category: 'System', subcategory: 'Error', severity: 'low', action: 'error', outcomes: ['failure'], descriptions: ['Service crash detected', 'Disk space warning', 'Memory utilization high', 'CPU throttling detected'] },
    { type: 'cloud', category: 'Cloud', subcategory: 'IAM', severity: 'medium', action: 'monitor', outcomes: ['success', 'failure'], descriptions: ['IAM role assumption', 'API key usage from new region', 'Cloud resource provisioned', 'Security group modified'] },
    { type: 'email', category: 'Email', subcategory: 'Phishing', severity: 'high', action: 'block', outcomes: ['blocked', 'quarantined'], descriptions: ['Phishing email detected', 'Malicious attachment blocked', 'Spoofed sender detected', 'Business email compromise attempt'] },
    { type: 'web', category: 'Web', subcategory: 'WAF', severity: 'medium', action: 'block', outcomes: ['blocked', 'detected'], descriptions: ['WAF rule triggered', 'Bot traffic detected', 'Rate limit exceeded', 'Suspicious user agent blocked'] },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randPort() { return pick([22, 23, 25, 53, 80, 443, 445, 993, 1433, 3306, 3389, 5432, 8080, 8443, randInt(1024, 65535)]); }

function generateEvent(timestamp) {
    const template = pick(EVENT_TEMPLATES);
    const geo = pick(COUNTRIES);
    const isExternal = Math.random() > 0.4;
    const tactic = pick(MITRE_TACTICS);
    const severities = ['info', 'low', 'medium', 'high', 'critical'];
    const severityWeight = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const baseSev = severityWeight[template.severity] || 0;
    const adjustedSev = Math.min(4, Math.max(0, baseSev + randInt(-1, 1)));

    return {
        id: uuidv4(),
        timestamp: timestamp,
        source_ip: isExternal ? pick(EXTERNAL_IPS) : pick(INTERNAL_IPS),
        dest_ip: pick(INTERNAL_IPS),
        source_port: randPort(),
        dest_port: randPort(),
        protocol: pick(['TCP', 'UDP', 'TCP', 'TCP', 'ICMP', 'HTTP', 'HTTPS', 'DNS', 'SSH', 'RDP']),
        event_type: template.type,
        severity: severities[adjustedSev],
        category: template.category,
        subcategory: template.subcategory,
        description: pick(template.descriptions),
        raw_log: `<${randInt(0, 191)}>${timestamp} ${pick(HOSTNAMES)} ${template.type}[${randInt(1000, 9999)}]: ${pick(template.descriptions)}`,
        hostname: pick(HOSTNAMES),
        username: Math.random() > 0.3 ? pick(USERNAMES) : null,
        action: template.action,
        outcome: pick(template.outcomes),
        mitre_tactic: tactic.id,
        mitre_technique: pick(tactic.techniques),
        geo_country: isExternal ? geo.code : 'US',
        geo_city: isExternal ? geo.city : 'Internal',
        geo_lat: isExternal ? geo.lat : 40.71,
        geo_lon: isExternal ? geo.lon : -74.01,
        risk_score: Math.round((adjustedSev / 4) * 100 * (0.5 + Math.random() * 0.5)),
    };
}

function generateAlert(event, rules) {
    const rule = pick(rules);
    const statuses = ['open', 'open', 'open', 'investigating', 'investigating', 'resolved', 'false_positive'];
    return {
        id: uuidv4(),
        event_id: event.id,
        rule_id: rule.id,
        title: `${event.description} - ${event.source_ip}`,
        description: `Alert triggered by rule "${rule.name}". Source: ${event.source_ip} → Dest: ${event.dest_ip}. ${event.description}`,
        severity: event.severity,
        status: pick(statuses),
        assigned_to: Math.random() > 0.3 ? pick(['analyst01', 'analyst02', 'operator01', 'admin']) : null,
        source_ip: event.source_ip,
        dest_ip: event.dest_ip,
        mitre_tactic: event.mitre_tactic,
        mitre_technique: event.mitre_technique,
        false_positive: Math.random() > 0.85 ? 1 : 0,
        notes: Math.random() > 0.6 ? pick(['Investigating further', 'Escalated to Tier 2', 'Awaiting response from asset owner', 'Correlated with other events', 'Known false positive pattern']) : null,
        created_at: event.timestamp,
        updated_at: event.timestamp,
        resolved_at: null,
    };
}

async function seed() {
    const { initializeSchema } = require('./schema');
    initializeSchema();
    const db = getDb();

    console.log('🔧 Seeding database...');

    // Initialize real threat feeds first so historical events use them
    await initThreatFeeds();

    // Seed detection rules
    const rules = [
        { id: uuidv4(), name: 'Brute Force Detection', description: 'Detects multiple failed authentication attempts', category: 'authentication', severity: 'high', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'authentication', threshold: 5 }), mitre_tactic: 'TA0006', mitre_technique: 'T1110' },
        { id: uuidv4(), name: 'Port Scan Detection', description: 'Detects network port scanning activity', category: 'network', severity: 'high', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'network', threshold: 10 }), mitre_tactic: 'TA0007', mitre_technique: 'T1046' },
        { id: uuidv4(), name: 'Malware Detection', description: 'Detects known malware signatures', category: 'malware', severity: 'critical', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'malware' }), mitre_tactic: 'TA0002', mitre_technique: 'T1204' },
        { id: uuidv4(), name: 'Data Exfiltration', description: 'Detects potential data loss', category: 'dlp', severity: 'critical', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'dlp' }), mitre_tactic: 'TA0010', mitre_technique: 'T1041' },
        { id: uuidv4(), name: 'Phishing Detection', description: 'Detects phishing email attempts', category: 'email', severity: 'high', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'email' }), mitre_tactic: 'TA0001', mitre_technique: 'T1566' },
        { id: uuidv4(), name: 'Privilege Escalation', description: 'Detects privilege escalation attempts', category: 'endpoint', severity: 'critical', logic: JSON.stringify({ field: 'action', operator: 'equals', value: 'escalate' }), mitre_tactic: 'TA0004', mitre_technique: 'T1068' },
        { id: uuidv4(), name: 'DNS Tunneling', description: 'Detects DNS tunneling for data exfiltration', category: 'network', severity: 'high', logic: JSON.stringify({ field: 'subcategory', operator: 'equals', value: 'DNS' }), mitre_tactic: 'TA0011', mitre_technique: 'T1071' },
        { id: uuidv4(), name: 'Lateral Movement', description: 'Detects lateral movement attempts', category: 'network', severity: 'high', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'network' }), mitre_tactic: 'TA0008', mitre_technique: 'T1021' },
        { id: uuidv4(), name: 'Suspicious PowerShell', description: 'Detects encoded PowerShell commands', category: 'endpoint', severity: 'high', logic: JSON.stringify({ field: 'description', operator: 'contains', value: 'PowerShell' }), mitre_tactic: 'TA0002', mitre_technique: 'T1059' },
        { id: uuidv4(), name: 'Cloud IAM Anomaly', description: 'Detects unusual IAM activity', category: 'cloud', severity: 'medium', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'cloud' }), mitre_tactic: 'TA0006', mitre_technique: 'T1078' },
        { id: uuidv4(), name: 'WAF Rule Violation', description: 'Detects web application attacks', category: 'web', severity: 'medium', logic: JSON.stringify({ field: 'event_type', operator: 'equals', value: 'web' }), mitre_tactic: 'TA0001', mitre_technique: 'T1190' },
        { id: uuidv4(), name: 'Ransomware Behavior', description: 'Detects ransomware-like file encryption patterns', category: 'malware', severity: 'critical', logic: JSON.stringify({ field: 'description', operator: 'contains', value: 'Ransomware' }), mitre_tactic: 'TA0040', mitre_technique: 'T1486' },
    ];

    const insertRule = db.prepare(`INSERT INTO rules (id, name, description, category, severity, logic, mitre_tactic, mitre_technique) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const r of rules) {
        insertRule.run(r.id, r.name, r.description, r.category, r.severity, r.logic, r.mitre_tactic, r.mitre_technique);
    }
    console.log(`  ✅ ${rules.length} detection rules`);

    // No historical events/alerts/incidents — SIEM shows real-time data only.
    // Events, alerts, and incidents are generated live by the simulator + detection engine.
    console.log('  ℹ️  Skipping historical data — SIEM will show real-time data only');

    // Seed assets
    const assets = [
        { hostname: 'dc-01.corp.local', ip: '10.0.1.10', os: 'Windows Server 2022', type: 'Domain Controller', criticality: 'critical', dept: 'IT', owner: 'admin' },
        { hostname: 'dc-02.corp.local', ip: '10.0.1.11', os: 'Windows Server 2022', type: 'Domain Controller', criticality: 'critical', dept: 'IT', owner: 'admin' },
        { hostname: 'web-01.corp.local', ip: '10.0.1.15', os: 'Ubuntu 22.04', type: 'Web Server', criticality: 'high', dept: 'Engineering', owner: 'webadmin' },
        { hostname: 'web-02.corp.local', ip: '10.0.1.20', os: 'Ubuntu 22.04', type: 'Web Server', criticality: 'high', dept: 'Engineering', owner: 'webadmin' },
        { hostname: 'db-01.corp.local', ip: '10.0.2.10', os: 'CentOS 8', type: 'Database', criticality: 'critical', dept: 'Engineering', owner: 'dbadmin' },
        { hostname: 'db-02.corp.local', ip: '10.0.2.11', os: 'CentOS 8', type: 'Database', criticality: 'critical', dept: 'Engineering', owner: 'dbadmin' },
        { hostname: 'mail-01.corp.local', ip: '10.0.2.15', os: 'Exchange 2019', type: 'Mail Server', criticality: 'high', dept: 'IT', owner: 'admin' },
        { hostname: 'fw-01.corp.local', ip: '10.0.3.5', os: 'pfSense', type: 'Firewall', criticality: 'critical', dept: 'Security', owner: 'operator01' },
        { hostname: 'fw-02.corp.local', ip: '10.0.3.10', os: 'pfSense', type: 'Firewall', criticality: 'critical', dept: 'Security', owner: 'operator01' },
        { hostname: 'vpn-01.corp.local', ip: '10.0.3.15', os: 'OpenVPN', type: 'VPN Gateway', criticality: 'high', dept: 'IT', owner: 'admin' },
        { hostname: 'ids-01.corp.local', ip: '10.0.3.20', os: 'Suricata', type: 'IDS/IPS', criticality: 'high', dept: 'Security', owner: 'analyst01' },
        { hostname: 'proxy-01.corp.local', ip: '10.0.2.20', os: 'Squid', type: 'Proxy', criticality: 'medium', dept: 'IT', owner: 'admin' },
        { hostname: 'file-01.corp.local', ip: '10.0.1.25', os: 'Windows Server 2022', type: 'File Server', criticality: 'high', dept: 'IT', owner: 'admin' },
        { hostname: 'app-01.corp.local', ip: '10.0.2.25', os: 'Docker', type: 'Application', criticality: 'medium', dept: 'Engineering', owner: 'deploy_bot' },
        { hostname: 'backup-01.corp.local', ip: '172.16.0.10', os: 'Ubuntu 22.04', type: 'Backup', criticality: 'high', dept: 'IT', owner: 'svc_backup' },
    ];

    const insertAsset = db.prepare(`INSERT INTO assets (id, hostname, ip_address, os, asset_type, criticality, department, owner, status, last_seen, vulnerabilities, risk_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`);
    for (const a of assets) {
        insertAsset.run(uuidv4(), a.hostname, a.ip, a.os, a.type, a.criticality, a.dept, a.owner, new Date(now - randInt(0, 3600000)).toISOString(), randInt(0, 25), Math.round(Math.random() * 100));
    }
    console.log(`  ✅ ${assets.length} assets`);

    // Seed threat intel
    const threatIntel = [
        { type: 'ip', value: '185.220.101.1', threat: 'C2 Server', confidence: 95, source: 'AlienVault OTX', desc: 'Known Tor exit node used for C2 communication' },
        { type: 'ip', value: '91.219.236.222', threat: 'Botnet', confidence: 88, source: 'AbuseIPDB', desc: 'Part of Mirai botnet infrastructure' },
        { type: 'ip', value: '45.33.32.156', threat: 'Scanner', confidence: 72, source: 'Shodan', desc: 'Aggressive internet scanner' },
        { type: 'domain', value: 'evil-update.xyz', threat: 'Malware Distribution', confidence: 99, source: 'VirusTotal', desc: 'Distributes Emotet malware' },
        { type: 'domain', value: 'phish-bank.com', threat: 'Phishing', confidence: 97, source: 'PhishTank', desc: 'Banking credential phishing site' },
        { type: 'domain', value: 'c2-relay.onion.ws', threat: 'C2 Server', confidence: 91, source: 'ThreatFox', desc: 'Cobalt Strike C2 relay node' },
        { type: 'hash', value: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', threat: 'Ransomware', confidence: 100, source: 'MalwareBazaar', desc: 'LockBit 3.0 ransomware sample' },
        { type: 'hash', value: 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3', threat: 'Trojan', confidence: 94, source: 'MISP', desc: 'AgentTesla keylogger' },
        { type: 'url', value: 'http://185.220.101.1/payload.exe', threat: 'Malware', confidence: 96, source: 'URLhaus', desc: 'Malware dropper URL' },
        { type: 'email', value: 'support@phish-bank.com', threat: 'Phishing', confidence: 93, source: 'SpamAssassin', desc: 'Phishing email sender' },
        { type: 'ip', value: '77.247.181.163', threat: 'Tor Exit', confidence: 85, source: 'TorProject', desc: 'Tor exit node frequently used in attacks' },
        { type: 'ip', value: '176.10.104.240', threat: 'Brute Force', confidence: 79, source: 'AbuseIPDB', desc: 'Frequent SSH brute force source' },
        { type: 'domain', value: 'crypto-mine-pool.ru', threat: 'Cryptomining', confidence: 87, source: 'AlienVault OTX', desc: 'Cryptocurrency mining pool' },
        { type: 'ip', value: '94.230.208.147', threat: 'APT', confidence: 92, source: 'MISP', desc: 'Associated with APT28 infrastructure' },
        { type: 'hash', value: 'deadbeef12345678deadbeef12345678', threat: 'Rootkit', confidence: 98, source: 'MalwareBazaar', desc: 'Linux rootkit binary' },
    ];

    const insertTI = db.prepare(`INSERT INTO threat_intel (id, ioc_type, ioc_value, threat_type, confidence, source, description, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const ti of threatIntel) {
        insertTI.run(uuidv4(), ti.type, ti.value, ti.threat, ti.confidence, ti.source, ti.desc, new Date(now - randInt(86400000, 2592000000)).toISOString(), new Date(now - randInt(0, 86400000)).toISOString());
    }
    console.log(`  ✅ ${threatIntel.length} threat intel IOCs`);

    // Seed compliance checks
    const complianceFrameworks = [
        {
            framework: 'PCI-DSS', controls: [
                { id: '1.1', name: 'Firewall Configuration', status: 'pass' }, { id: '1.2', name: 'Default Passwords Changed', status: 'pass' },
                { id: '2.1', name: 'Vendor Defaults Removed', status: 'pass' }, { id: '3.1', name: 'Stored Cardholder Data', status: 'fail' },
                { id: '6.1', name: 'Security Patches', status: 'warning' }, { id: '8.1', name: 'User Identification', status: 'pass' },
                { id: '10.1', name: 'Audit Trails', status: 'pass' }, { id: '11.1', name: 'Vulnerability Scanning', status: 'warning' },
            ]
        },
        {
            framework: 'HIPAA', controls: [
                { id: '164.308(a)(1)', name: 'Security Management Process', status: 'pass' }, { id: '164.308(a)(3)', name: 'Workforce Security', status: 'warning' },
                { id: '164.308(a)(5)', name: 'Security Awareness Training', status: 'pass' }, { id: '164.310(a)(1)', name: 'Facility Access Controls', status: 'pass' },
                { id: '164.312(a)(1)', name: 'Access Control', status: 'pass' }, { id: '164.312(e)(1)', name: 'Transmission Security', status: 'fail' },
            ]
        },
        {
            framework: 'SOC2', controls: [
                { id: 'CC1.1', name: 'Control Environment', status: 'pass' }, { id: 'CC2.1', name: 'Communication & Information', status: 'pass' },
                { id: 'CC3.1', name: 'Risk Assessment', status: 'warning' }, { id: 'CC5.1', name: 'Control Activities', status: 'pass' },
                { id: 'CC6.1', name: 'Logical & Physical Access', status: 'pass' }, { id: 'CC7.1', name: 'System Operations', status: 'pass' },
                { id: 'CC8.1', name: 'Change Management', status: 'fail' }, { id: 'CC9.1', name: 'Risk Mitigation', status: 'warning' },
            ]
        },
        {
            framework: 'NIST', controls: [
                { id: 'ID.AM-1', name: 'Physical Devices Inventory', status: 'pass' }, { id: 'ID.RA-1', name: 'Vulnerability Identification', status: 'warning' },
                { id: 'PR.AC-1', name: 'Identity & Credentials', status: 'pass' }, { id: 'PR.DS-1', name: 'Data-at-rest Protected', status: 'pass' },
                { id: 'DE.AE-1', name: 'Network Baseline', status: 'pass' }, { id: 'DE.CM-1', name: 'Network Monitoring', status: 'pass' },
                { id: 'RS.RP-1', name: 'Response Plan', status: 'warning' }, { id: 'RC.RP-1', name: 'Recovery Plan', status: 'fail' },
            ]
        },
    ];

    const insertCC = db.prepare(`INSERT INTO compliance_checks (id, framework, control_id, control_name, status, last_checked) VALUES (?, ?, ?, ?, ?, ?)`);
    let ccCount = 0;
    for (const fw of complianceFrameworks) {
        for (const c of fw.controls) {
            insertCC.run(uuidv4(), fw.framework, c.id, c.name, c.status, new Date(now - randInt(0, 86400000)).toISOString());
            ccCount++;
        }
    }
    console.log(`  ✅ ${ccCount} compliance checks`);

    db.close();
    console.log('\n🎉 Database seeded successfully!');
}

seed().then(() => {
    console.log('Done.');
    process.exit(0);
});
