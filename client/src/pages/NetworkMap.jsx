import { useState, useEffect, useRef, useMemo } from 'react';
import { Server, Shield, Database, Globe, Wifi, Monitor, HardDrive, Lock } from 'lucide-react';
import { fetchApi } from '../utils/api';

const ASSET_ICONS = {
    'Domain Controller': Shield, 'Web Server': Globe, 'Database': Database, 'Firewall': Lock,
    'VPN Gateway': Wifi, 'IDS/IPS': Monitor, 'File Server': HardDrive, 'Proxy': Globe,
    'Mail Server': Server, 'Backup': HardDrive, 'Application': Server,
};

const ASSET_GROUPS = {
    'Security': ['Firewall', 'IDS/IPS', 'VPN Gateway'],
    'Servers': ['Domain Controller', 'Web Server', 'Mail Server', 'File Server', 'Application', 'Backup'],
    'Data': ['Database', 'Proxy'],
};

// Force-directed graph component
function ForceGraph({ assets, selectedId, onSelect }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

    // Graph state
    const nodesRef = useRef([]);
    const edgesRef = useRef([]);
    const dragNodeRef = useRef(null);
    const simTimerRef = useRef(null);
    const renderTimerRef = useRef(null);

    // Initialize nodes and edges
    useEffect(() => {
        if (!assets.length || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const w = rect.width, h = Math.max(500, window.innerHeight - 350);
        setDimensions({ w, h });

        // Create central router
        const router = { id: 'core_router', type: 'router', x: w / 2, y: h / 2, vx: 0, vy: 0, radius: 40 };

        // Create nodes
        const newNodes = [router, ...assets.map(a => ({
            ...a, x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, radius: 25
        }))];

        // Create edges (all connected to central router for this simple demo)
        const newEdges = assets.map(a => ({ source: 'core_router', target: a.id }));

        nodesRef.current = newNodes;
        edgesRef.current = newEdges;

        // Physics simulation loop
        const simulate = () => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;
            const center = { x: w / 2, y: h / 2 };

            // Apply forces
            nodes.forEach(n1 => {
                // Gravity towards center
                n1.vx += (center.x - n1.x) * 0.0005;
                n1.vy += (center.y - n1.y) * 0.0005;

                // Repulsion
                nodes.forEach(n2 => {
                    if (n1 === n2) return;
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (dist < 150) {
                        const force = (150 - dist) / 1000;
                        n1.vx -= (dx / dist) * force;
                        n1.vy -= (dy / dist) * force;
                    }
                });
            });

            // Attraction along edges
            edges.forEach(e => {
                const s = nodes.find(n => n.id === e.source);
                const t = nodes.find(n => n.id === e.target);
                if (!s || !t) return;
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (dist - 150) * 0.001; // Ideal edge length 150
                s.vx += (dx / dist) * force;
                s.vy += (dy / dist) * force;
                t.vx -= (dx / dist) * force;
                t.vy -= (dy / dist) * force;
            });

            // Update positions
            nodes.forEach(n => {
                if (dragNodeRef.current?.id === n.id) return; // Don't move dragged node
                // Pin core router to center loosely
                if (n.id === 'core_router') { n.x += (center.x - n.x) * 0.05; n.y += (center.y - n.y) * 0.05; return; }

                n.x += n.vx;
                n.y += n.vy;
                n.vx *= 0.5; // Friction
                n.vy *= 0.5;

                // Bounds
                if (n.x < 30) n.x = 30; if (n.x > w - 30) n.x = w - 30;
                if (n.y < 30) n.y = 30; if (n.y > h - 30) n.y = h - 30;
            });
        };

        const render = () => {
            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, w, h);

            // Draw edges
            ctx.lineWidth = 1;
            edgesRef.current.forEach(e => {
                const s = nodesRef.current.find(n => n.id === e.source);
                const t = nodesRef.current.find(n => n.id === e.target);
                if (s && t) {
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(t.x, t.y);
                    // Color edge based on target risk
                    if (t.risk_score > 60) ctx.strokeStyle = 'rgba(255, 23, 68, 0.4)';
                    else if (t.risk_score > 30) ctx.strokeStyle = 'rgba(255, 196, 0, 0.3)';
                    else ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
                    ctx.stroke();
                }
            });
        };

        // Loops
        clearInterval(simTimerRef.current);
        simTimerRef.current = setInterval(() => {
            simulate();
            render();
            // Force React update for DOM nodes overlay
            setDimensions(prev => ({ ...prev }));
        }, 1000 / 60);

        // Handle resize
        const onResize = () => {
            if (containerRef.current) setDimensions({ w: containerRef.current.getBoundingClientRect().width, h: Math.max(500, window.innerHeight - 350) });
        };
        window.addEventListener('resize', onResize);

        return () => {
            clearInterval(simTimerRef.current);
            window.removeEventListener('resize', onResize);
        };
    }, [assets]);

    // Mouse handlers map
    const handlePointerDown = (e, node) => {
        e.target.setPointerCapture(e.pointerId);
        dragNodeRef.current = node;
    };
    const handlePointerMove = (e) => {
        if (dragNodeRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            dragNodeRef.current.x = e.clientX - rect.left;
            dragNodeRef.current.y = e.clientY - rect.top;
        }
    };
    const handlePointerUp = (e) => {
        if (dragNodeRef.current) {
            e.target.releasePointerCapture(e.pointerId);
            dragNodeRef.current = null;
        }
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: dimensions.h, position: 'relative', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}
            onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <canvas ref={canvasRef} width={dimensions.w} height={dimensions.h} style={{ position: 'absolute', top: 0, left: 0 }} />

            {nodesRef.current.map(node => {
                if (node.id === 'core_router') {
                    return (
                        <div key={node.id} style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translate(-50%, -50%)', width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, var(--cyan), var(--magenta))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(0,212,255,0.3)', pointerEvents: 'none' }}>
                            <Server color="#fff" size={32} />
                        </div>
                    );
                }

                const Icon = ASSET_ICONS[node.asset_type] || Server;
                const isSelected = selectedId === node.id;
                const critColor = node.criticality === 'critical' ? '#ff1744' : node.criticality === 'high' ? '#ff6d00' : '#ffc400';

                return (
                    <div key={node.id}
                        onPointerDown={(e) => { handlePointerDown(e, node); onSelect(node); }}
                        style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translate(-50%, -50%)', width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-card)', border: `2px solid ${isSelected ? '#00d4ff' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', userSelect: 'none', transition: 'box-shadow 0.2s, top 0.05s, left 0.05s', boxShadow: isSelected ? '0 0 20px rgba(0,212,255,0.4)' : node.risk_score > 60 ? '0 0 20px rgba(255,23,68,0.2)' : '0 2px 8px rgba(0,0,0,0.5)', zIndex: isSelected ? 10 : 1 }}
                        title={node.hostname}>
                        <Icon size={20} color={critColor} />

                        {/* Hover label */}
                        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, fontSize: 10, background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', border: '1px solid var(--border)', color: '#fff', pointerEvents: 'none' }}>
                            {node.hostname.split('.')[0]}
                        </div>
                        {/* Alert pin */}
                        {node.risk_score > 60 && (
                            <div style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', background: '#ff1744', border: '2px solid var(--bg-card)', boxShadow: '0 0 8px #ff1744' }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function NetworkMap() {
    const [assets, setAssets] = useState([]);
    const [selected, setSelected] = useState(null);
    const [view, setView] = useState('topology'); // 'topology' or 'list'

    useEffect(() => {
        fetchApi('/assets').then(d => setAssets(d.assets));
    }, []);

    return (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Server className="icon" size={28} /> Network Map</h1>
                    <p className="page-description">{assets.length} assets monitored</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn ${view === 'topology' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('topology')}>Interactive Topology</button>
                    <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')}>List View</button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {view === 'topology' ? (
                    <ForceGraph assets={assets} selectedId={selected?.id} onSelect={setSelected} />
                ) : (
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="data-table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Hostname</th>
                                        <th>IP Address</th>
                                        <th>Type</th>
                                        <th>OS</th>
                                        <th>Criticality</th>
                                        <th>Department</th>
                                        <th>Owner</th>
                                        <th>Vulnerabilities</th>
                                        <th>Risk Score</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.map(a => (
                                        <tr key={a.id} onClick={() => setSelected(a)} style={{ cursor: 'pointer', background: selected?.id === a.id ? 'rgba(0,212,255,0.06)' : undefined }}>
                                            <td style={{ color: '#fff', fontWeight: 600 }}>{a.hostname}</td>
                                            <td className="mono">{a.ip_address}</td>
                                            <td>{a.asset_type}</td>
                                            <td style={{ fontSize: 12 }}>{a.os}</td>
                                            <td><span className={`severity-badge ${a.criticality}`}>{a.criticality}</span></td>
                                            <td>{a.department}</td>
                                            <td>{a.owner}</td>
                                            <td className="mono" style={{ color: a.vulnerabilities > 10 ? '#ff1744' : a.vulnerabilities > 5 ? '#ffc400' : '#00e676' }}>{a.vulnerabilities}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div className="progress-bar" style={{ width: 50, height: 5 }}>
                                                        <div className="progress-fill" style={{ width: `${a.risk_score}%`, background: a.risk_score > 60 ? '#ff1744' : a.risk_score > 30 ? '#ffc400' : '#00e676' }}></div>
                                                    </div>
                                                    <span className="mono" style={{ fontSize: 11 }}>{a.risk_score}</span>
                                                </div>
                                            </td>
                                            <td><span className={`status-badge ${a.status === 'active' ? 'pass' : 'fail'}`}>{a.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Asset Detail Panel */}
                {selected && (
                    <div className="card animate-slide-in" style={{ marginTop: 16, flexShrink: 0, borderLeft: `4px solid ${selected.criticality === 'critical' ? '#ff1744' : '#ff6d00'}`, position: 'relative' }}>
                        <div className="card-header" style={{ marginBottom: 12 }}>
                            <div className="card-title">
                                {(() => { const I = ASSET_ICONS[selected.asset_type] || Server; return <I size={18} color="#00d4ff" />; })()}
                                Asset Details: {selected.hostname}
                            </div>
                            <button className="btn btn-sm btn-outline" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, fontSize: 13 }}>
                            <div><span style={{ color: '#5a6380', display: 'block', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>IP Address</span>
                                <span className="mono" style={{ color: '#fff' }}>{selected.ip_address}</span>
                            </div>
                            <div><span style={{ color: '#5a6380', display: 'block', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>Type / OS</span>
                                <span style={{ color: '#fff' }}>{selected.asset_type} · {selected.os}</span>
                            </div>
                            <div><span style={{ color: '#5a6380', display: 'block', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>Owner</span>
                                <span style={{ color: '#fff' }}>{selected.owner} ({selected.department})</span>
                            </div>
                            <div><span style={{ color: '#5a6380', display: 'block', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>Risk Context</span>
                                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className={`severity-badge ${selected.criticality}`}>{selected.criticality}</span>
                                    <span className="mono" style={{ color: selected.risk_score > 60 ? '#ff1744' : '#ffc400' }}>{selected.risk_score}/100</span>
                                </span>
                            </div>
                            <div><span style={{ color: '#5a6380', display: 'block', marginBottom: 4, fontSize: 10, textTransform: 'uppercase' }}>Vulns</span>
                                <span className="mono" style={{ color: selected.vulnerabilities > 10 ? '#ff1744' : '#00e676', fontSize: 16, fontWeight: 700 }}>{selected.vulnerabilities}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
