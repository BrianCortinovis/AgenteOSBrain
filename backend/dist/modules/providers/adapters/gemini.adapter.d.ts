import { ProviderAdapter } from '../providers.types';
export declare class GeminiAdapter implements ProviderAdapter {
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
    /**
     * Analyze images with Gemini Vision.
     * Sends images as base64 inline_data along with a text prompt.
     * Returns the AI's analysis text.
     */
    analyzeImages(imagePaths: string[], prompt: string, systemPrompt?: string, model?: string, options?: {
        temperature?: number;
        max_tokens?: number;
    }): Promise<string>;
    /**
     * Analyze a single image and return structured detection results.
     */
    detectInImage(imagePath: string, query: string, model?: string): Promise<{
        found: boolean;
        confidence: string;
        description: string;
        objects: string[];
    }>;
    listModels(): Promise<{
        id: string;
        name: string;
    }[]>;
    testConnection(): Promise<boolean>;
}
