/**
 * POST /api/doku-deposit-create
 * Env wajib:
 *   DOKU_CLIENT_ID  (contoh BRN-0220-... atau MCH-...)
 *   DOKU_SECRET_KEY (Secret Key dari DOKU Back Office, biasanya SK-...)
 * Opsional:
 *   DOKU_API_BASE=https://api.doku.com  (sandbox: https://api-sandbox.doku.com)
 *   PUBLIC_SITE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
      resolve(req.body);
      return;
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

function calcFee(amount) {
  const a = Math.floor(Number(amount) || 0);
  if (a > 50000) return Math.ceil(a * 0.01);
  return 0;
}

function makeId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return 'req-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
}

/** DOKU Non-SNAP signature (Checkout / Jokul) */
function dokuSignature(clientId, requestId, timestamp, requestTarget, bodyStr, secret) {
  const digest = crypto.createHash('sha256').update(bodyStr, 'utf8').digest('base64');
  // Penting: urutan baris + \n, TANPA newline di akhir
  const component =
    'Client-Id:' + clientId + '\n' +
    'Request-Id:' + requestId + '\n' +
    'Request-Timestamp:' + timestamp + '\n' +
    'Request-Target:' + requestTarget + '\n' +
    'Digest:' + digest;
  const hmac = crypto.createHmac('sha256', secret).update(component, 'utf8').digest('base64');
  return {
    signature: 'HMACSHA256=' + hmac,
    digest: digest,
    component: component
  };
}

function extractDokuMessage(json, text, status) {
  if (!json) return (text || '').slice(0, 300) || ('HTTP ' + status);
  if (typeof json === 'string') return json;
  // common shapes
  const parts = [];
  if (json.message) parts.push(typeof json.message === 'string' ? json.message : JSON.stringify(json.message));
  if (json.error_message) parts.push(String(json.error_message));
  if (json.error && typeof json.error === 'string') parts.push(json.error);
  if (json.error && typeof json.error === 'object') parts.push(JSON.stringify(json.error));
  if (json.response && json.response.message) parts.push(String(json.response.message));
  if (json.errors) parts.push(JSON.stringify(json.errors));
  if (json.code) parts.push('code=' + json.code);
  if (!parts.length) parts.push(JSON.stringify(json).slice(0, 400));
  return parts.join(' | ');
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST') return send(res, 405, { success: false, message: 'POST only' });

    const DOKU_CLIENT_ID = (process.env.DOKU_CLIENT_ID || process.env.DOKU_CLIENTID || '').trim();
    const DOKU_SECRET_KEY = (process.env.DOKU_SECRET_KEY || process.env.DOKU_SECRET || '').trim();
    const DOKU_API_BASE = (process.env.DOKU_API_BASE || 'https://api.doku.com').replace(/\/$/, '');
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    const PUBLIC_SITE = (process.env.PUBLIC_SITE_URL || 'https://shinedomain.my.id').replace(/\/$/, '');

    if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
      return send(res, 500, {
        success: false,
        message: 'ENV DOKU_CLIENT_ID / DOKU_SECRET_KEY belum di-set di Vercel. Isi lalu Redeploy.'
      });
    }

    const body = await readBody(req);
    const amount = Math.floor(Number(body.amount) || 0);
    const userId = String(body.user_id || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const method = String(body.payment_method || body.method || 'ALL').toUpperCase();

    if (!amount || amount < 1000) {
      return send(res, 400, { success: false, message: 'Minimal deposit Rp1.000' });
    }
    if (!userId || !email) {
      return send(res, 400, { success: false, message: 'user_id dan email wajib' });
    }

    const fee = calcFee(amount);
    const totalPay = amount + fee;
    const invoice = 'DEP-' + Date.now() + '-' + userId.replace(/-/g, '').slice(0, 8);
    const requestId = makeId();
    // UTC ISO tanpa ms: 2020-08-11T08:45:42Z
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const target = '/checkout/v1/payment';

    const paymentBody = {
      order: {
        amount: totalPay,
        invoice_number: invoice,
        currency: 'IDR',
        callback_url: PUBLIC_SITE + '/home/?deposit=success',
        failed_url: PUBLIC_SITE + '/home/?deposit=failed',
        auto_redirect: true,
        line_items: [{
          name: fee > 0 ? 'Deposit saldo Shine Shop (+admin 1%)' : 'Deposit saldo Shine Shop',
          price: totalPay,
          quantity: 1
        }]
      },
      payment: {
        payment_due_date: 10
      },
      customer: {
        id: String(userId).slice(0, 50),
        name: String(email.split('@')[0] || 'User').slice(0, 40),
        email: email,
        phone: '081234567890',
        country: 'ID'
      },
      additional_info: {
        override_notification_url: PUBLIC_SITE + '/api/doku-notification'
      }
    };

    // Body string harus IDENTIK dengan yang dikirim (digest)
    const bodyStr = JSON.stringify(paymentBody);
    const sig = dokuSignature(DOKU_CLIENT_ID, requestId, timestamp, target, bodyStr, DOKU_SECRET_KEY);

    let dokuJson = null;
    let dokuText = '';
    let httpStatus = 0;
    try {
      const r = await fetch(DOKU_API_BASE + target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Client-Id': DOKU_CLIENT_ID,
          'Request-Id': requestId,
          'Request-Timestamp': timestamp,
          Signature: sig.signature
        },
        body: bodyStr
      });
      httpStatus = r.status;
      dokuText = await r.text();
      try { dokuJson = JSON.parse(dokuText); } catch (_) { dokuJson = null; }

      if (!r.ok) {
        const msg = extractDokuMessage(dokuJson, dokuText, r.status);
        let hint = '';
        if (r.status === 401) {
          hint =
            ' | 401 = Client-Id/Secret/Signature salah. ' +
            'Cek di DOKU Back Office → Settings → Credentials: ' +
            'Client ID harus sama dengan DOKU_CLIENT_ID, Secret Key sama dengan DOKU_SECRET_KEY. ' +
            'Jangan pakai API Key (doku_key_...) untuk signature. ' +
            'Sandbox pakai DOKU_API_BASE=https://api-sandbox.doku.com + kredensial sandbox.';
        }
        return send(res, 502, {
          success: false,
          message: 'DOKU HTTP ' + r.status + ': ' + msg + hint,
          doku_status: r.status,
          client_id_prefix: DOKU_CLIENT_ID.slice(0, 12) + '…',
          api_base: DOKU_API_BASE
        });
      }
    } catch (e) {
      return send(res, 502, {
        success: false,
        message: 'Gagal hubungi DOKU: ' + (e && e.message ? e.message : String(e))
      });
    }

    const paymentUrl =
      (dokuJson && dokuJson.response && dokuJson.response.payment && dokuJson.response.payment.url) ||
      (dokuJson && dokuJson.payment && dokuJson.payment.url) ||
      (dokuJson && dokuJson.payment_url) ||
      null;

    if (!paymentUrl) {
      return send(res, 502, {
        success: false,
        message: 'DOKU OK tapi payment_url kosong. Response: ' + extractDokuMessage(dokuJson, dokuText, httpStatus),
        doku: dokuJson
      });
    }

    let depositId = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const ins = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/deposits', {
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
            payment_url: paymentUrl,
            payment_method: method
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
      invoice_number: invoice,
      request_id: requestId,
      amount: amount,
      admin_fee: fee,
      total_pay: totalPay,
      payment_url: paymentUrl,
      payment_method: method,
      deposit_id: depositId
    });
  } catch (e) {
    console.error('doku-deposit-create fatal', e);
    return send(res, 500, {
      success: false,
      message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e))
    });
  }
};
