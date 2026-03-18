"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExecutionState = getExecutionState;
exports.pauseProject = pauseProject;
exports.resumeProject = resumeProject;
exports.stopProject = stopProject;
exports.recordHTMLToVideo = recordHTMLToVideo;
exports.executeProject = executeProject;
exports.executeNode = executeNode;
exports.htmlToVideo = htmlToVideo;
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const provider_registry_1 = require("../modules/providers/provider-registry");
const claude_bridge_1 = require("../modules/providers/adapters/claude-bridge");
const anthropic_adapter_1 = require("../modules/providers/adapters/anthropic.adapter");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const settings_service_1 = require("../modules/providers/settings.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// --- Execution state management ---
const runningProjects = new Map();
function getExecutionState(projectId) {
    return runningProjects.get(projectId)?.status || 'idle';
}
function pauseProject(projectId) {
    const state = runningProjects.get(projectId);
    if (state && state.status === 'running') {
        state.status = 'paused';
        connection_1.default.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_pausa', projectId);
        return true;
    }
    return false;
}
function resumeProject(projectId) {
    const state = runningProjects.get(projectId);
    if (state && state.status === 'paused') {
        state.status = 'running';
        connection_1.default.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_esecuzione', projectId);
        if (state.resolve)
            state.resolve();
        return true;
    }
    return false;
}
function stopProject(projectId) {
    const state = runningProjects.get(projectId);
    if (state) {
        state.status = 'stopping';
        connection_1.default.prepare('UPDATE projects SET status = ? WHERE id = ?').run('fermato', projectId);
        if (state.resolve)
            state.resolve();
        return true;
    }
    return false;
}
function waitForResume(projectId) {
    const state = runningProjects.get(projectId);
    if (!state || state.status !== 'paused')
        return Promise.resolve();
    return new Promise(resolve => { state.resolve = resolve; });
}
// --- Output directory ---
// Structure: outputs/{ProjectName}/run_{NNN}/{AgentOrNodeName}/
function getBaseOutputDir(projectId) {
    const settings = (0, settings_service_1.loadSettings)();
    const baseDir = settings.outputs_dir || config_1.config.outputsDir;
    // Get project name for folder
    const project = connection_1.default.prepare('SELECT name FROM projects WHERE id = ?').get(projectId);
    const projectName = project?.name
        ? project.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
        : projectId;
    const dir = path_1.default.join(baseDir, projectName);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function createRunDir(projectId) {
    const baseDir = getBaseOutputDir(projectId);
    // Find next run number
    let runNum = 1;
    if (fs_1.default.existsSync(baseDir)) {
        const existing = fs_1.default.readdirSync(baseDir).filter(f => f.startsWith('run_'));
        if (existing.length > 0) {
            const nums = existing.map(f => parseInt(f.replace('run_', ''), 10)).filter(n => !isNaN(n));
            if (nums.length > 0)
                runNum = Math.max(...nums) + 1;
        }
    }
    const runDir = path_1.default.join(baseDir, `run_${String(runNum).padStart(3, '0')}`);
    fs_1.default.mkdirSync(runDir, { recursive: true });
    return runDir;
}
function getAgentDir(runDir, agentName, nodeLabel) {
    const folderName = (agentName || nodeLabel)
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .replace(/\s+/g, '_');
    const dir = path_1.default.join(runDir, folderName);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
// Legacy: used by executeNode (single node, no run folder)
function getOutputDir(projectId) {
    const baseDir = getBaseOutputDir(projectId);
    if (!fs_1.default.existsSync(baseDir))
        fs_1.default.mkdirSync(baseDir, { recursive: true });
    return baseDir;
}
// --- Output naming with progressive numbering ---
function makeOutputTitle(nodeLabel, nodeType, projectId, nodeId) {
    const count = connection_1.default.prepare('SELECT COUNT(*) as cnt FROM outputs WHERE project_id = ? AND node_id = ? AND type = ?').get(projectId, nodeId, 'log');
    const num = (count?.cnt || 0) + 1;
    const padded = String(num).padStart(3, '0');
    return `${nodeLabel} #${padded}`;
}
function saveOutput(projectId, nodeId, type, title, content, metadata = {}) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO outputs (id, project_id, node_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, projectId, nodeId, type, title, content, JSON.stringify(metadata));
}
function updateNodeState(nodeId, state) {
    connection_1.default.prepare('UPDATE nodes SET state = ? WHERE id = ?').run(state, nodeId);
}
// --- AI call ---
async function callAI(providerId, modelId, systemPrompt, userPrompt) {
    if ((providerId === 'anthropic' && (0, anthropic_adapter_1.getAnthropicMode)() === 'claude_cli') || modelId === 'claude-cli') {
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
        return (0, claude_bridge_1.callClaudeCLI)(fullPrompt, { timeout: 15 * 60 * 1000 });
    }
    const messages = [];
    if (systemPrompt)
        messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    const result = await provider_registry_1.providerRegistry.chat(providerId, messages, modelId);
    return result.content;
}
// Image extensions supported for vision analysis
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']);
/**
 * Extract image files from a folder, sorted by modification time (newest first).
 */
function getImageFiles(folderPath) {
    if (!fs_1.default.existsSync(folderPath))
        return [];
    const files = fs_1.default.readdirSync(folderPath)
        .filter(f => !f.startsWith('.'))
        .map(f => {
        const fullPath = path_1.default.join(folderPath, f);
        const stat = fs_1.default.statSync(fullPath);
        const ext = path_1.default.extname(f).toLowerCase();
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
async function extractVideoFrames(videoPath, outputDir, intervalSec = 3) {
    const framesDir = path_1.default.join(outputDir, '_video_frames');
    if (!fs_1.default.existsSync(framesDir))
        fs_1.default.mkdirSync(framesDir, { recursive: true });
    const baseName = path_1.default.basename(videoPath, path_1.default.extname(videoPath));
    try {
        await execFileAsync('/opt/homebrew/bin/ffmpeg', [
            '-y', '-i', videoPath,
            '-vf', `fps=1/${intervalSec}`,
            '-frames:v', '10', // Max 10 frames
            path_1.default.join(framesDir, `${baseName}_frame_%03d.jpg`)
        ], { timeout: 30000 });
        return fs_1.default.readdirSync(framesDir)
            .filter(f => f.startsWith(baseName) && f.endsWith('.jpg'))
            .map(f => path_1.default.join(framesDir, f))
            .sort();
    }
    catch {
        return [];
    }
}
/**
 * Analyze images with Gemini Vision to detect specific objects/subjects.
 * Processes images from newest to oldest.
 * Returns list of matching files with descriptions.
 */
async function analyzeImagesForSearch(folderPath, searchQuery, systemPrompt, modelId, outputDir) {
    const gemini = provider_registry_1.providerRegistry.get('gemini');
    if (!gemini)
        throw new Error('Provider Gemini non configurato. Serve per analisi immagini.');
    const imageFiles = getImageFiles(folderPath);
    if (imageFiles.length === 0)
        return 'Nessuna immagine trovata nella cartella.';
    // Also check for videos
    const videoFiles = fs_1.default.readdirSync(folderPath)
        .filter(f => VIDEO_EXTENSIONS.has(path_1.default.extname(f).toLowerCase()))
        .map(f => path_1.default.join(folderPath, f));
    const allResults = [];
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
        }
        catch (err) {
            console.log(`[Vision] Errore batch: ${err.message}`);
            // Continue with next batch
        }
    }
    // Analyze video frames
    for (const videoPath of videoFiles) {
        const videoName = path_1.default.basename(videoPath);
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
            }
            catch { }
            // Cleanup frames
            for (const f of frames) {
                try {
                    fs_1.default.unlinkSync(f);
                }
                catch { }
            }
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
            output += `    Percorso: ${path_1.default.join(folderPath, r.file)}\n`;
        }
    }
    else {
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
            output += `${path_1.default.join(folderPath, r.file)}\n`;
        }
    }
    return output;
}
function parseConfig(raw) {
    if (!raw)
        return {};
    let current = raw;
    // Keep parsing until we get an object (handles any level of stringification)
    for (let i = 0; i < 10; i++) {
        if (typeof current !== 'string')
            break;
        try {
            current = JSON.parse(current);
        }
        catch {
            break;
        }
    }
    return typeof current === 'object' && current !== null ? current : {};
}
function makeOutputFileName(nodeLabel, ext, outputDir) {
    const base = nodeLabel.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    let num = 1;
    let fileName = `${base}.${ext}`;
    while (fs_1.default.existsSync(path_1.default.join(outputDir, fileName))) {
        num++;
        fileName = `${base}_${String(num).padStart(3, '0')}.${ext}`;
    }
    return fileName;
}
// --- Rewrite local file paths in HTML ---
// Convert file:///path/to/file.jpg and /path/to/file.jpg
// to http://localhost:PORT/api/v1/local-files/path/to/file.jpg
function rewriteLocalPaths(html) {
    const port = config_1.config.port;
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
function saveHTMLOutput(output, nodeLabel, outputDir) {
    const htmlContent = extractHTML(output);
    if (!htmlContent)
        return null;
    const rewritten = rewriteLocalPaths(htmlContent);
    const fileName = makeOutputFileName(nodeLabel, 'html', outputDir);
    const filePath = path_1.default.join(outputDir, fileName);
    fs_1.default.writeFileSync(filePath, rewritten, 'utf-8');
    return { filePath, html: rewritten };
}
// --- HTML to Video recording with Puppeteer ---
async function recordHTMLToVideo(htmlPath, outputPath, durationSec = 15) {
    // Check if puppeteer is available
    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    }
    catch {
        throw new Error('Puppeteer non installato. Esegui: npm install puppeteer');
    }
    const fps = 30;
    const totalFrames = durationSec * fps;
    const width = 1080;
    const height = 1920;
    const framesDir = path_1.default.join(path_1.default.dirname(outputPath), '_frames');
    if (!fs_1.default.existsSync(framesDir))
        fs_1.default.mkdirSync(framesDir, { recursive: true });
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
        const framePath = path_1.default.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
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
        '-i', path_1.default.join(framesDir, 'frame_%05d.png'),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '23',
        outputPath,
    ], { timeout: 120000 });
    // Cleanup frames
    try {
        const frames = fs_1.default.readdirSync(framesDir);
        for (const f of frames)
            fs_1.default.unlinkSync(path_1.default.join(framesDir, f));
        fs_1.default.rmdirSync(framesDir);
    }
    catch { }
    const stat = fs_1.default.statSync(outputPath);
    console.log(`[Video] Video creato: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
    return outputPath;
}
// --- Execute project ---
async function executeProject(projectId, onProgress, onNodeStart) {
    const nodes = connection_1.default.prepare('SELECT * FROM nodes WHERE project_id = ? ORDER BY position_y, position_x').all(projectId);
    const edges = connection_1.default.prepare('SELECT * FROM edges WHERE project_id = ?').all(projectId);
    const agents = connection_1.default.prepare('SELECT * FROM agents WHERE project_id = ?').all(projectId);
    // Create run directory: outputs/{ProjectName}/run_NNN/
    const runDir = createRunDir(projectId);
    console.log(`[Execute] Run directory: ${runDir}`);
    runningProjects.set(projectId, { status: 'running' });
    connection_1.default.prepare('UPDATE projects SET status = ? WHERE id = ?').run('in_esecuzione', projectId);
    const logs = [];
    const nodeOutputs = {};
    const incomingEdges = {};
    for (const edge of edges) {
        if (!incomingEdges[edge.target_id])
            incomingEdges[edge.target_id] = [];
        incomingEdges[edge.target_id].push(edge.source_id);
    }
    const visited = new Set();
    const order = [];
    function visit(node) {
        if (visited.has(node.id))
            return;
        visited.add(node.id);
        for (const depId of (incomingEdges[node.id] || [])) {
            const depNode = nodes.find(n => n.id === depId);
            if (depNode)
                visit(depNode);
        }
        order.push(node);
    }
    for (const node of nodes)
        visit(node);
    for (const node of order) {
        const execState = runningProjects.get(projectId);
        if (!execState || execState.status === 'stopping') {
            updateNodeState(node.id, 'bloccato');
            logs.push({ nodeId: node.id, label: node.label, status: 'fermato', output: 'Esecuzione fermata', duration: 0 });
            continue;
        }
        if (execState.status === 'paused') {
            await waitForResume(projectId);
            const after = runningProjects.get(projectId);
            if (!after || after.status === 'stopping') {
                updateNodeState(node.id, 'bloccato');
                logs.push({ nodeId: node.id, label: node.label, status: 'fermato', output: 'Esecuzione fermata', duration: 0 });
                continue;
            }
        }
        const start = Date.now();
        updateNodeState(node.id, 'in_esecuzione');
        if (onNodeStart)
            onNodeStart(node.id, node.label);
        const agent = node.agent_id ? agents.find(a => a.id === node.agent_id) : null;
        const providerId = node.provider_id || agent?.provider_id || 'anthropic';
        const modelId = node.model_id || agent?.model_id || 'claude-cli';
        const systemPrompt = node.system_prompt || agent?.system_prompt || '';
        const nodeConfig = parseConfig(node.config);
        // Per-agent/node output directory inside the run folder
        const nodeOutputDir = getAgentDir(runDir, agent?.name || null, node.label);
        try {
            let output = '';
            const deps = incomingEdges[node.id] || [];
            const inputContext = deps.map(d => nodeOutputs[d] || '').filter(Boolean).join('\n\n---\n\n');
            switch (node.type) {
                case 'sorgente': {
                    const sourcePath = nodeConfig.source_path || nodeConfig.folder_path || '';
                    if (sourcePath && fs_1.default.existsSync(sourcePath)) {
                        const stat = fs_1.default.statSync(sourcePath);
                        if (stat.isDirectory()) {
                            const files = fs_1.default.readdirSync(sourcePath).filter(f => !f.startsWith('.'));
                            output = `Cartella: ${sourcePath}\nFile trovati (${files.length}):\n${files.map(f => {
                                const fPath = path_1.default.join(sourcePath, f);
                                const fStat = fs_1.default.statSync(fPath);
                                return `- ${f} (${(fStat.size / 1024).toFixed(1)} KB)`;
                            }).join('\n')}`;
                        }
                        else {
                            output = fs_1.default.readFileSync(sourcePath, 'utf-8').slice(0, 10000);
                        }
                    }
                    else {
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
                        output = await analyzeImagesForSearch(folderPath, node.description || 'Analizza le immagini', systemPrompt, modelId || 'gemini-2.5-flash', nodeOutputDir);
                    }
                    else {
                        output = await callAI(providerId, modelId, systemPrompt, `${node.description || 'Analizza i seguenti dati'}\n\n${inputContext}`);
                    }
                    break;
                }
                case 'decisione': {
                    output = await callAI(providerId, modelId, systemPrompt, `${node.description || 'Valuta e decidi'}\n\nDati:\n${inputContext}`);
                    break;
                }
                case 'esecuzione': {
                    output = await callAI(providerId, modelId, systemPrompt, `${node.description || 'Esegui il compito'}\n\nContesto:\n${inputContext}`);
                    if (output.includes('<!DOCTYPE html>') || output.includes('<html') || output.includes('```html')) {
                        const saved = saveHTMLOutput(output, node.label, nodeOutputDir);
                        if (saved) {
                            output += `\n\n[File HTML salvato: ${saved.filePath}]`;
                            // Auto-record video if this is an animation node
                            if (nodeConfig.auto_video !== false) {
                                try {
                                    const videoName = makeOutputFileName(node.label, 'mp4', nodeOutputDir);
                                    const videoPath = path_1.default.join(nodeOutputDir, videoName);
                                    const duration = nodeConfig.video_duration || 15;
                                    await recordHTMLToVideo(saved.filePath, videoPath, duration);
                                    output += `\n[Video salvato: ${videoPath}]`;
                                }
                                catch (videoErr) {
                                    output += `\n[Video non creato: ${videoErr.message}]`;
                                }
                            }
                        }
                    }
                    break;
                }
                case 'automazione': {
                    const cmd = nodeConfig.command || '';
                    if (cmd) {
                        try {
                            const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
                                timeout: 300000, cwd: nodeOutputDir, env: { ...process.env },
                            });
                            output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
                        }
                        catch (err) {
                            output = `Errore comando: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`;
                        }
                    }
                    else {
                        output = `Automazione "${node.label}" eseguita.`;
                    }
                    break;
                }
                case 'memoria': {
                    output = inputContext || node.description || 'Nessun dato in memoria';
                    break;
                }
                default:
                    output = `Nodo tipo "${node.type}" eseguito.`;
            }
            nodeOutputs[node.id] = output;
            updateNodeState(node.id, 'completato');
            const duration = Date.now() - start;
            const title = makeOutputTitle(node.label, node.type, projectId, node.id);
            const log = { nodeId: node.id, label: node.label, status: 'completato', output: output.slice(0, 2000), duration };
            logs.push(log);
            saveOutput(projectId, node.id, 'log', title, output, { duration, provider: providerId, model: modelId, runDir, agentDir: nodeOutputDir });
            // Save output as text file in agent folder
            const outputFileName = `output_${node.type}.txt`;
            fs_1.default.writeFileSync(path_1.default.join(nodeOutputDir, outputFileName), output, 'utf-8');
            if (onProgress)
                onProgress(log);
        }
        catch (err) {
            updateNodeState(node.id, 'bloccato');
            const duration = Date.now() - start;
            const title = makeOutputTitle(node.label, node.type, projectId, node.id);
            const log = { nodeId: node.id, label: node.label, status: 'bloccato', output: `Errore: ${err.message}`, duration };
            logs.push(log);
            saveOutput(projectId, node.id, 'error', `Errore - ${title}`, err.message, { duration });
            if (onProgress)
                onProgress(log);
        }
    }
    const finalStatus = runningProjects.get(projectId)?.status === 'stopping' ? 'fermato' : 'completato';
    connection_1.default.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(finalStatus, new Date().toISOString(), projectId);
    runningProjects.delete(projectId);
    // Save run manifest
    const project = connection_1.default.prepare('SELECT name FROM projects WHERE id = ?').get(projectId);
    const manifest = {
        project: project?.name || projectId,
        projectId,
        runDir,
        status: finalStatus,
        startedAt: new Date(Date.now() - logs.reduce((s, l) => s + l.duration, 0)).toISOString(),
        completedAt: new Date().toISOString(),
        totalDuration: logs.reduce((s, l) => s + l.duration, 0),
        nodes: logs.map(l => ({
            nodeId: l.nodeId,
            label: l.label,
            status: l.status,
            duration: l.duration,
        })),
        agents: agents.map(a => ({ id: a.id, name: a.name, role: a.role })),
    };
    fs_1.default.writeFileSync(path_1.default.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[Execute] Manifest salvato: ${path_1.default.join(runDir, 'manifest.json')}`);
    return logs;
}
// --- Execute single node ---
async function executeNode(projectId, nodeId) {
    const node = connection_1.default.prepare('SELECT * FROM nodes WHERE id = ? AND project_id = ?').get(nodeId, projectId);
    if (!node)
        throw new Error('Nodo non trovato');
    const agents = connection_1.default.prepare('SELECT * FROM agents WHERE project_id = ?').all(projectId);
    const edges = connection_1.default.prepare('SELECT * FROM edges WHERE project_id = ? AND target_id = ?').all(projectId, nodeId);
    const outputDir = getOutputDir(projectId);
    const start = Date.now();
    updateNodeState(nodeId, 'in_esecuzione');
    const agent = node.agent_id ? agents.find((a) => a.id === node.agent_id) : null;
    const providerId = node.provider_id || agent?.provider_id || 'anthropic';
    const modelId = node.model_id || agent?.model_id || 'claude-cli';
    const systemPrompt = node.system_prompt || agent?.system_prompt || '';
    const nodeConfig = parseConfig(node.config);
    const prevOutputs = [];
    for (const edge of edges) {
        const prevOutput = connection_1.default.prepare('SELECT content FROM outputs WHERE project_id = ? AND node_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId, edge.source_id);
        if (prevOutput?.content)
            prevOutputs.push(prevOutput.content);
    }
    const inputContext = prevOutputs.join('\n\n---\n\n');
    const prompt = `${node.description || node.label}\n\n${inputContext}`;
    try {
        let output = '';
        if (node.type === 'sorgente') {
            const sourcePath = nodeConfig.source_path || nodeConfig.folder_path || '';
            if (sourcePath && fs_1.default.existsSync(sourcePath)) {
                const stat = fs_1.default.statSync(sourcePath);
                if (stat.isDirectory()) {
                    const files = fs_1.default.readdirSync(sourcePath).filter(f => !f.startsWith('.'));
                    output = `Cartella: ${sourcePath}\nFile trovati (${files.length}):\n${files.map(f => `- ${f}`).join('\n')}`;
                }
                else {
                    output = fs_1.default.readFileSync(sourcePath, 'utf-8').slice(0, 10000);
                }
            }
            else {
                output = nodeConfig.content || node.description || 'Nessuna sorgente';
            }
        }
        else if (node.type === 'analisi') {
            // Vision AI for image analysis
            const folderMatch = inputContext.match(/Cartella:\s*(.+)/);
            const hasImageKeywords = (node.description || '').match(/foto|immagin|image|picture|video|trova|cerca|selezion|riconosc|individu|detect|motoslit/i);
            if (folderMatch && hasImageKeywords && (providerId === 'gemini' || !providerId)) {
                const folderPath = folderMatch[1].trim();
                console.log(`[Vision] Analisi visiva singolo nodo: ${folderPath}`);
                output = await analyzeImagesForSearch(folderPath, node.description || 'Analizza le immagini', systemPrompt, modelId || 'gemini-2.5-flash', outputDir);
            }
            else {
                output = await callAI(providerId, modelId, systemPrompt, prompt);
            }
        }
        else if (node.type === 'automazione') {
            const cmd = nodeConfig.command || '';
            if (cmd) {
                const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
                    timeout: 300000, cwd: outputDir, env: { ...process.env },
                });
                output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            }
            else {
                output = 'Automazione eseguita';
            }
        }
        else {
            output = await callAI(providerId, modelId, systemPrompt, prompt);
            if (output.includes('<!DOCTYPE html>') || output.includes('<html') || output.includes('```html')) {
                const saved = saveHTMLOutput(output, node.label, outputDir);
                if (saved) {
                    output += `\n\n[File HTML salvato: ${saved.filePath}]`;
                    // Auto-record video
                    if (nodeConfig.auto_video !== false) {
                        try {
                            const videoName = makeOutputFileName(node.label, 'mp4', outputDir);
                            const videoPath = path_1.default.join(outputDir, videoName);
                            const duration = nodeConfig.video_duration || 15;
                            await recordHTMLToVideo(saved.filePath, videoPath, duration);
                            output += `\n[Video salvato: ${videoPath}]`;
                        }
                        catch (videoErr) {
                            output += `\n[Video non creato: ${videoErr.message}]`;
                        }
                    }
                }
            }
        }
        updateNodeState(nodeId, 'completato');
        const duration = Date.now() - start;
        const title = makeOutputTitle(node.label, node.type, projectId, nodeId);
        saveOutput(projectId, nodeId, 'log', title, output, { duration, provider: providerId, model: modelId });
        return { nodeId, label: node.label, status: 'completato', output: output.slice(0, 2000), duration };
    }
    catch (err) {
        updateNodeState(nodeId, 'bloccato');
        const duration = Date.now() - start;
        const title = makeOutputTitle(node.label, node.type, projectId, nodeId);
        saveOutput(projectId, nodeId, 'error', `Errore - ${title}`, err.message, { duration });
        return { nodeId, label: node.label, status: 'bloccato', output: `Errore: ${err.message}`, duration };
    }
}
// --- Standalone HTML to Video API ---
async function htmlToVideo(projectId, htmlFileName, durationSec) {
    const outputDir = getOutputDir(projectId);
    const htmlPath = path_1.default.join(outputDir, htmlFileName);
    if (!fs_1.default.existsSync(htmlPath))
        throw new Error(`File non trovato: ${htmlPath}`);
    const baseName = path_1.default.basename(htmlFileName, '.html');
    const videoName = makeOutputFileName(baseName, 'mp4', outputDir);
    const videoPath = path_1.default.join(outputDir, videoName);
    await recordHTMLToVideo(htmlPath, videoPath, durationSec || 15);
    saveOutput(projectId, '', 'file', `Video: ${videoName}`, videoPath, { type: 'video/mp4', source: htmlFileName });
    return videoPath;
}
// --- HTML extraction ---
function extractHTML(text) {
    const codeBlockMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
        const inner = codeBlockMatch[1].trim();
        if (inner.includes('<html') || inner.includes('<!DOCTYPE'))
            return inner;
    }
    const htmlMatch = text.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
    if (htmlMatch)
        return htmlMatch[1];
    const htmlMatch2 = text.match(/(<html[\s\S]*<\/html>)/i);
    if (htmlMatch2)
        return htmlMatch2[1];
    return null;
}
