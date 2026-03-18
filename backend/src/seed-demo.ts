/**
 * Seed script: crea 3 progetti demo con agenti, nodi, edge e configurazioni.
 * Esegui con: npx tsx backend/src/seed-demo.ts
 */

import { runMigrations } from './database/migrate';
import db from './database/connection';
import { generateId } from './utils/id';

runMigrations();

// ═══════════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════════

function createProject(name: string, description: string, status = 'pronto') {
  const id = generateId();
  db.prepare(
    `INSERT INTO projects (id, name, description, status) VALUES (?, ?, ?, ?)`
  ).run(id, name, description, status);
  console.log(`[Seed] Progetto: "${name}" (${id})`);
  return id;
}

function createAgent(projectId: string, data: {
  name: string; role?: string; provider_id?: string; model_id?: string;
  system_prompt?: string; temperature?: number; tools?: string[];
  memory_enabled?: boolean; scope?: string;
}) {
  const id = generateId();
  const metadata = JSON.stringify({
    category: data.role || 'generalista',
    summary: data.system_prompt?.slice(0, 100) || '',
    capabilities: data.tools || [],
  });
  db.prepare(
    `INSERT INTO agents (id, project_id, name, role, provider_id, model_id, system_prompt, temperature, tools, memory_enabled, scope, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, projectId, data.name, data.role || '',
    data.provider_id || 'openai', data.model_id || 'gpt-4o',
    data.system_prompt || '', data.temperature ?? 0.7,
    JSON.stringify(data.tools || []), data.memory_enabled ? 1 : 0,
    data.scope || 'project', metadata,
  );
  console.log(`  Agente: "${data.name}" (${data.provider_id || 'openai'}/${data.model_id || 'gpt-4o'})`);
  return id;
}

function createNode(projectId: string, data: {
  type: string; label: string; description?: string; state?: string;
  color?: string; config?: any; position_x: number; position_y: number;
  agent_id?: string; provider_id?: string; model_id?: string; system_prompt?: string;
}) {
  const id = generateId();
  db.prepare(
    `INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, agent_id, provider_id, model_id, system_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, projectId, data.type, data.label, data.description || '',
    data.state || 'pronto', data.color || '',
    JSON.stringify(data.config || {}),
    data.position_x, data.position_y,
    data.agent_id || null, data.provider_id || '', data.model_id || '',
    data.system_prompt || '',
  );
  return id;
}

function createEdge(projectId: string, sourceId: string, targetId: string, label = '') {
  const id = generateId();
  db.prepare(
    `INSERT INTO edges (id, project_id, source_id, target_id, label) VALUES (?, ?, ?, ?, ?)`
  ).run(id, projectId, sourceId, targetId, label);
  return id;
}

function createSkill(name: string, description: string, category: string, content: string) {
  const id = generateId();
  db.prepare(
    `INSERT OR IGNORE INTO skills (id, name, description, category, content) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, description, category, content);
  console.log(`  Skill: "${name}"`);
}

function setWorkspaceConfig(key: string, value: string) {
  db.prepare(
    `INSERT OR REPLACE INTO workspace_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`
  ).run(key, value);
}

// ═══════════════════════════════════════════════════════════════
//  CONFIGURAZIONE WORKSPACE
// ═══════════════════════════════════════════════════════════════

console.log('\n[Seed] Configurazione Workspace...');
setWorkspaceConfig('soul', `Sei Agent OS Brain, un assistente IA avanzato e professionale.
Rispondi sempre in italiano con tono chiaro, preciso e collaborativo.
Quando generi contenuti, sii creativo ma concreto.
Quando analizzi dati, sii rigoroso e strutturato.
Preferisci risposte concise e azionabili.`);
setWorkspaceConfig('identity', 'Agent OS Brain');
console.log('  Personalità SOUL configurata');

// ═══════════════════════════════════════════════════════════════
//  SKILLS DEMO
// ═══════════════════════════════════════════════════════════════

console.log('\n[Seed] Skills demo...');
createSkill('seo-analyzer', 'Analizza SEO di un sito web e fornisce raccomandazioni', 'marketing',
  `Analizza il sito web fornito e valuta:
1. Meta tag (title, description, keywords)
2. Struttura headings (H1-H6)
3. Performance e velocità stimata
4. Mobile-friendliness
5. Qualità dei contenuti
6. Link interni ed esterni
Fornisci un punteggio da 1-100 e raccomandazioni prioritizzate.`);

createSkill('email-writer', 'Genera email professionali in italiano', 'comunicazione',
  `Scrivi email professionali seguendo queste regole:
- Oggetto chiaro e conciso (max 60 caratteri)
- Apertura cortese e diretta
- Corpo strutturato con punti chiave
- Chiusura con call-to-action chiara
- Tono: professionale ma non freddo
- Lingua: italiano formale`);

createSkill('data-summarizer', 'Riassume dati complessi in insight azionabili', 'analisi',
  `Prendi i dati forniti e:
1. Identifica i pattern principali
2. Evidenzia anomalie o outlier
3. Genera 3-5 insight chiave
4. Suggerisci azioni concrete basate sui dati
Usa tabelle e bullet point per chiarezza.`);

createSkill('social-content', 'Genera contenuti per social media', 'marketing',
  `Genera contenuti per social media:
- Instagram: caption coinvolgente + hashtag rilevanti (max 30)
- LinkedIn: post professionale con hook iniziale
- Twitter/X: thread di 3-5 tweet concisi
Adatta tono e formato alla piattaforma target.`);

// ═══════════════════════════════════════════════════════════════
//  PROGETTO 1: Content Marketing Pipeline
// ═══════════════════════════════════════════════════════════════

console.log('\n[Seed] Progetto 1: Content Marketing Pipeline...');
const p1 = createProject(
  'Esempio_1 - Content Marketing Pipeline',
  'Pipeline automatica per generare contenuti marketing: ricerca trend, scrittura articolo, creazione post social, invio newsletter. Dimostra tool use, connettori e multi-agente.',
);

// Agenti
const a1_researcher = createAgent(p1, {
  name: 'Trend Researcher',
  role: 'ricercatore',
  provider_id: 'openai',
  model_id: 'gpt-4o',
  system_prompt: 'Sei un ricercatore di trend e mercato. Analizza i topic più rilevanti nel settore indicato, identifica keyword ad alto volume e suggerisci angoli editoriali unici.',
  tools: ['web_search', 'memory_search', 'memory_save'],
  memory_enabled: true,
});

const a1_writer = createAgent(p1, {
  name: 'Content Writer',
  role: 'copywriter',
  provider_id: 'anthropic',
  model_id: 'claude-sonnet-4-20250514',
  system_prompt: 'Sei un copywriter esperto. Scrivi articoli SEO-friendly, coinvolgenti e ben strutturati in italiano. Usa headings, bullet point e call-to-action. Lunghezza target: 800-1200 parole.',
  tools: ['memory_search'],
  memory_enabled: true,
});

const a1_social = createAgent(p1, {
  name: 'Social Media Manager',
  role: 'social media',
  provider_id: 'openai',
  model_id: 'gpt-4o-mini',
  system_prompt: 'Sei un social media manager. Trasforma articoli in post ottimizzati per Instagram, LinkedIn e Twitter/X. Includi hashtag, emoji strategici e hook iniziali.',
  tools: ['connector_action'],
});

const a1_mailer = createAgent(p1, {
  name: 'Email Specialist',
  role: 'email marketing',
  provider_id: 'openai',
  model_id: 'gpt-4o-mini',
  system_prompt: 'Sei uno specialista di email marketing. Crea newsletter HTML responsive con oggetto accattivante, preview text ottimizzato e CTA chiare.',
  tools: ['connector_action'],
});

// Nodi
const n1_topic = createNode(p1, {
  type: 'sorgente', label: 'Topic Input', position_x: 100, position_y: 50,
  description: 'Settore: Intelligenza Artificiale per PMI italiane',
  config: { content: 'Settore: Intelligenza Artificiale applicata alle PMI italiane. Focus: automazione processi, riduzione costi, casi di successo reali.' },
  color: '#5cb8b2',
});

const n1_research = createNode(p1, {
  type: 'analisi', label: 'Ricerca Trend', position_x: 100, position_y: 200,
  description: 'Cerca i trend più attuali nel settore indicato, identifica 3 topic ad alto potenziale e suggerisci keyword',
  agent_id: a1_researcher, provider_id: 'openai', model_id: 'gpt-4o',
  color: '#8b8fc6',
});

const n1_article = createNode(p1, {
  type: 'esecuzione', label: 'Scrittura Articolo', position_x: 100, position_y: 380,
  description: 'Scrivi un articolo di blog completo sul topic più promettente dalla ricerca. 1000 parole, SEO-optimized, in italiano.',
  agent_id: a1_writer, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514',
  color: '#4ebb8b',
});

const n1_social = createNode(p1, {
  type: 'esecuzione', label: 'Post Social Media', position_x: 400, position_y: 380,
  description: "Genera post per Instagram (caption + hashtag), LinkedIn (post professionale) e Twitter (thread 3 tweet) basati sull'articolo",
  agent_id: a1_social, provider_id: 'openai', model_id: 'gpt-4o-mini',
  color: '#4ebb8b',
});

const n1_memory = createNode(p1, {
  type: 'memoria', label: 'Salva in Memoria', position_x: 400, position_y: 200,
  description: 'Salva i risultati della ricerca nella memoria persistente per riferimenti futuri',
  color: '#7a7ec4',
});

const n1_newsletter = createNode(p1, {
  type: 'esecuzione', label: 'Genera Newsletter', position_x: 250, position_y: 560,
  description: "Crea una newsletter HTML responsive con l'articolo come contenuto principale, preview dei post social e CTA per iscriversi al blog",
  agent_id: a1_mailer, provider_id: 'openai', model_id: 'gpt-4o-mini',
  color: '#4ebb8b',
});

// Edges
createEdge(p1, n1_topic, n1_research);
createEdge(p1, n1_research, n1_article);
createEdge(p1, n1_research, n1_memory);
createEdge(p1, n1_research, n1_social);
createEdge(p1, n1_article, n1_social);
createEdge(p1, n1_article, n1_newsletter);
createEdge(p1, n1_social, n1_newsletter);

console.log('  6 nodi, 7 edge creati');

// ═══════════════════════════════════════════════════════════════
//  PROGETTO 2: Analisi Competitiva con Vision AI
// ═══════════════════════════════════════════════════════════════

console.log('\n[Seed] Progetto 2: Analisi Competitiva con Vision AI...');
const p2 = createProject(
  'Esempio_2 - Analisi Competitiva Vision AI',
  'Analizza screenshot di siti competitor con Gemini Vision, genera report comparativo PDF, decide la strategia migliore. Dimostra Vision AI, PDF reports e nodi decisione.',
);

const a2_vision = createAgent(p2, {
  name: 'Visual Analyzer',
  role: 'analista visivo',
  provider_id: 'gemini',
  model_id: 'gemini-2.5-flash',
  system_prompt: 'Sei un analista UX/UI esperto. Analizza screenshot di siti web e identifica: layout, colori dominanti, CTA, punti di forza e debolezza del design. Confronta con le best practice del settore.',
  memory_enabled: true,
  tools: ['memory_save'],
});

const a2_strategist = createAgent(p2, {
  name: 'Strategy Advisor',
  role: 'stratega',
  provider_id: 'anthropic',
  model_id: 'claude-sonnet-4-20250514',
  system_prompt: 'Sei un consulente strategico senior. Basandoti su analisi competitive, formuli raccomandazioni concrete con priorità, timeline e impatto stimato. Sei diretto e orientato ai risultati.',
  tools: ['memory_search', 'web_search'],
  memory_enabled: true,
});

const a2_reporter = createAgent(p2, {
  name: 'Report Generator',
  role: 'report',
  provider_id: 'openai',
  model_id: 'gpt-4o',
  system_prompt: 'Sei un generatore di report professionali. Crea report strutturati con executive summary, analisi dettagliata, tabelle comparative, grafici testuali e raccomandazioni. Formato adatto a presentazioni C-level.',
});

// Nodi
const n2_source = createNode(p2, {
  type: 'sorgente', label: 'URL Competitor', position_x: 250, position_y: 50,
  description: 'Lista competitor da analizzare',
  config: { content: 'Competitor da analizzare:\n1. competitor-alpha.it - E-commerce fashion\n2. competitor-beta.it - E-commerce fashion\n3. competitor-gamma.it - E-commerce fashion\n\nFocus: homepage, pagina prodotto, checkout flow' },
  color: '#5cb8b2',
});

const n2_analyze = createNode(p2, {
  type: 'analisi', label: 'Analisi Visiva UX', position_x: 100, position_y: 220,
  description: 'Analizza ogni competitor dal punto di vista UX/UI: layout, navigazione, CTA, mobile experience, accessibilità, velocità percepita',
  agent_id: a2_vision, provider_id: 'gemini', model_id: 'gemini-2.5-flash',
  color: '#8b8fc6',
});

const n2_webresearch = createNode(p2, {
  type: 'analisi', label: 'Ricerca Web Competitor', position_x: 420, position_y: 220,
  description: 'Cerca informazioni pubbliche sui competitor: recensioni, rating, traffic estimates, tecnologie usate',
  agent_id: a2_strategist, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514',
  color: '#8b8fc6',
});

const n2_decide = createNode(p2, {
  type: 'decisione', label: 'Valutazione Strategica', position_x: 250, position_y: 400,
  description: 'Confronta tutti i competitor, identifica gap e opportunità, classifica per minaccia/opportunità. Decidi le 3 azioni prioritarie.',
  agent_id: a2_strategist, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514',
  color: '#d4a952',
});

const n2_report = createNode(p2, {
  type: 'esecuzione', label: 'Report PDF Comparativo', position_x: 250, position_y: 570,
  description: 'Genera un report professionale completo con: executive summary, matrice SWOT, tabella comparativa, raccomandazioni prioritizzate con timeline',
  agent_id: a2_reporter, provider_id: 'openai', model_id: 'gpt-4o',
  system_prompt: 'Genera un report analisi competitiva professionale. Includi sezioni: Executive Summary, Panoramica Competitor, Analisi SWOT, Matrice Comparativa, Raccomandazioni Top 5, Next Steps.',
  color: '#4ebb8b',
});

const n2_memory = createNode(p2, {
  type: 'memoria', label: 'Archivio Analisi', position_x: 500, position_y: 400,
  description: 'Salva i risultati per confronti futuri',
  color: '#7a7ec4',
});

createEdge(p2, n2_source, n2_analyze);
createEdge(p2, n2_source, n2_webresearch);
createEdge(p2, n2_analyze, n2_decide);
createEdge(p2, n2_webresearch, n2_decide);
createEdge(p2, n2_decide, n2_report);
createEdge(p2, n2_decide, n2_memory);

console.log('  6 nodi, 6 edge creati');

// ═══════════════════════════════════════════════════════════════
//  PROGETTO 3: DevOps Automation + Notifiche Multi-Canale
// ═══════════════════════════════════════════════════════════════

console.log('\n[Seed] Progetto 3: DevOps Automation + Notifiche...');
const p3 = createProject(
  'Esempio_3 - DevOps Automation Hub',
  'Automazione DevOps: monitora repository, analizza code quality, esegue comandi shell, genera report e invia notifiche su Telegram/Slack. Dimostra automazione, connettori, shell exec e scheduling.',
);

const a3_devops = createAgent(p3, {
  name: 'DevOps Engineer',
  role: 'devops',
  provider_id: 'openai',
  model_id: 'gpt-4o',
  system_prompt: 'Sei un DevOps engineer senior. Analizzi output di comandi, log e metriche. Identifichi problemi, suggerisci fix e best practice. Sei pratico e orientato alla soluzione.',
  tools: ['shell_exec', 'read_file', 'write_file', 'memory_save'],
  memory_enabled: true,
});

const a3_security = createAgent(p3, {
  name: 'Security Auditor',
  role: 'sicurezza',
  provider_id: 'anthropic',
  model_id: 'claude-sonnet-4-20250514',
  system_prompt: 'Sei un security auditor. Analizzi codice e configurazioni per vulnerabilità OWASP Top 10, misconfigurazioni, secrets esposti, dipendenze vulnerabili. Classifica per severità: Critical, High, Medium, Low.',
  tools: ['read_file', 'shell_exec', 'web_search'],
  memory_enabled: true,
});

const a3_notifier = createAgent(p3, {
  name: 'Notification Bot',
  role: 'notifiche',
  provider_id: 'openai',
  model_id: 'gpt-4o-mini',
  system_prompt: 'Sei un bot di notifiche. Formatta i messaggi in modo chiaro con emoji per indicare severità: 🔴 critico, 🟡 warning, 🟢 ok. Includi sempre un riassunto in 1 riga.',
  tools: ['connector_action'],
});

// Nodi
const n3_source = createNode(p3, {
  type: 'sorgente', label: 'Repository Config', position_x: 250, position_y: 50,
  description: 'Configurazione del repository da monitorare',
  config: { content: 'Repository: /Users/brian/Documents/AgenteOSBrain\nControlli: git status, npm audit, TypeScript errors, file structure\nNotifiche: Telegram, Slack' },
  color: '#5cb8b2',
});

const n3_gitcheck = createNode(p3, {
  type: 'automazione', label: 'Git Status Check', position_x: 100, position_y: 220,
  description: 'Controlla lo stato del repository git',
  config: { command: 'cd /Users/brian/Documents/AgenteOSBrain && git status --short && echo "---BRANCH---" && git branch --show-current && echo "---LOG---" && git log --oneline -5 2>/dev/null || echo "Not a git repo"' },
  color: '#b868a8',
});

const n3_npmaudit = createNode(p3, {
  type: 'automazione', label: 'NPM Audit', position_x: 420, position_y: 220,
  description: 'Verifica vulnerabilità nelle dipendenze',
  config: { command: 'cd /Users/brian/Documents/AgenteOSBrain/backend && npm audit --json 2>/dev/null | head -50 || echo "No audit issues"' },
  color: '#b868a8',
});

const n3_tscheck = createNode(p3, {
  type: 'automazione', label: 'TypeScript Check', position_x: 250, position_y: 220,
  description: 'Verifica errori TypeScript',
  config: { command: 'cd /Users/brian/Documents/AgenteOSBrain/backend && npx tsc --noEmit 2>&1 | tail -5 || echo "TS OK"' },
  color: '#b868a8',
});

const n3_analyze = createNode(p3, {
  type: 'analisi', label: 'Analisi DevOps', position_x: 100, position_y: 420,
  description: 'Analizza tutti gli output dei check e identifica problemi, priorità e azioni correttive',
  agent_id: a3_devops, provider_id: 'openai', model_id: 'gpt-4o',
  color: '#8b8fc6',
});

const n3_security = createNode(p3, {
  type: 'analisi', label: 'Security Audit', position_x: 420, position_y: 420,
  description: 'Valuta i risultati dal punto di vista della sicurezza. Identifica vulnerabilità, secrets esposti, configurazioni rischiose.',
  agent_id: a3_security, provider_id: 'anthropic', model_id: 'claude-sonnet-4-20250514',
  color: '#d45555',
});

const n3_decide = createNode(p3, {
  type: 'decisione', label: 'Prioritizzazione', position_x: 250, position_y: 580,
  description: 'Classifica tutti i problemi per severità e urgenza. Crea un piano di azione ordinato.',
  agent_id: a3_devops, provider_id: 'openai', model_id: 'gpt-4o',
  color: '#d4a952',
});

const n3_report = createNode(p3, {
  type: 'esecuzione', label: 'Report Stato Sistema', position_x: 100, position_y: 740,
  description: 'Genera un report completo sullo stato del sistema con tabella severità, azioni correttive e timeline',
  agent_id: a3_devops, provider_id: 'openai', model_id: 'gpt-4o',
  system_prompt: 'Genera un report DevOps con: Stato Generale (semaforo), Problemi Trovati (tabella), Security Issues, Azioni Correttive Prioritizzate, Metriche Repository.',
  color: '#4ebb8b',
});

const n3_notify = createNode(p3, {
  type: 'esecuzione', label: 'Notifica Telegram/Slack', position_x: 420, position_y: 740,
  description: 'Invia un riassunto delle notifiche su Telegram e Slack con i problemi critici trovati',
  agent_id: a3_notifier, provider_id: 'openai', model_id: 'gpt-4o-mini',
  config: { connector_id: 'telegram', connector_action: 'send_message', connector_params: {} },
  color: '#4ebb8b',
});

createEdge(p3, n3_source, n3_gitcheck);
createEdge(p3, n3_source, n3_npmaudit);
createEdge(p3, n3_source, n3_tscheck);
createEdge(p3, n3_gitcheck, n3_analyze);
createEdge(p3, n3_npmaudit, n3_analyze);
createEdge(p3, n3_tscheck, n3_analyze);
createEdge(p3, n3_npmaudit, n3_security);
createEdge(p3, n3_tscheck, n3_security);
createEdge(p3, n3_analyze, n3_decide);
createEdge(p3, n3_security, n3_decide);
createEdge(p3, n3_decide, n3_report);
createEdge(p3, n3_decide, n3_notify);

console.log('  9 nodi, 12 edge creati');

// ═══════════════════════════════════════════════════════════════
//  FINE
// ═══════════════════════════════════════════════════════════════

console.log('\n✅ Seed completato! 3 progetti demo creati.');
console.log('   - Esempio_1: Content Marketing Pipeline (6 nodi, 4 agenti)');
console.log('   - Esempio_2: Analisi Competitiva Vision AI (6 nodi, 3 agenti)');
console.log('   - Esempio_3: DevOps Automation Hub (9 nodi, 3 agenti)');
console.log('   + 4 skills demo installate');
console.log('   + Personalità SOUL configurata\n');
