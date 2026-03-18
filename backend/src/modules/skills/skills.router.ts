import { Router } from 'express';
import * as service from './skills.service';

const router = Router();

// List all skills
router.get('/', (_req, res) => {
  res.json(service.getAllSkills());
});

// Get enabled skills
router.get('/enabled', (_req, res) => {
  res.json(service.getEnabledSkills());
});

// Get single skill
router.get('/:id', (req, res) => {
  const skill = service.getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill non trovata' });
  res.json(skill);
});

// Install a new skill
router.post('/', (req, res) => {
  const skill = service.installSkill(req.body);
  res.status(201).json(skill);
});

// Install from SKILL.md content
router.post('/install-md', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenuto SKILL.md richiesto' });
  const parsed = service.parseSkillMd(content);
  const skill = service.installSkill(parsed);
  res.status(201).json(skill);
});

// Toggle skill enabled/disabled
router.put('/:id/toggle', (req, res) => {
  const skill = service.toggleSkill(req.params.id, req.body.enabled);
  if (!skill) return res.status(404).json({ error: 'Skill non trovata' });
  res.json(skill);
});

// Uninstall skill
router.delete('/:id', (req, res) => {
  service.uninstallSkill(req.params.id);
  res.status(204).send();
});

export default router;
