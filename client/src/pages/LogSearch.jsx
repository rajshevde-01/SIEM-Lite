import { useState, useEffect } from 'react';
import { Search, Filter, Download, Clock, Copy, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi, formatTime, timeAgo } from '../utils/api';

export default function LogSearch() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ severity: '', event_type: '', start_date: '', end_date: '' });
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [searchHistory, setSearchHistory] = useState([]);
    const [copied, setCopied] = useState(false);

    const search = async (p = 1, q = query) => {
        setLoading(true);
        const params = new URLSearchParams({ page: p, limit: 50 });
        if (q) params.set('search', q);
        if (filters.severity) params.set('severity', filters.severity);
        if (filters.event_type) params.set('event_type', filters.event_type);
        if (filters.start_date) params.set('start_date', new Date(filters.start_date).toISOString());
        if (filters.end_date) params.set('end_date', new Date(filters.end_date).toISOString());
        try {
            const d = await fetchApi(`/events?${params}`);
            setResults(d.events);
            setTotal(d.total);
            setPage(p);
            if (q && !searchHistory.includes(q)) setSearchHistory(prev => [q, ...prev].slice(0, 10));
        } catch (e) { }
        setLoading(false);
    };

    // Auto-search when arriving from header search
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) { setQuery(q); search(1, q); }
        else { search(); }
    }, [searchParams.get('q')]);

    const copyRawLog = (log) => {
        navigator.clipboard.writeText(log);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const exportResults = () => {
        const headers = ['timestamp', 'severity', 'event_type', 'description', 'source_ip', 'dest_ip', 'protocol', 'hostname', 'username', 'risk_score'];
        const rows = results.map(e => headers.map(h => `"${(e[h] || '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `siem-search-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Search className="icon" size={28} /> Log Search & Analysis</h1>
                    <p className="page-description">Search across {total.toLocaleString()} indexed events</p>
                </div>
                <button className="btn btn-outline" onClick={exportResults}>
                    <Download size={14} /> Export Results
                </button>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && search(1)}
                            placeholder="Search by description, IP, hostname, username, raw log content..."
                            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", outline: 'none' }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={() => search(1)} style={{ padding: '12px 24px' }}>
                        <Search size={16} /> Search
                    </button>
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: '22px' }}>Recent:</span>
                        {searchHistory.map((h, i) => (
                            <button key={i} className="btn btn-sm btn-outline" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => { setQuery(h); search(1, h); }}>{h}</button>
                        ))}
                    </div>
                )}

                <div className="filter-bar" style={{ marginBottom: 0 }}>
                    <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <select value={filters.severity} onChange={e => setFilters({ ...filters, severity: e.target.value })}>
                        <option value="">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="info">Info</option>
                    </select>
                    <select value={filters.event_type} onChange={e => setFilters({ ...filters, event_type: e.target.value })}>
                        <option value="">All Types</option>
                        {['authentication', 'firewall', 'ids', 'malware', 'endpoint', 'network', 'dlp', 'email', 'cloud', 'system', 'web'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                    <input type="datetime-local" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })} style={{ colorScheme: 'dark' }} title="Start date" />
                    <input type="datetime-local" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })} style={{ colorScheme: 'dark' }} title="End date" />
                    <button className="btn btn-sm btn-outline" onClick={() => search(1)}>Apply</button>
                    <button className="btn btn-sm btn-outline" onClick={() => { setFilters({ severity: '', event_type: '', start_date: '', end_date: '' }); setQuery(''); search(1, ''); }}>Clear</button>
                </div>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Results</div>
                        <span className="card-subtitle">{total.toLocaleString()} matches · Page {page}</span>
                    </div>
                    <div className="data-table-wrapper" style={{ maxHeight: 'calc(100vh - 440px)', overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Time</th><th>Severity</th><th>Type</th><th>Description</th><th>Source</th><th>Dest</th><th>Host</th><th>User</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(e => (
                                    <tr key={e.id} style={{ cursor: 'pointer', background: selectedLog?.id === e.id ? 'rgba(0,212,255,0.06)' : undefined }} onClick={() => setSelectedLog(selectedLog?.id === e.id ? null : e)}>
                                        <td className="mono">{formatTime(e.timestamp)}</td>
                                        <td><span className={`severity-badge ${e.severity}`}>{e.severity}</span></td>
                                        <td>{e.event_type}</td>
                                        <td style={{ maxWidth: 250, color: '#fff' }}>{e.description}</td>
                                        <td className="mono">{e.source_ip}</td>
                                        <td className="mono">{e.dest_ip}</td>
                                        <td style={{ fontSize: 11 }}>{e.hostname}</td>
                                        <td>{e.username || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {selectedLog && (
                        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>Raw Log</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-sm btn-outline" onClick={() => copyRawLog(selectedLog.raw_log)}>
                                        <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button className="btn btn-sm btn-outline" onClick={() => setSelectedLog(null)}>✕</button>
                                </div>
                            </div>
                            <div className="raw-log">{selectedLog.raw_log}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 16, fontSize: 12 }}>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Protocol:</span> {selectedLog.protocol}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Action:</span> {selectedLog.action}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Outcome:</span> <span className={`status-badge ${selectedLog.outcome}`}>{selectedLog.outcome}</span></div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Risk Score:</span> <span className="mono" style={{ color: selectedLog.risk_score > 60 ? '#ff1744' : '#ffc400' }}>{selectedLog.risk_score}</span></div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>MITRE Tactic:</span> {selectedLog.mitre_tactic}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Technique:</span> {selectedLog.mitre_technique}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Geo:</span> {selectedLog.geo_city}, {selectedLog.geo_country}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Ports:</span> {selectedLog.source_port} → {selectedLog.dest_port}</div>
                            </div>
                        </div>
                    )}

                    <div className="pagination">
                        <button disabled={page <= 1} onClick={() => search(page - 1)}>← Prev</button>
                        {Array.from({ length: Math.min(7, Math.ceil(total / 50)) }, (_, i) => {
                            const p = Math.max(1, Math.min(page - 3, Math.ceil(total / 50) - 6)) + i;
                            if (p > Math.ceil(total / 50)) return null;
                            return <button key={p} className={p === page ? 'active' : ''} onClick={() => search(p)}>{p}</button>;
                        })}
                        <span className="page-info">of {Math.ceil(total / 50)}</span>
                        <button disabled={page >= Math.ceil(total / 50)} onClick={() => search(page + 1)}>Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}
