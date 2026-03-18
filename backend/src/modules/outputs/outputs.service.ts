import db from '../../database/connection';
import { generateId } from '../../utils/id';
import fs from 'fs';

export function getOutputsByProject(projectId: string) {
  return db.prepare(
    `SELECT * FROM outputs
     WHERE project_id = ?
       AND type IN ('file', 'report')
     ORDER BY created_at DESC`
  ).all(projectId);
}

export function getOutputById(id: string) {
  return db.prepare('SELECT * FROM outputs WHERE id = ?').get(id);
}

export function createOutput(projectId: string, data: any) {
  const id = generateId();
  db.prepare(
    'INSERT INTO outputs (id, project_id, node_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, data.node_id || '', data.type || 'log', data.title || '', data.content || '', JSON.stringify(data.metadata || {}));
  return getOutputById(id);
}

export function deleteOutput(id: string) {
  const output: any = getOutputById(id);
  const filePath = output?.content;
  if ((output?.type === 'file' || output?.type === 'report') && filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  db.prepare('DELETE FROM outputs WHERE id = ?').run(id);
}
