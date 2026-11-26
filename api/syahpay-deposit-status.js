/**
 * POST/GET /api/syahpay-deposit-status
 * Body: { invoice_id, deposit_id? }
 *
 * Aturan:
 * - Saldo DIANGGAP bertambah hanya jika saldo di DB benar-benar naik (dicek ulang).
 * - Klaim deposit dilakukan atomik (balance_credited false -> true) sehingga
 *   poll paralel tidak mengkredit dua kali.
 * - Jika kredit gagal, flag dikembalikan ke false dan respons credited=false,
 *   sehingga poll berikutnya mencoba lagi dan UI tidak menampilkan sukses palsu.
 *
 * Env: SYAHPAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body || '{}')); } catch (_) { resolve({}); }
      return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function sb(url, key, path, opts = {}) {
  const r = await fetch(url.replace(/\/$/, '') + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {})
    }
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

async function readBalance(url, key, userId) {
  const r = await sb(url, key, '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=balance', { method: 'GET' });
  if (!r.ok || !Array.isArray(r.json) || !r.json[0]) {
    return { ok: false, error: 'profile tidak terbaca (HTTP ' + r.status + ')' };
  }
  return { ok: true, balance: Number(r.json[0].balance) || 0 };
}

/**
 * Kredit saldo. Setiap metode dicek dengan membaca ulang saldo.
 * Metode dianggap berhasil hanya jika saldo DB >= saldo_awal + creditAmt.
 * Dengan begitu respons RPC yang tidak standar tidak lagi salah dibaca sebagai gagal.
 */
async function creditBalance(url, key, userId, creditAmt, invoiceId) {
  const before = await readBalance(url, key, userId);
  if (!before.ok) return { ok: false, error: before.error };
  const target = before.balance + creditAmt;

  const methods = [
    {
      name: 'rpc_admin_credit_balance',
      path: '/rest/v1/rpc/admin_credit_balance',
      method: 'POST',
      body: { p_user_id: userId, p_amount: creditAmt, p_note: 'Deposit SyahPay ' + invoiceId }
    },
    {
      name: 'rpc_secure_credit_balance',
      path: '/rest/v1/rpc/secure_credit_balance',
      method: 'POST',
      body: { p_user_id: userId, p_amount: creditAmt, p_reason: 'deposit_syahpay', p_ref: invoiceId }
    },
    {
      name: 'direct_patch',
      path: '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId),
      method: 'PATCH',
      headers: { 'X-Balance-Write': '1' },
      body: { balance: target }
    }
  ];

  const attempts = [];
  for (const m of methods) {
    const r = await sb(url, key, m.path, {
      method: m.method,
      headers: m.headers || {},
      body: JSON.stringify(m.body)
    });
    const now = await readBalance(url, key, userId);
    attempts.push({
      name: m.name,
      http: r.status,
      balance_after_try: now.ok ? now.balance : null,
      body: (r.text || '').slice(0, 160)
    });
    if (now.ok && now.balance >= target - 0.5) {
      return { ok: true, via: m.name, before: before.balance, after: now.balance };
    }
  }
  return { ok: false, before: before.balance, attempts };
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

    if (!API_KEY) return send(res, 500, { success: false, message: 'SYAHPAY_API_KEY belum di-set' });
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, { success: false, message: 'SUPABASE_URL / SERVICE_ROLE_KEY belum di-set di Vercel' });
    }

    const body = await readBody(req);
    const invoiceId = String(body.invoice_id || '').trim();
    const depositId = String(body.deposit_id || '').trim();
    if (!invoiceId) return send(res, 400, { success: false, message: 'invoice_id wajib' });

    // 1) Status dari SyahPay
    const stUrl =
      'https://syahpay.biz.id/api/invoice/status?invoice_id=' + encodeURIComponent(invoiceId) +
      '&apikey=' + encodeURIComponent(API_KEY) + '&api_key=' + encodeURIComponent(API_KEY);
    let r;
    try {
      r = await fetch(stUrl, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-api-key': API_KEY, Authorization: 'Bearer ' + API_KEY }
      });
    } catch (e) {
      return send(res, 502, { success: false, message: 'Gagal hubungi SyahPay: ' + (e.message || e) });
    }
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!r.ok || !json) {
      return send(res, 502, { success: false, message: 'SyahPay status HTTP ' + r.status + ': ' + text.slice(0, 200) });
    }
    const status = String(json.status || '').toLowerCase();

    // 2) Ambil deposit
    let dep = null;
    if (depositId) {
      const q = await sb(SUPABASE_URL, SUPABASE_KEY,
        '/rest/v1/deposits?id=eq.' + encodeURIComponent(depositId) + '&select=*&limit=1', { method: 'GET' });
      if (Array.isArray(q.json) && q.json[0]) dep = q.json[0];
    }
    if (!dep) {
      const q2 = await sb(SUPABASE_URL, SUPABASE_KEY,
        '/rest/v1/deposits?invoice_number=eq.' + encodeURIComponent(invoiceId) +
        '&select=*&order=created_at.desc&limit=1', { method: 'GET' });
      if (Array.isArray(q2.json) && q2.json[0]) dep = q2.json[0];
    }

    const base = {
      success: true,
      invoice_id: invoiceId,
      status: status,
      amount: json.amount,
      fee: json.fee,
      total: json.total,
      qris_image: json.qris_image,
      payment_link: json.payment_link,
      expired_at: json.expired_at,
      deposit_id: dep ? dep.id : null
    };

    if (!dep) {
      return send(res, 200, { ...base, credited: false, credit_detail: { error: 'deposit_row_not_found' } });
    }

    let credited = dep.balance_credited === true;
    let creditDetail = credited ? { already_credited: true } : null;
    let newBalance = null;

    if (status === 'paid' && !credited) {
      // 3) Klaim atomik: hanya satu request yang boleh mengkredit
      const claim = await sb(SUPABASE_URL, SUPABASE_KEY,
        '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id) +
        '&or=(balance_credited.is.null,balance_credited.eq.false)',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'paid', balance_credited: true, paid_at: new Date().toISOString() })
        });

      if (claim.ok && Array.isArray(claim.json) && claim.json.length) {
        const baseAmt = Math.floor(Number(dep.amount) || 0);
        const cashback = Math.floor(Number(dep.cashback_unique) || 0) ||
          Math.floor((Number(dep.unique_code) || 0) * 0.1);
        const creditAmt = baseAmt + cashback;

        const result = await creditBalance(SUPABASE_URL, SUPABASE_KEY, dep.user_id, creditAmt, invoiceId);

        if (result.ok) {
          credited = true;
          newBalance = result.after;
          creditDetail = {
            via: result.via,
            amount: creditAmt,
            cashback: cashback,
            balance_before: result.before,
            balance_after: result.after
          };
          // Catatan mutasi (gagal di sini tidak membatalkan kredit)
          const mut = await sb(SUPABASE_URL, SUPABASE_KEY, '/rest/v1/balance_mutations', {
            method: 'POST',
            body: JSON.stringify({
              user_id: dep.user_id,
              email: dep.email || null,
              amount: creditAmt,
              type: 'deposit',
              reason: 'Deposit SyahPay paid' + (cashback ? ' +cashback ' + cashback : '') + ' inv ' + invoiceId,
              balance_before: result.before,
              balance_after: result.after
            })
          });
          if (!mut.ok) creditDetail.mutasi_warning = 'insert mutasi gagal (HTTP ' + mut.status + ')';
          await sb(SUPABASE_URL, SUPABASE_KEY,
            '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id),
            { method: 'PATCH', body: JSON.stringify({ paid_amount: json.total || dep.total_amount }) });
        } else {
          // Kredit gagal: kembalikan flag agar poll berikutnya mencoba lagi
          await sb(SUPABASE_URL, SUPABASE_KEY,
            '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id),
            { method: 'PATCH', body: JSON.stringify({ balance_credited: false }) });
          creditDetail = { error: 'credit_failed', ...result };
          console.error('syahpay credit failed', invoiceId, JSON.stringify(result).slice(0, 500));
        }
      } else {
        // Sudah diklaim request lain (paralel) → anggap sudah dikredit
        credited = true;
        creditDetail = { already_credited: true, note: 'claimed_by_parallel_request' };
      }
    }

    if (newBalance == null && credited) {
      const nb = await readBalance(SUPABASE_URL, SUPABASE_KEY, dep.user_id);
      if (nb.ok) newBalance = nb.balance;
    }

    return send(res, 200, {
      ...base,
      credited: credited,
      credit_detail: creditDetail,
      new_balance: newBalance
    });
  } catch (e) {
    console.error('syahpay-deposit-status', e);
    return send(res, 500, { success: false, message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e)) });
  }
};
