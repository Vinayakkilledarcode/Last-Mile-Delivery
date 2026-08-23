import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const zones = db.prepare('SELECT * FROM zones ORDER BY name').all();
  const areas = db.prepare('SELECT * FROM areas ORDER BY name').all();
  const zonesWithAreas = zones.map((z) => ({
    ...z,
    areas: areas.filter((a) => a.zone_id === z.id),
  }));
  res.json(zonesWithAreas);
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Zone name is required' });
  try {
    const info = db.prepare('INSERT INTO zones (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (err) {
    res.status(409).json({ error: 'A zone with this name already exists' });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM areas WHERE zone_id = ?').run(req.params.id);
  db.prepare('DELETE FROM zones WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/areas', requireAuth, requireRole('admin'), (req, res) => {
  const { name } = req.body;
  const zoneId = req.params.id;
  if (!name) return res.status(400).json({ error: 'Area name is required' });

  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(zoneId);
  if (!zone) return res.status(404).json({ error: 'Zone not found' });

  try {
    const info = db.prepare('INSERT INTO areas (name, zone_id) VALUES (?, ?)').run(name.trim(), zoneId);
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), zone_id: Number(zoneId) });
  } catch (err) {
    res.status(409).json({ error: 'This area is already mapped to a zone' });
  }
});

router.delete('/areas/:areaId', requireAuth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM areas WHERE id = ?').run(req.params.areaId);
  res.json({ ok: true });
});

export default router;
