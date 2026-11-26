/**
 * POST /api/syahpay-deposit-create
 * Body: { amount, user_id, email }
 *
 * Kode unik TIDAK diterima dari client. Server:
 *  1. Mengambil kode yang sudah dipakai deposit 2 jam terakhir untuk nominal yang sama
 *     (semua user, semua status) lalu memilih kode kosong pertama 1–999.
 *  2. Membuat invoice SyahPay dan menyimpan deposit.
 *  3. Mengecek pemenang: deposit paling awal (created_at, id) untuk nominal + kode itu
 *     dalam 2 jam. Jika bukan kita, deposit dihapus dan kode berikutnya dicoba.
 *
 * Hanya memakai tabel `deposits` (tidak perlu tabel atau grant tambahan).
 * Env: SYAHPAY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const LOCK_MS = 2 * 60 * 60 * 1000;   // kunci kode & riwayat: 2 jam
const EXPIRE_MS = 30 * 60 * 1000;     // QRIS expired: 30 menit
const MAX_TRIES = 6;

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

/** Baca role dari JWT key. key format baru sb_secret_ dianggap service_role. */
function keyRole(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  if (k.startsWith('sb_secret_')) return 'service_role';
  try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role || null; } catch (_) { return null; }
}

/** Ambil origin saja: 'https://x.supabase.co/rest/v1/' -> 'https://x.supabase.co' */
function normalizeSupabaseUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  try { return new URL(v).origin; } catch (_) { return v.replace(/\/rest\/v1.*$/, '').replace(/\/$/, ''); }
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
}

/** Kode unik yang masih terkunci (deposit 2 jam terakhir, nominal sama, semua status). */
async function lockedCodes(url, key, amount) {
  const since = new Date(Date.now() - LOCK_MS).toISOString();
  const r = await sbFetch(url, key,
    '/rest/v1/deposits?amount=eq.' + amount +
    '&created_at=gte.' + encodeURIComponent(since) +
    '&select=unique_code&limit=1000', { method: 'GET' });
  if (!r.ok) throw new Error('baca kode terpakai gagal (HTTP ' + r.status + '): ' + (r.text || '').slice(0, 300));
  return new Set((r.json || []).map((x) => Number(x.unique_code)));
}

/** True jika deposit `rowId` adalah yang paling awal untuk nominal + kode ini dalam 2 jam. */
async function isWinner(url, key, amount, code, rowId) {
  const since = new Date(Date.now() - LOCK_MS).toISOString();
  const r = await sbFetch(url, key,
    '/rest/v1/deposits?amount=eq.' + amount +
    '&unique_code=eq.' + code +
    '&created_at=gte.' + encodeURIComponent(since) +
    '&select=id,created_at&order=created_at.asc,id.asc&limit=5', { method: 'GET' });
  if (!r.ok) throw new Error('cek pemenang kode gagal (HTTP ' + r.status + '): ' + (r.text || '').slice(0, 300));
  const first = (r.json || [])[0];
  return !!first && String(first.id) === String(rowId);
}

async function deleteDeposit(url, key, id) {
  try {
    await sbFetch(url, key, '/rest/v1/deposits?id=eq.' + encodeURIComponent(id),
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (_) {}
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST') return send(res, 405, { success: false, message: 'POST only' });

    const API_KEY = (process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY || '').trim();
    const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!API_KEY) return send(res, 500, { success: false, message: 'ENV SYAHPAY_API_KEY belum di-set di Vercel' });
    if (!SUPABASE_URL) return send(res, 500, { success: false, message: 'SUPABASE_URL belum di-set' });
    if (!SUPABASE_KEY || keyRole(SUPABASE_KEY) !== 'service_role') {
      return send(res, 500, {
        success: false,
        message: 'SUPABASE_SERVICE_ROLE_KEY tidak valid (role terbaca: ' + (keyRole(SUPABASE_KEY) || 'kosong') + '). Isi service_role key di Vercel, bukan anon key.'
      });
    }

    const body = await readBody(req);
    const amount = Math.floor(Number(body.amount) || 0);
    const userId = String(body.user_id || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!amount || amount < 1000) return send(res, 400, { success: false, message: 'Minimal deposit Rp1.000' });
    if (!userId || !email) return send(res, 400, { success: false, message: 'user_id dan email wajib' });

    await cleanupOld(SUPABASE_URL, SUPABASE_KEY);

    const adminFee = calcAdminFee(amount);
    const used = await lockedCodes(SUPABASE_URL, SUPABASE_KEY, amount);

    let chosen = null;
    for (let attempt = 0; attempt < MAX_TRIES && !chosen; attempt++) {
      let code = null;
      for (let c = 1; c <= 999; c++) { if (!used.has(c)) { code = c; break; } }
      if (code == null) break;
      used.add(code); // jangan dicoba dua kali

      const cashback = Math.floor(code * 0.1);
      const totalPay = amount + adminFee + code;
      const idempotency = 'dep-' + userId.slice(0, 8) + '-' + amount + '-' + code + '-' + Date.now() + '-' + attempt;

      // 1) Invoice SyahPay
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
          return send(res, 502, { success: false, message: 'SyahPay HTTP ' + r.status + ': ' + (spText || '').slice(0, 300) });
        }
      } catch (e) {
        return send(res, 502, { success: false, message: 'Gagal hubungi SyahPay: ' + (e.message || e) });
      }

      const invoiceId = spJson.invoice_id || spJson.id || null;
      if (!invoiceId) return send(res, 502, { success: false, message: 'invoice_id kosong', raw: spJson });

      const qrisImage = spJson.qris_image || spJson.qr_image || null;
      const paymentLink = spJson.payment_link || null;
      const expiredAt = spJson.expired_at || null;
      const expiresIso = expiredAt && !isNaN(Date.parse(expiredAt))
        ? new Date(expiredAt).toISOString()
        : new Date(Date.now() + EXPIRE_MS).toISOString();

      // 2) Simpan deposit (baris ini "mengklaim" kode)
      const ins = await sbFetch(SUPABASE_URL, SUPABASE_KEY, '/rest/v1/deposits', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          email: email,
          amount: amount,
          unique_code: code,
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
      if (!ins.ok || !Array.isArray(ins.json) || !ins.json[0]) {
        return send(res, 500, {
          success: false,
          message: 'Simpan deposit gagal (HTTP ' + ins.status + '): ' + (ins.text || '').slice(0, 300)
        });
      }
      const row = ins.json[0];

      // 3) Verifikasi pemenang kode
      const won = await isWinner(SUPABASE_URL, SUPABASE_KEY, amount, code, row.id);
      if (won) {
        chosen = { code, cashback, totalPay, invoiceId, qrisImage, paymentLink, expiresIso, expiredAt, row };
      } else {
        // kalah race: lepas baris ini, coba kode berikutnya
        await deleteDeposit(SUPABASE_URL, SUPABASE_KEY, row.id);
      }
    }

    if (!chosen) {
      return send(res, 409, {
        success: false,
        message: 'Semua kode unik 1–999 untuk nominal ini sedang terpakai (2 jam). Coba nominal lain atau beberapa menit lagi.'
      });
    }

    return send(res, 200, {
      success: true,
      provider: 'syahpay',
      invoice_id: chosen.invoiceId,
      deposit_id: chosen.row.id,
      amount: amount,
      admin_fee: adminFee,
      unique_code: chosen.code,
      cashback_unique: chosen.cashback,
      total_pay: chosen.totalPay,
      qris_image: chosen.qrisImage,
      payment_link: chosen.paymentLink,
      expired_at: chosen.expiredAt || chosen.expiresIso,
      expires_at: chosen.expiresIso,
      code_locked_until: new Date(new Date(chosen.row.created_at).getTime() + LOCK_MS).toISOString(),
      message: 'QRIS in-app · jangan redirect'
    });
  } catch (e) {
    console.error('syahpay-deposit-create', e);
    return send(res, 500, { success: false, message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e)) });
  }
};
