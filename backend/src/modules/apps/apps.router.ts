import { Router } from 'express';
import express from 'express';
import path from 'path';
import { config } from '../../config';
import * as service from './apps.service';

const router = Router();

router.get('/', (_req, res) => {
  try {
    res.json(service.listApps());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name', async (req, res) => {
  try {
    const info = await service.getAppInfo(req.params.name);
    if (!info) return res.status(404).json({ error: 'App non trovata' });
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/start', (req, res) => {
  try {
    const result = service.startApp(req.params.name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/stop', (req, res) => {
  try {
    service.stopApp(req.params.name);
    res.json({ stopped: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/running', (_req, res) => {
  res.json(service.getRunningApps());
});

// Serve app files statically (for iframe preview)
router.use('/:name/serve', (req, res, next) => {
  const appPath = path.join(config.appsDir, req.params.name);
  express.static(appPath)(req, res, next);
});

export default router;
