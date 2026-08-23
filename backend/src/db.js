import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/lastmile.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','agent','admin')),
  phone TEXT,
  current_zone_id INTEGER,
  is_available INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_zone_id) REFERENCES zones(id)
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  zone_id INTEGER NOT NULL,
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

CREATE TABLE IF NOT EXISTS rate_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_type TEXT NOT NULL CHECK(order_type IN ('B2B','B2C')),
  zone_type TEXT NOT NULL CHECK(zone_type IN ('intra','inter')),
  base_price REAL NOT NULL,
  rate_per_kg REAL NOT NULL,
  UNIQUE(order_type, zone_type)
);

CREATE TABLE IF NOT EXISTS cod_surcharges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_type TEXT UNIQUE NOT NULL CHECK(order_type IN ('B2B','B2C')),
  surcharge_amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  created_by_id INTEGER NOT NULL,
  pickup_address TEXT NOT NULL,
  pickup_area_id INTEGER NOT NULL,
  drop_address TEXT NOT NULL,
  drop_area_id INTEGER NOT NULL,
  length_cm REAL NOT NULL,
  breadth_cm REAL NOT NULL,
  height_cm REAL NOT NULL,
  actual_weight_kg REAL NOT NULL,
  volumetric_weight_kg REAL NOT NULL,
  billed_weight_kg REAL NOT NULL,
  order_type TEXT NOT NULL CHECK(order_type IN ('B2B','B2C')),
  payment_type TEXT NOT NULL CHECK(payment_type IN ('Prepaid','COD')),
  zone_relation TEXT NOT NULL CHECK(zone_relation IN ('intra','inter')),
  base_charge REAL NOT NULL,
  cod_surcharge REAL NOT NULL DEFAULT 0,
  total_charge REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Created',
  agent_id INTEGER,
  reschedule_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (created_by_id) REFERENCES users(id),
  FOREIGN KEY (pickup_area_id) REFERENCES areas(id),
  FOREIGN KEY (drop_area_id) REFERENCES areas(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  actor_id INTEGER,
  actor_role TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  message TEXT NOT NULL,
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
`);

export default db;
