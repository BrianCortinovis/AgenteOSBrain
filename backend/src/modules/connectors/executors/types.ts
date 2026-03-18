export interface ConnectorExecutor {
  id: string;
  /** Execute an action on this connector */
  execute(action: string, params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult>;
  /** Start listening for incoming events (optional) */
  listen?(config: Record<string, any>, callback: (event: ConnectorEvent) => void): Promise<void>;
  /** Stop listening */
  stopListening?(): void;
}

export interface ConnectorResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export interface ConnectorEvent {
  connector_id: string;
  type: string; // 'message', 'notification', etc.
  data: any;
  timestamp: string;
}
