import { useState, useEffect } from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchApi, MITRE_TACTICS, MITRE_TECHNIQUES } from '../utils/api';

export default function MitreAttack() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchApi('/dashboard?hours=168').then(d => {
            setData(d.mitreDist || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

    // Group by tactic
    const tacticGroups = {};
    data.forEach(d => {
        if (!tacticGroups[d.mitre_tactic]) tacticGroups[d.mitre_tactic] = {};
        tacticGroups[d.mitre_tactic][d.mitre_technique] = (tacticGroups[d.mitre_tactic][d.mitre_technique] || 0) + d.count;
    });

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const getHeat = (count) => {
        const ratio = count / maxCount;
        if (ratio > 0.7) return 4;
        if (ratio > 0.4) return 3;
        if (ratio > 0.2) return 2;
        if (ratio > 0) return 1;
        return 0;
    };

    const handleCellClick = (techId) => {
        navigate(`/log-search?q=${encodeURIComponent(techId)}`);
    };

    const orderedTactics = Object.keys(MITRE_TACTICS);

    return (
        <div className="animate-fade-up">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Globe className="icon" size={28} /> MITRE ATT&CK Matrix</h1>
                    <p className="page-description">Mapping detected techniques to the MITRE ATT&CK framework — Last 7 days</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: '#5a6380', marginRight: 8 }}>Heat Map Legend:</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ width: 16, height: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 3 }}></div>
                    <span style={{ fontSize: 10, color: '#5a6380', marginRight: 12 }}>None</span>
                    <div style={{ width: 16, height: 16, background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 3 }}></div>
                    <span style={{ fontSize: 10, color: '#5a6380', marginRight: 12 }}>Low</span>
                    <div style={{ width: 16, height: 16, background: 'rgba(255, 196, 0, 0.1)', border: '1px solid rgba(255, 196, 0, 0.2)', borderRadius: 3 }}></div>
                    <span style={{ fontSize: 10, color: '#5a6380', marginRight: 12 }}>Medium</span>
                    <div style={{ width: 16, height: 16, background: 'rgba(255, 109, 0, 0.15)', border: '1px solid rgba(255, 109, 0, 0.3)', borderRadius: 3 }}></div>
                    <span style={{ fontSize: 10, color: '#5a6380', marginRight: 12 }}>High</span>
                    <div style={{ width: 16, height: 16, background: 'rgba(255, 23, 68, 0.15)', border: '1px solid rgba(255, 23, 68, 0.3)', borderRadius: 3 }}></div>
                    <span style={{ fontSize: 10, color: '#5a6380' }}>Critical</span>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${orderedTactics.length}, minmax(140px, 1fr))`, gap: 8 }}>
                    {/* Tactic Headers */}
                    {orderedTactics.map(tid => (
                        <div key={tid} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{tid}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={MITRE_TACTICS[tid]}>{MITRE_TACTICS[tid]}</div>
                            <div style={{ fontSize: 10, color: '#5a6380', marginTop: 4 }}>
                                {Object.values(tacticGroups[tid] || {}).reduce((a, b) => a + b, 0)} events
                            </div>
                        </div>
                    ))}

                    {/* Technique Cells */}
                    {orderedTactics.map(tid => (
                        <div key={`${tid}-techs`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {Object.entries(MITRE_TECHNIQUES)
                                .filter(([techId]) => tacticGroups[tid]?.[techId] !== undefined)
                                .map(([techId, techName]) => {
                                    const count = tacticGroups[tid]?.[techId] || 0;
                                    const heat = getHeat(count);
                                    return (
                                        <div key={techId} className={`mitre-cell heat-${heat}`} onClick={() => handleCellClick(techId)} style={{ cursor: 'pointer' }} title={`Click to search logs for ${techId}`}>
                                            <div style={{ position: 'absolute', top: 4, right: 4, opacity: 0.3 }}><ExternalLink size={10} /></div>
                                            <div className="tech-id">{techId}</div>
                                            <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{techName}</div>
                                            <div className="tech-count">{count}</div>
                                        </div>
                                    );
                                })}
                            {!tacticGroups[tid] && (
                                <div className="mitre-cell heat-0">
                                    <div style={{ fontSize: 11, color: '#5a6380' }}>No activity</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid-3" style={{ marginTop: 24 }}>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>Top Techniques</div>
                    {data.sort((a, b) => b.count - a.count).slice(0, 8).map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(136,146,176,0.06)' }}>
                            <div style={{ cursor: 'pointer' }} onClick={() => handleCellClick(d.mitre_technique)}>
                                <span className="mono" style={{ fontSize: 11, color: '#00d4ff', marginRight: 8, textDecoration: 'underline', textUnderlineOffset: 2 }}>{d.mitre_technique}</span>
                                <span style={{ fontSize: 12 }}>{MITRE_TECHNIQUES[d.mitre_technique] || d.mitre_technique}</span>
                            </div>
                            <span className="mono" style={{ fontSize: 12, color: '#fff' }}>{d.count}</span>
                        </div>
                    ))}
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>Top Tactics</div>
                    {Object.entries(tacticGroups).sort((a, b) => {
                        return Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0);
                    }).slice(0, 8).map(([tid, techs], i) => {
                        const total = Object.values(techs).reduce((a, b) => a + b, 0);
                        const maxTotal = Math.max(...Object.entries(tacticGroups).map(([, t]) => Object.values(t).reduce((a, b) => a + b, 0)));
                        return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(136,146,176,0.06)' }}>
                                <span style={{ fontSize: 12 }}>{MITRE_TACTICS[tid] || tid}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="progress-bar" style={{ width: 80, height: 6 }}>
                                        <div className="progress-fill" style={{ width: `${(total / maxTotal) * 100}%`, background: 'linear-gradient(90deg, #00d4ff, #ff006e)' }}></div>
                                    </div>
                                    <span className="mono" style={{ fontSize: 12, minWidth: 24, textAlign: 'right' }}>{total}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>Coverage</div>
                    <div style={{ textAlign: 'center', padding: 20 }}>
                        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#00d4ff' }}>
                            {Object.keys(tacticGroups).length}/{Object.keys(MITRE_TACTICS).length}
                        </div>
                        <div style={{ fontSize: 13, color: '#8892b0', marginTop: 8 }}>Tactics Observed</div>
                        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#ff006e', marginTop: 16 }}>
                            {new Set(data.map(d => d.mitre_technique)).size}
                        </div>
                        <div style={{ fontSize: 13, color: '#8892b0', marginTop: 8 }}>Unique Techniques</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
