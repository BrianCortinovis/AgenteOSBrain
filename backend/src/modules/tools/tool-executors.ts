import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor, ToolContext, ToolResult } from './tools.types';
import { searchMemory, saveMemory } from '../memory/memory.service';

const execFileAsync = promisify(execFile);

// ─── Built-in Tool Executors ────────────────────────────────────

const webSearchTool: ToolExecutor = {
  name: 'web_search',
  async execute(params: { query: string }): Promise<ToolResult> {
    // Uses a simple fetch-based search (DuckDuckGo instant answers)
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`;
      const response = await fetch(url);
      const data: any = await response.json();
      const results: string[] = [];
      if (data.AbstractText) results.push(`Risposta: ${data.AbstractText}`);
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text) results.push(`- ${topic.Text}`);
        }
      }
      return {
        success: true,
        output: results.length > 0 ? results.join('\n') : `Nessun risultato per: "${params.query}"`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore ricerca: ${err.message}` };
    }
  },
};

const readFileTool: ToolExecutor = {
  name: 'read_file',
  async execute(params: { path: string }): Promise<ToolResult> {
    try {
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      if (!fs.existsSync(filePath)) {
        return { success: false, output: '', error: `File non trovato: ${filePath}` };
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(filePath).filter(f => !f.startsWith('.')).slice(0, 50);
        return { success: true, output: `Contenuto cartella (${files.length} elementi):\n${files.join('\n')}` };
      }
      const content = fs.readFileSync(filePath, 'utf-8').slice(0, 20000);
      return { success: true, output: content };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore lettura: ${err.message}` };
    }
  },
};

const writeFileTool: ToolExecutor = {
  name: 'write_file',
  async execute(params: { path: string; content: string }): Promise<ToolResult> {
    try {
      const filePath = params.path.startsWith('~/')
        ? path.join(process.env.HOME || '', params.path.slice(2))
        : params.path;
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, params.content, 'utf-8');
      return { success: true, output: `File scritto: ${filePath} (${params.content.length} caratteri)` };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore scrittura: ${err.message}` };
    }
  },
};

const shellExecTool: ToolExecutor = {
  name: 'shell_exec',
  async execute(params: { command: string; timeout?: number }, context: ToolContext): Promise<ToolResult> {
    try {
      const timeout = params.timeout || 30000;
      const cwd = context.outputDir || process.cwd();
      const { stdout, stderr } = await execFileAsync('bash', ['-c', params.command], {
        timeout,
        cwd,
        env: { ...process.env },
      });
      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      return { success: true, output: output.slice(0, 10000) };
    } catch (err: any) {
      return {
        success: false,
        output: err.stdout || '',
        error: `Errore comando: ${err.message}\n${err.stderr || ''}`,
      };
    }
  },
};

const httpRequestTool: ToolExecutor = {
  name: 'http_request',
  async execute(params: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<ToolResult> {
    try {
      const options: RequestInit = {
        method: params.method || 'GET',
        headers: params.headers || {},
      };
      if (params.body && options.method !== 'GET') {
        options.body = params.body;
      }
      const response = await fetch(params.url, options);
      const text = await response.text();
      return {
        success: response.ok,
        output: `Status: ${response.status}\n${text.slice(0, 10000)}`,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      return { success: false, output: '', error: `Errore HTTP: ${err.message}` };
    }
  },
};

const memorySearchTool: ToolExecutor = {
  name: 'memory_search',
  async execute(params: { query: string; limit?: number }, context: ToolContext): Promise<ToolResult> {
    const results = searchMemory(params.query, {
      project_id: context.projectId,
      limit: params.limit || 5,
    });
    if (results.length === 0) {
      return { success: true, output: `Nessuna memoria trovata per: "${params.query}"` };
    }
    const output = results.map((m, i) =>
      `[${i + 1}] ${m.summary || m.content.slice(0, 200)} (importanza: ${m.importance}, accessi: ${m.access_count})`
    ).join('\n');
    return { success: true, output: `Memorie trovate (${results.length}):\n${output}` };
  },
};

const memorySaveTool: ToolExecutor = {
  name: 'memory_save',
  async execute(params: { content: string; tags?: string[] }, context: ToolContext): Promise<ToolResult> {
    const entry = saveMemory({
      project_id: context.projectId,
      agent_id: context.agentId,
      content: params.content,
      tags: params.tags || [],
      source: 'tool_call',
    });
    return { success: true, output: `Memoria salvata con ID: ${entry.id}` };
  },
};

// ─── Registry ───────────────────────────────────────────────────

const executorMap = new Map<string, ToolExecutor>();

function registerExecutor(executor: ToolExecutor) {
  executorMap.set(executor.name, executor);
}

// Register built-in tools
registerExecutor(webSearchTool);
registerExecutor(readFileTool);
registerExecutor(writeFileTool);
registerExecutor(shellExecTool);
registerExecutor(httpRequestTool);
registerExecutor(memorySearchTool);
registerExecutor(memorySaveTool);

export function getToolExecutor(name: string): ToolExecutor | undefined {
  return executorMap.get(name);
}

export function getAllToolExecutors(): ToolExecutor[] {
  return Array.from(executorMap.values());
}

export async function executeTool(
  name: string,
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const executor = executorMap.get(name);
  if (!executor) {
    return { success: false, output: '', error: `Tool non trovato: ${name}` };
  }
  return executor.execute(params, context);
}
