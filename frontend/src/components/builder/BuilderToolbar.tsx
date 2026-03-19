import { api } from '../../api/client';

type Props = {
  appName: string;
  running: boolean;
  port: number;
  url: string;
  showBuildProcess: boolean;
  onToggleBuildProcess: () => void;
  onBack: () => void;
  onStatusChange: () => void;
};

export default function BuilderToolbar({
  appName, running, port, url,
  showBuildProcess, onToggleBuildProcess, onBack, onStatusChange,
}: Props) {

  const handleStart = async () => {
    try {
      await api.post(`/apps/${appName}/start`, {});
      onStatusChange();
    } catch (err: any) {
      alert(`Errore avvio: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      await api.post(`/apps/${appName}/stop`, {});
      onStatusChange();
    } catch (err: any) {
      alert(`Errore stop: ${err.message}`);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px',
      borderBottom: '1px solid var(--border-primary)',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      {/* Back button */}
      <button className="btn-icon" onClick={onBack} title="Torna alla galleria" style={{ opacity: 0.6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      {/* App name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className={`status-dot ${running ? 'completato' : 'bozza'}`} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{appName}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Start/Stop */}
      {running ? (
        <button
          className="btn btn-sm"
          onClick={handleStop}
          style={{ background: 'var(--accent-red)', color: 'white', fontSize: 11 }}
        >
          Stop
        </button>
      ) : (
        <button
          className="btn btn-primary btn-sm"
          onClick={handleStart}
          style={{ fontSize: 11 }}
        >
          Avvia App
        </button>
      )}

      {/* Open in browser */}
      {running && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            color: 'var(--accent-blue)', textDecoration: 'none',
          }}
        >
          Apri nel browser
        </a>
      )}

      {/* Build Process toggle */}
      <button
        className="btn-icon"
        onClick={onToggleBuildProcess}
        title={showBuildProcess ? 'Mostra Preview' : 'Mostra Build Process'}
        style={{
          opacity: showBuildProcess ? 1 : 0.5,
          color: showBuildProcess ? 'var(--accent-blue)' : undefined,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v16H4z M4 12h16 M12 4v16"/>
        </svg>
      </button>
    </div>
  );
}
