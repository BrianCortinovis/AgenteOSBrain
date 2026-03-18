import { api } from './client';

export const schedulerApi = {
  getByProject: (projectId: string) => api.get<any[]>(`/projects/${projectId}/schedules`),
  create: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/schedules`, data),
  update: (id: string, data: any) => api.put<any>(`/schedules/${id}`, data),
  delete: (id: string) => api.delete(`/schedules/${id}`),
  trigger: (id: string) => api.post<any>(`/schedules/${id}/trigger`, {}),
};
