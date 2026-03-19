import React, { useState, useRef, useCallback } from 'react';

interface FileEntry { file: File; id: string; }
interface Result { html: string; savedPath: string; filesProcessed: number; imagesFound: number; }

export default function DocumentAnalyzer() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const addFiles = (newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map(f => ({ file: f, id: Math.random().toString(36).slice(2) }));
    setFiles(prev => [...prev, ...entries]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.files);
    addFiles(items);
  }, []);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return '🖼';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['txt','md'].includes(ext)) return '📃';
    if (['csv','xlsx','xls'].includes(ext)) return '📊';
    return '📎';
  };

  const analyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    setProgress('Lettura documenti...');

    try {
      const form = new FormData();
      for (const { file } of files) form.append('files', file, file.name);

      setProgress('Analisi AI in corso — potrebbe richiedere qualche minuto...');

      const res = await fetch('/api/v1/docanalyzer/analyze', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore analisi');
      }

      const data = await res.json();
      setResult(data);
      setProgress('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadHtml = () => {
    if (!result) return;
    const blob = new Blob([result.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `articolo_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInBrowser = () => {
    if (!result) return;
    const blob = new Blob([result.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const s = styles;

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>📰</span>
          <div>
            <div style={s.headerTitle}>Document Analyzer</div>
            <div style={s.headerSub}>Carica documenti → Analisi AI → Articolo giornalistico HTML</div>
          </div>
        </div>
        <div style={s.headerStats}>
          {files.length > 0 && <span style={s.statBadge}>{files.length} file</span>}
        </div>
      </div>

      <div style={s.body}>
        {/* Left: Upload */}
        <div style={s.left}>
          {/* Drop Zone */}
          <div
            style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.html,.xml,.json"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
            />
            <div style={s.dropIcon}>⬆</div>
            <div style={s.dropText}>Trascina file o cartelle qui</div>
            <div style={s.dropSub}>PDF · DOCX · TXT · Immagini · CSV · JSON</div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={s.fileList}>
              <div style={s.fileListHeader}>
                <span style={s.fileListTitle}>File da analizzare</span>
                <button style={s.clearBtn} onClick={() => setFiles([])}>Svuota</button>
              </div>
              {files.map(({ file, id }) => (
                <div key={id} style={s.fileRow}>
                  <span style={s.fileRowIcon}>{fileIcon(file.name)}</span>
                  <span style={s.fileRowName} title={file.name}>{file.name}</span>
                  <span style={s.fileRowSize}>{(file.size / 1024).toFixed(0)} KB</span>
                  <button style={s.removeBtn} onClick={() => removeFile(id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze button */}
          <button
            style={{ ...s.analyzeBtn, ...(loading || files.length === 0 ? s.analyzeBtnDisabled : {}) }}
            onClick={analyze}
            disabled={loading || files.length === 0}
          >
            {loading ? '⏳ Analisi in corso...' : '📰 Genera Articolo HTML'}
          </button>

          {progress && <div style={s.progressMsg}>{progress}</div>}
          {error && <div style={s.errorMsg}>⚠ {error}</div>}

          {/* Result info */}
          {result && (
            <div style={s.resultInfo}>
              <div style={s.resultStat}>✅ {result.filesProcessed} documenti analizzati</div>
              {result.imagesFound > 0 && <div style={s.resultStat}>🖼 {result.imagesFound} immagini incorporate</div>}
              <div style={s.resultStat}>💾 Salvato: <span style={s.resultPath}>{result.savedPath}</span></div>
              <div style={s.resultActions}>
                <button style={s.actionBtn} onClick={downloadHtml}>⬇ Scarica HTML</button>
                <button style={s.actionBtn} onClick={openInBrowser}>🌐 Apri in Chrome</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div style={s.right}>
          <div style={s.previewHeader}>
            <span style={s.previewTitle}>Anteprima Articolo</span>
            {result && <button style={s.actionBtn} onClick={openInBrowser}>↗ Apri grande</button>}
          </div>
          {result ? (
            <iframe
              ref={previewRef}
              style={s.iframe}
              srcDoc={result.html}
              title="Anteprima articolo"
              sandbox="allow-same-origin"
            />
          ) : (
            <div style={s.previewEmpty}>
              <div style={s.previewEmptyIcon}>📰</div>
              <div style={s.previewEmptyText}>L'anteprima dell'articolo<br/>apparirà qui dopo l'analisi</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary, #0f1219)', color: 'var(--text-primary, #e8eaf0)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-secondary, #161b25)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: 16, fontWeight: 600, color: '#e8eaf0' },
  headerSub: { fontSize: 11, color: '#8892a4', marginTop: 2 },
  headerStats: { display: 'flex', gap: 8 },
  statBadge: { background: 'rgba(99,179,237,0.15)', color: '#63b3ed', border: '1px solid rgba(99,179,237,0.3)', borderRadius: 12, padding: '2px 10px', fontSize: 12 },
  body: { display: 'flex', flex: 1, overflow: 'hidden', gap: 0 },
  left: { width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto' },
  dropZone: { border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(255,255,255,0.02)' },
  dropZoneActive: { borderColor: '#63b3ed', background: 'rgba(99,179,237,0.08)' },
  dropIcon: { fontSize: 32, marginBottom: 8, color: '#8892a4' },
  dropText: { fontSize: 14, color: '#c8d0dc', fontWeight: 500 },
  dropSub: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  fileList: { background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' },
  fileListHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  fileListTitle: { fontSize: 12, color: '#8892a4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  clearBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4 },
  fileRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  fileRowIcon: { fontSize: 16, flexShrink: 0 },
  fileRowName: { flex: 1, fontSize: 12, color: '#c8d0dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileRowSize: { fontSize: 10, color: '#6b7280', flexShrink: 0 },
  removeBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: '2px 4px', borderRadius: 4, flexShrink: 0 },
  analyzeBtn: { background: 'linear-gradient(135deg, #2d6a4f, #1e4d3a)', border: 'none', borderRadius: 10, color: '#a7f3d0', padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', letterSpacing: '0.02em' },
  analyzeBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  progressMsg: { fontSize: 12, color: '#63b3ed', textAlign: 'center', padding: '8px 0', animation: 'pulse 1.5s infinite' },
  errorMsg: { fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(239,68,68,0.2)' },
  resultInfo: { background: 'rgba(99,179,237,0.06)', borderRadius: 10, padding: 12, border: '1px solid rgba(99,179,237,0.2)' },
  resultStat: { fontSize: 12, color: '#a0aec0', marginBottom: 4 },
  resultPath: { color: '#63b3ed', wordBreak: 'break-all' },
  resultActions: { display: 'flex', gap: 8, marginTop: 10 },
  actionBtn: { background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.25)', color: '#63b3ed', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 },
  right: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  previewHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-secondary, #161b25)' },
  previewTitle: { fontSize: 13, color: '#8892a4', fontWeight: 600 },
  iframe: { flex: 1, width: '100%', height: '100%', border: 'none', background: '#fff' },
  previewEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4a5568', gap: 12 },
  previewEmptyIcon: { fontSize: 56, opacity: 0.3 },
  previewEmptyText: { fontSize: 14, textAlign: 'center', lineHeight: 1.6 },
};
