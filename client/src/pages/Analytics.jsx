import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchApi, CHART_COLORS, SEVERITY_COLORS, MITRE_TACTICS } from '../utils/api';

export default function Analytics() {
    const [data, setData] = useState(null);
    const [eventStats, setEventStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(24);

    useEffect(() => {
        Promise.all([fetchApi(`/dashboard?hours=${timeRange}`), fetchApi(`/events/stats?hours=${timeRange}`)]).then(([d, s]) => { setData(d); setEventStats(s); setLoading(false); }).catch(() => setLoading(false));
    }, [timeRange]);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
    if (!data) return <div className="empty-state"><h3>Failed to load</h3></div>;

    const radarData = Object.entries(MITRE_TACTICS).map(([id, name]) => ({
        tactic: name.split(' ').slice(0, 2).join(' '),
        count: data.mitreDist?.filter(m => m.mitre_tactic === id).reduce((s, m) => s + m.count, 0) || 0,
    })).filter(d => d.count > 0);

    const hourlyMap = {};
    data.eventTimeline?.forEach(t => {
        if (!hourlyMap[t.hour]) hourlyMap[t.hour] = { hour: t.hour.split('T')[1]?.slice(0, 5) || t.hour, total: 0 };
        hourlyMap[t.hour].total += t.count;
        hourlyMap[t.hour][t.severity] = (hourlyMap[t.hour][t.severity] || 0) + t.count;
    });
    const hourlyData = Object.values(hourlyMap).slice(-24);
    const topIPs = data.topAttackers?.slice(0, 8).map(a => ({ ip: a.source_ip.split('.').slice(-2).join('.'), count: a.count }));

    const ttStyle = { background: '#161b40', border: '1px solid rgba(136,146,176,0.15)', borderRadius: 8 };

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><BarChart3 className="icon" size={28} /> Security Analytics</h1>
                    <p className="page-description">Behavioral analytics and trend analysis</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[6, 12, 24, 48, 168].map(h => <button key={h} className={`btn btn-sm ${timeRange === h ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTimeRange(h)}>{h < 24 ? `${h}h` : `${h / 24}d`}</button>)}
                </div>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <div className="kpi-card" style={{ '--kpi-color': '#00d4ff' }}><div className="kpi-label">Total Events</div><div className="kpi-value" style={{ color: '#00d4ff', fontSize: 28 }}>{eventStats?.total?.toLocaleString()}</div></div>
                <div className="kpi-card" style={{ '--kpi-color': '#ff006e' }}><div className="kpi-label">Event Types</div><div className="kpi-value" style={{ color: '#ff006e', fontSize: 28 }}>{eventStats?.byType?.length}</div></div>
                <div className="kpi-card" style={{ '--kpi-color': '#a855f7' }}><div className="kpi-label">Unique Sources</div><div className="kpi-value" style={{ color: '#a855f7', fontSize: 28 }}>{eventStats?.topSourceIPs?.length}</div></div>
                <div className="kpi-card" style={{ '--kpi-color': '#00e676' }}><div className="kpi-label">Avg EPS</div><div className="kpi-value" style={{ color: '#00e676', fontSize: 28 }}>{data.kpi?.eps}</div></div>
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-header"><div className="card-title"><TrendingUp size={16} /> Event Volume</div></div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={hourlyData}>
                            <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#00d4ff" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.1)" />
                            <XAxis dataKey="hour" stroke="#5a6380" fontSize={11} /><YAxis stroke="#5a6380" fontSize={11} />
                            <Tooltip contentStyle={ttStyle} /><Area type="monotone" dataKey="total" stroke="#00d4ff" fill="url(#gc)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="card">
                    <div className="card-header"><div className="card-title">MITRE ATT&CK Radar</div></div>
                    <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData}><PolarGrid stroke="rgba(136,146,176,0.15)" /><PolarAngleAxis dataKey="tactic" tick={{ fill: '#8892b0', fontSize: 10 }} /><PolarRadiusAxis tick={{ fill: '#5a6380', fontSize: 10 }} /><Radar dataKey="count" stroke="#00d4ff" fill="rgba(0,212,255,0.2)" strokeWidth={2} /><Tooltip contentStyle={ttStyle} /></RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-3">
                <div className="card"><div className="card-header"><div className="card-title">Severity</div></div>
                    <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.severityDist} dataKey="count" nameKey="severity" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>{data.severityDist?.map((e, i) => <Cell key={i} fill={SEVERITY_COLORS[e.severity] || '#8892b0'} />)}</Pie><Tooltip contentStyle={ttStyle} /><Legend formatter={v => <span style={{ color: '#8892b0', fontSize: 11, textTransform: 'capitalize' }}>{v}</span>} /></PieChart></ResponsiveContainer>
                </div>
                <div className="card"><div className="card-header"><div className="card-title">Top Sources</div></div>
                    <ResponsiveContainer width="100%" height={220}><BarChart data={topIPs}><CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.1)" /><XAxis dataKey="ip" stroke="#5a6380" fontSize={10} /><YAxis stroke="#5a6380" fontSize={11} /><Tooltip contentStyle={ttStyle} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{topIPs?.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>
                </div>
                <div className="card"><div className="card-header"><div className="card-title">Categories</div></div>
                    <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.eventTypeDist?.slice(0, 8)} dataKey="count" nameKey="event_type" cx="50%" cy="50%" outerRadius={80}>{data.eventTypeDist?.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={ttStyle} /><Legend formatter={v => <span style={{ color: '#8892b0', fontSize: 11 }}>{v}</span>} /></PieChart></ResponsiveContainer>
                </div>
            </div>

            <div className="card">
                <div className="card-header"><div className="card-title">Severity Over Time</div></div>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.1)" /><XAxis dataKey="hour" stroke="#5a6380" fontSize={11} /><YAxis stroke="#5a6380" fontSize={11} /><Tooltip contentStyle={ttStyle} /><Legend formatter={v => <span style={{ color: '#8892b0', fontSize: 11, textTransform: 'capitalize' }}>{v}</span>} />
                        <Area type="monotone" dataKey="critical" stackId="1" stroke="#ff1744" fill="rgba(255,23,68,0.4)" />
                        <Area type="monotone" dataKey="high" stackId="1" stroke="#ff6d00" fill="rgba(255,109,0,0.3)" />
                        <Area type="monotone" dataKey="medium" stackId="1" stroke="#ffc400" fill="rgba(255,196,0,0.2)" />
                        <Area type="monotone" dataKey="low" stackId="1" stroke="#00e5ff" fill="rgba(0,229,255,0.15)" />
                        <Area type="monotone" dataKey="info" stackId="1" stroke="#8892b0" fill="rgba(136,146,176,0.1)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
