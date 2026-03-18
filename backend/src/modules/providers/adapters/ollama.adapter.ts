import { ProviderAdapter } from '../providers.types';
import { config } from '../../../config';

export class OllamaAdapter implements ProviderAdapter {
  id = 'ollama';
  name = 'Ollama (Locale)';
  type = 'local' as const;

  private get baseUrl() { return config.ollamaBaseUrl; }

  async chat(messages: { role: string; content: string }[], model: string, options?: { temperature?: number; max_tokens?: number }) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        messages,
        stream: false,
        options: { temperature: options?.temperature ?? 0.7, num_predict: options?.max_tokens },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.message?.content || '',
      usage: { prompt_tokens: data.prompt_eval_count || 0, completion_tokens: data.eval_count || 0 },
    };
  }

  async listModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({ id: m.name, name: m.name }));
    } catch { return []; }
  }

  async testConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch { return false; }
  }
}
