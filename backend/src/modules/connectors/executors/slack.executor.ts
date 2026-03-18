import { ConnectorExecutor, ConnectorResult } from './types';

export const slackExecutor: ConnectorExecutor = {
  id: 'slack',

  async execute(action: string, params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult> {
    const token = config.bot_token || config.token;
    if (!token) return { success: false, error: 'Token Slack non configurato' };

    switch (action) {
      case 'send_message': {
        const channel = params.channel || config.default_channel;
        if (!channel) return { success: false, error: 'Canale non specificato' };
        const res = await slackAPI(token, 'chat.postMessage', {
          channel,
          text: params.text || params.message,
          ...(params.blocks ? { blocks: params.blocks } : {}),
        });
        return res.ok
          ? { success: true, data: res, message: `Messaggio inviato su #${channel}` }
          : { success: false, error: res.error || 'Errore invio Slack' };
      }

      case 'send_file': {
        const channel = params.channel || config.default_channel;
        if (!channel) return { success: false, error: 'Canale non specificato' };
        const res = await slackAPI(token, 'files.upload', {
          channels: channel,
          content: params.content,
          filename: params.filename || 'file.txt',
          title: params.title || '',
        });
        return res.ok
          ? { success: true, data: res, message: 'File caricato su Slack' }
          : { success: false, error: res.error || 'Errore upload Slack' };
      }

      case 'list_channels': {
        const res = await slackAPI(token, 'conversations.list', {
          types: 'public_channel,private_channel',
          limit: params.limit || 50,
        });
        return res.ok
          ? { success: true, data: res.channels }
          : { success: false, error: res.error || 'Errore lista canali' };
      }

      case 'get_channel_history': {
        const channel = params.channel || config.default_channel;
        if (!channel) return { success: false, error: 'Canale non specificato' };
        const res = await slackAPI(token, 'conversations.history', {
          channel,
          limit: params.limit || 20,
        });
        return res.ok
          ? { success: true, data: res.messages }
          : { success: false, error: res.error || 'Errore storico canale' };
      }

      default:
        return { success: false, error: `Azione Slack non supportata: ${action}` };
    }
  },
};

async function slackAPI(token: string, method: string, body: any): Promise<any> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  return response.json();
}
