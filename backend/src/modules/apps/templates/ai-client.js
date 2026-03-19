/**
 * Agent OS AI Client
 * Questo modulo permette alla tua app di usare qualsiasi modello AI
 * configurato in Agent OS (OpenAI, Claude, Gemini, Ollama, etc.)
 *
 * Uso:
 *   import { chat, generateText, analyzeData } from './lib/ai-client.js';
 *   const risposta = await chat('Descrivi questo prodotto', { provider: 'openai' });
 */

const AGENT_OS_URL = typeof window !== 'undefined'
  ? (window.__AGENT_OS_URL__ || 'http://localhost:43101')
  : 'http://localhost:43101';

export async function chat(prompt, options = {}) {
  const { provider = 'openai', model, systemPrompt = '', temperature = 0.7 } = options;
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${AGENT_OS_URL}/api/v1/ai/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      system_prompt: systemPrompt,
      provider_id: provider,
      model_id: model,
      temperature
    }),
  });
  if (!res.ok) throw new Error(`AI Error: ${res.status}`);
  const data = await res.json();
  return data.result || data.content || data;
}

export async function generateText(prompt, options = {}) {
  return chat(prompt, options);
}

export async function analyzeData(data, question, options = {}) {
  const prompt = `Analizza questi dati:\n${JSON.stringify(data, null, 2)}\n\nDomanda: ${question}`;
  return chat(prompt, { ...options, systemPrompt: 'Sei un analista dati. Rispondi in modo chiaro e strutturato.' });
}

export async function summarize(text, options = {}) {
  return chat(text, { ...options, systemPrompt: 'Riassumi il testo in modo conciso mantenendo i punti chiave.' });
}

export async function translate(text, targetLang, options = {}) {
  return chat(text, { ...options, systemPrompt: `Traduci in ${targetLang}. Rispondi SOLO con la traduzione.` });
}

export async function extractJSON(text, schema, options = {}) {
  const prompt = `Estrai dati strutturati da questo testo:\n${text}\n\nSchema richiesto: ${schema}\nRispondi SOLO con JSON valido.`;
  const result = await chat(prompt, { ...options, temperature: 0.1 });
  try { return JSON.parse(result); } catch { return result; }
}

export default { chat, generateText, analyzeData, summarize, translate, extractJSON };
