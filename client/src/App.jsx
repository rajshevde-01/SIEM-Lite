import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Activity, AlertTriangle, Bug, Search, Globe, Server, BarChart3, FileText, Settings, Bell, Crosshair, Clock, Zap, X, ChevronDown, Volume2 } from 'lucide-react';
import { createWebSocket, timeAgo } from './utils/api';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Alerts from './pages/Alerts';
import Incidents from './pages/Incidents';
import ThreatIntel from './pages/ThreatIntel';
import LogSearch from './pages/LogSearch';
import MitreAttack from './pages/MitreAttack';
import NetworkMap from './pages/NetworkMap';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import RulesSettings from './pages/Settings';
import './index.css';

function Sidebar({ alertCount, incidentCount, wsConnected, eventsPerSec }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Shield size={20} />
        </div>
        <div>
          <div className="sidebar-title">SIEM LITE</div>
          <div className="sidebar-subtitle">Security Command</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Overview</div>
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard className="icon" size={18} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Activity className="icon" size={18} />
          <span>Live Events</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#00e676', fontFamily: "'JetBrains Mono',monospace" }}>{eventsPerSec} EPS</span>
        </NavLink>

        <div className="sidebar-section-title">Threat Management</div>
        <NavLink to="/alerts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <AlertTriangle className="icon" size={18} />
          <span>Alerts</span>
          {alertCount > 0 && <span className="sidebar-badge">{alertCount > 99 ? '99+' : alertCount}</span>}
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Bug className="icon" size={18} />
          <span>Incidents</span>
          {incidentCount > 0 && <span className="sidebar-badge" style={{ background: '#ff6d00' }}>{incidentCount}</span>}
        </NavLink>
        <NavLink to="/threat-intel" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Crosshair className="icon" size={18} />
          <span>Threat Intel</span>
        </NavLink>

        <div className="sidebar-section-title">Analysis</div>
        <NavLink to="/log-search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Search className="icon" size={18} />
          <span>Log Search</span>
        </NavLink>
        <NavLink to="/mitre" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Globe className="icon" size={18} />
          <span>MITRE ATT&CK</span>
        </NavLink>
        <NavLink to="/network" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Server className="icon" size={18} />
          <span>Network Map</span>
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 className="icon" size={18} />
          <span>Analytics</span>
        </NavLink>

        <div className="sidebar-section-title">Management</div>
        <NavLink to="/reports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FileText className="icon" size={18} />
          <span>Reports</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings className="icon" size={18} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="status-dot" style={!wsConnected ? { background: '#ff6d00', boxShadow: '0 0 8px #ff6d00' } : {}}></span>
          <span>{wsConnected ? 'Connected — Live' : 'Reconnecting...'}</span>
        </div>
      </div>
    </aside>
  );
}

function Header({ onSearch, liveAlerts, onClearAlerts }) {
  const [time, setTime] = useState(new Date());
  const [searchVal, setSearchVal] = useState('');
  const [showNotif, setShowNotif] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchVal.trim()) {
      navigate(`/log-search?q=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal('');
    }
  };

  return (
    <header className="header">
      <div className="header-search">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Search events, alerts, IPs, hostnames... (Enter to search)"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>
      <div className="header-right">
        <div className="header-time">
          <Clock size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </div>
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button className="header-btn" onClick={() => setShowNotif(!showNotif)}>
            <Bell size={18} />
            {liveAlerts.length > 0 && <span className="notification-dot"></span>}
          </button>
          {showNotif && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 400, maxHeight: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => { onClearAlerts(); setShowNotif(false); }}>Clear All</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setShowNotif(false)}><X size={16} /></button>
                </div>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {liveAlerts.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No new notifications</div>
                ) : (
                  liveAlerts.slice(0, 20).map((a, i) => (
                    <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(136,146,176,0.06)', cursor: 'pointer', transition: 'background 0.15s' }} onClick={() => { navigate('/alerts'); setShowNotif(false); }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.severity === 'critical' ? '#ff1744' : '#ff6d00', marginTop: 6, flexShrink: 0, boxShadow: `0 0 6px ${a.severity === 'critical' ? '#ff1744' : '#ff6d00'}` }}></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.rule_name || a.description || 'Alert triggered'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.event?.source_ip} → {a.event?.dest_ip} · <span className={`severity-badge ${a.severity}`} style={{ fontSize: 9 }}>{a.severity}</span></div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{timeAgo(a.event?.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {liveAlerts.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <button className="btn btn-sm btn-primary" style={{ width: '100%' }} onClick={() => { navigate('/alerts'); setShowNotif(false); }}>View All Alerts</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Error boundary
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <AlertTriangle size={48} color="#ff1744" style={{ marginBottom: 16 }} />
          <h3 style={{ color: '#ff1744', marginBottom: 8 }}>Something went wrong</h3>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: 16 }}>{this.state.error.message}</p>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [alertCount, setAlertCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [eventsPerSec, setEventsPerSec] = useState(0);
  const eventCountRef = useRef(0);
  const location = useLocation();

  // Reset alert badge when visiting alerts page
  useEffect(() => {
    if (location.pathname === '/alerts') setAlertCount(0);
  }, [location.pathname]);

  // Calculate EPS
  useEffect(() => {
    const interval = setInterval(() => {
      setEventsPerSec(eventCountRef.current);
      eventCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = createWebSocket(
      (msg) => {
        if (msg.type === 'event') {
          eventCountRef.current++;
          setLiveEvents(prev => [msg.data, ...prev].slice(0, 500));
        } else if (msg.type === 'alert') {
          setLiveAlerts(prev => [msg.data, ...prev].slice(0, 100));
          setAlertCount(prev => prev + 1);
        }
      },
      () => setWsConnected(true),
      () => setWsConnected(false)
    );
    return () => ws.close();
  }, []);

  // Fetch initial incident count
  useEffect(() => {
    fetch('http://localhost:3001/api/incidents')
      .then(r => r.json())
      .then(d => setIncidentCount(d.incidents?.filter(i => !['closed', 'resolved'].includes(i.status)).length || 0))
      .catch(() => { });
  }, []);

  return (
    <div className="app-layout">
      <Sidebar alertCount={alertCount} incidentCount={incidentCount} wsConnected={wsConnected} eventsPerSec={eventsPerSec} />
      <main className="app-main">
        <Header liveAlerts={liveAlerts} onClearAlerts={() => setLiveAlerts([])} />
        <div className="page-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard liveEvents={liveEvents} />} />
              <Route path="/events" element={<Events liveEvents={liveEvents} />} />
              <Route path="/alerts" element={<Alerts liveAlerts={liveAlerts} />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/threat-intel" element={<ThreatIntel />} />
              <Route path="/log-search" element={<LogSearch />} />
              <Route path="/mitre" element={<MitreAttack />} />
              <Route path="/network" element={<NetworkMap />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<RulesSettings />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
