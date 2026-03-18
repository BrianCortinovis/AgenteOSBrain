import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { runMigrations } from './database/migrate';
import { errorHandler } from './middleware/error-handler';
import projectsRouter from './modules/projects/projects.router';
import graphRouter from './modules/graph/graph.router';
import agentsRouter from './modules/agents/agents.router';
import providersRouter from './modules/providers/providers.router';
import schedulerRouter from './modules/scheduler/scheduler.router';
import connectorsRouter from './modules/connectors/connectors.router';
import outputsRouter from './modules/outputs/outputs.router';
import promptsRouter from './modules/prompts/prompts.router';
import chatRouter from './modules/chat/chat.router';
import aiRouter from './modules/ai/ai.router';
import workspaceRouter from './modules/workspace/workspace.router';
import memoryRouter from './modules/memory/memory.router';
import toolsRouter from './modules/tools/tools.router';
import skillsRouter from './modules/skills/skills.router';
import { orchestrate, executeAgentsParallel } from './modules/agents/orchestration.service';
import { executeProject, executeNode, getExecutionState, pauseProject, resumeProject, stopProject, htmlToVideo } from './orchestrator/engine';
import { initSchedulerRuntime, stopAllScheduleJobs } from './modules/scheduler/scheduler.runtime';
import { initWebSocket, broadcast } from './modules/websocket/ws.service';
import { onConnectorEvent, startConnectorListeners, stopAllConnectorListeners } from './modules/connectors/executors/registry';
import { executeConnectorAction } from './modules/connectors/executors/registry';
import { providerRegistry } from './modules/providers/provider-registry';
import db from './database/connection';

runMigrations();

// Load custom providers from DB after migrations
providerRegistry.loadCustomProviders();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1', graphRouter);
app.use('/api/v1', agentsRouter);
app.use('/api/v1/providers', providersRouter);
app.use('/api/v1', schedulerRouter);
app.use('/api/v1', connectorsRouter);
app.use('/api/v1', outputsRouter);
app.use('/api/v1/prompts', promptsRouter);
app.use('/api/v1', chatRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/workspace', workspaceRouter);
app.use('/api/v1/memory', memoryRouter);
app.use('/api/v1/tools', toolsRouter);
app.use('/api/v1/skills', skillsRouter);

// ─── SSE: real-time execution events ────────────────────────────
import { EventEmitter } from 'events';
const executionEvents = new EventEmitter();
executionEvents.setMaxListeners(50);

app.get('/api/v1/projects/:id/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"type":"connected"}\n\n');

  const projectId = req.params.id;
  const handler = (event: any) => {
    if (event.projectId === projectId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };
  executionEvents.on('update', handler);
  req.on('close', () => executionEvents.off('update', handler));
});

// ─── Orchestrator endpoints ─────────────────────────────────────
app.post('/api/v1/projects/:id/execute', async (req, res) => {
  try {
    const projectId = req.params.id;
    const logs = await executeProject(
      projectId,
      (log) => {
        console.log(`[Execute] ${log.label}: ${log.status} (${log.duration}ms)`);
        const event = {
          projectId,
          type: 'node_complete',
          nodeId: log.nodeId,
          label: log.label,
          status: log.status,
          duration: log.duration,
          message: log.message || '',
          error: log.error || '',
          progress: log.progress || null,
          providerId: log.providerId || '',
          modelId: log.modelId || '',
          agentName: log.agentName || '',
          debugFile: log.debugFile || '',
          timestamp: new Date().toISOString(),
        };
        executionEvents.emit('update', event);
        // Also broadcast via WebSocket
        broadcast(`execution:${projectId}`, event);
      },
      ({ nodeId, label, progress, providerId, modelId, agentName, debugFile, message }) => {
        const event = {
          projectId,
          type: 'node_start',
          nodeId,
          label,
          status: 'in_esecuzione',
          message,
          progress,
          providerId,
          modelId,
          agentName,
          debugFile,
          timestamp: new Date().toISOString(),
        };
        executionEvents.emit('update', event);
        broadcast(`execution:${projectId}`, event);
      }
    );
    const completeEvent = {
      projectId,
      type: 'project_complete',
      status: 'completato',
      timestamp: new Date().toISOString(),
    };
    executionEvents.emit('update', completeEvent);
    broadcast(`execution:${projectId}`, completeEvent);
    res.json({ status: 'completato', logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/projects/:id/execute/:nodeId', async (req, res) => {
  try {
    const log = await executeNode(req.params.id, req.params.nodeId);
    res.json(log);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execution control
app.get('/api/v1/projects/:id/execution-state', (req, res) => {
  res.json({ state: getExecutionState(req.params.id) });
});

app.post('/api/v1/projects/:id/pause', (req, res) => {
  const ok = pauseProject(req.params.id);
  res.json({ success: ok, state: getExecutionState(req.params.id) });
});

app.post('/api/v1/projects/:id/resume', (req, res) => {
  const ok = resumeProject(req.params.id);
  res.json({ success: ok, state: getExecutionState(req.params.id) });
});

app.post('/api/v1/projects/:id/stop', (req, res) => {
  const ok = stopProject(req.params.id);
  res.json({ success: ok, state: getExecutionState(req.params.id) });
});

// Serve project output files
app.use('/api/v1/outputs/files', express.static(config.outputsDir));

// HTML to Video
app.post('/api/v1/projects/:id/html-to-video', async (req, res) => {
  try {
    const { htmlFile, duration } = req.body;
    const videoPath = await htmlToVideo(req.params.id, htmlFile, duration);
    res.json({ success: true, videoPath, fileName: videoPath.split('/').pop() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve local files
app.get('/api/v1/local-files/*', (req, res) => {
  const filePath = decodeURIComponent((req.params as any)[0] || '');
  if (!filePath || filePath.includes('..')) {
    return res.status(400).json({ error: 'Percorso non valido' });
  }
  const absPath = filePath.startsWith('/') ? filePath : '/' + filePath;
  res.sendFile(absPath, (err) => {
    if (err) res.status(404).json({ error: 'File non trovato' });
  });
});

// ─── Connector execution endpoint ──────────────────────────────
app.post('/api/v1/connectors/:connectorId/execute', async (req, res) => {
  try {
    const { action, params, config: connConfig } = req.body;
    const result = await executeConnectorAction(req.params.connectorId, action, params || {}, connConfig || {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Native folder picker (macOS osascript) ─────────────────────
import fs from 'fs';
import pathModule from 'path';
import { execSync } from 'child_process';

app.post('/api/v1/pick-folder', (_req, res) => {
  try {
    if (process.platform === 'darwin') {
      const result = execSync(
        `osascript -e 'set chosenFolder to POSIX path of (choose folder with prompt "Seleziona cartella output")'`,
        { timeout: 60000, encoding: 'utf-8' }
      ).trim();
      if (result) {
        return res.json({ path: result.replace(/\/$/, '') });
      }
    }
    res.json({ path: null, error: 'Nessuna cartella selezionata' });
  } catch {
    res.json({ path: null, error: 'Selezione annullata' });
  }
});

// ─── Folder browser for settings ────────────────────────────────

app.get('/api/v1/browse-folders', (req, res) => {
  const dir = String(req.query.path || process.env.HOME || '/');
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return res.json({ path: dir, folders: [], error: 'Percorso non valido' });
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: pathModule.join(dir, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);
    const parent = pathModule.dirname(dir);
    res.json({ path: dir, parent: parent !== dir ? parent : null, folders });
  } catch (err: any) {
    res.json({ path: dir, folders: [], error: err.message });
  }
});

// ─── Dashboard status endpoint ──────────────────────────────────
app.get('/api/v1/dashboard/status', (_req, res) => {
  const { getConnectedClients } = require('./modules/websocket/ws.service');
  const { getActiveJobsStatus } = require('./modules/scheduler/scheduler.runtime');

  let memoryCount = 0;
  let pendingApprovals = 0;
  try {
    const mc: any = db.prepare('SELECT COUNT(*) as cnt FROM memory_entries').get();
    memoryCount = mc?.cnt || 0;
  } catch {}
  try {
    const pa: any = db.prepare("SELECT COUNT(*) as cnt FROM command_approvals WHERE status = 'pending'").get();
    pendingApprovals = pa?.cnt || 0;
  } catch {}

  res.json({
    activeJobs: getActiveJobsStatus().length,
    connectedClients: getConnectedClients(),
    memoryEntries: memoryCount,
    pendingApprovals,
  });
});

// ─── Command approval endpoints ─────────────────────────────────
app.get('/api/v1/approvals', (_req, res) => {
  const rows = db.prepare("SELECT * FROM command_approvals WHERE status = 'pending' ORDER BY requested_at DESC").all();
  res.json(rows);
});

app.post('/api/v1/approvals/:id/approve', (req, res) => {
  db.prepare("UPDATE command_approvals SET status = 'approved', resolved_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.json({ approved: true });
});

app.post('/api/v1/approvals/:id/deny', (req, res) => {
  db.prepare("UPDATE command_approvals SET status = 'denied', resolved_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.json({ denied: true });
});

// ─── Multi-agent orchestration endpoints ────────────────────────
app.post('/api/v1/projects/:id/orchestrate', async (req, res) => {
  try {
    const { orchestrator_agent_id, task, sub_agent_ids } = req.body;
    const result = await orchestrate(req.params.id, orchestrator_agent_id, task, sub_agent_ids || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/projects/:id/agents/parallel', async (req, res) => {
  try {
    const { tasks } = req.body; // [{ agentId, task, context? }]
    const results = await executeAgentsParallel(req.params.id, tasks || []);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Webhook receiver for incoming connector events ─────────────
app.post('/api/v1/webhooks/:connectorId', (req, res) => {
  const event = {
    connector_id: req.params.connectorId,
    type: 'webhook',
    data: req.body,
    timestamp: new Date().toISOString(),
  };
  broadcast('webhooks', event);
  console.log(`[Webhook] Evento ricevuto da ${req.params.connectorId}`);
  res.json({ ok: true });
});

// ─── Serve frontend static files ─────────────────────────────
const frontendDistPaths = [
  process.env.STATIC_DIR,
  pathModule.resolve(__dirname, '../../frontend/dist'),
  pathModule.resolve(__dirname, '../../../frontend/dist'),
  pathModule.resolve(process.cwd(), 'frontend/dist'),
].filter(Boolean) as string[];

let frontendDir = '';
for (const p of frontendDistPaths) {
  if (fs.existsSync(pathModule.join(p, 'index.html'))) {
    frontendDir = p;
    break;
  }
}

if (frontendDir) {
  console.log(`[Agent OS] Frontend: ${frontendDir}`);
  app.use(express.static(frontendDir));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
    res.sendFile(pathModule.join(frontendDir, 'index.html'));
  });
} else {
  console.warn('[Agent OS] Frontend dist non trovato — solo API disponibile');
}

app.use(errorHandler);

// ─── Start server with WebSocket ────────────────────────────────
const server = http.createServer(app);

// Initialize WebSocket on same server
initWebSocket(server);

// Forward connector events to WebSocket
onConnectorEvent((event) => {
  broadcast('connectors', event);
  broadcast(`connector:${event.connector_id}`, event);
});

server.listen(config.port, () => {
  console.log(`[Agent OS] Backend avviato su http://localhost:${config.port}`);
  console.log(`[Agent OS] WebSocket disponibile su ws://localhost:${config.port}/ws`);

  // Initialize scheduler runtime (start cron jobs)
  try {
    initSchedulerRuntime();
  } catch (err: any) {
    console.error(`[Scheduler] Errore inizializzazione: ${err.message}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Agent OS] Arresto in corso...');
  stopAllScheduleJobs();
  stopAllConnectorListeners();
  server.close();
});

process.on('SIGINT', () => {
  console.log('[Agent OS] Arresto in corso...');
  stopAllScheduleJobs();
  stopAllConnectorListeners();
  server.close();
  process.exit(0);
});
