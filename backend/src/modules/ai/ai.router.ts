import { Router } from 'express';
import { assistField } from './ai.service';

const router = Router();

router.post('/assist', async (req, res) => {
  try {
    const result = await assistField(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
