import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Crosshair, Eye, ShieldAlert, Cpu, Activity, Clock, Shield, Sparkles } from 'lucide-react';
import { fetchApi, timeAgo } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function Alerts({ liveAlerts = [] }) {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState({ severity: '', status: '', search: '' });
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const navigate = useNavigate();

    const loadAlerts = () => {
        const params = new URLSearchParams({ page, limit: 30 });
        if (filter.severity) params.set('severity', filter.severity);
        if (filter.status) params.set('status', filter.status);
        if (filter.search) params.set('search', filter.search);
        fetchApi(`/alerts?${params}`).then(d => { setAlerts(d.alerts); setTotal(d.total); });
        fetchApi('/alerts/stats').then(setStats);
    };

    useEffect(() => { loadAlerts(); }, [page, filter]);

    // Handle incoming live alerts from WebSocket (via App.js state)
    useEffect(() => {
        if (liveAlerts.length > 0) {
            // Check if we are on the first page and not heavily filtering before injecting
            if (page === 1 && !filter.search) {
                const newAlerts = liveAlerts.filter(la => !alerts.find(a => a.id === la.id));
                if (newAlerts.length > 0) {
                    setAlerts(prev => {
                        const combined = [...newAlerts, ...prev];
                        return combined.slice(0, 30); // keep pagination size
                    });
                    setTotal(prev => prev + newAlerts.length);
                    // Optionally update stats block roughly
                    setStats(prev => prev ? { ...prev, openCount: prev.openCount + newAlerts.length, todayCount: prev.todayCount + newAlerts.length } : null);
                }
            }
        }
    }, [liveAlerts]);

    const updateAlert = async (id, updates) => {
        await fetchApi(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
        loadAlerts();
        if (selectedAlert?.id === id) {
            setSelectedAlert(prev => ({ ...prev, ...updates }));
        }
    };

    const analyzeAlert = async () => {
        if (!selectedAlert) return;
        setIsAnalyzing(true);
        setAiAnalysis(null);
        try {
            const data = await fetchApi(`/ai/analyze-alert/${selectedAlert.id}`, { method: 'POST' });
            setAiAnalysis(data.analysis);
        } catch (error) {
            console.error('AI Analysis Failed:', error);
            setAiAnalysis({ executive_summary: "AI Service Currently Unavailable. Ensure API key is configured.", remediation_steps: [] });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Reset AI state when switching alerts
    useEffect(() => {
        setAiAnalysis(null);
        setIsAnalyzing(false);
    }, [selectedAlert?.id]);

    return (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title"><AlertTriangle className="icon" size={28} /> Alert Management</h1>
                    <p className="page-description">Triage, investigate, and resolve security alerts</p>
                </div>
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="grid-4" style={{ marginBottom: 20 }}>
                    <div className="kpi-card" style={{ '--kpi-color': '#ff1744' }}>
                        <div className="kpi-label">Open Critical</div>
                        <div className="kpi-value" style={{ color: '#ff1744', fontSize: 28 }}>{stats.bySeverity?.find(s => s.severity === 'critical')?.count || 0}</div>
                    </div>
                    <div className="kpi-card" style={{ '--kpi-color': '#ffc400' }}>
                        <div className="kpi-label">Total Open</div>
                        <div className="kpi-value" style={{ color: '#ffc400', fontSize: 28 }}>{stats.openCount}</div>
                    </div>
                    <div className="kpi-card" style={{ '--kpi-color': '#00d4ff' }}>
                        <div className="kpi-label">Alerts Today</div>
                        <div className="kpi-value" style={{ color: '#00d4ff', fontSize: 28 }}>{stats.todayCount}</div>
                    </div>
                    <div className="kpi-card" style={{ '--kpi-color': '#00e676' }}>
                        <div className="kpi-label">Avg Resolution (MTTR)</div>
                        <div className="kpi-value" style={{ color: '#00e676', fontSize: 28 }}>{stats.avgResolutionHours?.toFixed(1) || '0.0'}h</div>
                    </div>
                </div>
            )}

            <div className="filter-bar" style={{ flexShrink: 0 }}>
                <select value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value, page: 1 })}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value, page: 1 })}>
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                </select>
                <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                    <input type="text" placeholder="Search by IP, title, or tactic..." className="search-input" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value, page: 1 })} style={{ width: '100%' }} />
                </div>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="data-table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Attacker IP</th>
                                <th>Target IP</th>
                                <th>Age</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#5a6380' }}>No alerts found matching filters.</td></tr>
                            ) : alerts.map(a => (
                                <tr key={a.id} style={{ cursor: 'pointer', background: selectedAlert?.id === a.id ? 'var(--bg-card)' : undefined, borderLeft: selectedAlert?.id === a.id ? `3px solid ${a.severity === 'critical' ? '#ff1744' : '#00d4ff'}` : '3px solid transparent' }} onClick={() => setSelectedAlert(a)}>
                                    <td><span className={`severity-badge ${a.severity}`}>{a.severity}</span></td>
                                    <td style={{ maxWidth: 300, color: '#fff' }} className="truncate" title={a.title}>{a.title}</td>
                                    <td><span className={`status-badge ${a.status}`}>{a.status}</span></td>
                                    <td className="mono hover-link" onClick={(e) => { e.stopPropagation(); navigate(`/log-search?q=${a.source_ip}`); }}>{a.source_ip}</td>
                                    <td className="mono">{a.dest_ip}</td>
                                    <td className="mono" style={{ fontSize: 11 }}>{timeAgo(a.created_at)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                            {a.status === 'open' && (
                                                <button className="btn btn-sm" style={{ background: 'rgba(255,196,0,0.1)', color: '#ffc400', border: '1px solid rgba(255,196,0,0.3)' }} onClick={() => updateAlert(a.id, { status: 'investigating' })}>
                                                    <Eye size={12} style={{ marginRight: 4 }} /> Investigate
                                                </button>
                                            )}
                                            {a.status !== 'resolved' && a.status !== 'false_positive' && (
                                                <button className="btn btn-sm" style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)' }} onClick={() => updateAlert(a.id, { status: 'resolved' })}>
                                                    <CheckCircle size={12} style={{ marginRight: 4 }} /> Resolve
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', margin: 0 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="page-info">Page <span style={{ color: '#00d4ff', fontWeight: 700 }}>{page}</span> of {Math.max(1, Math.ceil(total / 30))}</span>
                    <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            </div>

            {/* Cyber-styled Alert Detail Modal */}
            {selectedAlert && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 7, 20, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedAlert(null)}>
                    <div className="card animate-fade-up" style={{ width: aiAnalysis || isAnalyzing ? 1000 : 800, transition: 'width 0.3s ease', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: `1px solid ${selectedAlert.severity === 'critical' ? '#ff1744' : selectedAlert.severity === 'high' ? '#ff6d00' : 'var(--border)'}`, boxShadow: `0 0 40px ${selectedAlert.severity === 'critical' ? 'rgba(255,23,68,0.2)' : 'rgba(0,0,0,0.5)'}`, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                        <div style={{ padding: '20px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <ShieldAlert color={selectedAlert.severity === 'critical' ? '#ff1744' : '#ffc400'} size={24} />
                                    <span className={`severity-badge ${selectedAlert.severity}`} style={{ fontSize: 13, padding: '4px 10px' }}>{selectedAlert.severity.toUpperCase()} ALERT</span>
                                    <span className={`status-badge ${selectedAlert.status}`}>{selectedAlert.status.replace('_', ' ').toUpperCase()}</span>
                                    <span className="mono" style={{ color: '#5a6380', fontSize: 12 }}>ID: {selectedAlert.id.split('-')[0]}</span>
                                </div>
                                <h2 style={{ fontSize: 20, color: '#fff', margin: 0 }}>{selectedAlert.title}</h2>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                {!aiAnalysis && !isAnalyzing && (
                                    <button className="btn btn-sm" style={{ background: 'linear-gradient(45deg, #a855f7, #ec4899)', border: 'none', color: '#fff' }} onClick={analyzeAlert}>
                                        <Sparkles size={14} style={{ marginRight: 6 }} /> Analyze with AI
                                    </button>
                                )}
                                <button className="btn btn-sm btn-outline" onClick={() => setSelectedAlert(null)}>✕</button>
                            </div>
                        </div>

                        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', gap: 24 }}>
                            <div style={{ flex: 2 }}>
                                <h3 style={{ fontSize: 12, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Description & Context</h3>
                                <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, border: '1px solid rgba(136,146,176,0.1)' }}>{selectedAlert.description}</p>

                                <h3 style={{ fontSize: 12, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12 }}>Detection Metadata</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, border: '1px solid rgba(136,146,176,0.1)' }}>
                                    <div><span style={{ color: '#5a6380', fontSize: 11, display: 'block' }}>MITRE Tactic</span> <span style={{ color: '#fff', fontSize: 13 }}>{selectedAlert.mitre_tactic}</span></div>
                                    <div><span style={{ color: '#5a6380', fontSize: 11, display: 'block' }}>MITRE Technique</span> <span style={{ color: '#fff', fontSize: 13 }}>{selectedAlert.mitre_technique}</span></div>
                                    <div><span style={{ color: '#5a6380', fontSize: 11, display: 'block' }}>Detected By</span> <span style={{ color: '#fff', fontSize: 13 }}>Correlation Engine</span></div>
                                    <div><span style={{ color: '#5a6380', fontSize: 11, display: 'block' }}>Time Detected</span> <span className="mono" style={{ color: '#fff', fontSize: 13 }}>{new Date(selectedAlert.created_at).toLocaleString()}</span></div>
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <h3 style={{ fontSize: 12, color: '#ff1744', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Crosshair size={14} /> Attacker</h3>
                                    <div className="mono" style={{ fontSize: 18, color: '#fff', marginBottom: 4 }}>{selectedAlert.source_ip}</div>
                                    <button className="btn btn-sm btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={() => { setSelectedAlert(null); navigate(`/log-search?q=${selectedAlert.source_ip}`); }}>Search Logs for IP</button>
                                </div>

                                <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <h3 style={{ fontSize: 12, color: '#00e676', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> Target</h3>
                                    <div className="mono" style={{ fontSize: 18, color: '#fff' }}>{selectedAlert.dest_ip}</div>
                                    <div style={{ fontSize: 12, color: '#8892b0', marginTop: 4 }}>Asset lookup required.</div>
                                </div>
                            </div>

                            {/* AI Analysis Panel */}
                            {(isAnalyzing || aiAnalysis) && (
                                <div className="animate-fade-up" style={{ flex: 1.5, background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.05) 0%, rgba(0,0,0,0) 100%)', borderLeft: '1px solid var(--border)', paddingLeft: 24, paddingRight: 8, display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ fontSize: 12, color: '#a855f7', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Sparkles size={14} /> AI Security Analyst
                                    </h3>

                                    {isAnalyzing ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, color: '#a855f7' }}>
                                            <div className="loading-spinner" style={{ borderColor: 'rgba(168, 85, 247, 0.3)', borderTopColor: '#a855f7' }}></div>
                                            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>Analyzing Threat Vector...</div>
                                        </div>
                                    ) : aiAnalysis && (
                                        <div style={{ overflowY: 'auto', paddingRight: 8, flex: 1 }}>
                                            <div style={{ marginBottom: 20 }}>
                                                <h4 style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>Executive Summary</h4>
                                                <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>{aiAnalysis.executive_summary}</p>
                                            </div>

                                            {aiAnalysis.remediation_steps && aiAnalysis.remediation_steps.length > 0 && (
                                                <div>
                                                    <h4 style={{ fontSize: 13, color: '#00e676', marginBottom: 8 }}>Remediation Steps</h4>
                                                    <ul style={{ paddingLeft: 20, margin: 0, color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>
                                                        {aiAnalysis.remediation_steps.map((step, i) => (
                                                            <li key={i} style={{ marginBottom: 8 }}>{step}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        <div style={{ padding: '16px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 12, color: '#5a6380' }}>
                                Assigned to: <span style={{ color: '#fff', fontWeight: 600 }}>{selectedAlert.assigned_to || 'Unassigned'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn" style={{ background: 'rgba(136,146,176,0.1)', color: '#fff' }} onClick={() => updateAlert(selectedAlert.id, { assigned_to: 'Current User' })}>Claim Alert</button>

                                {selectedAlert.status === 'open' && (
                                    <button className="btn" style={{ background: 'rgba(255,196,0,0.1)', color: '#ffc400', border: '1px solid rgba(255,196,0,0.5)' }} onClick={() => updateAlert(selectedAlert.id, { status: 'investigating' })}>Start Investigation</button>
                                )}

                                <button className="btn" style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.5)' }} onClick={() => updateAlert(selectedAlert.id, { status: 'resolved' })}>Resolve True Positive</button>

                                <button className="btn btn-outline" style={{ color: '#a855f7', borderColor: '#a855f7' }} onClick={() => updateAlert(selectedAlert.id, { false_positive: true, status: 'false_positive' })}>False Positive</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
