/**
 * POST /api/syahpay-deposit-status
 * Body: { invoice_id, deposit_id?, user_id? }
 * Cek status SyahPay; jika paid → complete_deposit
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET') {
      const u = new URL(req.url || '/', 'http://localhost');
      resolve({
        invoice_id: u.searchParams.get('invoice_id') || '',
        deposit_id: u.searchParams.get('deposit_id') || ''
      });
      return;
    }
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body); return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST' && req.method !== 'GET') {
      return send(res, 405, { success: false, message: 'POST/GET only' });
    }

    const API_KEY = (process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY || '').trim();
    const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!API_KEY) {
      return send(res, 500, { success: false, message: 'SYAHPAY_API_KEY belum di-set' });
    }

    const body = await readBody(req);
    const invoiceId = String(body.invoice_id || '').trim();
    const depositId = String(body.deposit_id || '').trim();
    if (!invoiceId) {
      return send(res, 400, { success: false, message: 'invoice_id wajib' });
    }

    const url =
      'https://syahpay.biz.id/api/invoice/status?invoice_id=' + encodeURIComponent(invoiceId);
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': API_KEY,
        Authorization: 'Bearer ' + API_KEY
      }
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!r.ok || !json) {
      return send(res, 502, {
        success: false,
        message: 'SyahPay status HTTP ' + r.status + ': ' + text.slice(0, 200)
      });
    }

    const status = String(json.status || '').toLowerCase();
    let credited = false;
    let creditResult = null;

    if (status === 'paid' && SUPABASE_URL && SUPABASE_KEY) {
      try {
        // cari deposit
        let dep = null;
        if (depositId) {
          const q = await fetch(
            SUPABASE_URL + '/rest/v1/deposits?id=eq.' + encodeURIComponent(depositId) + '&select=*&limit=1',
            { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
          );
          const rows = await q.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]) dep = rows[0];
        }
        if (!dep) {
          const q2 = await fetch(
            SUPABASE_URL +
              '/rest/v1/deposits?invoice_number=eq.' +
              encodeURIComponent(invoiceId) +
              '&select=*&limit=1',
            { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
          );
          const rows2 = await q2.json().catch(() => []);
          if (Array.isArray(rows2) && rows2[0]) dep = rows2[0];
        }

        if (dep && dep.status !== 'paid' && dep.status !== 'success' && dep.status !== 'completed') {
          const rpc = await fetch(SUPABASE_URL + '/rest/v1/rpc/complete_deposit', {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_deposit_id: dep.id,
              p_user_id: dep.user_id,
              p_amount: dep.amount,
              p_invoice: invoiceId,
              p_provider: 'syahpay'
            })
          });
          creditResult = await rpc.json().catch(() => null);
          credited = true;
          // soft update
          await fetch(SUPABASE_URL + '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id), {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'paid',
              paid_at: new Date().toISOString(),
              paid_amount: json.total || dep.total_amount,
              provider: 'syahpay'
            })
          });
        } else if (dep && (dep.status === 'paid' || dep.status === 'success')) {
          credited = true;
        }
      } catch (e) {
        console.error('credit', e);
      }
    }

    return send(res, 200, {
      success: true,
      invoice_id: invoiceId,
      status: status,
      amount: json.amount,
      fee: json.fee,
      total: json.total,
      qris_image: json.qris_image,
      payment_link: json.payment_link,
      expired_at: json.expired_at,
      credited: credited,
      credit_result: creditResult
    });
  } catch (e) {
    return send(res, 500, {
      success: false,
      message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e))
    });
  }
};
