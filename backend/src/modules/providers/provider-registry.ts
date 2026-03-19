import { ProviderAdapter, ChatOptions } from './providers.types';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OllamaAdapter } from './adapters/ollama.adapter';
import { OpenAICompatibleAdapter, KNOWN_PROVIDERS } from './adapters/openai-compatible.adapter';
import db from '../../database/connection';

class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  constructor() {
    this.register(new OpenAIAdapter());
    this.register(new AnthropicAdapter());
    this.register(new GeminiAdapter());
    this.register(new OllamaAdapter());
  }

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(id: string) {
    this.adapters.delete(id);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * OpenClaw-style unified chat: supports "provider/model" format.
   * E.g., "openai/gpt-4o", "deepseek/deepseek-chat", "openrouter/anthropic/claude-sonnet-4"
   */
  async chat(
    providerId: string,
    messages: { role: string; content: string }[],
    model: string,
    options?: ChatOptions,
    fallbackProviderId?: string,
    fallbackModelId?: string,
  ) {
    // Support "provider/model" unified format
    const { resolvedProvider, resolvedModel } = resolveProviderModel(providerId, model);

    const adapter = this.get(resolvedProvider);
    if (!adapter) throw new Error(`Provider ${resolvedProvider} non trovato`);
    try {
      return await adapter.chat(messages, resolvedModel, options);
    } catch (err) {
      if (fallbackProviderId) {
        const fallback = this.get(fallbackProviderId);
        if (fallback) {
          console.log(`[Provider] Fallback da ${resolvedProvider} a ${fallbackProviderId}`);
          return await fallback.chat(messages, fallbackModelId || resolvedModel, options);
        }
      }
      throw err;
    }
  }

  /**
   * Load custom providers from database and register them.
   * Called at startup and when custom providers are added/modified.
   */
  loadCustomProviders() {
    try {
      const rows: any[] = db.prepare(
        'SELECT * FROM custom_providers WHERE enabled = 1'
      ).all();

      for (const row of rows) {
        const adapter = new OpenAICompatibleAdapter({
          id: row.id,
          name: row.name,
          type: row.type || 'cloud',
          baseUrl: row.base_url,
          apiKey: row.api_key || '',
          defaultModel: row.default_model || 'default',
        });
        this.register(adapter);
        console.log(`[Provider] Custom provider registrato: ${row.name} (${row.id})`);
      }
    } catch {
      // Table may not exist yet during first migration
    }
  }

  /**
   * Register a known provider by ID (e.g., 'deepseek', 'groq', 'openrouter').
   */
  registerKnownProvider(knownId: string, apiKey: string, overrides?: { baseUrl?: string; defaultModel?: string }) {
    const config = KNOWN_PROVIDERS[knownId];
    if (!config) throw new Error(`Provider noto "${knownId}" non trovato. Disponibili: ${Object.keys(KNOWN_PROVIDERS).join(', ')}`);

    const adapter = new OpenAICompatibleAdapter({
      id: knownId,
      name: config.name,
      type: config.type,
      baseUrl: overrides?.baseUrl || config.baseUrl,
      apiKey,
      defaultModel: overrides?.defaultModel || config.defaultModel,
    });
    this.register(adapter);
    return adapter;
  }
}

/**
 * Resolve OpenClaw-style "provider/model" format.
 * Examples:
 *   "openai", "gpt-4o" → { resolvedProvider: "openai", resolvedModel: "gpt-4o" }
 *   "openai/gpt-4o", "" → { resolvedProvider: "openai", resolvedModel: "gpt-4o" }
 *   "deepseek/deepseek-chat", "" → { resolvedProvider: "deepseek", resolvedModel: "deepseek-chat" }
 *   "openrouter/anthropic/claude-sonnet-4", "" → { resolvedProvider: "openrouter", resolvedModel: "anthropic/claude-sonnet-4" }
 */
function resolveProviderModel(providerId: string, model: string): { resolvedProvider: string; resolvedModel: string } {
  // If model is already set, use as-is
  if (model && providerId) {
    return { resolvedProvider: providerId, resolvedModel: model };
  }

  // Try to parse "provider/model" from providerId
  if (providerId.includes('/')) {
    const parts = providerId.split('/');
    const provider = parts[0];
    const modelPart = parts.slice(1).join('/'); // Keep rest as model (for openrouter/anthropic/claude-sonnet-4)
    return {
      resolvedProvider: provider,
      resolvedModel: modelPart || model,
    };
  }

  return { resolvedProvider: providerId, resolvedModel: model };
}

export const providerRegistry = new ProviderRegistry();
