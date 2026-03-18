import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { schedulerApi } from '../../api/scheduler.api';
import { t } from '../../i18n/it';
import AIFieldAssist from '../common/AIFieldAssist';

const TRIGGERS = [
  { id: 'manual', label: 'Manuale' },
  { id: 'daily', label: 'Giornaliera' },
  { id: 'hourly', label: 'Ogni N ore' },
  { id: 'weekly', label: 'Settimanale' },
  { id: 'cron', label: 'Cron personalizzato' },
];

export default function SchedulePanel() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    if (!currentProjectId) return;
    setSchedules(await schedulerApi.getByProject(currentProjectId));
  };

  useEffect(() => { load(); }, [currentProjectId]);

  const handleCreate = async () => {
    if (!currentProjectId) return;
    await schedulerApi.create(currentProjectId, { name: 'Nuova Automazione' });
    await load();
  };

  const handleSave = async () => {
    if (!editing) return;
    await schedulerApi.update(editing.id, editing);
    setEditing(null);
    await load();
  };

  const handleTrigger = async (id: string) => {
    await schedulerApi.trigger(id);
    await load();
  };

  const handleDelete = async (id: string) => {
    await schedulerApi.delete(id);
    if (editing?.id === id) setEditing(null);
    await load();
  };

  if (!currentProjectId) return <div className="empty-state"><p>Seleziona un progetto</p></div>;

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Automazioni</h2>
        <button className="btn btn-primary" onClick={handleCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          {t('automazione.nuova')}
        </button>
      </div>

      {schedules.length === 0 && (
        <div className="empty-state"><p>{t('automazione.nessuna')}</p></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {schedules.map(s => (
          <div key={s.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)', padding: 16,
          }}>
            {editing?.id === s.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group">
                  <label>{t('automazione.nome')}</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  <div style={{ marginTop: 8 }}>
                    <AIFieldAssist
                      projectId={currentProjectId}
                      fieldLabel="Nome automazione"
                      fieldKind="short_text"
                      value={editing.name || ''}
                      onApply={(value) => setEditing({ ...editing, name: value })}
                      context={`Trigger: ${editing.trigger_type || 'manual'}`}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('automazione.trigger')}</label>
                  <select value={editing.trigger_type} onChange={e => setEditing({ ...editing, trigger_type: e.target.value })}>
                    {TRIGGERS.map(tr => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
                  </select>
                </div>
                {editing.trigger_type === 'cron' && (
                  <div className="form-group">
                    <label>Espressione Cron</label>
                    <input value={editing.cron_expr || ''} onChange={e => setEditing({ ...editing, cron_expr: e.target.value })} placeholder="0 * * * *" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{t('azione.salva')}</button>
                  <button className="btn btn-secondary" onClick={() => setEditing(null)}>{t('azione.annulla')}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span className="badge badge-blue">{TRIGGERS.find(tr => tr.id === s.trigger_type)?.label || s.trigger_type}</span>
                    <span className={`badge ${s.enabled ? 'badge-green' : 'badge-gray'}`}>{s.enabled ? 'Attiva' : 'Disattiva'}</span>
                  </div>
                  {s.last_run && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ultima esecuzione: {new Date(s.last_run).toLocaleString('it-IT')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleTrigger(s.id)} title={t('automazione.esegui')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </button>
                  <button className="btn-icon" onClick={() => setEditing({ ...s })}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(s.id)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
