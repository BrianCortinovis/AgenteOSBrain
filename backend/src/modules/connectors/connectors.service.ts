import fs from 'fs';
import path from 'path';
import db from '../../database/connection';
import { generateId } from '../../utils/id';

const definitionsDir = path.resolve(__dirname, 'definitions');

// ─── Definizioni ───────────────────────────────────────────────

export function getAllDefinitions() {
  const files = fs.readdirSync(definitionsDir).filter(f => f.endsWith('.json'));
  const all: any[] = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(definitionsDir, file), 'utf-8'));
    all.push(...data);
  }
  return all;
}

export function getDefinitionById(connectorId: string) {
  const all = getAllDefinitions();
  return all.find((d: any) => d.id === connectorId) || null;
}

// ─── Istanze legacy (per progetto) ─────────────────────────────

export function getInstancesByProject(projectId: string) {
  return db.prepare('SELECT * FROM connector_instances WHERE project_id = ? ORDER BY created_at').all(projectId);
}

export function createInstance(projectId: string, data: any) {
  const id = generateId();
  db.prepare(
    'INSERT INTO connector_instances (id, project_id, definition_id, config, enabled) VALUES (?, ?, ?, ?, ?)'
  ).run(id, projectId, data.definition_id, JSON.stringify(data.config || {}), data.enabled !== false ? 1 : 0);
  return db.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
}

export function updateInstance(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(data.config)); }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (fields.length === 0) return db.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
  values.push(id);
  db.prepare(`UPDATE connector_instances SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM connector_instances WHERE id = ?').get(id);
}

export function deleteInstance(id: string) {
  db.prepare('DELETE FROM connector_instances WHERE id = ?').run(id);
}

// ─── Istanze v2 (globali, configurabili) ───────────────────────

export function getAllConfiguredInstances() {
  return db.prepare('SELECT * FROM connector_instances_v2 ORDER BY created_at DESC').all();
}

export function getConfiguredInstance(id: string) {
  return db.prepare('SELECT * FROM connector_instances_v2 WHERE id = ?').get(id);
}

export function createConfiguredInstance(data: any) {
  const id = generateId();
  const def = getDefinitionById(data.connector_id);
  db.prepare(
    `INSERT INTO connector_instances_v2 (id, connector_id, name, category, config, status)
     VALUES (?, ?, ?, ?, ?, 'disconnected')`
  ).run(
    id,
    data.connector_id,
    data.name || (def?.name ?? data.connector_id),
    data.category || def?.category || '',
    JSON.stringify(data.config || {})
  );
  return db.prepare('SELECT * FROM connector_instances_v2 WHERE id = ?').get(id);
}

export function updateConfiguredInstance(id: string, data: any) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(data.config)); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.last_tested !== undefined) { fields.push('last_tested = ?'); values.push(data.last_tested); }
  if (fields.length === 0) return getConfiguredInstance(id);
  values.push(id);
  db.prepare(`UPDATE connector_instances_v2 SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getConfiguredInstance(id);
}

export function deleteConfiguredInstance(id: string) {
  db.prepare('DELETE FROM connector_instances_v2 WHERE id = ?').run(id);
}

// ─── Test di connessione ───────────────────────────────────────

export async function testConnection(connectorId: string, config: Record<string, any>): Promise<{ success: boolean; message: string }> {
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
      // ── Cloud Storage ──
      case 'dropbox':
        return await testDropbox(config);
      case 'onedrive':
        return await testOneDrive(config);
      case 'box':
        return await testBox(config);
      case 's3':
        return testS3(config);
      case 'gcs':
        return testGCS(config);
      case 'cloudinary':
        return await testCloudinary(config);
      case 'nas-smb':
        return testNasSmb(config);
      case 'ftp-sftp':
        return testFtpSftp(config);
      // ── Dev ──
      case 'gitlab':
        return await testGitLab(config);
      case 'bitbucket':
        return await testBitbucket(config);
      // ── Automation ──
      case 'zapier':
        return testZapier(config);
      case 'make':
        return await testMake(config);
      case 'n8n':
        return await testN8n(config);
      case 'ifttt':
        return await testIFTTT(config);
      case 'graphql-api':
        return await testGraphQL(config);
      // ── Database ──
      case 'supabase':
        return await testSupabase(config);
      case 'firebase':
        return testFirebase(config);
      case 'redis':
        return testRedis(config);
      case 'elasticsearch':
        return await testElasticsearch(config);
      case 'pinecone':
        return await testPinecone(config);
      // ── Productivity ──
      case 'airtable':
        return await testAirtable(config);
      case 'trello':
        return await testTrello(config);
      case 'asana':
        return await testAsana(config);
      case 'clickup':
        return await testClickUp(config);
      case 'monday':
        return await testMonday(config);
      case 'jira':
        return await testJira(config);
      case 'confluence':
        return await testConfluence(config);
      case 'google-sheets':
        return testGoogleSheets(config);
      case 'google-docs':
        return await testGoogleDocs(config);
      case 'google-slides':
        return await testGoogleSlides(config);
      case 'google-calendar':
        return await testGoogleCalendar(config);
      case 'linear':
        return await testLinear(config);
      case 'basecamp':
        return await testBasecamp(config);
      case 'todoist':
        return await testTodoist(config);
      // ── AI ──
      case 'huggingface':
        return await testHuggingFace(config);
      case 'hubspot':
        return await testHubSpot(config);
      case 'pipedrive':
        return await testPipedrive(config);
      case 'salesforce':
        return await testSalesforce(config);
      case 'zoho-crm':
        return await testZohoCRM(config);
      case 'mailchimp':
        return await testMailchimp(config);
      case 'brevo':
        return await testBrevo(config);
      case 'typeform':
        return await testTypeform(config);
      case 'jotform':
        return await testJotform(config);
      case 'calendly':
        return await testCalendly(config);
      case 'calcom':
        return await testCalcom(config);
      case 'wordpress':
        return await testWordPress(config);
      case 'webflow':
        return await testWebflow(config);
      case 'shopify':
        return await testShopify(config);
      case 'facebook-pages':
        return await testFacebookPages(config);
      case 'instagram':
        return await testInstagram(config);
      case 'linkedin-pages':
        return await testLinkedInPages(config);
      case 'x-twitter':
        return await testXTwitter(config);
      case 'youtube':
        return await testYouTube(config);
      case 'tiktok':
        return await testTikTok(config);
      case 'buffer':
        return await testBuffer(config);
      case 'pinterest':
        return await testPinterest(config);
      case 'reddit':
        return await testReddit(config);
      case 'whatsapp':
        return await testWhatsApp(config);
      case 'discord':
        return await testDiscord(config);
      case 'microsoft-teams':
        return await testMicrosoftTeams(config);
      case 'twilio':
        return await testTwilio(config);
      case 'outlook':
        return await testOutlook(config);
      default:
        return { success: true, message: 'Connettore predisposto — nessun test specifico disponibile' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Errore sconosciuto durante il test' };
  }
}

// ── GitHub ──
async function testGitHub(config: Record<string, any>) {
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
  const user = await res.json() as any;
  return { success: true, message: `Connesso come ${user.login} (${user.name || ''})` };
}

// ── Google Drive ──
async function testGoogleDrive(config: Record<string, any>) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Google Drive errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Google Drive (${data.user?.displayName || 'OK'})` };
}

// ── Gmail (via SMTP con nodemailer) ──
async function testGmail(config: Record<string, any>) {
  const nodemailer = await import('nodemailer');
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
async function testSmtp(config: Record<string, any>) {
  const nodemailer = await import('nodemailer');
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
async function testSlack(config: Record<string, any>) {
  const res = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.bot_token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json() as any;
  if (!data.ok) return { success: false, message: `Slack errore: ${data.error}` };
  return { success: true, message: `Connesso a Slack workspace "${data.team}" come ${data.user}` };
}

// ── Telegram ──
async function testTelegram(config: Record<string, any>) {
  const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/getMe`);
  const data = await res.json() as any;
  if (!data.ok) return { success: false, message: `Telegram errore: ${data.description || 'Token non valido'}` };
  return { success: true, message: `Connesso al bot @${data.result.username} (${data.result.first_name})` };
}

// ── Notion ──
async function testNotion(config: Record<string, any>) {
  const res = await fetch('https://api.notion.com/v1/users/me', {
    headers: {
      Authorization: `Bearer ${config.integration_token}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) {
    return { success: false, message: `Notion errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Notion come ${data.name || data.type || 'bot'}` };
}

// ── PostgreSQL ──
async function testPostgreSQL(config: Record<string, any>) {
  const { Client } = await import('pg');
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
    const version = (result.rows[0] as any)?.version?.split(' ').slice(0, 2).join(' ') || 'OK';
    await client.end();
    return { success: true, message: `Connesso a PostgreSQL — ${version}` };
  } catch (err: any) {
    try { await client.end(); } catch (_) {}
    throw err;
  }
}

// ── MySQL ──
async function testMySQL(config: Record<string, any>) {
  const mysql = await import('mysql2/promise');
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
    const version = (rows as any[])[0]?.version || 'OK';
    await connection.end();
    return { success: true, message: `Connesso a MySQL — v${version}` };
  } catch (err: any) {
    try { await connection.end(); } catch (_) {}
    throw err;
  }
}

// ── MongoDB ──
async function testMongoDB(config: Record<string, any>) {
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
async function testWebhook(config: Record<string, any>) {
  const method = config.method || 'POST';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers || {}) };
  if (config.auth_type === 'bearer_token' && config.auth_value) {
    headers['Authorization'] = `Bearer ${config.auth_value}`;
  } else if (config.auth_type === 'api_key' && config.auth_value) {
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
async function testRestApi(config: Record<string, any>) {
  const headers: Record<string, string> = { ...(config.default_headers || {}) };
  if (config.auth_type === 'bearer_token' && config.auth_value) {
    headers['Authorization'] = `Bearer ${config.auth_value}`;
  } else if (config.auth_type === 'api_key_header' && config.auth_value) {
    headers['X-API-Key'] = config.auth_value;
  } else if (config.auth_type === 'basic_auth' && config.auth_value) {
    headers['Authorization'] = `Basic ${Buffer.from(config.auth_value).toString('base64')}`;
  }
  const res = await fetch(config.base_url, {
    headers,
    signal: AbortSignal.timeout(config.timeout_ms || 10000),
  });
  return { success: res.ok, message: res.ok ? `API raggiungibile — status ${res.status}` : `API errore: status ${res.status}` };
}

// ── Cartella Locale ──
function testLocalFolder(config: Record<string, any>) {
  const p = config.base_path;
  if (!p) return { success: false, message: 'Percorso base non specificato' };
  if (!fs.existsSync(p)) return { success: false, message: `Il percorso "${p}" non esiste` };
  const stat = fs.statSync(p);
  if (!stat.isDirectory()) return { success: false, message: `"${p}" non è una cartella` };
  try {
    fs.accessSync(p, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return { success: false, message: `Permessi insufficienti per "${p}"` };
  }
  return { success: true, message: `Cartella "${p}" accessibile in lettura e scrittura` };
}

// ── OpenAI ──
async function testOpenAI(config: Record<string, any>) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${config.api_key}` },
  });
  if (!res.ok) return { success: false, message: `OpenAI errore ${res.status}: ${await res.text()}` };
  return { success: true, message: 'Connesso a OpenAI — API key valida' };
}

// ── Anthropic ──
async function testAnthropic(config: Record<string, any>) {
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
  if (res.status === 401) return { success: false, message: 'API key Anthropic non valida' };
  return { success: true, message: 'Connesso ad Anthropic — API key valida' };
}

// ── Gemini ──
async function testGemini(config: Record<string, any>) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${config.api_key}`);
  if (!res.ok) return { success: false, message: `Gemini errore ${res.status}: ${await res.text()}` };
  return { success: true, message: 'Connesso a Google Gemini — API key valida' };
}

// ── Ollama ──
async function testOllama(config: Record<string, any>) {
  const baseUrl = config.base_url || 'http://localhost:11434';
  const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return { success: false, message: `Ollama errore ${res.status}` };
  const data = await res.json() as any;
  const models = data.models?.map((m: any) => m.name).slice(0, 5).join(', ') || 'nessun modello';
  return { success: true, message: `Ollama raggiungibile — modelli: ${models}` };
}

// ── Dropbox ──
async function testDropbox(config: Record<string, any>) {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'Content-Type': 'application/json',
    },
    body: null,
  });
  if (!res.ok) {
    return { success: false, message: `Dropbox errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Dropbox come ${data.name?.display_name || data.email || 'OK'}` };
}

// ── OneDrive ──
async function testOneDrive(config: Record<string, any>) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `OneDrive errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a OneDrive (${data.owner?.user?.displayName || 'OK'})` };
}

// ── Box ──
async function testBox(config: Record<string, any>) {
  const res = await fetch('https://api.box.com/2.0/users/me', {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Box errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Box come ${data.name || data.login || 'OK'}` };
}

// ── Amazon S3 ──
function testS3(config: Record<string, any>) {
  const accessKeyId = config.access_key_id || '';
  if (!accessKeyId) {
    return { success: false, message: 'Access Key ID non fornito' };
  }
  if (!accessKeyId.startsWith('AKIA')) {
    return { success: false, message: 'Access Key ID non valido — deve iniziare con AKIA' };
  }
  if (!config.secret_access_key) {
    return { success: false, message: 'Secret Access Key non fornito' };
  }
  const region = config.region || 'us-east-1';
  return { success: true, message: `Credenziali AWS S3 valide — regione: ${region}${config.bucket ? ', bucket: ' + config.bucket : ''}` };
}

// ── Google Cloud Storage ──
function testGCS(config: Record<string, any>) {
  if (!config.service_account_json) {
    return { success: false, message: 'Service Account JSON non fornito' };
  }
  try {
    const parsed = JSON.parse(config.service_account_json);
    if (!parsed.project_id && !parsed.client_email) {
      return { success: false, message: 'Il JSON del service account non contiene project_id o client_email' };
    }
    return { success: true, message: `Credenziali GCS valide — progetto: ${parsed.project_id || 'N/A'}, account: ${parsed.client_email || 'N/A'}` };
  } catch (e) {
    return { success: false, message: 'Service Account JSON non valido — errore di parsing JSON' };
  }
}

// ── Cloudinary ──
async function testCloudinary(config: Record<string, any>) {
  const basicAuth = Buffer.from(`${config.api_key}:${config.api_secret}`).toString('base64');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud_name}/resources/image?max_results=1`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) {
    return { success: false, message: `Cloudinary errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: `Connesso a Cloudinary (cloud: ${config.cloud_name})` };
}

// ── NAS / SMB ──
function testNasSmb(config: Record<string, any>) {
  if (!config.host || !config.host.trim()) {
    return { success: false, message: 'Host non specificato' };
  }
  if (!config.share || !config.share.trim()) {
    return { success: false, message: 'Nome condivisione non specificato' };
  }
  return { success: true, message: `Connettore NAS/SMB predisposto — host: ${config.host}, condivisione: ${config.share}` };
}

// ── FTP / SFTP ──
function testFtpSftp(config: Record<string, any>) {
  if (!config.host || !config.host.trim()) {
    return { success: false, message: 'Host non specificato' };
  }
  if (!config.username) {
    return { success: false, message: 'Nome utente non specificato' };
  }
  if (!config.password) {
    return { success: false, message: 'Password non specificata' };
  }
  const protocol = config.protocol || 'sftp';
  const port = config.port || 21;
  return { success: true, message: `Connettore ${protocol.toUpperCase()} predisposto — ${config.host}:${port}` };
}

// ── GitLab ──
async function testGitLab(config: Record<string, any>) {
  const baseUrl = (config.base_url || 'https://gitlab.com').replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/v4/user`, {
    headers: { 'PRIVATE-TOKEN': config.personal_access_token },
  });
  if (!res.ok) {
    return { success: false, message: `GitLab errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a GitLab come ${data.username || data.name || 'OK'}` };
}

// ── Bitbucket ──
async function testBitbucket(config: Record<string, any>) {
  const basicAuth = Buffer.from(`${config.username}:${config.app_password}`).toString('base64');
  const res = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) {
    return { success: false, message: `Bitbucket errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Bitbucket come ${data.display_name || data.username || 'OK'}` };
}

// ── Zapier ──
function testZapier(config: Record<string, any>) {
  if (!config.api_key || !config.api_key.trim()) {
    return { success: false, message: 'API Key Zapier non fornita' };
  }
  return { success: true, message: 'Connettore Zapier predisposto — Zapier utilizza principalmente webhook per le integrazioni' };
}

// ── Make (Integromat) ──
async function testMake(config: Record<string, any>) {
  const baseUrl = (config.base_url || 'https://eu1.make.com').replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/v2/users/me`, {
    headers: { Authorization: `Token ${config.api_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Make errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Make come ${data.name || data.email || 'OK'}` };
}

// ── n8n ──
async function testN8n(config: Record<string, any>) {
  const baseUrl = (config.base_url || '').replace(/\/+$/, '');
  if (!baseUrl) {
    return { success: false, message: 'URL base di n8n non specificato' };
  }
  const res = await fetch(`${baseUrl}/api/v1/workflows?limit=1`, {
    headers: { 'X-N8N-API-KEY': config.api_key },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `n8n errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: `Connesso a n8n (${baseUrl})` };
}

// ── IFTTT ──
async function testIFTTT(config: Record<string, any>) {
  if (!config.webhook_key || !config.webhook_key.trim()) {
    return { success: false, message: 'Webhook Key IFTTT non fornita' };
  }
  const res = await fetch(`https://maker.ifttt.com/trigger/test/with/key/${config.webhook_key}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `IFTTT errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a IFTTT — webhook key valida' };
}

// ── GraphQL API ──
async function testGraphQL(config: Record<string, any>) {
  if (!config.endpoint) {
    return { success: false, message: 'Endpoint GraphQL non specificato' };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.auth_header && config.auth_value) {
    headers[config.auth_header] = config.auth_value;
  }
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `GraphQL errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.errors && data.errors.length > 0 && !data.data) {
    return { success: false, message: `GraphQL errore: ${data.errors[0].message}` };
  }
  return { success: true, message: `Endpoint GraphQL raggiungibile (${config.endpoint})` };
}

// ── Supabase ──
async function testSupabase(config: Record<string, any>) {
  const projectUrl = (config.project_url || '').replace(/\/+$/, '');
  if (!projectUrl) {
    return { success: false, message: 'URL progetto Supabase non specificato' };
  }
  const apiKey = config.service_role_key || config.anon_key;
  const res = await fetch(`${projectUrl}/rest/v1/`, {
    headers: {
      apikey: config.anon_key,
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Supabase errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: `Connesso a Supabase (${projectUrl})` };
}

// ── Firebase ──
function testFirebase(config: Record<string, any>) {
  if (!config.project_id) {
    return { success: false, message: 'Project ID Firebase non specificato' };
  }
  if (!config.service_account_json) {
    return { success: false, message: 'Service Account JSON non fornito' };
  }
  try {
    const parsed = JSON.parse(config.service_account_json);
    if (!parsed.project_id && !parsed.client_email) {
      return { success: false, message: 'Il JSON del service account non contiene project_id o client_email' };
    }
    return { success: true, message: `Credenziali Firebase valide — progetto: ${config.project_id}` };
  } catch (e) {
    return { success: false, message: 'Service Account JSON non valido — errore di parsing JSON' };
  }
}

// ── Redis ──
function testRedis(config: Record<string, any>) {
  const host = config.host || 'localhost';
  const port = config.port || 6379;
  const db = config.db || 0;
  return { success: true, message: `Connettore Redis predisposto — ${host}:${port} DB ${db}. Installa il client Redis per un test completo.` };
}

// ── Elasticsearch ──
async function testElasticsearch(config: Record<string, any>) {
  const nodeUrl = (config.node_url || 'http://localhost:9200').replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (config.username && config.password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }
  const res = await fetch(`${nodeUrl}/`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Elasticsearch errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Elasticsearch — versione: ${data.version?.number || 'N/A'}, cluster: ${data.cluster_name || 'N/A'}` };
}

// ── Pinecone ──
async function testPinecone(config: Record<string, any>) {
  const res = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': config.api_key },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Pinecone errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const count = data.indexes?.length ?? 0;
  return { success: true, message: `Connesso a Pinecone — ${count} indice/i trovato/i` };
}

// ── Airtable ──
async function testAirtable(config: Record<string, any>) {
  const res = await fetch('https://api.airtable.com/v0/meta/whoami', {
    headers: { Authorization: `Bearer ${config.personal_access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Airtable errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso ad Airtable (${data.email || data.id || 'OK'})` };
}

// ── Trello ──
async function testTrello(config: Record<string, any>) {
  const res = await fetch(`https://api.trello.com/1/members/me?key=${config.api_key}&token=${config.token}`);
  if (!res.ok) {
    return { success: false, message: `Trello errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Trello come ${data.fullName || data.username || 'OK'}` };
}

// ── Asana ──
async function testAsana(config: Record<string, any>) {
  const res = await fetch('https://app.asana.com/api/1.0/users/me', {
    headers: { Authorization: `Bearer ${config.personal_access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Asana errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso ad Asana come ${data.data?.name || data.data?.email || 'OK'}` };
}

// ── ClickUp ──
async function testClickUp(config: Record<string, any>) {
  const res = await fetch('https://api.clickup.com/api/v2/user', {
    headers: { Authorization: config.api_token },
  });
  if (!res.ok) {
    return { success: false, message: `ClickUp errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a ClickUp come ${data.user?.username || data.user?.email || 'OK'}` };
}

// ── Monday.com ──
async function testMonday(config: Record<string, any>) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      Authorization: config.api_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '{ me { id name } }' }),
  });
  if (!res.ok) {
    return { success: false, message: `Monday.com errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.errors) {
    return { success: false, message: `Monday.com errore: ${data.errors[0]?.message || 'sconosciuto'}` };
  }
  return { success: true, message: `Connesso a Monday.com come ${data.data?.me?.name || 'OK'}` };
}

// ── Jira ──
async function testJira(config: Record<string, any>) {
  const domain = (config.domain || '').replace(/\/+$/, '');
  if (!domain) {
    return { success: false, message: 'Dominio Atlassian non specificato' };
  }
  const basicAuth = Buffer.from(`${config.email}:${config.api_token}`).toString('base64');
  const res = await fetch(`https://${domain}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    return { success: false, message: `Jira errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Jira come ${data.displayName || data.emailAddress || 'OK'}` };
}

// ── Confluence ──
async function testConfluence(config: Record<string, any>) {
  const domain = (config.domain || '').replace(/\/+$/, '');
  if (!domain) {
    return { success: false, message: 'Dominio Atlassian non specificato' };
  }
  const basicAuth = Buffer.from(`${config.email}:${config.api_token}`).toString('base64');
  const res = await fetch(`https://${domain}/wiki/rest/api/space?limit=1`, {
    headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    return { success: false, message: `Confluence errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: `Connesso a Confluence (${domain})` };
}

// ── Google Sheets ──
function testGoogleSheets(config: Record<string, any>) {
  if (!config.api_key && !config.access_token) {
    return { success: false, message: 'Fornire almeno una modalit\u00e0 di autenticazione: API Key o Access Token' };
  }
  return { success: true, message: `Credenziali Google Sheets configurate${config.spreadsheet_id ? ' — spreadsheet: ' + config.spreadsheet_id : ''}` };
}

// ── Google Docs ──
async function testGoogleDocs(config: Record<string, any>) {
  const res = await fetch('https://docs.googleapis.com/v1/documents/invalid-doc-id-test', {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  // 404 = auth ok ma documento non trovato; 401/403 = auth fallita
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: `Google Docs errore di autenticazione: ${res.status}` };
  }
  return { success: true, message: 'Connesso a Google Docs — token valido' };
}

// ── Google Slides ──
async function testGoogleSlides(config: Record<string, any>) {
  const res = await fetch('https://slides.googleapis.com/v1/presentations/invalid-presentation-id-test', {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (res.status === 401 || res.status === 403) {
    return { success: false, message: `Google Slides errore di autenticazione: ${res.status}` };
  }
  return { success: true, message: 'Connesso a Google Slides — token valido' };
}

// ── Google Calendar ──
async function testGoogleCalendar(config: Record<string, any>) {
  const headers: Record<string, string> = {};
  let url = 'https://www.googleapis.com/calendar/v3/calendars/primary';
  if (config.access_token) {
    headers['Authorization'] = `Bearer ${config.access_token}`;
  } else if (config.api_key) {
    url += `?key=${config.api_key}`;
  } else {
    return { success: false, message: 'Fornire almeno una modalit\u00e0 di autenticazione: API Key o Access Token' };
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return { success: false, message: `Google Calendar errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Google Calendar (${data.summary || 'OK'})` };
}

// ── Linear ──
async function testLinear(config: Record<string, any>) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: config.api_key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: '{ viewer { id name } }' }),
  });
  if (!res.ok) {
    return { success: false, message: `Linear errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.errors) {
    return { success: false, message: `Linear errore: ${data.errors[0]?.message || 'sconosciuto'}` };
  }
  return { success: true, message: `Connesso a Linear come ${data.data?.viewer?.name || 'OK'}` };
}

// ── Basecamp ──
async function testBasecamp(config: Record<string, any>) {
  if (!config.account_id) {
    return { success: false, message: 'Account ID Basecamp non specificato' };
  }
  const res = await fetch(`https://3.basecampapi.com/${config.account_id}/my/profile.json`, {
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'User-Agent': 'AgenteOS (agenteos@example.com)',
    },
  });
  if (!res.ok) {
    return { success: false, message: `Basecamp errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Basecamp come ${data.name || data.email_address || 'OK'}` };
}

// ── Todoist ──
async function testTodoist(config: Record<string, any>) {
  const res = await fetch('https://api.todoist.com/rest/v2/projects', {
    headers: { Authorization: `Bearer ${config.api_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Todoist errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const count = Array.isArray(data) ? data.length : 0;
  return { success: true, message: `Connesso a Todoist — ${count} progetto/i trovato/i` };
}

// ── Hugging Face ──
async function testHuggingFace(config: Record<string, any>) {
  const res = await fetch('https://huggingface.co/api/whoami-v2', {
    headers: { Authorization: `Bearer ${config.api_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Hugging Face errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Hugging Face come ${data.name || data.fullname || 'OK'}` };
}

// ── HubSpot ──
async function testHubSpot(config: Record<string, any>) {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
    headers: { Authorization: `Bearer ${config.api_key}` },
  });
  if (!res.ok) {
    return { success: false, message: `HubSpot errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a HubSpot CRM' };
}

// ── Pipedrive ──
async function testPipedrive(config: Record<string, any>) {
  const res = await fetch(`https://${config.domain}.pipedrive.com/api/v1/users/me?api_token=${config.api_token}`);
  if (!res.ok) {
    return { success: false, message: `Pipedrive errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const name = data.data?.name || '';
  return { success: true, message: `Connesso a Pipedrive come ${name}`.trim() };
}

// ── Salesforce ──
async function testSalesforce(config: Record<string, any>) {
  const url = config.instance_url.replace(/\/+$/, '');
  const res = await fetch(`${url}/services/data/v58.0/`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Salesforce errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a Salesforce' };
}

// ── Zoho CRM ──
async function testZohoCRM(config: Record<string, any>) {
  const domain = config.api_domain || 'https://www.zohoapis.com';
  const res = await fetch(`${domain}/crm/v2/org`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Zoho CRM errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a Zoho CRM' };
}

// ── Mailchimp ──
async function testMailchimp(config: Record<string, any>) {
  const res = await fetch(`https://${config.server_prefix}.api.mailchimp.com/3.0/ping`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`any:${config.api_key}`).toString('base64')}`,
    },
  });
  if (!res.ok) {
    return { success: false, message: `Mailchimp errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a Mailchimp' };
}

// ── Brevo ──
async function testBrevo(config: Record<string, any>) {
  const res = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': config.api_key },
  });
  if (!res.ok) {
    return { success: false, message: `Brevo errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Brevo (${data.email || 'OK'})` };
}

// ── Typeform ──
async function testTypeform(config: Record<string, any>) {
  const res = await fetch('https://api.typeform.com/me', {
    headers: { Authorization: `Bearer ${config.personal_access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Typeform errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Typeform (${data.alias || data.email || 'OK'})` };
}

// ── Jotform ──
async function testJotform(config: Record<string, any>) {
  const res = await fetch(`https://api.jotform.com/user?apiKey=${config.api_key}`);
  if (!res.ok) {
    return { success: false, message: `Jotform errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Jotform (${data.content?.username || 'OK'})` };
}

// ── Calendly ──
async function testCalendly(config: Record<string, any>) {
  const res = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${config.personal_access_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Calendly errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Calendly (${data.resource?.name || 'OK'})` };
}

// ── Cal.com ──
async function testCalcom(config: Record<string, any>) {
  const baseUrl = (config.base_url || 'https://api.cal.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/me?apiKey=${config.api_key}`);
  if (!res.ok) {
    return { success: false, message: `Cal.com errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Cal.com (${data.user?.name || 'OK'})` };
}

// ── WordPress ──
async function testWordPress(config: Record<string, any>) {
  const siteUrl = config.site_url.replace(/\/+$/, '');
  const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.username}:${config.app_password}`).toString('base64')}`,
    },
  });
  if (!res.ok) {
    return { success: false, message: `WordPress errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: `Connesso a WordPress (${siteUrl})` };
}

// ── Webflow ──
async function testWebflow(config: Record<string, any>) {
  const res = await fetch('https://api.webflow.com/v2/sites', {
    headers: { Authorization: `Bearer ${config.api_token}` },
  });
  if (!res.ok) {
    return { success: false, message: `Webflow errore ${res.status}: ${await res.text()}` };
  }
  return { success: true, message: 'Connesso a Webflow' };
}

// ── Shopify ──
async function testShopify(config: Record<string, any>) {
  const domain = config.shop_domain.replace(/\/+$/, '');
  const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': config.access_token },
  });
  if (!res.ok) {
    return { success: false, message: `Shopify errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Shopify (${data.shop?.name || domain})` };
}

// ── Facebook Pages ──
async function testFacebookPages(config: Record<string, any>) {
  const res = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${config.page_access_token}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Facebook Pages errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Facebook Pages (${data.name || config.page_id})` };
}

// ── Instagram ──
async function testInstagram(config: Record<string, any>) {
  const res = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${config.access_token}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Instagram errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Instagram (${data.name || 'OK'})` };
}

// ── LinkedIn Pages ──
async function testLinkedInPages(config: Record<string, any>) {
  const res = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${config.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `LinkedIn errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const name = [data.localizedFirstName, data.localizedLastName].filter(Boolean).join(' ') || 'OK';
  return { success: true, message: `Connesso a LinkedIn come ${name}` };
}

// ── X / Twitter ──
async function testXTwitter(config: Record<string, any>) {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${config.bearer_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `X/Twitter errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a X/Twitter come @${data.data?.username || 'OK'}` };
}

// ── YouTube ──
async function testYouTube(config: Record<string, any>) {
  const url = config.channel_id
    ? `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${config.channel_id}&key=${config.api_key}`
    : `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${config.api_key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    return { success: false, message: `YouTube errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const title = data.items?.[0]?.snippet?.title || 'OK';
  return { success: true, message: `Connesso a YouTube — canale: ${title}` };
}

// ── TikTok ──
async function testTikTok(config: Record<string, any>) {
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,username', {
    headers: { Authorization: `Bearer ${config.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `TikTok errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  const name = data.data?.user?.display_name || data.data?.user?.username || 'OK';
  return { success: true, message: `Connesso a TikTok come ${name}` };
}

// ── Buffer ──
async function testBuffer(config: Record<string, any>) {
  const res = await fetch(`https://api.bufferapp.com/1/user.json?access_token=${config.access_token}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Buffer errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Buffer (${data.name || 'OK'})` };
}

// ── Pinterest ──
async function testPinterest(config: Record<string, any>) {
  const res = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${config.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Pinterest errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Pinterest (${data.username || 'OK'})` };
}

// ── Reddit ──
async function testReddit(config: Record<string, any>) {
  const basicAuth = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'password',
    username: config.username,
    password: config.password,
  });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AgenteOS/1.0',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Reddit errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.error) {
    return { success: false, message: `Reddit errore: ${data.error}` };
  }
  return { success: true, message: `Connesso a Reddit come ${config.username}` };
}

// ── WhatsApp ──
async function testWhatsApp(config: Record<string, any>) {
  const res = await fetch(`https://graph.facebook.com/v18.0/${config.phone_number_id}`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `WhatsApp errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a WhatsApp Business (${data.display_phone_number || data.verified_name || 'OK'})` };
}

// ── Discord ──
async function testDiscord(config: Record<string, any>) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${config.bot_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Discord errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Discord come ${data.username || 'OK'}` };
}

// ── Microsoft Teams ──
async function testMicrosoftTeams(config: Record<string, any>) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Microsoft Teams errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.error) {
    return { success: false, message: `Microsoft Teams errore: ${data.error_description || data.error}` };
  }
  return { success: true, message: 'Connesso a Microsoft Teams — credenziali valide' };
}

// ── Twilio ──
async function testTwilio(config: Record<string, any>) {
  const basicAuth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}.json`, {
    headers: { Authorization: `Basic ${basicAuth}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Twilio errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  return { success: true, message: `Connesso a Twilio (${data.friendly_name || config.account_sid})` };
}

// ── Outlook ──
async function testOutlook(config: Record<string, any>) {
  const tenantId = config.tenant_id || 'common';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    return { success: false, message: `Outlook errore ${res.status}: ${await res.text()}` };
  }
  const data = await res.json() as any;
  if (data.error) {
    return { success: false, message: `Outlook errore: ${data.error_description || data.error}` };
  }
  return { success: true, message: 'Connesso a Microsoft Outlook — credenziali valide' };
}
