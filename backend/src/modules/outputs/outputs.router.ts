import { Router } from 'express';
import * as service from './outputs.service';

const router = Router();

router.get('/projects/:id/outputs', (req, res) => {
  res.json(service.getOutputsByProject(req.params.id));
});

router.get('/outputs/:id', (req, res) => {
  const output = service.getOutputById(req.params.id);
  if (!output) return res.status(404).json({ error: 'Output non trovato' });
  res.json(output);
});

router.delete('/outputs/:id', (req, res) => {
  service.deleteOutput(req.params.id);
  res.status(204).send();
});

export default router;
