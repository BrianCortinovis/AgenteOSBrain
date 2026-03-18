import { useState, useEffect, useRef } from 'react';
import { API_ORIGIN } from '../../api/client';

interface SystemStatus {
  providers: { id: string; name: string; available: boolean; type: string }[];
  activeJobs: number;
  connectedClients: number;
  memoryEntries: number;
  pendingApprovals: number;
}

export default function DashboardPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStatus();
    connectWebSocket();
    const interval = setInterval(loadStatus, 5000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadStatus = async () => {
    try {
      const [providers, dashboard] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/providers`).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/v1/dashboard/status`).then(r => r.json()).catch(() => ({})),
      ]);
      setStatus({
        providers: providers.map((p: any) => ({ id: p.id, name: p.name, available: p.available, type: p.type })),
        activeJobs: dashboard.activeJobs || 0,
        connectedClients: dashboard.connectedClients || 0,
        memoryEntries: dashboard.memoryEntries || 0,
        pendingApprovals: dashboard.pendingApprovals || 0,
      });
    } catch {}
  };

  const connectWebSocket = () => {
    const wsBase = API_ORIGIN || `${window.location.protocol}//${window.location.hostname}:${window.location.port || '43101'}`;
    const wsUrl = wsBase.replace(/^http/, 'ws') + '/ws';
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'system' }));
        addLog('[WS] Connesso al server');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'node_start' || data.type === 'node_complete') {
            addLog(`[${data.type}] ${data.label}: ${data.status || 'avviato'} ${data.duration ? `(${data.duration}ms)` : ''}`);
          } else if (data.type === 'project_complete') {
            addLog(`[Progetto] Completato`);
          } else if (data.type !== 'connected' && data.type !== 'subscribed' && data.type !== 'pong') {
            addLog(`[${data.channel || 'sys'}] ${JSON.stringify(data).slice(0, 100)}`);
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        addLog('[WS] Disconnesso');
        setTimeout(connectWebSocket, 3000);
      };
    } catch {}
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString('it-IT');
    setLogs(prev => [...prev.slice(-100), `${timestamp} ${msg}`]);
  };

  const statusColor = (available: boolean) => available ? '#e8533c' : '#ef4444';

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsConnected ? '#e8533c' : '#ef4444' }} />
          <span style={{ fontSize: 12, color: '#888' }}>{wsConnected ? 'WebSocket connesso' : 'Disconnesso'}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Provider Attivi', value: status?.providers.filter(p => p.available).length || 0, color: '#e8533c' },
          { label: 'Job Schedulati', value: status?.activeJobs || 0, color: '#8b5cf6' },
          { label: 'Client WS', value: status?.connectedClients || 0, color: '#e8533c' },
          { label: 'Memorie', value: status?.memoryEntries || 0, color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '14px 16px', background: '#1a1a1a', borderRadius: 10,
            border: '1px solid #333',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Providers Status */}
      <div>
        <h3 style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Provider Status</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {status?.providers.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', background: '#1a1a1a', borderRadius: 6,
              border: '1px solid #333', fontSize: 12,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(p.available) }} />
              <span style={{ color: '#fff' }}>{p.name}</span>
              <span style={{ color: '#666', fontSize: 10 }}>{p.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Logs */}
      <div style={{ flex: 1, minHeight: 200 }}>
        <h3 style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Log Live</h3>
        <div style={{
          background: '#0a0a0a', borderRadius: 8, border: '1px solid #222',
          padding: 12, height: '100%', overflowY: 'auto', fontFamily: 'monospace',
          fontSize: 11, lineHeight: 1.6,
        }}>
          {logs.length === 0 && (
            <div style={{ color: '#444' }}>In attesa di eventi...</div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('Errore') ? '#ef4444' : log.includes('Completato') ? '#e8533c' : '#888' }}>
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
