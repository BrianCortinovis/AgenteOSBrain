import { api } from './client';

export const promptsApi = {
  getAll: (scope?: string, scopeId?: string) => {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (scopeId) params.set('scope_id', scopeId);
    const qs = params.toString();
    return api.get<any[]>(`/prompts${qs ? `?${qs}` : ''}`);
  },
  create: (data: any) => api.post<any>('/prompts', data),
  update: (id: string, data: any) => api.put<any>(`/prompts/${id}`, data),
  delete: (id: string) => api.delete(`/prompts/${id}`),
};
