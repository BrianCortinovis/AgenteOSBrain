CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT DEFAULT '',
  state       TEXT DEFAULT 'bozza',
  color       TEXT DEFAULT '',
  config      TEXT DEFAULT '{}',
  position_x  REAL NOT NULL DEFAULT 0,
  position_y  REAL NOT NULL DEFAULT 0,
  width       REAL DEFAULT 200,
  height      REAL DEFAULT 80,
  agent_id    TEXT,
  provider_id TEXT DEFAULT '',
  model_id    TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id);

CREATE TABLE IF NOT EXISTS edges (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label       TEXT DEFAULT '',
  condition   TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);
