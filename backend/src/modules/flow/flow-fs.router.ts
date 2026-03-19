import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';
import * as flowFS from './flow-fs.service';

const router = Router();

// List directory
router.get('/fs', (req, res) => {
  try {
    const dirPath = (req.query.path as string) || config.flowRoot;
    res.json({ path: dirPath, entries: flowFS.listDirectory(dirPath) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recent files
router.get('/fs/recent', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(flowFS.getRecentFiles(limit));
});

// Search files
router.get('/fs/search', (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.json([]);
  res.json(flowFS.searchFiles(query));
});

// Create directory
router.post('/fs/mkdir', (req, res) => {
  try {
    flowFS.createDirectory(req.body.path);
    res.json({ created: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Move file
router.post('/fs/move', (req, res) => {
  try {
    flowFS.moveFile(req.body.from, req.body.to);
    res.json({ moved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file
router.post('/fs/delete', (req, res) => {
  try {
    flowFS.deleteFile(req.body.path);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload file to specific directory
router.post('/fs/upload', (req, res) => {
  try {
    const { file_name, file_content, target_dir } = req.body;
    if (!file_name || !file_content) return res.status(400).json({ error: 'file_name e file_content richiesti' });

    const targetPath = target_dir || config.flowDocsDir;
    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

    const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(targetPath, safeName);
    fs.writeFileSync(filePath, file_content, 'utf-8');

    // Index
    flowFS.indexFile(filePath);

    res.json({ path: filePath, name: safeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file content (for AI analysis)
router.get('/fs/read', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'path richiesto' });
    const content = await flowFS.readFileForAI(filePath);
    res.json({ content, path: filePath, name: path.basename(filePath) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Scan and reindex
router.post('/fs/reindex', (_req, res) => {
  try {
    flowFS.scanAndIndex();
    res.json({ reindexed: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
