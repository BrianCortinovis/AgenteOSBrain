-- Persistent semantic memory system
CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  agent_id TEXT,
  content TEXT NOT NULL,
  summary TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  source TEXT DEFAULT '',
  importance REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_project ON memory_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance DESC);

-- Full-text search index for semantic memory
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  content,
  summary,
  tags,
  source,
  content=memory_entries,
  content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
  INSERT INTO memory_fts(rowid, content, summary, tags, source)
  VALUES (new.rowid, new.content, new.summary, new.tags, new.source);
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_entries BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, content, summary, tags, source)
  VALUES ('delete', old.rowid, old.content, old.summary, old.tags, old.source);
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, content, summary, tags, source)
  VALUES ('delete', old.rowid, old.content, old.summary, old.tags, old.source);
  INSERT INTO memory_fts(rowid, content, summary, tags, source)
  VALUES (new.rowid, new.content, new.summary, new.tags, new.source);
END;
