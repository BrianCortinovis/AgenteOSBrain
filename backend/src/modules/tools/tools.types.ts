export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface ToolContext {
  projectId: string;
  nodeId?: string;
  agentId?: string;
  outputDir?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolExecutor {
  name: string;
  execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}
