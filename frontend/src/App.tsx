import { useEffect } from 'react';
import { useProjectStore } from './stores/useProjectStore';
import { useUIStore } from './stores/useUIStore';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import GraphCanvas from './components/graph/GraphCanvas';
import AgentPanel from './components/agents/AgentPanel';
import SchedulePanel from './components/scheduler/SchedulePanel';
import PromptManager from './components/prompts/PromptManager';
import ConnectorBrowser from './components/connectors/ConnectorBrowser';
import OutputViewer from './components/outputs/OutputViewer';
import ProviderSettings from './components/providers/ProviderSettings';
import ChatPanel from './components/chat/ChatPanel';
import NodeInspector from './components/graph/panels/NodeInspector';
import TimelineView from './components/timeline/TimelineView';
import WorkspaceSettings from './components/workspace/WorkspaceSettings';
import DashboardPanel from './components/workspace/DashboardPanel';
import ProjectBuilder from './components/builder/ProjectBuilder';
import IAOSDesktop from './components/iaos/IAOSDesktop';
import PopupWindow from './components/iaos/PopupWindow';

function App() {
  // Multi-monitor popup mode — renders just the requested component
  if (new URLSearchParams(window.location.search).get('popup') === '1') {
    return <PopupWindow />;
  }
  const loadProjects = useProjectStore(s => s.loadProjects);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const currentView = useUIStore(s => s.currentView);
  const chatOpen = useUIStore(s => s.chatOpen);
  const inspectorOpen = useUIStore(s => s.inspectorOpen);
  const iaosMode = useUIStore(s => s.iaosMode);

  useEffect(() => { loadProjects(); }, []);

  // IAOS mode — full screen AI OS desktop
  if (iaosMode) {
    return <IAOSDesktop />;
  }

  const renderMainContent = () => {
    if (!currentProjectId && currentView !== 'prompt' && currentView !== 'connettori' && currentView !== 'impostazioni' && currentView !== 'workspace' && currentView !== 'dashboard' && currentView !== 'builder') {
      return (
        <div className="empty-state" style={{ height: '100%' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          <p style={{ fontSize: 16 }}>Seleziona o crea un progetto per iniziare</p>
        </div>
      );
    }

    switch (currentView) {
      case 'work': return <GraphCanvas />;
      case 'agenti': return <AgentPanel />;
      case 'automazioni': return <SchedulePanel />;
      case 'timeline': return <TimelineView />;
      case 'prompt': return <PromptManager />;
      case 'connettori': return <ConnectorBrowser />;
      case 'risultati': return <OutputViewer />;
      case 'impostazioni': return <ProviderSettings />;
      case 'workspace': return <WorkspaceSettings />;
      case 'dashboard': return <DashboardPanel />;
      case 'builder': return <ProjectBuilder />;
      default: return <GraphCanvas />;
    }
  };

  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {isElectron && (
        <div style={{
          height: 28, background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
          WebkitAppRegion: 'drag',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        } as any}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, opacity: 0.6 }}>
            Agent OS Brain
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
            {renderMainContent()}
          </div>
          {inspectorOpen && currentView === 'work' && currentProjectId && (
            <NodeInspector />
          )}
          {chatOpen && currentProjectId && (
            <ChatPanel />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
