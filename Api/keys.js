import { kv } from '@vercel/kv';

const ADMIN = process.env.ADMIN_PASSWORD || 'admin123';

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'EZT-';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) s += '-';
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Pass');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const adminPass = req.headers['x-admin-pass'] || req.query.admin;
  if (adminPass !== ADMIN) {
    return res.status(401).json({ status: 'error', message: 'invalid admin password' });
  }

  // ── GENERATE KEYS ──
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const days = parseInt(body.days) || 1;
    const count = Math.min(parseInt(body.count) || 1, 50);
    const note = String(body.note || '').slice(0, 100);

    const now = Date.now();
    const expiresAt = now + days * 24 * 60 * 60 * 1000;

    const created = [];
    for (let i = 0; i < count; i++) {
      const key = generateKey();
      const data = {
        key, days, note,
        createdAt: now,
        expiresAt,
        active: true,
        usedCount: 0
      };
      await kv.set('key:' + key, data);
      await kv.sadd('all_keys', key);
      created.push(data);
    }

    return res.status(200).json({ status: 'success', count: created.length, keys: created });
  }

  // ── LIST KEYS ──
  const all = await kv.smembers('all_keys');
  const list = [];
  for (const k of all || []) {
    const d = await kv.get('key:' + k);
    if (d) list.push(d);
  }
  list.sort((a, b) => b.createdAt - a.createdAt);

  return res.status(200).json({
    status: 'success',
    total: list.length,
    keys: list
  });
}
