import { api } from './client';

export const chatApi = {
  getHistory: (projectId: string) => api.get<any[]>(`/projects/${projectId}/chat`),
  send: (projectId: string, message: string, provider_id?: string, model_id?: string) =>
    api.post<any>(`/projects/${projectId}/chat`, { message, provider_id, model_id }),
  clear: (projectId: string) => api.delete(`/projects/${projectId}/chat`),
};
