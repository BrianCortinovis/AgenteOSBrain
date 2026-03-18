CREATE TABLE IF NOT EXISTS outputs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id     TEXT DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'log',
  title       TEXT DEFAULT '',
  content     TEXT DEFAULT '',
  metadata    TEXT DEFAULT '{}',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_outputs_project ON outputs(project_id);
