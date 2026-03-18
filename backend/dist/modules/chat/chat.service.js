"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatHistory = getChatHistory;
exports.saveChatMessage = saveChatMessage;
exports.clearChatHistory = clearChatHistory;
exports.sendChatMessage = sendChatMessage;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
const provider_registry_1 = require("../providers/provider-registry");
const graph_service_1 = require("../graph/graph.service");
const projects_service_1 = require("../projects/projects.service");
const VALID_NODE_TYPES = new Set(['sorgente', 'analisi', 'decisione', 'esecuzione', 'memoria', 'automazione']);
const VALID_PROJECT_STATUS = new Set(['bozza', 'pronto', 'in_esecuzione', 'completato']);
const NODE_COLORS = {
    sorgente: '#3b82f6',
    analisi: '#8b5cf6',
    decisione: '#f59e0b',
    esecuzione: '#10b981',
    memoria: '#6366f1',
    automazione: '#ec4899',
};
function getChatHistory(projectId) {
    return connection_1.default.prepare('SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at').all(projectId);
}
function saveChatMessage(projectId, role, content, metadata = {}) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO chat_messages (id, project_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)').run(id, projectId, role, content, JSON.stringify(metadata));
    return connection_1.default.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
}
function clearChatHistory(projectId) {
    connection_1.default.prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId);
}
function extractJsonObject(content) {
    const raw = content.trim();
    const candidates = [raw];
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
    if (fenced?.[1])
        candidates.push(fenced[1].trim());
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(raw.slice(firstBrace, lastBrace + 1));
    }
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        }
        catch { }
    }
    return null;
}
function makeProjectContext(project, nodes, agents) {
    return `Progetto corrente:
- id: ${project?.id || ''}
- nome: ${project?.name || 'senza nome'}
- descrizione: ${project?.description || ''}
- stato: ${project?.status || 'bozza'}

Nodi esistenti (${nodes.length}):
${nodes.map((node) => `- ${node.label} | tipo=${node.type} | stato=${node.state}`).join('\n') || '- nessuno'}

Agenti esistenti (${agents.length}):
${agents.map((agent) => `- ${agent.name} | ruolo=${agent.role || 'nessuno'} | provider=${agent.provider_id} | model=${agent.model_id}`).join('\n') || '- nessuno'}`;
}
function makePlannerSystemPrompt(defaultProviderId, defaultModelId) {
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
        "provider_id": "${defaultProviderId}",
        "model_id": "${defaultModelId}",
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
- Per i nodi AI usa di default provider "${defaultProviderId}" e model "${defaultModelId}" salvo motivi chiari.
- I nodi "sorgente" devono contenere nel config "content" se servono input iniziali testuali.
- I nodi "automazione" devono contenere nel config "command" solo se l'utente ha chiesto davvero un comando shell/script.
- I collegamenti devono essere coerenti e riferirsi a key presenti nei nodi.
- assistant_response deve essere breve e concreta, spiegando cosa hai creato o aggiornato.`;
}
function normalizeWorkflowPlan(plan, providerId, modelId) {
    if (!plan || plan.mode !== 'build_project')
        return null;
    const plannerNodes = Array.isArray(plan.graph?.nodes) ? plan.graph?.nodes || [] : [];
    if (plannerNodes.length === 0)
        return null;
    const keyMap = new Map();
    const nodes = plannerNodes.map((node, index) => {
        const requestedKey = String(node.key || `node_${index + 1}`)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_:-]+/g, '_');
        let key = requestedKey || `node_${index + 1}`;
        while (keyMap.has(key))
            key = `${key}_${index + 1}`;
        const type = VALID_NODE_TYPES.has(node.type || '') ? String(node.type) : 'esecuzione';
        const id = (0, id_1.generateId)();
        keyMap.set(key, id);
        const shouldUseAIProvider = type !== 'sorgente' && type !== 'automazione';
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
            position_x: Number.isFinite(node.position_x) ? Number(node.position_x) : column * 320,
            position_y: Number.isFinite(node.position_y) ? Number(node.position_y) : row * 180,
            width: Number.isFinite(node.width) ? Number(node.width) : 240,
            height: Number.isFinite(node.height) ? Number(node.height) : 90,
            agent_id: null,
            provider_id: shouldUseAIProvider ? String(node.provider_id || providerId || '') : '',
            model_id: shouldUseAIProvider ? String(node.model_id || modelId || '') : '',
            system_prompt: String(node.system_prompt || '').trim(),
            key,
        };
    });
    const plannerEdges = Array.isArray(plan.graph?.edges) ? plan.graph?.edges || [] : [];
    const edges = plannerEdges
        .map((edge) => {
        const sourceId = edge.source_key ? keyMap.get(edge.source_key) : undefined;
        const targetId = edge.target_key ? keyMap.get(edge.target_key) : undefined;
        if (!sourceId || !targetId || sourceId === targetId)
            return null;
        return {
            id: (0, id_1.generateId)(),
            source_id: sourceId,
            target_id: targetId,
            label: String(edge.label || '').trim(),
            condition: String(edge.condition || '').trim(),
        };
    })
        .filter(Boolean);
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
function summarizeAppliedWorkflow(projectName, nodeCount, edgeCount) {
    return `Ho configurato il progetto "${projectName}" con ${nodeCount} nodi e ${edgeCount} collegamenti. La mappa ora contiene il workflow completo e puoi rifinirlo o eseguirlo subito.`;
}
async function fallbackToPlainChat(projectId, providerId, modelId, history, project, nodes, agents) {
    const systemContext = `Sei un assistente AI integrato nella piattaforma Agent OS. Stai lavorando sul progetto "${project?.name || 'senza nome'}".
Il progetto ha ${nodes.length} nodi e ${agents.length} agenti configurati.
Nodi: ${nodes.map(n => `${n.label} (${n.type}, stato: ${n.state})`).join(', ') || 'nessuno'}.
Agenti: ${agents.map(a => `${a.name} (${a.role || 'nessun ruolo'})`).join(', ') || 'nessuno'}.
Rispondi in italiano. Aiuta l'utente a gestire il progetto, i nodi, gli agenti e le automazioni.`;
    const response = await provider_registry_1.providerRegistry.chat(providerId, [{ role: 'system', content: systemContext }, ...history], modelId);
    return saveChatMessage(projectId, 'assistant', response.content, { usage: response.usage });
}
async function sendChatMessage(projectId, userMessage, providerId = 'openai', modelId = 'gpt-4o') {
    saveChatMessage(projectId, 'user', userMessage);
    const history = connection_1.default.prepare('SELECT role, content FROM chat_messages WHERE project_id = ? ORDER BY created_at').all(projectId);
    const project = connection_1.default.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const nodes = connection_1.default.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
    const agents = connection_1.default.prepare('SELECT * FROM agents WHERE project_id = ?').all(projectId);
    try {
        const planningMessages = [
            { role: 'system', content: makePlannerSystemPrompt(providerId, modelId) },
            { role: 'user', content: `${makeProjectContext(project, nodes, agents)}\n\nGenera l'output JSON per la conversazione seguente.` },
            ...history,
        ];
        const planned = await provider_registry_1.providerRegistry.chat(providerId, planningMessages, modelId, { temperature: 0.2, max_tokens: 4096 });
        const parsedPlan = extractJsonObject(planned.content);
        const normalizedPlan = normalizeWorkflowPlan(parsedPlan, providerId, modelId);
        if (!normalizedPlan) {
            return await fallbackToPlainChat(projectId, providerId, modelId, history, project, nodes, agents);
        }
        const projectPatch = {};
        if (normalizedPlan.project.name)
            projectPatch.name = normalizedPlan.project.name;
        if (normalizedPlan.project.description)
            projectPatch.description = normalizedPlan.project.description;
        if (normalizedPlan.project.status)
            projectPatch.status = normalizedPlan.project.status;
        if (Object.keys(projectPatch).length > 0)
            (0, projects_service_1.updateProject)(projectId, projectPatch);
        const graphNodes = normalizedPlan.graph.nodes.map(({ key: _key, ...node }) => node);
        (0, graph_service_1.saveGraph)(projectId, {
            nodes: graphNodes,
            edges: normalizedPlan.graph.edges,
        });
        const finalProjectName = normalizedPlan.project.name || project?.name || 'senza nome';
        const assistantContent = normalizedPlan.assistantResponse || summarizeAppliedWorkflow(finalProjectName, normalizedPlan.graph.nodes.length, normalizedPlan.graph.edges.length);
        return saveChatMessage(projectId, 'assistant', assistantContent, {
            usage: planned.usage,
            actions: {
                type: 'graph_replaced',
                project_updated: Object.keys(projectPatch).length > 0,
                node_count: normalizedPlan.graph.nodes.length,
                edge_count: normalizedPlan.graph.edges.length,
            },
        });
    }
    catch (err) {
        const errorMsg = saveChatMessage(projectId, 'assistant', `Errore: ${err.message}`, { error: true });
        return errorMsg;
    }
}
