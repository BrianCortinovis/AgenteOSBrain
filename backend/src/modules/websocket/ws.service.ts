import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;

// Channels: clients subscribe by sending { type: 'subscribe', channel: 'execution:projectId' }
const subscriptions = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connesso');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.channel) {
          if (!subscriptions.has(msg.channel)) {
            subscriptions.set(msg.channel, new Set());
          }
          subscriptions.get(msg.channel)!.add(ws);
          ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        }
        if (msg.type === 'unsubscribe' && msg.channel) {
          subscriptions.get(msg.channel)?.delete(ws);
        }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });

    ws.on('close', () => {
      // Remove from all subscriptions
      for (const subs of subscriptions.values()) {
        subs.delete(ws);
      }
    });

    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  });

  console.log('[WS] WebSocket server avviato su /ws');
}

/**
 * Broadcast a message to all clients subscribed to a channel.
 */
export function broadcast(channel: string, data: any): void {
  const subs = subscriptions.get(channel);
  if (!subs || subs.size === 0) return;

  const message = JSON.stringify({ channel, ...data });
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Broadcast to all connected clients (no channel filter).
 */
export function broadcastAll(data: any): void {
  if (!wss) return;
  const message = JSON.stringify(data);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Get connected client count.
 */
export function getConnectedClients(): number {
  return wss?.clients.size || 0;
}
