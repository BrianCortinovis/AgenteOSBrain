import { useState, useEffect, useCallback } from 'react';
import { connectorsApi } from '../../api/connectors.api';
import { t } from '../../i18n/it';

// ─── Costanti ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'Intelligenza Artificiale',
  dev: 'Sviluppo',
  'cloud-storage': 'Cloud Storage',
  database: 'Database',
  messaging: 'Messaggistica',
  email: 'Email',
  social: 'Social Media',
  productivity: 'Produttivit\u00e0',
  crm: 'CRM',
  marketing: 'Marketing',
  automation: 'Automazione',
  cms: 'CMS',
};

const CATEGORY_ICONS: Record<string, string> = {
  ai: 'M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z',
  dev: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  'cloud-storage': 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  database: 'M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z',
  messaging: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  email: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  social: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
  productivity: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6M9 14l2 2 4-4',
  crm: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  marketing: 'M22 12h-4l-3 9L9 3l-3 9H2',
  automation: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4',
  cms: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
};

const STATUS_COLORS: Record<string, string> = {
  connected: 'var(--accent-green, #22c55e)',
  disconnected: 'var(--text-muted, #6b7280)',
  error: 'var(--accent-red, #ef4444)',
};

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connesso',
  disconnected: 'Disconnesso',
  error: 'Errore',
};

// ─── Componente principale ─────────────────────────────────────

export default function ConnectorBrowser() {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedDef, setSelectedDef] = useState<any | null>(null);
  const [editingInstance, setEditingInstance] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(() => {
    connectorsApi.getDefinitions().then(setDefinitions).catch(() => {});
    connectorsApi.getInstances().then(setInstances).catch(() => setInstances([]));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = definitions.filter(d => {
    if (filterCategory && d.category !== filterCategory) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(definitions.map(d => d.category))];

  const handleConnectorClick = (def: any) => {
    const hasSchema = def.configSchema && Object.keys(def.configSchema).length > 0;
    if (!hasSchema && def.status === 'coming_soon') return;
    setSelectedDef(def);
    setEditingInstance(null);
    setShowModal(true);
  };

  const handleEditInstance = (inst: any) => {
    const def = definitions.find(d => d.id === inst.connector_id);
    setSelectedDef(def || null);
    setEditingInstance(inst);
    setShowModal(true);
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm('Vuoi davvero eliminare questa istanza del connettore?')) return;
    await connectorsApi.deleteInstance(id);
    loadData();
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedDef(null);
    setEditingInstance(null);
  };

  const handleSaved = () => {
    handleClose();
    loadData();
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      {/* ── Connettori Configurati ── */}
      {instances.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green, #22c55e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Connettori Configurati</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>({instances.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {instances.map((inst: any) => {
              const config = typeof inst.config === 'string' ? JSON.parse(inst.config || '{}') : inst.config;
              const def = definitions.find(d => d.id === inst.connector_id);
              return (
                <div key={inst.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all var(--transition)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, flexShrink: 0,
                  }}>
                    {inst.name?.slice(0, 2).toUpperCase() || 'CN'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inst.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: STATUS_COLORS[inst.status] || STATUS_COLORS.disconnected,
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 11, color: STATUS_COLORS[inst.status] || 'var(--text-muted)' }}>
                        {STATUS_LABELS[inst.status] || inst.status}
                      </span>
                      {inst.last_tested && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                          Testato: {new Date(inst.last_tested).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => handleEditInstance(inst)}
                      style={{
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer',
                        fontSize: 11, color: 'var(--text-primary)',
                      }}
                      title="Modifica"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteInstance(inst.id)}
                      style={{
                        background: 'transparent', border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer',
                        fontSize: 11, color: 'var(--accent-red, #ef4444)',
                      }}
                      title="Elimina"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Intestazione catalogo ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>{t('connettore.catalogo')}</h2>
        <span className="badge badge-blue">{definitions.length} connettori</span>
      </div>

      {/* ── Filtri ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('connettore.cerca')}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ fontSize: 13 }}>
          <option value="">{t('connettore.tutte')}</option>
          {categories.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </div>

      {/* ── Griglia per categoria ── */}
      {categories.filter(c => !filterCategory || c === filterCategory).map(category => {
        const catConnectors = filtered.filter(d => d.category === category);
        if (catConnectors.length === 0) return null;
        return (
          <div key={category} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={CATEGORY_ICONS[category] || 'M12 2L2 7l10 5 10-5-10-5z'}/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{CATEGORY_LABELS[category] || category}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({catConnectors.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {catConnectors.map(conn => {
                const hasSchema = conn.configSchema && Object.keys(conn.configSchema).length > 0;
                const isConfigurable = hasSchema || conn.status === 'available';
                const instanceCount = instances.filter((i: any) => i.connector_id === conn.id).length;
                return (
                  <div
                    key={conn.id}
                    onClick={() => handleConnectorClick(conn)}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)', padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: conn.status === 'coming_soon' && !hasSchema ? 0.6 : 1,
                      cursor: isConfigurable ? 'pointer' : 'default',
                      transition: 'all var(--transition)',
                    }}
                    onMouseEnter={e => { if (isConfigurable) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-blue)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {conn.icon === 'openai' ? 'AI' :
                       conn.icon === 'anthropic' ? 'CL' :
                       conn.icon === 'gemini' ? 'GE' :
                       conn.icon === 'ollama' ? 'OL' :
                       conn.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conn.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                        {conn.status === 'available' || hasSchema ? (
                          <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>{t('connettore.disponibile')}</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('connettore.prossimamente')}</span>
                        )}
                        {instanceCount > 0 && (
                          <span style={{
                            fontSize: 10, background: 'var(--accent-blue)', color: '#fff',
                            borderRadius: 8, padding: '1px 6px', marginLeft: 2,
                          }}>
                            {instanceCount} config.
                          </span>
                        )}
                      </div>
                    </div>
                    {isConfigurable && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Modale configurazione ── */}
      {showModal && selectedDef && (
        <ConfigModal
          definition={selectedDef}
          instance={editingInstance}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ─── Modale di Configurazione ──────────────────────────────────

function ConfigModal({ definition, instance, onClose, onSaved }: {
  definition: any;
  instance: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const schema = definition.configSchema || {};
  const properties = schema.properties || {};
  const requiredFields: string[] = schema.required || [];

  const existingConfig = instance ? (typeof instance.config === 'string' ? JSON.parse(instance.config || '{}') : instance.config) : {};

  const [name, setName] = useState(instance?.name || definition.name);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties) as [string, any][]) {
      initial[key] = existingConfig[key] ?? prop.default ?? (prop.type === 'boolean' ? false : prop.type === 'number' ? '' : '');
    }
    return initial;
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    setTestResult(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const field of requiredFields) {
      const val = formData[field];
      if (val === undefined || val === null || val === '') {
        errs[field] = 'Campo obbligatorio';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTest = async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Build the config, converting number fields
      const config = buildConfig();
      if (instance) {
        const result = await connectorsApi.testInstance(instance.id);
        setTestResult(result);
      } else {
        const result = await connectorsApi.testConnection(definition.id, config);
        setTestResult(result);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Errore durante il test' });
    }
    setTesting(false);
  };

  const buildConfig = () => {
    const config: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties) as [string, any][]) {
      let val = formData[key];
      if (prop.type === 'number' && typeof val === 'string') {
        val = val === '' ? undefined : Number(val);
      }
      if (prop.type === 'boolean') {
        val = !!val;
      }
      if (val !== undefined && val !== '') {
        config[key] = val;
      }
    }
    return config;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const config = buildConfig();
      if (instance) {
        await connectorsApi.updateInstance(instance.id, { name, config });
      } else {
        await connectorsApi.createInstance({
          connector_id: definition.id,
          name,
          category: definition.category,
          config,
        });
      }
      onSaved();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Errore durante il salvataggio' });
    }
    setSaving(false);
  };

  const fieldEntries = Object.entries(properties) as [string, any][];
  const hasFields = fieldEntries.length > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary, #1a1a2e)',
        border: '1px solid var(--border-primary, #2a2a4a)',
        borderRadius: 'var(--radius-lg, 12px)',
        width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
        padding: 0,
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--border-primary, #2a2a4a)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--bg-tertiary, #252545)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 600, flexShrink: 0,
          }}>
            {definition.icon === 'openai' ? 'AI' :
             definition.icon === 'anthropic' ? 'CL' :
             definition.icon === 'gemini' ? 'GE' :
             definition.icon === 'ollama' ? 'OL' :
             definition.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {instance ? 'Modifica' : 'Configura'} {definition.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {definition.description}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, padding: '2px 6px', lineHeight: 1,
          }}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px' }}>
          {/* Nome istanza */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5, color: 'var(--text-secondary, #aaa)' }}>
              Nome istanza
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={definition.name}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                background: 'var(--bg-secondary, #16162a)', border: '1px solid var(--border-primary, #2a2a4a)',
                borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #eee)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Campi dinamici */}
          {hasFields ? (
            fieldEntries.map(([key, prop]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5,
                  color: 'var(--text-secondary, #aaa)',
                }}>
                  {prop.title || key}
                  {requiredFields.includes(key) && <span style={{ color: 'var(--accent-red, #ef4444)', marginLeft: 3 }}>*</span>}
                </label>
                {prop.type === 'boolean' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={!!formData[key]}
                      onChange={e => handleChange(key, e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ color: 'var(--text-primary, #eee)' }}>{prop.description || ''}</span>
                  </label>
                ) : prop.enum ? (
                  <select
                    value={formData[key] || ''}
                    onChange={e => handleChange(key, e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 13,
                      background: 'var(--bg-secondary, #16162a)', border: '1px solid var(--border-primary, #2a2a4a)',
                      borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #eee)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">-- Seleziona --</option>
                    {prop.enum.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={prop.format === 'password' ? 'password' : prop.type === 'number' ? 'number' : 'text'}
                    value={formData[key] ?? ''}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={prop.description || ''}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 13,
                      background: 'var(--bg-secondary, #16162a)', border: `1px solid ${errors[key] ? 'var(--accent-red, #ef4444)' : 'var(--border-primary, #2a2a4a)'}`,
                      borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #eee)',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
                {errors[key] && (
                  <div style={{ fontSize: 11, color: 'var(--accent-red, #ef4444)', marginTop: 3 }}>{errors[key]}</div>
                )}
                {prop.description && prop.type !== 'boolean' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{prop.description}</div>
                )}
              </div>
            ))
          ) : (
            <div style={{
              padding: 16, background: 'var(--bg-secondary, #16162a)',
              borderRadius: 'var(--radius-sm, 6px)', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              Questo connettore non richiede configurazione aggiuntiva.
              Sar&agrave; disponibile per l'uso immediato.
            </div>
          )}

          {/* Risultato test */}
          {testResult && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: 12, color: testResult.success ? 'var(--accent-green, #22c55e)' : 'var(--accent-red, #ef4444)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                {testResult.success ? '\u2713' : '\u2717'}
              </span>
              <span style={{ lineHeight: 1.4 }}>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--border-primary, #2a2a4a)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              background: 'var(--bg-tertiary, #252545)',
              border: '1px solid var(--border-primary, #2a2a4a)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '8px 16px', fontSize: 13, cursor: testing ? 'wait' : 'pointer',
              color: 'var(--text-primary, #eee)',
              opacity: testing ? 0.7 : 1,
            }}
          >
            {testing ? 'Test in corso...' : 'Testa Connessione'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border-primary, #2a2a4a)',
                borderRadius: 'var(--radius-sm, 6px)',
                padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'var(--accent-blue, #3b82f6)', border: 'none',
                borderRadius: 'var(--radius-sm, 6px)',
                padding: '8px 20px', fontSize: 13, cursor: saving ? 'wait' : 'pointer',
                color: '#fff', fontWeight: 500,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
