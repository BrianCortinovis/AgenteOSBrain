import { ProviderAdapter } from '../providers.types';
import { config } from '../../../config';
import fs from 'fs';
import path from 'path';

export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini';
  name = 'Google Gemini';
  type = 'cloud' as const;

  private get apiKey() { return config.geminiApiKey; }
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async chat(messages: { role: string; content: string }[], model: string, options?: { temperature?: number; max_tokens?: number }) {
    const modelId = model || 'gemini-2.5-flash';
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: any = {
      contents,
      generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.max_tokens || 65536 },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const res = await fetch(
      `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      content: text,
      usage: { prompt_tokens: data.usageMetadata?.promptTokenCount || 0, completion_tokens: data.usageMetadata?.candidatesTokenCount || 0 },
    };
  }

  /**
   * Analyze images with Gemini Vision.
   * Sends images as base64 inline_data along with a text prompt.
   * Returns the AI's analysis text.
   */
  async analyzeImages(
    imagePaths: string[],
    prompt: string,
    systemPrompt?: string,
    model?: string,
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const modelId = model || 'gemini-2.5-flash';

    // Build parts: text prompt + images
    const parts: any[] = [{ text: prompt }];

    for (const imgPath of imagePaths) {
      if (!fs.existsSync(imgPath)) continue;

      const ext = path.extname(imgPath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';

      // Read and base64 encode
      const data = fs.readFileSync(imgPath);
      // Skip files larger than 20MB
      if (data.length > 20 * 1024 * 1024) continue;

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: data.toString('base64'),
        },
      });
    }

    const body: any = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.max_tokens || 8192,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(
      `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(`Gemini Vision error: ${res.status} ${await res.text()}`);
    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Analyze a single image and return structured detection results.
   */
  async detectInImage(imagePath: string, query: string, model?: string): Promise<{
    found: boolean;
    confidence: string;
    description: string;
    objects: string[];
  }> {
    const systemPrompt = `Sei un sistema di visione artificiale. Analizza l'immagine e rispondi in formato JSON con questi campi:
- found: true/false se l'oggetto/soggetto cercato è presente
- confidence: "alta", "media", "bassa"
- description: breve descrizione di cosa vedi nell'immagine
- objects: lista di oggetti/soggetti principali riconosciuti nell'immagine

Rispondi SOLO con il JSON, niente altro testo.`;

    const prompt = `Cerca nell'immagine: "${query}". L'immagine contiene ciò che cerco?`;
    const result = await this.analyzeImages([imagePath], prompt, systemPrompt, model);

    try {
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    return { found: false, confidence: 'bassa', description: result.slice(0, 200), objects: [] };
  }

  async listModels() {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ];
  }

  async testConnection() {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      return res.ok;
    } catch { return false; }
  }
}
