import { api } from './client';

export const aiApi = {
  assistField: (data: {
    project_id?: string | null;
    provider_id?: string;
    model_id?: string;
    field_label: string;
    field_kind?: string;
    current_value?: string;
    instruction: string;
    context?: string;
  }) => api.post<{ content: string; provider_id: string; model_id: string }>('/ai/assist', data),
};
