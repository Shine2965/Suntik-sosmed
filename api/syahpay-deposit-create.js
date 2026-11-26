/**
 * POST /api/syahpay-deposit-create
 * Body: { amount, user_id, email }
 *
 * - Kode unik TIDAK diterima dari client. Server mencari kode kosong pertama (1–999)
 *   untuk nominal yang sama, lalu mengklaimnya di tabel deposit_code_locks.
 * - Kode yang sudah dipakai invoice mana pun (user mana pun) dengan nominal sama
 *   terkunci selama 2 jam.
 * - Riwayat deposit lebih dari 2 jam dihapus (kecuali yang belum dikredit).
 *
 * Env: SYAHPAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const LOCK_MS = 2 * 60 * 60 * 1000;      // kunci kode & riwayat: 2 jam
const EXPIRE_MS = 30 * 60 * 1000;        // QRIS expired: 30 menit

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
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) { resolve(req.body); return; }
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

async function sbFetch(url, key, path, opts = {}) {
  const r = await fetch(url + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

/** Hapus riwayat > 2 jam. Deposit paid yang belum dikredit TIDAK dihapus. */
async function cleanupOld(url, key) {
  const cutoff = new Date(Date.now() - LOCK_MS).toISOString();
  try {
    await sbFetch(url, key,
      '/rest/v1/deposits?created_at=lt.' + encodeURIComponent(cutoff) +
      '&or=(balance_credited.eq.true,status.neq.paid)',
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (e) { console.warn('cleanup deposits', e.message); }
  try {
    await sbFetch(url, key,
      '/rest/v1/deposit_code_locks?expires_at=lt.' + encodeURIComponent(new Date().toISOString()),
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (e) { console.warn('cleanup locks', e.message); }
}

/**
 * Cari dan klaim kode unik kosong untuk nominal `amount`.
 * Klaim atomik: insert dengan resolution=ignore-duplicates. Jika kode sudah
 * dipakai (PK conflict), insert mengembalikan array kosong dan kode berikutnya dicoba.
 */
async function claimUniqueCode(url, key, amount, depositTag) {
  const nowIso = new Date().toISOString();
  // lock kadaluarsa untuk nominal ini dibersihkan dulu
  await sbFetch(url, key,
    '/rest/v1/deposit_code_locks?amount=eq.' + amount + '&expires_at=lt.' + encodeURIComponent(nowIso),
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

  const active = await sbFetch(url, key,
    '/rest/v1/deposit_code_locks?amount=eq.' + amount + '&expires_at=gte.' + encodeURIComponent(nowIso) +
    '&select=unique_code&limit=1000', { method: 'GET' });
  if (!active.ok) throw new Error('baca lock kode gagal (HTTP ' + active.status + '): ' + (active.text || '').slice(0, 300));
  const used = new Set((active.json || []).map((r) => Number(r.unique_code)));

  const expiresAt = new Date(Date.now() + LOCK_MS).toISOString();
  for (let c = 1; c <= 999; c++) {
    if (used.has(c)) continue;
    const ins = await sbFetch(url, key, '/rest/v1/deposit_code_locks', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ amount: amount, unique_code: c, expires_at: expiresAt, deposit_id: depositTag || null })
    });
    if (ins.ok && Array.isArray(ins.json) && ins.json.length > 0) {
      return { code: c, expiresAt };
    }
  }
  return null;
}

async function releaseUniqueCode(url, key, amount, code) {
  try {
    await sbFetch(url, key,
      '/rest/v1/deposit_code_locks?amount=eq.' + amount + '&unique_code=eq.' + code,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (_) {}
}

/** Ambil origin saja: 'https://x.supabase.co/rest/v1/' -> 'https://x.supabase.co' */
function normalizeSupabaseUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  try { return new URL(v).origin; } catch (_) { return v.replace(/\/rest\/v1.*$/, '').replace(/\/$/, ''); }
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST') return send(res, 405, { success: false, message: 'POST only' });

    const API_KEY = (process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY || '').trim();
    const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!API_KEY) return send(res, 500, { success: false, message: 'ENV SYAHPAY_API_KEY belum di-set di Vercel' });
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, { success: false, message: 'SUPABASE_URL / SERVICE_ROLE_KEY belum di-set' });
    }

    const body = await readBody(req);
    const amount = Math.floor(Number(body.amount) || 0);
    const userId = String(body.user_id || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!amount || amount < 1000) return send(res, 400, { success: false, message: 'Minimal deposit Rp1.000' });
    if (!userId || !email) return send(res, 400, { success: false, message: 'user_id dan email wajib' });

    // bersihkan riwayat > 2 jam (fire-and-forget aman)
    await cleanupOld(SUPABASE_URL, SUPABASE_KEY);

    const claim = await claimUniqueCode(SUPABASE_URL, SUPABASE_KEY, amount, null);
    if (!claim) {
      return send(res, 409, {
        success: false,
        message: 'Semua kode unik 1–999 untuk nominal ini sedang terkunci (2 jam). Coba nominal lain atau beberapa menit lagi.'
      });
    }
    const uniqueCode = claim.code;

    const adminFee = calcAdminFee(amount);
    const cashback = Math.floor(uniqueCode * 0.1);
    const totalPay = amount + adminFee + uniqueCode;
    const idempotency = 'dep-' + userId.slice(0, 8) + '-' + amount + '-' + uniqueCode + '-' + Date.now();

    // 1) Buat invoice di SyahPay
    const url =
      'https://syahpay.biz.id/api/invoice?amount=' + encodeURIComponent(String(totalPay)) +
      '&apikey=' + encodeURIComponent(API_KEY) + '&api_key=' + encodeURIComponent(API_KEY);
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
      if (!r.ok || !spJson || !spJson.success) {
        await releaseUniqueCode(SUPABASE_URL, SUPABASE_KEY, amount, uniqueCode);
        return send(res, 502, {
          success: false,
          message: 'SyahPay HTTP ' + r.status + ': ' + (spText || '').slice(0, 300)
        });
      }
    } catch (e) {
      await releaseUniqueCode(SUPABASE_URL, SUPABASE_KEY, amount, uniqueCode);
      return send(res, 502, { success: false, message: 'Gagal hubungi SyahPay: ' + (e.message || e) });
    }

    const invoiceId = spJson.invoice_id || spJson.id || null;
    const qrisImage = spJson.qris_image || spJson.qr_image || null;
    const paymentLink = spJson.payment_link || null;
    const expiredAt = spJson.expired_at || null;
    const expiresIso = expiredAt && !isNaN(Date.parse(expiredAt))
      ? new Date(expiredAt).toISOString()
      : new Date(Date.now() + EXPIRE_MS).toISOString();
    if (!invoiceId) {
      await releaseUniqueCode(SUPABASE_URL, SUPABASE_KEY, amount, uniqueCode);
      return send(res, 502, { success: false, message: 'invoice_id kosong', raw: spJson });
    }

    // 2) Simpan deposit. Jika gagal, kode TETAP dikunci (invoice sudah dibuat di SyahPay).
    let depositId = null;
    const ins = await sbFetch(SUPABASE_URL, SUPABASE_KEY, '/rest/v1/deposits', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
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
    if (ins.ok && Array.isArray(ins.json) && ins.json[0]) depositId = ins.json[0].id;
    else console.error('deposit insert gagal', ins.status, (ins.text || '').slice(0, 300));

    // kaitkan lock dengan deposit (opsional, untuk audit)
    if (depositId) {
      try {
        await sbFetch(SUPABASE_URL, SUPABASE_KEY,
          '/rest/v1/deposit_code_locks?amount=eq.' + amount + '&unique_code=eq.' + uniqueCode,
          { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deposit_id: depositId }) });
      } catch (_) {}
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
      code_locked_until: claim.expiresAt,
      message: 'QRIS in-app · jangan redirect'
    });
  } catch (e) {
    console.error('syahpay-deposit-create', e);
    return send(res, 500, { success: false, message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e)) });
  }
};
