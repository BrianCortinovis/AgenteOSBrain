"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkClaudeCLI = checkClaudeCLI;
exports.installClaudeCLI = installClaudeCLI;
exports.callClaudeCLI = callClaudeCLI;
exports.chatClaudeCLI = chatClaudeCLI;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const SEARCH_PATHS = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path_1.default.join(os_1.default.homedir(), '.local', 'bin', 'claude'),
    path_1.default.join(os_1.default.homedir(), '.npm-global', 'bin', 'claude'),
];
function findNvmPaths() {
    const nvmDir = path_1.default.join(os_1.default.homedir(), '.nvm', 'versions', 'node');
    if (!fs_1.default.existsSync(nvmDir))
        return [];
    try {
        return fs_1.default.readdirSync(nvmDir).map(v => path_1.default.join(nvmDir, v, 'bin', 'claude'));
    }
    catch {
        return [];
    }
}
let cachedStatus = null;
async function checkClaudeCLI() {
    if (cachedStatus)
        return cachedStatus;
    const allPaths = [...SEARCH_PATHS, ...findNvmPaths()];
    for (const p of allPaths) {
        if (fs_1.default.existsSync(p)) {
            try {
                const { stdout } = await execFileAsync(p, ['--version'], { timeout: 5000 });
                cachedStatus = { found: true, path: p, version: stdout.trim() };
                return cachedStatus;
            }
            catch {
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
    }
    catch {
        // not found
    }
    return { found: false, path: '', version: '' };
}
async function installClaudeCLI() {
    try {
        const prefix = path_1.default.join(os_1.default.homedir(), '.local');
        await execFileAsync('npm', ['install', '-g', '@anthropic-ai/claude-code', '--prefix', prefix], {
            timeout: 120000,
            env: { ...process.env },
        });
        cachedStatus = null; // reset cache
        const status = await checkClaudeCLI();
        return { success: status.found, message: status.found ? 'Claude CLI installato con successo' : 'Installazione completata ma CLI non trovato' };
    }
    catch (err) {
        return { success: false, message: `Errore installazione: ${err.message}` };
    }
}
// Max timeout: 15 minuti per generazioni complesse (HTML, codice, ecc.)
const MAX_TIMEOUT = 15 * 60 * 1000; // 900000ms
async function callClaudeCLI(prompt, options) {
    const status = await checkClaudeCLI();
    if (!status.found) {
        throw new Error('Claude CLI non trovato. Installalo dalla pagina Impostazioni.');
    }
    return new Promise((resolve, reject) => {
        const timeout = options?.timeout || MAX_TIMEOUT;
        const child = (0, child_process_1.spawn)(status.path, ['--output-format', 'text', '--tools', '', '-p', '-'], {
            env: { ...process.env, NO_COLOR: '1' },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Claude CLI timeout dopo ${Math.round(timeout / 60000)} minuti`));
        }, timeout);
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve(stdout.trim());
            }
            else {
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
async function chatClaudeCLI(systemPrompt, messages) {
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
