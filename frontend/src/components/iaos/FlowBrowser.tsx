/**
 * FlowBrowser — launcher per il browser di sistema (Chrome/Safari/ecc.)
 * Apre gli URL nel browser esterno dell'utente.
 * Il backend /browser/fetch rimane disponibile per l'IA.
 */
import { useState, useCallback } from 'react';
import { api } from '../../api/client';

const BOOKMARKS = [
  { label: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { label: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { label: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { label: 'Wikipedia', url: 'https://it.wikipedia.org', icon: '📖' },
  { label: 'ChatGPT', url: 'https://chatgpt.com', icon: '💬' },
  { label: 'Maps', url: 'https://maps.google.com', icon: '🗺️' },
  { label: 'Translate', url: 'https://translate.google.com', icon: '🌐' },
  { label: 'HackerNews', url: 'https://news.ycombinator.com', icon: '📰' },
  { label: 'MDN', url: 'https://developer.mozilla.org', icon: '📚' },
  { label: 'NPM', url: 'https://npmjs.com', icon: '📦' },
  { label: 'Claude', url: 'https://claude.ai', icon: '🤖' },
  { label: 'Figma', url: 'https://figma.com', icon: '🎨' },
];

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function FlowBrowser({ initialUrl }: { initialUrl?: string }) {
  const [input, setInput] = useState(initialUrl || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [history, setHistory] = useState<{label:string;url:string}[]>([]);

  const go = useCallback((rawUrl?: string) => {
    let url = (rawUrl || input).trim();
    if (!url) return;
    // If it's a search query (no http, no dot-tld pattern), search Google
    if (!/^https?:\/\//i.test(url) && !/(^|\s)\S+\.\S{2,}(\s|$)/.test(url)) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    setInput(url);
    openExternal(url);
    setHistory(prev => [{ label: url.replace(/^https?:\/\//,'').split('/')[0], url }, ...prev.filter(h=>h.url!==url)].slice(0,10));
  }, [input]);

  const readForAI = async (url: string) => {
    if (!url) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await api.get<{content:string}>(`/browser/fetch?url=${encodeURIComponent(url)}`);
      setAiResult(res.content?.slice(0, 2500) || 'Nessun contenuto');
    } catch (e: any) {
      setAiResult(`Errore: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const btn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8,
    transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#070a14', color: 'rgba(224,230,240,0.85)' }}>

      {/* ── URL Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        background: 'rgba(5,8,18,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,200,255,0.08)', flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && go()}
          onFocus={e => e.currentTarget.select()}
          placeholder="Cerca su Google o inserisci URL..."
          style={{
            flex: 1, padding: '7px 14px', fontSize: 13,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.12)',
            borderRadius: 10, color: 'rgba(224,230,240,0.9)', outline: 'none',
          }}
        />
        <button onClick={() => go()}
          style={{
            padding: '7px 18px', fontSize: 12, borderRadius: 9, cursor: 'pointer',
            background: 'rgba(220,50,30,0.18)', border: '1px solid rgba(220,50,30,0.3)',
            color: 'rgba(220,80,50,1)', fontWeight: 700, whiteSpace: 'nowrap',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget).style.background = 'rgba(220,50,30,0.32)'}
          onMouseLeave={e => (e.currentTarget).style.background = 'rgba(220,50,30,0.18)'}
        >Apri in Chrome ↗</button>
        <button
          onClick={() => readForAI(input.startsWith('http') ? input : `https://${input}`)}
          disabled={aiLoading || !input.trim()}
          title="Leggi il contenuto per l'IA"
          style={{
            padding: '7px 12px', fontSize: 11, borderRadius: 9, cursor: aiLoading ? 'default' : 'pointer',
            background: 'rgba(0,180,220,0.1)', border: '1px solid rgba(0,180,220,0.2)',
            color: 'rgba(0,210,255,0.8)', fontWeight: 600, whiteSpace: 'nowrap',
            opacity: aiLoading ? 0.5 : 1, transition: 'all 0.12s',
          }}
        >{aiLoading ? '...' : '🤖 Leggi per IA'}</button>
      </div>

      {/* ── AI Result ── */}
      {aiResult && (
        <div style={{
          padding: '8px 14px', background: 'rgba(0,180,220,0.06)',
          borderBottom: '1px solid rgba(0,180,220,0.1)',
          fontSize: 11, color: 'rgba(180,220,240,0.75)', lineHeight: 1.6,
          maxHeight: 130, overflowY: 'auto', flexShrink: 0,
          display: 'flex', gap: 8,
        }}>
          <span style={{ flexShrink: 0, color: 'rgba(0,210,255,0.5)' }}>🤖</span>
          <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiResult}</span>
          <button onClick={() => setAiResult('')}
            style={{ ...btn, color: 'rgba(255,255,255,0.3)', fontSize: 12, flexShrink: 0, padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Bookmarks grid */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(0,200,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>Link rapidi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {BOOKMARKS.map(b => (
              <div key={b.url}
                onClick={() => go(b.url)}
                style={{
                  padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.08)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(0,200,255,0.08)'; (e.currentTarget).style.borderColor = 'rgba(0,200,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget).style.borderColor = 'rgba(0,200,255,0.08)'; }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{b.icon}</div>
                <div style={{ fontSize: 10, color: 'rgba(200,220,240,0.6)', fontWeight: 500 }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(0,200,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>Recenti</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map((h, i) => (
                <div key={i}
                  onClick={() => go(h.url)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget).style.background = 'rgba(0,200,255,0.06)'}
                  onMouseLeave={e => (e.currentTarget).style.background = 'rgba(255,255,255,0.025)'}
                >
                  <span style={{ fontSize: 14 }}>🌐</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(200,220,240,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(0,200,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(0,200,255,0.4)' }}>↗</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{
          marginTop: 20, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(0,180,220,0.04)', border: '1px solid rgba(0,180,220,0.1)',
          fontSize: 11, color: 'rgba(0,200,255,0.4)', lineHeight: 1.6,
        }}>
          <strong style={{ color: 'rgba(0,210,255,0.6)' }}>Browser esterno</strong><br/>
          Gli URL vengono aperti in Chrome o nel browser predefinito di sistema.<br/>
          Usa <strong>"🤖 Leggi per IA"</strong> per estrarre il contenuto di una pagina e inviarlo alla chat FLOW.
        </div>
      </div>
    </div>
  );
}
