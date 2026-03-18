import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { promptsApi } from '../../api/prompts.api';
import { t } from '../../i18n/it';
import AIFieldAssist from '../common/AIFieldAssist';

const SCOPES = [
  { id: 'global', label: 'Globale' },
  { id: 'project', label: 'Progetto' },
  { id: 'node', label: 'Nodo' },
];

export default function PromptManager() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [filterScope, setFilterScope] = useState<string>('');

  const load = async () => {
    const data = await promptsApi.getAll(filterScope || undefined);
    setPrompts(data);
  };

  useEffect(() => { load(); }, [filterScope]);

  const handleCreate = async () => {
    await promptsApi.create({
      name: 'Nuovo Prompt',
      scope: 'global',
      scope_id: currentProjectId || '',
      content: '',
    });
    await load();
  };

  const handleSave = async () => {
    if (!editing) return;
    await promptsApi.update(editing.id, editing);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    await promptsApi.delete(id);
    if (editing?.id === id) setEditing(null);
    await load();
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Prompt di Sistema</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filterScope} onChange={e => setFilterScope(e.target.value)} style={{ fontSize: 12 }}>
            <option value="">Tutti</option>
            {SCOPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleCreate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            {t('prompt.nuovo')}
          </button>
        </div>
      </div>

      {prompts.length === 0 && (
        <div className="empty-state"><p>{t('prompt.nessuno')}</p></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {prompts.map(p => (
          <div key={p.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)', padding: 16,
          }}>
            {editing?.id === p.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>{t('prompt.nome')}</label>
                    <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    <div style={{ marginTop: 8 }}>
                      <AIFieldAssist
                        projectId={currentProjectId}
                        fieldLabel="Nome prompt"
                        fieldKind="short_text"
                        value={editing.name || ''}
                        onApply={(value) => setEditing({ ...editing, name: value })}
                        context={`Scope: ${editing.scope || 'global'}`}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ width: 140 }}>
                    <label>{t('prompt.scope')}</label>
                    <select value={editing.scope} onChange={e => setEditing({ ...editing, scope: e.target.value })}>
                      {SCOPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('prompt.contenuto')}</label>
                  <textarea
                    value={editing.content}
                    onChange={e => setEditing({ ...editing, content: e.target.value })}
                    rows={10}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <AIFieldAssist
                      projectId={currentProjectId}
                      fieldLabel="Contenuto prompt"
                      fieldKind="system_prompt"
                      value={editing.content || ''}
                      onApply={(value) => setEditing({ ...editing, content: value })}
                      context={`Nome prompt: ${editing.name || ''}\nScope: ${editing.scope || 'global'}`}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{t('azione.salva')}</button>
                  <button className="btn btn-secondary" onClick={() => setEditing(null)}>{t('azione.annulla')}</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className="badge badge-blue">{SCOPES.find(s => s.id === p.scope)?.label || p.scope}</span>
                      {p.category !== 'generale' && <span className="badge badge-gray">{p.category}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => setEditing({ ...p })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(p.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                    </button>
                  </div>
                </div>
                {p.content && (
                  <div style={{
                    marginTop: 8, padding: 10, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
                    maxHeight: 100, overflow: 'hidden', whiteSpace: 'pre-wrap',
                  }}>
                    {p.content}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
