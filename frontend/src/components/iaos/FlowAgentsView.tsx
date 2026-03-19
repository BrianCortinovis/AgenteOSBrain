import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const categoryColors: Record<string, string> = {
  generalista: 'rgba(150,150,160,0.6)',
  analista: 'rgba(59,130,246,0.6)',
  builder: 'rgba(16,185,129,0.6)',
  revisore: 'rgba(245,158,11,0.6)',
  ricercatore: 'rgba(139,92,246,0.6)',
  automazione: 'rgba(236,72,153,0.6)',
  contenuti: 'rgba(99,102,241,0.6)',
  supporto: 'rgba(107,114,128,0.6)',
};

type ProviderInfo = { id: string; name: string; available: boolean; models: { id: string; name: string }[] };

export default function FlowAgentsView() {
  const [agents, setAgents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  // Session model overrides: agentId → { provider_id, model_id }
  const [sessionModels, setSessionModels] = useState<Record<string, { provider_id: string; model_id: string }>>({});
  const [savingDefault, setSavingDefault] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<ProviderInfo[]>('/providers').then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<any[]>('/agents/all').then(setAgents).catch(() => {});
  }, []);

  const parseMetadata = (agent: any) => {
    try {
      return typeof agent.metadata === 'string' ? JSON.parse(agent.metadata) : (agent.metadata || {});
    } catch { return {}; }
  };

  const parseTools = (agent: any) => {
    try {
      return typeof agent.tools === 'string' ? JSON.parse(agent.tools) : (agent.tools || []);
    } catch { return []; }
  };

  // Deduplicate by name (keep first occurrence)
  const seen = new Set<string>();
  const unique = agents.filter(a => {
    const key = a.name?.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filtered = filter
    ? unique.filter(a => {
        const meta = parseMetadata(a);
        const searchable = `${a.name} ${a.role} ${meta.summary || ''} ${meta.category || ''} ${(meta.capabilities || []).join(' ')}`.toLowerCase();
        return searchable.includes(filter.toLowerCase());
      })
    : unique;

  return (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto', color: 'rgba(224,230,240,0.85)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Agenti del Sistema ({unique.length})</h3>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Cerca agente..."
          style={{
            padding: '5px 12px', fontSize: 11, borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(224,230,240,0.8)', outline: 'none', width: 180,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(agent => {
          const meta = parseMetadata(agent);
          const tools = parseTools(agent);
          const category = meta.category || 'generalista';
          const capabilities = Array.isArray(meta.capabilities) ? meta.capabilities : [];
          const isExpanded = expandedId === agent.id;

          return (
            <div key={agent.id}
              onClick={() => setExpandedId(isExpanded ? null : agent.id)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                background: isExpanded ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                transition: 'all 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: categoryColors[category] || 'rgba(150,150,160,0.5)',
                  boxShadow: `0 0 6px ${categoryColors[category] || 'rgba(150,150,160,0.3)'}`,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(224,230,240,0.4)', display: 'flex', gap: 8 }}>
                    {agent.role && <span>{agent.role}</span>}
                    <span>{agent.provider_id}/{agent.model_id}</span>
                  </div>
                </div>
                <span style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 6,
                  background: `${categoryColors[category] || 'rgba(150,150,160,0.2)'}20`,
                  color: categoryColors[category] || 'rgba(150,150,160,0.6)',
                  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
                }}>
                  {category}
                </span>
              </div>

              {/* Expanded details */}
              {isExpanded && (() => {
                const session = sessionModels[agent.id] || { provider_id: agent.provider_id, model_id: agent.model_id };
                const currentProv = providers.find(p => p.id === session.provider_id);
                const isChanged = session.provider_id !== agent.provider_id || session.model_id !== agent.model_id;

                const makeDefault = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSavingDefault(agent.id);
                  try {
                    await api.put(`/agents/${agent.id}`, { provider_id: session.provider_id, model_id: session.model_id });
                    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, provider_id: session.provider_id, model_id: session.model_id } : a));
                    setSavedMsg(agent.id);
                    setTimeout(() => setSavedMsg(null), 2000);
                  } catch {}
                  setSavingDefault(null);
                };

                return (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {meta.summary && (
                      <div style={{ fontSize: 11, color: 'rgba(224,230,240,0.5)', marginBottom: 8 }}>{meta.summary}</div>
                    )}

                    {/* ── Model selector for this session ── */}
                    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 9, color: 'rgba(224,230,240,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        Modello per questa sessione
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <select
                          value={session.provider_id}
                          onChange={e => {
                            const prov = providers.find(p => p.id === e.target.value);
                            setSessionModels(prev => ({
                              ...prev,
                              [agent.id]: { provider_id: e.target.value, model_id: prov?.models?.[0]?.id || session.model_id },
                            }));
                          }}
                          style={{ fontSize: 10, padding: '3px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(224,230,240,0.8)', outline: 'none' }}
                        >
                          {providers.filter(p => p.available).map(p => (
                            <option key={p.id} value={p.id} style={{ background: '#1a1d28' }}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={session.model_id}
                          onChange={e => setSessionModels(prev => ({
                            ...prev,
                            [agent.id]: { ...session, model_id: e.target.value },
                          }))}
                          style={{ fontSize: 10, padding: '3px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, color: 'rgba(224,230,240,0.8)', outline: 'none', maxWidth: 140 }}
                        >
                          {(currentProv?.models || []).map(m => (
                            <option key={m.id} value={m.id} style={{ background: '#1a1d28' }}>{m.name}</option>
                          ))}
                        </select>
                        {isChanged && (
                          <button
                            onClick={makeDefault}
                            disabled={savingDefault === agent.id}
                            style={{
                              fontSize: 10, padding: '3px 8px', borderRadius: 5,
                              background: savedMsg === agent.id ? 'rgba(16,185,129,0.15)' : 'rgba(220,50,30,0.12)',
                              border: `1px solid ${savedMsg === agent.id ? 'rgba(16,185,129,0.3)' : 'rgba(220,50,30,0.2)'}`,
                              color: savedMsg === agent.id ? 'rgba(16,185,129,0.8)' : 'rgba(220,70,50,0.8)',
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {savedMsg === agent.id ? '✓ Salvato come default' : savingDefault === agent.id ? '...' : 'Rendi default'}
                          </button>
                        )}
                      </div>
                      {isChanged && (
                        <div style={{ fontSize: 9, color: 'rgba(224,230,240,0.3)', marginTop: 4 }}>
                          Default: {agent.provider_id}/{agent.model_id} → Sessione: {session.provider_id}/{session.model_id}
                        </div>
                      )}
                    </div>

                    {agent.system_prompt && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: 'rgba(224,230,240,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>System Prompt</div>
                        <div style={{ fontSize: 11, color: 'rgba(224,230,240,0.5)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                          {agent.system_prompt.slice(0, 500)}{agent.system_prompt.length > 500 ? '...' : ''}
                        </div>
                      </div>
                    )}
                    {capabilities.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {capabilities.map((c: string, i: number) => (
                          <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'rgba(224,230,240,0.4)' }}>{c}</span>
                        ))}
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div style={{ fontSize: 10, color: 'rgba(224,230,240,0.3)' }}>
                        Tools: {tools.join(', ')}
                      </div>
                    )}
                    {agent.project_name && (
                      <div style={{ fontSize: 9, color: 'rgba(224,230,240,0.2)', marginTop: 6 }}>
                        Progetto: {agent.project_name}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
