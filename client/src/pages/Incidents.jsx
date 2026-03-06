import { useState, useEffect } from 'react';
import { Bug, AlertTriangle, Clock, User, ChevronRight, Plus, Shield, ShieldAlert, CheckCircle, Crosshair } from 'lucide-react';
import { fetchApi, timeAgo, MITRE_TACTICS } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function Incidents() {
    const [incidents, setIncidents] = useState([]);
    const [filter, setFilter] = useState({ status: '', severity: '' });
    const [selected, setSelected] = useState(null);
    const navigate = useNavigate();

    const load = () => {
        const params = new URLSearchParams();
        if (filter.status) params.set('status', filter.status);
        if (filter.severity) params.set('severity', filter.severity);
        fetchApi(`/incidents?${params}`).then(d => setIncidents(d.incidents));
    };

    useEffect(() => { load(); }, [filter]);

    const updateIncident = async (id, updates) => {
        await fetchApi(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
        load();
        if (selected?.id === id) {
            setSelected(prev => ({ ...prev, ...updates }));
        }
    };

    const statusFlow = ['new', 'investigating', 'containment', 'eradication', 'recovery', 'closed'];

    return (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Bug className="icon" size={28} /> Incident Response</h1>
                    <p className="page-description">Manage active security incidents and track response lifecycle ({incidents.length} tracked)</p>
                </div>
            </div>

            <div className="filter-bar" style={{ flexShrink: 0 }}>
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                    <option value="">All Status Lifecycle</option>
                    {statusFlow.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value })}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
                <div style={{ display: 'grid', gap: 16 }}>
                    {incidents.map(inc => (
                        <div key={inc.id} className="card" style={{
                            cursor: 'pointer',
                            borderLeft: `3px solid ${inc.severity === 'critical' ? '#ff1744' : inc.severity === 'high' ? '#ff6d00' : '#ffc400'}`,
                            background: selected?.id === inc.id ? 'var(--bg-card)' : 'var(--bg-surface)',
                            transition: 'all 0.2s',
                            boxShadow: selected?.id === inc.id ? '0 0 20px rgba(0,0,0,0.3)' : 'none'
                        }} onClick={() => setSelected(selected?.id === inc.id ? null : inc)}>

                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <span className={`severity-badge ${inc.severity}`}>{inc.severity}</span>
                                        <span className={`status-badge ${inc.status}`} style={{
                                            border: `1px solid ${inc.status === 'closed' ? '#00e676' : inc.status === 'new' ? '#ff1744' : '#00d4ff'}`,
                                            background: 'transparent'
                                        }}>{inc.status.toUpperCase()}</span>
                                        {inc.category && <span style={{ fontSize: 11, color: '#5a6380', background: 'rgba(136,146,176,0.1)', padding: '2px 8px', borderRadius: 8 }}>{inc.category}</span>}
                                        <span className="mono" style={{ fontSize: 11, color: '#5a6380' }}>ID: {inc.id.split('-')[0]}</span>
                                    </div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{inc.title}</h3>
                                    <p style={{ fontSize: 13, color: '#8892b0', marginBottom: 12, maxWidth: '80%' }}>{inc.description}</p>

                                    <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#5a6380' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <User size={14} style={{ color: '#00d4ff' }} />
                                            <span style={{ color: inc.assigned_to ? '#fff' : '#5a6380' }}>{inc.assigned_to || 'Unassigned'}</span>
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={14} style={{ color: '#00d4ff' }} />
                                            {timeAgo(inc.created_at)}
                                        </span>
                                        {inc.affected_assets && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Shield size={14} style={{ color: '#ff6d00' }} />
                                                {JSON.parse(inc.affected_assets || '[]').length} Assets Affected
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: selected?.id === inc.id ? 'rgba(0,212,255,0.1)' : 'transparent' }}>
                                    <ChevronRight size={20} style={{ color: selected?.id === inc.id ? '#00d4ff' : '#5a6380', transform: selected?.id === inc.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {selected?.id === inc.id && (
                                <div className="animate-fade-up" style={{ marginTop: 24, padding: 24, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid rgba(136,146,176,0.1)' }} onClick={e => e.stopPropagation()}>

                                    <h4 style={{ fontSize: 11, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Response Progress</h4>

                                    {/* Cyber Progress Tracker */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, position: 'relative' }}>
                                        <div style={{ position: 'absolute', top: 14, left: 20, right: 20, height: 2, background: 'var(--border)', zIndex: 0 }}></div>
                                        {statusFlow.map((s, i) => {
                                            const isPast = statusFlow.indexOf(inc.status) >= i;
                                            const isCurrent = inc.status === s;
                                            return (
                                                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1, position: 'relative' }} onClick={() => updateIncident(inc.id, { status: s })}>
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                        background: isCurrent ? 'var(--cyan)' : isPast ? '#00e676' : 'var(--bg-surface)',
                                                        border: `2px solid ${isCurrent ? 'var(--cyan)' : isPast ? '#00e676' : 'var(--border)'}`,
                                                        color: isCurrent || isPast ? '#000' : '#8892b0',
                                                        boxShadow: isCurrent ? '0 0 15px rgba(0,212,255,0.5)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }}>
                                                        {isPast && !isCurrent ? <CheckCircle size={16} /> : i + 1}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: isCurrent ? '#00d4ff' : isPast ? '#fff' : '#5a6380', fontWeight: isCurrent ? 700 : 400, textTransform: 'uppercase' }}>{s}</div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                        {/* Action assignment */}
                                        <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <h4 style={{ fontSize: 11, color: '#8892b0', textTransform: 'uppercase', marginBottom: 12 }}>Personnel</h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <select className="search-input" style={{ flex: 1 }} onChange={e => { if (e.target.value) updateIncident(inc.id, { assigned_to: e.target.value }); }} value={inc.assigned_to || ''}>
                                                    <option value="">Assign Commander...</option>
                                                    <option value="analyst01">Analyst 01</option>
                                                    <option value="analyst02">Analyst 02</option>
                                                    <option value="operator01">Operator 01</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="Current User">Take Ownership</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Affected Assets */}
                                        {inc.affected_assets && (
                                            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                                                <h4 style={{ fontSize: 11, color: '#8892b0', textTransform: 'uppercase', marginBottom: 12 }}>Affected IPs</h4>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {JSON.parse(inc.affected_assets).map(ip => (
                                                        <span key={ip} className="mono hover-link" style={{ background: 'rgba(255,23,68,0.1)', color: '#ff1744', padding: '4px 8px', borderRadius: 4, fontSize: 12, border: '1px solid rgba(255,23,68,0.2)' }} onClick={() => navigate(`/log-search?q=${ip}`)}>
                                                            {ip}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>
                    ))}
                    {incidents.length === 0 && <div className="empty-state"><h3>No incidents found</h3><p>Try adjusting your filters</p></div>}
                </div>
            </div>
        </div>
    );
}
