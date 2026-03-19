import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useUIStore } from '../../stores/useUIStore';

type ProviderInfo = { id: string; name: string; available: boolean; models: { id: string; name: string }[] };

const dockItems = [
  { id: 'builder', label: 'Builder', icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  { id: 'work', label: 'WORK', icon: 'M4 4h16v16H4z M4 12h16 M12 4v16' },
  { id: 'app-gallery', label: 'App', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
  { id: 'files', label: 'Files', icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { id: 'connettori', label: 'Connect', icon: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' },
  { id: 'agenti', label: 'Agenti', icon: 'M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z M4 20c0-4 4-6 8-6s8 2 8 6' },
  { id: 'processes', label: 'Processi', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { id: 'browser', label: 'Browser', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-1.95.7-3.74 1.87-5.13L12 12l-6.13 5.13A7.96 7.96 0 014 12z' },
  { id: 'settings', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'brianmap', label: 'Brain', icon: 'M12 2C8 2 5 5 5 9c0 2 .8 3.8 2 5l-2 4h14l-2-4c1.2-1.2 2-3 2-5 0-4-3-7-7-7z M9 9c0-1.7 1.3-3 3-3s3 1.3 3 3 M8 14h8' },
  { id: 'docanalyzer', label: 'DocAI', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
] as const;

const titleMap: Record<string, string> = {
  builder: 'Builder', work: 'WORK', 'app-gallery': 'App', files: 'File Manager',
  connettori: 'Connettori', agenti: 'Agenti', processes: 'Processi', browser: 'Browser',
  settings: 'Impostazioni', brianmap: 'BrianMap', docanalyzer: 'Doc Analyzer',
};

// Exported so FlowDesktop can access selected model
export let flowSelectedProvider = 'openai';
export let flowSelectedModel = 'gpt-4o';

export default function FlowStatusBar() {
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState({ apps: 0, providers: 0 });
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selProvider, setSelProvider] = useState('openai');
  const [selModel, setSelModel] = useState('gpt-4o');
  const { openWindow } = useUIStore();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get<any[]>('/apps').then(apps => {
      setStats(s => ({ ...s, apps: apps.filter((a: any) => a.running).length }));
    }).catch(() => {});
    api.get<ProviderInfo[]>('/providers').then(p => {
      setProviders(p);
      setStats(s => ({ ...s, providers: p.filter(pr => pr.available).length }));
    }).catch(() => {});
  }, []);

  // Sync to exported vars
  useEffect(() => {
    flowSelectedProvider = selProvider;
    flowSelectedModel = selModel;
  }, [selProvider, selModel]);

  const currentProvider = providers.find(p => p.id === selProvider);
  const models = currentProvider?.models || [];
  const h = time.getHours().toString().padStart(2, '0');
  const m = time.getMinutes().toString().padStart(2, '0');

  return (
    <div style={{
      height: 56,
      background: 'var(--bg-secondary, rgba(22,22,22,0.95))',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 4,
      zIndex: 1000, position: 'relative',
      fontSize: 13,
      color: 'var(--text-muted, rgba(224,230,240,0.7))',
    }}>
      {/* Brand */}
      <span style={{ fontWeight: 800, color: 'rgba(220,50,30,0.8)', fontSize: 16, letterSpacing: 3, marginRight: 12 }}>FLOW</span>

      {/* Dock items inline */}
      {dockItems.map(item => (
        <button
          key={item.id}
          onClick={() => {
            // Close BrainMap if open when clicking any other section
            if (item.id !== 'brianmap') {
              const bmWin = useUIStore.getState().flowWindows.find(w => w.component === 'brianmap');
              if (bmWin) useUIStore.getState().closeWindow(bmWin.id);
            }
            openWindow(item.id as any, titleMap[item.id] || item.label);
          }}
          title={item.label}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(224,230,240,0.4)', padding: '8px 12px',
            borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget).style.color = 'rgba(224,230,240,0.8)'; }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'rgba(224,230,240,0.4)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon} />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, overflow: 'hidden' }}>
        {/* Minimized windows in topbar */}
        {useUIStore.getState().flowWindows.filter(w => w.minimized).map(w => (
          <button key={w.id}
            onClick={() => useUIStore.getState().focusWindow(w.id)}
            style={{
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(224,230,240,0.5)', fontSize: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
            }}
            title={`Ripristina: ${w.title}`}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(220,50,30,0.5)', flexShrink: 0 }} />
            {w.title}
          </button>
        ))}
      </div>

      {/* Model selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
        <select
          value={selProvider}
          onChange={e => {
            setSelProvider(e.target.value);
            const p = providers.find(pr => pr.id === e.target.value);
            if (p?.models?.[0]) setSelModel(p.models[0].id);
          }}
          style={{
            fontSize: 10, padding: '3px 6px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, color: 'rgba(224,230,240,0.7)', outline: 'none',
          }}
        >
          {providers.filter(p => p.available).map(p => (
            <option key={p.id} value={p.id} style={{ background: '#1a1d28' }}>{p.name}</option>
          ))}
        </select>
        <select
          value={selModel}
          onChange={e => setSelModel(e.target.value)}
          style={{
            fontSize: 10, padding: '3px 6px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, color: 'rgba(224,230,240,0.7)', outline: 'none',
            maxWidth: 150,
          }}
        >
          {models.map((m: any) => (
            <option key={m.id} value={m.id} style={{ background: '#1a1d28' }}>{m.name}</option>
          ))}
        </select>
        <span className={`flow-statusbar-dot ${currentProvider?.available ? '' : 'error'}`} />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(224,230,240,0.4)' }}>
        <span>{stats.apps} app</span>
        <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
        <span>{stats.providers} AI</span>
      </div>

      <span style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'rgba(224,230,240,0.4)' }}>{h}:{m}</span>

      {/* Exit FLOW */}
      <button
        onClick={() => useUIStore.getState().setFlowMode(false)}
        title="Esci da FLOW"
        style={{
          marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(239,68,68,0.4)', padding: 4, borderRadius: 4,
          display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={e => { (e.currentTarget).style.color = 'rgba(239,68,68,0.8)'; }}
        onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(239,68,68,0.4)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
      </button>
    </div>
  );
}
