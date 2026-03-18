import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

const SEARCH_PATHS = [
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.local', 'bin', 'claude'),
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
];

function findNvmPaths(): string[] {
  const nvmDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (!fs.existsSync(nvmDir)) return [];
  try {
    return fs.readdirSync(nvmDir).map(v => path.join(nvmDir, v, 'bin', 'claude'));
  } catch { return []; }
}

export interface ClaudeCLIStatus {
  found: boolean;
  path: string;
  version: string;
}

let cachedStatus: ClaudeCLIStatus | null = null;

export async function checkClaudeCLI(): Promise<ClaudeCLIStatus> {
  if (cachedStatus) return cachedStatus;

  const allPaths = [...SEARCH_PATHS, ...findNvmPaths()];

  for (const p of allPaths) {
    if (fs.existsSync(p)) {
      try {
        const { stdout } = await execFileAsync(p, ['--version'], { timeout: 5000 });
        cachedStatus = { found: true, path: p, version: stdout.trim() };
        return cachedStatus;
      } catch {
        cachedStatus = { found: true, path: p, version: 'unknown' };
        return cachedStatus;
      }
    }
  }

  // Try via PATH
  try {
    const { stdout } = await execFileAsync('claude', ['--version'], { timeout: 5000 });
    cachedStatus = { found: true, path: 'claude', version: stdout.trim() };
    return cachedStatus;
  } catch {
    // not found
  }

  return { found: false, path: '', version: '' };
}

export async function installClaudeCLI(): Promise<{ success: boolean; message: string }> {
  try {
    const prefix = path.join(os.homedir(), '.local');
    await execFileAsync('npm', ['install', '-g', '@anthropic-ai/claude-code', '--prefix', prefix], {
      timeout: 120000,
      env: { ...process.env },
    });
    cachedStatus = null; // reset cache
    const status = await checkClaudeCLI();
    return { success: status.found, message: status.found ? 'Claude CLI installato con successo' : 'Installazione completata ma CLI non trovato' };
  } catch (err: any) {
    return { success: false, message: `Errore installazione: ${err.message}` };
  }
}

// Max timeout: 15 minuti per generazioni complesse (HTML, codice, ecc.)
const MAX_TIMEOUT = 15 * 60 * 1000; // 900000ms

export async function callClaudeCLI(prompt: string, options?: { timeout?: number }): Promise<string> {
  const status = await checkClaudeCLI();
  if (!status.found) {
    throw new Error('Claude CLI non trovato. Installalo dalla pagina Impostazioni.');
  }

  return new Promise((resolve, reject) => {
    const timeout = options?.timeout || MAX_TIMEOUT;

    const child = spawn(status.path, ['--output-format', 'text', '--tools', '', '-p', '-'], {
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Claude CLI timeout dopo ${Math.round(timeout / 60000)} minuti`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI errore (code ${code}): ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Claude CLI spawn error: ${err.message}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export async function chatClaudeCLI(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  let fullPrompt = '';
  if (systemPrompt) {
    fullPrompt += `[System]\n${systemPrompt}\n\n`;
  }
  for (const msg of messages) {
    const label = msg.role === 'user' ? 'Utente' : msg.role === 'assistant' ? 'Assistente' : 'Sistema';
    fullPrompt += `[${label}]\n${msg.content}\n\n`;
  }
  fullPrompt += '[Assistente]\n';

  return callClaudeCLI(fullPrompt);
}
