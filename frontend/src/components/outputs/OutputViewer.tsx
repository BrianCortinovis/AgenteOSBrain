import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { outputsApi } from '../../api/outputs.api';
import { t } from '../../i18n/it';

const TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  report: { badge: 'badge-purple', label: 'Report' },
  file: { badge: 'badge-green', label: 'File' },
};

function parseMetadata(metadata: any) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

function inferMimeType(output: any, metadata: Record<string, any>) {
  if (metadata.mimeType) return metadata.mimeType as string;
  const path = String(metadata.filePath || output?.content || '').toLowerCase();
  if (path.endsWith('.pdf')) return 'application/pdf';
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.match(/\.(png|jpg|jpeg|webp|gif)$/)) return 'image/*';
  return 'application/octet-stream';
}

function renderPreview(output: any) {
  const metadata = parseMetadata(output.metadata);
  const previewUrl = metadata.previewUrl;
  const mimeType = inferMimeType(output, metadata);

  if (!previewUrl) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <p>Nessuna anteprima disponibile</p>
      </div>
    );
  }

  if (mimeType === 'application/pdf') {
    return <iframe title={output.title || 'PDF'} src={previewUrl} style={{ width: '100%', height: '100%', border: 0 }} />;
  }

  if (mimeType.startsWith('video/')) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#111' }}>
        <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
      </div>
    );
  }

  if (mimeType.startsWith('image/')) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#111' }}>
        <img src={previewUrl} alt={output.title || 'Output'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }} />
      </div>
    );
  }

  if (mimeType === 'text/html') {
    return <iframe title={output.title || 'HTML'} src={previewUrl} style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />;
  }

  return (
    <div className="empty-state" style={{ height: '100%', gap: 12 }}>
      <p>Anteprima non disponibile</p>
      <a className="btn btn-sm btn-primary" href={previewUrl} target="_blank" rel="noreferrer">
        Apri file
      </a>
    </div>
  );
}

export default function OutputViewer() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    if (!currentProjectId) return;
    const nextOutputs = await outputsApi.getByProject(currentProjectId);
    setOutputs(nextOutputs);
    setSelected((current: any) => {
      if (!current && nextOutputs[0]) return nextOutputs[0];
      if (!current) return null;
      return nextOutputs.find(o => o.id === current.id) || nextOutputs[0] || null;
    });
  };

  useEffect(() => {
    load();
    if (!currentProjectId) return;
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [currentProjectId]);

  const handleDelete = async (id: string) => {
    await outputsApi.delete(id);
    if (selected?.id === id) setSelected(null);
    await load();
  };

  if (!currentProjectId) return <div className="empty-state"><p>Seleziona un progetto</p></div>;

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', gap: 16, overflow: 'hidden' }}>
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{t('output.risultati')}</h2>

        {outputs.length === 0 && (
          <div className="empty-state"><p>{t('output.nessuno')}</p></div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {outputs.map(o => {
            const style = TYPE_STYLES[o.type] || TYPE_STYLES.file;
            return (
              <div
                key={o.id}
                onClick={() => setSelected(o)}
                style={{
                  padding: '10px 12px', background: selected?.id === o.id ? 'var(--bg-hover)' : 'var(--bg-card)',
                  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', transition: 'all var(--transition)',
                  borderLeftColor: selected?.id === o.id ? 'var(--accent-blue)' : 'var(--border-primary)',
                  borderLeftWidth: selected?.id === o.id ? 2 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{o.title || o.type}</span>
                  <span className={`badge ${style.badge}`}>{style.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(o.created_at).toLocaleString('it-IT')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {selected ? (
          <>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.title || 'Output'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {parseMetadata(selected.metadata).filePath || selected.content}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {parseMetadata(selected.metadata).previewUrl && (
                  <a
                    className="btn btn-sm btn-secondary"
                    href={parseMetadata(selected.metadata).previewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apri
                  </a>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>
                  {t('output.elimina')}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {renderPreview(selected)}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ height: '100%' }}>
            <p>Nessun risultato finale disponibile</p>
          </div>
        )}
      </div>
    </div>
  );
}
