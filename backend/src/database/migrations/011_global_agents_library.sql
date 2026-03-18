INSERT INTO projects (id, name, description, status, created_at, updated_at)
SELECT '__global_agents__', 'Libreria Agenti', 'Progetto tecnico interno per gli agenti condivisi', 'bozza', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = '__global_agents__');

ALTER TABLE agents ADD COLUMN scope TEXT DEFAULT 'project';
ALTER TABLE agents ADD COLUMN source_project_id TEXT DEFAULT '';

UPDATE agents
SET source_project_id = project_id
WHERE source_project_id = '';

UPDATE agents
SET scope = 'global',
    project_id = '__global_agents__'
WHERE scope = 'project';
