CREATE TABLE IF NOT EXISTS schedules (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id     TEXT DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  cron_expr   TEXT DEFAULT '',
  enabled     INTEGER DEFAULT 1,
  last_run    TEXT DEFAULT '',
  next_run    TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schedules_project ON schedules(project_id);
