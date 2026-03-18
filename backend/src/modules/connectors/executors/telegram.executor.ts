import { ConnectorExecutor, ConnectorResult, ConnectorEvent } from './types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let lastUpdateId = 0;

export const telegramExecutor: ConnectorExecutor = {
  id: 'telegram',

  async execute(action: string, params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult> {
    const token = config.bot_token || config.token;
    if (!token) return { success: false, error: 'Token Telegram non configurato' };

    switch (action) {
      case 'send_message': {
        const chatId = params.chat_id || config.default_chat_id;
        if (!chatId) return { success: false, error: 'chat_id non specificato' };
        const body: any = {
          chat_id: chatId,
          text: params.text || params.message,
          parse_mode: params.parse_mode || 'HTML',
        };
        const res = await telegramAPI(token, 'sendMessage', body);
        return res.ok
          ? { success: true, data: res.result, message: 'Messaggio inviato' }
          : { success: false, error: res.description || 'Errore invio' };
      }

      case 'send_photo': {
        const chatId = params.chat_id || config.default_chat_id;
        if (!chatId) return { success: false, error: 'chat_id non specificato' };
        const body: any = {
          chat_id: chatId,
          photo: params.photo_url || params.photo,
          caption: params.caption || '',
        };
        const res = await telegramAPI(token, 'sendPhoto', body);
        return res.ok
          ? { success: true, data: res.result, message: 'Foto inviata' }
          : { success: false, error: res.description || 'Errore invio foto' };
      }

      case 'send_document': {
        const chatId = params.chat_id || config.default_chat_id;
        if (!chatId) return { success: false, error: 'chat_id non specificato' };
        const body: any = {
          chat_id: chatId,
          document: params.document_url || params.document,
          caption: params.caption || '',
        };
        const res = await telegramAPI(token, 'sendDocument', body);
        return res.ok
          ? { success: true, data: res.result, message: 'Documento inviato' }
          : { success: false, error: res.description || 'Errore invio documento' };
      }

      case 'get_updates': {
        const res = await telegramAPI(token, 'getUpdates', {
          offset: lastUpdateId + 1,
          limit: params.limit || 10,
          timeout: 0,
        });
        if (res.ok && res.result?.length > 0) {
          lastUpdateId = res.result[res.result.length - 1].update_id;
        }
        return { success: res.ok, data: res.result || [] };
      }

      case 'get_me': {
        const res = await telegramAPI(token, 'getMe', {});
        return { success: res.ok, data: res.result };
      }

      default:
        return { success: false, error: `Azione Telegram non supportata: ${action}` };
    }
  },

  async listen(config: Record<string, any>, callback: (event: ConnectorEvent) => void) {
    const token = config.bot_token || config.token;
    if (!token) return;

    console.log('[Telegram] Avvio polling per messaggi in entrata...');
    pollingInterval = setInterval(async () => {
      try {
        const res = await telegramAPI(token, 'getUpdates', {
          offset: lastUpdateId + 1,
          limit: 10,
          timeout: 0,
        });
        if (res.ok && res.result) {
          for (const update of res.result) {
            lastUpdateId = update.update_id;
            if (update.message) {
              callback({
                connector_id: 'telegram',
                type: 'message',
                data: {
                  chat_id: update.message.chat.id,
                  from: update.message.from,
                  text: update.message.text || '',
                  message_id: update.message.message_id,
                },
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`[Telegram] Errore polling: ${err.message}`);
      }
    }, 3000);
  },

  stopListening() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('[Telegram] Polling fermato');
    }
  },
};

async function telegramAPI(token: string, method: string, body: any): Promise<any> {
  const response = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}
