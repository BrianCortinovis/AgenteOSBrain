import { api } from './client';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  content: string;
  enabled: number;
  installed_at: string;
}

export const skillsApi = {
  getAll: () => api.get<Skill[]>('/skills'),
  getEnabled: () => api.get<Skill[]>('/skills/enabled'),
  install: (data: { name: string; description?: string; category?: string; content: string }) =>
    api.post<Skill>('/skills', data),
  installMd: (content: string) => api.post<Skill>('/skills/install-md', { content }),
  toggle: (id: string, enabled: boolean) => api.put<Skill>(`/skills/${id}/toggle`, { enabled }),
  delete: (id: string) => api.delete(`/skills/${id}`),
};
