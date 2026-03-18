import { useEffect, useState } from 'react';
import { aiApi } from '../../api/ai.api';
import { providersApi } from '../../api/providers.api';

type Props = {
  projectId?: string | null;
  fieldLabel: string;
  fieldKind?: 'system_prompt' | 'short_text' | 'long_text';
  value: string;
  onApply: (value: string) => void;
  preferredProviderId?: string;
  preferredModelId?: string;
  context?: string;
  buttonLabel?: string;
};

export default function AIFieldAssist({
  projectId,
  fieldLabel,
  fieldKind = 'long_text',
  value,
  onApply,
  preferredProviderId,
  preferredModelId,
  context,
  buttonLabel = 'AI',
}: Props) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [providerId, setProviderId] = useState(preferredProviderId || 'anthropic');
  const [modelId, setModelId] = useState(preferredModelId || 'claude-cli');

  useEffect(() => {
    if (!open) return;
    providersApi.getAll().then((data) => {
      setProviders(data);
      const available = data.filter((provider: any) => provider.available);
      const currentProvider = available.find((provider: any) => provider.id === (preferredProviderId || providerId)) || available[0];
      if (currentProvider) {
        setProviderId(currentProvider.id);
        setModelId(preferredModelId || currentProvider.models?.[0]?.id || '');
      }
    }).catch(() => {});
  }, [open, preferredProviderId, preferredModelId]);

  useEffect(() => {
    setProviderId(preferredProviderId || 'anthropic');
  }, [preferredProviderId]);

  useEffect(() => {
    setModelId(preferredModelId || 'claude-cli');
  }, [preferredModelId]);

  const currentModels = providers.find((provider) => provider.id === providerId)?.models || [];

  const generate = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    try {
      const response = await aiApi.assistField({
        project_id: projectId,
        provider_id: providerId,
        model_id: modelId,
        field_label: fieldLabel,
        field_kind: fieldKind,
        current_value: value,
        instruction,
        context,
      });
      setDraft(response.content);
    } catch (err: any) {
      alert(`Errore assistenza IA: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!draft.trim()) return;
    onApply(draft);
    setOpen(false);
  };

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => {
        setDraft(value || '');
        setInstruction('');
        setOpen(true);
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        </svg>
        {buttonLabel}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 8, 18, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 24,
        }}>
          <div style={{
            width: 'min(760px, 100%)',
            maxHeight: '90vh',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Assistente IA campo</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{fieldLabel}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Chiudi</button>
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div className="form-group">
                  <label>Provider</label>
                  <select value={providerId} onChange={(e) => {
                    const nextProvider = e.target.value;
                    setProviderId(nextProvider);
                    const provider = providers.find((item) => item.id === nextProvider);
                    setModelId(provider?.models?.[0]?.id || '');
                  }}>
                    {providers.filter((provider) => provider.available).map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Modello</label>
                  <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                    {currentModels.map((model: any) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Istruzione</label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={4}
                  placeholder="Esempio: rendi questo system prompt più rigoroso, con output chiaro e regole operative più forti."
                />
              </div>

              <div className="form-group">
                <label>Valore corrente</label>
                <textarea value={value} readOnly rows={5} style={{ opacity: 0.8 }} />
              </div>

              <div className="form-group">
                <label>Bozza IA</label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  placeholder="Qui comparirà il testo proposto dal modello."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button className="btn btn-secondary" onClick={generate} disabled={loading || !instruction.trim()}>
                  {loading ? 'Generazione...' : 'Genera testo'}
                </button>
                <button className="btn btn-primary" onClick={apply} disabled={!draft.trim()}>
                  Applica al campo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
