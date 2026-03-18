import { ProviderAdapter } from './providers.types';
declare class ProviderRegistry {
    private adapters;
    constructor();
    register(adapter: ProviderAdapter): void;
    get(id: string): ProviderAdapter | undefined;
    getAll(): ProviderAdapter[];
    chat(providerId: string, messages: {
        role: string;
        content: string;
    }[], model: string, options?: {
        temperature?: number;
        max_tokens?: number;
    }, fallbackProviderId?: string, fallbackModelId?: string): Promise<{
        content: string;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
        };
    }>;
}
export declare const providerRegistry: ProviderRegistry;
export {};
