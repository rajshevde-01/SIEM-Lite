const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001/ws';

export async function fetchApi(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

export function createWebSocket(onMessage, onOpen, onClose) {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)); } catch { }
    };
    ws.onopen = () => onOpen?.();
    ws.onclose = () => {
        onClose?.();
        setTimeout(() => createWebSocket(onMessage, onOpen, onClose), 3000);
    };
    ws.onerror = () => ws.close();
    return ws;
}

export const SEVERITY_COLORS = {
    critical: '#ff1744', high: '#ff6d00', medium: '#ffc400', low: '#00e5ff', info: '#8892b0'
};

export const CHART_COLORS = ['#00d4ff', '#ff006e', '#a855f7', '#00e676', '#ff6d00', '#ffc400', '#00e5ff', '#ff1744'];

export const MITRE_TACTICS = {
    'TA0001': 'Initial Access', 'TA0002': 'Execution', 'TA0003': 'Persistence',
    'TA0004': 'Privilege Escalation', 'TA0005': 'Defense Evasion', 'TA0006': 'Credential Access',
    'TA0007': 'Discovery', 'TA0008': 'Lateral Movement', 'TA0009': 'Collection',
    'TA0010': 'Exfiltration', 'TA0011': 'Command & Control', 'TA0040': 'Impact',
};

export const MITRE_TECHNIQUES = {
    'T1566': 'Phishing', 'T1190': 'Exploit Public App', 'T1133': 'External Remote Services', 'T1078': 'Valid Accounts',
    'T1059': 'Command Scripting', 'T1204': 'User Execution', 'T1053': 'Scheduled Task', 'T1203': 'Client Execution',
    'T1547': 'Boot Autostart', 'T1136': 'Create Account', 'T1543': 'System Services',
    'T1548': 'Abuse Elevation', 'T1134': 'Token Manipulation', 'T1068': 'Exploit for Priv Esc', 'T1055': 'Process Injection',
    'T1070': 'Indicator Removal', 'T1036': 'Masquerading', 'T1027': 'Obfuscated Files', 'T1562': 'Impair Defenses',
    'T1110': 'Brute Force', 'T1003': 'OS Credential Dump', 'T1555': 'Credentials from Store', 'T1558': 'Steal Tickets',
    'T1087': 'Account Discovery', 'T1082': 'System Info Discovery', 'T1083': 'File Discovery', 'T1046': 'Network Scanning',
    'T1021': 'Remote Services', 'T1570': 'Lateral Tool Transfer', 'T1080': 'Taint Shared Content', 'T1550': 'Use Alt Auth',
    'T1560': 'Archive Data', 'T1119': 'Automated Collection', 'T1005': 'Data from Local', 'T1074': 'Data Staged',
    'T1041': 'Exfil Over C2', 'T1048': 'Exfil Over Alt Protocol', 'T1567': 'Exfil Over Web', 'T1029': 'Scheduled Transfer',
    'T1071': 'Application Layer Protocol', 'T1573': 'Encrypted Channel', 'T1105': 'Ingress Tool Transfer', 'T1572': 'Protocol Tunneling',
    'T1486': 'Data Encrypted for Impact', 'T1490': 'Inhibit Recovery', 'T1489': 'Service Stop', 'T1529': 'System Shutdown',
};

export function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function timeAgo(ts) {
    if (!ts) return '-';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
