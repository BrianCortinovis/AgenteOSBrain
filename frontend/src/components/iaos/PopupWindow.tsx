/**
 * PopupWindow — standalone full-screen render of any IAOS component.
 * Opened via: /?popup=1&component=work-graph&title=...&props=JSON
 * Designed for multi-monitor setups.
 */
import { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { useChatStore } from '../../stores/useChatStore';
import IAOSFileManager from './IAOSFileManager';
import FlowAgentsView from './FlowAgentsView';
import FlowBrowser from './FlowBrowser';
import IAOSProcessPanel from './IAOSProcessPanel';
import GraphCanvas from '../graph/GraphCanvas';
import ConnectorBrowser from '../connectors/ConnectorBrowser';
import ProjectBuilder from '../builder/ProjectBuilder';
import ProviderSettings from '../providers/ProviderSettings';
import OutputViewer from '../outputs/OutputViewer';
import BrianMap from './BrianMap';
import './iaos.css';

function PopupContent({ component, props }: { component: string; props: Record<string, any> }) {
  const { setCurrentProject } = useProjectStore();
  const loadGraph = useGraphStore(s => s.loadGraph);
  const loadHistory = useChatStore(s => s.loadHistory);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize stores with passed props
    if (props.projectId) {
      setCurrentProject(props.projectId);
      loadGraph(props.projectId);
      loadHistory(props.projectId);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(224,230,240,0.4)', fontSize: 14 }}>
        Caricamento...
      </div>
    );
  }

  switch (component) {
    case 'builder': return <ProjectBuilder />;
    case 'work':
    case 'work-graph': return <GraphCanvas />;
    case 'files': return <IAOSFileManager />;
    case 'agenti': return <FlowAgentsView />;
    case 'connettori': return <ConnectorBrowser />;
    case 'processes': return <IAOSProcessPanel />;
    case 'settings': return <ProviderSettings />;
    case 'risultati': return <OutputViewer />;
    case 'browser': return <FlowBrowser initialUrl={props.url || ''} />;
    case 'brianmap': return <BrianMap onOpenWindow={() => {}} onClose={() => window.close()} />;
    case 'app-preview': {
      const appName = props.appName || '';
      return <iframe src={`/api/v1/apps/${appName}/serve/index.html`} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} title={appName} />;
    }
    case 'file-viewer': {
      const filePath = props.filePath || '';
      const fileName = props.fileName || 'File';
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const encoded = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        return <iframe src={`/api/v1/local-files/${encoded.split('/').map(encodeURIComponent).join('/')}`} style={{ width: '100%', height: '100%', border: 'none' }} title={fileName} />;
      }
      return <pre style={{ padding: 20, fontSize: 12, color: '#c9d1d9', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{props.content || `File: ${filePath}`}</pre>;
    }
    default:
      return <div style={{ padding: 20, color: 'rgba(224,230,240,0.5)', fontSize: 14 }}>Componente: {component}</div>;
  }
}

export default function PopupWindow() {
  const params = new URLSearchParams(window.location.search);
  const component = params.get('component') || 'files';
  const title = params.get('title') || component;
  let props: Record<string, any> = {};
  try {
    const raw = params.get('props');
    if (raw) props = JSON.parse(decodeURIComponent(raw));
  } catch {}

  useEffect(() => {
    document.title = `FLOW — ${title}`;
  }, [title]);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--bg-primary, #0f1219)',
      display: 'flex', flexDirection: 'column',
      color: 'var(--text-primary, #e0e6f0)',
      overflow: 'hidden',
    }}>
      {/* Minimal titlebar */}
      <div style={{
        height: 32, flexShrink: 0,
        background: 'rgba(10,12,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
      }}>
        <span style={{ fontWeight: 800, color: 'rgba(220,50,30,0.7)', fontSize: 13, letterSpacing: 3 }}>FLOW</span>
        <span style={{ fontSize: 12, color: 'rgba(224,230,240,0.4)', fontWeight: 500 }}>{title}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => window.close()}
          style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}
          title="Chiudi finestra"
          onMouseEnter={e => { (e.currentTarget).style.color = 'rgba(239,68,68,0.9)'; }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(239,68,68,0.5)'; }}
        >✕</button>
      </div>

      {/* Content fills remaining space */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <PopupContent component={component} props={props} />
      </div>
    </div>
  );
}
