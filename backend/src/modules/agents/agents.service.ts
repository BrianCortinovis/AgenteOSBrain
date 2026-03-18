import db from '../../database/connection';
import { generateId } from '../../utils/id';
import { providerRegistry } from '../providers/provider-registry';

export const GLOBAL_AGENTS_PROJECT_ID = '__global_agents__';

const DEFAULT_METADATA = {
  category: 'generalista',
  summary: '',
  capabilities: [],
};

function stringifyJson(value: any, fallback: any) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? fallback);
}

function parseJson<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeTextList(values: any): string[] {
  const arr = Array.isArray(values) ? values : [];
  return arr
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeAgentMetadata(metadata: any) {
  const parsed = parseJson<Record<string, any>>(metadata, DEFAULT_METADATA);
  return {
    category: String(parsed.category || DEFAULT_METADATA.category).trim() || DEFAULT_METADATA.category,
    summary: String(parsed.summary || '').trim(),
    capabilities: normalizeTextList(parsed.capabilities),
  };
}

function extractJsonObject(content: string): any | null {
  const raw = content.trim();
  const candidates = [raw];
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

export function getAgentsByProject(projectId: string) {
  return db.prepare(
    `SELECT * FROM agents
     WHERE project_id = ? OR scope = 'global'
     ORDER BY
       CASE WHEN scope = 'global' THEN 0 ELSE 1 END,
       created_at`
  ).all(projectId);
}

export function getAgentById(id: string) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}

export function createAgent(projectId: string, data: any) {
  const id = generateId();
  const scope = data.scope === 'project' ? 'project' : 'global';
  const ownerProjectId = scope === 'global' ? GLOBAL_AGENTS_PROJECT_ID : projectId;
  db.prepare(
    `INSERT INTO agents (id, project_id, name, role, provider_id, model_id, system_prompt, temperature, tools, memory_enabled, fallback_provider_id, fallback_model_id, metadata, scope, source_project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, ownerProjectId, data.name || 'Nuovo Agente', data.role || '',
    data.provider_id || 'openai', data.model_id || 'gpt-4o',
    data.system_prompt || '', data.temperature ?? 0.7,
    stringifyJson(data.tools, []), data.memory_enabled ? 1 : 0,
    data.fallback_provider_id || '', data.fallback_model_id || '',
    stringifyJson(normalizeAgentMetadata(data.metadata), DEFAULT_METADATA),
    scope,
    projectId,
  );
  return getAgentById(id);
}

export function updateAgent(id: string, data: any) {
  const current: any = getAgentById(id);
  if (!current) return null;

  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['name', 'role', 'provider_id', 'model_id', 'system_prompt', 'temperature', 'memory_enabled', 'fallback_provider_id', 'fallback_model_id'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'memory_enabled') { fields.push(`${key} = ?`); values.push(data[key] ? 1 : 0); }
      else { fields.push(`${key} = ?`); values.push(data[key]); }
    }
  }
  if (data.tools !== undefined) { fields.push('tools = ?'); values.push(JSON.stringify(data.tools)); }
  if (data.metadata !== undefined) { fields.push('metadata = ?'); values.push(stringifyJson(normalizeAgentMetadata(data.metadata), DEFAULT_METADATA)); }
  if (data.scope !== undefined) {
    const scope = data.scope === 'project' ? 'project' : 'global';
    const sourceProjectId = data.source_project_id || current.source_project_id || current.project_id;
    fields.push('scope = ?');
    values.push(scope);
    fields.push('project_id = ?');
    values.push(scope === 'global' ? GLOBAL_AGENTS_PROJECT_ID : sourceProjectId);
    fields.push('source_project_id = ?');
    values.push(sourceProjectId);
  }
  if (fields.length === 0) return current;
  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getAgentById(id);
}

export function deleteAgent(id: string) {
  db.prepare('UPDATE nodes SET agent_id = NULL WHERE agent_id = ?').run(id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

export async function generateAgentDraft(projectId: string, data: any) {
  const project: any = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const existingAgents: any[] = getAgentsByProject(projectId);
  const providerId = data.provider_id || 'anthropic';
  const modelId = data.model_id || 'claude-cli';
  const description = String(data.description || '').trim();

  if (!description) throw new Error('Descrizione agente richiesta');

  const systemPrompt = `Sei un progettista di agenti AI dentro Agent OS.
Restituisci SEMPRE e SOLO JSON valido, senza testo extra, con questa forma:
{
  "name": "Nome agente",
  "role": "Ruolo operativo sintetico",
  "provider_id": "${providerId}",
  "model_id": "${modelId}",
  "temperature": 0.4,
  "memory_enabled": true,
  "fallback_provider_id": "",
  "fallback_model_id": "",
  "tools": ["azione 1", "azione 2"],
  "metadata": {
    "category": "generalista | analista | builder | revisore | ricercatore | automazione | contenuti | supporto | custom",
    "summary": "breve descrizione operativa",
    "capabilities": ["capacita 1", "capacita 2", "capacita 3"]
  },
  "system_prompt": "prompt di sistema completo, pronto all'uso, in italiano"
}

Regole:
- L'agente deve essere realistico e riutilizzabile in un workflow.
- "tools" descrive le azioni principali che l'agente sa svolgere.
- "metadata.category" classifica il tipo di agente.
- "metadata.capabilities" deve contenere capacità concrete e richiamabili.
- Il system_prompt deve essere subito utilizzabile nel prodotto.
- Non restituire markdown.`;

  const context = `Progetto: ${project?.name || 'senza nome'}
Descrizione progetto: ${project?.description || ''}
Agenti già presenti:
${existingAgents.map((agent) => `- ${agent.name}: ${agent.role || 'nessun ruolo'}`).join('\n') || '- nessuno'}

Richiesta utente:
${description}`;

  const response = await providerRegistry.chat(
    providerId,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context },
    ],
    modelId,
    { temperature: 0.3, max_tokens: 3000 },
  );

  const parsed = extractJsonObject(response.content);
  if (!parsed) throw new Error('Il modello non ha restituito una bozza agente valida');

  return {
    name: String(parsed.name || 'Nuovo Agente').trim(),
    role: String(parsed.role || '').trim(),
    provider_id: String(parsed.provider_id || providerId).trim() || providerId,
    model_id: String(parsed.model_id || modelId).trim() || modelId,
    temperature: Number.isFinite(parsed.temperature) ? Number(parsed.temperature) : 0.4,
    memory_enabled: parsed.memory_enabled !== false,
    fallback_provider_id: String(parsed.fallback_provider_id || '').trim(),
    fallback_model_id: String(parsed.fallback_model_id || '').trim(),
    tools: normalizeTextList(parsed.tools),
    metadata: normalizeAgentMetadata(parsed.metadata),
    system_prompt: String(parsed.system_prompt || '').trim(),
    usage: response.usage,
  };
}
