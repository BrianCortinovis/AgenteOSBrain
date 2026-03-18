import db from '../../database/connection';
import { providerRegistry } from '../providers/provider-registry';
import { getSoulPrompt } from '../workspace/workspace.service';
import { buildMemoryContext } from '../memory/memory.service';
import { getSkillContext } from '../skills/skills.service';

/**
 * Multi-agent hierarchical orchestration.
 *
 * Inspired by OpenClaw's orchestrator pattern:
 * - A main orchestrator agent spawns sub-agents for parallel tasks
 * - Sub-agents can be assigned different models/providers
 * - Results are aggregated back to the orchestrator
 */

interface AgentTask {
  agentId: string;
  task: string;
  context?: string;
}

interface AgentResult {
  agentId: string;
  agentName: string;
  output: string;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Execute multiple agents in parallel on different tasks.
 * Returns aggregated results.
 */
export async function executeAgentsParallel(
  projectId: string,
  tasks: AgentTask[],
): Promise<AgentResult[]> {
  const agents: any[] = db.prepare(
    `SELECT * FROM agents WHERE project_id = ? OR scope = 'global'`
  ).all(projectId);

  const soulPrompt = getSoulPrompt();

  const promises = tasks.map(async (task) => {
    const agent = agents.find(a => a.id === task.agentId);
    if (!agent) {
      return {
        agentId: task.agentId,
        agentName: 'Sconosciuto',
        output: '',
        duration: 0,
        success: false,
        error: `Agente ${task.agentId} non trovato`,
      };
    }

    const start = Date.now();
    try {
      const systemPrompt = [
        soulPrompt ? `[Personalità]\n${soulPrompt}` : '',
        agent.system_prompt || '',
      ].filter(Boolean).join('\n\n');

      // Inject memory and skills context
      const memoryCtx = agent.memory_enabled
        ? buildMemoryContext(projectId, task.task, 3)
        : '';
      const skillCtx = getSkillContext(task.task, 2);

      const userPrompt = [
        task.task,
        memoryCtx,
        skillCtx,
        task.context ? `\nContesto:\n${task.context}` : '',
      ].filter(Boolean).join('\n\n');

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await providerRegistry.chat(
        agent.provider_id,
        messages,
        agent.model_id,
      );

      return {
        agentId: agent.id,
        agentName: agent.name,
        output: result.content,
        duration: Date.now() - start,
        success: true,
      };
    } catch (err: any) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        output: '',
        duration: Date.now() - start,
        success: false,
        error: err.message,
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Orchestrator pattern: A main agent delegates sub-tasks to specialized agents,
 * then synthesizes the results.
 */
export async function orchestrate(
  projectId: string,
  orchestratorAgentId: string,
  mainTask: string,
  subAgentIds: string[],
): Promise<{ orchestratorOutput: string; subResults: AgentResult[]; duration: number }> {
  const start = Date.now();
  const agents: any[] = db.prepare(
    `SELECT * FROM agents WHERE project_id = ? OR scope = 'global'`
  ).all(projectId);

  const orchestratorAgent = agents.find(a => a.id === orchestratorAgentId);
  if (!orchestratorAgent) throw new Error(`Agente orchestratore ${orchestratorAgentId} non trovato`);

  const soulPrompt = getSoulPrompt();

  // Step 1: Ask the orchestrator to decompose the task
  const subAgentDescriptions = subAgentIds
    .map(id => agents.find(a => a.id === id))
    .filter(Boolean)
    .map(a => `- ${a.name} (${a.role || 'generico'}): ${a.system_prompt?.slice(0, 100) || 'nessuna descrizione'}`)
    .join('\n');

  const decompositionPrompt = `Sei un orchestratore. Hai a disposizione questi agenti specializzati:
${subAgentDescriptions}

Compito principale: ${mainTask}

Decomponilo in sotto-compiti, uno per agente. Rispondi in JSON:
[{"agent_name": "nome", "task": "descrizione del sotto-compito"}]`;

  const decompResult = await providerRegistry.chat(
    orchestratorAgent.provider_id,
    [
      { role: 'system', content: `${soulPrompt ? `[Personalità]\n${soulPrompt}\n\n` : ''}${orchestratorAgent.system_prompt || 'Sei un orchestratore di agenti IA.'}` },
      { role: 'user', content: decompositionPrompt },
    ],
    orchestratorAgent.model_id,
  );

  // Parse sub-tasks
  let subTasks: { agent_name: string; task: string }[] = [];
  try {
    const jsonMatch = decompResult.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) subTasks = JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: assign main task to all sub-agents
    subTasks = subAgentIds.map(id => {
      const agent = agents.find(a => a.id === id);
      return { agent_name: agent?.name || '', task: mainTask };
    });
  }

  // Step 2: Execute sub-agents in parallel
  const agentTasks: AgentTask[] = subTasks.map(st => {
    const agent = agents.find(a =>
      a.name.toLowerCase() === st.agent_name.toLowerCase() ||
      a.name.toLowerCase().includes(st.agent_name.toLowerCase())
    );
    return {
      agentId: agent?.id || subAgentIds[0],
      task: st.task,
    };
  });

  const subResults = await executeAgentsParallel(projectId, agentTasks);

  // Step 3: Synthesize results
  const resultsText = subResults.map(r =>
    `[${r.agentName}] ${r.success ? r.output.slice(0, 1000) : `ERRORE: ${r.error}`}`
  ).join('\n\n---\n\n');

  const synthesisResult = await providerRegistry.chat(
    orchestratorAgent.provider_id,
    [
      { role: 'system', content: `${soulPrompt ? `[Personalità]\n${soulPrompt}\n\n` : ''}${orchestratorAgent.system_prompt || ''}` },
      { role: 'user', content: `Compito: ${mainTask}\n\nRisultati degli agenti:\n${resultsText}\n\nSintetizza i risultati in una risposta coerente e completa.` },
    ],
    orchestratorAgent.model_id,
  );

  return {
    orchestratorOutput: synthesisResult.content,
    subResults,
    duration: Date.now() - start,
  };
}
