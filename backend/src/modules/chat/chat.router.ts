import { Router } from 'express';
import * as service from './chat.service';

const router = Router();

router.get('/projects/:id/chat', (req, res) => {
  res.json(service.getChatHistory(req.params.id));
});

router.post('/projects/:id/chat', async (req, res) => {
  const { message, provider_id, model_id } = req.body;
  if (!message) return res.status(400).json({ error: 'Messaggio richiesto' });
  try {
    const response = await service.sendChatMessage(req.params.id, message, provider_id, model_id);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id/chat', (req, res) => {
  service.clearChatHistory(req.params.id);
  res.status(204).send();
});

export default router;
