import { Router } from 'express';
import db from '../../database/connection';
import { getEnabledTools } from './tools.service';

const router = Router();

// List all tool definitions
router.get('/', (_req, res) => {
  const tools: any[] = db.prepare('SELECT * FROM tool_definitions ORDER BY category, name').all();
  res.json(tools.map(t => ({ ...t, parameters_schema: JSON.parse(t.parameters_schema || '{}') })));
});

// Get enabled tools only
router.get('/enabled', (_req, res) => {
  res.json(getEnabledTools());
});

// Toggle tool enabled/disabled
router.put('/:id/toggle', (req, res) => {
  const { enabled } = req.body;
  db.prepare('UPDATE tool_definitions SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  const tool = db.prepare('SELECT * FROM tool_definitions WHERE id = ?').get(req.params.id);
  res.json(tool);
});

export default router;
