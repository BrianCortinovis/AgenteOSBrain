import { useState, useEffect } from 'react';
import { useGraphStore } from '../../../stores/useGraphStore';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useUIStore } from '../../../stores/useUIStore';
import { graphApi } from '../../../api/graph.api';
import { executeApi } from '../../../api/execute.api';
import { agentsApi } from '../../../api/agents.api';
import { schedulerApi } from '../../../api/scheduler.api';
import { t } from '../../../i18n/it';
import AIFieldAssist from '../../common/AIFieldAssist';
import { connectorsApi } from '../../../api/connectors.api';
import { ConnectorIcon } from '../nodes/ConnectorIcons';

const NODE_TYPES = ['sorgente', 'analisi', 'decisione', 'esecuzione', 'memoria', 'automazione'];
const NODE_STATES = ['bozza', 'pronto', 'in_esecuzione', 'completato', 'bloccato'];

const BG_PRESETS = [
  { label: 'Nessuno', value: '' },
  { label: 'Blu scuro', value: '#1e293b' },
  { label: 'Viola scuro', value: '#1e1b4b' },
  { label: 'Verde scuro', value: '#14532d' },
  { label: 'Rosso scuro', value: '#450a0a' },
  { label: 'Ambra scuro', value: '#451a03' },
  { label: 'Grigio', value: '#1f2937' },
  { label: 'Ciano scuro', value: '#083344' },
];

export default function NodeInspector() {
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const nodes = useGraphStore(s => s.nodes);
  const updateNode = useGraphStore(s => s.updateNode);
  const removeNode = useGraphStore(s => s.removeNode);
  const setInspectorOpen = useUIStore(s => s.setInspectorOpen);
  const currentProjectId = useProjectStore(s => s.currentProjectId);

  const node = nodes.find(n => n.id === selectedNodeId);
  const [form, setForm] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [allConnectors, setAllConnectors] = useState<any[]>([]);
  const [connectorSearch, setConnectorSearch] = useState('');

  useEffect(() => {
    if (node) {
      const cfg = parseConfig(node.config);
      setForm({ ...node, bgColor: cfg.bgColor || '', collapsed: cfg.collapsed || false, connectors: cfg.connectors || [] });
    }
  }, [selectedNodeId]);

  useEffect(() => {
    connectorsApi.getCatalog().then(setAllConnectors).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentProjectId) return;
    agentsApi.getByProject(currentProjectId)
      .then((data) => setAgents(data))
      .catch(() => setAgents([]));
  }, [currentProjectId]);

  if (!node) return null;

  const handleChange = (key: string, value: any) => {
    setForm((f: any) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedNodeId) return;
    const cfg = parseConfig(form.config);
    cfg.bgColor = form.bgColor || '';
    cfg.collapsed = form.collapsed || false;
    cfg.connectors = form.connectors || [];
    const saveData = { ...form, config: JSON.stringify(cfg) };
    await graphApi.updateNode(selectedNodeId, saveData);
    updateNode(selectedNodeId, saveData);
  };

  const handleDelete = async () => {
    if (!selectedNodeId) return;
    await graphApi.deleteNode(selectedNodeId);
    removeNode(selectedNodeId);
    setInspectorOpen(false);
  };

  const handleExecuteNode = async () => {
    if (!selectedNodeId || !currentProjectId) return;
    setRunning(true);
    try {
      await executeApi.executeNode(currentProjectId, selectedNodeId);
    } catch {}
    setRunning(false);
  };

  return (
    <div style={{
      width: 300, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Proprietà Nodo</span>
        <button className="btn-icon" onClick={() => setInspectorOpen(false)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label>{t('nodo.nome')}</label>
          <input value={form.label || ''} onChange={e => handleChange('label', e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <AIFieldAssist
              projectId={currentProjectId}
              fieldLabel="Nome nodo"
              fieldKind="short_text"
              value={form.label || ''}
              onApply={(value) => handleChange('label', value)}
              context={`Tipo nodo: ${form.type || 'sorgente'}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{t('nodo.tipo')}</label>
          <select value={form.type || 'sorgente'} onChange={e => handleChange('type', e.target.value)}>
            {NODE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>{t('nodo.stato')}</label>
          <select value={form.state || 'bozza'} onChange={e => handleChange('state', e.target.value)}>
            {NODE_STATES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>{t('nodo.descrizione')}</label>
          <textarea value={form.description || ''} onChange={e => handleChange('description', e.target.value)} rows={3} />
          <div style={{ marginTop: 8 }}>
            <AIFieldAssist
              projectId={currentProjectId}
              fieldLabel="Descrizione nodo"
              fieldKind="long_text"
              value={form.description || ''}
              onApply={(value) => handleChange('description', value)}
              context={`Nodo: ${form.label || ''}\nTipo: ${form.type || 'sorgente'}`}
            />
          </div>
        </div>

        {agents.length > 0 && (
          <div className="form-group">
            <label>{t('nodo.agente')}</label>
            <select value={form.agent_id || ''} onChange={e => handleChange('agent_id', e.target.value)}>
              <option value="">Nessun agente assegnato</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} {agent.role ? `- ${agent.role}` : ''}
                </option>
              ))}
            </select>
            {form.agent_id && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Il nodo eredita subito le impostazioni principali dell’agente assegnato.
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label>{t('nodo.prompt')}</label>
          <textarea value={form.system_prompt || ''} onChange={e => handleChange('system_prompt', e.target.value)} rows={4} placeholder="System prompt per questo nodo..." />
          <div style={{ marginTop: 8 }}>
            <AIFieldAssist
              projectId={currentProjectId}
              fieldLabel="System prompt nodo"
              fieldKind="system_prompt"
              value={form.system_prompt || ''}
              onApply={(value) => handleChange('system_prompt', value)}
              preferredProviderId={form.provider_id || undefined}
              preferredModelId={form.model_id || undefined}
              context={`Nodo: ${form.label || ''}\nTipo: ${form.type || 'sorgente'}\nDescrizione: ${form.description || ''}`}
            />
          </div>
        </div>

        {/* Border/accent color */}
        <div className="form-group">
          <label>Colore Bordo</label>
          <input type="color" value={form.color || '#3b82f6'} onChange={e => handleChange('color', e.target.value)} style={{ height: 32, padding: 2 }} />
        </div>

        {/* Background color */}
        <div className="form-group">
          <label>Sfondo Nodo</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {BG_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => handleChange('bgColor', p.value)}
                title={p.label}
                style={{
                  width: 24, height: 24, borderRadius: 4, border: form.bgColor === p.value ? '2px solid var(--accent-blue)' : '1px solid var(--border-secondary)',
                  background: p.value || 'var(--bg-card)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
          <input type="color" value={form.bgColor || '#1a1a2e'} onChange={e => handleChange('bgColor', e.target.value)} style={{ height: 28, padding: 2, width: '100%' }} />
        </div>

        {/* Collapsed toggle */}
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, display: 'flex' }}>
          <input
            type="checkbox"
            checked={form.collapsed || false}
            onChange={e => handleChange('collapsed', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }}
          />
          <label style={{ margin: 0 }}>Ridotto a etichetta</label>
        </div>

        {/* Connectors picker */}
        <div className="form-group">
          <label>Connettori</label>
          {(form.connectors?.length > 0) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {form.connectors.map((cId: string) => {
                const c = allConnectors.find((x: any) => x.id === cId);
                return (
                  <div
                    key={cId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)',
                      fontSize: 11,
                    }}
                  >
                    <ConnectorIcon connectorId={cId} size={14} />
                    <span>{c?.name || cId}</span>
                    <button
                      onClick={() => handleChange('connectors', form.connectors.filter((x: string) => x !== cId))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 0, fontSize: 12, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <input
            value={connectorSearch}
            onChange={e => setConnectorSearch(e.target.value)}
            placeholder="Cerca connettore..."
            style={{ fontSize: 12, marginBottom: 4 }}
          />
          {connectorSearch && (
            <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border-secondary)', borderRadius: 4 }}>
              {allConnectors
                .filter((c: any) =>
                  c.name.toLowerCase().includes(connectorSearch.toLowerCase()) &&
                  !(form.connectors || []).includes(c.id)
                )
                .slice(0, 10)
                .map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      handleChange('connectors', [...(form.connectors || []), c.id]);
                      setConnectorSearch('');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 8px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-primary)',
                      fontSize: 12,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ConnectorIcon connectorId={c.id} size={14} />
                    <span>{c.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>{c.category}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
            {t('azione.salva')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExecuteNode}
            disabled={running}
            title="Esegui questo nodo"
            style={{ padding: '0 10px' }}
          >
            {running ? (
              <span className="status-dot in_esecuzione" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-green)" stroke="none">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            {t('azione.elimina')}
          </button>
        </div>

        {/* Scheduling section */}
        <SchedulingSection projectId={currentProjectId} nodeId={node?.id} nodeLabel={node?.label || 'Nodo'} />
      </div>
    </div>
  );
}

function SchedulingSection({ projectId, nodeId, nodeLabel }: { projectId: string | null; nodeId?: string; nodeLabel: string }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [triggerType, setTriggerType] = useState('manual');
  const [cronExpr, setCronExpr] = useState('');
  const [saving, setSaving] = useState(false);

  const cronPresets = [
    { label: 'Ogni ora', value: '0 * * * *' },
    { label: 'Ogni giorno 8:00', value: '0 8 * * *' },
    { label: 'Ogni giorno 18:00', value: '0 18 * * *' },
    { label: 'Ogni lunedì 9:00', value: '0 9 * * 1' },
    { label: 'Ogni 30 min', value: '*/30 * * * *' },
    { label: 'Ogni 5 min', value: '*/5 * * * *' },
  ];

  useEffect(() => {
    if (!projectId) return;
    schedulerApi.getByProject(projectId).then((schedules: any[]) => {
      const existing = schedules.find((s: any) => s.node_id === nodeId);
      if (existing) {
        setSchedule(existing);
        setTriggerType(existing.trigger_type || 'manual');
        setCronExpr(existing.cron_expr || '');
      } else {
        setSchedule(null);
        setTriggerType('manual');
        setCronExpr('');
      }
    }).catch(() => {});
  }, [projectId, nodeId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      if (schedule) {
        await schedulerApi.update(schedule.id, { trigger_type: triggerType, cron_expr: cronExpr, enabled: triggerType !== 'manual' });
      } else {
        await schedulerApi.create(projectId, { node_id: nodeId, name: `Auto: ${nodeLabel}`, trigger_type: triggerType, cron_expr: cronExpr, enabled: triggerType !== 'manual' });
      }
    } catch {}
    setSaving(false);
  };

  const handleRemove = async () => {
    if (schedule) {
      await schedulerApi.delete(schedule.id);
      setSchedule(null);
      setTriggerType('manual');
      setCronExpr('');
    }
  };

  return (
    <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border-primary)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Automazione / Schedulazione
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {['manual', 'cron'].map(t => (
          <button key={t} onClick={() => setTriggerType(t)}
            style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              background: triggerType === t ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: triggerType === t ? '#fff' : 'var(--text-secondary)',
              border: triggerType === t ? 'none' : '1px solid var(--border-primary)',
            }}>
            {t === 'manual' ? 'Manuale' : 'Programmato'}
          </button>
        ))}
      </div>
      {triggerType === 'cron' && (
        <>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {cronPresets.map(p => (
              <button key={p.value} onClick={() => setCronExpr(p.value)}
                style={{
                  padding: '2px 8px', borderRadius: 3, fontSize: 9, cursor: 'pointer',
                  background: cronExpr === p.value ? 'var(--accent-blue)' : 'var(--bg-input)',
                  color: cronExpr === p.value ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border-primary)',
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <input value={cronExpr} onChange={e => setCronExpr(e.target.value)}
            placeholder="Espressione cron (es. 0 8 * * *)"
            style={{ width: '100%', fontSize: 11, padding: '5px 8px', fontFamily: 'monospace', marginBottom: 6 }} />
        </>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '4px 12px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'var(--accent-blue)', color: '#fff', border: 'none' }}>
          {saving ? '...' : schedule ? 'Aggiorna' : 'Attiva'}
        </button>
        {schedule && (
          <button onClick={handleRemove}
            style={{ padding: '4px 12px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>
            Rimuovi
          </button>
        )}
      </div>
      {schedule && schedule.next_run && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
          Prossima: {new Date(schedule.next_run).toLocaleString('it-IT')}
        </div>
      )}
    </div>
  );
}

function parseConfig(config: any): any {
  if (!config) return {};
  try {
    let parsed = typeof config === 'string' ? JSON.parse(config) : config;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch { return {}; }
}
