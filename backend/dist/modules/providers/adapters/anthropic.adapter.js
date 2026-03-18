"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
exports.setAnthropicMode = setAnthropicMode;
exports.getAnthropicMode = getAnthropicMode;
const config_1 = require("../../../config");
const claude_bridge_1 = require("./claude-bridge");
let currentMode = 'api_key';
function setAnthropicMode(mode) {
    currentMode = mode;
}
function getAnthropicMode() {
    return currentMode;
}
class AnthropicAdapter {
    id = 'anthropic';
    name = 'Anthropic';
    type = 'cloud';
    get apiKey() { return config_1.config.anthropicApiKey; }
    baseUrl = 'https://api.anthropic.com/v1';
    get mode() { return currentMode; }
    async chat(messages, model, options) {
        if (currentMode === 'claude_cli') {
            return this.chatViaCLI(messages);
        }
        return this.chatViaAPI(messages, model, options);
    }
    async chatViaCLI(messages) {
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');
        const content = await (0, claude_bridge_1.chatClaudeCLI)(systemMsg?.content || '', chatMessages);
        return {
            content,
            usage: { prompt_tokens: 0, completion_tokens: 0 },
        };
    }
    async chatViaAPI(messages, model, options) {
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
        if (!res.ok)
            throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
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
            const status = await (0, claude_bridge_1.checkClaudeCLI)();
            return status.found;
        }
        if (!this.apiKey)
            return false;
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
        }
        catch {
            return false;
        }
    }
}
exports.AnthropicAdapter = AnthropicAdapter;
