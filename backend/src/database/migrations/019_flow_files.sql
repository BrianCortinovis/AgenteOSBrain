-- FLOW OS file index
CREATE TABLE IF NOT EXISTS flow_files (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  category TEXT DEFAULT 'documents',
  summary TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  content_preview TEXT DEFAULT '',
  indexed_at TEXT DEFAULT (datetime('now'))
);

-- Full-text search on file metadata
CREATE VIRTUAL TABLE IF NOT EXISTS flow_files_fts USING fts5(
  name, summary, tags, content_preview,
  content='flow_files', content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS flow_files_ai AFTER INSERT ON flow_files BEGIN
  INSERT INTO flow_files_fts(rowid, name, summary, tags, content_preview)
  VALUES (new.rowid, new.name, new.summary, new.tags, new.content_preview);
END;

CREATE TRIGGER IF NOT EXISTS flow_files_ad AFTER DELETE ON flow_files BEGIN
  INSERT INTO flow_files_fts(flow_files_fts, rowid, name, summary, tags, content_preview)
  VALUES ('delete', old.rowid, old.name, old.summary, old.tags, old.content_preview);
END;

CREATE TRIGGER IF NOT EXISTS flow_files_au AFTER UPDATE ON flow_files BEGIN
  INSERT INTO flow_files_fts(flow_files_fts, rowid, name, summary, tags, content_preview)
  VALUES ('delete', old.rowid, old.name, old.summary, old.tags, old.content_preview);
  INSERT INTO flow_files_fts(rowid, name, summary, tags, content_preview)
  VALUES (new.rowid, new.name, new.summary, new.tags, new.content_preview);
END;
