import { useState, useEffect } from 'react';
import { Crosshair, Search, Shield, AlertTriangle, Globe, Hash, Mail, Link } from 'lucide-react';
import { fetchApi, timeAgo } from '../utils/api';

const IOC_ICONS = { ip: Globe, domain: Link, hash: Hash, email: Mail, url: Link };

export default function ThreatIntel() {
    const [iocs, setIocs] = useState([]);
    const [filter, setFilter] = useState({ type: '', search: '' });
    const [selected, setSelected] = useState(null);
    const [lookupResult, setLookupResult] = useState(null);
    const [lookupValue, setLookupValue] = useState('');

    useEffect(() => {
        const params = new URLSearchParams();
        if (filter.type) params.set('type', filter.type);
        if (filter.search) params.set('search', filter.search);
        fetchApi(`/threat-intel?${params}`).then(d => setIocs(d.iocs));
    }, [filter]);

    const lookup = async () => {
        if (!lookupValue.trim()) return;
        const res = await fetchApi(`/threat-intel/lookup/${encodeURIComponent(lookupValue)}`);
        setLookupResult(res);
    };

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Crosshair className="icon" size={28} /> Threat Intelligence</h1>
                    <p className="page-description">{iocs.length} indicators of compromise tracked</p>
                </div>
            </div>

            {/* IOC Lookup */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title"><Search size={16} /> IOC Lookup</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        value={lookupValue}
                        onChange={e => setLookupValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookup()}
                        placeholder="Enter IP address, domain, hash, or email..."
                        style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none' }}
                    />
                    <button className="btn btn-primary" onClick={lookup}>Lookup</button>
                </div>
                {lookupResult && (
                    <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {lookupResult.found ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <AlertTriangle size={16} color="#ff1744" />
                                    <span style={{ color: '#ff1744', fontWeight: 700 }}> Threat Found!</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                                    <div><span style={{ color: '#5a6380' }}>Type:</span> {lookupResult.ioc?.ioc_type}</div>
                                    <div><span style={{ color: '#5a6380' }}>Threat:</span> <span style={{ color: '#ff6d00' }}>{lookupResult.ioc?.threat_type}</span></div>
                                    <div><span style={{ color: '#5a6380' }}>Confidence:</span> <span style={{ color: lookupResult.ioc?.confidence > 80 ? '#ff1744' : '#ffc400' }}>{lookupResult.ioc?.confidence}%</span></div>
                                    <div><span style={{ color: '#5a6380' }}>Source:</span> {lookupResult.ioc?.source}</div>
                                </div>
                                <p style={{ color: '#8892b0', fontSize: 13, marginTop: 8 }}>{lookupResult.ioc?.description}</p>
                                {lookupResult.relatedEvents?.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 12, color: '#5a6380', marginBottom: 8 }}>{lookupResult.relatedEvents.length} related events found</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Shield size={16} color="#00e676" />
                                <span style={{ color: '#00e676' }}>No threats found for this indicator</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="filter-bar">
                <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="ip">IP Address</option>
                    <option value="domain">Domain</option>
                    <option value="hash">File Hash</option>
                    <option value="url">URL</option>
                    <option value="email">Email</option>
                </select>
                <input placeholder="Search IOCs..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} style={{ maxWidth: 300 }} />
            </div>

            <div className="card">
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Indicator</th>
                                <th>Threat</th>
                                <th>Confidence</th>
                                <th>Source</th>
                                <th>Description</th>
                                <th>First Seen</th>
                                <th>Last Seen</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {iocs.map(ioc => {
                                const Icon = IOC_ICONS[ioc.ioc_type] || Globe;
                                return (
                                    <tr key={ioc.id} style={{ cursor: 'pointer' }} onClick={() => { setLookupValue(ioc.ioc_value); lookup(); }}>
                                        <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={14} color="#00d4ff" /> {ioc.ioc_type}</span></td>
                                        <td className="mono" style={{ color: '#ff6d00' }}>{ioc.ioc_value}</td>
                                        <td><span className="severity-badge high">{ioc.threat_type}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div className="progress-bar" style={{ width: 60, height: 6 }}>
                                                    <div className="progress-fill" style={{ width: `${ioc.confidence}%`, background: ioc.confidence > 80 ? '#ff1744' : ioc.confidence > 50 ? '#ffc400' : '#00e5ff' }}></div>
                                                </div>
                                                <span className="mono" style={{ fontSize: 11 }}>{ioc.confidence}%</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 12 }}>{ioc.source}</td>
                                        <td style={{ maxWidth: 200, fontSize: 12 }}>{ioc.description}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>{timeAgo(ioc.first_seen)}</td>
                                        <td className="mono" style={{ fontSize: 11 }}>{timeAgo(ioc.last_seen)}</td>
                                        <td><span className={`status-badge ${ioc.active ? 'open' : 'resolved'}`}>{ioc.active ? 'Active' : 'Inactive'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
