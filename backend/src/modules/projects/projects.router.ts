import { Router } from 'express';
import * as service from './projects.service';

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

export default router;
