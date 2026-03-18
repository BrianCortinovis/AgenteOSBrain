import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { agentsApi } from '../../api/agents.api';
import { providersApi } from '../../api/providers.api';
import { t } from '../../i18n/it';
import AIFieldAssist from '../common/AIFieldAssist';

const CATEGORY_OPTIONS = [
  { id: 'generalista', label: 'Generalista', color: 'badge-gray' },
  { id: 'analista', label: 'Analista', color: 'badge-blue' },
  { id: 'builder', label: 'Builder', color: 'badge-green' },
  { id: 'revisore', label: 'Revisore', color: 'badge-amber' },
  { id: 'ricercatore', label: 'Ricercatore', color: 'badge-purple' },
  { id: 'automazione', label: 'Automazione', color: 'badge-pink' },
  { id: 'contenuti', label: 'Contenuti', color: 'badge-indigo' },
  { id: 'supporto', label: 'Supporto', color: 'badge-gray' },
  { id: 'custom', label: 'Custom', color: 'badge-gray' },
];

const CAPABILITY_OPTIONS = [
  'Analisi dati',
  'Scrittura contenuti',
  'Codice e sviluppo',
  'Revisione output',
  'Ricerca web',
  'Automazioni',
  'Visione immagini',
  'SEO e marketing',
  'Supporto cliente',
  'Sintesi documenti',
];

const ACTION_OPTIONS = [
  'Legge input',
  'Genera report',
  'Scrive prompt',
  'Produce codice',
  'Valida risultati',
  'Decide passaggi',
  'Esegue comandi',
  'Crea contenuti',
];

function parseJson<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAgent(agent: any) {
  const metadata = parseJson<any>(agent.metadata, {});
  const tools = parseJson<string[]>(agent.tools, []);
  return {
    ...agent,
    scope: agent.scope || 'global',
    source_project_id: agent.source_project_id || agent.project_id || '',
    temperature: Number.isFinite(agent.temperature) ? Number(agent.temperature) : 0.4,
    memory_enabled: Boolean(agent.memory_enabled),
    tools: Array.isArray(tools) ? tools : [],
    metadata: {
      category: metadata.category || 'generalista',
      summary: metadata.summary || '',
      capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities : [],
    },
  };
}

function getCategoryMeta(categoryId: string) {
  return CATEGORY_OPTIONS.find((option) => option.id === categoryId) || CATEGORY_OPTIONS[0];
}

function createEmptyDraft(providerId = 'anthropic', modelId = 'claude-cli') {
  return {
    name: '',
    role: '',
    scope: 'global',
    source_project_id: '',
    provider_id: providerId,
    model_id: modelId,
    system_prompt: '',
    temperature: 0.4,
    tools: [] as string[],
    memory_enabled: true,
    fallback_provider_id: '',
    fallback_model_id: '',
    metadata: {
      category: 'generalista',
      summary: '',
      capabilities: [] as string[],
    },
  };
}

export default function AgentPanel() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const graphNodes = useGraphStore((s) => s.nodes);
  const [providers, setProviders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [draft, setDraft] = useState<any>(() => createEmptyDraft());
  const [wizardStep, setWizardStep] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [aiDescription, setAiDescription] = useState('');
  const [customCapability, setCustomCapability] = useState('');
  const [customAction, setCustomAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'name' | 'provider' | 'category' | 'usage'>('name');

  useEffect(() => {
    providersApi.getAll().then((data) => {
      setProviders(data);
      const available = data.filter((provider: any) => provider.available);
      if (available.length > 0) {
        const provider = available.find((item: any) => item.id === 'anthropic') || available[0];
        setDraft((current: any) => ({
          ...current,
          provider_id: current.provider_id || provider.id,
          model_id: current.model_id || provider.models?.[0]?.id || '',
        }));
      }
    }).catch(() => {});
  }, []);

  const loadAgents = async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await agentsApi.getByProject(currentProjectId);
      const normalized = data.map(normalizeAgent);
      setAgents(normalized);
      setSelectedId((current) => current && normalized.some((agent: any) => agent.id === current) ? current : normalized[0]?.id || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMode('view');
    setWizardStep(1);
    if (currentProjectId) loadAgents();
  }, [currentProjectId]);

  const usageByAgent = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const node of graphNodes) {
      if (!node.agent_id) continue;
      usage[node.agent_id] = (usage[node.agent_id] || 0) + 1;
    }
    return usage;
  }, [graphNodes]);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = agents.filter((agent) => {
      const matchesSearch = !query || [
        agent.name,
        agent.role,
        agent.metadata?.summary,
        ...(agent.metadata?.capabilities || []),
        ...(agent.tools || []),
      ].join(' ').toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'all' || agent.metadata?.category === categoryFilter;
      const matchesProvider = providerFilter === 'all' || agent.provider_id === providerFilter;
      return matchesSearch && matchesCategory && matchesProvider;
    });
    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'provider': return (a.provider_id || '').localeCompare(b.provider_id || '');
        case 'category': return (a.metadata?.category || '').localeCompare(b.metadata?.category || '');
        case 'usage': return (usageByAgent[b.id] || 0) - (usageByAgent[a.id] || 0);
        default: return 0;
      }
    });
  }, [agents, search, categoryFilter, providerFilter, sortBy, usageByAgent]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) || null,
    [agents, selectedId],
  );

  const currentProvider = providers.find((provider) => provider.id === draft.provider_id);
  const currentModels = currentProvider?.models || [];
  const fallbackProvider = providers.find((provider) => provider.id === draft.fallback_provider_id);
  const fallbackModels = fallbackProvider?.models || [];

  const totalAssignedNodes = Object.values(usageByAgent).reduce((sum, value) => sum + value, 0);

  const openCreateWizard = () => {
    const available = providers.filter((provider) => provider.available);
    const provider = available.find((item) => item.id === 'anthropic') || available[0];
    const nextDraft = createEmptyDraft(provider?.id || 'anthropic', provider?.models?.[0]?.id || 'claude-cli');
    setDraft(nextDraft);
    setAiDescription('');
    setCustomCapability('');
    setCustomAction('');
    setWizardStep(1);
    setMode('create');
    setSelectedId(null);
  };

  const openEdit = (agent: any) => {
    setDraft(JSON.parse(JSON.stringify(agent)));
    setAiDescription(agent.metadata?.summary || agent.role || '');
    setCustomCapability('');
    setCustomAction('');
    setWizardStep(1);
    setMode('edit');
    setSelectedId(agent.id);
  };

  const resetEditor = () => {
    setMode('view');
    setDraft(createEmptyDraft());
    setAiDescription('');
    setCustomCapability('');
    setCustomAction('');
    setWizardStep(1);
  };

  const updateDraft = (key: string, value: any) => {
    setDraft((current: any) => ({ ...current, [key]: value }));
  };

  const updateMetadata = (key: string, value: any) => {
    setDraft((current: any) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [key]: value,
      },
    }));
  };

  const toggleListValue = (scope: 'tools' | 'capabilities', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (scope === 'tools') {
      const set = new Set(draft.tools || []);
      if (set.has(trimmed)) set.delete(trimmed);
      else set.add(trimmed);
      updateDraft('tools', Array.from(set));
      return;
    }
    const set = new Set(draft.metadata?.capabilities || []);
    if (set.has(trimmed)) set.delete(trimmed);
    else set.add(trimmed);
    updateMetadata('capabilities', Array.from(set));
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    updateDraft('provider_id', providerId);
    updateDraft('model_id', provider?.models?.[0]?.id || '');
  };

  const handleFallbackProviderChange = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    updateDraft('fallback_provider_id', providerId);
    updateDraft('fallback_model_id', provider?.models?.[0]?.id || '');
  };

  const handleGenerateDraft = async () => {
    if (!currentProjectId || !aiDescription.trim()) return;
    setGenerating(true);
    try {
      const generated = await agentsApi.generateDraft(currentProjectId, {
        description: aiDescription,
        provider_id: draft.provider_id,
        model_id: draft.model_id,
      });
      setDraft((current: any) => ({
        ...current,
        ...normalizeAgent(generated),
      }));
      setWizardStep(2);
    } catch (err: any) {
      alert(`Errore generazione agente: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentProjectId || !draft.name.trim()) {
      alert('Inserisci almeno il nome dell’agente.');
      return;
    }
    setSaving(true);
    try {
        const payload = {
          ...draft,
          name: draft.name.trim(),
          role: draft.role.trim(),
          system_prompt: draft.system_prompt.trim(),
          source_project_id: draft.source_project_id || currentProjectId,
          metadata: {
            ...draft.metadata,
            summary: draft.metadata?.summary?.trim() || '',
        },
      };

      let saved;
      if (mode === 'edit' && draft.id) {
        saved = await agentsApi.update(draft.id, payload);
      } else {
        saved = await agentsApi.create(currentProjectId, payload);
      }
      await loadAgents();
      setSelectedId(saved.id);
      setMode('view');
    } catch (err: any) {
      alert(`Errore salvataggio agente: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vuoi davvero eliminare questo agente?')) return;
    await agentsApi.delete(id);
    if (selectedId === id) setSelectedId(null);
    if (draft.id === id) resetEditor();
    await loadAgents();
  };

  const renderMetric = (label: string, value: string | number, accent: string) => (
    <div style={{
      background: 'linear-gradient(180deg, rgba(26,35,64,0.95), rgba(15,22,41,0.95))',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)',
      padding: 16,
      minWidth: 160,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );

  if (!currentProjectId) return <div className="empty-state"><p>Seleziona un progetto</p></div>;

  return (
    <div style={{ height: '100%', overflow: 'hidden', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>Catalogo Agenti</h2>
            <p style={{ marginTop: 6, color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.5 }}>
              Qui costruisci, classifichi e riusi i tuoi agenti. Le modifiche salvate vengono lette dal motore in tempo reale:
              gli agenti sono disponibili subito per i nodi del progetto, senza un riavvio manuale del workflow.
            </p>
          </div>
          <button className="btn btn-primary" onClick={openCreateWizard}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Crea Agente
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {renderMetric('Agenti salvati', agents.length, 'var(--accent-blue)')}
          {renderMetric('Nodi collegati', totalAssignedNodes, 'var(--accent-green)')}
          {renderMetric('Categorie usate', new Set(agents.map((agent) => agent.metadata?.category)).size, 'var(--accent-purple)')}
        </div>

        <div style={{
          border: '1px solid rgba(59,130,246,0.25)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.06))',
          borderRadius: 'var(--radius-lg)',
          padding: 14,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(59,130,246,0.18)',
            color: 'var(--accent-blue)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20" />
            </svg>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Puoi creare un agente scrivendo cosa deve fare, far generare la bozza al modello e salvarla. Da quel momento l’agente resta nel progetto e puoi assegnarlo ai nodi quando ti serve.
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 0.9fr)', gap: 20 }}>
          <div style={{
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca..."
                style={{ flex: 1, minWidth: 140, fontSize: 12, padding: '5px 10px' }}
              />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ fontSize: 11, padding: '5px 6px' }}>
                <option value="all">Categorie</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} style={{ fontSize: 11, padding: '5px 6px' }}>
                <option value="all">Provider</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ fontSize: 11, padding: '5px 6px' }}>
                <option value="name">Nome</option>
                <option value="provider">Provider</option>
                <option value="category">Categoria</option>
                <option value="usage">Utilizzo</option>
              </select>
              {/* View toggle */}
              <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                <button onClick={() => setViewMode('cards')} title="Schede grandi"
                  style={{ padding: '4px 8px', background: viewMode === 'cards' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'cards' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
                <button onClick={() => setViewMode('list')} title="Lista compatta"
                  style={{ padding: '4px 8px', background: viewMode === 'list' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? 'var(--accent-blue)' : 'var(--text-muted)', borderLeft: '1px solid var(--border-primary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {loading ? (
                <div className="empty-state"><p>Caricamento agenti...</p></div>
              ) : filteredAgents.length === 0 ? (
                <div className="empty-state">
                  <p>{agents.length === 0 ? t('agente.nessuno') : 'Nessun agente corrisponde ai filtri.'}</p>
                </div>
              ) : (
                viewMode === 'cards' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {filteredAgents.map((agent) => {
                    const category = getCategoryMeta(agent.metadata?.category);
                    const usage = usageByAgent[agent.id] || 0;
                    const isSelected = selectedId === agent.id;
                    return (
                      <button key={agent.id} onClick={() => { setSelectedId(agent.id); setMode('view'); }}
                        style={{
                          textAlign: 'left',
                          background: isSelected ? 'var(--bg-hover)' : 'var(--bg-card)',
                          border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                          borderRadius: 10, padding: 14,
                          boxShadow: isSelected ? '0 0 0 1px var(--accent-blue)22' : 'none',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{agent.role || '—'}</div>
                          </div>
                          <span className={`badge ${category.color}`}>{category.label}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, minHeight: 32 }}>
                          {(agent.metadata?.summary || '').slice(0, 100) || 'Nessun riassunto'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                          <span className={`badge ${agent.scope === 'global' ? 'badge-green' : 'badge-amber'}`}>
                            {agent.scope === 'global' ? 'Globale' : 'Progetto'}
                          </span>
                          <span className="badge badge-gray">{agent.provider_id}/{agent.model_id?.split('-')[0]}</span>
                          {usage > 0 && <span className="badge badge-green">{usage} nodi</span>}
                          {agent.memory_enabled && <span className="badge badge-purple">MEM</span>}
                        </div>
                        {(agent.tools?.length > 0) && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
                            {agent.tools.slice(0, 4).map((t: string) => (
                              <span key={t} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '1px 5px', borderRadius: 3 }}>{t}</span>
                            ))}
                            {agent.tools.length > 4 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{agent.tools.length - 4}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                ) : (
                /* LIST VIEW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Header row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 70px 50px', gap: 8, padding: '6px 10px', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border-primary)' }}>
                    <span style={{ cursor: 'pointer' }} onClick={() => setSortBy('name')}>Nome {sortBy === 'name' ? '▾' : ''}</span>
                    <span style={{ cursor: 'pointer' }} onClick={() => setSortBy('category')}>Categoria {sortBy === 'category' ? '▾' : ''}</span>
                    <span style={{ cursor: 'pointer' }} onClick={() => setSortBy('provider')}>Provider {sortBy === 'provider' ? '▾' : ''}</span>
                    <span>Scope</span>
                    <span style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => setSortBy('usage')}>Nodi {sortBy === 'usage' ? '▾' : ''}</span>
                  </div>
                  {filteredAgents.map((agent) => {
                    const category = getCategoryMeta(agent.metadata?.category);
                    const usage = usageByAgent[agent.id] || 0;
                    const isSelected = selectedId === agent.id;
                    return (
                      <button key={agent.id} onClick={() => { setSelectedId(agent.id); setMode('view'); }}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 90px 80px 70px 50px', gap: 8,
                          padding: '8px 10px', textAlign: 'left', borderRadius: 4,
                          background: isSelected ? 'var(--bg-hover)' : 'transparent',
                          border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
                          borderLeft: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                        }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{agent.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{agent.role}</span>
                        </div>
                        <span className={`badge ${category.color}`} style={{ fontSize: 9, justifySelf: 'start' }}>{category.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{agent.provider_id}</span>
                        <span className={`badge ${agent.scope === 'global' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 8, justifySelf: 'start' }}>
                          {agent.scope === 'global' ? 'Global' : 'Proj'}
                        </span>
                        <span style={{ fontSize: 11, color: usage > 0 ? 'var(--accent-green)' : 'var(--text-muted)', textAlign: 'right' }}>{usage}</span>
                      </button>
                    );
                  })}
                </div>
                )
              )}
            </div>
          </div>

          <div style={{
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {mode === 'create' ? 'Wizard nuovo agente' : mode === 'edit' ? 'Modifica agente' : 'Dettaglio agente'}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {mode === 'view'
                    ? 'Apri un agente esistente o crea una nuova bozza.'
                    : 'Configura ruolo, categoria, capacità e modello dell’agente.'}
                </div>
              </div>
              {(mode === 'edit' || mode === 'create') && (
                <button className="btn btn-secondary btn-sm" onClick={resetEditor}>Annulla</button>
              )}
            </div>

            {mode === 'view' && selectedAgent ? (
              <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedAgent.name}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>{selectedAgent.role || 'Ruolo non definito'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge ${getCategoryMeta(selectedAgent.metadata?.category).color}`}>
                      {getCategoryMeta(selectedAgent.metadata?.category).label}
                    </span>
                    <span className={`badge ${selectedAgent.scope === 'global' ? 'badge-green' : 'badge-amber'}`}>
                      {selectedAgent.scope === 'global' ? 'Globale' : 'Solo progetto'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {selectedAgent.metadata?.summary || 'Questo agente non ha ancora una sintesi operativa.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Provider</div>
                    <div style={{ marginTop: 6 }}>{selectedAgent.provider_id}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Modello</div>
                    <div style={{ marginTop: 6 }}>{selectedAgent.model_id}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Temperatura</div>
                    <div style={{ marginTop: 6 }}>{selectedAgent.temperature}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Utilizzo</div>
                    <div style={{ marginTop: 6 }}>{usageByAgent[selectedAgent.id] || 0} nodi collegati</div>
                  </div>
                </div>

                {(selectedAgent.metadata?.capabilities?.length || selectedAgent.tools?.length) > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Capacità e azioni</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(selectedAgent.metadata?.capabilities || []).map((capability: string) => (
                        <span key={capability} className="badge badge-blue" style={{ textTransform: 'none', letterSpacing: 0 }}>{capability}</span>
                      ))}
                      {(selectedAgent.tools || []).map((tool: string) => (
                        <span key={tool} className="badge badge-green" style={{ textTransform: 'none', letterSpacing: 0 }}>{tool}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>System prompt</div>
                  <div style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedAgent.system_prompt || 'Nessun prompt configurato.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => openEdit(selectedAgent)} style={{ flex: 1 }}>
                    Modifica agente
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(selectedAgent.id)}>
                    {t('agente.elimina')}
                  </button>
                </div>
              </div>
            ) : mode === 'view' ? (
              <div className="empty-state" style={{ flex: 1 }}>
                <p>Seleziona un agente dal catalogo oppure creane uno nuovo.</p>
              </div>
            ) : (
              <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4].map((step) => (
                    <button
                      key={step}
                      onClick={() => setWizardStep(step)}
                      className={wizardStep === step ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    >
                      {step === 1 ? 'Brief' : step === 2 ? 'Classifica' : step === 3 ? 'Modello' : 'Prompt'}
                    </button>
                  ))}
                </div>

                {wizardStep === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label>Descrizione in linguaggio naturale</label>
                      <textarea
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        rows={6}
                        placeholder="Esempio: crea un agente che analizza i contenuti di un sito, produce un report SEO e segnala le priorità di redesign."
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={handleGenerateDraft} disabled={generating || !aiDescription.trim()}>
                        {generating ? 'Generazione...' : 'Genera bozza con AI'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setWizardStep(2)}>
                        Continua manualmente
                      </button>
                    </div>

                    <div className="form-group">
                      <label>{t('agente.nome')}</label>
                      <input value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} placeholder="Es. Analista SEO senior" />
                      <div style={{ marginTop: 8 }}>
                        <AIFieldAssist
                          projectId={currentProjectId}
                          fieldLabel="Nome agente"
                          fieldKind="short_text"
                          value={draft.name || ''}
                          onApply={(value) => updateDraft('name', value)}
                          preferredProviderId={draft.provider_id}
                          preferredModelId={draft.model_id}
                          context={`Categoria: ${draft.metadata?.category || 'generalista'}\nRuolo: ${draft.role || ''}\nSintesi: ${draft.metadata?.summary || ''}`}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>{t('agente.ruolo')}</label>
                      <input value={draft.role} onChange={(e) => updateDraft('role', e.target.value)} placeholder="Es. Audit, revisione, generazione contenuti..." />
                      <div style={{ marginTop: 8 }}>
                        <AIFieldAssist
                          projectId={currentProjectId}
                          fieldLabel="Ruolo agente"
                          fieldKind="short_text"
                          value={draft.role || ''}
                          onApply={(value) => updateDraft('role', value)}
                          preferredProviderId={draft.provider_id}
                          preferredModelId={draft.model_id}
                          context={`Nome: ${draft.name || ''}\nCategoria: ${draft.metadata?.category || 'generalista'}`}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Riassunto operativo</label>
                      <textarea value={draft.metadata?.summary || ''} onChange={(e) => updateMetadata('summary', e.target.value)} rows={3} />
                      <div style={{ marginTop: 8 }}>
                        <AIFieldAssist
                          projectId={currentProjectId}
                          fieldLabel="Riassunto operativo agente"
                          fieldKind="long_text"
                          value={draft.metadata?.summary || ''}
                          onApply={(value) => updateMetadata('summary', value)}
                          preferredProviderId={draft.provider_id}
                          preferredModelId={draft.model_id}
                          context={`Nome: ${draft.name || ''}\nRuolo: ${draft.role || ''}\nCategoria: ${draft.metadata?.category || 'generalista'}`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label>Categoria agente</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {CATEGORY_OPTIONS.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => updateMetadata('category', category.id)}
                            style={{
                              textAlign: 'left',
                              padding: 12,
                              borderRadius: 'var(--radius-md)',
                              border: draft.metadata?.category === category.id ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                              background: draft.metadata?.category === category.id ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{category.label}</div>
                            <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>Classifica l’agente per area e uso.</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Capacità principali</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {CAPABILITY_OPTIONS.map((capability) => {
                          const active = (draft.metadata?.capabilities || []).includes(capability);
                          return (
                            <button
                              key={capability}
                              onClick={() => toggleListValue('capabilities', capability)}
                              className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            >
                              {capability}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <input value={customCapability} onChange={(e) => setCustomCapability(e.target.value)} placeholder="Aggiungi capacità personalizzata" />
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          toggleListValue('capabilities', customCapability);
                          setCustomCapability('');
                        }}>
                          Aggiungi
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Azioni che l’agente sa fare</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ACTION_OPTIONS.map((action) => {
                          const active = (draft.tools || []).includes(action);
                          return (
                            <button
                              key={action}
                              onClick={() => toggleListValue('tools', action)}
                              className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            >
                              {action}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <input value={customAction} onChange={(e) => setCustomAction(e.target.value)} placeholder="Aggiungi azione personalizzata" />
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          toggleListValue('tools', customAction);
                          setCustomAction('');
                        }}>
                          Aggiungi
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label>Visibilità</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        <button
                          onClick={() => updateDraft('scope', 'global')}
                          style={{
                            textAlign: 'left',
                            padding: 12,
                            borderRadius: 'var(--radius-md)',
                            border: draft.scope === 'global' ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                            background: draft.scope === 'global' ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>Globale</div>
                          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>Disponibile in tutti i progetti.</div>
                        </button>
                        <button
                          onClick={() => updateDraft('scope', 'project')}
                          style={{
                            textAlign: 'left',
                            padding: 12,
                            borderRadius: 'var(--radius-md)',
                            border: draft.scope === 'project' ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                            background: draft.scope === 'project' ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>Solo progetto</div>
                          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>Visibile solo in questo progetto.</div>
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>{t('agente.provider')}</label>
                      <select value={draft.provider_id} onChange={(e) => handleProviderChange(e.target.value)}>
                        {providers.filter((provider) => provider.available).map((provider) => (
                          <option key={provider.id} value={provider.id}>{provider.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>{t('agente.modello')}</label>
                      <select value={draft.model_id} onChange={(e) => updateDraft('model_id', e.target.value)}>
                        {currentModels.map((model: any) => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>{t('agente.temperatura')}: {draft.temperature}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={draft.temperature}
                        onChange={(e) => updateDraft('temperature', parseFloat(e.target.value))}
                        style={{ background: 'transparent', border: 'none', padding: 0 }}
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={draft.memory_enabled}
                        onChange={(e) => updateDraft('memory_enabled', e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }}
                      />
                      <label style={{ margin: 0 }}>Memoria persistente agente</label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <div className="form-group">
                        <label>Fallback provider</label>
                        <select value={draft.fallback_provider_id} onChange={(e) => handleFallbackProviderChange(e.target.value)}>
                          <option value="">Nessuno</option>
                          {providers.filter((provider) => provider.available).map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Fallback modello</label>
                        <select value={draft.fallback_model_id} onChange={(e) => updateDraft('fallback_model_id', e.target.value)} disabled={!draft.fallback_provider_id}>
                          <option value="">Nessuno</option>
                          {fallbackModels.map((model: any) => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                    }}>
                      Una volta salvato, questo agente è subito disponibile {draft.scope === 'global' ? 'in tutti i progetti' : 'nel progetto corrente'}. Se lo assegni a un nodo, il motore userà subito le sue impostazioni modello e prompt.
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label>{t('agente.prompt')}</label>
                      <textarea
                        value={draft.system_prompt}
                        onChange={(e) => updateDraft('system_prompt', e.target.value)}
                        rows={14}
                        placeholder="Definisci il comportamento operativo dell’agente..."
                      />
                      <div style={{ marginTop: 8 }}>
                        <AIFieldAssist
                          projectId={currentProjectId}
                          fieldLabel="System prompt agente"
                          fieldKind="system_prompt"
                          value={draft.system_prompt || ''}
                          onApply={(value) => updateDraft('system_prompt', value)}
                          preferredProviderId={draft.provider_id}
                          preferredModelId={draft.model_id}
                          context={`Nome: ${draft.name || ''}\nRuolo: ${draft.role || ''}\nCategoria: ${draft.metadata?.category || 'generalista'}\nCapacità: ${(draft.metadata?.capabilities || []).join(', ')}\nAzioni: ${(draft.tools || []).join(', ')}`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setWizardStep((step) => Math.max(1, step - 1))}
                    disabled={wizardStep === 1}
                  >
                    Indietro
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {wizardStep < 4 && (
                      <button className="btn btn-secondary" onClick={() => setWizardStep((step) => Math.min(4, step + 1))}>
                        Avanti
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Salvataggio...' : mode === 'edit' ? 'Salva modifiche' : 'Crea agente'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
