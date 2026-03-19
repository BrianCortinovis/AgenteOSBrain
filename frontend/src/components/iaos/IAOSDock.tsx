import { useUIStore } from '../../stores/useUIStore';

const dockItems = [
  { id: 'builder', label: 'Builder', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  { id: 'work', label: 'WORK', icon: 'M4 4h16v16H4z M4 12h16 M12 4v16' },
  { id: 'app-gallery', label: 'App', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
  { id: 'agenti', label: 'Agenti', icon: 'M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z M4 20c0-4 4-6 8-6s8 2 8 6' },
  { id: 'processes', label: 'Processi', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { id: 'files', label: 'Files', icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { id: 'import', label: 'Import', icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
  { id: 'settings', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z' },
] as const;

const titleMap: Record<string, string> = {
  builder: 'Builder',
  work: 'WORK — Flussi di Lavoro',
  'app-gallery': 'Le tue App',
  agenti: 'Agenti',
  files: 'File Manager',
  import: 'Importa File',
  processes: 'Processi Attivi',
  settings: 'Impostazioni',
};

export default function IAOSDock() {
  const { openWindow, toggleIaosChat, iaosChatOpen } = useUIStore();

  return (
    <div className="iaos-dock">

      {dockItems.map(item => (
        <button
          key={item.id}
          className="iaos-dock-item"
          onClick={() => openWindow(item.id as any, titleMap[item.id] || item.label)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon} />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}

      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />

      {/* Exit IAOS */}
      <button
        className="iaos-dock-item"
        onClick={() => useUIStore.getState().setIaosMode(false)}
        style={{ color: 'rgba(239,68,68,0.6)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        <span>Esci</span>
      </button>
    </div>
  );
}
