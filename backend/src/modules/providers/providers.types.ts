export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
  response_format?: 'text' | 'json_object';
}

export interface ProviderAdapter {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  chat(messages: { role: string; content: string }[], model: string, options?: ChatOptions): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } }>;
  listModels(): Promise<{ id: string; name: string }[]>;
  testConnection(): Promise<boolean>;
}
