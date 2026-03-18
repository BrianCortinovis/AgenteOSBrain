import { useState, useEffect } from 'react';
import { workspaceApi } from '../../api/workspace.api';
import { toolsApi, ToolDefinition } from '../../api/tools.api';
import { memoryApi, MemoryEntry } from '../../api/memory.api';
import { skillsApi, Skill } from '../../api/skills.api';

const ACCENT = '#e8533c';

export default function WorkspaceSettings() {
  const [soul, setSoul] = useState('');
  const [identity, setIdentity] = useState('');
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'soul' | 'tools' | 'skills' | 'memory'>('soul');
  const [skillFilter, setSkillFilter] = useState('all');
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', description: '', category: 'general', content: '' });

  const load = async () => {
    const config = await workspaceApi.getAll();
    setSoul(config.soul || '');
    setIdentity(config.identity || 'Agent OS Brain');
    const [t, s] = await Promise.all([toolsApi.getAll(), skillsApi.getAll()]);
    setTools(t);
    setSkills(s);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    await workspaceApi.set('soul', soul);
    await workspaceApi.set('identity', identity);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggleTool = async (tool: ToolDefinition) => {
    const updated = await toolsApi.toggle(tool.id, !tool.enabled);
    setTools(prev => prev.map(t => t.id === updated.id ? { ...t, enabled: updated.enabled } : t));
  };

  const handleToggleSkill = async (skill: Skill) => {
    const updated = await skillsApi.toggle(skill.id, !skill.enabled);
    setSkills(prev => prev.map(s => s.id === updated.id ? { ...s, enabled: updated.enabled } : s));
  };

  const handleDeleteSkill = async (id: string) => {
    await skillsApi.delete(id);
    setSkills(prev => prev.filter(s => s.id !== id));
  };

  const handleInstallSkill = async () => {
    if (!newSkill.name.trim() || !newSkill.content.trim()) return;
    const installed = await skillsApi.install(newSkill);
    setSkills(prev => [...prev, installed]);
    setNewSkill({ name: '', description: '', category: 'general', content: '' });
    setNewSkillOpen(false);
  };

  const handleSearchMemory = async () => {
    if (!memorySearch.trim()) return;
    const results = await memoryApi.search(memorySearch);
    setMemories(results);
  };

  const handleDeleteMemory = async (id: string) => {
    await memoryApi.delete(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const skillCategories = [...new Set(skills.map(s => s.category))].sort();
  const filteredSkills = skillFilter === 'all' ? skills : skills.filter(s => s.category === skillFilter);

  const tabs = [
    { key: 'soul' as const, label: 'Personalita' },
    { key: 'tools' as const, label: 'Strumenti' },
    { key: 'skills' as const, label: `Skills (${skills.length})` },
    { key: 'memory' as const, label: 'Memoria' },
  ];

  return (
    <div style={{ padding: '16px 20px', maxWidth: 820, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Workspace</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 16, borderBottom: '1px solid var(--border-primary)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 14px', background: 'transparent',
              color: activeTab === tab.key ? ACCENT : 'var(--text-muted)',
              border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${ACCENT}` : '2px solid transparent',
              cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SOUL ── */}
      {activeTab === 'soul' && (
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Identita</label>
          <input value={identity} onChange={e => setIdentity(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 12 }} placeholder="Nome del sistema..." />

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Personalita (SOUL) — iniettata in ogni chiamata AI
          </label>
          <textarea value={soul} onChange={e => setSoul(e.target.value)} rows={8}
            style={{ width: '100%', padding: 10, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Descrivi personalita, tono e comportamento..." />

          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {saving ? '...' : 'Salva'}
            </button>
            {saved && <span style={{ color: '#6dab72', fontSize: 11 }}>Salvato</span>}
          </div>
        </div>
      )}

      {/* ── TOOLS ── */}
      {activeTab === 'tools' && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 12 }}>
            Azioni concrete che gli agenti possono eseguire. Attiva/disattiva per controllare cosa possono fare.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tools.map(tool => (
              <div key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <button onClick={() => handleToggleTool(tool)}
                  style={{ width: 34, height: 18, borderRadius: 9, border: 'none', background: tool.enabled ? ACCENT : 'var(--border-secondary)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: tool.enabled ? 18 : 2, transition: 'left 0.15s' }} />
                </button>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tool.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{tool.description}</span>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 3 }}>{tool.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SKILLS ── */}
      {activeTab === 'skills' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
              Conoscenze specializzate iniettate automaticamente negli agenti quando il contesto e rilevante.
            </p>
            <button onClick={() => setNewSkillOpen(!newSkillOpen)}
              style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none', flexShrink: 0 }}>
              + Nuova Skill
            </button>
          </div>

          {/* New skill form */}
          {newSkillOpen && (
            <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-primary)', marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome skill" style={{ fontSize: 12, padding: '5px 8px' }} />
                <select value={newSkill.category} onChange={e => setNewSkill(p => ({ ...p, category: e.target.value }))}
                  style={{ fontSize: 12, padding: '5px 8px' }}>
                  <option value="general">Generale</option>
                  <option value="documenti">Documenti</option>
                  <option value="analisi">Analisi</option>
                  <option value="marketing">Marketing</option>
                  <option value="comunicazione">Comunicazione</option>
                  <option value="codice">Codice</option>
                  <option value="siti-web">Siti Web</option>
                  <option value="legale">Legale</option>
                  <option value="finanza">Finanza</option>
                  <option value="hr">HR</option>
                </select>
              </div>
              <input value={newSkill.description} onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
                placeholder="Descrizione breve" style={{ width: '100%', fontSize: 12, padding: '5px 8px', marginBottom: 8 }} />
              <textarea value={newSkill.content} onChange={e => setNewSkill(p => ({ ...p, content: e.target.value }))}
                placeholder="Istruzioni della skill (cosa deve sapere fare l'agente)..." rows={5}
                style={{ width: '100%', fontSize: 11, padding: 8, fontFamily: 'monospace', lineHeight: 1.4, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleInstallSkill}
                  style={{ padding: '5px 14px', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: ACCENT, color: '#fff', border: 'none' }}>
                  Installa
                </button>
                <button onClick={() => setNewSkillOpen(false)}
                  style={{ padding: '5px 14px', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setSkillFilter('all')}
              style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: skillFilter === 'all' ? ACCENT : 'var(--bg-tertiary)', color: skillFilter === 'all' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-primary)' }}>
              Tutte ({skills.length})
            </button>
            {skillCategories.map(cat => (
              <button key={cat} onClick={() => setSkillFilter(cat)}
                style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: skillFilter === cat ? ACCENT : 'var(--bg-tertiary)', color: skillFilter === cat ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-primary)' }}>
                {cat} ({skills.filter(s => s.category === cat).length})
              </button>
            ))}
          </div>

          {/* Skills list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredSkills.map(skill => (
              <div key={skill.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <button onClick={() => handleToggleSkill(skill)}
                  style={{ width: 34, height: 18, borderRadius: 9, border: 'none', background: skill.enabled ? '#6dab72' : 'var(--border-secondary)', cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 2 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: skill.enabled ? 18 : 2, transition: 'left 0.15s' }} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{skill.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 3 }}>{skill.category}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{skill.description}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'monospace', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {skill.content.slice(0, 100)}...
                  </div>
                </div>
                <button onClick={() => handleDeleteSkill(skill.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>
                  &times;
                </button>
              </div>
            ))}
            {filteredSkills.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: 24 }}>Nessuna skill in questa categoria</div>
            )}
          </div>
        </div>
      )}

      {/* ── MEMORY ── */}
      {activeTab === 'memory' && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 12 }}>
            Memoria persistente. Gli agenti salvano e recuperano informazioni qui automaticamente.
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input value={memorySearch} onChange={e => setMemorySearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchMemory()}
              placeholder="Cerca nella memoria..." style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} />
            <button onClick={handleSearchMemory}
              style={{ padding: '6px 14px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
              Cerca
            </button>
          </div>
          {memories.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: 32 }}>
              {memorySearch ? 'Nessun risultato' : 'Cerca per visualizzare le memorie'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {memories.map(mem => (
              <div key={mem.id} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>{mem.summary || mem.content.slice(0, 150)}</div>
                  <button onClick={() => handleDeleteMemory(mem.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>&times;</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {mem.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 9, color: ACCENT, background: `${ACCENT}15`, padding: '1px 5px', borderRadius: 3 }}>{tag}</span>
                  ))}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>imp: {mem.importance.toFixed(1)}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(mem.created_at).toLocaleDateString('it-IT')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
