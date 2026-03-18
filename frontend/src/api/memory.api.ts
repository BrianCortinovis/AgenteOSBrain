import { api } from './client';

export interface MemoryEntry {
  id: string;
  project_id: string | null;
  agent_id: string | null;
  content: string;
  summary: string;
  tags: string[];
  source: string;
  importance: number;
  access_count: number;
  created_at: string;
}

export const memoryApi = {
  search: (query: string, projectId?: string, limit?: number) =>
    api.get<MemoryEntry[]>(`/memory/search?q=${encodeURIComponent(query)}${projectId ? `&project_id=${projectId}` : ''}${limit ? `&limit=${limit}` : ''}`),
  getByProject: (projectId: string) => api.get<MemoryEntry[]>(`/memory/project/${projectId}`),
  save: (data: { project_id?: string; content: string; tags?: string[] }) =>
    api.post<MemoryEntry>('/memory', data),
  delete: (id: string) => api.delete(`/memory/${id}`),
  compact: (projectId: string) => api.post<{ deleted: number }>(`/memory/compact/${projectId}`, {}),
};
