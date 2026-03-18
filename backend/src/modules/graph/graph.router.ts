import { Router } from 'express';
import * as service from './graph.service';

const router = Router();

router.get('/projects/:id/graph', (req, res) => {
  res.json(service.getGraph(req.params.id));
});

router.put('/projects/:id/graph', (req, res) => {
  res.json(service.saveGraph(req.params.id, req.body));
});

router.post('/projects/:id/nodes', (req, res) => {
  res.status(201).json(service.createNode(req.params.id, req.body));
});

router.put('/nodes/:id', (req, res) => {
  const node = service.updateNode(req.params.id, req.body);
  if (!node) return res.status(404).json({ error: 'Nodo non trovato' });
  res.json(node);
});

router.delete('/nodes/:id', (req, res) => {
  service.deleteNode(req.params.id);
  res.status(204).send();
});

router.post('/projects/:id/edges', (req, res) => {
  res.status(201).json(service.createEdge(req.params.id, req.body));
});

router.delete('/edges/:id', (req, res) => {
  service.deleteEdge(req.params.id);
  res.status(204).send();
});

export default router;
