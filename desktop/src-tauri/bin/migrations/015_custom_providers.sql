-- Custom OpenAI-compatible providers (OpenClaw-style)
CREATE TABLE IF NOT EXISTS custom_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT DEFAULT '',
  default_model TEXT DEFAULT '',
  type TEXT DEFAULT 'cloud',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Approval queue for dangerous commands
CREATE TABLE IF NOT EXISTS command_approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  node_id TEXT,
  command TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT DEFAULT ''
);

-- Skills directory
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  version TEXT DEFAULT '1.0.0',
  author TEXT DEFAULT '',
  content TEXT NOT NULL,
  config_schema TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  installed_at TEXT DEFAULT (datetime('now'))
);
