import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

router.post('/register', (req, res) => {
  const { name, password, role, phone } = req.body;
  const email = normalizeEmail(req.body.email);
  const trimmedName = String(name || '').trim();

  if (!trimmedName || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  const allowedSelfRoles = ['customer', 'agent'];
  const finalRole = allowedSelfRoles.includes(role) ? role : 'customer';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
  ).run(trimmedName, email, hash, finalRole, phone ? String(phone).trim() : null);

  const user = { id: info.lastInsertRowid, name: trimmedName, email, role: finalRole };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

export default router;
