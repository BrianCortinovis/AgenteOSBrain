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

function App() {
  const loadProjects = useProjectStore(s => s.loadProjects);
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const currentView = useUIStore(s => s.currentView);
  const sidebarOpen = useUIStore(s => s.sidebarOpen);
  const chatOpen = useUIStore(s => s.chatOpen);
  const inspectorOpen = useUIStore(s => s.inspectorOpen);

  useEffect(() => { loadProjects(); }, []);

  const renderMainContent = () => {
    if (!currentProjectId && currentView !== 'prompt' && currentView !== 'connettori' && currentView !== 'impostazioni' && currentView !== 'workspace' && currentView !== 'dashboard') {
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
      case 'mappa': return <GraphCanvas />;
      case 'agenti': return <AgentPanel />;
      case 'automazioni': return <SchedulePanel />;
      case 'timeline': return <TimelineView />;
      case 'prompt': return <PromptManager />;
      case 'connettori': return <ConnectorBrowser />;
      case 'risultati': return <OutputViewer />;
      case 'impostazioni': return <ProviderSettings />;
      case 'workspace': return <WorkspaceSettings />;
      case 'dashboard': return <DashboardPanel />;
      default: return <GraphCanvas />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
            {renderMainContent()}
          </div>
          {inspectorOpen && currentView === 'mappa' && currentProjectId && (
            <NodeInspector />
          )}
          {chatOpen && currentProjectId && (
            <ChatPanel />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
