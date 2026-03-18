"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaAdapter = void 0;
const config_1 = require("../../../config");
class OllamaAdapter {
    id = 'ollama';
    name = 'Ollama (Locale)';
    type = 'local';
    get baseUrl() { return config_1.config.ollamaBaseUrl; }
    async chat(messages, model, options) {
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
        if (!res.ok)
            throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return {
            content: data.message?.content || '',
            usage: { prompt_tokens: data.prompt_eval_count || 0, completion_tokens: data.eval_count || 0 },
        };
    }
    async listModels() {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            if (!res.ok)
                return [];
            const data = await res.json();
            return (data.models || []).map((m) => ({ id: m.name, name: m.name }));
        }
        catch {
            return [];
        }
    }
    async testConnection() {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.OllamaAdapter = OllamaAdapter;
