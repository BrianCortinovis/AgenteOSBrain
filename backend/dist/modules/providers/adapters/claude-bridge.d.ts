export interface ClaudeCLIStatus {
    found: boolean;
    path: string;
    version: string;
}
export declare function checkClaudeCLI(): Promise<ClaudeCLIStatus>;
export declare function installClaudeCLI(): Promise<{
    success: boolean;
    message: string;
}>;
export declare function callClaudeCLI(prompt: string, options?: {
    timeout?: number;
}): Promise<string>;
export declare function chatClaudeCLI(systemPrompt: string, messages: {
    role: string;
    content: string;
}[]): Promise<string>;
