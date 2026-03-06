import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { fetchApi } from '../utils/api';

export default function Reports() {
    const [frameworks, setFrameworks] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedFw, setSelectedFw] = useState(null);

    useEffect(() => {
        Promise.all([fetchApi('/reports/compliance'), fetchApi('/reports/summary')]).then(([c, s]) => { setFrameworks(c.frameworks); setSummary(s); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

    const statusIcon = (s) => s === 'pass' ? <CheckCircle size={14} color="#00e676" /> : s === 'fail' ? <XCircle size={14} color="#ff1744" /> : <AlertTriangle size={14} color="#ffc400" />;

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><FileText className="icon" size={28} /> Compliance & Reports</h1>
                    <p className="page-description">Security compliance frameworks and reporting</p>
                </div>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
                    <div className="kpi-card" style={{ '--kpi-color': '#00d4ff' }}><div className="kpi-label">Events (24h)</div><div className="kpi-value" style={{ color: '#00d4ff', fontSize: 26 }}>{summary.events_24h?.toLocaleString()}</div></div>
                    <div className="kpi-card" style={{ '--kpi-color': '#ff006e' }}><div className="kpi-label">Events (7d)</div><div className="kpi-value" style={{ color: '#ff006e', fontSize: 26 }}>{summary.events_7d?.toLocaleString()}</div></div>
                    <div className="kpi-card" style={{ '--kpi-color': '#ff1744' }}><div className="kpi-label">Critical Alerts</div><div className="kpi-value" style={{ color: '#ff1744', fontSize: 26 }}>{summary.critical_alerts}</div></div>
                    <div className="kpi-card" style={{ '--kpi-color': '#ff6d00' }}><div className="kpi-label">Active Incidents</div><div className="kpi-value" style={{ color: '#ff6d00', fontSize: 26 }}>{summary.active_incidents}</div></div>
                </div>
            )}

            {/* Compliance Frameworks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                {frameworks.map(fw => {
                    const scoreColor = fw.score >= 80 ? '#00e676' : fw.score >= 60 ? '#ffc400' : '#ff1744';
                    return (
                        <div key={fw.framework} className="card" onClick={() => setSelectedFw(selectedFw === fw.framework ? null : fw.framework)} style={{ cursor: 'pointer', borderTop: `3px solid ${scoreColor}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 800 }}>{fw.framework}</h3>
                                <div className="gauge-circle" style={{ width: 70, height: 70, border: `3px solid ${scoreColor}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor, fontFamily: "'JetBrains Mono',monospace" }}>{fw.score}%</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                                <span style={{ color: '#00e676' }}>✓ {fw.pass} Pass</span>
                                <span style={{ color: '#ff1744' }}>✗ {fw.fail} Fail</span>
                                <span style={{ color: '#ffc400' }}>⚠ {fw.warning} Warn</span>
                            </div>
                            <div className="progress-bar" style={{ marginTop: 12, height: 6 }}>
                                <div className="progress-fill" style={{ width: `${fw.score}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}88)` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Controls Detail */}
            {selectedFw && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">{selectedFw} Controls</div>
                        <button className="btn btn-sm btn-outline" onClick={() => setSelectedFw(null)}>✕</button>
                    </div>
                    <table className="data-table">
                        <thead><tr><th>Control ID</th><th>Control Name</th><th>Status</th><th>Last Checked</th></tr></thead>
                        <tbody>
                            {frameworks.find(f => f.framework === selectedFw)?.controls.map(c => (
                                <tr key={c.id}>
                                    <td className="mono">{c.control_id}</td>
                                    <td style={{ color: '#fff' }}>{c.control_name}</td>
                                    <td><span className={`status-badge ${c.status}`}>{statusIcon(c.status)} {c.status}</span></td>
                                    <td className="mono" style={{ fontSize: 11 }}>{c.last_checked ? new Date(c.last_checked).toLocaleDateString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
