import { Router } from 'express';
import { providerRegistry } from './provider-registry';
import { checkClaudeCLI, installClaudeCLI } from './adapters/claude-bridge';
import { getAnthropicMode } from './adapters/anthropic.adapter';
import { loadSettings, saveSettings, getPublicSettings } from './settings.service';
import { KNOWN_PROVIDERS } from './adapters/openai-compatible.adapter';
import db from '../../database/connection';
import { generateId } from '../../utils/id';

const router = Router();

router.get('/', async (_req, res) => {
  const providers = providerRegistry.getAll();
  const result = await Promise.all(providers.map(async (p) => {
    let available = false;
    try { available = await p.testConnection(); } catch {}
    const models = await p.listModels();
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      available,
      models,
      ...(p.id === 'anthropic' ? { mode: getAnthropicMode() } : {}),
    };
  }));
  res.json(result);
});

router.post('/test', async (req, res) => {
  const { provider_id } = req.body;
  const adapter = providerRegistry.get(provider_id);
  if (!adapter) return res.status(404).json({ error: 'Provider non trovato' });
  try {
    const ok = await adapter.testConnection();
    res.json({ provider_id, available: ok });
  } catch (err: any) {
    res.json({ provider_id, available: false, error: err.message });
  }
});

router.get('/ollama/models', async (_req, res) => {
  const ollama = providerRegistry.get('ollama');
  if (!ollama) return res.json([]);
  const models = await ollama.listModels();
  res.json(models);
});

// Claude CLI status
router.get('/claude/status', async (_req, res) => {
  const status = await checkClaudeCLI();
  res.json(status);
});

// Claude CLI install
router.post('/claude/install', async (_req, res) => {
  const result = await installClaudeCLI();
  res.json(result);
});

// Provider settings
router.get('/settings', (_req, res) => {
  res.json(getPublicSettings());
});

router.post('/settings', (req, res) => {
  const updated = saveSettings(req.body);
  res.json(updated);
});

// ─── Known providers catalog (OpenClaw-style) ───────────────────

router.get('/known', (_req, res) => {
  const known = Object.entries(KNOWN_PROVIDERS).map(([id, config]) => ({
    id,
    ...config,
    registered: !!providerRegistry.get(id),
  }));
  res.json(known);
});

// ─── Custom providers CRUD ──────────────────────────────────────

router.get('/custom', (_req, res) => {
  const rows = db.prepare('SELECT * FROM custom_providers ORDER BY created_at').all();
  res.json(rows);
});

router.post('/custom', (req, res) => {
  const { id: customId, name, base_url, api_key, default_model, type } = req.body;
  const id = customId || generateId();
  db.prepare(
    'INSERT INTO custom_providers (id, name, base_url, api_key, default_model, type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, base_url, api_key || '', default_model || '', type || 'cloud');

  // Auto-register the new provider
  providerRegistry.loadCustomProviders();

  const row = db.prepare('SELECT * FROM custom_providers WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.put('/custom/:id', (req, res) => {
  const { name, base_url, api_key, default_model, type, enabled } = req.body;
  const fields: string[] = [];
  const values: any[] = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (base_url !== undefined) { fields.push('base_url = ?'); values.push(base_url); }
  if (api_key !== undefined) { fields.push('api_key = ?'); values.push(api_key); }
  if (default_model !== undefined) { fields.push('default_model = ?'); values.push(default_model); }
  if (type !== undefined) { fields.push('type = ?'); values.push(type); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (fields.length === 0) return res.json(db.prepare('SELECT * FROM custom_providers WHERE id = ?').get(req.params.id));
  values.push(req.params.id);
  db.prepare(`UPDATE custom_providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Reload custom providers
  providerRegistry.loadCustomProviders();

  res.json(db.prepare('SELECT * FROM custom_providers WHERE id = ?').get(req.params.id));
});

router.delete('/custom/:id', (req, res) => {
  providerRegistry.unregister(req.params.id);
  db.prepare('DELETE FROM custom_providers WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Quick-register a known provider with just an API key
router.post('/register-known', (req, res) => {
  const { provider_id, api_key, base_url, default_model } = req.body;
  try {
    const adapter = providerRegistry.registerKnownProvider(provider_id, api_key || '', {
      baseUrl: base_url,
      defaultModel: default_model,
    });

    // Also persist to DB
    const known = KNOWN_PROVIDERS[provider_id];
    if (known) {
      db.prepare(
        `INSERT OR REPLACE INTO custom_providers (id, name, base_url, api_key, default_model, type)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(provider_id, known.name, base_url || known.baseUrl, api_key || '', default_model || known.defaultModel, known.type);
    }

    res.json({ id: adapter.id, name: adapter.name, registered: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
