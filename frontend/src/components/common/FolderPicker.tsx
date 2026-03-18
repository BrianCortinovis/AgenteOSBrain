import { useState, useEffect } from 'react';
import { API_ORIGIN } from '../../api/client';

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
}

export default function FolderPicker({ value, onChange, placeholder }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = async (dir: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/browse-folders?path=${encodeURIComponent(dir)}`);
      const data = await res.json();
      setBrowsePath(data.path);
      setFolders(data.folders || []);
      setParent(data.parent || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) browse(value || '');
  }, [open]);

  const handleSelect = () => {
    onChange(browsePath);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '/percorso/cartella'}
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-input)',
            border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => setOpen(!open)}
          title="Sfoglia cartelle"
          style={{
            padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          Sfoglia
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border-secondary)',
          borderRadius: 8, padding: 8, zIndex: 100, boxShadow: 'var(--shadow-lg)',
          maxHeight: 320, display: 'flex', flexDirection: 'column',
        }}>
          {/* Current path */}
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', padding: '4px 6px', marginBottom: 4,
            background: 'var(--bg-input)', borderRadius: 4, wordBreak: 'break-all',
          }}>
            {browsePath || '...'}
          </div>

          {/* Folder list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200 }}>
            {parent && (
              <button onClick={() => browse(parent)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                background: 'transparent', border: 'none', color: 'var(--accent-blue)',
                fontSize: 11, textAlign: 'left',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                ..
              </button>
            )}
            {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>Caricamento...</div>}
            {!loading && folders.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>Nessuna sottocartella</div>
            )}
            {folders.map(f => (
              <button key={f.path} onClick={() => browse(f.path)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                background: 'transparent', border: 'none', color: 'var(--text-primary)',
                fontSize: 11, textAlign: 'left',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                {f.name}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
            <button onClick={handleSelect} style={{
              flex: 1, padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              fontWeight: 600, background: 'var(--accent-blue)', color: '#fff', border: 'none',
            }}>
              Seleziona questa cartella
            </button>
            <button onClick={() => setOpen(false)} style={{
              padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
