CREATE TABLE IF NOT EXISTS connector_instances (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  config        TEXT DEFAULT '{}',
  enabled       INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_connectors_project ON connector_instances(project_id);
