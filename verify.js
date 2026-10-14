import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = req.query.key;
  if (!key) {
    return res.status(400).json({ status: 'error', message: 'key required' });
  }

  const info = await kv.get('key:' + key);
  if (!info) {
    return res.status(404).json({ status: 'error', valid: false, message: 'key not found' });
  }

  const now = Date.now();
  if (now > info.expiresAt) {
    return res.status(200).json({
      status: 'success',
      valid: false,
      reason: 'expired',
      expiresAt: info.expiresAt
    });
  }

  return res.status(200).json({
    status: 'success',
    valid: true,
    key: info.key,
    days: info.days,
    note: info.note,
    createdAt: info.createdAt,
    expiresAt: info.expiresAt,
    remainingMs: info.expiresAt - now
  });
}
