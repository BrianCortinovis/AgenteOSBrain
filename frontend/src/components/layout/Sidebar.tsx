import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { useChatStore } from '../../stores/useChatStore';
import { t } from '../../i18n/it';
import { useEffect, useState } from 'react';
import AIFieldAssist from '../common/AIFieldAssist';

const navItems = [
  { id: 'flow' as const, label: 'FLOW', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'builder' as const, label: 'Builder', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  { id: 'work' as const, label: 'WORK', icon: 'M4 4h16v16H4z M4 12h16 M12 4v16' },
  { id: 'agenti' as const, label: 'Agenti', icon: 'M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z M4 20c0-4 4-6 8-6s8 2 8 6' },
  { id: 'automazioni' as const, label: 'Automazioni', icon: 'M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83' },
  { id: 'timeline' as const, label: 'Timeline', icon: 'M3 12h18 M8 6v12 M16 6v12 M3 6h18 M3 18h18' },
  { id: 'prompt' as const, label: 'Prompt', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M8 13h8 M8 17h8' },
  { id: 'connettori' as const, label: 'Connettori', icon: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' },
  { id: 'risultati' as const, label: 'Risultati', icon: 'M9 17v-6 M13 17v-10 M17 17v-4 M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z' },
  { id: 'workspace' as const, label: 'Workspace', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
  { id: 'dashboard' as const, label: 'Dashboard', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
];

const bottomNavItem = { id: 'impostazioni' as const, label: 'Impostazioni', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z' };

export default function Sidebar() {
  const { projects, currentProjectId, setCurrentProject, createProject, deleteProject, loadProjects } = useProjectStore();
  const loadGraph = useGraphStore(s => s.loadGraph);
  const loadHistory = useChatStore(s => s.loadHistory);
  const { currentView, setView, sidebarOpen } = useUIStore();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!sidebarOpen) return;
    const timer = setInterval(() => {
      loadProjects().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [sidebarOpen, loadProjects]);

  if (!sidebarOpen) return null;

  const statusMeta: Record<string, { label: string; color: string }> = {
    completato: { label: 'Completato', color: 'var(--accent-green)' },
    in_esecuzione: { label: 'In esecuzione', color: 'var(--accent-amber)' },
    in_pausa: { label: 'In pausa', color: '#f59e0b' },
    fermato: { label: 'Fermato', color: 'var(--accent-red)' },
    bloccato: { label: 'Bloccato', color: 'var(--accent-red)' },
    pronto: { label: 'Pronto', color: 'var(--accent-blue)' },
    bozza: { label: 'Bozza', color: 'var(--text-muted)' },
  };

  const handleSelectProject = (id: string) => {
    setCurrentProject(id);
    loadGraph(id);
    loadHistory(id);
    setView('work');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const p = await createProject({ name: newName.trim() });
    setNewName('');
    setShowNew(false);
    loadGraph(p.id);
    loadHistory(p.id);
    setView('work');
  };

  return (
    <div style={{
      width: 72, height: '100%', background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column',
      flexShrink: 0, alignItems: 'center',
    }}>
      {/* Logo */}
      <div style={{ padding: '12px 0 8px', borderBottom: '1px solid var(--border-primary)', width: '100%', textAlign: 'center' }}>
        <img src="/logo.svg" alt="" width={28} height={28} style={{ opacity: 0.8 }} />
      </div>

      {/* Nav Icons - single column */}
      <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '6px 0', width: '100%' }}>
        {navItems.map(item => {
          const isFlow = item.id === 'flow';
          const isActive = !isFlow && currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => isFlow ? useUIStore.getState().setFlowMode(true) : setView(item.id as any)}
              title={item.label}
              style={{
                width: 58, height: 54,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, borderRadius: 10,
                background: isFlow ? 'rgba(239,68,68,0.12)' : isActive ? 'var(--bg-hover)' : 'transparent',
                color: isFlow ? 'rgba(239,100,70,0.85)' : isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                transition: 'all var(--transition)',
                border: isFlow ? '1px solid rgba(239,68,68,0.15)' : isActive ? '1px solid var(--border-secondary)' : '1px solid transparent',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                style={{ opacity: isFlow ? 0.8 : isActive ? 1 : 0.45 }}
              >
                <path d={item.icon}/>
              </svg>
              <span style={{
                fontSize: 8, fontWeight: isFlow || isActive ? 600 : 400,
                letterSpacing: isFlow ? 1 : 0.2, lineHeight: 1, opacity: isFlow ? 0.85 : isActive ? 1 : 0.5,
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Impostazioni - bottom */}
      <div style={{ borderTop: '1px solid var(--border-primary)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0' }}>
        <button
          onClick={() => setView(bottomNavItem.id)}
          title={bottomNavItem.label}
          style={{
            width: 58, height: 54,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, borderRadius: 10,
            background: currentView === bottomNavItem.id ? 'var(--bg-hover)' : 'transparent',
            color: currentView === bottomNavItem.id ? 'var(--accent-blue)' : 'var(--text-muted)',
            transition: 'all var(--transition)',
            border: currentView === bottomNavItem.id ? '1px solid var(--border-secondary)' : '1px solid transparent',
            flexShrink: 0,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: currentView === bottomNavItem.id ? 1 : 0.45 }}
          >
            <path d={bottomNavItem.icon}/>
          </svg>
          <span style={{
            fontSize: 8, fontWeight: currentView === bottomNavItem.id ? 600 : 400,
            letterSpacing: 0.2, lineHeight: 1, opacity: currentView === bottomNavItem.id ? 1 : 0.5,
          }}>
            {bottomNavItem.label}
          </span>
        </button>
        <span style={{ fontSize: 7, color: 'var(--text-muted)', marginTop: 2 }}>v0.2</span>
      </div>
    </div>
  );
}
