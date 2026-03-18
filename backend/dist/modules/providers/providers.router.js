"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const provider_registry_1 = require("./provider-registry");
const claude_bridge_1 = require("./adapters/claude-bridge");
const anthropic_adapter_1 = require("./adapters/anthropic.adapter");
const settings_service_1 = require("./settings.service");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const providers = provider_registry_1.providerRegistry.getAll();
    const result = await Promise.all(providers.map(async (p) => {
        let available = false;
        try {
            available = await p.testConnection();
        }
        catch { }
        const models = await p.listModels();
        return {
            id: p.id,
            name: p.name,
            type: p.type,
            available,
            models,
            ...(p.id === 'anthropic' ? { mode: (0, anthropic_adapter_1.getAnthropicMode)() } : {}),
        };
    }));
    res.json(result);
});
router.post('/test', async (req, res) => {
    const { provider_id } = req.body;
    const adapter = provider_registry_1.providerRegistry.get(provider_id);
    if (!adapter)
        return res.status(404).json({ error: 'Provider non trovato' });
    try {
        const ok = await adapter.testConnection();
        res.json({ provider_id, available: ok });
    }
    catch (err) {
        res.json({ provider_id, available: false, error: err.message });
    }
});
router.get('/ollama/models', async (_req, res) => {
    const ollama = provider_registry_1.providerRegistry.get('ollama');
    if (!ollama)
        return res.json([]);
    const models = await ollama.listModels();
    res.json(models);
});
// Claude CLI status
router.get('/claude/status', async (_req, res) => {
    const status = await (0, claude_bridge_1.checkClaudeCLI)();
    res.json(status);
});
// Claude CLI install
router.post('/claude/install', async (_req, res) => {
    const result = await (0, claude_bridge_1.installClaudeCLI)();
    res.json(result);
});
// Provider settings
router.get('/settings', (_req, res) => {
    res.json((0, settings_service_1.getPublicSettings)());
});
router.post('/settings', (req, res) => {
    const updated = (0, settings_service_1.saveSettings)(req.body);
    res.json(updated);
});
exports.default = router;
