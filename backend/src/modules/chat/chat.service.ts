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
  mode?: 'chat' | 'build_project';
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

function makeProjectContext(project: any, nodes: any[], agents: any[]) {
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
}).join('\n') || '- nessuno'}`;
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
- I nodi "esecuzione" possono eseguire azioni sui connettori (Telegram, Slack, Gmail, webhook) tramite config: {"connector_id": "telegram", "connector_action": "send_message", "connector_params": {}}.
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
  if (!plan || plan.mode !== 'build_project') return null;

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
    const column = index % 3;
    const row = Math.floor(index / 3);

    return {
      id,
      type,
      label: String(node.label || `Nodo ${index + 1}`).trim(),
      description: String(node.description || node.label || '').trim(),
      state: 'pronto',
      color: String(node.color || NODE_COLORS[type] || ''),
      config: typeof node.config === 'object' && node.config !== null ? node.config : {},
      position_x: Number.isFinite(node.position_x) ? Number(node.position_x) : column * 420,
      position_y: Number.isFinite(node.position_y) ? Number(node.position_y) : row * 280,
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
        { temperature: 0.2, max_tokens: 4096 },
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
    const plannerSystemPrompt = makePlannerSystemPrompt(providerId, modelId);
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
    const planningResult = await tryBuildWorkflowPlan(planningMessages, providerId, modelId, agents);
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
