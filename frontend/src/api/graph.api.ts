import { api } from './client';

export const graphApi = {
  getGraph: (projectId: string) => api.get<{ nodes: any[]; edges: any[] }>(`/projects/${projectId}/graph`),
  saveGraph: (projectId: string, data: { nodes: any[]; edges: any[] }) => api.put<any>(`/projects/${projectId}/graph`, data),
  createNode: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/nodes`, data),
  updateNode: (id: string, data: any) => api.put<any>(`/nodes/${id}`, data),
  deleteNode: (id: string) => api.delete(`/nodes/${id}`),
  createEdge: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/edges`, data),
  deleteEdge: (id: string) => api.delete(`/edges/${id}`),
};
