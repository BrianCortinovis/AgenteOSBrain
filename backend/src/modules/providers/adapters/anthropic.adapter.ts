import { ProviderAdapter } from '../providers.types';
import { config } from '../../../config';
import { callClaudeCLI, chatClaudeCLI, checkClaudeCLI } from './claude-bridge';

export type AnthropicMode = 'api_key' | 'claude_cli';

let currentMode: AnthropicMode = 'api_key';

export function setAnthropicMode(mode: AnthropicMode) {
  currentMode = mode;
}

export function getAnthropicMode(): AnthropicMode {
  return currentMode;
}

export class AnthropicAdapter implements ProviderAdapter {
  id = 'anthropic';
  name = 'Anthropic';
  type = 'cloud' as const;

  private get apiKey() { return config.anthropicApiKey; }
  private baseUrl = 'https://api.anthropic.com/v1';

  get mode(): AnthropicMode { return currentMode; }

  async chat(messages: { role: string; content: string }[], model: string, options?: { temperature?: number; max_tokens?: number }) {
    if (currentMode === 'claude_cli') {
      return this.chatViaCLI(messages);
    }
    return this.chatViaAPI(messages, model, options);
  }

  private async chatViaCLI(messages: { role: string; content: string }[]) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    const content = await chatClaudeCLI(systemMsg?.content || '', chatMessages);
    return {
      content,
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
  }

  private async chatViaAPI(messages: { role: string; content: string }[], model: string, options?: { temperature?: number; max_tokens?: number }) {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: options?.max_tokens || 4096,
        temperature: options?.temperature ?? 0.7,
        system: systemMsg?.content || '',
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || '',
      usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 },
    };
  }

  async listModels() {
    const apiModels = [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ];

    if (currentMode === 'claude_cli') {
      return [
        { id: 'claude-cli', name: 'Claude Code (Account)' },
        ...apiModels,
      ];
    }
    return apiModels;
  }

  async testConnection() {
    if (currentMode === 'claude_cli') {
      const status = await checkClaudeCLI();
      return status.found;
    }

    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      return res.ok;
    } catch { return false; }
  }
}
