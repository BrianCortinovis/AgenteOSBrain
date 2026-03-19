export type NodeType = 'sorgente' | 'analisi' | 'decisione' | 'esecuzione' | 'memoria' | 'automazione';
export type NodeState = 'bozza' | 'pronto' | 'in_esecuzione' | 'completato' | 'bloccato';
export type ProjectStatus = 'bozza' | 'pronto' | 'in_esecuzione' | 'completato';
export type PromptScope = 'global' | 'project' | 'node';
export type ScheduleTrigger = 'manual' | 'daily' | 'hourly' | 'weekly' | 'cron';
export type OutputType = 'log' | 'report' | 'file' | 'error';
export type ChatRole = 'user' | 'assistant' | 'system';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  project_id: string;
  type: NodeType;
  label: string;
  description?: string;
  state: NodeState;
  color?: string;
  config: Record<string, any>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  agent_id?: string;
  provider_id?: string;
  model_id?: string;
  system_prompt?: string;
  created_at: string;
}

export interface GraphEdge {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  label: string;
  condition: string;
  created_at: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  role: string;
  provider_id: string;
  model_id: string;
  system_prompt: string;
  temperature: number;
  tools: string[];
  memory_enabled: boolean;
  fallback_provider_id?: string;
  fallback_model_id?: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  scope: PromptScope;
  scope_id?: string;
  name: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  project_id: string;
  node_id?: string;
  name: string;
  trigger: ScheduleTrigger;
  cron_expr?: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export interface ConnectorDefinition {
  id: string;
  category: string;
  name: string;
  icon: string;
  description: string;
  status: 'available' | 'coming_soon';
  configSchema: Record<string, any>;
  actions: string[];
}

export interface ConnectorInstance {
  id: string;
  project_id: string;
  definition_id: string;
  config: Record<string, any>;
  enabled: boolean;
  created_at: string;
}

export interface Output {
  id: string;
  project_id: string;
  node_id?: string;
  type: OutputType;
  title: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: ChatRole;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  models: ModelInfo[];
  available: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider_id: string;
}

export interface ChatRequest {
  messages: { role: string; content: string }[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
  response_format?: 'text' | 'json_object';
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  model: string;
  provider: string;
}
