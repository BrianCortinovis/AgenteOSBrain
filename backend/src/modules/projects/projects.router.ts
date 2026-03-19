import { Router } from 'express';
import * as service from './projects.service';
import { getWorkspaceInfo } from '../../orchestrator/engine';
import { executeTool } from '../tools/tool-executors';
import fs from 'fs';

const router = Router();

router.get('/', (_req, res) => {
  res.json(service.getAllProjects());
});

router.get('/:id', (req, res) => {
  const project = service.getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  res.json(project);
});

router.post('/', (req, res) => {
  const project = service.createProject(req.body);
  res.status(201).json(project);
});

router.put('/:id', (req, res) => {
  const project = service.updateProject(req.params.id, req.body);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  res.json(project);
});

router.delete('/:id', (req, res) => {
  service.deleteProject(req.params.id);
  res.status(204).send();
});

router.post('/:id/duplicate', (req, res) => {
  const project = service.duplicateProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  res.status(201).json(project);
});

// ─── Workspace info (for project builder) ──────────────────────
router.get('/:id/workspace', async (req, res) => {
  try {
    const project: any = service.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

    const workspace = getWorkspaceInfo(req.params.id);
    const workspacePath = workspace?.path || project.workspace_path || '';

    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return res.json({
        workspace_path: workspacePath,
        project_type: project.project_type || '',
        dev_server_port: project.dev_server_port || 0,
        dev_server_url: '',
        file_tree: '',
        exists: false,
      });
    }

    // Generate file tree
    const treeResult = await executeTool('list_project_files', { path: workspacePath, depth: 4 }, {
      projectId: req.params.id,
    });

    const devPort = project.dev_server_port || 0;
    res.json({
      workspace_path: workspacePath,
      project_type: workspace?.type || project.project_type || '',
      dev_server_port: devPort,
      dev_server_url: devPort > 0 ? `http://localhost:${devPort}` : '',
      file_tree: treeResult.output,
      exists: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
