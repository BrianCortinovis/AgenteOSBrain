import { Router } from 'express';
import * as service from './agents.service';

const router = Router();

router.get('/projects/:id/agents', (req, res) => {
  res.json(service.getAgentsByProject(req.params.id));
});

router.post('/projects/:id/agents', (req, res) => {
  res.status(201).json(service.createAgent(req.params.id, req.body));
});

router.post('/projects/:id/agents/draft', async (req, res) => {
  try {
    const draft = await service.generateAgentDraft(req.params.id, req.body);
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/agents/:id', (req, res) => {
  const agent = service.updateAgent(req.params.id, req.body);
  if (!agent) return res.status(404).json({ error: 'Agente non trovato' });
  res.json(agent);
});

router.delete('/agents/:id', (req, res) => {
  service.deleteAgent(req.params.id);
  res.status(204).send();
});

export default router;
