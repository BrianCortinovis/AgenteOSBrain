import db from '../../database/connection';
import { generateId } from '../../utils/id';

export function getGraph(projectId: string) {
  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
  const edges = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(projectId);
  return { nodes, edges };
}

export function saveGraph(projectId: string, data: { nodes: any[]; edges: any[] }) {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM edges WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM nodes WHERE project_id = ?').run(projectId);

    for (const node of data.nodes) {
      db.prepare(
        `INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        node.id, projectId, node.type || 'sorgente', node.label || 'Nuovo Nodo',
        node.description || '', node.state || 'bozza', node.color || '',
        JSON.stringify(node.config || {}), node.position_x || 0, node.position_y || 0,
        node.width || 200, node.height || 80, node.agent_id || null,
        node.provider_id || '', node.model_id || '', node.system_prompt || ''
      );
    }

    for (const edge of data.edges) {
      db.prepare(
        'INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(edge.id, projectId, edge.source_id, edge.target_id, edge.label || '', edge.condition || '');
    }

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), projectId);
  });
  transaction();
  return getGraph(projectId);
}

export function createNode(projectId: string, data: any) {
  const id = data.id || generateId();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, projectId, data.type || 'sorgente', data.label || 'Nuovo Nodo',
    data.description || '', data.state || 'bozza', data.color || '',
    typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {}), data.position_x || 0, data.position_y || 0,
    data.width || 200, data.height || 80, data.agent_id || null,
    data.provider_id || '', data.model_id || '', data.system_prompt || ''
  );
  return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
}

export function updateNode(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['type', 'label', 'description', 'state', 'color', 'position_x', 'position_y', 'width', 'height', 'agent_id', 'provider_id', 'model_id', 'system_prompt'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  if (data.config !== undefined) {
    const configVal = typeof data.config === 'string' ? data.config : JSON.stringify(data.config);
    fields.push('config = ?');
    values.push(configVal);
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  values.push(id);
  db.prepare(`UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
}

export function deleteNode(id: string) {
  db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
}

export function createEdge(projectId: string, data: any) {
  const id = data.id || generateId();
  db.prepare(
    'INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, data.source_id, data.target_id, data.label || '', data.condition || '');
  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id);
}

export function deleteEdge(id: string) {
  db.prepare('DELETE FROM edges WHERE id = ?').run(id);
}
