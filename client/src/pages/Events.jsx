import { useState, useEffect } from 'react';
import { Activity, Pause, Play, Filter, Zap, Download, ArrowUpDown } from 'lucide-react';
import { fetchApi, formatTime, SEVERITY_COLORS } from '../utils/api';

export default function Events({ liveEvents = [] }) {
    const [events, setEvents] = useState([]);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState({ severity: '', type: '', search: '' });
    const [historicalEvents, setHistoricalEvents] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [mode, setMode] = useState('live');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [sortCol, setSortCol] = useState('timestamp');
    const [sortDir, setSortDir] = useState('desc');

    // Debounced search for historical mode
    useEffect(() => {
        if (mode !== 'historical') return;
        const timeout = setTimeout(() => {
            const params = new URLSearchParams({ page, limit: 50 });
            if (filter.severity) params.set('severity', filter.severity);
            if (filter.type) params.set('event_type', filter.type);
            if (filter.search) params.set('search', filter.search);
            fetchApi(`/events?${params}`).then(d => { setHistoricalEvents(d.events); setTotal(d.total); });
        }, 300);
        return () => clearTimeout(timeout);
    }, [mode, page, filter]);

    useEffect(() => {
        if (!paused && mode === 'live') setEvents(liveEvents);
    }, [liveEvents, paused, mode]);

    const filteredLiveEvents = mode === 'live' ? events.filter(e => {
        if (filter.severity && e.severity !== filter.severity) return false;
        if (filter.type && e.event_type !== filter.type) return false;
        if (filter.search && !JSON.stringify(e).toLowerCase().includes(filter.search.toLowerCase())) return false;
        return true;
    }) : historicalEvents;

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    const sortedEvents = [...filteredLiveEvents].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'risk_score') { va = Number(va); vb = Number(vb); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const exportCSV = () => {
        const headers = ['timestamp', 'severity', 'event_type', 'description', 'source_ip', 'dest_ip', 'protocol', 'hostname', 'username', 'action', 'outcome', 'risk_score'];
        const rows = sortedEvents.map(e => headers.map(h => `"${(e[h] || '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `siem-events-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Activity className="icon" size={28} /> Event Stream</h1>
                    <p className="page-description">{mode === 'live' ? `${sortedEvents.length} live events buffered` : `${total.toLocaleString()} historical events`}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn ${mode === 'live' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('live')}>
                        <Zap size={14} /> Live
                    </button>
                    <button className={`btn ${mode === 'historical' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setMode('historical'); setPage(1); }}>
                        <Filter size={14} /> Historical
                    </button>
                    {mode === 'live' && (
                        <button className="btn btn-outline" onClick={() => setPaused(!paused)}>
                            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
                        </button>
                    )}
                    <button className="btn btn-outline" onClick={exportCSV} title="Export as CSV">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <select value={filter.severity} onChange={e => { setFilter({ ...filter, severity: e.target.value }); setPage(1); }}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                </select>
                <select value={filter.type} onChange={e => { setFilter({ ...filter, type: e.target.value }); setPage(1); }}>
                    <option value="">All Types</option>
                    <option value="authentication">Authentication</option>
                    <option value="firewall">Firewall</option>
                    <option value="ids">IDS/IPS</option>
                    <option value="malware">Malware</option>
                    <option value="endpoint">Endpoint</option>
                    <option value="network">Network</option>
                    <option value="dlp">DLP</option>
                    <option value="email">Email</option>
                    <option value="cloud">Cloud</option>
                    <option value="system">System</option>
                    <option value="web">Web</option>
                </select>
                <input placeholder="Search events..." value={filter.search} onChange={e => { setFilter({ ...filter, search: e.target.value }); setPage(1); }} style={{ flex: 1, maxWidth: 300 }} />
                {(filter.severity || filter.type || filter.search) && (
                    <button className="btn btn-sm btn-outline" onClick={() => setFilter({ severity: '', type: '', search: '' })}>Clear Filters</button>
                )}
            </div>

            <div className="card">
                <div className="data-table-wrapper" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {[
                                    { key: 'timestamp', label: 'Time' },
                                    { key: 'severity', label: 'Severity' },
                                    { key: 'event_type', label: 'Type' },
                                    { key: 'description', label: 'Description' },
                                    { key: 'source_ip', label: 'Source IP' },
                                    { key: 'dest_ip', label: 'Dest IP' },
                                    { key: 'protocol', label: 'Protocol' },
                                    { key: 'hostname', label: 'Host' },
                                    { key: 'username', label: 'User' },
                                    { key: 'outcome', label: 'Action' },
                                    { key: 'risk_score', label: 'Risk' },
                                ].map(col => (
                                    <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        {col.label} {sortCol === col.key && <ArrowUpDown size={10} style={{ verticalAlign: 'middle', opacity: 0.6 }} />}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEvents.map((e, i) => (
                                <tr key={e.id || i} onClick={() => setSelectedEvent(selectedEvent?.id === e.id ? null : e)} style={{ cursor: 'pointer', background: selectedEvent?.id === e.id ? 'rgba(0,212,255,0.06)' : undefined }}>
                                    <td className="mono">{formatTime(e.timestamp)}</td>
                                    <td><span className={`severity-badge ${e.severity}`}>{e.severity}</span></td>
                                    <td>{e.event_type}</td>
                                    <td style={{ maxWidth: 250 }}>{e.description}</td>
                                    <td className="mono">{e.source_ip}</td>
                                    <td className="mono">{e.dest_ip}</td>
                                    <td>{e.protocol}</td>
                                    <td style={{ fontSize: 11 }}>{e.hostname}</td>
                                    <td>{e.username || '-'}</td>
                                    <td><span className={`status-badge ${e.outcome}`}>{e.outcome}</span></td>
                                    <td>
                                        <span className="mono" style={{ color: e.risk_score > 60 ? '#ff1744' : e.risk_score > 30 ? '#ffc400' : '#00e676' }}>
                                            {e.risk_score}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Selected Event Detail */}
                {selectedEvent && (
                    <div style={{ margin: '16px 0', padding: 16, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, color: '#5a6380', textTransform: 'uppercase', letterSpacing: 1 }}>Event Detail</span>
                            <button className="btn btn-sm btn-outline" onClick={() => setSelectedEvent(null)}>✕</button>
                        </div>
                        <div className="raw-log">{selectedEvent.raw_log}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12, fontSize: 12 }}>
                            <div><span style={{ color: '#5a6380' }}>Protocol:</span> {selectedEvent.protocol}</div>
                            <div><span style={{ color: '#5a6380' }}>Action:</span> {selectedEvent.action}</div>
                            <div><span style={{ color: '#5a6380' }}>Outcome:</span> <span className={`status-badge ${selectedEvent.outcome}`}>{selectedEvent.outcome}</span></div>
                            <div><span style={{ color: '#5a6380' }}>Risk:</span> <span className="mono" style={{ color: selectedEvent.risk_score > 60 ? '#ff1744' : '#ffc400' }}>{selectedEvent.risk_score}</span></div>
                            <div><span style={{ color: '#5a6380' }}>MITRE Tactic:</span> {selectedEvent.mitre_tactic}</div>
                            <div><span style={{ color: '#5a6380' }}>Technique:</span> {selectedEvent.mitre_technique}</div>
                            <div><span style={{ color: '#5a6380' }}>Geo:</span> {selectedEvent.geo_city}, {selectedEvent.geo_country}</div>
                            <div><span style={{ color: '#5a6380' }}>Ports:</span> {selectedEvent.source_port} → {selectedEvent.dest_port}</div>
                        </div>
                    </div>
                )}

                {mode === 'historical' && (
                    <div className="pagination">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                        {Array.from({ length: Math.min(5, Math.ceil(total / 50)) }, (_, i) => {
                            const p = Math.max(1, page - 2) + i;
                            if (p > Math.ceil(total / 50)) return null;
                            return <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>;
                        })}
                        <span className="page-info">of {Math.ceil(total / 50)}</span>
                        <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
