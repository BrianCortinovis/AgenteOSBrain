import { type AnthropicMode } from './adapters/anthropic.adapter';
interface ProviderSettings {
    anthropic_mode: AnthropicMode;
    openai_api_key: string;
    anthropic_api_key: string;
    gemini_api_key: string;
    ollama_base_url: string;
    outputs_dir: string;
}
export declare function loadSettings(): ProviderSettings;
export declare function saveSettings(settings: Partial<ProviderSettings>): {
    anthropic_mode: AnthropicMode;
    openai_key_set: boolean;
    openai_key_preview: string;
    anthropic_key_set: boolean;
    anthropic_key_preview: string;
    gemini_key_set: boolean;
    gemini_key_preview: string;
    ollama_base_url: string;
    outputs_dir: string;
    outputs_dir_default: string;
};
export declare function getPublicSettings(settings?: ProviderSettings): {
    anthropic_mode: AnthropicMode;
    openai_key_set: boolean;
    openai_key_preview: string;
    anthropic_key_set: boolean;
    anthropic_key_preview: string;
    gemini_key_set: boolean;
    gemini_key_preview: string;
    ollama_base_url: string;
    outputs_dir: string;
    outputs_dir_default: string;
};
export {};
