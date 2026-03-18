import db from '../../database/connection';
import { ToolDefinition, ToolContext } from './tools.types';
import { executeTool } from './tool-executors';
import { providerRegistry } from '../providers/provider-registry';

// ─── Tool Definitions from DB ───────────────────────────────────

export function getEnabledTools(): ToolDefinition[] {
  const rows: any[] = db.prepare(
    'SELECT name, description, parameters_schema FROM tool_definitions WHERE enabled = 1'
  ).all();
  return rows.map(r => ({
    name: r.name,
    description: r.description,
    parameters: safeParseJSON(r.parameters_schema),
  }));
}

export function getToolsByNames(names: string[]): ToolDefinition[] {
  if (names.length === 0) return [];
  const all = getEnabledTools();
  return all.filter(t => names.includes(t.name));
}

// ─── Function Calling Formats ───────────────────────────────────

/** Convert our tool definitions to OpenAI function calling format */
export function toOpenAIFunctions(tools: ToolDefinition[]): any[] {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Convert our tool definitions to Anthropic tool use format */
export function toAnthropicTools(tools: ToolDefinition[]): any[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/** Convert our tool definitions to Gemini function declarations format */
export function toGeminiFunctionDeclarations(tools: ToolDefinition[]): any[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

// ─── Tool Use Loop ──────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

/**
 * Call AI with tool support. Handles the tool-use loop:
 * 1. Send messages + tools to AI
 * 2. If AI requests tool calls, execute them
 * 3. Feed results back and repeat
 * 4. Return final text response
 */
export async function callAIWithTools(
  providerId: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  tools: ToolDefinition[],
  context: ToolContext,
): Promise<{ content: string; toolCalls: { name: string; result: string }[] }> {
  const toolCalls: { name: string; result: string }[] = [];

  // If no tools or provider doesn't support function calling, fallback to plain call
  if (tools.length === 0) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    const result = await providerRegistry.chat(providerId, messages, modelId);
    return { content: result.content, toolCalls: [] };
  }

  // Build tool-aware prompt that instructs the model to use JSON tool calls
  const toolDescriptions = tools.map(t =>
    `- ${t.name}: ${t.description}\n  Parametri: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  const toolSystemAddendum = `\n\nHai accesso ai seguenti strumenti (tools):
${toolDescriptions}

Per usare uno strumento, rispondi con un blocco JSON così:
\`\`\`tool_call
{"tool": "nome_tool", "params": {parametri}}
\`\`\`

Puoi usare più strumenti in sequenza. Dopo aver ricevuto i risultati, fornisci la risposta finale.
Se non hai bisogno di strumenti, rispondi direttamente.`;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt + toolSystemAddendum });
  else messages.push({ role: 'system', content: toolSystemAddendum.trim() });
  messages.push({ role: 'user', content: userPrompt });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await providerRegistry.chat(providerId, messages, modelId);
    const content = result.content;

    // Check for tool_call blocks
    const toolCallMatch = content.match(/```tool_call\s*\n?([\s\S]*?)```/);
    if (!toolCallMatch) {
      // No tool call - this is the final response
      return { content, toolCalls };
    }

    // Parse and execute the tool call
    try {
      const callData = JSON.parse(toolCallMatch[1].trim());
      const toolName = callData.tool || callData.name;
      const toolParams = callData.params || callData.parameters || {};

      console.log(`[Tools] Esecuzione tool: ${toolName}`, toolParams);
      const toolResult = await executeTool(toolName, toolParams, context);

      toolCalls.push({
        name: toolName,
        result: toolResult.success ? toolResult.output : `Errore: ${toolResult.error}`,
      });

      // Add the AI response and tool result to messages for next round
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: `Risultato dello strumento "${toolName}":\n${toolResult.success ? toolResult.output : `Errore: ${toolResult.error}`}`,
      });
    } catch (parseErr: any) {
      // Failed to parse tool call, treat as final response
      const cleanContent = content.replace(/```tool_call[\s\S]*?```/g, '').trim();
      return { content: cleanContent || content, toolCalls };
    }
  }

  // Max rounds reached, get final response
  messages.push({ role: 'user', content: 'Fornisci la tua risposta finale basata sui risultati ottenuti.' });
  const finalResult = await providerRegistry.chat(providerId, messages, modelId);
  return { content: finalResult.content, toolCalls };
}

// ─── Helpers ────────────────────────────────────────────────────

function safeParseJSON(raw: string): Record<string, any> {
  try { return JSON.parse(raw); } catch { return {}; }
}
