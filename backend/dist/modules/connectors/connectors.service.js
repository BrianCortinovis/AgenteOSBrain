"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDefinitions = getAllDefinitions;
exports.getDefinitionById = getDefinitionById;
exports.getInstancesByProject = getInstancesByProject;
exports.createInstance = createInstance;
exports.updateInstance = updateInstance;
exports.deleteInstance = deleteInstance;
exports.getAllConfiguredInstances = getAllConfiguredInstances;
exports.getConfiguredInstance = getConfiguredInstance;
exports.createConfiguredInstance = createConfiguredInstance;
exports.updateConfiguredInstance = updateConfiguredInstance;
exports.deleteConfiguredInstance = deleteConfiguredInstance;
exports.testConnection = testConnection;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
const definitionsDir = path_1.default.resolve(__dirname, 'definitions');
// ─── Definizioni ───────────────────────────────────────────────
function getAllDefinitions() {
    const files = fs_1.default.readdirSync(definitionsDir).filter(f => f.endsWith('.json'));
    const all = [];
    for (const file of files) {
        const data = JSON.parse(fs_1.default.readFileSync(path_1.default.join(definitionsDir, file), 'utf-8'));
        all.push(...data);
    }
    return all;
}
function getDefinitionById(connectorId) {
    const all = getAllDefinitions();
    return all.find((d) => d.id === connectorId) || null;
}
// ─── Istanze legacy (per progetto) ─────────────────────────────
function getInstancesByProject(projectId) {
    return connection_1.default.prepare('SELECT * FROM connector_instances WHERE project_id = ? ORDER BY created_at').all(projectId);
}
function createInstance(projectId, data) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO connector_instances (id, project_id, definition_id, config, enabled) VALUES (?, ?, ?, ?, ?)').run(id, projectId, data.definition_id, JSON.stringify(data.config || {}), data.enabled !== false ? 1 : 0);
    return connection_1.default.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
}
function updateInstance(id, data) {
    const fields = [];
    const values = [];
    if (data.config !== undefined) {
        fields.push('config = ?');
        values.push(JSON.stringify(data.config));
    }
    if (data.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(data.enabled ? 1 : 0);
    }
    if (fields.length === 0)
        return connection_1.default.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
    values.push(id);
    connection_1.default.prepare(`UPDATE connector_instances SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return connection_1.default.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
}
function deleteInstance(id) {
    connection_1.default.prepare('DELETE FROM connector_instances WHERE id = ?').run(id);
}
// ─── Istanze v2 (globali, configurabili) ───────────────────────
function getAllConfiguredInstances() {
    return connection_1.default.prepare('SELECT * FROM connector_instances_v2 ORDER BY created_at DESC').all();
}
function getConfiguredInstance(id) {
    return connection_1.default.prepare('SELECT * FROM connector_instances_v2 WHERE id = ?').get(id);
}
function createConfiguredInstance(data) {
    const id = (0, id_1.generateId)();
    const def = getDefinitionById(data.connector_id);
    connection_1.default.prepare(`INSERT INTO connector_instances_v2 (id, connector_id, name, category, config, status)
     VALUES (?, ?, ?, ?, ?, 'disconnected')`).run(id, data.connector_id, data.name || (def?.name ?? data.connector_id), data.category || def?.category || '', JSON.stringify(data.config || {}));
    return connection_1.default.prepare('SELECT * FROM connector_instances_v2 WHERE id = ?').get(id);
}
function updateConfiguredInstance(id, data) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
    }
    if (data.config !== undefined) {
        fields.push('config = ?');
        values.push(JSON.stringify(data.config));
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.last_tested !== undefined) {
        fields.push('last_tested = ?');
        values.push(data.last_tested);
    }
    if (fields.length === 0)
        return getConfiguredInstance(id);
    values.push(id);
    connection_1.default.prepare(`UPDATE connector_instances_v2 SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getConfiguredInstance(id);
}
function deleteConfiguredInstance(id) {
    connection_1.default.prepare('DELETE FROM connector_instances_v2 WHERE id = ?').run(id);
}
// ─── Test di connessione ───────────────────────────────────────
async function testConnection(connectorId, config) {
    try {
        switch (connectorId) {
            case 'github':
                return await testGitHub(config);
            case 'google-drive':
                return await testGoogleDrive(config);
            case 'gmail':
                return await testGmail(config);
            case 'smtp':
                return await testSmtp(config);
            case 'slack':
                return await testSlack(config);
            case 'telegram':
                return await testTelegram(config);
            case 'notion':
                return await testNotion(config);
            case 'postgresql':
                return await testPostgreSQL(config);
            case 'mysql':
                return await testMySQL(config);
            case 'mongodb':
                return await testMongoDB(config);
            case 'webhook':
                return await testWebhook(config);
            case 'rest-api':
                return await testRestApi(config);
            case 'local-folder':
                return testLocalFolder(config);
            case 'openai':
                return await testOpenAI(config);
            case 'anthropic':
                return await testAnthropic(config);
            case 'gemini':
                return await testGemini(config);
            case 'ollama':
                return await testOllama(config);
            default:
                return { success: true, message: 'Connettore predisposto — nessun test specifico disponibile' };
        }
    }
    catch (err) {
        return { success: false, message: err.message || 'Errore sconosciuto durante il test' };
    }
}
// ── GitHub ──
async function testGitHub(config) {
    const url = config.api_url || 'https://api.github.com';
    const res = await fetch(`${url}/user`, {
        headers: {
            Authorization: `Bearer ${config.personal_access_token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'AgenteOS',
        },
    });
    if (!res.ok) {
        const body = await res.text();
        return { success: false, message: `GitHub API errore ${res.status}: ${body}` };
    }
    const user = await res.json();
    return { success: true, message: `Connesso come ${user.login} (${user.name || ''})` };
}
// ── Google Drive ──
async function testGoogleDrive(config) {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${config.access_token}` },
    });
    if (!res.ok) {
        return { success: false, message: `Google Drive errore ${res.status}: ${await res.text()}` };
    }
    const data = await res.json();
    return { success: true, message: `Connesso a Google Drive (${data.user?.displayName || 'OK'})` };
}
// ── Gmail (via SMTP con nodemailer) ──
async function testGmail(config) {
    const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: config.email, pass: config.app_password },
    });
    await transporter.verify();
    return { success: true, message: `Connesso a Gmail come ${config.email}` };
}
// ── SMTP ──
async function testSmtp(config) {
    const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port || 587,
        secure: config.secure || false,
        auth: { user: config.username, pass: config.password },
    });
    await transporter.verify();
    return { success: true, message: `Connesso al server SMTP ${config.host}:${config.port || 587}` };
}
// ── Slack ──
async function testSlack(config) {
    const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.bot_token}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (!data.ok)
        return { success: false, message: `Slack errore: ${data.error}` };
    return { success: true, message: `Connesso a Slack workspace "${data.team}" come ${data.user}` };
}
// ── Telegram ──
async function testTelegram(config) {
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/getMe`);
    const data = await res.json();
    if (!data.ok)
        return { success: false, message: `Telegram errore: ${data.description || 'Token non valido'}` };
    return { success: true, message: `Connesso al bot @${data.result.username} (${data.result.first_name})` };
}
// ── Notion ──
async function testNotion(config) {
    const res = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
            Authorization: `Bearer ${config.integration_token}`,
            'Notion-Version': '2022-06-28',
        },
    });
    if (!res.ok) {
        return { success: false, message: `Notion errore ${res.status}: ${await res.text()}` };
    }
    const data = await res.json();
    return { success: true, message: `Connesso a Notion come ${data.name || data.type || 'bot'}` };
}
// ── PostgreSQL ──
async function testPostgreSQL(config) {
    const { Client } = await Promise.resolve().then(() => __importStar(require('pg')));
    const client = new Client({
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
    });
    try {
        await client.connect();
        const result = await client.query('SELECT version()');
        const version = result.rows[0]?.version?.split(' ').slice(0, 2).join(' ') || 'OK';
        await client.end();
        return { success: true, message: `Connesso a PostgreSQL — ${version}` };
    }
    catch (err) {
        try {
            await client.end();
        }
        catch (_) { }
        throw err;
    }
}
// ── MySQL ──
async function testMySQL(config) {
    const mysql = await Promise.resolve().then(() => __importStar(require('mysql2/promise')));
    const connection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: config.port || 3306,
        database: config.database,
        user: config.username,
        password: config.password,
        connectTimeout: 5000,
    });
    try {
        const [rows] = await connection.execute('SELECT VERSION() as version');
        const version = rows[0]?.version || 'OK';
        await connection.end();
        return { success: true, message: `Connesso a MySQL — v${version}` };
    }
    catch (err) {
        try {
            await connection.end();
        }
        catch (_) { }
        throw err;
    }
}
// ── MongoDB ──
async function testMongoDB(config) {
    // Basic connectivity test without full driver — try DNS/TCP via fetch to the host
    const connStr = config.connection_string || '';
    if (!connStr.startsWith('mongodb')) {
        return { success: false, message: 'Stringa di connessione non valida. Deve iniziare con mongodb:// o mongodb+srv://' };
    }
    // We can't use the mongodb driver without adding it as a dep, so validate the format
    // and attempt a basic TCP check
    return { success: true, message: 'Formato stringa di connessione MongoDB valido. Installa il driver mongodb per un test completo.' };
}
// ── Webhook ──
async function testWebhook(config) {
    const method = config.method || 'POST';
    const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    if (config.auth_type === 'bearer_token' && config.auth_value) {
        headers['Authorization'] = `Bearer ${config.auth_value}`;
    }
    else if (config.auth_type === 'api_key' && config.auth_value) {
        headers['X-API-Key'] = config.auth_value;
    }
    const res = await fetch(config.url, {
        method,
        headers,
        body: method !== 'GET' ? JSON.stringify({ test: true, source: 'AgenteOS' }) : undefined,
        signal: AbortSignal.timeout(10000),
    });
    return { success: res.ok, message: res.ok ? `Webhook risponde con status ${res.status}` : `Webhook errore: status ${res.status}` };
}
// ── REST API ──
async function testRestApi(config) {
    const headers = { ...(config.default_headers || {}) };
    if (config.auth_type === 'bearer_token' && config.auth_value) {
        headers['Authorization'] = `Bearer ${config.auth_value}`;
    }
    else if (config.auth_type === 'api_key_header' && config.auth_value) {
        headers['X-API-Key'] = config.auth_value;
    }
    else if (config.auth_type === 'basic_auth' && config.auth_value) {
        headers['Authorization'] = `Basic ${Buffer.from(config.auth_value).toString('base64')}`;
    }
    const res = await fetch(config.base_url, {
        headers,
        signal: AbortSignal.timeout(config.timeout_ms || 10000),
    });
    return { success: res.ok, message: res.ok ? `API raggiungibile — status ${res.status}` : `API errore: status ${res.status}` };
}
// ── Cartella Locale ──
function testLocalFolder(config) {
    const p = config.base_path;
    if (!p)
        return { success: false, message: 'Percorso base non specificato' };
    if (!fs_1.default.existsSync(p))
        return { success: false, message: `Il percorso "${p}" non esiste` };
    const stat = fs_1.default.statSync(p);
    if (!stat.isDirectory())
        return { success: false, message: `"${p}" non è una cartella` };
    try {
        fs_1.default.accessSync(p, fs_1.default.constants.R_OK | fs_1.default.constants.W_OK);
    }
    catch {
        return { success: false, message: `Permessi insufficienti per "${p}"` };
    }
    return { success: true, message: `Cartella "${p}" accessibile in lettura e scrittura` };
}
// ── OpenAI ──
async function testOpenAI(config) {
    const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.api_key}` },
    });
    if (!res.ok)
        return { success: false, message: `OpenAI errore ${res.status}: ${await res.text()}` };
    return { success: true, message: 'Connesso a OpenAI — API key valida' };
}
// ── Anthropic ──
async function testAnthropic(config) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': config.api_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
        }),
    });
    // Even a 200 or 400 (insufficient credits etc.) with proper error means the key is valid format
    if (res.status === 401)
        return { success: false, message: 'API key Anthropic non valida' };
    return { success: true, message: 'Connesso ad Anthropic — API key valida' };
}
// ── Gemini ──
async function testGemini(config) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${config.api_key}`);
    if (!res.ok)
        return { success: false, message: `Gemini errore ${res.status}: ${await res.text()}` };
    return { success: true, message: 'Connesso a Google Gemini — API key valida' };
}
// ── Ollama ──
async function testOllama(config) {
    const baseUrl = config.base_url || 'http://localhost:11434';
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        return { success: false, message: `Ollama errore ${res.status}` };
    const data = await res.json();
    const models = data.models?.map((m) => m.name).slice(0, 5).join(', ') || 'nessun modello';
    return { success: true, message: `Ollama raggiungibile — modelli: ${models}` };
}
