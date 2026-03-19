import { ProviderAdapter, ChatOptions } from '../providers.types';

/**
 * Universal OpenAI-compatible adapter.
 * Works with any provider that exposes an OpenAI-compatible API:
 * DeepSeek, OpenRouter, LM Studio, vLLM, Together AI, Groq, Mistral, etc.
 *
 * Inspired by OpenClaw's provider/model format where any OpenAI-compatible
 * endpoint can be used with custom base URLs and API keys.
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private modelPrefix: string;

  constructor(config: {
    id: string;
    name: string;
    type?: 'cloud' | 'local';
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    modelPrefix?: string;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type || 'cloud';
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel;
    this.modelPrefix = config.modelPrefix || '';
  }

  async chat(
    messages: { role: string; content: string }[],
    model: string,
    options?: ChatOptions,
  ) {
    const actualModel = model || this.defaultModel;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // OpenRouter needs extra headers
    if (this.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://agenteos.app';
      headers['X-Title'] = 'Agent OS Brain';
    }

    const body: any = {
      model: actualModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens,
      stream: false,
    };
    if (options?.top_p !== undefined) body.top_p = options.top_p;
    if (options?.frequency_penalty !== undefined) body.frequency_penalty = options.frequency_penalty;
    if (options?.presence_penalty !== undefined) body.presence_penalty = options.presence_penalty;
    if (options?.stop_sequences?.length) body.stop = options.stop_sequences;
    if (options?.response_format === 'json_object') body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${this.name} error: ${res.status} ${errorText}`);
    }

    const data: any = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
      },
    };
  }

  async listModels() {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/models`, { headers });
      if (!res.ok) throw new Error(`${res.status}`);

      const data: any = await res.json();
      const models = (data.data || data.models || [])
        .map((m: any) => ({
          id: m.id || m.name,
          name: m.id || m.name,
        }))
        .slice(0, 50);

      return models.length > 0
        ? models
        : [{ id: this.defaultModel, name: this.defaultModel }];
    } catch {
      return [{ id: this.defaultModel, name: this.defaultModel }];
    }
  }

  async testConnection() {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/models`, { headers });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ─── Pre-built provider configs ─────────────────────────────────

export const KNOWN_PROVIDERS: Record<string, {
  name: string;
  baseUrl: string;
  defaultModel: string;
  type: 'cloud' | 'local';
  envKey: string;
}> = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    type: 'cloud',
    envKey: 'DEEPSEEK_API_KEY',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    type: 'cloud',
    envKey: 'OPENROUTER_API_KEY',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    type: 'cloud',
    envKey: 'GROQ_API_KEY',
  },
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    type: 'cloud',
    envKey: 'TOGETHER_API_KEY',
  },
  mistral: {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    type: 'cloud',
    envKey: 'MISTRAL_API_KEY',
  },
  lmstudio: {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    type: 'local',
    envKey: '',
  },
  'custom-openai': {
    name: 'Custom OpenAI-Compatible',
    baseUrl: 'http://localhost:8000/v1',
    defaultModel: 'default',
    type: 'local',
    envKey: '',
  },
};
