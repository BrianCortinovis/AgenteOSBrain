import db from '../../database/connection';
import { generateId } from '../../utils/id';

export function getPrompts(scope?: string, scopeId?: string) {
  if (scope && scopeId) {
    return db.prepare('SELECT * FROM prompts WHERE scope = ? AND scope_id = ? ORDER BY created_at').all(scope, scopeId);
  }
  if (scope) {
    return db.prepare('SELECT * FROM prompts WHERE scope = ? ORDER BY created_at').all(scope);
  }
  return db.prepare('SELECT * FROM prompts ORDER BY scope, created_at').all();
}

export function getPromptById(id: string) {
  return db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
}

export function createPrompt(data: any) {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO prompts (id, scope, scope_id, name, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, data.scope || 'global', data.scope_id || '', data.name || 'Nuovo Prompt', data.content || '', data.category || 'generale', now, now);
  return getPromptById(id);
}

export function updatePrompt(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['name', 'content', 'category', 'scope', 'scope_id'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getPromptById(id);
}

export function deletePrompt(id: string) {
  db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
}
