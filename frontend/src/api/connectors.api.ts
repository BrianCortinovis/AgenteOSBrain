import { api } from './client';

export const connectorsApi = {
  // Definizioni (catalogo)
  getDefinitions: () => api.get<any[]>('/definitions'),
  getCatalog: () => api.get<any[]>('/definitions'),

  // Istanze legacy per progetto
  getByProject: (projectId: string) => api.get<any[]>(`/projects/${projectId}/connectors`),
  create: (projectId: string, data: any) => api.post<any>(`/projects/${projectId}/connectors`, data),
  update: (id: string, data: any) => api.put<any>(`/connectors/${id}`, data),
  delete: (id: string) => api.delete(`/connectors/${id}`),

  // Istanze configurate (globali)
  getInstances: () => api.get<any[]>('/connectors/instances'),
  createInstance: (data: any) => api.post<any>('/connectors/instances', data),
  updateInstance: (id: string, data: any) => api.put<any>(`/connectors/instances/${id}`, data),
  deleteInstance: (id: string) => api.delete(`/connectors/instances/${id}`),
  testInstance: (id: string) => api.post<any>(`/connectors/instances/${id}/test`, {}),
  testConnection: (connectorId: string, config: any) => api.post<any>('/connectors/test', { connector_id: connectorId, config }),
};
