-- Migrazione: tabella connector_instances per configurazioni utente
-- La tabella esistente 006_connectors.sql era legata ai progetti.
-- Questa è una tabella globale per istanze di connettori configurati dall'utente.

CREATE TABLE IF NOT EXISTS connector_instances_v2 (
  id            TEXT PRIMARY KEY,
  connector_id  TEXT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT,
  config        TEXT DEFAULT '{}',
  status        TEXT DEFAULT 'disconnected',
  last_tested   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connector_instances_v2_connector ON connector_instances_v2(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_instances_v2_status ON connector_instances_v2(status);
