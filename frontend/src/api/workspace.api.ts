import { api } from './client';

export const workspaceApi = {
  getAll: () => api.get<Record<string, string>>('/workspace'),
  get: (key: string) => api.get<{ key: string; value: string }>(`/workspace/${key}`),
  set: (key: string, value: string) => api.put<{ key: string; value: string }>(`/workspace/${key}`, { value }),
};
