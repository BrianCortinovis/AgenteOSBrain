import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dataDir = process.env.AGENT_OS_DATA_DIR || path.resolve(__dirname, '../data');
const flowRoot = process.env.FLOW_ROOT || path.join(process.env.HOME || '', 'Documents/FLOW');

export const config = {
  port: parseInt(process.env.PORT || process.env.AGENT_OS_BACKEND_PORT || '43101', 10),
  dataDir,
  dbPath: process.env.AGENT_OS_DB_PATH || path.join(dataDir, 'agenteos.db'),
  outputsDir: process.env.AGENT_OS_OUTPUTS_DIR || path.join(dataDir, 'outputs'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  // FLOW OS paths
  flowRoot,
  appsDir: process.env.AGENT_OS_APPS_DIR || path.join(flowRoot, 'Apps'),
  flowDocsDir: path.join(flowRoot, 'Documents'),
  flowWorkDir: path.join(flowRoot, 'Work'),
  flowMediaDir: path.join(flowRoot, 'Media'),
  flowDesktopDir: path.join(flowRoot, 'Desktop'),
};
