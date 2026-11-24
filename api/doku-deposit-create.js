/**
 * Vercel serverless: POST /api/doku-deposit-create
 * Body: { amount, user_id, email, access_token }
 * Env: DOKU_CLIENT_ID, DOKU_SECRET_KEY, DOKU_API_BASE (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
 *
 * Biaya admin QRIS 1% jika amount > 50000 (user bayar amount+fee, saldo dikredit amount).
 */
const crypto = require('crypto');

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || process.env.DOKU_CLIENTID || '';
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY || process.env.DOKU_SECRET || '';
const DOKU_API_BASE = (process.env.DOKU_API_BASE || 'https://api.doku.com').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function calcFee(amount) {
  const a = Math.floor(Number(amount) || 0);
  if (a > 50000) return Math.ceil(a * 0.01);
  return 0;
}

function makeSignature(clientId, requestId, timestamp, target, bodyStr, secret) {
  const digest = crypto.createHash('sha256').update(bodyStr).digest('base64');
  const components = [
    'Client-Id:' + clientId,
    'Request-Id:' + requestId,
    'Request-Timestamp:' + timestamp,
    'Request-Target:' + target,
    'Digest:' + digest
  ].join('\n');
  const sig = crypto.createHmac('sha256', secret).update(components).digest('base64');
  return 'HMACSHA256=' + sig;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/c =>
    (c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
  );
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'POST only' });

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    return json(res, 500, {
      success: false,
      message: 'DOKU_CLIENT_ID / DOKU_SECRET_KEY belum di-set di Vercel Environment'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  body = body || {};

  const amount = Math.floor(Number(body.amount) || 0);
  const userId = String(body.user_id || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  if (!amount || amount < 1000) {
    return json(res, 400, { success: false, message: 'Minimal deposit Rp1.000' });
  }
  if (!userId || !email) {
    return json(res, 400, { success: false, message: 'user_id dan email wajib' });
  }

  const fee = calcFee(amount);
  const totalPay = amount + fee;
  const invoice = 'DEP-' + Date.now() + '-' + userId.replace(/-/g, '').slice(0, 8);
  const requestId = uuid();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const target = '/checkout/v1/payment';

  const origin = (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-proto'] + '://' + req.headers['x-forwarded-host']
    : (process.env.PUBLIC_SITE_URL || 'https://shinedomain.my.id');

  const paymentBody = {
    order: {
      amount: totalPay,
      invoice_number: invoice,
      currency: 'IDR',
      callback_url: origin.replace(/\/$/, '') + '/home/?deposit=success',
      failed_url: origin.replace(/\/$/, '') + '/home/?deposit=failed',
      auto_redirect: true,
      line_items: [
        {
          name: fee > 0 ? 'Deposit saldo (+admin 1%)' : 'Deposit saldo',
          price: totalPay,
          quantity: 1
        }
      ]
    },
    payment: {
      payment_due_date: 60
    },
    customer: {
      id: userId.slice(0, 50),
      name: (email.split('@')[0] || 'User').slice(0, 50),
      email: email,
      phone: '081234567890',
      country: 'ID'
    },
    additional_info: {
      override_notification_url: origin.replace(/\/$/, '') + '/api/doku-notification'
    }
  };

  const bodyStr = JSON.stringify(paymentBody);
  const signature = makeSignature(DOKU_CLIENT_ID, requestId, timestamp, target, bodyStr, DOKU_SECRET_KEY);

  let dokuRes;
  try {
    const r = await fetch(DOKU_API_BASE + target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': DOKU_CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        Signature: signature
      },
      body: bodyStr
    });
    const text = await r.text();
    try {
      dokuRes = JSON.parse(text);
    } catch (_) {
      dokuRes = { raw: text, status: r.status };
    }
    if (!r.ok) {
      return json(res, 502, {
        success: false,
        message: 'DOKU error: ' + (dokuRes.message || dokuRes.error_message || text.slice(0, 200)),
        doku: dokuRes
      });
    }
  } catch (e) {
    return json(res, 502, { success: false, message: 'Gagal hubungi DOKU: ' + (e.message || String(e)) });
  }

  const paymentUrl =
    (dokuRes.response && dokuRes.response.payment && dokuRes.response.payment.url) ||
    (dokuRes.payment && dokuRes.payment.url) ||
    dokuRes.payment_url ||
    null;

  // Simpan deposit pending di Supabase (opsional, pakai service/anon)
  let depositId = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
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
          expires_at: expires,
          provider: 'doku',
          invoice_number: invoice,
          request_id: requestId,
          admin_fee: fee,
          payment_url: paymentUrl
        })
      });
      const rows = await ins.json().catch(() => null);
      if (Array.isArray(rows) && rows[0]) depositId = rows[0].id;
      else if (rows && rows.id) depositId = rows.id;
    } catch (e) {
      console.warn('deposit insert', e.message);
    }
  }

  return json(res, 200, {
    success: true,
    invoice_number: invoice,
    request_id: requestId,
    amount: amount,
    admin_fee: fee,
    total_pay: totalPay,
    payment_url: paymentUrl,
    deposit_id: depositId,
    doku: {
      message: dokuRes.message || null
    }
  });
};
