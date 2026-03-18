import { Router } from 'express';
import * as service from './memory.service';

const router = Router();

// Search memories
router.get('/search', (req, res) => {
  const query = String(req.query.q || '');
  const projectId = req.query.project_id as string | undefined;
  const agentId = req.query.agent_id as string | undefined;
  const limit = parseInt(String(req.query.limit || '10'), 10);
  if (!query) return res.status(400).json({ error: 'Parametro q obbligatorio' });
  res.json(service.searchMemory(query, { project_id: projectId, agent_id: agentId, limit }));
});

// Get memories by project
router.get('/project/:projectId', (req, res) => {
  res.json(service.getMemoriesByProject(req.params.projectId));
});

// Get memories by agent
router.get('/agent/:agentId', (req, res) => {
  res.json(service.getMemoriesByAgent(req.params.agentId));
});

// Save a memory
router.post('/', (req, res) => {
  const entry = service.saveMemory(req.body);
  res.status(201).json(entry);
});

// Delete a memory
router.delete('/:id', (req, res) => {
  service.deleteMemory(req.params.id);
  res.status(204).send();
});

// Compact memories for a project
router.post('/compact/:projectId', (req, res) => {
  const deleted = service.compactMemories(req.params.projectId, req.body.maxEntries || 100);
  res.json({ deleted });
});

export default router;
