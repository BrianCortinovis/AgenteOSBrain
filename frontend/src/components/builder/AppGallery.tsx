import { useState, useEffect } from 'react';
import { api } from '../../api/client';

type AppInfo = {
  name: string;
  path: string;
  hasPackageJson: boolean;
  running: boolean;
  port: number;
  url: string;
};

export default function AppGallery({ onSelectApp, onStartWizard }: { onSelectApp: (name: string) => void; onStartWizard: () => void }) {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      api.get<AppInfo[]>('/apps').then(setApps).catch(() => {}).finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Caricamento app...</div>;
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Le tue App</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Crea app con AI o usa la chat per richieste libere
          </p>
        </div>
        <button
          onClick={onStartWizard}
          className="btn btn-primary"
          style={{
            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Crea Nuova App
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
          </svg>
          <p style={{ fontSize: 14, marginTop: 12 }}>Nessuna app creata</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Nella chat, descrivi l'app che vuoi e il Builder la costruira per te
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}>
          {apps.map(app => (
            <div
              key={app.name}
              onClick={() => onSelectApp(app.name)}
              style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-primary)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: app.running ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: app.running ? 'white' : 'var(--text-muted)',
                  fontSize: 14,
                }}>
                  {app.running ? '>' : '#'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{app.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {app.running ? `Attiva su :${app.port}` : app.hasPackageJson ? 'Node.js' : 'Statica'}
                  </div>
                </div>
              </div>
              {app.running && (
                <div style={{
                  fontSize: 10, color: 'var(--accent-green)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span className="status-dot completato" />
                  {app.url}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
