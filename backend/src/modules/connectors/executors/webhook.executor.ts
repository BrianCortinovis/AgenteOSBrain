import { ConnectorExecutor, ConnectorResult } from './types';

export const webhookExecutor: ConnectorExecutor = {
  id: 'webhook',

  async execute(action: string, params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult> {
    switch (action) {
      case 'send':
      case 'trigger': {
        const url = params.url || config.url;
        if (!url) return { success: false, error: 'URL webhook non specificato' };

        try {
          const method = params.method || config.method || 'POST';
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(config.headers || {}),
            ...(params.headers || {}),
          };

          // Add auth header if configured
          if (config.auth_token) {
            headers['Authorization'] = `Bearer ${config.auth_token}`;
          }

          const response = await fetch(url, {
            method,
            headers,
            body: method !== 'GET' ? JSON.stringify(params.payload || params.body || {}) : undefined,
          });

          const text = await response.text();
          let data: any;
          try { data = JSON.parse(text); } catch { data = text; }

          return {
            success: response.ok,
            data,
            message: `Webhook ${method} ${url} → ${response.status}`,
            error: response.ok ? undefined : `HTTP ${response.status}`,
          };
        } catch (err: any) {
          return { success: false, error: `Errore webhook: ${err.message}` };
        }
      }

      default:
        return { success: false, error: `Azione webhook non supportata: ${action}` };
    }
  },
};
