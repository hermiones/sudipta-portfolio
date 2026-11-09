// Live "people here now" counter backed by Upstash Redis (REST API, no dependencies).
// POST { id } = heartbeat. Returns { now }, the visitors seen in the last 45 s.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const WINDOW_MS = 45_000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'presence store not configured' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let id = '';
  try { id = String((typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}).id || ''); } catch { /* ignore */ }
  if (!/^[a-z0-9]{8,32}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const cmds = [
    ['ZADD', 'presence', String(now), id],
    ['ZREMRANGEBYSCORE', 'presence', '-inf', String(now - WINDOW_MS)],
    ['EXPIRE', 'presence', '120'],
    ['ZCARD', 'presence'],
    ['PFADD', `visitors:${day}`, id],          // daily unique visitors (for Sudipta's own stats)
    ['EXPIRE', `visitors:${day}`, String(60 * 60 * 24 * 40)],
  ];
  try {
    const r = await fetch(`${URL_}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
    const out = await r.json();
    const count = Number(out?.[3]?.result ?? 0);
    return res.status(200).json({ now: Math.max(1, count) });
  } catch {
    return res.status(502).json({ error: 'presence store unavailable' });
  }
}
