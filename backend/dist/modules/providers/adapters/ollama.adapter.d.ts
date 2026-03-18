import { ProviderAdapter } from '../providers.types';
export declare class OllamaAdapter implements ProviderAdapter {
    id: string;
    name: string;
    type: "local";
    private get baseUrl();
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
    listModels(): Promise<any>;
    testConnection(): Promise<boolean>;
}
