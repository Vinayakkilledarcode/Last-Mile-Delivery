import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const agents = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.is_available, u.current_zone_id, z.name AS zone_name,
      (SELECT COUNT(*) FROM orders o WHERE o.agent_id = u.id AND o.status NOT IN ('Delivered','Failed')) AS active_orders
    FROM users u
    LEFT JOIN zones z ON z.id = u.current_zone_id
    WHERE u.role = 'agent'
    ORDER BY u.name
  `).all();
  res.json(agents);
});

router.patch('/:id/availability', requireAuth, (req, res) => {
  const { is_available, current_zone_id } = req.body;
  const agent = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(req.params.id, 'agent');
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  if (req.user.role !== 'admin' && req.user.id !== agent.id) {
    return res.status(403).json({ error: 'You can only update your own availability' });
  }

  const fields = [];
  const values = [];
  if (is_available !== undefined) { fields.push('is_available = ?'); values.push(is_available ? 1 : 0); }
  if (current_zone_id !== undefined) { fields.push('current_zone_id = ?'); values.push(current_zone_id); }
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

export default router;
