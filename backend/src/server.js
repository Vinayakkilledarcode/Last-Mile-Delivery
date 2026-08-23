import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './db.js';

import authRoutes from './routes/auth.js';
import zoneRoutes from './routes/zones.js';
import rateCardRoutes from './routes/rateCards.js';
import orderRoutes from './routes/orders.js';
import agentRoutes from './routes/agents.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/rate-cards', rateCardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Last-Mile Delivery Tracker API running on http://localhost:${PORT}`);
});
