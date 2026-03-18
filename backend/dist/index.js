"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const migrate_1 = require("./database/migrate");
const error_handler_1 = require("./middleware/error-handler");
const projects_router_1 = __importDefault(require("./modules/projects/projects.router"));
const graph_router_1 = __importDefault(require("./modules/graph/graph.router"));
const agents_router_1 = __importDefault(require("./modules/agents/agents.router"));
const providers_router_1 = __importDefault(require("./modules/providers/providers.router"));
const scheduler_router_1 = __importDefault(require("./modules/scheduler/scheduler.router"));
const connectors_router_1 = __importDefault(require("./modules/connectors/connectors.router"));
const outputs_router_1 = __importDefault(require("./modules/outputs/outputs.router"));
const prompts_router_1 = __importDefault(require("./modules/prompts/prompts.router"));
const chat_router_1 = __importDefault(require("./modules/chat/chat.router"));
const engine_1 = require("./orchestrator/engine");
(0, migrate_1.runMigrations)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use('/api/v1/projects', projects_router_1.default);
app.use('/api/v1', graph_router_1.default);
app.use('/api/v1', agents_router_1.default);
app.use('/api/v1/providers', providers_router_1.default);
app.use('/api/v1', scheduler_router_1.default);
app.use('/api/v1', connectors_router_1.default);
app.use('/api/v1', outputs_router_1.default);
app.use('/api/v1/prompts', prompts_router_1.default);
app.use('/api/v1', chat_router_1.default);
// SSE: real-time execution events
const events_1 = require("events");
const executionEvents = new events_1.EventEmitter();
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
    const handler = (event) => {
        if (event.projectId === projectId) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    };
    executionEvents.on('update', handler);
    req.on('close', () => executionEvents.off('update', handler));
});
// Orchestrator: execute project with SSE updates
app.post('/api/v1/projects/:id/execute', async (req, res) => {
    try {
        const projectId = req.params.id;
        const logs = await (0, engine_1.executeProject)(projectId, (log) => {
            console.log(`[Execute] ${log.label}: ${log.status} (${log.duration}ms)`);
            executionEvents.emit('update', {
                projectId,
                type: 'node_complete',
                nodeId: log.nodeId,
                label: log.label,
                status: log.status,
                duration: log.duration,
                timestamp: new Date().toISOString(),
            });
        }, (nodeId, label) => {
            executionEvents.emit('update', {
                projectId,
                type: 'node_start',
                nodeId,
                label,
                status: 'in_esecuzione',
                timestamp: new Date().toISOString(),
            });
        });
        executionEvents.emit('update', {
            projectId,
            type: 'project_complete',
            status: 'completato',
            timestamp: new Date().toISOString(),
        });
        res.json({ status: 'completato', logs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Execute single node
app.post('/api/v1/projects/:id/execute/:nodeId', async (req, res) => {
    try {
        const log = await (0, engine_1.executeNode)(req.params.id, req.params.nodeId);
        res.json(log);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Execution control: pause, resume, stop, status
app.get('/api/v1/projects/:id/execution-state', (req, res) => {
    res.json({ state: (0, engine_1.getExecutionState)(req.params.id) });
});
app.post('/api/v1/projects/:id/pause', (req, res) => {
    const ok = (0, engine_1.pauseProject)(req.params.id);
    res.json({ success: ok, state: (0, engine_1.getExecutionState)(req.params.id) });
});
app.post('/api/v1/projects/:id/resume', (req, res) => {
    const ok = (0, engine_1.resumeProject)(req.params.id);
    res.json({ success: ok, state: (0, engine_1.getExecutionState)(req.params.id) });
});
app.post('/api/v1/projects/:id/stop', (req, res) => {
    const ok = (0, engine_1.stopProject)(req.params.id);
    res.json({ success: ok, state: (0, engine_1.getExecutionState)(req.params.id) });
});
// Serve project output files
app.use('/api/v1/outputs/files', express_1.default.static(config_1.config.outputsDir));
// HTML to Video conversion endpoint
app.post('/api/v1/projects/:id/html-to-video', async (req, res) => {
    try {
        const { htmlFile, duration } = req.body;
        const videoPath = await (0, engine_1.htmlToVideo)(req.params.id, htmlFile, duration);
        res.json({ success: true, videoPath, fileName: videoPath.split('/').pop() });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Serve local files (images, documents) for HTML animations
// Maps /api/v1/local-files/<encoded-path> to actual filesystem paths
app.get('/api/v1/local-files/*', (req, res) => {
    const filePath = decodeURIComponent(req.params[0]);
    if (!filePath || filePath.includes('..')) {
        return res.status(400).json({ error: 'Percorso non valido' });
    }
    // Always prepend / for absolute path
    const absPath = filePath.startsWith('/') ? filePath : '/' + filePath;
    res.sendFile(absPath, (err) => {
        if (err)
            res.status(404).json({ error: 'File non trovato' });
    });
});
app.use(error_handler_1.errorHandler);
app.listen(config_1.config.port, () => {
    console.log(`[Agent OS] Backend avviato su http://localhost:${config_1.config.port}`);
});
