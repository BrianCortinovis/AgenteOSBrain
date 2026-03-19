import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function FlowProcessPanel() {
  const [apps, setApps] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      api.get<any[]>('/apps').then(setApps).catch(() => {});
      api.get<any[]>('/projects').then(p => {
        setProjects(p.filter((pr: any) => pr.status === 'in_esecuzione' || pr.status === 'in_pausa'));
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const runningApps = apps.filter(a => a.running);

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto', color: '#e0e6f0' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px 0' }}>Processi Attivi</h3>

      {/* Running Projects */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'rgba(224,230,240,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Progetti in esecuzione
        </div>
        {projects.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(224,230,240,0.3)', padding: 8 }}>Nessuno</div>
        ) : projects.map(p => (
          <div key={p.id} className="flow-process-item">
            <span className="flow-statusbar-dot" style={{ background: p.status === 'in_pausa' ? '#f59e0b' : '#3b82f6' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(224,230,240,0.4)' }}>{p.status}</div>
            </div>
            <button
              onClick={() => api.post(`/projects/${p.id}/stop`, {}).catch(() => {})}
              style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer' }}
            >
              Stop
            </button>
          </div>
        ))}
      </div>

      {/* Running Apps */}
      <div>
        <div style={{ fontSize: 11, color: 'rgba(224,230,240,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          App attive
        </div>
        {runningApps.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(224,230,240,0.3)', padding: 8 }}>Nessuna</div>
        ) : runningApps.map(a => (
          <div key={a.name} className="flow-process-item">
            <span className="flow-statusbar-dot" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(224,230,240,0.4)' }}>:{a.port}</div>
            </div>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: '#3b82f6', marginRight: 8 }}
            >
              Apri
            </a>
            <button
              onClick={() => api.post(`/apps/${a.name}/stop`, {}).catch(() => {})}
              style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer' }}
            >
              Stop
            </button>
          </div>
        ))}
      </div>

      {/* All Apps */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, color: 'rgba(224,230,240,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Tutte le App ({apps.length})
        </div>
        {apps.map(a => (
          <div key={a.name} className="flow-process-item">
            <span className="flow-statusbar-dot" style={{ background: a.running ? '#10b981' : '#555' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{a.name}</div>
            </div>
            {!a.running && (
              <button
                onClick={() => api.post(`/apps/${a.name}/start`, {}).catch(() => {})}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer' }}
              >
                Avvia
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
