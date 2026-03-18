"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.getPublicSettings = getPublicSettings;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
const anthropic_adapter_1 = require("./adapters/anthropic.adapter");
const SETTINGS_PATH = path_1.default.resolve(config_1.config.dataDir, 'provider-settings.json');
function ensureDataDir() {
    const dir = path_1.default.dirname(SETTINGS_PATH);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function loadSettings() {
    ensureDataDir();
    const defaults = {
        anthropic_mode: 'api_key',
        openai_api_key: '',
        anthropic_api_key: '',
        gemini_api_key: '',
        ollama_base_url: 'http://localhost:11434',
        outputs_dir: '',
    };
    try {
        if (fs_1.default.existsSync(SETTINGS_PATH)) {
            const data = JSON.parse(fs_1.default.readFileSync(SETTINGS_PATH, 'utf-8'));
            const merged = { ...defaults, ...data };
            applySettings(merged);
            return merged;
        }
    }
    catch { }
    // Use env vars as fallback
    defaults.openai_api_key = config_1.config.openaiApiKey;
    defaults.anthropic_api_key = config_1.config.anthropicApiKey;
    defaults.gemini_api_key = config_1.config.geminiApiKey;
    defaults.ollama_base_url = config_1.config.ollamaBaseUrl;
    return defaults;
}
function saveSettings(settings) {
    ensureDataDir();
    const current = loadSettings();
    const updated = { ...current, ...settings };
    fs_1.default.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    applySettings(updated);
    return getPublicSettings(updated);
}
function applySettings(settings) {
    if (settings.openai_api_key) {
        config_1.config.openaiApiKey = settings.openai_api_key;
        process.env.OPENAI_API_KEY = settings.openai_api_key;
    }
    if (settings.anthropic_api_key) {
        config_1.config.anthropicApiKey = settings.anthropic_api_key;
        process.env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
    }
    if (settings.gemini_api_key) {
        config_1.config.geminiApiKey = settings.gemini_api_key;
        process.env.GEMINI_API_KEY = settings.gemini_api_key;
    }
    if (settings.ollama_base_url) {
        config_1.config.ollamaBaseUrl = settings.ollama_base_url;
    }
    if (settings.outputs_dir) {
        config_1.config.outputsDir = settings.outputs_dir;
    }
    (0, anthropic_adapter_1.setAnthropicMode)(settings.anthropic_mode || 'api_key');
}
function getPublicSettings(settings) {
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
        outputs_dir: s.outputs_dir || config_1.config.outputsDir,
        outputs_dir_default: config_1.config.outputsDir,
    };
}
// Load settings on module import
loadSettings();
