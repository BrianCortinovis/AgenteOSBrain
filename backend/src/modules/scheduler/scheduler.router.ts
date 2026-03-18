import { Router } from 'express';
import * as service from './scheduler.service';

const router = Router();

router.get('/projects/:id/schedules', (req, res) => {
  res.json(service.getSchedulesByProject(req.params.id));
});

router.post('/projects/:id/schedules', (req, res) => {
  res.status(201).json(service.createSchedule(req.params.id, req.body));
});

router.put('/schedules/:id', (req, res) => {
  const schedule = service.updateSchedule(req.params.id, req.body);
  if (!schedule) return res.status(404).json({ error: 'Automazione non trovata' });
  res.json(schedule);
});

router.delete('/schedules/:id', (req, res) => {
  service.deleteSchedule(req.params.id);
  res.status(204).send();
});

router.post('/schedules/:id/trigger', (req, res) => {
  const schedule = service.triggerSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Automazione non trovata' });
  res.json(schedule);
});

export default router;
