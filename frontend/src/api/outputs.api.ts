import { api } from './client';

export const outputsApi = {
  getByProject: (projectId: string) => api.get<any[]>(`/projects/${projectId}/outputs`),
  getById: (id: string) => api.get<any>(`/outputs/${id}`),
  delete: (id: string) => api.delete(`/outputs/${id}`),
};
