export interface ProviderAdapter {
    id: string;
    name: string;
    type: 'cloud' | 'local';
    chat(messages: {
        role: string;
        content: string;
    }[], model: string, options?: {
        temperature?: number;
        max_tokens?: number;
    }): Promise<{
        content: string;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
        };
    }>;
    listModels(): Promise<{
        id: string;
        name: string;
    }[]>;
    testConnection(): Promise<boolean>;
}
