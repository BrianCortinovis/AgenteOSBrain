import { Router } from 'express';
import { assistField } from './ai.service';
import { providerRegistry } from '../providers/provider-registry';
import { getEnabledTools } from '../tools/tools.service';
import { getSkillContext, getAllSkills, installSkill } from '../skills/skills.service';
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/assist', async (req, res) => {
  try {
    const result = await assistField(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FLOW: Save imported file to ~/Documents/AgentOS_Imported/ ──
router.post('/flow/import', async (req, res) => {
  try {
    const { file_name, file_content } = req.body;
    if (!file_name || !file_content) return res.status(400).json({ error: 'file_name e file_content richiesti' });

    const importDir = path.join(process.env.HOME || '/tmp', 'Documents', 'AgentOS_Imported');
    if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });

    // Organize by date subfolder
    const now = new Date();
    const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayDir = path.join(importDir, dateFolder);
    if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true });

    // Save file
    const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(dayDir, safeName);
    fs.writeFileSync(filePath, file_content, 'utf-8');

    // Save to memory for indexing
    const { saveMemory } = await import('../memory/memory.service');
    saveMemory({
      project_id: '__imported__',
      content: `File importato: ${file_name} (${file_content.length} chars) salvato in ${filePath}`,
      tags: ['imported', 'file', path.extname(file_name).replace('.', '')],
      source: 'flow_import',
    });

    res.json({ path: filePath, indexed: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FLOW: List imported files ──────────────────────────────────
router.get('/flow/imports', (_req, res) => {
  try {
    const importDir = path.join(process.env.HOME || '/tmp', 'Documents', 'AgentOS_Imported');
    if (!fs.existsSync(importDir)) return res.json([]);

    const files: any[] = [];
    const dateFolders = fs.readdirSync(importDir).filter(d => fs.statSync(path.join(importDir, d)).isDirectory()).sort().reverse();
    for (const df of dateFolders) {
      const dayPath = path.join(importDir, df);
      const dayFiles = fs.readdirSync(dayPath).filter(f => !f.startsWith('.'));
      for (const f of dayFiles) {
        const stat = fs.statSync(path.join(dayPath, f));
        files.push({ name: f, date: df, size: stat.size, path: path.join(dayPath, f) });
      }
    }
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUTO-EVOLUZIONE: FLOW impara e si auto-completa ────────────
async function autoEvolve(userMessage: string, aiResponse: string, providerId: string, modelId: string) {
  // Se la risposta contiene indizi che manca una capacità, crea skill/agente
  const lower = aiResponse.toLowerCase();
  const needsNew = lower.includes('non ho uno strumento') ||
    lower.includes('non posso') ||
    lower.includes('non ho la capacità') ||
    lower.includes('non sono in grado');

  if (!needsNew) return;

  // Chiedi all'AI di generare una skill per colmare il gap
  try {
    const response = await providerRegistry.chat(
      providerId,
      [
        {
          role: 'system',
          content: `L'utente ha chiesto qualcosa che il sistema non sa fare bene. Genera una SKILL per colmare il gap.
Rispondi SOLO con JSON valido:
{
  "type": "skill",
  "name": "nome-skill-kebab-case",
  "description": "cosa fa la skill",
  "category": "categoria",
  "content": "istruzioni dettagliate per la skill"
}`
        },
        { role: 'user', content: `Richiesta utente: ${userMessage}\nRisposta sistema: ${aiResponse.slice(0, 500)}\n\nGenera una skill per gestire meglio questa richiesta in futuro.` }
      ],
      modelId,
      { temperature: 0.3, max_tokens: 1000 }
    );

    const match = response.content.match(/\{[\s\S]*\}/);
    if (!match) return;
    const data = JSON.parse(match[0]);

    if (data.type === 'skill' && data.name && data.content) {
      const { installSkill } = await import('../skills/skills.service');
      installSkill({
        name: data.name,
        description: data.description || '',
        category: data.category || 'auto-generated',
        content: data.content,
      });
      console.log(`[FLOW Auto-Evolve] Nuova skill creata: ${data.name}`);
    }
  } catch (err: any) {
    console.log(`[FLOW Auto-Evolve] Errore: ${err.message}`);
  }
}

// ─── FLOW: Intent detection helpers ────────────────────────────
function detectFlowIntent(message: string): 'work' | 'app' | 'skill' | 'general' {
  const m = (message || '').toLowerCase();

  // Skill creation/management
  if (/\b(crea|aggiungi|installa|definisci|registra)\b.*\b(skill|abilità|competenza|capacità)\b/.test(m)) return 'skill';
  if (/\b(skill|abilità)\b.*\b(per|che|che sa|in grado di)\b/.test(m)) return 'skill';

  // App creation
  const buildVerb = /\b(crea|costruisci|fai|genera|sviluppa|realizza|build|costruire|creare)\b/;
  const appNoun = /\b(app|applicazione|applicazioni|webapp|sito|portale|dashboard|cms|saas|piattaforma|gestionale|ecommerce|sistema web|software)\b/;
  if (buildVerb.test(m) && appNoun.test(m)) return 'app';

  // Workflow/work/agent/automation — anything requiring a structured project
  const workNoun = /\b(work|workflow|flusso|pipeline|automazione|automatizza|processo|progetto|mappa|grafo|agente|agenti|bot|scraper|monitor|analisi automatica|sistema|task|compito|routine)\b/;
  if (buildVerb.test(m) && workNoun.test(m)) return 'work';
  if (/\b(fai|crea|avvia|costruisci)\s+(un|una|il|la|un')?\s*(nuovo|nuova)?\s*(work|workflow|flusso|agente|bot|automazione)\b/.test(m)) return 'work';
  if (/\b(ogni giorno|periodicamente|in automatico|ogni ora|ogni settimana|monitora|controlla|aggiorna automaticamente|invia automaticamente)\b/.test(m)) return 'work';

  return 'general';
}

// ─── Build a full system snapshot for FLOW context ──────────────
function buildFlowSystemContext(db: any): string {
  const lines: string[] = [];

  // Projects
  try {
    const projs: any[] = db.prepare('SELECT name, status, description FROM projects ORDER BY updated_at DESC LIMIT 8').all();
    if (projs.length > 0) {
      lines.push('PROGETTI RECENTI:');
      projs.forEach(p => lines.push(`  - ${p.name} [${p.status}]${p.description ? ': ' + p.description.slice(0, 60) : ''}`));
    }
  } catch {}

  // Skills
  try {
    const skills = getAllSkills();
    if (skills.length > 0) {
      lines.push(`\nSKILL (${skills.length}):`);
      skills.slice(0, 15).forEach(s => lines.push(`  - ${s.name} [${s.category}]: ${s.description || ''}`));
    }
  } catch {}

  // Agents
  try {
    const agents: any[] = db.prepare('SELECT name, role, provider_id, model_id FROM agents ORDER BY name LIMIT 15').all();
    if (agents.length > 0) {
      lines.push(`\nAGENTI (${agents.length}):`);
      agents.forEach(a => lines.push(`  - ${a.name} (${a.role || 'generico'}) → ${a.provider_id}/${a.model_id}`));
    }
  } catch {}

  // Apps
  try {
    const { listApps } = require('../apps/apps.service');
    const apps = listApps();
    if (apps.length > 0) {
      lines.push('\nAPP:');
      apps.forEach((a: any) => lines.push(`  - ${a.name} ${a.running ? '(LIVE :' + a.port + ')' : '(ferma)'}`));
    }
  } catch {}

  // Connectors — FONDAMENTALI: Telegram, Gmail, Slack, webhook, ecc.
  try {
    const { getAllConfiguredInstances, getAllDefinitions } = require('../connectors/connectors.service');
    const configured: any[] = getAllConfiguredInstances();
    const definitions: any[] = getAllDefinitions();
    if (configured.length > 0) {
      lines.push('\nCONNETTORI CONFIGURATI:');
      configured.forEach(c => {
        const def = definitions.find((d: any) => d.id === c.connector_id);
        lines.push(`  - ${c.name} [${c.connector_id}] stato=${c.status} (ID: ${c.id})`);
        if (def?.actions?.length > 0) {
          lines.push(`    azioni: ${def.actions.slice(0, 5).map((a: any) => a.id).join(', ')}`);
        }
      });
    }
    // Also list available connector types
    if (definitions.length > 0) {
      lines.push(`\nTIPO CONNETTORI DISPONIBILI: ${definitions.map((d: any) => d.id).join(', ')}`);
    }
  } catch {}

  return lines.join('\n');
}

// ─── FLOW: Cervello unico del sistema operativo IA ─────────────
// FLOW È il superbrain: usa lo STESSO engine di Work e Builder,
// più tutti i 25 tools, memoria, skills, file index
router.post('/flow', async (req, res) => {
  try {
    const { message, file_content, file_name, provider_id, model_id, history } = req.body;
    if (!message && !file_content) return res.status(400).json({ error: 'message o file_content richiesto' });

    const providerId = provider_id || 'openai';
    const modelId = model_id || 'gpt-4o';
    const actions: any[] = [];

    // ── 0. FILE: salva e leggi DIRETTAMENTE (no tools loop) ────
    let fileContext = '';
    let savedFilePath = '';
    if (file_content && file_name) {
      const { importFile, readFileForAI } = await import('../flow/flow-fs.service');
      savedFilePath = importFile(file_name, file_content);
      const content = await readFileForAI(savedFilePath);
      if (content) {
        fileContext = `\n\n=== CONTENUTO FILE "${file_name}" ===\n${content.slice(0, 25000)}\n=== FINE FILE ===`;
      }
      const ext = path.extname(file_name).toLowerCase();
      if (['.pdf', '.html', '.jpg', '.png'].includes(ext)) {
        actions.push({ type: 'open_window', component: 'file-viewer', title: file_name, props: { filePath: savedFilePath, fileName: file_name } });
      }
    }

    // ── 1. INTENT DETECTION — FLOW usa lo stesso engine di Work/Builder ──
    const db = (await import('../../database/connection')).default;
    const intent = fileContext ? 'general' : detectFlowIntent(message || '');

    // ── SKILL CREATION ──────────────────────────────────────────
    if (intent === 'skill') {
      const skillResponse = await providerRegistry.chat(providerId, [
        { role: 'system', content: `Sei il gestore delle skill di FLOW OS. L'utente vuole creare una nuova skill.
Genera SOLO JSON valido:
{
  "name": "nome-kebab-case",
  "description": "breve descrizione",
  "category": "categoria (es: automazione, analisi, ricerca, comunicazione, sviluppo)",
  "content": "istruzioni dettagliate su come la skill funziona, cosa fa, quando usarla, esempi d'uso"
}` },
        { role: 'user', content: message || '' },
      ], modelId, { temperature: 0.3, max_tokens: 2000 });

      try {
        const match = skillResponse.content.match(/\{[\s\S]*\}/);
        if (match) {
          const data = JSON.parse(match[0]);
          if (data.name && data.content) {
            installSkill({ name: data.name, description: data.description || '', category: data.category || 'generale', content: data.content });
            return res.json({
              content: `Skill "${data.name}" creata e installata nel sistema. È disponibile per tutti gli agenti, FLOW e le sessioni di chat.`,
              actions: [{ type: 'show_result', content: `✅ Skill "${data.name}" (${data.category}) installata` }],
              tool_calls: 0,
            });
          }
        }
      } catch {}
      return res.json({ content: 'Errore nella creazione della skill. Riprova con una descrizione più dettagliata.', actions: [], tool_calls: 0 });
    }

    if (intent === 'work' || intent === 'app') {
      const { createProject } = await import('../projects/projects.service');
      const { sendChatMessage } = await import('../chat/chat.service');

      // Nome progetto dal messaggio (prime 50 lettere pulite)
      const projectName = (message || 'Nuovo progetto').replace(/[^\w\s\-àèéìòùÀÈÉÌÒÙ]/g, '').trim().slice(0, 50);
      const project: any = createProject({ name: projectName, description: message });

      // Chiama l'engine planner (lo STESSO di Work e Builder)
      const chatResult: any = await sendChatMessage(project.id, message, providerId, modelId);
      const responseText: string = chatResult?.content || `Progetto "${projectName}" creato e pianificato.`;

      // Apri la finestra work-graph con il progetto già costruito
      actions.push({
        type: 'open_window',
        component: 'work-graph',
        title: `WORK: ${projectName}`,
        props: { projectId: project.id },
      });

      // Se è un'app → esegui il progetto in background
      if (intent === 'app') {
        const { executeProject } = await import('../../orchestrator/engine');
        actions.push({ type: 'show_result', content: `⚙️ Build avviata per "${projectName}"...` });
        executeProject(project.id, (log: any) => {
          console.log(`[FLOW Build] ${log.label}: ${log.status}`);
        }, () => {}).then(() => {
          console.log(`[FLOW Build] Completato: ${projectName}`);
        }).catch((err: any) => {
          console.log(`[FLOW Build] Errore: ${err.message}`);
        });
      }

      return res.json({
        content: responseText,
        actions,
        project_id: project.id,
        tool_calls: 0,
      });
    }

    // ── 2. RACCOLTA CONTESTO SISTEMA ────────────────────────────
    const systemSnapshot = buildFlowSystemContext(db);
    const skillContext = getSkillContext(message || '', 5);

    let memoryContext = '';
    try {
      const { buildMemoryContext } = await import('../memory/memory.service');
      memoryContext = buildMemoryContext('__flow__', message || '', 5);
    } catch {}

    let recentFiles = '';
    try {
      const { getRecentFiles } = await import('../flow/flow-fs.service');
      const recent = getRecentFiles(8);
      if (recent.length > 0) {
        recentFiles = '\nFILE RECENTI:\n' + recent.map((f: any) => `- ${f.name} (${f.category})`).join('\n');
      }
    } catch {}

    // ── 3. SYSTEM PROMPT ────────────────────────────────────────
    const systemPrompt = `Sei FLOW — il cervello del sistema operativo AI. Sei IL SISTEMA, non un chatbot.
Hai accesso a TUTTO: agenti, skill, progetti, file, tools, memoria, app, web.

TOOLS DISPONIBILI:
- web_search, http_request, screenshot_url: web e internet
- read_file, write_file, parse_document: file locali
- shell_exec: comandi di sistema
- translate_text, generate_image, analyze_image, generate_code
- memory_search, memory_save: memoria persistente

STATO SISTEMA:
${systemSnapshot}${recentFiles}
${memoryContext ? '\nMEMORIA RILEVANTE:\n' + memoryContext : ''}
${skillContext ? '\nSKILL ATTIVE:\n' + skillContext : ''}

RISPONDI SEMPRE in JSON:
{"text": "risposta operativa in italiano", "actions": [...]}

AZIONI:
- {"type":"open_window","component":"builder|work|work-graph|app-gallery|app-preview|agenti|files|file-viewer|processes|settings|browser","title":"...","props":{}}
- {"type":"show_result","content":"testo"}
- {"type":"start_app","params":{"name":"..."}}
- {"type":"stop_app","params":{"name":"..."}}

REGOLE:
- RICERCA WEB → web_search. Mai "vai su Google".
- SITI/API → http_request.
- FILE ALLEGATO → contenuto già nel contesto. Lavora su quello.
- CREARE WORK/APP/SKILL → IL SISTEMA LO FA GIÀ. Non servono azioni extra.
- QUALSIASI ALTRA COSA → usa i tools. Non dire mai "non posso".
Rispondi in italiano. Sii diretto e operativo.`;

    const userContent = `${message || 'Analizza il file.'}${fileContext}`;

    // ── 4. CHIAMA AI CON TOOLS ──────────────────────────────────
    let result: { content: string; toolCalls: { name: string; result: string }[] };

    if (fileContext) {
      // File già letto → 1 sola chiamata AI diretta
      const msgs: any[] = [{ role: 'system', content: systemPrompt }];
      if (Array.isArray(history)) {
        msgs.push(...history.slice(-8).map((h: any) => ({ role: h.role, content: h.content })));
      }
      msgs.push({ role: 'user', content: userContent });
      const response = await providerRegistry.chat(providerId, msgs, modelId, { temperature: 0.4, max_tokens: 4096 });
      result = { content: response.content, toolCalls: [] };
    } else {
      // Richiesta generale → callAIWithTools con tutti i 25 tools
      const { callAIWithTools } = await import('../tools/tools.service');
      const tools = getEnabledTools();
      let contextualSystem = systemPrompt;
      if (Array.isArray(history) && history.length > 0) {
        const histStr = history.slice(-8).map((h: any) => `${h.role === 'user' ? 'Utente' : 'FLOW'}: ${h.content}`).join('\n');
        contextualSystem += `\n\nCRONOLOGIA RECENTE:\n${histStr}`;
      }
      result = await callAIWithTools(providerId, modelId, contextualSystem, userContent, tools, { projectId: '__flow__' });
    }

    // ── 5. PARSE + AZIONI ────────────────────────────────────────
    let parsed: any = null;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {}

    const allActions = [...actions, ...(parsed?.actions || [])];
    if (result.toolCalls?.length) {
      for (const tc of result.toolCalls) {
        allActions.push({ type: 'show_result', content: `⚙️ ${tc.name}` });
      }
    }

    try { await autoEvolve(message || '', result.content, providerId, modelId); } catch {}

    res.json({
      content: parsed?.text || result.content,
      actions: allActions,
      tool_calls: result.toolCalls?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
