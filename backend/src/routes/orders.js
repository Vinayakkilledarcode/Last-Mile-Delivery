import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateCharge } from '../utils/rateEngine.js';
import { findNearestAvailableAgent } from '../utils/assignment.js';
import { notifyCustomer, statusMessages } from '../utils/notify.js';

const router = Router();

const VALID_TRANSITIONS = {
  Created: ['Picked Up', 'Failed'],
  'Picked Up': ['In Transit', 'Failed'],
  'In Transit': ['Out for Delivery', 'Failed'],
  'Out for Delivery': ['Delivered', 'Failed'],
  Delivered: [],
  Failed: ['Rescheduled'],
  Rescheduled: ['Picked Up', 'Failed'],
};

function logStatus(orderId, status, actorId, actorRole, note = null) {
  db.prepare(
    'INSERT INTO order_status_history (order_id, status, actor_id, actor_role, note) VALUES (?, ?, ?, ?, ?)'
  ).run(orderId, status, actorId, actorRole, note);
}

router.post('/quote', requireAuth, (req, res) => {
  const { pickupAddress, dropAddress, pickupArea, dropArea, length, breadth, height, actualWeight, orderType, paymentType } = req.body;
  try {
    const quote = calculateCharge({
      pickupAreaName: pickupArea || pickupAddress,
      dropAreaName: dropArea || dropAddress,
      length: Number(length),
      breadth: Number(breadth),
      height: Number(height),
      actualWeight: Number(actualWeight),
      orderType,
      paymentType,
    });
    res.json(quote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', requireAuth, (req, res) => {
  const {
    customerId, customerEmail, pickupAddress, pickupArea, dropAddress, dropArea,
    length, breadth, height, actualWeight, orderType, paymentType,
  } = req.body;

  let finalCustomerId = req.user.id;
  let finalCustomerEmail = req.user.email;

  if (req.user.role === 'admin') {
    if (customerId) {
      const cust = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(customerId, 'customer');
      if (!cust) return res.status(400).json({ error: 'Customer not found' });
      finalCustomerId = cust.id;
      finalCustomerEmail = cust.email;
    } else if (customerEmail) {
      const cust = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(customerEmail.toLowerCase(), 'customer');
      if (!cust) return res.status(400).json({ error: 'No customer found with that email' });
      finalCustomerId = cust.id;
      finalCustomerEmail = cust.email;
    } else {
      return res.status(400).json({ error: 'Admin must provide customerId or customerEmail when creating an order' });
    }
  }

  try {
    const quote = calculateCharge({
      pickupAreaName: pickupArea,
      dropAreaName: dropArea,
      length: Number(length),
      breadth: Number(breadth),
      height: Number(height),
      actualWeight: Number(actualWeight),
      orderType,
      paymentType,
    });

    const info = db.prepare(`
      INSERT INTO orders (
        customer_id, created_by_id, pickup_address, pickup_area_id, drop_address, drop_area_id,
        length_cm, breadth_cm, height_cm, actual_weight_kg, volumetric_weight_kg, billed_weight_kg,
        order_type, payment_type, zone_relation, base_charge, cod_surcharge, total_charge, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Created')
    `).run(
      finalCustomerId, req.user.id, pickupAddress, quote.pickupArea.id, dropAddress, quote.dropArea.id,
      length, breadth, height, actualWeight, quote.volumetricWeight, quote.billedWeight,
      orderType, paymentType, quote.zoneRelation, quote.baseCharge, quote.codSurcharge, quote.totalCharge
    );

    const orderId = info.lastInsertRowid;
    logStatus(orderId, 'Created', req.user.id, req.user.role, 'Order placed');

    notifyCustomer(orderId, finalCustomerEmail, 'Order Placed', `Order #${orderId} placed. ${statusMessages.Created} Total charge: ₹${quote.totalCharge}`);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', requireAuth, (req, res) => {
  const { status, zoneId, agentId } = req.query;
  let query = `
    SELECT o.*, pa.name AS pickup_area_name, da.name AS drop_area_name,
      pz.name AS pickup_zone_name, dz.name AS drop_zone_name,
      c.name AS customer_name, c.email AS customer_email,
      a.name AS agent_name
    FROM orders o
    JOIN areas pa ON pa.id = o.pickup_area_id
    JOIN areas da ON da.id = o.drop_area_id
    JOIN zones pz ON pz.id = pa.zone_id
    JOIN zones dz ON dz.id = da.zone_id
    JOIN users c ON c.id = o.customer_id
    LEFT JOIN users a ON a.id = o.agent_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'customer') {
    query += ' AND o.customer_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'agent') {
    query += ' AND o.agent_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'admin') {
    if (status) { query += ' AND o.status = ?'; params.push(status); }
    if (zoneId) { query += ' AND (pz.id = ? OR dz.id = ?)'; params.push(zoneId, zoneId); }
    if (agentId) { query += ' AND o.agent_id = ?'; params.push(agentId); }
  }

  query += ' ORDER BY o.created_at DESC';
  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

router.get('/available', requireAuth, requireRole('agent'), (req, res) => {
  const agent = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  const rows = db.prepare(`
    SELECT o.*, pa.name AS pickup_area_name, da.name AS drop_area_name,
      pz.id AS pickup_zone_id, pz.name AS pickup_zone_name, dz.name AS drop_zone_name,
      c.name AS customer_name
    FROM orders o
    JOIN areas pa ON pa.id = o.pickup_area_id
    JOIN areas da ON da.id = o.drop_area_id
    JOIN zones pz ON pz.id = pa.zone_id
    JOIN zones dz ON dz.id = da.zone_id
    JOIN users c ON c.id = o.customer_id
    WHERE o.agent_id IS NULL AND o.status IN ('Created', 'Rescheduled')
    ORDER BY o.created_at ASC
  `).all();

  const withZoneFlag = rows.map((r) => ({
    ...r,
    in_my_zone: !!agent.current_zone_id && r.pickup_zone_id === agent.current_zone_id,
  }));

  withZoneFlag.sort((a, b) => Number(b.in_my_zone) - Number(a.in_my_zone));
  res.json(withZoneFlag);
});

router.post('/:id/claim', requireAuth, requireRole('agent'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.agent_id) {
    return res.status(409).json({ error: 'This order has already been claimed by another agent' });
  }
  if (!['Created', 'Rescheduled'].includes(order.status)) {
    return res.status(400).json({ error: 'This order is not available to claim' });
  }

  db.prepare('UPDATE orders SET agent_id = ? WHERE id = ?').run(req.user.id, order.id);
  logStatus(order.id, order.status, req.user.id, req.user.role, `Claimed by agent ${req.user.name}`);
  res.json({ ok: true });
});

router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, pa.name AS pickup_area_name, da.name AS drop_area_name,
      c.name AS customer_name, c.email AS customer_email,
      a.name AS agent_name, a.phone AS agent_phone
    FROM orders o
    JOIN areas pa ON pa.id = o.pickup_area_id
    JOIN areas da ON da.id = o.drop_area_id
    JOIN users c ON c.id = o.customer_id
    LEFT JOIN users a ON a.id = o.agent_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'This is not your order' });
  }
  if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
    return res.status(403).json({ error: 'This order is not assigned to you' });
  }

  const history = db.prepare(`
    SELECT h.*, u.name AS actor_name FROM order_status_history h
    LEFT JOIN users u ON u.id = h.actor_id
    WHERE h.order_id = ? ORDER BY h.created_at ASC
  `).all(req.params.id);

  res.json({ ...order, history });
});

router.post('/:id/assign', requireAuth, requireRole('admin'), (req, res) => {
  const { agentId } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let agent;
  if (agentId) {
    agent = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(agentId, 'agent');
    if (!agent) return res.status(400).json({ error: 'Agent not found' });
  } else {
    agent = findNearestAvailableAgent(order.pickup_area_id ? db.prepare('SELECT zone_id FROM areas WHERE id = ?').get(order.pickup_area_id).zone_id : null);
    if (!agent) return res.status(409).json({ error: 'No available agents right now' });
  }

  db.prepare('UPDATE orders SET agent_id = ? WHERE id = ?').run(agent.id, order.id);
  logStatus(order.id, order.status, req.user.id, req.user.role, `Assigned to agent ${agent.name}`);
  res.json({ ok: true, agent: { id: agent.id, name: agent.name, phone: agent.phone } });
});

router.patch('/:id/status', requireAuth, requireRole('agent', 'admin'), (req, res) => {
  const { status, note } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (req.user.role === 'agent' && order.agent_id !== req.user.id) {
    return res.status(403).json({ error: 'This order is not assigned to you' });
  }

  const isAdminOverride = req.user.role === 'admin';
  if (!isAdminOverride) {
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot move order from ${order.status} to ${status}` });
    }
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  logStatus(order.id, status, req.user.id, req.user.role, note || (isAdminOverride ? 'Status overridden by admin' : null));

  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
  const message = statusMessages[status] || `Your order status changed to ${status}.`;
  notifyCustomer(order.id, customer.email, `Order #${order.id} - ${status}`, message);

  res.json({ ok: true });
});

router.post('/:id/reschedule', requireAuth, (req, res) => {
  const { newDate } = req.body;
  if (!newDate) return res.status(400).json({ error: 'newDate is required' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'This is not your order' });
  }
  if (order.status !== 'Failed') {
    return res.status(400).json({ error: 'Only failed deliveries can be rescheduled' });
  }

  const pickupZoneId = db.prepare('SELECT zone_id FROM areas WHERE id = ?').get(order.pickup_area_id).zone_id;
  const newAgent = findNearestAvailableAgent(pickupZoneId, order.agent_id);

  db.prepare('UPDATE orders SET status = ?, reschedule_date = ?, agent_id = ? WHERE id = ?')
    .run('Rescheduled', newDate, newAgent ? newAgent.id : null, order.id);

  logStatus(order.id, 'Rescheduled', req.user.id, req.user.role, `Rescheduled for ${newDate}${newAgent ? `, reassigned to ${newAgent.name}` : ', no agent available yet'}`);

  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
  notifyCustomer(order.id, customer.email, `Order #${order.id} - Rescheduled`, `Your delivery has been rescheduled for ${newDate}.`);

  res.json({ ok: true, newAgent: newAgent ? { id: newAgent.id, name: newAgent.name, phone: newAgent.phone } : null });
});

export default router;
