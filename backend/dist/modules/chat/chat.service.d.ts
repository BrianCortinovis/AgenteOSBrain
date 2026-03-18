export declare function getChatHistory(projectId: string): unknown[];
export declare function saveChatMessage(projectId: string, role: string, content: string, metadata?: any): unknown;
export declare function clearChatHistory(projectId: string): void;
export declare function sendChatMessage(projectId: string, userMessage: string, providerId?: string, modelId?: string): Promise<unknown>;
