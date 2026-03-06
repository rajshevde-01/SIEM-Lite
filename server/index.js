require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const { initializeSchema, getDb } = require('./db/schema');
const { generateLiveEvent, initThreatFeeds } = require('./engine/simulator');
const DetectionEngine = require('./engine/detection');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeSchema();

// Detection engine
let detectionEngine;
try {
    detectionEngine = new DetectionEngine();
} catch (e) {
    console.log('⚠️  Detection engine not ready (run seed first)');
}

// API Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/events', require('./routes/events'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/incidents', require('./routes/incidents'));

// The rules router needs access to the engine to reload rules dynamically
const rulesRouter = require('./routes/rules');
app.use('/api/rules', rulesRouter(detectionEngine));

app.use('/api/threat-intel', require('./routes/threat-intel'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/ai', require('./routes/ai'));

// Health check
app.get('/api/health', (req, res) => {
    const db = getDb();
    try {
        const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
        const alertCount = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;
        res.json({ status: 'healthy', events: eventCount, alerts: alertCount, uptime: process.uptime() });
    } catch (err) {
        res.json({ status: 'degraded', error: err.message });
    } finally {
        db.close();
    }
});

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`🔌 Client connected (${clients.size} total)`);

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`🔌 Client disconnected (${clients.size} total)`);
    });

    ws.on('error', () => clients.delete(ws));
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(msg);
        }
    }
}

// Event simulator - generates events every 2-5 seconds
let simulatorInterval;
function startSimulator() {
    const generateAndBroadcast = () => {
        const event = generateLiveEvent();

        // Store in database
        const db = getDb();
        try {
            db.prepare(`INSERT INTO events (id, timestamp, source_ip, dest_ip, source_port, dest_port, protocol, event_type, severity, category, subcategory, description, raw_log, hostname, username, action, outcome, mitre_tactic, mitre_technique, geo_country, geo_city, geo_lat, geo_lon, risk_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                event.id, event.timestamp, event.source_ip, event.dest_ip, event.source_port, event.dest_port,
                event.protocol, event.event_type, event.severity, event.category, event.subcategory,
                event.description, event.raw_log, event.hostname, event.username, event.action, event.outcome,
                event.mitre_tactic, event.mitre_technique, event.geo_country, event.geo_city, event.geo_lat, event.geo_lon, event.risk_score
            );

            // Run detection engine
            if (detectionEngine) {
                const detections = detectionEngine.evaluate(event);
                for (const det of detections) {
                    const alertId = uuidv4();
                    db.prepare(`INSERT INTO alerts (id, event_id, rule_id, title, description, severity, status, source_ip, dest_ip, mitre_tactic, mitre_technique, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`).run(
                        alertId, event.id, det.rule_id,
                        `${event.description} - ${event.source_ip}`,
                        det.description, det.severity,
                        event.source_ip, event.dest_ip,
                        det.mitre_tactic, det.mitre_technique,
                        event.timestamp, event.timestamp
                    );

                    broadcast({ type: 'alert', data: { id: alertId, ...det, event } });
                }
            }
        } catch (e) { } finally {
            db.close();
        }

        // Broadcast event to WebSocket clients
        broadcast({ type: 'event', data: event });

        // Schedule next event (random interval 1-4 seconds)
        const nextDelay = 1000 + Math.random() * 3000;
        simulatorInterval = setTimeout(generateAndBroadcast, nextDelay);
    };

    generateAndBroadcast();
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    console.log(`\n🛡️  SIEM Lite Server`);
    console.log(`   API:       http://localhost:${PORT}/api`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Health:    http://localhost:${PORT}/api/health\n`);

    // Initialize real threat feeds before starting simulator
    await initThreatFeeds();

    // Start event simulator
    startSimulator();
    console.log('📡 Event simulator started\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    clearTimeout(simulatorInterval);
    wss.close();
    server.close();
    process.exit(0);
});
