import { Router } from 'express';
import * as service from './workspace.service';

const router = Router();

// Get all workspace config
router.get('/', (_req, res) => {
  res.json(service.getAllWorkspaceConfig());
});

// Get single config key
router.get('/:key', (req, res) => {
  res.json({ key: req.params.key, value: service.getWorkspaceConfig(req.params.key) });
});

// Set config key
router.put('/:key', (req, res) => {
  const { value } = req.body;
  if (typeof value !== 'string') return res.status(400).json({ error: 'value deve essere una stringa' });
  service.setWorkspaceConfig(req.params.key, value);
  res.json({ key: req.params.key, value });
});

export default router;
