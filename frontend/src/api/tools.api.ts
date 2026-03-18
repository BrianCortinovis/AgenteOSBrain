import { api } from './client';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters_schema: Record<string, any>;
  enabled: number;
}

export const toolsApi = {
  getAll: () => api.get<ToolDefinition[]>('/tools'),
  getEnabled: () => api.get<ToolDefinition[]>('/tools/enabled'),
  toggle: (id: string, enabled: boolean) => api.put<ToolDefinition>(`/tools/${id}/toggle`, { enabled }),
};
