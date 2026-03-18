import { useProjectStore } from '../../stores/useProjectStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { t } from '../../i18n/it';

const NODE_TYPES = [
  { type: 'sorgente', label: 'Sorgente', color: '#3b82f6' },
  { type: 'analisi', label: 'Analisi', color: '#8b5cf6' },
  { type: 'decisione', label: 'Decisione', color: '#f59e0b' },
  { type: 'esecuzione', label: 'Esecuzione', color: '#10b981' },
  { type: 'memoria', label: 'Memoria', color: '#6366f1' },
  { type: 'automazione', label: 'Automazione', color: '#ec4899' },
];

export default function GraphToolbar() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const addNode = useGraphStore(s => s.addNode);

  const handleAddNode = async (type: string) => {
    if (!currentProjectId) return;
    const nodeInfo = NODE_TYPES.find(n => n.type === type)!;
    const offset = Math.random() * 400;
    await addNode(currentProjectId, {
      type,
      label: `Nuovo ${nodeInfo.label}`,
      position_x: 200 + offset,
      position_y: 150 + Math.random() * 300,
      color: nodeInfo.color,
    });
  };

  return (
    <div style={{
      display: 'flex', gap: 4, background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
      padding: '6px 8px', boxShadow: 'var(--shadow-md)',
    }}>
      {NODE_TYPES.map(nt => (
        <button
          key={nt.type}
          className="btn btn-sm btn-secondary"
          onClick={() => handleAddNode(nt.type)}
          title={`Aggiungi ${nt.label}`}
          style={{ gap: 5 }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: 2,
            background: nt.color, flexShrink: 0,
          }}/>
          {nt.label}
        </button>
      ))}
    </div>
  );
}
