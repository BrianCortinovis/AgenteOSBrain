import { ConnectorExecutor, ConnectorResult, ConnectorEvent } from './types';
import { telegramExecutor } from './telegram.executor';
import { slackExecutor } from './slack.executor';
import { gmailExecutor } from './gmail.executor';
import { webhookExecutor } from './webhook.executor';

const executors = new Map<string, ConnectorExecutor>();

// Register built-in executors
executors.set('telegram', telegramExecutor);
executors.set('slack', slackExecutor);
executors.set('gmail', gmailExecutor);
executors.set('smtp', gmailExecutor); // Reuse gmail executor for SMTP
executors.set('webhook', webhookExecutor);
executors.set('rest-api', webhookExecutor); // REST API uses webhook executor

export function getConnectorExecutor(connectorId: string): ConnectorExecutor | undefined {
  return executors.get(connectorId);
}

export function hasExecutor(connectorId: string): boolean {
  return executors.has(connectorId);
}

export function getAvailableExecutors(): string[] {
  return Array.from(executors.keys());
}

/**
 * Execute a connector action with the appropriate executor.
 */
export async function executeConnectorAction(
  connectorId: string,
  action: string,
  params: Record<string, any>,
  config: Record<string, any>,
): Promise<ConnectorResult> {
  const executor = executors.get(connectorId);
  if (!executor) {
    return {
      success: false,
      error: `Nessun executor disponibile per il connettore "${connectorId}". Connettori supportati: ${getAvailableExecutors().join(', ')}`,
    };
  }
  return executor.execute(action, params, config);
}

// Event listeners for incoming messages
const eventListeners: ((event: ConnectorEvent) => void)[] = [];

export function onConnectorEvent(listener: (event: ConnectorEvent) => void): () => void {
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx >= 0) eventListeners.splice(idx, 1);
  };
}

/**
 * Start listening on all configured connectors that support it.
 */
export function startConnectorListeners(configs: { connectorId: string; config: Record<string, any> }[]): void {
  for (const { connectorId, config } of configs) {
    const executor = executors.get(connectorId);
    if (executor?.listen) {
      executor.listen(config, (event) => {
        for (const listener of eventListeners) {
          listener(event);
        }
      });
      console.log(`[Connectors] Listener avviato per: ${connectorId}`);
    }
  }
}

/**
 * Stop all connector listeners.
 */
export function stopAllConnectorListeners(): void {
  for (const executor of executors.values()) {
    if (executor.stopListening) executor.stopListening();
  }
}
