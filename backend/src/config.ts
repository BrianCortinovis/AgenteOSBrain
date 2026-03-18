import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || process.env.AGENT_OS_BACKEND_PORT || '43101', 10),
  dataDir: path.resolve(__dirname, '../data'),
  dbPath: path.resolve(__dirname, '../data/agenteos.db'),
  outputsDir: path.resolve(__dirname, '../data/outputs'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
};
