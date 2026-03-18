"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAdapter = void 0;
const config_1 = require("../../../config");
class OpenAIAdapter {
    id = 'openai';
    name = 'OpenAI';
    type = 'cloud';
    get apiKey() { return config_1.config.openaiApiKey; }
    baseUrl = 'https://api.openai.com/v1';
    async chat(messages, model, options) {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.max_tokens,
            }),
        });
        if (!res.ok)
            throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return {
            content: data.choices[0]?.message?.content || '',
            usage: { prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 },
        };
    }
    async listModels() {
        if (!this.apiKey)
            return [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            ];
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });
            const data = await res.json();
            return (data.data || [])
                .filter((m) => m.id.startsWith('gpt'))
                .map((m) => ({ id: m.id, name: m.id }))
                .slice(0, 20);
        }
        catch {
            return [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            ];
        }
    }
    async testConnection() {
        if (!this.apiKey)
            return false;
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.OpenAIAdapter = OpenAIAdapter;
