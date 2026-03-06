import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Shield, AlertTriangle, Activity, Server, Zap, TrendingUp, Eye, ShieldAlert, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchApi, SEVERITY_COLORS, CHART_COLORS, formatTime, timeAgo } from '../utils/api';

export default function Dashboard({ liveEvents = [] }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Load initial 24h baseline data once
    useEffect(() => {
        let mounted = true;
        fetchApi('/dashboard?hours=24').then(d => {
            if (mounted) { setData(d); setLoading(false); }
        }).catch(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, []);

    // Merge live WS events dynamically into the dashboard baseline dataset
    const mergedData = useMemo(() => {
        if (!data) return null;
        const d = { ...data };

        // Count how many new events arrived that aren't in the baseline fetch
        // We do a rough approximation by increasing the KPI counters
        d.kpi = { ...d.kpi };
        d.kpi.totalEvents += liveEvents.length;

        // Approximate new threats blocked
        const blockedLive = liveEvents.filter(e => ['blocked', 'quarantined', 'deny'].includes(e.outcome)).length;
        d.kpi.threatsBlocked += blockedLive;

        // Recalculate EPS roughly on the fly based on the latest WS burst
        if (liveEvents.length > 0) {
            const timeSpan = (new Date(liveEvents[0].timestamp).getTime() - new Date(liveEvents[Math.min(liveEvents.length - 1, 10)].timestamp).getTime()) / 1000;
            if (timeSpan > 0) d.kpi.eps = (liveEvents.length / Math.max(1, timeSpan)).toFixed(2);
        }

        return d;
    }, [data, liveEvents]);

    if (loading) return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Shield className="icon" size={28} /> Security Overview</h1>
                    <p className="page-description">Real-time security posture — Last 24 hours</p>
                </div>
            </div>
            <div className="kpi-grid">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton skeleton-kpi"></div>)}
            </div>
            <div className="grid-2">
                <div className="card"><div className="skeleton skeleton-chart"></div></div>
                <div className="card"><div className="skeleton skeleton-chart"></div></div>
            </div>
        </div>
    );

    if (!mergedData) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

    const { kpi, severityDist, eventTypeDist, topAttackers, geoDist, recentAlerts, protocolDist, eventTimeline } = mergedData;

    // Process timeline data for chart
    const timelineMap = {};
    eventTimeline.forEach(t => {
        if (!timelineMap[t.hour]) timelineMap[t.hour] = { hour: t.hour.split('T')[1]?.slice(0, 5) || t.hour };
        timelineMap[t.hour][t.severity] = (timelineMap[t.hour][t.severity] || 0) + t.count;
    });
    const timelineData = Object.values(timelineMap).slice(-24);

    const handleChartClick = (type, value) => {
        if (type === 'severity') navigate(`/log-search?q=severity:${value}`);
        else if (type === 'type') navigate(`/log-search?q=event_type:${value}`);
        else if (type === 'ip') navigate(`/log-search?q=${value}`);
    };

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Shield className="icon" size={28} /> Security Overview</h1>
                    <p className="page-description">Real-time security posture — Last 24 hours</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card" style={{ '--kpi-color': '#00d4ff', cursor: 'pointer' }} onClick={() => navigate('/events')}>
                    <div className="kpi-label">Total Events</div>
                    <div className="kpi-value" style={{ color: '#00d4ff' }}>{kpi.totalEvents?.toLocaleString()}</div>
                    <div className="kpi-trend"><Zap size={12} /> {kpi.eps} EPS</div>
                    <div className="kpi-icon"><Activity size={48} color="#00d4ff" /></div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#ff1744', cursor: 'pointer' }} onClick={() => navigate('/alerts')}>
                    <div className="kpi-label">Critical Alerts</div>
                    <div className="kpi-value" style={{ color: '#ff1744' }}>{kpi.criticalAlerts}</div>
                    <div className="kpi-trend up">Needs attention</div>
                    <div className="kpi-icon"><AlertTriangle size={48} color="#ff1744" /></div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#ff6d00', cursor: 'pointer' }} onClick={() => navigate('/alerts')}>
                    <div className="kpi-label">Open Alerts</div>
                    <div className="kpi-value" style={{ color: '#ff6d00' }}>{kpi.openAlerts}</div>
                    <div className="kpi-trend">Pending triage</div>
                    <div className="kpi-icon"><ShieldAlert size={48} color="#ff6d00" /></div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#ff006e', cursor: 'pointer' }} onClick={() => navigate('/incidents')}>
                    <div className="kpi-label">Active Incidents</div>
                    <div className="kpi-value" style={{ color: '#ff006e' }}>{kpi.activeIncidents || 0}</div>
                    <div className="kpi-trend">Under investigation</div>
                    <div className="kpi-icon"><Eye size={48} color="#ff006e" /></div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#00e676', cursor: 'pointer' }} onClick={() => navigate('/log-search?q=outcome:blocked')}>
                    <div className="kpi-label">Threats Blocked</div>
                    <div className="kpi-value" style={{ color: '#00e676' }}>{kpi.threatsBlocked?.toLocaleString()}</div>
                    <div className="kpi-trend down">Auto-mitigated</div>
                    <div className="kpi-icon"><Shield size={48} color="#00e676" /></div>
                </div>
                <div className="kpi-card" style={{ '--kpi-color': '#a855f7' }}>
                    <div className="kpi-label">Avg Risk Score</div>
                    <div className="kpi-value" style={{ color: kpi.avgRiskScore > 60 ? '#ff1744' : kpi.avgRiskScore > 30 ? '#ffc400' : '#00e676' }}>{kpi.avgRiskScore}</div>
                    <div className="kpi-trend">/100 composite</div>
                    <div className="kpi-icon"><TrendingUp size={48} color="#a855f7" /></div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid-2">
                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><Activity size={16} /> Event Timeline</div>
                        <span className="card-subtitle">Hourly breakdown by severity</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={timelineData} onClick={(e) => e && e.activePayload && navigate(`/log-search`)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.1)" />
                            <XAxis dataKey="hour" stroke="#5a6380" fontSize={11} />
                            <YAxis stroke="#5a6380" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#161b40', border: '1px solid rgba(136,146,176,0.15)', borderRadius: 8 }} />
                            <Area type="monotone" dataKey="critical" stackId="1" stroke="#ff1744" fill="rgba(255,23,68,0.3)" style={{ cursor: 'pointer' }} />
                            <Area type="monotone" dataKey="high" stackId="1" stroke="#ff6d00" fill="rgba(255,109,0,0.3)" style={{ cursor: 'pointer' }} />
                            <Area type="monotone" dataKey="medium" stackId="1" stroke="#ffc400" fill="rgba(255,196,0,0.2)" style={{ cursor: 'pointer' }} />
                            <Area type="monotone" dataKey="low" stackId="1" stroke="#00e5ff" fill="rgba(0,229,255,0.15)" style={{ cursor: 'pointer' }} />
                            <Area type="monotone" dataKey="info" stackId="1" stroke="#8892b0" fill="rgba(136,146,176,0.1)" style={{ cursor: 'pointer' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="card-title"><Globe size={16} /> Threat Geography</div>
                        <span className="card-subtitle">Attack origin locations</span>
                    </div>
                    <div className="world-map-container" style={{ height: 280, background: '#0d1130', borderRadius: 10, position: 'relative', overflow: 'hidden' }}>
                        <svg viewBox="0 0 800 400" style={{ width: '100%', height: '100%', opacity: 0.15 }}>
                            <ellipse cx="400" cy="200" rx="380" ry="180" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
                            <line x1="20" y1="200" x2="780" y2="200" stroke="#00d4ff" strokeWidth="0.3" />
                            <line x1="400" y1="20" x2="400" y2="380" stroke="#00d4ff" strokeWidth="0.3" />
                            {[100, 200, 300, 500, 600, 700].map(x => <line key={x} x1={x} y1="20" x2={x} y2="380" stroke="#00d4ff" strokeWidth="0.15" />)}
                            {[80, 140, 260, 320].map(y => <line key={y} x1="20" y1={y} x2="780" y2={y} stroke="#00d4ff" strokeWidth="0.15" />)}
                        </svg>
                        {geoDist?.slice(0, 15).map((g, i) => {
                            const x = ((g.geo_lon + 180) / 360) * 100;
                            const y = ((90 - g.geo_lat) / 180) * 100;
                            return (
                                <div key={i} className={`geo-dot ${g.avg_risk > 50 ? 'threat' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => handleChartClick('ip', g.geo_country)}>
                                    <div className="tooltip">{g.geo_city}, {g.geo_country} — {g.count} events</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid-3">
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Severity Distribution</div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={severityDist} dataKey="count" nameKey="severity" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} onClick={(e) => handleChartClick('severity', e.severity)} style={{ cursor: 'pointer' }}>
                                {severityDist.map((entry, i) => (
                                    <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || '#8892b0'} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#161b40', border: '1px solid rgba(136,146,176,0.15)', borderRadius: 8 }} />
                            <Legend formatter={(v) => <span style={{ color: '#8892b0', fontSize: 11, textTransform: 'capitalize' }}>{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Event Types</div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={eventTypeDist?.slice(0, 8)} layout="vertical" onClick={(e) => e && e.activeLabel && handleChartClick('type', e.activeLabel)} style={{ cursor: 'pointer' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.1)" />
                            <XAxis type="number" stroke="#5a6380" fontSize={11} />
                            <YAxis dataKey="event_type" type="category" stroke="#5a6380" fontSize={11} width={80} />
                            <Tooltip contentStyle={{ background: '#161b40', border: '1px solid rgba(136,146,176,0.15)', borderRadius: 8 }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {eventTypeDist?.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Protocols</div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={protocolDist?.slice(0, 6)} dataKey="count" nameKey="protocol" cx="50%" cy="50%" outerRadius={85} onClick={(e) => navigate(`/log-search?q=${e.protocol}`)} style={{ cursor: 'pointer' }}>
                                {protocolDist?.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#161b40', border: '1px solid rgba(136,146,176,0.15)', borderRadius: 8 }} />
                            <Legend formatter={(v) => <span style={{ color: '#8892b0', fontSize: 11 }}>{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2">
                {/* Top Attackers */}
                <div className="card">
                    <div className="card-header" style={{ marginBottom: 4 }}>
                        <div className="card-title"><AlertTriangle size={16} color="#ff1744" /> Top Attacking IPs</div>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead><tr><th>IP Address</th><th>Country</th><th>Events</th><th>Risk</th></tr></thead>
                            <tbody>
                                {topAttackers?.map((a, i) => (
                                    <tr key={i} onClick={() => handleChartClick('ip', a.source_ip)} style={{ cursor: 'pointer' }}>
                                        <td className="mono" style={{ color: '#ff1744' }}>{a.source_ip}</td>
                                        <td>{a.geo_country}</td>
                                        <td className="mono">{a.count}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div className="progress-bar" style={{ width: 60, height: 6 }}>
                                                    <div className="progress-fill" style={{ width: `${Math.min(a.avg_risk, 100)}%`, background: a.avg_risk > 60 ? '#ff1744' : a.avg_risk > 30 ? '#ffc400' : '#00e676' }}></div>
                                                </div>
                                                <span className="mono" style={{ fontSize: 11 }}>{Math.round(a.avg_risk)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Alerts */}
                <div className="card">
                    <div className="card-header" style={{ marginBottom: 4 }}>
                        <div className="card-title"><ShieldAlert size={16} color="#ff6d00" /> Recent Critical Alerts</div>
                    </div>
                    <div className="event-feed" style={{ maxHeight: 310 }}>
                        {recentAlerts?.map((a, i) => (
                            <div key={i} className="event-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/alerts')}>
                                <div className={`event-dot ${a.severity}`}></div>
                                <div className="event-content">
                                    <div className="event-desc" style={{ color: '#fff' }}>{a.title}</div>
                                    <div className="event-meta">
                                        <span className={`severity-badge ${a.severity}`}>{a.severity}</span>
                                        <span className={`status-badge ${a.status}`}>{a.status}</span>
                                        <span className="mono">{a.source_ip}</span>
                                    </div>
                                </div>
                                <span className="event-time" style={{ opacity: 0.6 }}>{timeAgo(a.created_at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Live Feed (bottom) */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <div className="card-title"><Zap size={16} color="#00e676" /> Live Event Stream</div>
                    <span className="card-subtitle">{liveEvents.length} events buffered</span>
                </div>
                <div className="event-feed" style={{ maxHeight: 250 }}>
                    {liveEvents.slice(0, 20).map((e, i) => (
                        <div key={e.id || i} className="event-item" onClick={() => navigate('/events')} style={{ cursor: 'pointer' }}>
                            <div className={`event-dot ${e.severity}`}></div>
                            <div className="event-content">
                                <div className="event-desc">{e.description}</div>
                                <div className="event-meta">
                                    <span className={`severity-badge ${e.severity}`}>{e.severity}</span>
                                    <span className="mono">{e.source_ip} → {e.dest_ip}</span>
                                    <span>{e.protocol}</span>
                                    <span>{e.event_type}</span>
                                </div>
                            </div>
                            <span className="event-time">{formatTime(e.timestamp)}</span>
                        </div>
                    ))}
                    {liveEvents.length === 0 && <div className="empty-state"><p>Waiting for events...</p></div>}
                </div>
            </div>
        </div>
    );
}
