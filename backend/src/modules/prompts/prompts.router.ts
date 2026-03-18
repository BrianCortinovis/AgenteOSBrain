import { Router } from 'express';
import * as service from './prompts.service';

const router = Router();

router.get('/', (req, res) => {
  const { scope, scope_id } = req.query;
  res.json(service.getPrompts(scope as string, scope_id as string));
});

router.get('/:id', (req, res) => {
  const prompt = service.getPromptById(req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Prompt non trovato' });
  res.json(prompt);
});

router.post('/', (req, res) => {
  res.status(201).json(service.createPrompt(req.body));
});

router.put('/:id', (req, res) => {
  const prompt = service.updatePrompt(req.params.id, req.body);
  if (!prompt) return res.status(404).json({ error: 'Prompt non trovato' });
  res.json(prompt);
});

router.delete('/:id', (req, res) => {
  service.deletePrompt(req.params.id);
  res.status(204).send();
});

export default router;
