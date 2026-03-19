import db from '../../database/connection';
import { generateId } from '../../utils/id';
import { providerRegistry } from '../providers/provider-registry';
import { saveGraph } from '../graph/graph.service';
import { updateProject } from '../projects/projects.service';
import { getAnthropicMode } from '../providers/adapters/anthropic.adapter';
import { getAgentsByProject } from '../agents/agents.service';
import { getFallbackModelSelection, selectBestModelForTask } from '../providers/model-routing';
import { getSoulPrompt } from '../workspace/workspace.service';
import { buildMemoryContext, extractAndSaveMemories } from '../memory/memory.service';

const VALID_NODE_TYPES = new Set(['sorgente', 'analisi', 'decisione', 'esecuzione', 'memoria', 'automazione']);
const VALID_PROJECT_STATUS = new Set(['bozza', 'pronto', 'in_esecuzione', 'completato']);
const NODE_COLORS: Record<string, string> = {
  sorgente: '#3b82f6',
  analisi: '#8b5cf6',
  decisione: '#f59e0b',
  esecuzione: '#10b981',
  memoria: '#6366f1',
  automazione: '#ec4899',
};

type PlannerNode = {
  key?: string;
  type?: string;
  label?: string;
  description?: string;
  state?: string;
  color?: string;
  config?: Record<string, any>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  provider_id?: string;
  model_id?: string;
  system_prompt?: string;
  agent_id?: string;
  agent_name?: string;
};

type PlannerEdge = {
  source_key?: string;
  target_key?: string;
  label?: string;
  condition?: string;
};

type WorkflowPlan = {
  mode?: 'chat' | 'build_project' | 'build_app';
  assistant_response?: string;
  project?: {
    name?: string;
    description?: string;
    status?: string;
  };
  graph?: {
    replace?: boolean;
    nodes?: PlannerNode[];
    edges?: PlannerEdge[];
  };
};

type PlannerCandidate = {
  providerId: string;
  modelId: string;
};

export function getChatHistory(projectId: string) {
  return db.prepare('SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at').all(projectId);
}

export function saveChatMessage(projectId: string, role: string, content: string, metadata: any = {}) {
  const id = generateId();
  db.prepare(
    'INSERT INTO chat_messages (id, project_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)'
  ).run(id, projectId, role, content, JSON.stringify(metadata));
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
}

export function clearChatHistory(projectId: string) {
  db.prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId);
}

// ─── Context Compaction ─────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 40;
const COMPACT_KEEP_RECENT = 8;

/**
 * Compact chat history when it exceeds MAX_HISTORY_MESSAGES.
 * Summarizes older messages into a single system message, keeping recent ones intact.
 * Also flushes key facts to persistent memory before compaction.
 */
async function compactChatHistory(
  projectId: string,
  history: { role: string; content: string }[],
  providerId: string,
  modelId: string
): Promise<{ role: string; content: string }[]> {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;

  const toCompact = history.slice(0, history.length - COMPACT_KEEP_RECENT);
  const toKeep = history.slice(history.length - COMPACT_KEEP_RECENT);

  // Flush key facts to persistent memory before compacting
  const compactedText = toCompact.map(m => `[${m.role}]: ${m.content.slice(0, 500)}`).join('\n');
  extractAndSaveMemories(compactedText, projectId, undefined, 'chat_compaction');

  // Summarize the older messages
  try {
    const summaryPrompt = [
      { role: 'system', content: 'Riassumi la seguente conversazione in modo conciso mantenendo i punti chiave, le decisioni prese e le informazioni importanti. Rispondi solo con il riassunto, in italiano.' },
      { role: 'user', content: compactedText },
    ];
    const summaryResult = await providerRegistry.chat(providerId, summaryPrompt, modelId, { temperature: 0.1, max_tokens: 1000 });

    // Delete old messages from DB and insert compacted summary
    const allMessages: any[] = db.prepare(
      'SELECT id FROM chat_messages WHERE project_id = ? ORDER BY created_at'
    ).all(projectId);

    const idsToDelete = allMessages.slice(0, toCompact.length).map((m: any) => m.id);
    if (idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      db.prepare(`DELETE FROM chat_messages WHERE id IN (${placeholders})`).run(...idsToDelete);
    }

    // Insert summary as first message
    const summaryId = generateId();
    db.prepare(
      `INSERT INTO chat_messages (id, project_id, role, content, metadata, created_at)
       VALUES (?, ?, 'system', ?, '{"type":"compaction_summary"}', datetime('now', '-1 hour'))`
    ).run(summaryId, projectId, `[Riassunto conversazione precedente]\n${summaryResult.content}`);

    return [
      { role: 'system', content: `[Riassunto conversazione precedente]\n${summaryResult.content}` },
      ...toKeep,
    ];
  } catch {
    // If summarization fails, just truncate
    return toKeep;
  }
}

function extractJsonObject(content: string): any | null {
  const raw = content.trim();
  const candidates = [raw];
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function getConnectorsContext(): string {
  try {
    const { getAllConfiguredInstances, getAllDefinitions } = require('../connectors/connectors.service');
    const configured: any[] = getAllConfiguredInstances();
    const definitions: any[] = getAllDefinitions();
    const lines: string[] = [];
    if (configured.length > 0) {
      lines.push(`\nConnettori configurati (${configured.length}):`);
      configured.forEach(c => {
        const def = definitions.find((d: any) => d.id === c.connector_id);
        const actions = def?.actions?.slice(0, 5).map((a: any) => a.id).join(', ') || '';
        lines.push(`- ${c.name} [id="${c.id}", tipo="${c.connector_id}", stato=${c.status}]${actions ? ' azioni: ' + actions : ''}`);
      });
    }
    if (definitions.length > 0) {
      lines.push(`\nTipi connettori disponibili: ${definitions.map((d: any) => d.id).join(', ')}`);
    }
    return lines.join('\n');
  } catch { return ''; }
}

function makeProjectContext(project: any, nodes: any[], agents: any[]) {
  const connectorsCtx = getConnectorsContext();
  return `Progetto corrente:
- id: ${project?.id || ''}
- nome: ${project?.name || 'senza nome'}
- descrizione: ${project?.description || ''}
- stato: ${project?.status || 'bozza'}

Nodi esistenti (${nodes.length}):
${nodes.map((node) => `- ${node.label} | tipo=${node.type} | stato=${node.state}`).join('\n') || '- nessuno'}

Agenti esistenti (${agents.length}):
${agents.map((agent) => {
  const metadata = parseAgentMetadata(agent);
  const capabilities = Array.isArray(metadata.capabilities) ? metadata.capabilities.join(', ') : '';
  return `- id=${agent.id} | nome=${agent.name} | ruolo=${agent.role || 'nessuno'} | provider=${agent.provider_id} | model=${agent.model_id} | summary=${metadata.summary || ''} | capabilities=${capabilities}`;
}).join('\n') || '- nessuno'}${connectorsCtx}`;
}

function makePlannerSystemPrompt(defaultProviderId: string, defaultModelId: string) {
  return `Sei il motore operativo della chat di Agent OS.
Non devi spiegare come compilare i campi quando l'utente chiede di creare o configurare un workflow: devi progettare il workflow completo e pronto nel progetto corrente.

Restituisci SEMPRE e SOLO JSON valido, senza testo extra, con questa forma:
{
  "mode": "chat" | "build_project",
  "assistant_response": "risposta finale in italiano per l'utente",
  "project": {
    "name": "nome progetto",
    "description": "descrizione progetto",
    "status": "bozza | pronto | in_esecuzione | completato"
  },
  "graph": {
    "replace": true,
    "nodes": [
      {
        "key": "identificatore_univoco",
        "type": "sorgente | analisi | decisione | esecuzione | memoria | automazione",
        "label": "nome nodo",
        "description": "cosa deve fare il nodo",
        "state": "pronto",
        "color": "#hex opzionale",
        "config": {},
        "position_x": 0,
        "position_y": 0,
        "width": 240,
        "height": 90,
        "provider_id": "openai | anthropic | gemini | ollama | deepseek | openrouter | groq",
        "model_id": "modello specifico più adatto al compito del nodo",
        "agent_id": "id agente esistente opzionale",
        "agent_name": "nome agente esistente opzionale",
        "system_prompt": "prompt opzionale del nodo"
      }
    ],
    "edges": [
      {
        "source_key": "chiave_nodo_sorgente",
        "target_key": "chiave_nodo_target",
        "label": "",
        "condition": ""
      }
    ]
  }
}

Regole:
- Se l'utente sta chiedendo consigli, spiegazioni o debug senza voler modificare il progetto, usa "mode": "chat".
- Se l'utente chiede di creare, impostare, configurare, costruire, generare o completare un progetto/workflow/nodi/automazioni, usa "mode": "build_project".
- In "build_project" devi generare un workflow completo, coerente e pronto all'uso: niente istruzioni del tipo "compila questo campo".
- Usa al massimo 8 nodi.
- Prima di inventare comportamento nuovo, controlla gli agenti già disponibili nel sistema e riusa quelli adeguati.
- Se un agente esistente è adatto al nodo, imposta agent_id oppure agent_name e usa il system_prompt del nodo solo per adattare il comportamento a quel caso.
- Crea comportamento ex novo nel nodo solo quando gli agenti esistenti non bastano.
- Assegna provider e model per ogni nodo in base al compito, non copiare automaticamente il modello della chat su tutti i nodi.
- Preferenze operative: analisi immagini/foto/video/OCR -> gemini, ragionamento/valutazione/decisione -> anthropic o openai se Anthropic e solo CLI, generazione codice/html/script/web -> anthropic/claude, salvo motivi migliori nel contesto.
- Gli agenti possono usare tools: web_search, read_file, write_file, shell_exec, http_request, memory_search, memory_save, connector_action. Assegnali nel campo tools dell'agente se il nodo ne ha bisogno.
- I nodi "esecuzione" possono eseguire azioni sui connettori (Telegram, Slack, Gmail, webhook, GitHub, Google Drive, ecc.) tramite config: {"connector_id": "id_connettore", "connector_action": "azione", "connector_params": {}}. Usa gli ID connettore dalla lista "Connettori configurati" nel contesto.
- IMPORTANTE: quando l'utente chiede di inviare messaggi, email, notifiche o interagire con servizi esterni, usa SEMPRE i connettori configurati disponibili nel contesto — non inventare metodi alternativi.
- I nodi "memoria" ora salvano dati nella memoria persistente e possono cercare memorie passate.
- I nodi "automazione" eseguono comandi shell. I comandi pericolosi (rm -rf, sudo, ecc.) richiedono approvazione.
- Provider aggiuntivi disponibili: deepseek, openrouter, groq, together, mistral, lmstudio (se configurati).
- Il sistema ha skills installate che arricchiscono il contesto degli agenti automaticamente.
- Se non hai un motivo chiaro usa come fallback provider "${defaultProviderId}" e model "${defaultModelId}".
- I nodi "sorgente" devono contenere nel config "content" se servono input iniziali testuali.
- I nodi "automazione" devono contenere nel config "command" solo se l'utente ha chiesto davvero un comando shell/script.
- I nodi "memoria" non devono avere provider o model.
- I collegamenti devono essere coerenti e riferirsi a key presenti nei nodi.
- assistant_response deve essere breve e concreta, spiegando cosa hai creato o aggiornato.`;
}

function sanitizePlannerKey(value: string | undefined, fallback: string) {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_');
}

function parseAgentMetadata(agent: any) {
  try {
    return typeof agent?.metadata === 'string' ? JSON.parse(agent.metadata) : (agent?.metadata || {});
  } catch {
    return {};
  }
}

function resolvePlannerAgent(node: PlannerNode, agents: any[]) {
  const explicitId = String(node.agent_id || '').trim();
  if (explicitId) {
    const byId = agents.find((agent) => agent.id === explicitId);
    if (byId) return byId;
  }

  const explicitName = String(node.agent_name || '').trim().toLowerCase();
  if (explicitName) {
    const byName = agents.find((agent) => String(agent.name || '').trim().toLowerCase() === explicitName);
    if (byName) return byName;
  }

  const text = `${node.label || ''} ${node.description || ''} ${node.system_prompt || ''}`.toLowerCase();
  if (!text) return null;

  let bestAgent: any = null;
  let bestScore = 0;
  for (const agent of agents) {
    const metadata = parseAgentMetadata(agent);
    const haystack = [
      agent.name,
      agent.role,
      metadata.summary,
      ...(Array.isArray(metadata.capabilities) ? metadata.capabilities : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack) continue;

    let score = 0;
    if (text.includes(String(agent.name || '').toLowerCase())) score += 8;
    if (/foto|immagin|image|vision|ocr/.test(text) && /foto|immagin|image|vision|ocr/.test(haystack)) score += 4;
    if (/animaz|video|html|locandin|poster|banner/.test(text) && /animaz|video|html|locandin|poster|banner/.test(haystack)) score += 4;
    if (/scrap|crawl|contenut|content/.test(text) && /scrap|crawl|contenut|content/.test(haystack)) score += 4;
    if (/web|site|landing|page|builder/.test(text) && /web|site|landing|page|builder/.test(haystack)) score += 4;

    const keywords = Array.from(new Set(text.match(/[a-zà-ù]{5,}/gi) || [])).slice(0, 12);
    for (const keyword of keywords) {
      if (haystack.includes(keyword.toLowerCase())) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestScore >= 8 ? bestAgent : null;
}

function normalizeWorkflowPlan(plan: WorkflowPlan | null, providerId: string, modelId: string, availableAgents: any[]) {
  if (!plan || (plan.mode !== 'build_project' && plan.mode !== 'build_app')) return null;

  const plannerNodes = Array.isArray(plan.graph?.nodes) ? plan.graph?.nodes || [] : [];
  if (plannerNodes.length === 0) return null;

  const keyMap = new Map<string, string>();
  const fallbackSelection = getFallbackModelSelection({ providerId, modelId });
  const nodes = plannerNodes.map((node, index) => {
    const requestedKey = sanitizePlannerKey(node.key, `node_${index + 1}`);
    let key = requestedKey || `node_${index + 1}`;
    while (keyMap.has(key)) key = `${key}_${index + 1}`;

    const type = VALID_NODE_TYPES.has(node.type || '') ? String(node.type) : 'esecuzione';
    const id = generateId();
    keyMap.set(key, id);

    const shouldUseAIProvider = type !== 'sorgente' && type !== 'automazione' && type !== 'memoria';
    const assignedAgent = resolvePlannerAgent(node, availableAgents);
    const modelSelection = shouldUseAIProvider
      ? selectBestModelForTask(node, {
          fallback: fallbackSelection,
          allowOverrideExplicit: true,
        })
      : null;
    const nodeConfig = typeof node.config === 'object' && node.config !== null ? node.config : {};
    const phase = typeof nodeConfig.phase === 'number' ? nodeConfig.phase : -1;

    // Phase-based layout for project builds, grid layout for workflows
    let posX: number, posY: number;
    if (phase >= 0) {
      // Count nodes in same phase (before this one)
      const samePhaseIndex = plannerNodes.slice(0, index).filter(n => {
        const c = typeof n.config === 'object' && n.config !== null ? n.config : {};
        return (c as any).phase === phase;
      }).length;
      posX = phase * 450;
      posY = samePhaseIndex * 200;
    } else {
      const column = index % 3;
      const row = Math.floor(index / 3);
      posX = column * 420;
      posY = row * 280;
    }

    return {
      id,
      type,
      label: String(node.label || `Nodo ${index + 1}`).trim(),
      description: String(node.description || node.label || '').trim(),
      state: 'pronto',
      color: String(node.color || NODE_COLORS[type] || ''),
      config: nodeConfig,
      position_x: Number.isFinite(node.position_x) ? Number(node.position_x) : posX,
      position_y: Number.isFinite(node.position_y) ? Number(node.position_y) : posY,
      width: Number.isFinite(node.width) ? Number(node.width) : 240,
      height: Number.isFinite(node.height) ? Number(node.height) : 90,
      agent_id: assignedAgent?.id || null,
      provider_id: assignedAgent?.provider_id || modelSelection?.providerId || '',
      model_id: assignedAgent?.model_id || modelSelection?.modelId || '',
      system_prompt: String(node.system_prompt || '').trim(),
      key,
    };
  });

  const plannerEdges = Array.isArray(plan.graph?.edges) ? plan.graph?.edges || [] : [];
  const edges = plannerEdges
    .map((edge) => {
      const sourceId = edge.source_key ? keyMap.get(sanitizePlannerKey(edge.source_key, '')) : undefined;
      const targetId = edge.target_key ? keyMap.get(sanitizePlannerKey(edge.target_key, '')) : undefined;
      if (!sourceId || !targetId || sourceId === targetId) return null;
      return {
        id: generateId(),
        source_id: sourceId,
        target_id: targetId,
        label: String(edge.label || '').trim(),
        condition: String(edge.condition || '').trim(),
      };
    })
    .filter(Boolean) as Array<{ id: string; source_id: string; target_id: string; label: string; condition: string }>;

  return {
    project: {
      name: plan.project?.name?.trim(),
      description: plan.project?.description?.trim(),
      status: VALID_PROJECT_STATUS.has(plan.project?.status || '') ? plan.project?.status : 'pronto',
    },
    graph: {
      replace: plan.graph?.replace !== false,
      nodes,
      edges,
    },
    assistantResponse: (plan.assistant_response || '').trim(),
  };
}

function summarizeAppliedWorkflow(projectName: string, nodeCount: number, edgeCount: number) {
  return `Ho configurato il progetto "${projectName}" con ${nodeCount} nodi e ${edgeCount} collegamenti. La mappa ora contiene il workflow completo e puoi rifinirlo o eseguirlo subito.`;
}

function isBuildIntent(message: string) {
  return /crea|costruisc|imposta|configura|genera|completa|fammi|prepara|sviluppa|progetto|workflow|nodi|mappa|pipeline|automaz/i.test(message.toLowerCase());
}

function isProjectBuildIntent(message: string) {
  const lower = message.toLowerCase();
  // Must have a "build software" intent, not just a workflow/automation
  const buildKeywords = /build.*app|create.*application|develop.*software|make.*web.*app|costruiscimi.*app|crea.*applicazione|sviluppa.*software|realizza.*app|crea.*sistema|build.*project|create.*project|genera.*progetto.*software|crea.*cms|crea.*saas|crea.*piattaforma|build.*platform|crea.*sito|crea.*portale|costruisci.*software/i;
  const projectTypeKeywords = /app|application|software|cms|saas|piattaforma|platform|sito|portale|webapp|web.*app|api|backend|frontend|dashboard|gestionale|ecommerce|e-commerce|booking|pms/i;
  return buildKeywords.test(lower) || (isBuildIntent(message) && projectTypeKeywords.test(lower));
}

function makeAppBuilderPrompt(defaultProviderId: string, defaultModelId: string) {
  const { config } = require('../../config');
  const appsDir = config.appsDir;
  return `Sei l'App Builder di Agent OS. Il tuo compito è creare APPLICAZIONI REALI E FUNZIONANTI con interfaccia grafica.

NON crei mappe concettuali, workflow o diagrammi. Crei APP VERE con codice sorgente che l'utente apre nel browser e usa.

Ogni app che crei DEVE:
1. Avere una UI grafica HTML/CSS/JS funzionante
2. Essere navigabile e interattiva
3. Includere integrazione AI tramite Agent OS (ai-client.js)
4. Vivere in ${appsDir}/{nome_app}/
5. Funzionare sia dentro Agent OS che standalone nel browser

Restituisci SEMPRE e SOLO JSON valido:
{
  "mode": "build_app",
  "assistant_response": "Sto costruendo [nome app] con [tech stack]. L'app avra [funzionalita]...",
  "project": { "name": "nome-app", "description": "descrizione", "status": "pronto" },
  "graph": {
    "replace": true,
    "nodes": [...],
    "edges": [...]
  }
}

STRUTTURA NODI — Ogni nodo scrive FILE CONCRETI (max 3 file per nodo):

GRUPPO 1 - SETUP (1 nodo tipo "automazione"):
- key: "setup"
- Usa tool init_project per creare la cartella in ${appsDir}/{nome}/
- config: { "phase": 0, "tools": ["init_project", "write_file"] }
- system_prompt: "Crea il progetto con init_project al path ${appsDir}/{nome}/ di tipo react. Poi crea i file di configurazione: vite.config.js, tailwind.config.js (se serve), .env"

GRUPPO 2 - BACKEND/DATI (2-4 nodi tipo "esecuzione"):
- Ogni nodo crea 1-3 file specifici con write_file
- config: { "phase": 1, "tools": ["write_file", "read_file"] }
- Esempio system_prompt: "Crea il file ${appsDir}/{nome}/server/db.js con lo schema SQLite per le tabelle: bookings (id, guest, room, checkin, checkout, status, created_at), rooms (id, name, type, price). Usa better-sqlite3. Esporta le funzioni CRUD. Poi crea server/index.js con Express su porta 3001 con le routes REST per bookings e rooms."

GRUPPO 3 - PAGINE UI (3-6 nodi tipo "esecuzione"):
- OGNI nodo crea 1-2 componenti/pagine
- config: { "phase": 2, "tools": ["write_file"] }
- I system_prompt devono descrivere ESATTAMENTE il layout HTML, i componenti, gli stili
- Esempio: "Crea ${appsDir}/{nome}/src/pages/Dashboard.jsx — pagina dashboard con: header con titolo e logo, griglia di card statistiche (prenotazioni oggi, occupazione, revenue), tabella prenotazioni recenti con status colorati, bottone 'Nuova Prenotazione'. Usa Tailwind per lo stile. I dati vengono da fetch('/api/bookings')."
- IMPORTANTE: Scrivi CODICE COMPLETO, non placeholder. Ogni componente deve essere funzionante.

GRUPPO 4 - AI INTEGRATION (1 nodo tipo "esecuzione"):
- Crea src/lib/ai-client.js (client per usare AI di Agent OS)
- Crea componenti AI: es. ChatWidget, AIAssistant, GenerateButton
- config: { "phase": 3, "tools": ["write_file"] }
- system_prompt: "Crea ${appsDir}/{nome}/src/lib/ai-client.js che connette a http://localhost:43101/api/v1/ai/assist per usare i modelli AI. Esporta: chat(prompt), generateText(prompt), analyzeData(data, question). Poi crea un componente ChatWidget.jsx con input testo, bottone invia, area messaggi."

GRUPPO 5 - INSTALL & AVVIO (1 nodo tipo "automazione"):
- config: { "phase": 4, "tools": ["install_deps", "run_dev_server", "git_init"] }
- system_prompt: "Installa le dipendenze con install_deps al path ${appsDir}/{nome}/. Poi avvia il dev server con run_dev_server. Infine inizializza git con git_init."

REGOLE CRITICHE:
- Genera da 8 a 20 nodi (non di piu, non di meno)
- Ogni nodo DEVE avere "tools" nel config con i tool specifici che usa
- Ogni system_prompt deve contenere i PATH COMPLETI dei file da creare (${appsDir}/{nome}/...)
- NON usare path generici — specifica sempre il path assoluto
- Il codice nei file deve essere COMPLETO e FUNZIONANTE, non placeholder
- Gli edge collegano i nodi in sequenza: setup → backend → ui → ai → install
- Dentro lo stesso gruppo, i nodi possono essere paralleli

SELF-CORRECTION — REGOLA FONDAMENTALE:
Ogni nodo di tipo "esecuzione" che crea file UI/HTML DEVE includere nel system_prompt:
"Dopo aver creato i file, usa read_file per rileggere il codice creato. Verifica che:
1. Non ci siano errori di sintassi
2. Gli import siano corretti
3. I componenti siano completi (non placeholder)
4. Le API calls puntino agli endpoint giusti
Se trovi errori, usa write_file per correggerli immediatamente."

TECH STACK CONSIGLIATI:
- App semplice: HTML + CSS + vanilla JS (no build step, si avvia con npx serve)
- App media: React + Vite + Tailwind (npm run dev)
- App con dati: React + Express + better-sqlite3
- App complessa: Next.js + Prisma + Tailwind

Se non specificato, usa: React + Vite + Tailwind (il piu bilanciato).

MODELLI AI:
- Codice backend/API → anthropic o openai
- Codice frontend/UI → anthropic o openai
- Setup/Install → nodo automazione (non serve AI)
Se fallback: provider "${defaultProviderId}", model "${defaultModelId}"

Tools: write_file, read_file, shell_exec, init_project, install_deps, run_dev_server, stop_dev_server, run_tests, git_init, list_project_files, http_request, web_search, memory_save`;
}

function buildPlannerCandidates(selectedProviderId: string, selectedModelId: string): PlannerCandidate[] {
  const candidates: PlannerCandidate[] = [];
  const push = (providerId: string, modelId: string) => {
    if (!providerId || !modelId) return;
    if (!candidates.some((candidate) => candidate.providerId === providerId && candidate.modelId === modelId)) {
      candidates.push({ providerId, modelId });
    }
  };

  push(selectedProviderId, selectedModelId);

  // Claude CLI tends to answer as an external coding assistant and often breaks the structured JSON contract.
  if (selectedProviderId === 'anthropic' && (selectedModelId === 'claude-cli' || getAnthropicMode() === 'claude_cli')) {
    push('openai', 'gpt-4o');
    push('gemini', 'gemini-2.5-flash');
  } else {
    push('openai', 'gpt-4o');
    push('gemini', 'gemini-2.5-flash');
  }

  return candidates;
}

async function tryBuildWorkflowPlan(
  planningMessages: { role: string; content: string }[],
  defaultProviderId: string,
  defaultModelId: string,
  availableAgents: any[],
  maxTokens: number = 4096,
) {
  const candidates = buildPlannerCandidates(defaultProviderId, defaultModelId);
  let lastUsage: any = undefined;
  let lastError: string | null = null;

  for (const candidate of candidates) {
    try {
      const planned = await providerRegistry.chat(
        candidate.providerId,
        planningMessages,
        candidate.modelId,
        { temperature: 0.2, max_tokens: maxTokens },
      );
      lastUsage = planned.usage;
      const parsedPlan = extractJsonObject(planned.content) as WorkflowPlan | null;
      const normalizedPlan = normalizeWorkflowPlan(parsedPlan, defaultProviderId, defaultModelId, availableAgents);
      if (normalizedPlan) {
        return { normalizedPlan, usage: lastUsage, planner: candidate };
      }
      lastError = `Planner ${candidate.providerId}/${candidate.modelId} non ha restituito JSON valido`;
    } catch (err: any) {
      lastError = `${candidate.providerId}/${candidate.modelId}: ${err.message}`;
    }
  }

  return { normalizedPlan: null, usage: lastUsage, planner: null, error: lastError };
}

async function fallbackToPlainChat(
  projectId: string,
  providerId: string,
  modelId: string,
  history: { role: string; content: string }[],
  project: any,
  nodes: any[],
  agents: any[],
) {
  const soulPrompt = getSoulPrompt();
  const systemContext = `${soulPrompt ? `[Personalità]\n${soulPrompt}\n\n` : ''}Sei un assistente AI integrato nella piattaforma Agent OS. Stai lavorando sul progetto "${project?.name || 'senza nome'}".
Il progetto ha ${nodes.length} nodi e ${agents.length} agenti configurati.
Nodi: ${nodes.map(n => `${n.label} (${n.type}, stato: ${n.state})`).join(', ') || 'nessuno'}.
Agenti: ${agents.map(a => `${a.name} (${a.role || 'nessun ruolo'})`).join(', ') || 'nessuno'}.
Rispondi in italiano. Aiuta l'utente a gestire il progetto, i nodi, gli agenti e le automazioni.`;

  const response = await providerRegistry.chat(providerId, [{ role: 'system', content: systemContext }, ...history], modelId);
  return saveChatMessage(projectId, 'assistant', response.content, { usage: response.usage });
}

export async function sendChatMessage(projectId: string, userMessage: string, providerId: string = 'openai', modelId: string = 'gpt-4o') {
  saveChatMessage(projectId, 'user', userMessage);

  let history: any[] = db.prepare(
    'SELECT role, content FROM chat_messages WHERE project_id = ? ORDER BY created_at'
  ).all(projectId);

  // Context compaction: summarize old messages if history is too long
  history = await compactChatHistory(projectId, history, providerId, modelId);

  const project: any = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const nodes: any[] = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
  const agents: any[] = getAgentsByProject(projectId);
  const buildIntent = isBuildIntent(userMessage);

  // Inject SOUL personality and memory context
  const soulPrompt = getSoulPrompt();
  const memoryContext = buildMemoryContext(projectId, userMessage, 5);

  try {
    // Choose planner mode: App Builder (real apps) vs Project Architect vs standard workflow
    const isAppBuild = isProjectBuildIntent(userMessage);
    const plannerSystemPrompt = isAppBuild
      ? makeAppBuilderPrompt(providerId, modelId)
      : makePlannerSystemPrompt(providerId, modelId);
    const maxTokens = isAppBuild ? 16384 : 4096;

    const enrichedPlannerPrompt = [
      soulPrompt ? `[Personalità]\n${soulPrompt}\n` : '',
      plannerSystemPrompt,
      memoryContext,
    ].filter(Boolean).join('\n\n');

    const planningMessages = [
      { role: 'system', content: enrichedPlannerPrompt },
      { role: 'user', content: `${makeProjectContext(project, nodes, agents)}\n\nGenera l'output JSON per la conversazione seguente.` },
      ...history,
    ];
    const planningResult = await tryBuildWorkflowPlan(planningMessages, providerId, modelId, agents, maxTokens);
    const normalizedPlan = planningResult.normalizedPlan;

    if (!normalizedPlan) {
      if (buildIntent) {
        return saveChatMessage(
          projectId,
          'assistant',
          `Non sono riuscito a ottenere un blueprint strutturato dal modello selezionato, quindi non posso creare automaticamente progetto e nodi in modo affidabile. Seleziona OpenAI o Gemini per la costruzione del workflow, oppure configura Anthropic API invece di Claude CLI.`,
          {
            error: true,
            planner_error: planningResult.error || 'planner_non_strutturato',
          },
        );
      }
      return await fallbackToPlainChat(projectId, providerId, modelId, history, project, nodes, agents);
    }

    const projectPatch: Record<string, string> = {};
    if (normalizedPlan.project.name) projectPatch.name = normalizedPlan.project.name;
    if (normalizedPlan.project.description) projectPatch.description = normalizedPlan.project.description;
    if (normalizedPlan.project.status) projectPatch.status = normalizedPlan.project.status;
    if (Object.keys(projectPatch).length > 0) updateProject(projectId, projectPatch);

    const graphNodes = normalizedPlan.graph.nodes.map(({ key: _key, ...node }) => node);
    saveGraph(projectId, {
      nodes: graphNodes,
      edges: normalizedPlan.graph.edges,
    });

    const finalProjectName = normalizedPlan.project.name || project?.name || 'senza nome';
    const assistantContent = normalizedPlan.assistantResponse || summarizeAppliedWorkflow(
      finalProjectName,
      normalizedPlan.graph.nodes.length,
      normalizedPlan.graph.edges.length,
    );

    return saveChatMessage(projectId, 'assistant', assistantContent, {
      usage: planningResult.usage,
      actions: {
        type: 'graph_replaced',
        project_updated: Object.keys(projectPatch).length > 0,
        node_count: normalizedPlan.graph.nodes.length,
        edge_count: normalizedPlan.graph.edges.length,
        planner_provider: planningResult.planner?.providerId || providerId,
        planner_model: planningResult.planner?.modelId || modelId,
      },
    });
  } catch (err: any) {
    const errorMsg = saveChatMessage(projectId, 'assistant', `Errore: ${err.message}`, { error: true });
    return errorMsg;
  }
}
