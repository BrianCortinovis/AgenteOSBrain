"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerRegistry = void 0;
const openai_adapter_1 = require("./adapters/openai.adapter");
const anthropic_adapter_1 = require("./adapters/anthropic.adapter");
const gemini_adapter_1 = require("./adapters/gemini.adapter");
const ollama_adapter_1 = require("./adapters/ollama.adapter");
class ProviderRegistry {
    adapters = new Map();
    constructor() {
        this.register(new openai_adapter_1.OpenAIAdapter());
        this.register(new anthropic_adapter_1.AnthropicAdapter());
        this.register(new gemini_adapter_1.GeminiAdapter());
        this.register(new ollama_adapter_1.OllamaAdapter());
    }
    register(adapter) {
        this.adapters.set(adapter.id, adapter);
    }
    get(id) {
        return this.adapters.get(id);
    }
    getAll() {
        return Array.from(this.adapters.values());
    }
    async chat(providerId, messages, model, options, fallbackProviderId, fallbackModelId) {
        const adapter = this.get(providerId);
        if (!adapter)
            throw new Error(`Provider ${providerId} non trovato`);
        try {
            return await adapter.chat(messages, model, options);
        }
        catch (err) {
            if (fallbackProviderId) {
                const fallback = this.get(fallbackProviderId);
                if (fallback) {
                    console.log(`[Provider] Fallback da ${providerId} a ${fallbackProviderId}`);
                    return await fallback.chat(messages, fallbackModelId || model, options);
                }
            }
            throw err;
        }
    }
}
exports.providerRegistry = new ProviderRegistry();
