-- Tool definitions registry
CREATE TABLE IF NOT EXISTS tool_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'general',
  parameters_schema TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default built-in tools
INSERT OR IGNORE INTO tool_definitions (id, name, description, category, parameters_schema) VALUES
  ('tool_web_search', 'web_search', 'Cerca informazioni sul web', 'search', '{"type":"object","properties":{"query":{"type":"string","description":"Query di ricerca"}},"required":["query"]}'),
  ('tool_read_file', 'read_file', 'Leggi il contenuto di un file', 'filesystem', '{"type":"object","properties":{"path":{"type":"string","description":"Percorso del file"}},"required":["path"]}'),
  ('tool_write_file', 'write_file', 'Scrivi contenuto in un file', 'filesystem', '{"type":"object","properties":{"path":{"type":"string","description":"Percorso del file"},"content":{"type":"string","description":"Contenuto da scrivere"}},"required":["path","content"]}'),
  ('tool_shell_exec', 'shell_exec', 'Esegui un comando shell', 'system', '{"type":"object","properties":{"command":{"type":"string","description":"Comando da eseguire"},"timeout":{"type":"number","description":"Timeout in ms","default":30000}},"required":["command"]}'),
  ('tool_http_request', 'http_request', 'Esegui una richiesta HTTP', 'network', '{"type":"object","properties":{"url":{"type":"string","description":"URL della richiesta"},"method":{"type":"string","enum":["GET","POST","PUT","DELETE"],"default":"GET"},"headers":{"type":"object","description":"Headers HTTP"},"body":{"type":"string","description":"Body della richiesta"}},"required":["url"]}'),
  ('tool_memory_search', 'memory_search', 'Cerca nella memoria persistente', 'memory', '{"type":"object","properties":{"query":{"type":"string","description":"Query di ricerca nella memoria"},"limit":{"type":"number","default":5}},"required":["query"]}'),
  ('tool_memory_save', 'memory_save', 'Salva informazioni nella memoria persistente', 'memory', '{"type":"object","properties":{"content":{"type":"string","description":"Contenuto da memorizzare"},"tags":{"type":"array","items":{"type":"string"},"description":"Tag per categorizzare"}},"required":["content"]}'),
  ('tool_connector_action', 'connector_action', 'Esegui un''azione tramite un connettore configurato', 'connector', '{"type":"object","properties":{"connector_id":{"type":"string","description":"ID del connettore"},"action":{"type":"string","description":"Azione da eseguire"},"params":{"type":"object","description":"Parametri dell''azione"}},"required":["connector_id","action"]}');
