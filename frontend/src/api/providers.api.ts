import { api } from './client';

export const providersApi = {
  getAll: () => api.get<any[]>('/providers'),
  test: (provider_id: string) => api.post<any>('/providers/test', { provider_id }),
  getOllamaModels: () => api.get<any[]>('/providers/ollama/models'),
  getClaudeStatus: () => api.get<{ found: boolean; path: string; version: string }>('/providers/claude/status'),
  installClaude: () => api.post<{ success: boolean; message: string }>('/providers/claude/install', {}),
  getSettings: () => api.get<any>('/providers/settings'),
  saveSettings: (data: any) => api.post<any>('/providers/settings', data),
};
