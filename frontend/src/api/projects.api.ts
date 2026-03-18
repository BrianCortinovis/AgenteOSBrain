import { api } from './client';

export const projectsApi = {
  getAll: () => api.get<any[]>('/projects'),
  getById: (id: string) => api.get<any>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) => api.post<any>('/projects', data),
  update: (id: string, data: any) => api.put<any>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  duplicate: (id: string) => api.post<any>(`/projects/${id}/duplicate`, {}),
};
