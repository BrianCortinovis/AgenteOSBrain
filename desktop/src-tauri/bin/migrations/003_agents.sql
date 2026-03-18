CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT '',
  provider_id   TEXT NOT NULL DEFAULT 'openai',
  model_id      TEXT NOT NULL DEFAULT 'gpt-4o',
  system_prompt TEXT DEFAULT '',
  temperature   REAL DEFAULT 0.7,
  tools         TEXT DEFAULT '[]',
  memory_enabled INTEGER DEFAULT 0,
  fallback_provider_id TEXT DEFAULT '',
  fallback_model_id    TEXT DEFAULT '',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
