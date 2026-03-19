import db from '../database/connection';
import { generateId } from '../utils/id';
import { providerRegistry } from '../modules/providers/provider-registry';
import { callClaudeCLI } from '../modules/providers/adapters/claude-bridge';
import { getAnthropicMode } from '../modules/providers/adapters/anthropic.adapter';
import { GeminiAdapter } from '../modules/providers/adapters/gemini.adapter';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { loadSettings } from '../modules/providers/settings.service';
import { getFallbackModelSelection, selectBestModelForTask } from '../modules/providers/model-routing';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getSoulPrompt } from '../modules/workspace/workspace.service';
import { buildMemoryContext, extractAndSaveMemories } from '../modules/memory/memory.service';
import { getToolsByNames, callAIWithTools } from '../modules/tools/tools.service';
import { executeConnectorAction } from '../modules/connectors/executors/registry';
import { workspaces } from '../modules/tools/tool-executors';

const execFileAsync = promisify(execFile);

type ExecutionProgress = {
  current: number;
  total: number;
  percent: number;
};

type ExecutionLog = {
  nodeId: string;
  label: string;
  status: string;
  output: string;
  duration: number;
  message?: string;
  error?: string;
  progress?: ExecutionProgress;
  providerId?: string;
  modelId?: string;
  agentName?: string;
  debugFile?: string;
};

// --- Execution state management ---
const runningProjects = new Map<string, { status: 'running' | 'paused' | 'stopping'; resolve?: () => void }>();

export function getExecutionState(projectId: string) {
  const liveState = runningProjects.get(projectId)?.status;
  if (liveState) return liveState;

  const project: any = db.prepare('SELECT status FROM projects WHERE id = ?').get(projectId);
  if (project?.status === 'in_esecuzione' || project?.status === 'in_pausa') {
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run('fermato', new Date().toISOString(), projectId);
  }

  return 'idle';
}

export function pauseProject(projectId: string) {
  const state = runningProjects.get(projectId);
  if (state && state.status === 'running') {
    state.status = 'paused';
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_pausa', projectId);
    return true;
  }
  return false;
}

export function resumeProject(projectId: string) {
  const state = runningProjects.get(projectId);
  if (state && state.status === 'paused') {
    state.status = 'running';
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_esecuzione', projectId);
    if (state.resolve) state.resolve();
    return true;
  }
  return false;
}

export function getWorkspaceInfo(projectId: string) {
  const ws = workspaces.get(projectId);
  if (ws) return ws;
  // Check DB
  const row: any = db.prepare('SELECT workspace_path, project_type, dev_server_port FROM projects WHERE id = ?').get(projectId);
  if (row?.workspace_path) {
    return { path: row.workspace_path, type: row.project_type || '', projectId };
  }
  return null;
}

export function stopProject(projectId: string) {
  const state = runningProjects.get(projectId);
  if (state) {
    state.status = 'stopping';
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('fermato', projectId);
    if (state.resolve) state.resolve();
    return true;
  }
  return false;
}

function waitForResume(projectId: string): Promise<void> {
  const state = runningProjects.get(projectId);
  if (!state || state.status !== 'paused') return Promise.resolve();
  return new Promise<void>(resolve => { state.resolve = resolve; });
}

function makeProgress(current: number, total: number): ExecutionProgress {
  return {
    current,
    total,
    percent: total > 0 ? Math.round((current / total) * 100) : 0,
  };
}

function resolveNodeModelSelection(node: any, agent: any) {
  if (agent?.provider_id && agent?.model_id) {
    return {
      providerId: agent.provider_id,
      modelId: agent.model_id,
    };
  }

  return selectBestModelForTask(node, {
    fallback: getFallbackModelSelection({
      providerId: node?.provider_id,
      modelId: node?.model_id,
    }),
    // Existing graphs often inherited the chat model everywhere.
    // For free nodes without a bound agent, auto-route to a more suitable model.
    allowOverrideExplicit: true,
  });
}

function resolveSourcePath(nodeConfig: any) {
  const directPath = nodeConfig.source_path || nodeConfig.folder_path || '';
  if (directPath) return String(directPath).trim();

  const contentPath = String(nodeConfig.content || '').trim();
  if (contentPath.startsWith('/') || contentPath.startsWith('~/')) {
    return contentPath.startsWith('~/')
      ? path.join(process.env.HOME || '', contentPath.slice(2))
      : contentPath;
  }

  return '';
}

// --- Output directory ---
// Structure: outputs/{ProjectName}/run_{NNN}/{AgentOrNodeName}/
function getBaseOutputDir(projectId: string): string {
  const settings = loadSettings();
  const baseDir = (settings as any).outputs_dir || config.outputsDir;
  // Get project name for folder
  const project: any = db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId);
  const projectName = project?.name
    ? project.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
    : projectId;
  const dir = path.join(baseDir, projectName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createRunDir(projectId: string): string {
  const baseDir = getBaseOutputDir(projectId);
  // Find next run number
  let runNum = 1;
  if (fs.existsSync(baseDir)) {
    const existing = fs.readdirSync(baseDir).filter(f => f.startsWith('run_'));
    if (existing.length > 0) {
      const nums = existing.map(f => parseInt(f.replace('run_', ''), 10)).filter(n => !isNaN(n));
      if (nums.length > 0) runNum = Math.max(...nums) + 1;
    }
  }
  const runDir = path.join(baseDir, `run_${String(runNum).padStart(3, '0')}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

function getAgentDir(runDir: string, agentName: string | null, nodeLabel: string): string {
  const folderName = (agentName || nodeLabel)
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_');
  const dir = path.join(runDir, folderName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Legacy: used by executeNode (single node, no run folder)
function getOutputDir(projectId: string): string {
  const baseDir = getBaseOutputDir(projectId);
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

function saveOutput(projectId: string, nodeId: string, type: string, title: string, content: string, metadata: any = {}) {
  const id = generateId();
  db.prepare(
    'INSERT INTO outputs (id, project_id, node_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, nodeId, type, title, content, JSON.stringify(metadata));
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function makeArtifactUrl(filePath: string): string {
  const normalizedOutputsDir = path.resolve(config.outputsDir);
  const normalizedFilePath = path.resolve(filePath);

  if (normalizedFilePath.startsWith(normalizedOutputsDir)) {
    const relPath = path.relative(normalizedOutputsDir, normalizedFilePath).split(path.sep).map(encodeURIComponent).join('/');
    return `/api/v1/outputs/files/${relPath}`;
  }

  const encodedPath = normalizedFilePath.startsWith('/')
    ? normalizedFilePath.slice(1).split('/').map(encodeURIComponent).join('/')
    : normalizedFilePath.split(path.sep).map(encodeURIComponent).join('/');
  return `/api/v1/local-files/${encodedPath}`;
}

function saveArtifactOutput(
  projectId: string,
  nodeId: string,
  type: 'file' | 'report',
  title: string,
  filePath: string,
  metadata: any = {},
) {
  saveOutput(projectId, nodeId, type, title, filePath, {
    filePath,
    previewUrl: makeArtifactUrl(filePath),
    mimeType: getMimeType(filePath),
    ...metadata,
  });
}

function updateNodeState(nodeId: string, state: string) {
  db.prepare('UPDATE nodes SET state = ? WHERE id = ?').run(state, nodeId);
}

// --- AI call (with SOUL personality injection) ---
async function callAI(providerId: string, modelId: string, systemPrompt: string, userPrompt: string): Promise<string> {
  // Inject SOUL personality as prefix to system prompt
  const soulPrompt = getSoulPrompt();
  const enrichedSystemPrompt = soulPrompt
    ? `[Personalità]\n${soulPrompt}\n\n${systemPrompt}`
    : systemPrompt;

  if ((providerId === 'anthropic' && getAnthropicMode() === 'claude_cli') || modelId === 'claude-cli') {
    const fullPrompt = enrichedSystemPrompt ? `${enrichedSystemPrompt}\n\n${userPrompt}` : userPrompt;
    return callClaudeCLI(fullPrompt, { timeout: 15 * 60 * 1000 });
  }
  const messages = [];
  if (enrichedSystemPrompt) messages.push({ role: 'system', content: enrichedSystemPrompt });
  messages.push({ role: 'user', content: userPrompt });
  const result = await providerRegistry.chat(providerId, messages, modelId);
  return result.content;
}

// --- AI call with tools support ---
async function callAIWithToolsWrapper(
  providerId: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  agentTools: string[],
  projectId: string,
  nodeId: string,
  agentId?: string,
  outputDir?: string,
): Promise<string> {
  const soulPrompt = getSoulPrompt();
  const enrichedSystemPrompt = soulPrompt
    ? `[Personalità]\n${soulPrompt}\n\n${systemPrompt}`
    : systemPrompt;

  const tools = getToolsByNames(agentTools);
  if (tools.length === 0) {
    return callAI(providerId, modelId, systemPrompt, userPrompt);
  }

  const result = await callAIWithTools(
    providerId,
    modelId,
    enrichedSystemPrompt,
    userPrompt,
    tools,
    { projectId, nodeId, agentId, outputDir },
  );

  if (result.toolCalls.length > 0) {
    console.log(`[Engine] Tool calls eseguiti: ${result.toolCalls.map(t => t.name).join(', ')}`);
  }

  return result.content;
}

// Image extensions supported for vision analysis
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']);

/**
 * Extract image files from a folder, sorted by modification time (newest first).
 */
function getImageFiles(folderPath: string): { path: string; name: string; mtime: Date; size: number }[] {
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const fullPath = path.join(folderPath, f);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(f).toLowerCase();
      return { path: fullPath, name: f, mtime: stat.mtime, size: stat.size, ext };
    })
    .filter(f => IMAGE_EXTENSIONS.has(f.ext) && f.size < 20 * 1024 * 1024) // Skip files > 20MB
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Newest first
  return files;
}

/**
 * Extract frames from video for analysis.
 * Uses ffmpeg to extract 1 frame every N seconds.
 */
async function extractVideoFrames(videoPath: string, outputDir: string, intervalSec: number = 3): Promise<string[]> {
  const framesDir = path.join(outputDir, '_video_frames');
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  const baseName = path.basename(videoPath, path.extname(videoPath));
  try {
    await execFileAsync('/opt/homebrew/bin/ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', `fps=1/${intervalSec}`,
      '-frames:v', '10', // Max 10 frames
      path.join(framesDir, `${baseName}_frame_%03d.jpg`)
    ], { timeout: 30000 });

    return fs.readdirSync(framesDir)
      .filter(f => f.startsWith(baseName) && f.endsWith('.jpg'))
      .map(f => path.join(framesDir, f))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Analyze images with Gemini Vision to detect specific objects/subjects.
 * Processes images from newest to oldest.
 * Returns list of matching files with descriptions.
 */
async function analyzeImagesForSearch(
  folderPath: string,
  searchQuery: string,
  systemPrompt: string,
  modelId: string,
  outputDir: string
): Promise<string> {
  const gemini = providerRegistry.get('gemini') as GeminiAdapter;
  if (!gemini) throw new Error('Provider Gemini non configurato. Serve per analisi immagini.');

  const imageFiles = getImageFiles(folderPath);
  if (imageFiles.length === 0) return 'Nessuna immagine trovata nella cartella.';

  // Also check for videos
  const videoFiles = fs.readdirSync(folderPath)
    .filter(f => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map(f => path.join(folderPath, f));

  const allResults: { file: string; found: boolean; confidence: string; description: string }[] = [];
  const batchSize = 4; // Analyze 4 images at a time to stay within limits

  console.log(`[Vision] Analisi ${imageFiles.length} immagini + ${videoFiles.length} video per: "${searchQuery}"`);

  // Analyze images in batches
  for (let i = 0; i < imageFiles.length; i += batchSize) {
    const batch = imageFiles.slice(i, i + batchSize);
    const batchPaths = batch.map(f => f.path);
    const batchNames = batch.map(f => f.name).join(', ');

    console.log(`[Vision] Batch ${Math.floor(i / batchSize) + 1}: ${batchNames}`);

    const prompt = `Analizza queste ${batch.length} immagini. Per OGNUNA, dimmi se contiene: "${searchQuery}".

I file sono (in ordine): ${batch.map(f => f.name).join(', ')}

Rispondi in formato JSON array:
[
  {"file": "nome_file.jpg", "found": true/false, "confidence": "alta/media/bassa", "description": "descrizione breve di cosa vedi"}
]

IMPORTANTE: Analizza VISIVAMENTE ogni immagine. Non indovinare dal nome del file. Guarda il contenuto reale della foto.`;

    try {
      const result = await gemini.analyzeImages(batchPaths, prompt, systemPrompt || '', modelId);
      // Parse JSON results
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        allResults.push(...parsed);
      }
    } catch (err: any) {
      console.log(`[Vision] Errore batch: ${err.message}`);
      // Continue with next batch
    }
  }

  // Analyze video frames
  for (const videoPath of videoFiles) {
    const videoName = path.basename(videoPath);
    console.log(`[Vision] Analisi frame video: ${videoName}`);

    const frames = await extractVideoFrames(videoPath, outputDir);
    if (frames.length > 0) {
      try {
        const prompt = `Questi sono frame estratti dal video "${videoName}". Contengono: "${searchQuery}"?
Rispondi con JSON: {"file": "${videoName}", "found": true/false, "confidence": "alta/media/bassa", "description": "cosa vedi nei frame"}`;

        const result = await gemini.analyzeImages(frames, prompt, systemPrompt || '', modelId);
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          allResults.push(JSON.parse(jsonMatch[0]));
        }
      } catch {}

      // Cleanup frames
      for (const f of frames) { try { fs.unlinkSync(f); } catch {} }
    }
  }

  // Build output
  const found = allResults.filter(r => r.found);
  const notFound = allResults.filter(r => !r.found);

  let output = `=== Analisi Visiva: "${searchQuery}" ===\n`;
  output += `Cartella: ${folderPath}\n`;
  output += `Immagini analizzate: ${imageFiles.length}\n`;
  output += `Video analizzati: ${videoFiles.length}\n\n`;

  if (found.length > 0) {
    output += `TROVATE (${found.length}):\n`;
    for (const r of found) {
      output += `  + ${r.file} [${r.confidence}] — ${r.description}\n`;
      output += `    Percorso: ${path.join(folderPath, r.file)}\n`;
    }
  } else {
    output += `Nessuna immagine trovata con "${searchQuery}".\n`;
  }

  if (notFound.length > 0) {
    output += `\nNON CORRISPONDENTI (${notFound.length}):\n`;
    for (const r of notFound) {
      output += `  - ${r.file} — ${r.description}\n`;
    }
  }

  // Summary list of matching file paths (for downstream nodes)
  if (found.length > 0) {
    output += `\n=== FILE SELEZIONATI ===\n`;
    for (const r of found) {
      output += `${path.join(folderPath, r.file)}\n`;
    }
  }

  return output;
}

function parseConfig(raw: any): any {
  if (!raw) return {};
  let current = raw;
  // Keep parsing until we get an object (handles any level of stringification)
  for (let i = 0; i < 10; i++) {
    if (typeof current !== 'string') break;
    try { current = JSON.parse(current); } catch { break; }
  }
  return typeof current === 'object' && current !== null ? current : {};
}

function makeOutputFileName(nodeLabel: string, ext: string, outputDir: string): string {
  const base = nodeLabel.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  let num = 1;
  let fileName = `${base}.${ext}`;
  while (fs.existsSync(path.join(outputDir, fileName))) {
    num++;
    fileName = `${base}_${String(num).padStart(3, '0')}.${ext}`;
  }
  return fileName;
}

// --- Rewrite local file paths in HTML ---
// Convert file:///path/to/file.jpg and /path/to/file.jpg
// to http://localhost:PORT/api/v1/local-files/path/to/file.jpg
function rewriteLocalPaths(html: string): string {
  const port = config.port;
  // Rewrite file:///absolute/path references
  html = html.replace(/file:\/\/\/([\w/\-. @]+\.\w+)/gi, (_, p) => {
    return `http://localhost:${port}/api/v1/local-files/${p}`;
  });
  // Rewrite src="/absolute/path" (absolute local paths in img/video/audio tags)
  html = html.replace(/(src\s*=\s*["'])\/(Users\/[^"']+)(["'])/gi, (_, pre, p, post) => {
    return `${pre}http://localhost:${port}/api/v1/local-files/${p}${post}`;
  });
  // Rewrite url("/absolute/path") in CSS
  html = html.replace(/(url\(\s*["']?)\/(Users\/[^"')]+)(["']?\s*\))/gi, (_, pre, p, post) => {
    return `${pre}http://localhost:${port}/api/v1/local-files/${p}${post}`;
  });
  return html;
}

// --- Save HTML output with path rewriting ---
function saveHTMLOutput(output: string, nodeLabel: string, outputDir: string): { filePath: string; html: string } | null {
  const htmlContent = extractHTML(output);
  if (!htmlContent) return null;

  const rewritten = rewriteLocalPaths(htmlContent);
  const fileName = makeOutputFileName(nodeLabel, 'html', outputDir);
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, rewritten, 'utf-8');
  return { filePath, html: rewritten };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReportBody(text: string): string {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(`<ul>${listBuffer.join('')}</ul>`);
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const level = Math.min((line.match(/^#+/)?.[0].length || 1) + 1, 4);
      blocks.push(`<h${level}>${escapeHtml(line.replace(/^#{1,3}\s+/, ''))}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      listBuffer.push(`<li>${escapeHtml(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    flushList();
    if (line.includes(':') && line.length < 120) {
      const [label, ...rest] = line.split(':');
      blocks.push(
        `<p><strong>${escapeHtml(label.trim())}:</strong> ${escapeHtml(rest.join(':').trim())}</p>`
      );
      continue;
    }

    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();
  return blocks.join('\n');
}

async function saveReportPDF(reportText: string, nodeLabel: string, outputDir: string): Promise<string | null> {
  const trimmed = reportText.trim();
  if (!trimmed) return null;

  let puppeteer: any;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('Puppeteer non installato. Esegui: npm install puppeteer');
  }

  const title = nodeLabel || 'Report';
  const pdfPath = path.join(outputDir, makeOutputFileName(`${title}_report`, 'pdf', outputDir));
  const body = renderReportBody(trimmed);
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #eeeeea;
      --panel: #f7f6f2;
      --ink: #1c1c1a;
      --muted: #5c5a56;
      --line: #d2cec6;
      --accent: #2f5e4e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    .page {
      padding: 44px 48px 56px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 32px 34px;
      box-shadow: 0 18px 42px rgba(28, 28, 26, 0.08);
    }
    .eyebrow {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(47, 94, 78, 0.12);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: 30px;
      line-height: 1.15;
    }
    h2, h3, h4 {
      margin: 26px 0 10px;
      color: var(--ink);
    }
    p, li {
      font-size: 14px;
      line-height: 1.68;
      color: var(--ink);
    }
    p { margin: 10px 0; }
    ul {
      margin: 10px 0 10px 18px;
      padding: 0;
    }
    .meta {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="eyebrow">Agent OS Report</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Generato il ${escapeHtml(new Date().toLocaleString('it-IT'))}</div>
      ${body}
    </div>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '10mm',
        bottom: '12mm',
        left: '10mm',
      },
    });
  } finally {
    await browser.close();
  }

  return pdfPath;
}

function shouldSaveAsPdfReport(node: any, output: string): boolean {
  const text = `${node.label || ''} ${node.description || ''} ${node.system_prompt || ''}`.toLowerCase();
  const hasReportIntent = /(report|audit|analisi sito|website|site analyzer|seo|diagnosi|assessment|benchmark|analisi competitiva)/.test(text);
  const looksLikeHtml = !!extractHTML(output);
  const looksLikeSimpleSelection = /=== FILE SELEZIONATI ===|^\/Users\//m.test(output);
  const enoughContent = output.trim().length > 500;
  return hasReportIntent && !looksLikeHtml && !looksLikeSimpleSelection && enoughContent;
}

// --- HTML to Video recording with Puppeteer ---
export async function recordHTMLToVideo(htmlPath: string, outputPath: string, durationSec: number = 15): Promise<string> {
  // Check if puppeteer is available
  let puppeteer: any;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('Puppeteer non installato. Esegui: npm install puppeteer');
  }

  const fps = 30;
  const totalFrames = durationSec * fps;
  const width = 1080;
  const height = 1920;

  const framesDir = path.join(path.dirname(outputPath), '_frames');
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [`--window-size=${width},${height}`, '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  // Load the HTML file — use localhost URL so images served via backend work
  const fileUrl = htmlPath.startsWith('http') ? htmlPath : `file://${htmlPath}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for animations to initialize
  await new Promise(r => setTimeout(r, 500));

  // Capture frames
  const frameInterval = 1000 / fps;
  console.log(`[Video] Cattura ${totalFrames} frame (${durationSec}s a ${fps}fps)...`);
  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png' });
    // Wait for next frame
    await new Promise(r => setTimeout(r, frameInterval));

    if (i % 30 === 0) {
      console.log(`[Video] Frame ${i}/${totalFrames}`);
    }
  }

  await browser.close();

  // Use ffmpeg to stitch frames into video
  console.log('[Video] Creazione video con ffmpeg...');
  await execFileAsync('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    outputPath,
  ], { timeout: 120000 });

  // Cleanup frames
  try {
    const frames = fs.readdirSync(framesDir);
    for (const f of frames) fs.unlinkSync(path.join(framesDir, f));
    fs.rmdirSync(framesDir);
  } catch {}

  const stat = fs.statSync(outputPath);
  console.log(`[Video] Video creato: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  return outputPath;
}

// --- Execute project ---
export async function executeProject(
  projectId: string,
  onProgress?: (log: ExecutionLog) => void,
  onNodeStart?: (event: {
    nodeId: string;
    label: string;
    projectId: string;
    progress: ExecutionProgress;
    providerId: string;
    modelId: string;
    agentName: string;
    debugFile: string;
    message: string;
  }) => void,
): Promise<ExecutionLog[]> {
  const nodes: any[] = db.prepare('SELECT * FROM nodes WHERE project_id = ? ORDER BY position_y, position_x').all(projectId);
  const edges: any[] = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(projectId);
  const agents: any[] = db.prepare(`SELECT * FROM agents WHERE project_id = ? OR scope = 'global'`).all(projectId);

  // Create run directory: outputs/{ProjectName}/run_NNN/
  const runDir = createRunDir(projectId);
  console.log(`[Execute] Run directory: ${runDir}`);

  runningProjects.set(projectId, { status: 'running' });
  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_esecuzione', projectId);

  const logs: ExecutionLog[] = [];
  const nodeOutputs: Record<string, string> = {};

  const incomingEdges: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!incomingEdges[edge.target_id]) incomingEdges[edge.target_id] = [];
    incomingEdges[edge.target_id].push(edge.source_id);
  }

  const visited = new Set<string>();
  const order: any[] = [];
  function visit(node: any) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    for (const depId of (incomingEdges[node.id] || [])) {
      const depNode = nodes.find(n => n.id === depId);
      if (depNode) visit(depNode);
    }
    order.push(node);
  }
  for (const node of nodes) visit(node);

  for (const node of order) {
    const progress = makeProgress(logs.length + 1, order.length);
    const execState = runningProjects.get(projectId);
    if (!execState || execState.status === 'stopping') {
      updateNodeState(node.id, 'bloccato');
      const stopLog: ExecutionLog = {
        nodeId: node.id,
        label: node.label,
        status: 'fermato',
        output: 'Esecuzione fermata',
        duration: 0,
        message: 'Esecuzione fermata prima dell’avvio del nodo',
        progress,
      };
      logs.push(stopLog);
      continue;
    }
    if (execState.status === 'paused') {
      await waitForResume(projectId);
      const after = runningProjects.get(projectId);
      if (!after || after.status === 'stopping') {
        updateNodeState(node.id, 'bloccato');
        const pausedStopLog: ExecutionLog = {
          nodeId: node.id,
          label: node.label,
          status: 'fermato',
          output: 'Esecuzione fermata',
          duration: 0,
          message: 'Esecuzione fermata durante la pausa',
          progress,
        };
        logs.push(pausedStopLog);
        continue;
      }
    }

    const start = Date.now();
    updateNodeState(node.id, 'in_esecuzione');
    const agent = node.agent_id ? agents.find(a => a.id === node.agent_id) : null;
    const { providerId, modelId } = resolveNodeModelSelection(node, agent);
    const startMessage = `Nodo operativo con ${agent?.name || `${providerId}/${modelId}`}`;
    if (onNodeStart) {
      onNodeStart({
        nodeId: node.id,
        label: node.label,
        projectId,
        progress,
        providerId,
        modelId,
        agentName: agent?.name || '',
        debugFile: '',
        message: startMessage,
      });
    }
    const systemPrompt = [agent?.system_prompt, node.system_prompt].filter(Boolean).join('\n\n');
    const nodeConfig = parseConfig(node.config);

    // Per-agent/node output directory inside the run folder
    let nodeOutputDir = getAgentDir(runDir, agent?.name || null, node.label);

    // If project has a workspace, use workspace path as working directory for tools
    const workspace = workspaces.get(projectId);
    if (workspace?.path && fs.existsSync(workspace.path)) {
      nodeOutputDir = workspace.path;
    } else {
      // Check DB for workspace_path
      const projRow: any = db.prepare('SELECT workspace_path FROM projects WHERE id = ?').get(projectId);
      if (projRow?.workspace_path && fs.existsSync(projRow.workspace_path)) {
        workspaces.set(projectId, { path: projRow.workspace_path, type: '', projectId });
        nodeOutputDir = projRow.workspace_path;
      }
    }

    // Resolve agent tools (from agent metadata or empty)
    // Merge tools from agent + node config
    let agentTools = parseAgentTools(agent);
    const configTools = Array.isArray(nodeConfig.tools) ? nodeConfig.tools : [];
    if (configTools.length > 0) {
      const allTools = new Set([...agentTools, ...configTools]);
      agentTools = Array.from(allTools);
    }

    try {
      let output = '';
      let artifactSaved = false;
      const deps = incomingEdges[node.id] || [];
      let inputContext = deps.map(d => nodeOutputs[d] || '').filter(Boolean).join('\n\n---\n\n');

      // Inject memory context if agent has memory enabled
      if (agent?.memory_enabled) {
        const memCtx = buildMemoryContext(projectId, node.description || node.label, 5);
        if (memCtx) inputContext = memCtx + '\n\n' + inputContext;
      }

      switch (node.type) {
        case 'sorgente': {
          const sourcePath = resolveSourcePath(nodeConfig);
          if (sourcePath && fs.existsSync(sourcePath)) {
            const stat = fs.statSync(sourcePath);
            if (stat.isDirectory()) {
              const files = fs.readdirSync(sourcePath).filter(f => !f.startsWith('.'));
              output = `Cartella: ${sourcePath}\nFile trovati (${files.length}):\n${files.map(f => {
                const fPath = path.join(sourcePath, f);
                const fStat = fs.statSync(fPath);
                return `- ${f} (${(fStat.size / 1024).toFixed(1)} KB)`;
              }).join('\n')}`;
            } else {
              output = fs.readFileSync(sourcePath, 'utf-8').slice(0, 10000);
            }
          } else {
            output = nodeConfig.content || node.description || 'Nessuna sorgente configurata';
          }
          break;
        }
        case 'analisi': {
          // Check if input context mentions a folder with images — use Vision AI
          const folderMatch = inputContext.match(/Cartella:\s*(.+)/);
          const hasImageKeywords = (node.description || '').match(/foto|immagin|image|picture|video|trova|cerca|selezion|riconosc|individu|detect|motoslit/i);

          if (folderMatch && hasImageKeywords && (providerId === 'gemini' || !providerId)) {
            const folderPath = folderMatch[1].trim();
            console.log(`[Vision] Analisi visiva in: ${folderPath}`);
            output = await analyzeImagesForSearch(
              folderPath,
              node.description || 'Analizza le immagini',
              systemPrompt,
              modelId || 'gemini-2.5-flash',
              nodeOutputDir
            );
          } else {
            output = await callAIWithToolsWrapper(providerId, modelId, systemPrompt, `${node.description || 'Analizza i seguenti dati'}\n\n${inputContext}`, agentTools, projectId, node.id, agent?.id, nodeOutputDir);
          }
          break;
        }
        case 'decisione': {
          output = await callAIWithToolsWrapper(providerId, modelId, systemPrompt, `${node.description || 'Valuta e decidi'}\n\nDati:\n${inputContext}`, agentTools, projectId, node.id, agent?.id, nodeOutputDir);
          break;
        }
        case 'esecuzione': {
          // Check if this node should execute a connector action
          const connectorId = nodeConfig.connector_id;
          const connectorAction = nodeConfig.connector_action;
          if (connectorId && connectorAction) {
            const connectorConfig = getConnectorConfig(connectorId);
            const connectorResult = await executeConnectorAction(
              connectorId,
              connectorAction,
              nodeConfig.connector_params || {},
              connectorConfig,
            );
            output = connectorResult.success
              ? `Connettore ${connectorId}: ${connectorResult.message || 'OK'}\n${JSON.stringify(connectorResult.data || {}, null, 2)}`
              : `Errore connettore ${connectorId}: ${connectorResult.error}`;
            break;
          }

          output = await callAIWithToolsWrapper(providerId, modelId, systemPrompt, `${node.description || 'Esegui il compito'}\n\nContesto:\n${inputContext}`, agentTools, projectId, node.id, agent?.id, nodeOutputDir);
          if (output.includes('<!DOCTYPE html>') || output.includes('<html') || output.includes('```html')) {
            const saved = saveHTMLOutput(output, node.label, nodeOutputDir);
            if (saved) {
              artifactSaved = true;
              saveArtifactOutput(projectId, node.id, 'file', `${node.label} HTML`, saved.filePath, {
                role: 'html',
                nodeLabel: node.label,
              });
              // Auto-record video if this is an animation node
              if (nodeConfig.auto_video !== false) {
                try {
                  const videoName = makeOutputFileName(node.label, 'mp4', nodeOutputDir);
                  const videoPath = path.join(nodeOutputDir, videoName);
                  const duration = nodeConfig.video_duration || 15;
                  await recordHTMLToVideo(saved.filePath, videoPath, duration);
                  saveArtifactOutput(projectId, node.id, 'file', `${node.label} Video`, videoPath, {
                    role: 'video',
                    nodeLabel: node.label,
                    sourceHtml: saved.filePath,
                    duration,
                  });
                } catch (videoErr: any) {
                  console.error(`[Video] ${node.label}: ${videoErr.message}`);
                }
              }
            }
          }
          break;
        }
        case 'automazione': {
          // If automation node has tools in config, use AI with tools (like init_project, install_deps, etc.)
          if (agentTools.length > 0) {
            const fallback = getFallbackModelSelection({ providerId, modelId });
            const autoProviderId = providerId || fallback.providerId;
            const autoModelId = modelId || fallback.modelId;
            const autoPrompt = systemPrompt || node.description || `Esegui l'automazione: ${node.label}`;
            const taskDescription = `${node.description || node.label}\n\nContesto:\n${inputContext || 'Nessun contesto precedente.'}`;
            output = await callAIWithToolsWrapper(autoProviderId, autoModelId, autoPrompt, taskDescription, agentTools, projectId, node.id, agent?.id, nodeOutputDir);
          } else {
            const cmd = nodeConfig.command || '';
            if (cmd) {
              // Check if command requires approval (dangerous patterns)
              if (isDangerousCommand(cmd) && !nodeConfig.approved) {
                const approvalId = generateId();
                db.prepare(
                  `INSERT INTO command_approvals (id, project_id, node_id, command, status)
                   VALUES (?, ?, ?, ?, 'pending')`
                ).run(approvalId, projectId, node.id, cmd);
                output = `Comando in attesa di approvazione: ${cmd}\n[Approval ID: ${approvalId}]`;
                break;
              }
              try {
                const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
                  timeout: 300000, cwd: nodeOutputDir, env: { ...process.env },
                });
                output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
              } catch (err: any) {
                output = `Errore comando: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`;
              }
            } else {
              output = `Automazione "${node.label}" eseguita.`;
            }
          }
          break;
        }
        case 'memoria': {
          // Save input context to persistent memory
          if (inputContext && inputContext.length > 10) {
            extractAndSaveMemories(inputContext, projectId, agent?.id, `node:${node.label}`);
            output = `Dati salvati in memoria persistente.\n\n${inputContext}`;
          } else if (node.description) {
            // Search memory using node description as query
            const memResults = buildMemoryContext(projectId, node.description, 10);
            output = memResults || 'Nessun dato trovato in memoria';
          } else {
            output = 'Nessun dato in memoria';
          }
          break;
        }
        default:
          output = `Nodo tipo "${node.type}" eseguito.`;
      }

      if (!artifactSaved && shouldSaveAsPdfReport(node, output)) {
        const pdfPath = await saveReportPDF(output, node.label, nodeOutputDir);
        if (pdfPath) {
          artifactSaved = true;
          saveArtifactOutput(projectId, node.id, 'report', `${node.label} Report`, pdfPath, {
            role: 'report',
            nodeLabel: node.label,
          });
        }
      }

      nodeOutputs[node.id] = output;

      // Save to persistent memory if agent has memory_enabled
      if (agent?.memory_enabled && output && output.length > 50) {
        extractAndSaveMemories(output, projectId, agent.id, `node:${node.label}`);
      }

      updateNodeState(node.id, 'completato');

      const duration = Date.now() - start;
      const log: ExecutionLog = {
        nodeId: node.id,
        label: node.label,
        status: 'completato',
        output: output.slice(0, 2000),
        duration,
        message: `Completato con ${agent?.name || `${providerId}/${modelId}`}`,
        progress,
        providerId,
        modelId,
        agentName: agent?.name || '',
        debugFile: '',
      };
      logs.push(log);

      if (onProgress) onProgress(log);

    } catch (err: any) {
      updateNodeState(node.id, 'bloccato');
      const duration = Date.now() - start;
      const log: ExecutionLog = {
        nodeId: node.id,
        label: node.label,
        status: 'bloccato',
        output: `Errore: ${err.message}`,
        duration,
        message: `Bloccato: ${err.message}`,
        error: err.message,
        progress,
        providerId,
        modelId,
        agentName: agent?.name || '',
        debugFile: '',
      };
      logs.push(log);
      if (onProgress) onProgress(log);
    }
  }

  const finalStatus = runningProjects.get(projectId)?.status === 'stopping' ? 'fermato' : 'completato';
  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(finalStatus, new Date().toISOString(), projectId);
  runningProjects.delete(projectId);

  // Auto-detect workspace from tool outputs and save to DB
  const ws = workspaces.get(projectId);
  if (ws?.path) {
    db.prepare('UPDATE projects SET workspace_path = ?, project_type = ? WHERE id = ?')
      .run(ws.path, ws.type || '', projectId);
  } else {
    // Check if files were created in FLOW/Apps during execution
    const appsDir = config.appsDir;
    if (fs.existsSync(appsDir)) {
      const appDirs = fs.readdirSync(appsDir).filter(d => fs.statSync(path.join(appsDir, d)).isDirectory());
      // Find the most recently modified app dir
      const recent = appDirs
        .map(d => ({ name: d, path: path.join(appsDir, d), mtime: fs.statSync(path.join(appsDir, d)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (recent.length > 0 && (Date.now() - recent[0].mtime) < 120000) {
        db.prepare('UPDATE projects SET workspace_path = ?, project_type = ? WHERE id = ?')
          .run(recent[0].path, 'app', projectId);
        workspaces.set(projectId, { path: recent[0].path, type: 'app', projectId });

        // Auto-start dev server for the app
        try {
          const { startApp } = await import('../modules/apps/apps.service');
          const result = startApp(recent[0].name);
          db.prepare('UPDATE projects SET dev_server_port = ? WHERE id = ?')
            .run(result.port, projectId);
          console.log(`[Builder] App auto-avviata: ${recent[0].name} su ${result.url}`);
        } catch (err: any) {
          console.log(`[Builder] Auto-start fallito: ${err.message}`);
        }
      }
    }
  }

  return logs;
}

// --- Execute single node ---
export async function executeNode(projectId: string, nodeId: string): Promise<ExecutionLog> {
  const node: any = db.prepare('SELECT * FROM nodes WHERE id = ? AND project_id = ?').get(nodeId, projectId);
  if (!node) throw new Error('Nodo non trovato');

  const agents: any[] = db.prepare(`SELECT * FROM agents WHERE project_id = ? OR scope = 'global'`).all(projectId);
  const edges: any[] = db.prepare('SELECT * FROM edges WHERE project_id = ? AND target_id = ?').all(projectId, nodeId);
  const outputDir = getOutputDir(projectId);

  const start = Date.now();
  updateNodeState(nodeId, 'in_esecuzione');

  const agent = node.agent_id ? agents.find((a: any) => a.id === node.agent_id) : null;
  const { providerId, modelId } = resolveNodeModelSelection(node, agent);
  const systemPrompt = [agent?.system_prompt, node.system_prompt].filter(Boolean).join('\n\n');
  const nodeConfig = parseConfig(node.config);

  const prevOutputs: string[] = [];
  for (const edge of edges) {
    const prevOutput: any = db.prepare(
      'SELECT content FROM outputs WHERE project_id = ? AND node_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(projectId, edge.source_id);
    if (prevOutput?.content) prevOutputs.push(prevOutput.content);
  }

  const inputContext = prevOutputs.join('\n\n---\n\n');
  const prompt = `${node.description || node.label}\n\n${inputContext}`;

  try {
    let output = '';
    let artifactSaved = false;

    if (node.type === 'sorgente') {
      const sourcePath = resolveSourcePath(nodeConfig);
      if (sourcePath && fs.existsSync(sourcePath)) {
        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(sourcePath).filter(f => !f.startsWith('.'));
          output = `Cartella: ${sourcePath}\nFile trovati (${files.length}):\n${files.map(f => `- ${f}`).join('\n')}`;
        } else {
          output = fs.readFileSync(sourcePath, 'utf-8').slice(0, 10000);
        }
      } else {
        output = nodeConfig.content || node.description || 'Nessuna sorgente';
      }
    } else if (node.type === 'analisi') {
      // Vision AI for image analysis
      const folderMatch = inputContext.match(/Cartella:\s*(.+)/);
      const hasImageKeywords = (node.description || '').match(/foto|immagin|image|picture|video|trova|cerca|selezion|riconosc|individu|detect|motoslit/i);

      if (folderMatch && hasImageKeywords && (providerId === 'gemini' || !providerId)) {
        const folderPath = folderMatch[1].trim();
        console.log(`[Vision] Analisi visiva singolo nodo: ${folderPath}`);
        output = await analyzeImagesForSearch(folderPath, node.description || 'Analizza le immagini', systemPrompt, modelId || 'gemini-2.5-flash', outputDir);
      } else {
        output = await callAI(providerId, modelId, systemPrompt, prompt);
      }
    } else if (node.type === 'automazione') {
      const cmd = nodeConfig.command || '';
      if (cmd) {
        const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
          timeout: 300000, cwd: outputDir, env: { ...process.env },
        });
        output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      } else {
        output = 'Automazione eseguita';
      }
    } else {
      output = await callAI(providerId, modelId, systemPrompt, prompt);
      if (output.includes('<!DOCTYPE html>') || output.includes('<html') || output.includes('```html')) {
        const saved = saveHTMLOutput(output, node.label, outputDir);
        if (saved) {
          artifactSaved = true;
          saveArtifactOutput(projectId, nodeId, 'file', `${node.label} HTML`, saved.filePath, {
            role: 'html',
            nodeLabel: node.label,
          });
          // Auto-record video
          if (nodeConfig.auto_video !== false) {
            try {
              const videoName = makeOutputFileName(node.label, 'mp4', outputDir);
              const videoPath = path.join(outputDir, videoName);
              const duration = nodeConfig.video_duration || 15;
              await recordHTMLToVideo(saved.filePath, videoPath, duration);
              saveArtifactOutput(projectId, nodeId, 'file', `${node.label} Video`, videoPath, {
                role: 'video',
                nodeLabel: node.label,
                sourceHtml: saved.filePath,
                duration,
              });
            } catch (videoErr: any) {
              console.error(`[Video] ${node.label}: ${videoErr.message}`);
            }
          }
        }
      }
    }

    if (!artifactSaved && shouldSaveAsPdfReport(node, output)) {
      const pdfPath = await saveReportPDF(output, node.label, outputDir);
      if (pdfPath) {
        saveArtifactOutput(projectId, nodeId, 'report', `${node.label} Report`, pdfPath, {
          role: 'report',
          nodeLabel: node.label,
        });
      }
    }

    updateNodeState(nodeId, 'completato');
    const duration = Date.now() - start;
    return { nodeId, label: node.label, status: 'completato', output: output.slice(0, 2000), duration };

  } catch (err: any) {
    updateNodeState(nodeId, 'bloccato');
    const duration = Date.now() - start;
    return { nodeId, label: node.label, status: 'bloccato', output: `Errore: ${err.message}`, duration };
  }
}

// --- Standalone HTML to Video API ---
export async function htmlToVideo(projectId: string, htmlFileName: string, durationSec?: number): Promise<string> {
  const outputDir = getOutputDir(projectId);
  const htmlPath = path.join(outputDir, htmlFileName);
  if (!fs.existsSync(htmlPath)) throw new Error(`File non trovato: ${htmlPath}`);

  const baseName = path.basename(htmlFileName, '.html');
  const videoName = makeOutputFileName(baseName, 'mp4', outputDir);
  const videoPath = path.join(outputDir, videoName);

  await recordHTMLToVideo(htmlPath, videoPath, durationSec || 15);

  saveArtifactOutput(projectId, '', 'file', `Video: ${videoName}`, videoPath, {
    role: 'video',
    sourceHtml: htmlFileName,
  });
  return videoPath;
}

// --- Helper: dangerous command detection ---
function isDangerousCommand(cmd: string): boolean {
  const dangerous = [
    /\brm\s+(-rf?|--recursive)\b/i,
    /\bsudo\b/i,
    /\bchmod\s+777\b/,
    /\bmkfs\b/,
    /\bdd\s+if=/i,
    /\bformat\b/i,
    />\s*\/dev\/sd/,
    /\bcurl\b.*\|\s*bash/,
    /\bwget\b.*\|\s*sh/,
    /\bdrop\s+(table|database)\b/i,
    /\bdelete\s+from\b/i,
    /\bgit\s+push\s+--force\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\bshutdown\b/,
    /\breboot\b/,
    /\bkill\s+-9\b/,
    /\bpkill\b/,
  ];
  return dangerous.some(pattern => pattern.test(cmd));
}

// --- Helper: parse agent tools ---
function parseAgentTools(agent: any): string[] {
  if (!agent) return [];
  try {
    const tools = agent.tools;
    if (!tools) return [];
    if (typeof tools === 'string') {
      const parsed = JSON.parse(tools);
      return Array.isArray(parsed) ? parsed.filter((t: string) => t && !t.startsWith('azione')) : [];
    }
    if (Array.isArray(tools)) return tools.filter((t: string) => t && !t.startsWith('azione'));
  } catch {}
  return [];
}

// --- Helper: get connector config from instance ---
function getConnectorConfig(connectorId: string): Record<string, any> {
  // Try v2 instances first
  const v2: any = db.prepare(
    "SELECT config FROM connector_instances_v2 WHERE connector_id = ? AND status = 'connected' LIMIT 1"
  ).get(connectorId);
  if (v2?.config) {
    try { return JSON.parse(v2.config); } catch {}
  }
  // Fallback to v1
  const v1: any = db.prepare(
    'SELECT config FROM connector_instances WHERE definition_id = ? AND enabled = 1 LIMIT 1'
  ).get(connectorId);
  if (v1?.config) {
    try { return JSON.parse(v1.config); } catch {}
  }
  return {};
}

// --- HTML extraction ---
function extractHTML(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    if (inner.includes('<html') || inner.includes('<!DOCTYPE')) return inner;
  }
  const htmlMatch = text.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
  if (htmlMatch) return htmlMatch[1];
  const htmlMatch2 = text.match(/(<html[\s\S]*<\/html>)/i);
  if (htmlMatch2) return htmlMatch2[1];
  return null;
}
