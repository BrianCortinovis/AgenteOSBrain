import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { providersApi } from '../../api/providers.api';
import { t } from '../../i18n/it';

export default function ChatPanel() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const { messages, loading, sendMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('claude-cli');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    providersApi.getAll().then(p => {
      setProviders(p);
      // Default to first available provider
      const available = p.filter((pr: any) => pr.available);
      if (available.length > 0) {
        const anthro = available.find((pr: any) => pr.id === 'anthropic');
        if (anthro) {
          setSelectedProvider('anthropic');
          setSelectedModel(anthro.models[0]?.id || 'claude-cli');
        } else {
          setSelectedProvider(available[0].id);
          setSelectedModel(available[0].models[0]?.id || '');
        }
      }
    }).catch(() => {});
  }, []);

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const models = currentProvider?.models || [];

  const handleSend = async () => {
    if (!input.trim() || !currentProjectId || loading) return;
    const msg = input;
    setInput('');
    await sendMessage(currentProjectId, msg, selectedProvider, selectedModel);
  };

  return (
    <div style={{
      width: 380, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border-primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Chat Copilot</span>
        </div>
        <button
          className="btn-icon"
          onClick={() => currentProjectId && clearHistory(currentProjectId)}
          title={t('chat.cancella')}
          style={{ opacity: 0.5 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
          </svg>
        </button>
      </div>

      {/* Model Selector */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border-primary)',
        display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-tertiary)',
      }}>
        <select
          value={selectedProvider}
          onChange={e => {
            const pId = e.target.value;
            setSelectedProvider(pId);
            const prov = providers.find(p => p.id === pId);
            if (prov?.models?.length > 0) setSelectedModel(prov.models[0].id);
          }}
          style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4, minWidth: 90 }}
        >
          {providers.filter(p => p.available).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4, flex: 1, minWidth: 0 }}
        >
          {models.map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <span className={`status-dot ${currentProvider?.available ? 'completato' : 'bloccato'}`} title={currentProvider?.available ? 'Connesso' : 'Non connesso'} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p style={{ fontSize: 12 }}>{t('chat.vuota')}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
          }}>
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              {msg.role === 'user' ? 'Tu' : 'Assistente'}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
            <span className="status-dot in_esecuzione" style={{ display: 'inline-block', marginRight: 6 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Elaborazione...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--border-primary)',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={t('chat.placeholder')}
          style={{ flex: 1, fontSize: 13 }}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading || !input.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
