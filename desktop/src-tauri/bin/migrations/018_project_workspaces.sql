-- Add workspace columns to projects table for project builder
ALTER TABLE projects ADD COLUMN workspace_path TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN dev_server_port INTEGER DEFAULT 0;
