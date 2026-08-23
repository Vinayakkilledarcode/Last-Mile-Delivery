import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

function upsertUser(name, email, password, role, phone) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role, phone, is_available) VALUES (?, ?, ?, ?, ?, 1)')
    .run(name, email, hash, role, phone);
  return info.lastInsertRowid;
}

function upsertZone(name) {
  const existing = db.prepare('SELECT id FROM zones WHERE name = ?').get(name);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO zones (name) VALUES (?)').run(name);
  return info.lastInsertRowid;
}

function upsertArea(name, zoneId) {
  const existing = db.prepare('SELECT id FROM areas WHERE name = ?').get(name);
  if (existing) return existing.id;
  const info = db.prepare('INSERT INTO areas (name, zone_id) VALUES (?, ?)').run(name, zoneId);
  return info.lastInsertRowid;
}

function upsertRateCard(orderType, zoneType, basePrice, ratePerKg) {
  const existing = db.prepare('SELECT id FROM rate_cards WHERE order_type = ? AND zone_type = ?').get(orderType, zoneType);
  if (existing) return;
  db.prepare('INSERT INTO rate_cards (order_type, zone_type, base_price, rate_per_kg) VALUES (?, ?, ?, ?)')
    .run(orderType, zoneType, basePrice, ratePerKg);
}

function upsertCodSurcharge(orderType, amount) {
  const existing = db.prepare('SELECT id FROM cod_surcharges WHERE order_type = ?').get(orderType);
  if (existing) return;
  db.prepare('INSERT INTO cod_surcharges (order_type, surcharge_amount) VALUES (?, ?)').run(orderType, amount);
}

const adminId = upsertUser('Ops Admin', 'admin@lastmile.test', 'admin123', 'admin', '9000000001');
upsertUser('Priya Sharma', 'priya@lastmile.test', 'customer123', 'customer', '9000000002');
const agent1 = upsertUser('Ravi Kumar', 'ravi.agent@lastmile.test', 'agent123', 'agent', '9000000003');
const agent2 = upsertUser('Meera Nair', 'meera.agent@lastmile.test', 'agent123', 'agent', '9000000004');

const northZone = upsertZone('North Zone');
const southZone = upsertZone('South Zone');

upsertArea('Anna Nagar', northZone);
upsertArea('Ambattur', northZone);
upsertArea('Tambaram', southZone);
upsertArea('Velachery', southZone);

db.prepare('UPDATE users SET current_zone_id = ? WHERE id = ?').run(northZone, agent1);
db.prepare('UPDATE users SET current_zone_id = ? WHERE id = ?').run(southZone, agent2);

upsertRateCard('B2C', 'intra', 30, 12);
upsertRateCard('B2C', 'inter', 50, 18);
upsertRateCard('B2B', 'intra', 60, 9);
upsertRateCard('B2B', 'inter', 90, 14);

upsertCodSurcharge('B2C', 20);
upsertCodSurcharge('B2B', 35);

console.log('Seed complete.');
console.log('Admin login: admin@lastmile.test / admin123');
console.log('Customer login: priya@lastmile.test / customer123');
console.log('Agent logins: ravi.agent@lastmile.test / agent123, meera.agent@lastmile.test / agent123');
