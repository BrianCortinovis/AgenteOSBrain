import db from '../../database/connection';
import { generateId } from '../../utils/id';

export interface MemoryEntry {
  id: string;
  project_id: string | null;
  agent_id: string | null;
  content: string;
  summary: string;
  tags: string[];
  source: string;
  importance: number;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
}

// ─── CRUD ───────────────────────────────────────────────────────

export function saveMemory(data: {
  project_id?: string;
  agent_id?: string;
  content: string;
  summary?: string;
  tags?: string[];
  source?: string;
  importance?: number;
}): MemoryEntry {
  const id = generateId();
  db.prepare(
    `INSERT INTO memory_entries (id, project_id, agent_id, content, summary, tags, source, importance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.project_id || null,
    data.agent_id || null,
    data.content,
    data.summary || '',
    JSON.stringify(data.tags || []),
    data.source || '',
    data.importance ?? 0.5
  );
  return getMemoryById(id)!;
}

export function getMemoryById(id: string): MemoryEntry | null {
  const row: any = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id);
  return row ? parseMemoryRow(row) : null;
}

export function getMemoriesByProject(projectId: string, limit: number = 50): MemoryEntry[] {
  const rows: any[] = db.prepare(
    'SELECT * FROM memory_entries WHERE project_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?'
  ).all(projectId, limit);
  return rows.map(parseMemoryRow);
}

export function getMemoriesByAgent(agentId: string, limit: number = 50): MemoryEntry[] {
  const rows: any[] = db.prepare(
    'SELECT * FROM memory_entries WHERE agent_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?'
  ).all(agentId, limit);
  return rows.map(parseMemoryRow);
}

export function deleteMemory(id: string): void {
  db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
}

export function deleteMemoriesByProject(projectId: string): void {
  db.prepare('DELETE FROM memory_entries WHERE project_id = ?').run(projectId);
}

// ─── Full-Text Search ───────────────────────────────────────────

export function searchMemory(query: string, options: {
  project_id?: string;
  agent_id?: string;
  limit?: number;
} = {}): MemoryEntry[] {
  const limit = options.limit || 10;

  // Build FTS query - escape special characters and add prefix matching
  const ftsQuery = query
    .replace(/[^\w\s\u00C0-\u024F]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1)
    .map(w => `"${w}"*`)
    .join(' OR ');

  if (!ftsQuery) return [];

  let sql = `
    SELECT me.*, rank
    FROM memory_fts
    JOIN memory_entries me ON me.rowid = memory_fts.rowid
    WHERE memory_fts MATCH ?
  `;
  const params: any[] = [ftsQuery];

  if (options.project_id) {
    sql += ' AND me.project_id = ?';
    params.push(options.project_id);
  }
  if (options.agent_id) {
    sql += ' AND me.agent_id = ?';
    params.push(options.agent_id);
  }

  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  try {
    const rows: any[] = db.prepare(sql).all(...params);
    // Update access count for retrieved memories
    for (const row of rows) {
      db.prepare(
        `UPDATE memory_entries SET access_count = access_count + 1, last_accessed = datetime('now') WHERE id = ?`
      ).run(row.id);
    }
    return rows.map(parseMemoryRow);
  } catch {
    // Fallback to LIKE search if FTS fails
    return searchMemoryFallback(query, options);
  }
}

function searchMemoryFallback(query: string, options: {
  project_id?: string;
  agent_id?: string;
  limit?: number;
}): MemoryEntry[] {
  const limit = options.limit || 10;
  let sql = 'SELECT * FROM memory_entries WHERE (content LIKE ? OR summary LIKE ? OR tags LIKE ?)';
  const pattern = `%${query}%`;
  const params: any[] = [pattern, pattern, pattern];

  if (options.project_id) {
    sql += ' AND project_id = ?';
    params.push(options.project_id);
  }
  if (options.agent_id) {
    sql += ' AND agent_id = ?';
    params.push(options.agent_id);
  }

  sql += ' ORDER BY importance DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const rows: any[] = db.prepare(sql).all(...params);
  return rows.map(parseMemoryRow);
}

// ─── Memory Extraction from AI output ───────────────────────────

/**
 * Extract key facts from AI output and save them as memories.
 * Used after node execution when agent has memory_enabled.
 */
export function extractAndSaveMemories(
  output: string,
  projectId: string,
  agentId?: string,
  source?: string
): MemoryEntry[] {
  const saved: MemoryEntry[] = [];

  // Skip very short or error outputs
  if (!output || output.length < 50 || output.startsWith('Errore:')) return saved;

  // Save a condensed version of the output as memory
  const content = output.length > 2000 ? output.slice(0, 2000) + '...' : output;

  // Extract tags from content
  const tags = extractTags(content);

  saved.push(saveMemory({
    project_id: projectId,
    agent_id: agentId || undefined,
    content,
    summary: content.slice(0, 200),
    tags,
    source: source || 'node_execution',
    importance: calculateImportance(content),
  }));

  return saved;
}

/** Build a memory context string for injection into AI prompts */
export function buildMemoryContext(projectId: string, query: string, limit: number = 5): string {
  const memories = searchMemory(query, { project_id: projectId, limit });
  if (memories.length === 0) return '';

  const lines = memories.map((m, i) =>
    `[Memoria ${i + 1}] ${m.summary || m.content.slice(0, 200)}${m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''}`
  );
  return `\n=== Memoria Persistente ===\n${lines.join('\n')}\n===========================\n`;
}

// ─── Compaction ─────────────────────────────────────────────────

/**
 * Compact old memories: summarize and merge similar ones.
 * Keeps the most important and recently accessed memories.
 */
export function compactMemories(projectId: string, maxEntries: number = 100): number {
  const count: any = db.prepare(
    'SELECT COUNT(*) as cnt FROM memory_entries WHERE project_id = ?'
  ).get(projectId);

  if (count.cnt <= maxEntries) return 0;

  // Delete oldest, least important, least accessed memories
  const toDelete = count.cnt - maxEntries;
  db.prepare(
    `DELETE FROM memory_entries WHERE id IN (
      SELECT id FROM memory_entries
      WHERE project_id = ?
      ORDER BY importance ASC, access_count ASC, created_at ASC
      LIMIT ?
    )`
  ).run(projectId, toDelete);

  return toDelete;
}

// ─── Helpers ────────────────────────────────────────────────────

function parseMemoryRow(row: any): MemoryEntry {
  return {
    ...row,
    tags: safeParseTags(row.tags),
  };
}

function safeParseTags(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  if (/report|analisi|assessment/i.test(lower)) tags.push('report');
  if (/errore|error|bug|fix/i.test(lower)) tags.push('errore');
  if (/decisione|decision|scelto|scelta/i.test(lower)) tags.push('decisione');
  if (/immagin|foto|image|video/i.test(lower)) tags.push('media');
  if (/codice|code|html|css|javascript/i.test(lower)) tags.push('codice');
  if (/api|endpoint|webhook/i.test(lower)) tags.push('api');
  if (/email|messaggio|notifica/i.test(lower)) tags.push('comunicazione');
  if (/database|sql|tabella/i.test(lower)) tags.push('database');

  return tags.slice(0, 5);
}

function calculateImportance(content: string): number {
  let score = 0.5;
  // Longer content tends to be more informative
  if (content.length > 500) score += 0.1;
  if (content.length > 1000) score += 0.1;
  // Structured content is often more valuable
  if (content.includes('===') || content.includes('---')) score += 0.05;
  if (/\d+\.\s/.test(content)) score += 0.05; // Numbered lists
  // Cap at 1.0
  return Math.min(score, 1.0);
}
