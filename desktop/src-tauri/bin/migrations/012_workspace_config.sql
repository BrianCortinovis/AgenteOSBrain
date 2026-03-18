-- Workspace configuration (SOUL.md personality, identity, tool permissions)
CREATE TABLE IF NOT EXISTS workspace_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default entries
INSERT OR IGNORE INTO workspace_config (key, value) VALUES ('soul', 'Sei un assistente AI professionale, preciso e collaborativo. Rispondi sempre in italiano salvo diversa indicazione.');
INSERT OR IGNORE INTO workspace_config (key, value) VALUES ('identity', 'Agent OS Brain');
INSERT OR IGNORE INTO workspace_config (key, value) VALUES ('tool_permissions', '["web_search","read_file","write_file","shell_exec","http_request","connector_action","memory_search","memory_save"]');
