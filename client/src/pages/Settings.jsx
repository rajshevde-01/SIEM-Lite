import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, ShieldAlert, Plus, Trash2, Save, Code, Activity, Server, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../utils/api';

export default function Settings() {
    const [rules, setRules] = useState([]);
    const [isAdding, setIsAdding] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('threat');
    const [severity, setSeverity] = useState('high');
    const [mitreTactic, setMitreTactic] = useState('TA0001');
    const [mitreTechnique, setMitreTechnique] = useState('T1190');

    // Logic state
    const [field, setField] = useState('event_type');
    const [operator, setOperator] = useState('equals');
    const [value, setValue] = useState('');
    const [threshold, setThreshold] = useState(1);
    const [timeWindow, setTimeWindow] = useState(60);

    const loadRules = async () => {
        try {
            const data = await fetchApi('/rules');
            setRules(data.rules || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { loadRules(); }, []);

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this custom rule?')) return;
        await fetchApi(`/rules/${id}`, { method: 'DELETE' });
        loadRules();
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const logic = {
            field,
            operator,
            value,
            threshold: parseInt(threshold),
            timeWindow: parseInt(timeWindow)
        };

        const payload = {
            name,
            description,
            category,
            severity,
            mitre_tactic: mitreTactic,
            mitre_technique: mitreTechnique,
            logic: JSON.stringify(logic)
        };

        await fetchApi('/rules', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        setIsAdding(false);
        // Reset form
        setName(''); setDescription(''); setValue(''); setThreshold(1);
        loadRules();
    };

    return (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 20px 20px' }}>
            <div className="page-header" style={{ marginBottom: 30 }}>
                <div>
                    <h1 className="page-title"><SettingsIcon className="icon" size={28} /> Settings & Integrations</h1>
                    <p className="page-description">Manage detection rules, integrations, and SIEM configurations</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 30, flex: 1 }}>

                {/* Settings Sidebar nav */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="card" style={{ padding: '16px', borderLeft: '3px solid #00d4ff', background: 'rgba(0, 212, 255, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff', fontWeight: 600 }}>
                            <ShieldAlert size={18} color="#00d4ff" /> Detection Rules
                        </div>
                    </div>
                    <div className="card" style={{ padding: '16px', cursor: 'pointer', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
                            <Server size={18} /> Data Ingestion
                        </div>
                    </div>
                    <div className="card" style={{ padding: '16px', cursor: 'pointer', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
                            <Activity size={18} /> Engine Tuning
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
                        <div>
                            <h2 style={{ fontSize: 18, color: '#fff', margin: 0 }}>Custom Detection Rules</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>Build real-time streaming queries to trigger alerts</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
                            {isAdding ? 'Cancel' : <><Plus size={16} style={{ marginRight: 6 }} /> Create Rule</>}
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                        {isAdding && (
                            <form onSubmit={handleSave} className="animate-fade-up" style={{ background: 'rgba(0,0,0,0.2)', padding: 24, borderRadius: 8, border: '1px solid #00d4ff', marginBottom: 30 }}>
                                <h3 style={{ fontSize: 15, color: '#00d4ff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><Code size={16} /> Rule Builder</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>Rule Name *</label>
                                        <input type="text" className="search-input" style={{ width: '100%', padding: '10px' }} value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Critical Port Scanning" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>Category</label>
                                        <select className="search-input" style={{ width: '100%', padding: '10px' }} value={category} onChange={e => setCategory(e.target.value)}>
                                            <option value="threat">Threat Detection</option>
                                            <option value="compliance">Compliance</option>
                                            <option value="anomaly">Anomaly</option>
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: 12, color: '#8892b0', marginBottom: 6 }}>Description *</label>
                                        <input type="text" className="search-input" style={{ width: '100%', padding: '10px' }} value={description} onChange={e => setDescription(e.target.value)} required placeholder="Triggers when..." />
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, marginBottom: 20 }}>
                                    <h4 style={{ fontSize: 13, color: '#fff', marginBottom: 16 }}>Detection Logic (IF EVENT MATCHES)</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
                                        <select className="search-input" style={{ padding: '10px' }} value={field} onChange={e => setField(e.target.value)}>
                                            <option value="event_type">Event Type</option>
                                            <option value="severity">Severity</option>
                                            <option value="dest_port">Destination Port</option>
                                            <option value="source_ip">Source IP</option>
                                            <option value="action">Action</option>
                                        </select>
                                        <select className="search-input" style={{ padding: '10px' }} value={operator} onChange={e => setOperator(e.target.value)}>
                                            <option value="equals">Equals (==)</option>
                                            <option value="contains">Contains</option>
                                            <option value="greater_than">Greater Than (&gt;)</option>
                                        </select>
                                        <input type="text" className="search-input" style={{ padding: '10px' }} value={value} onChange={e => setValue(e.target.value)} required placeholder="Value (e.g. 'authentication')" />
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20, marginBottom: 20 }}>
                                    <h4 style={{ fontSize: 13, color: '#fff', marginBottom: 16 }}>Thresholds & MITRE Mapping</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, color: '#8892b0', marginBottom: 6 }}>Occurrences</label>
                                            <input type="number" min="1" className="search-input" style={{ width: '100%', padding: '10px' }} value={threshold} onChange={e => setThreshold(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, color: '#8892b0', marginBottom: 6 }}>Time Window (s)</label>
                                            <input type="number" min="1" className="search-input" style={{ width: '100%', padding: '10px' }} value={timeWindow} onChange={e => setTimeWindow(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, color: '#8892b0', marginBottom: 6 }}>MITRE Tactic</label>
                                            <input type="text" className="search-input" style={{ width: '100%', padding: '10px' }} value={mitreTactic} onChange={e => setMitreTactic(e.target.value)} placeholder="e.g. TA0001" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 11, color: '#8892b0', marginBottom: 6 }}>MITRE Technique</label>
                                            <input type="text" className="search-input" style={{ width: '100%', padding: '10px' }} value={mitreTechnique} onChange={e => setMitreTechnique(e.target.value)} placeholder="e.g. T1190" />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" className="btn btn-primary" style={{ background: '#00d4ff', color: '#000' }}><Save size={16} style={{ marginRight: 6 }} /> Save Active Rule</button>
                                </div>
                            </form>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {rules.map(rule => (
                                <div key={rule.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <span className={`severity-badge ${rule.severity}`} style={{ padding: '2px 8px', fontSize: 11 }}>{rule.severity}</span>
                                            <h4 style={{ color: '#fff', margin: 0, fontSize: 15 }}>{rule.name}</h4>
                                        </div>
                                        <p style={{ color: '#8892b0', margin: '0 0 12px 0', fontSize: 13 }}>{rule.description}</p>
                                        <div className="mono" style={{ fontSize: 12, color: '#00d4ff', background: 'rgba(0,212,255,0.1)', display: 'inline-block', padding: '4px 8px', borderRadius: 4 }}>
                                            IF {JSON.parse(rule.logic).field} {JSON.parse(rule.logic).operator} "{JSON.parse(rule.logic).value}" (x{JSON.parse(rule.logic).threshold || 1})
                                        </div>
                                    </div>
                                    <button className="btn btn-sm btn-outline" style={{ color: '#ff1744', borderColor: 'rgba(255,23,68,0.3)' }} onClick={() => handleDelete(rule.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {rules.length === 0 && !isAdding && (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                    <AlertTriangle size={32} style={{ opacity: 0.5, marginBottom: 10 }} />
                                    <p>No custom detection rules configured.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
