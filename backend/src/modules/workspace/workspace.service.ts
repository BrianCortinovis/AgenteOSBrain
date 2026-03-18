import db from '../../database/connection';

export function getWorkspaceConfig(key: string): string {
  const row: any = db.prepare('SELECT value FROM workspace_config WHERE key = ?').get(key);
  return row?.value || '';
}

export function setWorkspaceConfig(key: string, value: string): void {
  db.prepare(
    `INSERT INTO workspace_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

export function getAllWorkspaceConfig(): Record<string, string> {
  const rows: any[] = db.prepare('SELECT key, value FROM workspace_config').all();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

/** Returns the SOUL personality text, prepended to all agent system prompts */
export function getSoulPrompt(): string {
  return getWorkspaceConfig('soul');
}

/** Returns the workspace identity name */
export function getIdentity(): string {
  return getWorkspaceConfig('identity') || 'Agent OS Brain';
}

/** Returns the list of allowed tool names */
export function getAllowedTools(): string[] {
  try {
    return JSON.parse(getWorkspaceConfig('tool_permissions') || '[]');
  } catch {
    return [];
  }
}
