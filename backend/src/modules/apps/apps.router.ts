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

// Delete app
router.delete('/:name', (req, res) => {
  try {
    const appPath = path.join(config.appsDir, req.params.name);
    const fs = require('fs');
    if (!fs.existsSync(appPath)) return res.status(404).json({ error: 'App non trovata' });
    service.stopApp(req.params.name);
    fs.rmSync(appPath, { recursive: true, force: true });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate app
router.post('/:name/duplicate', (req, res) => {
  try {
    const fs = require('fs');
    const srcPath = path.join(config.appsDir, req.params.name);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'App non trovata' });
    const newName = `${req.params.name}_copy_${Date.now()}`;
    const destPath = path.join(config.appsDir, newName);
    fs.cpSync(srcPath, destPath, { recursive: true });
    res.json({ name: newName, path: destPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve app files statically (for iframe preview)
router.use('/:name/serve', (req, res, next) => {
  const appPath = path.join(config.appsDir, req.params.name);
  express.static(appPath)(req, res, next);
});

export default router;
