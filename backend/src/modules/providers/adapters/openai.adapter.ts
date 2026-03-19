import { ProviderAdapter, ChatOptions } from '../providers.types';
import { config } from '../../../config';

export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai';
  name = 'OpenAI';
  type = 'cloud' as const;

  private get apiKey() { return config.openaiApiKey; }
  private baseUrl = 'https://api.openai.com/v1';

  async chat(messages: { role: string; content: string }[], model: string, options?: ChatOptions) {
    const body: any = {
      model: model || 'gpt-4o',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens,
    };
    if (options?.top_p !== undefined) body.top_p = options.top_p;
    if (options?.frequency_penalty !== undefined) body.frequency_penalty = options.frequency_penalty;
    if (options?.presence_penalty !== undefined) body.presence_penalty = options.presence_penalty;
    if (options?.stop_sequences?.length) body.stop = options.stop_sequences;
    if (options?.response_format === 'json_object') body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: { prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 },
    };
  }

  async listModels() {
    if (!this.apiKey) return [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ];
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      const data: any = await res.json();
      return (data.data || [])
        .filter((m: any) => m.id.startsWith('gpt'))
        .map((m: any) => ({ id: m.id, name: m.id }))
        .slice(0, 20);
    } catch {
      return [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      ];
    }
  }

  async testConnection() {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch { return false; }
  }
}
