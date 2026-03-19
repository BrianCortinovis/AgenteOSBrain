import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import db from '../../database/connection';
import { generateId } from '../../utils/id';
import { executeTool } from '../tools/tool-executors';

// ─── Initialize FLOW directory structure ────────────────────────
export function initFlowFS() {
  const dirs = [
    config.flowRoot,
    config.appsDir,
    config.flowDocsDir,
    config.flowWorkDir,
    config.flowMediaDir,
    config.flowDesktopDir,
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[FLOW] Creata directory: ${dir}`);
    }
  }
}

// ─── List directory contents ────────────────────────────────────
export type FlowFileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  type: string;
  category?: string;
};

export function listDirectory(dirPath?: string): FlowFileEntry[] {
  const targetPath = dirPath || config.flowRoot;
  if (!fs.existsSync(targetPath)) return [];

  return fs.readdirSync(targetPath)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const fullPath = path.join(targetPath, name);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(name).toLowerCase().replace('.', '');
      return {
        name,
        path: fullPath,
        isDirectory: stat.isDirectory(),
        size: stat.size,
        modified: stat.mtime.toISOString(),
        type: stat.isDirectory() ? 'folder' : ext,
        category: getCategoryFromPath(fullPath),
      };
    })
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
}

function getCategoryFromPath(filePath: string): string {
  if (filePath.includes('/Apps/')) return 'apps';
  if (filePath.includes('/Work/')) return 'work';
  if (filePath.includes('/Documents/')) return 'documents';
  if (filePath.includes('/Media/')) return 'media';
  if (filePath.includes('/Desktop/')) return 'desktop';
  return 'other';
}

// ─── Import file into FLOW ──────────────────────────────────────
export function importFile(fileName: string, content: string | Buffer, category?: string): string {
  const cat = category || guessCategory(fileName);
  let targetDir: string;

  switch (cat) {
    case 'media': targetDir = config.flowMediaDir; break;
    case 'apps': targetDir = config.appsDir; break;
    case 'work': targetDir = config.flowWorkDir; break;
    default: {
      const now = new Date();
      const monthDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      targetDir = path.join(config.flowDocsDir, monthDir);
    }
  }

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(targetDir, safeName);
  fs.writeFileSync(filePath, content);

  // Index the file
  indexFile(filePath);

  return filePath;
}

function guessCategory(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.mov', '.mp3', '.wav'].includes(ext)) return 'media';
  return 'documents';
}

// ─── Index file in DB for AI search ─────────────────────────────
export function indexFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return;

  const name = path.basename(filePath);
  const ext = path.extname(name).toLowerCase().replace('.', '');
  const category = getCategoryFromPath(filePath);

  // Extract content preview
  let contentPreview = '';
  try {
    if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'html', 'css', 'py', 'sql'].includes(ext)) {
      contentPreview = fs.readFileSync(filePath, 'utf-8').slice(0, 1000);
    }
  } catch {}

  const id = generateId();
  try {
    db.prepare(`INSERT OR REPLACE INTO flow_files (id, path, name, type, size, category, content_preview, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, filePath, name, ext, stat.size, category, contentPreview, JSON.stringify([ext, category]));
  } catch {}
}

// ─── Update file summary (called after AI generates it) ─────────
export function updateFileSummary(filePath: string, summary: string, tags: string[]) {
  try {
    db.prepare('UPDATE flow_files SET summary = ?, tags = ? WHERE path = ?')
      .run(summary, JSON.stringify(tags), filePath);
  } catch {}
}

// ─── Search files ───────────────────────────────────────────────
export function searchFiles(query: string, limit: number = 20): any[] {
  try {
    return db.prepare(
      `SELECT f.* FROM flow_files f
       JOIN flow_files_fts fts ON f.rowid = fts.rowid
       WHERE flow_files_fts MATCH ?
       ORDER BY rank LIMIT ?`
    ).all(query, limit);
  } catch {
    // Fallback to LIKE search
    return db.prepare(
      `SELECT * FROM flow_files WHERE name LIKE ? OR summary LIKE ? LIMIT ?`
    ).all(`%${query}%`, `%${query}%`, limit);
  }
}

// ─── Get recent files ───────────────────────────────────────────
export function getRecentFiles(limit: number = 20): any[] {
  try {
    return db.prepare('SELECT * FROM flow_files ORDER BY indexed_at DESC LIMIT ?').all(limit);
  } catch {
    return [];
  }
}

// ─── Get all indexed files ──────────────────────────────────────
export function getAllIndexedFiles(): any[] {
  try {
    return db.prepare('SELECT * FROM flow_files ORDER BY category, name').all();
  } catch {
    return [];
  }
}

// ─── File operations ────────────────────────────────────────────
export function moveFile(fromPath: string, toPath: string) {
  if (!fs.existsSync(fromPath)) throw new Error(`File non trovato: ${fromPath}`);
  const toDir = path.dirname(toPath);
  if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, { recursive: true });
  fs.renameSync(fromPath, toPath);
  // Update index
  db.prepare('UPDATE flow_files SET path = ?, category = ? WHERE path = ?')
    .run(toPath, getCategoryFromPath(toPath), fromPath);
}

export function deleteFile(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM flow_files WHERE path = ?').run(filePath);
}

export function createDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ─── Read file content (for AI) ────────────────────────────────
export async function readFileForAI(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();

  // Use parse_document for complex formats
  if (['.pdf', '.docx', '.xlsx', '.xls', '.csv'].includes(ext)) {
    const result = await executeTool('parse_document', { path: filePath }, { projectId: '__flow__' });
    return result.success ? result.output : '';
  }

  // Read text files directly
  try {
    return fs.readFileSync(filePath, 'utf-8').slice(0, 30000);
  } catch {
    return `[File binario: ${path.basename(filePath)}, ${fs.statSync(filePath).size} bytes]`;
  }
}

// ─── Scan and index all existing files ──────────────────────────
export function scanAndIndex(rootDir?: string) {
  const dir = rootDir || config.flowRoot;
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAndIndex(fullPath);
    } else {
      indexFile(fullPath);
    }
  }
}
