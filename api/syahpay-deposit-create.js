/**
 * POST /api/syahpay-deposit-create
 * Body: { amount, user_id, email, unique_code?, admin_fee?, total_pay? }
 * total_pay = amount + admin_fee(1%) + unique_code
 * Env: SYAHPAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
  return Math.ceil(a * 0.01);
}

/** Cari kode unik 1-999 berurutan untuk nominal amount, lock 3 jam WIB */
async function pickUniqueCode(supabaseUrl, supabaseKey, amount) {
  const now = Date.now();
  const lockMs = 3 * 60 * 60 * 1000; // 3 jam
  const used = new Set();
  try {
    // Ambil deposit 3 jam terakhir dengan amount sama (pending/paid)
    const since = new Date(now - lockMs).toISOString();
    const q = await fetch(
      supabaseUrl +
        '/rest/v1/deposits?amount=eq.' +
        encodeURIComponent(String(amount)) +
        '&created_at=gte.' +
        encodeURIComponent(since) +
        '&select=unique_code,status,created_at,expires_at&order=unique_code.asc&limit=1000',
      {
        headers: {
          apikey: supabaseKey,
          Authorization: 'Bearer ' + supabaseKey
        }
      }
    );
    const rows = await q.json().catch(() => []);
    (Array.isArray(rows) ? rows : []).forEach((d) => {
      const code = Math.floor(Number(d.unique_code) || 0);
      if (code < 1 || code > 999) return;
      // lock jika pending belum expired ATAU created dalam 3 jam
      const created = d.created_at ? new Date(d.created_at).getTime() : 0;
      const exp = d.expires_at ? new Date(d.expires_at).getTime() : 0;
      const stillPending = d.status === 'pending' && (!exp || exp > now);
      const within3h = created && now - created < lockMs;
      if (stillPending || within3h || d.status === 'paid' || d.status === 'success') {
        if (within3h || stillPending) used.add(code);
        // paid juga lock 3 jam dari created
        if ((d.status === 'paid' || d.status === 'success' || d.status === 'completed') && within3h) {
          used.add(code);
        }
      }
    });
  } catch (_) {}

  for (let c = 1; c <= 999; c++) {
    if (!used.has(c)) return c;
  }
  return null;
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
        message: 'ENV SYAHPAY_API_KEY belum di-set di Vercel'
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
    let uniqueCode = Math.floor(Number(body.unique_code) || 0);
    if (!uniqueCode || uniqueCode < 1 || uniqueCode > 999) {
      if (SUPABASE_URL && SUPABASE_KEY) {
        uniqueCode = await pickUniqueCode(SUPABASE_URL, SUPABASE_KEY, amount);
      } else {
        uniqueCode = 1;
      }
    }
    if (!uniqueCode) {
      return send(res, 409, {
        success: false,
        message: 'Semua kode unik 1–999 untuk nominal ini sedang terpakai (lock 3 jam WIB). Coba nominal lain atau nanti.'
      });
    }

    const cashback = Math.floor(uniqueCode * 0.1); // 10% kode unik ke pembeli
    const totalPay = amount + adminFee + uniqueCode;
    const idempotency =
      'dep-' + userId.slice(0, 8) + '-' + amount + '-' + uniqueCode + '-' + Date.now();

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
          message: 'SyahPay HTTP ' + r.status + ': ' + (spText || '').slice(0, 300)
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
        message: 'SyahPay gagal: ' + JSON.stringify(spJson || spText).slice(0, 300)
      });
    }

    const invoiceId = spJson.invoice_id || spJson.id || null;
    const qrisImage = spJson.qris_image || spJson.qr_image || null;
    const paymentLink = spJson.payment_link || null;
    const expiredAt = spJson.expired_at || null;
    const expiresIso = expiredAt && !isNaN(Date.parse(expiredAt))
      ? new Date(expiredAt).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    if (!invoiceId) {
      return send(res, 502, { success: false, message: 'invoice_id kosong', raw: spJson });
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
            unique_code: uniqueCode,
            total_amount: totalPay,
            status: 'pending',
            expires_at: expiresIso,
            provider: 'syahpay',
            invoice_number: invoiceId,
            request_id: idempotency,
            admin_fee: adminFee,
            payment_url: paymentLink,
            payment_method: 'QRIS',
            qris_image: qrisImage,
            cashback_unique: cashback
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
      unique_code: uniqueCode,
      cashback_unique: cashback,
      total_pay: totalPay,
      qris_image: qrisImage,
      payment_link: paymentLink,
      expired_at: expiredAt || expiresIso,
      expires_at: expiresIso,
      message: 'QRIS in-app · jangan redirect'
    });
  } catch (e) {
    console.error('syahpay-deposit-create', e);
    return send(res, 500, {
      success: false,
      message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e))
    });
  }
};
