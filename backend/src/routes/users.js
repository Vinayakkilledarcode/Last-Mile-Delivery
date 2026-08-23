import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, phone, current_zone_id, is_available FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.get('/customers', requireAuth, requireRole('admin'), (req, res) => {
  const search = req.query.search ? `%${req.query.search.toLowerCase()}%` : null;
  const rows = search
    ? db.prepare('SELECT id, name, email, phone FROM users WHERE role = ? AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)').all('customer', search, search)
    : db.prepare('SELECT id, name, email, phone FROM users WHERE role = ? ORDER BY name').all('customer');
  res.json(rows);
});

export default router;
