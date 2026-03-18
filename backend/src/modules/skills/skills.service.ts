import db from '../../database/connection';
import { generateId } from '../../utils/id';
import fs from 'fs';
import path from 'path';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  content: string;
  config_schema: Record<string, any>;
  enabled: number;
  installed_at: string;
}

// ─── CRUD ───────────────────────────────────────────────────────

export function getAllSkills(): Skill[] {
  const rows: any[] = db.prepare('SELECT * FROM skills ORDER BY category, name').all();
  return rows.map(parseSkillRow);
}

export function getEnabledSkills(): Skill[] {
  const rows: any[] = db.prepare('SELECT * FROM skills WHERE enabled = 1 ORDER BY category, name').all();
  return rows.map(parseSkillRow);
}

export function getSkillById(id: string): Skill | null {
  const row: any = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
  return row ? parseSkillRow(row) : null;
}

export function getSkillByName(name: string): Skill | null {
  const row: any = db.prepare('SELECT * FROM skills WHERE name = ?').get(name);
  return row ? parseSkillRow(row) : null;
}

export function installSkill(data: {
  name: string;
  description?: string;
  category?: string;
  version?: string;
  author?: string;
  content: string;
  config_schema?: Record<string, any>;
}): Skill {
  const id = generateId();
  db.prepare(
    `INSERT OR REPLACE INTO skills (id, name, description, category, version, author, content, config_schema)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.name,
    data.description || '',
    data.category || 'general',
    data.version || '1.0.0',
    data.author || '',
    data.content,
    JSON.stringify(data.config_schema || {}),
  );
  return getSkillById(id)!;
}

export function uninstallSkill(id: string): void {
  db.prepare('DELETE FROM skills WHERE id = ?').run(id);
}

export function toggleSkill(id: string, enabled: boolean): Skill | null {
  db.prepare('UPDATE skills SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return getSkillById(id);
}

// ─── SKILL.md Parser (OpenClaw format) ──────────────────────────

/**
 * Parse a SKILL.md file into a skill definition.
 * OpenClaw format:
 * ---
 * name: skill-name
 * description: What the skill does
 * category: category
 * version: 1.0.0
 * author: Author Name
 * ---
 *
 * Skill content/instructions here...
 */
export function parseSkillMd(content: string): {
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  content: string;
} {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { name: 'unnamed', description: '', category: 'general', version: '1.0.0', author: '', content };
  }

  const meta: Record<string, string> = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      meta[key] = value;
    }
  }

  return {
    name: meta.name || 'unnamed',
    description: meta.description || '',
    category: meta.category || 'general',
    version: meta.version || '1.0.0',
    author: meta.author || '',
    content: frontmatterMatch[2].trim(),
  };
}

/**
 * Install a skill from a SKILL.md file path.
 */
export function installSkillFromFile(filePath: string): Skill {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseSkillMd(raw);
  return installSkill(parsed);
}

/**
 * Install all skills from a directory (each .md file is a skill).
 */
export function installSkillsFromDirectory(dirPath: string): Skill[] {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  return files.map(f => installSkillFromFile(path.join(dirPath, f)));
}

/**
 * Get skill content for injection into agent prompts.
 * Returns combined content of all enabled skills matching the query.
 */
export function getSkillContext(query: string, limit: number = 3): string {
  const skills = getEnabledSkills();
  if (skills.length === 0) return '';

  const queryLower = query.toLowerCase();
  const matched = skills
    .map(s => ({
      ...s,
      score: calculateSkillRelevance(s, queryLower),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (matched.length === 0) return '';

  return '\n=== Skill Attive ===\n' +
    matched.map(s => `[${s.name}] ${s.content.slice(0, 500)}`).join('\n\n') +
    '\n====================\n';
}

// ─── Helpers ────────────────────────────────────────────────────

function parseSkillRow(row: any): Skill {
  return {
    ...row,
    config_schema: safeParseJSON(row.config_schema),
  };
}

function safeParseJSON(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function calculateSkillRelevance(skill: Skill, query: string): number {
  let score = 0;
  const haystack = `${skill.name} ${skill.description} ${skill.category}`.toLowerCase();
  const words = query.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    if (haystack.includes(word)) score += 2;
    if (skill.content.toLowerCase().includes(word)) score += 1;
  }
  return score;
}
