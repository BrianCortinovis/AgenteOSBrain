import { ProviderAdapter } from '../providers.types';
export declare class OpenAIAdapter implements ProviderAdapter {
    id: string;
    name: string;
    type: "cloud";
    private get apiKey();
    private baseUrl;
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
