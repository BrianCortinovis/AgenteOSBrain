import { api } from './client';

export const executeApi = {
  executeProject: (projectId: string) => api.post<any>(`/projects/${projectId}/execute`, {}),
  executeNode: (projectId: string, nodeId: string) => api.post<any>(`/projects/${projectId}/execute/${nodeId}`, {}),
  getState: (projectId: string) => api.get<{ state: string }>(`/projects/${projectId}/execution-state`),
  pause: (projectId: string) => api.post<any>(`/projects/${projectId}/pause`, {}),
  resume: (projectId: string) => api.post<any>(`/projects/${projectId}/resume`, {}),
  stop: (projectId: string) => api.post<any>(`/projects/${projectId}/stop`, {}),
};
