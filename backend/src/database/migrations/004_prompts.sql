CREATE TABLE IF NOT EXISTS prompts (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL DEFAULT 'global',
  scope_id    TEXT DEFAULT '',
  name        TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  category    TEXT DEFAULT 'generale',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prompts_scope ON prompts(scope, scope_id);
