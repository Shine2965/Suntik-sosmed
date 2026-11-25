/**
 * POST /api/syahpay-deposit-create
 * Body: { amount, user_id, email }
 * Env: SYAHPAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * QRIS only, expire 30 menit, admin fee 1%
 */
const crypto = require('crypto');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body); return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body || '{}')); } catch (_) { resolve({}); }
      return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) raw = raw.slice(0, 1e6); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function calcAdminFee(amount) {
  const a = Math.floor(Number(amount) || 0);
  if (a <= 0) return 0;
  return Math.ceil(a * 0.01); // 1% QRIS admin
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST') return send(res, 405, { success: false, message: 'POST only' });

    const API_KEY = (process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY || '').trim();
    const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!API_KEY) {
      return send(res, 500, {
        success: false,
        message: 'ENV SYAHPAY_API_KEY belum di-set di Vercel. Set lalu Redeploy.'
      });
    }

    const body = await readBody(req);
    const amount = Math.floor(Number(body.amount) || 0);
    const userId = String(body.user_id || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!amount || amount < 1000) {
      return send(res, 400, { success: false, message: 'Minimal deposit Rp1.000' });
    }
    if (!userId || !email) {
      return send(res, 400, { success: false, message: 'user_id dan email wajib' });
    }

    const adminFee = calcAdminFee(amount);
    const totalPay = amount + adminFee;
    const idempotency = 'dep-' + userId.slice(0, 8) + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');

    // SyahPay: GET /api/invoice?amount=...  (API key via header)
    const url = 'https://syahpay.biz.id/api/invoice?amount=' + encodeURIComponent(String(totalPay));
    let spJson = null;
    let spText = '';
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': API_KEY,
          Authorization: 'Bearer ' + API_KEY,
          'Idempotency-Key': idempotency
        }
      });
      spText = await r.text();
      try { spJson = JSON.parse(spText); } catch (_) { spJson = null; }
      if (!r.ok) {
        return send(res, 502, {
          success: false,
          message: 'SyahPay HTTP ' + r.status + ': ' + (spText || '').slice(0, 300),
          syahpay_status: r.status
        });
      }
    } catch (e) {
      return send(res, 502, {
        success: false,
        message: 'Gagal hubungi SyahPay: ' + (e && e.message ? e.message : String(e))
      });
    }

    if (!spJson || !spJson.success) {
      return send(res, 502, {
        success: false,
        message: 'SyahPay gagal buat invoice: ' + JSON.stringify(spJson || spText).slice(0, 300)
      });
    }

    const invoiceId = spJson.invoice_id || spJson.id || null;
    const qrisImage = spJson.qris_image || spJson.qr_image || null;
    const paymentLink = spJson.payment_link || spJson.payment_url || null;
    const expiredAt = spJson.expired_at || null;
    // expired 30 menit fallback
    const expiresIso = expiredAt
      ? (isNaN(Date.parse(expiredAt)) ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : new Date(expiredAt).toISOString())
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    if (!invoiceId) {
      return send(res, 502, { success: false, message: 'invoice_id kosong dari SyahPay', raw: spJson });
    }

    let depositId = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const ins = await fetch(SUPABASE_URL + '/rest/v1/deposits', {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            user_id: userId,
            email: email,
            amount: amount,
            unique_code: 0,
            total_amount: totalPay,
            status: 'pending',
            expires_at: expiresIso,
            provider: 'syahpay',
            invoice_number: invoiceId,
            request_id: idempotency,
            admin_fee: adminFee,
            payment_url: paymentLink,
            payment_method: 'QRIS',
            qris_image: qrisImage
          })
        });
        const rows = await ins.json().catch(() => null);
        if (Array.isArray(rows) && rows[0]) depositId = rows[0].id;
        else if (rows && rows.id) depositId = rows.id;
      } catch (e) {
        console.warn('deposit insert', e && e.message);
      }
    }

    return send(res, 200, {
      success: true,
      provider: 'syahpay',
      invoice_id: invoiceId,
      deposit_id: depositId,
      amount: amount,
      admin_fee: adminFee,
      total_pay: totalPay,
      fee_provider: spJson.fee || 0,
      qris_image: qrisImage,
      payment_link: paymentLink,
      expired_at: expiredAt || expiresIso,
      expires_at: expiresIso,
      message: 'Bayar via QRIS SyahPay (expired 30 menit)'
    });
  } catch (e) {
    console.error('syahpay-deposit-create', e);
    return send(res, 500, {
      success: false,
      message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e))
    });
  }
};
