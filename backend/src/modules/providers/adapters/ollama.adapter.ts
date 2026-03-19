import { ProviderAdapter, ChatOptions } from '../providers.types';
import { config } from '../../../config';

export class OllamaAdapter implements ProviderAdapter {
  id = 'ollama';
  name = 'Ollama (Locale)';
  type = 'local' as const;

  private get baseUrl() { return config.ollamaBaseUrl; }

  async chat(messages: { role: string; content: string }[], model: string, options?: ChatOptions) {
    const ollamaOptions: any = { temperature: options?.temperature ?? 0.7, num_predict: options?.max_tokens };
    if (options?.top_p !== undefined) ollamaOptions.top_p = options.top_p;
    if (options?.frequency_penalty !== undefined) ollamaOptions.frequency_penalty = options.frequency_penalty;
    if (options?.presence_penalty !== undefined) ollamaOptions.presence_penalty = options.presence_penalty;
    if (options?.stop_sequences?.length) ollamaOptions.stop = options.stop_sequences;

    const body: any = {
      model: model || 'llama3',
      messages,
      stream: false,
      options: ollamaOptions,
    };
    if (options?.response_format === 'json_object') body.format = 'json';

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    return {
      content: data.message?.content || '',
      usage: { prompt_tokens: data.prompt_eval_count || 0, completion_tokens: data.eval_count || 0 },
    };
  }

  async listModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data: any = await res.json();
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
