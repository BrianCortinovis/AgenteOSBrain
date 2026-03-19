import { useState, useEffect, useRef } from 'react';
import { api, API_ORIGIN } from '../../api/client';
import { useUIStore } from '../../stores/useUIStore';

type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  type: string;
};

const shortcuts = [
  { label: 'Desktop', icon: '🖥', path: 'Desktop' },
  { label: 'Documents', icon: '📄', path: 'Documents' },
  { label: 'Apps', icon: '📱', path: 'Apps' },
  { label: 'Work', icon: '⚡', path: 'Work' },
  { label: 'Media', icon: '🎬', path: 'Media' },
];

const typeIcons: Record<string, string> = {
  folder: '📁', pdf: '📕', docx: '📘', xlsx: '📊', csv: '📊',
  jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼',
  mp4: '🎬', mp3: '🎵', js: '📜', ts: '📜', py: '🐍',
  html: '🌐', css: '🎨', json: '{}', md: '📝', txt: '📝',
};

function getIcon(e: FileEntry) { return e.isDirectory ? '📁' : (typeIcons[e.type] || '📄'); }
function fmtSize(b: number) { return b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}K` : `${(b/1048576).toFixed(1)}M`; }

export default function IAOSFileManager() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Inline prompt for file interaction
  const [promptFile, setPromptFile] = useState<FileEntry | null>(null);
  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptResult, setPromptResult] = useState('');
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const { openWindow, setFlowPendingFile } = useUIStore();

  // Load directory
  useEffect(() => {
    const params = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
    api.get<{ path: string; entries: FileEntry[] }>(`/flow/fs${params}`)
      .then(data => { setEntries(data.entries); if (!currentPath) setCurrentPath(data.path); })
      .catch(() => {});
  }, [currentPath]);

  useEffect(() => {
    api.get<any[]>('/flow/fs/recent?limit=8').then(setRecentFiles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(() => {
      api.get<any[]>(`/flow/fs/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const navigate = (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      setSearchResults(null);
      setSearchQuery('');
      setPromptFile(null);
    } else {
      // Click on file → show inline prompt
      setPromptFile(entry);
      setPromptText('');
      setPromptResult('');
    }
  };

  // Send file to FLOW with prompt
  const handlePromptSend = async () => {
    if (!promptFile || !promptText.trim()) return;
    setPromptLoading(true);
    setPromptResult('');
    try {
      // Read file content from backend
      const fileData = await api.get<{ content: string }>(`/flow/fs/read?path=${encodeURIComponent(promptFile.path)}`);
      const res = await api.post<{ content: string }>('/ai/flow', {
        message: promptText,
        file_content: fileData.content,
        file_name: promptFile.name,
        provider_id: 'openai',
        model_id: 'gpt-4o',
      });
      setPromptResult(res.content);
    } catch (err: any) {
      setPromptResult(`Errore: ${err.message}`);
    } finally {
      setPromptLoading(false);
    }
  };

  // Upload files to current directory
  const handleUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api.post('/flow/fs/upload', {
            file_name: file.name,
            file_content: reader.result as string,
            target_dir: currentPath,
          });
          // Refresh
          const params = `?path=${encodeURIComponent(currentPath)}`;
          const data = await api.get<{ entries: FileEntry[] }>(`/flow/fs${params}`);
          setEntries(data.entries);
        } catch {}
      };
      reader.readAsText(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const flowRoot = currentPath.split('/FLOW/')[0] + '/FLOW';
  const relativePath = currentPath.replace(flowRoot, '').replace(/^\//, '');
  const pathParts = relativePath ? relativePath.split('/') : [];
  const displayEntries = searchResults || entries;

  return (
    <div style={{ display: 'flex', height: '100%', color: 'var(--text-primary)' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <div style={{ width: 150, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '12px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0 12px 8px', fontSize: 9, color: 'rgba(224,230,240,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Preferiti</div>
        {shortcuts.map(s => (
          <div key={s.path} onClick={() => setCurrentPath(`${flowRoot}/${s.path}`)}
            style={{ padding: '5px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              background: relativePath.startsWith(s.path) ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: relativePath.startsWith(s.path) ? 'var(--text-primary)' : 'rgba(224,230,240,0.5)' }}>
            <span>{s.icon}</span><span>{s.label}</span>
          </div>
        ))}
        <div style={{ padding: '12px 12px 6px', fontSize: 9, color: 'rgba(224,230,240,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Recenti</div>
        {recentFiles.slice(0, 5).map((f, i) => (
          <div key={i} onClick={() => { setPromptFile({ name: f.name, path: f.path, isDirectory: false, size: f.size, modified: '', type: f.type }); setPromptText(''); setPromptResult(''); }}
            style={{ padding: '3px 12px', cursor: 'pointer', fontSize: 10, color: 'rgba(224,230,240,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Drag overlay */}
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,50,30,0.05)', border: '2px dashed rgba(220,50,30,0.3)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
            fontSize: 14, color: 'rgba(220,50,30,0.6)' }}>
            Rilascia i file qui per caricarli in {relativePath || 'FLOW'}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flex: 1 }}>
            <span onClick={() => setCurrentPath(flowRoot)} style={{ cursor: 'pointer', color: 'rgba(224,230,240,0.4)' }}>FLOW</span>
            {pathParts.map((part, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>/</span>
                <span onClick={() => setCurrentPath(`${flowRoot}/${pathParts.slice(0, i + 1).join('/')}`)}
                  style={{ cursor: 'pointer', color: i === pathParts.length - 1 ? 'var(--text-primary)' : 'rgba(224,230,240,0.4)' }}>{part}</span>
              </span>
            ))}
          </div>
          {/* Upload button */}
          <button onClick={() => fileUploadRef.current?.click()} style={{
            padding: '4px 10px', fontSize: 10, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(224,230,240,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Upload
          </button>
          <input ref={fileUploadRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleUpload(e.target.files)} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cerca..."
            style={{ width: 150, padding: '4px 10px', fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'var(--text-primary)', outline: 'none' }} />
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            style={{ background: 'none', border: 'none', color: 'rgba(224,230,240,0.4)', cursor: 'pointer', fontSize: 14 }}>
            {viewMode === 'grid' ? '☰' : '⊞'}
          </button>
        </div>

        {/* File grid/list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {displayEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(224,230,240,0.2)', fontSize: 13 }}>
              {searchQuery ? 'Nessun risultato' : 'Cartella vuota — trascina file qui per caricarli'}
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
              {displayEntries.map((entry, i) => (
                <div key={i} onClick={() => navigate(entry)}
                  style={{ padding: '10px 6px', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: promptFile?.path === entry.path ? 'rgba(220,50,30,0.08)' : 'rgba(255,255,255,0.02)',
                    border: promptFile?.path === entry.path ? '1px solid rgba(220,50,30,0.2)' : '1px solid transparent', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (promptFile?.path !== entry.path) (e.currentTarget).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (promptFile?.path !== entry.path) (e.currentTarget).style.background = 'rgba(255,255,255,0.02)'; }}>
                  <span style={{ fontSize: 24 }}>{getIcon(entry)}</span>
                  <span style={{ fontSize: 9, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3, color: 'rgba(224,230,240,0.7)', maxWidth: '100%' }}>{entry.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {displayEntries.map((entry, i) => (
                <div key={i} onClick={() => navigate(entry)}
                  style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 4,
                    background: promptFile?.path === entry.path ? 'rgba(220,50,30,0.06)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.background = promptFile?.path === entry.path ? 'rgba(220,50,30,0.06)' : 'transparent'; }}>
                  <span style={{ fontSize: 14 }}>{getIcon(entry)}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'rgba(224,230,240,0.8)' }}>{entry.name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(224,230,240,0.3)', minWidth: 50, textAlign: 'right' }}>{entry.isDirectory ? '' : fmtSize(entry.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inline prompt panel — appears when file is clicked */}
        {promptFile && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', background: 'rgba(10,12,18,0.7)', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{getIcon(promptFile)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(224,230,240,0.8)', flex: 1 }}>{promptFile.name}</span>
              {/* Quick actions */}
              <button onClick={() => { setPromptText('Fai un riassunto dettagliato'); setTimeout(handlePromptSend, 100); }}
                style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(224,230,240,0.5)', cursor: 'pointer' }}>
                Riassumi
              </button>
              <button onClick={() => { setPromptText('Traduci in inglese'); setTimeout(handlePromptSend, 100); }}
                style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(224,230,240,0.5)', cursor: 'pointer' }}>
                Traduci
              </button>
              <button onClick={() => { setPromptText('Analizza i dati e estrai le informazioni chiave'); setTimeout(handlePromptSend, 100); }}
                style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(224,230,240,0.5)', cursor: 'pointer' }}>
                Analizza
              </button>
              <button onClick={() => openWindow('file-viewer', promptFile.name, { filePath: promptFile.path, fileName: promptFile.name })}
                style={{ padding: '3px 8px', fontSize: 10, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(224,230,240,0.5)', cursor: 'pointer' }}>
                Apri
              </button>
              <button onClick={() => setPromptFile(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(224,230,240,0.3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {/* Custom prompt input */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={promptText} onChange={e => setPromptText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePromptSend()}
                placeholder={`Cosa vuoi fare con ${promptFile.name}?`}
                disabled={promptLoading}
                style={{ flex: 1, padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none' }} />
              <button onClick={handlePromptSend} disabled={!promptText.trim() || promptLoading}
                style={{ padding: '6px 14px', fontSize: 11, borderRadius: 8, background: 'rgba(220,50,30,0.15)', border: '1px solid rgba(220,50,30,0.2)', color: 'rgba(220,70,50,0.8)', cursor: 'pointer', opacity: !promptText.trim() || promptLoading ? 0.3 : 1 }}>
                {promptLoading ? '...' : 'Invia'}
              </button>
            </div>
            {/* Result */}
            {promptResult && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12, lineHeight: 1.6, color: 'rgba(224,230,240,0.7)', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {promptResult}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
