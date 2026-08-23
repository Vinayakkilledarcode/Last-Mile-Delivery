import nodemailer from 'nodemailer';
import db from '../db.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function notifyCustomer(orderId, customerEmail, subject, message) {
  db.prepare('INSERT INTO notifications (order_id, channel, message) VALUES (?, ?, ?)')
    .run(orderId, 'email', `${subject}: ${message}`);

  const t = getTransporter();
  if (!t) {
    console.log(`[email skipped, no SMTP configured] to=${customerEmail} subject="${subject}" body="${message}"`);
    return;
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'notifications@lastmile-tracker.local',
      to: customerEmail,
      subject,
      text: message,
    });
  } catch (err) {
    console.log(`[email failed] ${err.message}`);
  }
}

export const statusMessages = {
  Created: 'Your order has been placed and is awaiting pickup.',
  'Picked Up': 'Your package has been picked up by our delivery agent.',
  'In Transit': 'Your package is on its way to the destination hub.',
  'Out for Delivery': 'Your package is out for delivery today.',
  Delivered: 'Your package has been delivered successfully.',
  Failed: 'We were unable to deliver your package. You can reschedule from your dashboard.',
  Rescheduled: 'Your delivery has been rescheduled and a new agent has been assigned.',
};
