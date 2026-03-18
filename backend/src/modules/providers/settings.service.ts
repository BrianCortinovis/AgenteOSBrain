import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import { setAnthropicMode, getAnthropicMode, type AnthropicMode } from './adapters/anthropic.adapter';

const SETTINGS_PATH = path.resolve(config.dataDir, 'provider-settings.json');

interface ProviderSettings {
  anthropic_mode: AnthropicMode;
  openai_api_key: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  ollama_base_url: string;
  outputs_dir: string;
}

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadSettings(): ProviderSettings {
  ensureDataDir();
  const defaults: ProviderSettings = {
    anthropic_mode: 'api_key',
    openai_api_key: '',
    anthropic_api_key: '',
    gemini_api_key: '',
    ollama_base_url: 'http://localhost:11434',
    outputs_dir: '',
  };

  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      const merged = { ...defaults, ...data };
      applySettings(merged);
      return merged;
    }
  } catch {}

  // Use env vars as fallback
  defaults.openai_api_key = config.openaiApiKey;
  defaults.anthropic_api_key = config.anthropicApiKey;
  defaults.gemini_api_key = config.geminiApiKey;
  defaults.ollama_base_url = config.ollamaBaseUrl;

  return defaults;
}

export function saveSettings(settings: Partial<ProviderSettings>) {
  ensureDataDir();
  const current = loadSettings();
  const updated = { ...current, ...settings };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  applySettings(updated);

  return getPublicSettings(updated);
}

function applySettings(settings: ProviderSettings) {
  if (settings.openai_api_key) {
    (config as any).openaiApiKey = settings.openai_api_key;
    process.env.OPENAI_API_KEY = settings.openai_api_key;
  }
  if (settings.anthropic_api_key) {
    (config as any).anthropicApiKey = settings.anthropic_api_key;
    process.env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
  }
  if (settings.gemini_api_key) {
    (config as any).geminiApiKey = settings.gemini_api_key;
    process.env.GEMINI_API_KEY = settings.gemini_api_key;
  }
  if (settings.ollama_base_url) {
    (config as any).ollamaBaseUrl = settings.ollama_base_url;
  }
  if (settings.outputs_dir) {
    (config as any).outputsDir = settings.outputs_dir;
  }
  setAnthropicMode(settings.anthropic_mode || 'api_key');
}

export function getPublicSettings(settings?: ProviderSettings) {
  const s = settings || loadSettings();
  return {
    anthropic_mode: s.anthropic_mode,
    openai_key_set: !!s.openai_api_key,
    openai_key_preview: s.openai_api_key ? '...' + s.openai_api_key.slice(-6) : '',
    anthropic_key_set: !!s.anthropic_api_key,
    anthropic_key_preview: s.anthropic_api_key ? '...' + s.anthropic_api_key.slice(-6) : '',
    gemini_key_set: !!s.gemini_api_key,
    gemini_key_preview: s.gemini_api_key ? '...' + s.gemini_api_key.slice(-6) : '',
    ollama_base_url: s.ollama_base_url,
    outputs_dir: s.outputs_dir || config.outputsDir,
    outputs_dir_default: config.outputsDir,
  };
}

// Load settings on module import
loadSettings();
