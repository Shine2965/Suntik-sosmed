// /api/verify-turnstile.js — verifikasi token Turnstile (secret server-side)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'token required' });
    const secret = process.env.TURNSTILE_SECRET_KEY || process.env.CF_TURNSTILE_SECRET_KEY || '';
    if (!secret) return res.status(500).json({ success: false, message: 'TURNSTILE_SECRET_KEY not set' });

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);

    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const data = await r.json();
    if (!data.success) {
      return res.status(403).json({ success: false, message: 'Captcha gagal', codes: data['error-codes'] });
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'error' });
  }
}
