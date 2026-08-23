import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rateCards = db.prepare('SELECT * FROM rate_cards ORDER BY order_type, zone_type').all();
  const codSurcharges = db.prepare('SELECT * FROM cod_surcharges ORDER BY order_type').all();
  res.json({ rateCards, codSurcharges });
});

router.put('/', requireAuth, requireRole('admin'), (req, res) => {
  const { order_type, zone_type, base_price, rate_per_kg } = req.body;
  if (!order_type || !zone_type || base_price == null || rate_per_kg == null) {
    return res.status(400).json({ error: 'order_type, zone_type, base_price and rate_per_kg are all required' });
  }
  const existing = db.prepare('SELECT id FROM rate_cards WHERE order_type = ? AND zone_type = ?').get(order_type, zone_type);
  if (existing) {
    db.prepare('UPDATE rate_cards SET base_price = ?, rate_per_kg = ? WHERE id = ?')
      .run(base_price, rate_per_kg, existing.id);
  } else {
    db.prepare('INSERT INTO rate_cards (order_type, zone_type, base_price, rate_per_kg) VALUES (?, ?, ?, ?)')
      .run(order_type, zone_type, base_price, rate_per_kg);
  }
  res.json({ ok: true });
});

router.put('/cod-surcharge', requireAuth, requireRole('admin'), (req, res) => {
  const { order_type, surcharge_amount } = req.body;
  if (!order_type || surcharge_amount == null) {
    return res.status(400).json({ error: 'order_type and surcharge_amount are required' });
  }
  const existing = db.prepare('SELECT id FROM cod_surcharges WHERE order_type = ?').get(order_type);
  if (existing) {
    db.prepare('UPDATE cod_surcharges SET surcharge_amount = ? WHERE id = ?').run(surcharge_amount, existing.id);
  } else {
    db.prepare('INSERT INTO cod_surcharges (order_type, surcharge_amount) VALUES (?, ?)').run(order_type, surcharge_amount);
  }
  res.json({ ok: true });
});

export default router;
