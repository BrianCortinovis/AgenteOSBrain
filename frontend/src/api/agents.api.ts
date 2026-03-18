import { api } from './client';

export const agentsApi = {
  getByProject: (projectId: string) => api.get<any[]>(`/projects/${projectId}/agents`),
  create: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/agents`, data),
  generateDraft: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/agents/draft`, data),
  update: (id: string, data: any) => api.put<any>(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
};
