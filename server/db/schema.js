const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'siem.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initializeSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source_ip TEXT,
      dest_ip TEXT,
      source_port INTEGER,
      dest_port INTEGER,
      protocol TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      category TEXT,
      subcategory TEXT,
      description TEXT,
      raw_log TEXT,
      hostname TEXT,
      username TEXT,
      action TEXT,
      outcome TEXT,
      mitre_tactic TEXT,
      mitre_technique TEXT,
      geo_country TEXT,
      geo_city TEXT,
      geo_lat REAL,
      geo_lon REAL,
      risk_score REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      rule_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      source_ip TEXT,
      dest_ip TEXT,
      mitre_tactic TEXT,
      mitre_technique TEXT,
      false_positive INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (rule_id) REFERENCES rules(id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'medium',
      assigned_to TEXT,
      category TEXT,
      affected_assets TEXT,
      ioc_list TEXT,
      timeline TEXT,
      playbook TEXT,
      resolution TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      enabled INTEGER DEFAULT 1,
      logic TEXT NOT NULL,
      mitre_tactic TEXT,
      mitre_technique TEXT,
      threshold INTEGER DEFAULT 1,
      time_window INTEGER DEFAULT 300,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS threat_intel (
      id TEXT PRIMARY KEY,
      ioc_type TEXT NOT NULL,
      ioc_value TEXT NOT NULL,
      threat_type TEXT,
      confidence REAL DEFAULT 0,
      source TEXT,
      description TEXT,
      tags TEXT,
      first_seen TEXT,
      last_seen TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      ip_address TEXT,
      mac_address TEXT,
      os TEXT,
      asset_type TEXT,
      criticality TEXT DEFAULT 'medium',
      department TEXT,
      owner TEXT,
      status TEXT DEFAULT 'active',
      last_seen TEXT,
      vulnerabilities INTEGER DEFAULT 0,
      risk_score REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_checks (
      id TEXT PRIMARY KEY,
      framework TEXT NOT NULL,
      control_id TEXT NOT NULL,
      control_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      evidence TEXT,
      last_checked TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
    CREATE INDEX IF NOT EXISTS idx_events_source_ip ON events(source_ip);
    CREATE INDEX IF NOT EXISTS idx_events_dest_ip ON events(dest_ip);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_threat_intel_ioc ON threat_intel(ioc_value);
  `);

  db.close();
}

module.exports = { getDb, initializeSchema, DB_PATH };
