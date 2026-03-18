import { useState, useEffect } from 'react';
import { providersApi } from '../../api/providers.api';
import FolderPicker from '../common/FolderPicker';

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', fontSize: 12, background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: 0.8, marginBottom: 3, display: 'block',
};
const rowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 8, alignItems: 'center',
  padding: '6px 0', borderBottom: '1px solid var(--border-primary)',
};
const dotStyle = (ok: boolean | null | undefined): React.CSSProperties => ({
  width: 6, height: 6, borderRadius: '50%',
  background: ok === true ? '#6dab72' : ok === false ? '#d45555' : '#333a40',
  flexShrink: 0,
});

export default function ProviderSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [claudeStatus, setClaudeStatus] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [anthropicMode, setAnthropicMode] = useState<'api_key' | 'claude_cli'>('api_key');
  const [outputsDir, setOutputsDir] = useState('');
  const [outputsDirDefault, setOutputsDirDefault] = useState('');

  const load = async () => {
    const [s, p, cs] = await Promise.all([
      providersApi.getSettings(), providersApi.getAll(), providersApi.getClaudeStatus(),
    ]);
    setSettings(s); setProviders(p); setClaudeStatus(cs);
    setAnthropicMode(s.anthropic_mode || 'api_key');
    setOllamaUrl(s.ollama_base_url || 'http://localhost:11434');
    setOutputsDir(s.outputs_dir || '');
    setOutputsDirDefault(s.outputs_dir_default || '');
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    const data: any = { anthropic_mode: anthropicMode, ollama_base_url: ollamaUrl, outputs_dir: outputsDir || '' };
    if (openaiKey) data.openai_api_key = openaiKey;
    if (anthropicKey) data.anthropic_api_key = anthropicKey;
    if (geminiKey) data.gemini_api_key = geminiKey;
    const updated = await providersApi.saveSettings(data);
    setSettings(updated);
    setOpenaiKey(''); setAnthropicKey(''); setGeminiKey('');
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await load();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const r = await providersApi.test(id);
      setTestResults(prev => ({ ...prev, [id]: r.available }));
    } catch { setTestResults(prev => ({ ...prev, [id]: false })); }
    setTesting(null);
  };

  if (!settings) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>Caricamento...</div>;

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', maxWidth: 720 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Impostazioni</div>

      {/* ── Provider API Keys ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...labelStyle, marginBottom: 8, fontSize: 11 }}>Provider IA</div>

        {/* OpenAI */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={dotStyle(testResults.openai ?? (settings.openai_key_set ? true : null))} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>OpenAI</span>
          </div>
          <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
            placeholder={settings.openai_key_set ? `Configurata (${settings.openai_key_preview})` : 'sk-...'}
            style={fieldStyle} />
          <button onClick={() => handleTest('openai')} disabled={testing === 'openai'}
            style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', whiteSpace: 'nowrap' }}>
            {testing === 'openai' ? '...' : 'test'}
          </button>
        </div>

        {/* Anthropic */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={dotStyle(testResults.anthropic ?? (settings.anthropic_key_set || anthropicMode === 'claude_cli' ? true : null))} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Anthropic</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={anthropicMode} onChange={e => setAnthropicMode(e.target.value as any)}
              style={{ ...fieldStyle, width: 90, flexShrink: 0, padding: '6px 4px' }}>
              <option value="api_key">API Key</option>
              <option value="claude_cli">CLI</option>
            </select>
            {anthropicMode === 'api_key' ? (
              <input type="password" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)}
                placeholder={settings.anthropic_key_set ? `(${settings.anthropic_key_preview})` : 'sk-ant-...'}
                style={{ ...fieldStyle, flex: 1 }} />
            ) : (
              <span style={{ fontSize: 11, color: claudeStatus?.found ? '#6dab72' : '#d45555', flex: 1 }}>
                {claudeStatus?.found ? `CLI OK (${claudeStatus.version || claudeStatus.path})` : 'CLI non trovato'}
              </span>
            )}
          </div>
          <button onClick={() => handleTest('anthropic')} disabled={testing === 'anthropic'}
            style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
            {testing === 'anthropic' ? '...' : 'test'}
          </button>
        </div>

        {/* Gemini */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={dotStyle(testResults.gemini ?? (settings.gemini_key_set ? true : null))} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Gemini</span>
          </div>
          <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
            placeholder={settings.gemini_key_set ? `Configurata (${settings.gemini_key_preview})` : 'AIza...'}
            style={fieldStyle} />
          <button onClick={() => handleTest('gemini')} disabled={testing === 'gemini'}
            style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
            {testing === 'gemini' ? '...' : 'test'}
          </button>
        </div>

        {/* Ollama */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={dotStyle(testResults.ollama)} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Ollama</span>
          </div>
          <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434" style={fieldStyle} />
          <button onClick={() => handleTest('ollama')} disabled={testing === 'ollama'}
            style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
            {testing === 'ollama' ? '...' : 'test'}
          </button>
        </div>
      </div>

      {/* ── Models Available ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...labelStyle, marginBottom: 6, fontSize: 11 }}>Modelli Disponibili</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {providers.flatMap(p =>
            (p.models || []).slice(0, 5).map((m: any) => (
              <span key={`${p.id}-${m.id}`} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 3,
                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
              }}>
                {p.id}/{m.name}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── Output Directory ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...labelStyle, marginBottom: 6, fontSize: 11 }}>Sistema</div>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Output Dir</span>
          <FolderPicker value={outputsDir} onChange={setOutputsDir}
            placeholder={outputsDirDefault || 'Seleziona cartella output'} />
        </div>
        {outputsDirDefault && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, marginLeft: 118 }}>
            default: {outputsDirDefault}
          </div>
        )}
      </div>

      {/* ── Save ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-primary)' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
        {saved && <span style={{ fontSize: 11, color: '#6dab72' }}>Salvato</span>}
      </div>
    </div>
  );
}
