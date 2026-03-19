import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { api, API_ORIGIN } from '../../api/client';
import GraphCanvas from '../graph/GraphCanvas';
import AppGallery from './AppGallery';
import BuilderToolbar from './BuilderToolbar';
import BuilderWizard from './BuilderWizard';

type AppDetail = {
  name: string;
  path: string;
  hasPackageJson: boolean;
  fileTree: string;
  running: boolean;
  port: number;
  url: string;
};

type AutoBuild = { prompt: string; style?: string; colors?: string; layout?: string; features?: string; tech?: string; };

export default function ProjectBuilder({ autoStart }: { autoStart?: AutoBuild }) {
  const currentProjectId = useProjectStore(s => s.currentProjectId);

  // App state
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [appDetail, setAppDetail] = useState<AppDetail | null>(null);
  const [showWizard, setShowWizard] = useState(!!autoStart);
  const [showBuildProcess, setShowBuildProcess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');

  // Console logs
  const [logs, setLogs] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll app info
  const refreshApp = useCallback(() => {
    if (!selectedApp) return;
    api.get<AppDetail>(`/apps/${selectedApp}`)
      .then(setAppDetail)
      .catch(() => {});
  }, [selectedApp]);

  useEffect(() => {
    refreshApp();
    const interval = setInterval(refreshApp, 3000);
    return () => clearInterval(interval);
  }, [refreshApp]);

  // SSE for build logs
  useEffect(() => {
    if (!currentProjectId) return;
    const es = new EventSource(`${API_ORIGIN}/api/v1/projects/${currentProjectId}/events`);
    es.addEventListener('node_start', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-300), `[BUILD] ${data.message || data.nodeId}`]);
    });
    es.addEventListener('node_complete', (e) => {
      const data = JSON.parse(e.data);
      const icon = data.error ? 'ERRORE' : 'OK';
      setLogs(prev => [...prev.slice(-300), `[${icon}] ${data.message || ''}${data.error ? ` — ${data.error}` : ''}`]);
    });
    es.addEventListener('project_complete', () => {
      setLogs(prev => [...prev, '[COMPLETATO] Build terminato']);
      refreshApp();
    });
    return () => es.close();
  }, [currentProjectId, refreshApp]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load file content
  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const encoded = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const res = await fetch(`${API_ORIGIN}/api/v1/local-files/${encoded.split('/').map(encodeURIComponent).join('/')}`);
      setFileContent(res.ok ? await res.text() : '(Impossibile leggere il file)');
    } catch {
      setFileContent('(Errore lettura)');
    }
  };

  // Wizard mode
  if (showWizard) {
    return (
      <BuilderWizard
        onComplete={(appName) => { setShowWizard(false); setSelectedApp(appName); }}
        onCancel={() => setShowWizard(false)}
        autoStart={autoStart}
      />
    );
  }

  // No app selected — show gallery
  if (!selectedApp) {
    return <AppGallery onSelectApp={setSelectedApp} onStartWizard={() => setShowWizard(true)} />;
  }

  // Parse file tree
  const renderFileTree = () => {
    if (!appDetail?.fileTree) return <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)' }}>Nessun file</div>;
    const lines = appDetail.fileTree.split('\n').filter(Boolean);
    return (
      <div style={{ padding: '4px 0', fontSize: 11, fontFamily: 'monospace' }}>
        {lines.map((line, i) => {
          const isDir = line.trimEnd().endsWith('/');
          const trimmed = line.replace(/^[│├└─ ]+/, '').replace(/ \(\d+[\.\d]*[BK]\)$/, '');
          const indent = (line.match(/^([│├└─ ]+)/)?.[1]?.length || 0) * 1.5;
          const filePath = appDetail.path + '/' + trimmed.replace(/\/$/, '');
          return (
            <div
              key={i}
              onClick={isDir ? undefined : () => loadFile(filePath)}
              style={{
                paddingLeft: Math.min(indent, 50) + 4,
                padding: '2px 4px 2px ' + (Math.min(indent, 50) + 4) + 'px',
                cursor: isDir ? 'default' : 'pointer',
                color: isDir ? 'var(--accent-blue)' : selectedFile === filePath ? 'var(--accent-green)' : 'var(--text-primary)',
                fontWeight: isDir ? 600 : 400,
                background: selectedFile === filePath ? 'var(--bg-hover)' : 'transparent',
                borderRadius: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={trimmed}
            >
              {trimmed}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <BuilderToolbar
        appName={selectedApp}
        running={appDetail?.running || false}
        port={appDetail?.port || 0}
        url={appDetail?.url || ''}
        showBuildProcess={showBuildProcess}
        onToggleBuildProcess={() => setShowBuildProcess(!showBuildProcess)}
        onBack={() => { setSelectedApp(null); setAppDetail(null); setSelectedFile(null); }}
        onStatusChange={refreshApp}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: File Browser */}
        <div style={{
          width: 230, borderRight: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}>
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--border-primary)',
            fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            File
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderFileTree()}
          </div>
        </div>

        {/* Center: Preview / Build Process / Code */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              {showBuildProcess ? (
                // Build Process: Graph view
                <GraphCanvas />
              ) : selectedFile ? (
                // Code Viewer
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    padding: '4px 10px', borderBottom: '1px solid var(--border-primary)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-tertiary)', fontSize: 11,
                  }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {selectedFile.split('/').pop()}
                    </span>
                    <button className="btn-icon" onClick={() => setSelectedFile(null)} style={{ fontSize: 10, padding: '2px 6px' }}>
                      Chiudi
                    </button>
                  </div>
                  <pre style={{
                    flex: 1, overflow: 'auto', padding: 12, margin: 0,
                    fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace',
                    background: '#0d1117', color: '#c9d1d9',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {fileContent}
                  </pre>
                </div>
              ) : appDetail?.name ? (
                // Live Preview — serve static files via backend to avoid CORS
                <iframe
                  src={`/api/v1/apps/${appDetail.name}/serve/index.html`}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  title="App Preview"
                />
              ) : (
                // App not running
                <div className="empty-state" style={{ height: '100%' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <p style={{ fontSize: 14, marginTop: 12 }}>
                    Seleziona un'app dalla galleria per vedere il preview
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Clicca sui file a sinistra per vedere il codice
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Console (collapsible) */}
          <div style={{ borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
            <div
              onClick={() => setShowConsole(!showConsole)}
              style={{
                padding: '4px 10px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--bg-tertiary)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              <span>Console ({logs.length})</span>
              <span>{showConsole ? '▼' : '▲'}</span>
            </div>
            {showConsole && (
              <div style={{
                height: 150, overflowY: 'auto', padding: 8,
                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
                background: '#0d1117', color: '#c9d1d9',
              }}>
                {logs.length === 0 && (
                  <div style={{ color: '#484f58' }}>I log appariranno qui durante il build...</div>
                )}
                {logs.map((log, i) => (
                  <div key={i} style={{
                    color: log.includes('[ERRORE]') ? '#f85149' :
                           log.includes('[OK]') ? '#3fb950' :
                           log.includes('[BUILD]') ? '#58a6ff' :
                           log.includes('[COMPLETATO]') ? '#d2a8ff' : '#c9d1d9',
                  }}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
