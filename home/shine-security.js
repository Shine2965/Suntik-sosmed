(function () {
  'use strict';

  // 1) Anti clickjacking (cadangan untuk header)
  try { if (window.top !== window.self) window.top.location = window.self.location; } catch (_) {
    document.documentElement.style.display = 'none';
  }

  // 2) BERSIHKAN password yang tersimpan di localStorage (sebelumnya bocor ke XSS)
  try {
    localStorage.removeItem('chat_auth_password');
    localStorage.removeItem('chat_auth_email');
  } catch (_) {}

  const SEC = {};

  // 3) Escape HTML untuk konten
  SEC.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"'`]/g, c => '&#' + c.charCodeAt(0) + ';');
  };
  const handlers = {};
  SEC.on = function (action, fn) { handlers[action] = fn; };
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = handlers[el.dataset.act];
    if (typeof fn === 'function') { e.preventDefault(); fn(Object.assign({}, el.dataset), el); }
  });

  // 5) Validasi URL gambar chat (cegah javascript:, tracker, dll)
  SEC.safeImageUrl = function (u) {
    if (!u || typeof u !== 'string') return null;
    u = u.trim();
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 900000) return u;
    try {
      const x = new URL(u);
      if (x.protocol !== 'https:') return null;
      if (!/\.supabase\.co$/.test(x.hostname)) return null;
      return x.href;
    } catch (_) { return null; }
  };

  // 6) Throttle aksi sensitif di client (UX; server tetap wajib rate-limit)
  const last = {};
  SEC.throttle = function (key, ms) {
    const now = Date.now();
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now;
    return true;
  };

  // 7) Turnstile verifikasi FAIL-CLOSED
  //    Di kode lama: jika API error -> return token.length > 20 (fail-open!)
  SEC.verifyTurnstile = async function (token) {
    if (!token) return false;
    try {
      const r = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!r.ok) return false;
      const j = await r.json();
      return j && j.success === true;
    } catch (_) { return false; }
  };

  // 8) Validasi angka (cegah NaN/Infinity/negatif/desimal aneh)
  SEC.int = function (v, min, max) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
  };

  // 9) Blokir javascript:/data: di link yang dibuat dinamis
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (a && /^\s*(javascript|vbscript):/i.test(a.getAttribute('href'))) e.preventDefault();
  }, true);

  // 10) Guard kegagalan fatal: jangan bocorkan stack ke user
  window.addEventListener('unhandledrejection', function (e) {
    console.warn('[sec] unhandled', e.reason && e.reason.message);
  });

  window.SEC = Object.freeze(SEC);
})();

/* ============================================================
   /api/verify-turnstile.js  (Vercel serverless, fail-closed)
   ------------------------------------------------------------
   export default async function handler(req, res) {
     if (req.method !== 'POST') return res.status(405).end();
     const { token } = req.body || {};
     if (!token) return res.status(400).json({ success: false });
     const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
         secret: process.env.TURNSTILE_SECRET,
         response: token,
         remoteip: req.headers['x-forwarded-for']?.split(',')[0] || ''
       })
     });
     const j = await r.json();
     return res.status(j.success ? 200 : 403).json({ success: !!j.success });
   }
   ============================================================ */
