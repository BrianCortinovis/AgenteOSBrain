import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../../config';
import { executeTool } from '../tools/tool-executors';

type RunningApp = { pid: number; port: number; process: any; name: string };
const runningApps = new Map<string, RunningApp>();

function ensureAppsDir() {
  if (!fs.existsSync(config.appsDir)) {
    fs.mkdirSync(config.appsDir, { recursive: true });
  }
}

export function listApps(): { name: string; path: string; hasPackageJson: boolean; running: boolean; port: number; url: string }[] {
  ensureAppsDir();
  const entries = fs.readdirSync(config.appsDir).filter(e => {
    const full = path.join(config.appsDir, e);
    return fs.statSync(full).isDirectory() && !e.startsWith('.');
  });

  return entries.map(name => {
    const appPath = path.join(config.appsDir, name);
    const hasPackageJson = fs.existsSync(path.join(appPath, 'package.json'));
    const running = runningApps.has(name);
    const port = runningApps.get(name)?.port || 0;
    return {
      name,
      path: appPath,
      hasPackageJson,
      running,
      port,
      url: port > 0 ? `http://localhost:${port}` : '',
    };
  });
}

export async function getAppInfo(name: string) {
  const appPath = path.join(config.appsDir, name);
  if (!fs.existsSync(appPath)) return null;

  const hasPackageJson = fs.existsSync(path.join(appPath, 'package.json'));
  let packageJson: any = null;
  if (hasPackageJson) {
    try { packageJson = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf-8')); } catch {}
  }

  // Generate file tree
  const treeResult = await executeTool('list_project_files', { path: appPath, depth: 4 }, { projectId: '' });

  const running = runningApps.has(name);
  const port = runningApps.get(name)?.port || 0;

  return {
    name,
    path: appPath,
    hasPackageJson,
    packageJson,
    fileTree: treeResult.output,
    running,
    port,
    url: port > 0 ? `http://localhost:${port}` : '',
  };
}

export function startApp(name: string): { url: string; port: number; pid: number } {
  const appPath = path.join(config.appsDir, name);
  if (!fs.existsSync(appPath)) throw new Error(`App non trovata: ${name}`);

  // Stop if already running
  if (runningApps.has(name)) {
    stopApp(name);
  }

  // Find free port in range 44000-44999
  let port = 44000;
  const usedPorts = new Set(Array.from(runningApps.values()).map(a => a.port));
  while (usedPorts.has(port) && port < 44999) port++;

  // Detect start command
  let cmd = 'npx';
  let args = ['serve', '-l', String(port), '-s'];
  if (fs.existsSync(path.join(appPath, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf-8'));
      if (pkg.scripts?.dev) {
        cmd = 'npm';
        args = ['run', 'dev'];
      } else if (pkg.scripts?.start) {
        cmd = 'npm';
        args = ['start'];
      }
    } catch {}
  }

  const child = spawn(cmd, args, {
    cwd: appPath,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  if (!child.pid) throw new Error('Impossibile avviare il processo');

  runningApps.set(name, { pid: child.pid, port, process: child, name });
  console.log(`[Apps] Avviata: ${name} su http://localhost:${port} (PID: ${child.pid})`);

  return { url: `http://localhost:${port}`, port, pid: child.pid };
}

export function stopApp(name: string): boolean {
  const app = runningApps.get(name);
  if (!app) return false;

  try { process.kill(-app.pid); } catch {
    try { process.kill(app.pid); } catch {}
  }
  runningApps.delete(name);
  console.log(`[Apps] Fermata: ${name}`);
  return true;
}

export function getRunningApps() {
  return Array.from(runningApps.entries()).map(([name, info]) => ({
    name, port: info.port, pid: info.pid, url: `http://localhost:${info.port}`,
  }));
}
