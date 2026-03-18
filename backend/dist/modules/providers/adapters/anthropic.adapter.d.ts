import { ProviderAdapter } from '../providers.types';
export type AnthropicMode = 'api_key' | 'claude_cli';
export declare function setAnthropicMode(mode: AnthropicMode): void;
export declare function getAnthropicMode(): AnthropicMode;
export declare class AnthropicAdapter implements ProviderAdapter {
    id: string;
    name: string;
    type: "cloud";
    private get apiKey();
    private baseUrl;
    get mode(): AnthropicMode;
    chat(messages: {
        role: string;
        content: string;
    }[], model: string, options?: {
        temperature?: number;
        max_tokens?: number;
    }): Promise<{
        content: any;
        usage: {
            prompt_tokens: any;
            completion_tokens: any;
        };
    }>;
    private chatViaCLI;
    private chatViaAPI;
    listModels(): Promise<{
        id: string;
        name: string;
    }[]>;
    testConnection(): Promise<boolean>;
}
