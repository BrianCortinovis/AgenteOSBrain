import db from '../../database/connection';
import { generateId } from '../../utils/id';
import { reloadScheduleJob, stopScheduleJob } from './scheduler.runtime';

export function getSchedulesByProject(projectId: string) {
  return db.prepare('SELECT * FROM schedules WHERE project_id = ? ORDER BY created_at').all(projectId);
}

export function getScheduleById(id: string) {
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}

export function createSchedule(projectId: string, data: any) {
  const id = generateId();
  db.prepare(
    'INSERT INTO schedules (id, project_id, node_id, name, trigger_type, cron_expr, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, data.node_id || '', data.name || 'Nuova Automazione', data.trigger_type || 'manual', data.cron_expr || '', data.enabled !== false ? 1 : 0);
  const schedule = getScheduleById(id);
  // Start cron job if enabled and not manual
  reloadScheduleJob(id);
  return schedule;
}

export function updateSchedule(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = ['name', 'node_id', 'trigger_type', 'cron_expr'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (data.last_run !== undefined) { fields.push('last_run = ?'); values.push(data.last_run); }
  if (data.next_run !== undefined) { fields.push('next_run = ?'); values.push(data.next_run); }
  if (fields.length === 0) return getScheduleById(id);
  values.push(id);
  db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  // Reload cron job with new settings
  reloadScheduleJob(id);
  return getScheduleById(id);
}

export function deleteSchedule(id: string) {
  stopScheduleJob(id);
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

export function triggerSchedule(id: string) {
  const now = new Date().toISOString();
  db.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(now, id);
  return getScheduleById(id);
}
