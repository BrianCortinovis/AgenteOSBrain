import db from '../../database/connection';
import { generateId } from '../../utils/id';
import { GLOBAL_AGENTS_PROJECT_ID } from '../agents/agents.service';

export function getAllProjects() {
  return db.prepare('SELECT * FROM projects WHERE id != ? ORDER BY updated_at DESC').all(GLOBAL_AGENTS_PROJECT_ID);
}

export function getProjectById(id: string) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

export function createProject(data: { name: string; description?: string }) {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.name, data.description || '', 'bozza', now, now);
  return getProjectById(id);
}

export function updateProject(id: string, data: Partial<{ name: string; description: string; status: string }>) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getProjectById(id);
}

export function deleteProject(id: string) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function duplicateProject(id: string) {
  const original: any = getProjectById(id);
  if (!original) return null;
  const newProject = createProject({ name: `${original.name} (copia)`, description: original.description });
  if (!newProject) return null;
  const newId = (newProject as any).id;

  const agents: any[] = db.prepare('SELECT * FROM agents WHERE project_id = ? AND scope != ?').all(id, 'global');
  const agentIdMap: Record<string, string> = {};
  for (const agent of agents) {
    const newAgentId = generateId();
    agentIdMap[agent.id] = newAgentId;
    db.prepare(
      'INSERT INTO agents (id, project_id, name, role, provider_id, model_id, system_prompt, temperature, tools, memory_enabled, fallback_provider_id, fallback_model_id, metadata, scope, source_project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      newAgentId,
      newId,
      agent.name,
      agent.role,
      agent.provider_id,
      agent.model_id,
      agent.system_prompt,
      agent.temperature,
      agent.tools,
      agent.memory_enabled,
      agent.fallback_provider_id,
      agent.fallback_model_id,
      agent.metadata || '{}',
      'project',
      newId,
    );
  }

  const nodes: any[] = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(id);
  const nodeIdMap: Record<string, string> = {};
  for (const node of nodes) {
    const newNodeId = generateId();
    nodeIdMap[node.id] = newNodeId;
    db.prepare(
      'INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      newNodeId,
      newId,
      node.type,
      node.label,
      node.description,
      'bozza',
      node.color,
      node.config,
      node.position_x,
      node.position_y,
      node.width,
      node.height,
      node.agent_id ? agentIdMap[node.agent_id] || node.agent_id : null,
      node.provider_id,
      node.model_id,
      node.system_prompt,
    );
  }

  const edges: any[] = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(id);
  for (const edge of edges) {
    const newSource = nodeIdMap[edge.source_id];
    const newTarget = nodeIdMap[edge.target_id];
    if (newSource && newTarget) {
      db.prepare(
        'INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(generateId(), newId, newSource, newTarget, edge.label, edge.condition);
    }
  }

  return getProjectById(newId);
}
