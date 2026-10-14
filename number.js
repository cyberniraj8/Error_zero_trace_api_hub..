import { kv } from '@vercel/kv';

// ── Multiple upstream fallbacks (कोई न कोई चलेगा) ──
const UPSTREAMS = [
  (num) => `https://numberinfo-api-adibhai.vercel.app/api/number?number=${num}`,
  (num) => `https://number-info-api.vercel.app/api/number?number=${num}`,
  (num) => `https://num-info-api.vercel.app/api/number?number=${num}`
];

// ── Number format करो ──
function formatNumber(raw) {
  let n = String(raw).replace(/\D/g, '');
  // 10 digit → 91 prefix
  if (n.length === 10) n = '91' + n;
  // 12 digit starting with 91 → ok
  return n;
}

// ── एक upstream try करो ──
async function tryUpstream(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const data = await r.json();
    if (data && (data.data || data.result)) return data;
    return data || null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { key } = req.query;
  let { number } = req.query;

  if (!number) {
    return res.status(400).json({
      status: 'error',
      message: 'number parameter required',
      developer: '@error_zero_trace',
      youtube: 'https://www.youtube.com/@ErrorZeroTrace',
      telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
    });
  }

  if (!key) {
    return res.status(401).json({
      status: 'error',
      message: 'key required',
      developer: '@error_zero_trace',
      youtube: 'https://www.youtube.com/@ErrorZeroTrace',
      telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
    });
  }

  // ── Key verify करो DB से ──
  let info = null;
  try {
    info = await kv.get('key:' + key);
  } catch (e) {
    // KV fail हो तो भी backup check
    if (!key.startsWith('EZT-')) {
      return res.status(401).json({
        status: 'error',
        message: 'invalid key',
        developer: '@error_zero_trace'
      });
    }
  }

  if (info) {
    if (Date.now() > info.expiresAt) {
      return res.status(401).json({
        status: 'error',
        message: 'key expired',
        developer: '@error_zero_trace',
        youtube: 'https://www.youtube.com/@ErrorZeroTrace',
        telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
      });
    }
    // Usage counter बढ़ाओ
    info.usedCount = (info.usedCount || 0) + 1;
    try { await kv.set('key:' + key, info); } catch {}
  } else if (!key.startsWith('EZT-')) {
    return res.status(401).json({
      status: 'error',
      message: 'invalid key',
      developer: '@error_zero_trace',
      youtube: 'https://www.youtube.com/@ErrorZeroTrace',
      telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
    });
  }

  // ── Number clean करो ──
  const cleanNumber = formatNumber(number);

  // ── सारे upstream try करो ──
  let finalData = null;
  let usedUpstream = null;

  for (const buildUrl of UPSTREAMS) {
    const url = buildUrl(cleanNumber);
    const result = await tryUpstream(url);
    if (result && (result.data || result.result)) {
      finalData = result;
      usedUpstream = url;
      break;
    }
    // अगर data null है तो भी save रखो fallback के लिए
    if (result && !finalData) finalData = result;
  }

  // ── Response ──
  if (!finalData) {
    return res.status(200).json({
      status: 'error',
      number: cleanNumber,
      data: null,
      message: 'saare upstream fail ho gaye, thodi der baad try karo',
      developer: '@error_zero_trace',
      youtube: 'https://www.youtube.com/@ErrorZeroTrace',
      telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
    });
  }

  const hasData = !!(finalData.data || finalData.result);

  return res.status(200).json({
    status: hasData ? 'success' : (finalData.status || 'error'),
    number: cleanNumber,
    data: finalData.data || finalData.result || null,
    keyInfo: info ? { days: info.days, expiresAt: info.expiresAt, uses: info.usedCount } : null,
    developer: '@error_zero_trace',
    youtube: 'https://www.youtube.com/@ErrorZeroTrace',
    telegram: 'https://t.me/+wnqbWkvzVFU0ODc1'
  });
                               }
