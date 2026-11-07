// Simpan sebagai: api/complete-deposit.js  (ganti file lama, backup dulu)

const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseAmount(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.floor(raw);
  let s = String(raw).trim().replace(/[Rr][Pp]/g, '').replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    const p = s.split(',');
    s = (p.length === 2 && p[1].length <= 2) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes('.')) {
    const p = s.split('.');
    if (p.length === 2 && p[1].length === 3 && p[0].length <= 3) s = s.replace('.', '');
    else if (p.length !== 2 || p[1].length > 2) s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.floor(n);
}

function parseTime(v) {
  if (!v) return null;
  let s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) s = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}:00+07:00`;
  else if (/^\d{4}-\d{2}-\d{2} /.test(s)) s = s.replace(' ', 'T') + '+07:00';
  const t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

function extractList(j) {
  if (!j) return [];
  const raw = j.raw;
  const cands = [j.data, j.mutasi, j.result, j.all, raw && raw.data, raw && raw.mutasi,
    raw && raw.result, raw && raw.transactions, raw];
  for (const c of cands) if (Array.isArray(c)) return c;
  return [];
}

async function sbFetch(path, opts = {}, key = SERVICE) {
  const r = await fetch(`${SB}${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  if (!SB || !ANON || !SERVICE) {
    return res.status(500).json({ success: false, message: 'Server belum dikonfigurasi (ENV Supabase)' });
  }

  try {
    // 1) Autentikasi user dari JWT
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!u.ok) return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
    const user = await u.json();

    // 2) Validasi input
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    const depositId = body && body.deposit_id;
    if (!depositId || !UUID_RE.test(depositId)) {
      return res.status(400).json({ success: false, message: 'deposit_id tidak valid' });
    }

    // 3) Ambil deposit (service role) & pastikan milik user ini
    const dr = await sbFetch(`/rest/v1/deposits?id=eq.${depositId}&select=*`);
    const dep = dr.json && dr.json[0];
    if (!dep) return res.status(404).json({ success: false, message: 'Deposit tidak ditemukan' });
    if (dep.user_id !== user.id) return res.status(403).json({ success: false, message: 'Bukan deposit Anda' });

    if (dep.status === 'success' || dep.balance_credited) {
      const pr = await sbFetch(`/rest/v1/profiles?id=eq.${user.id}&select=balance`);
      return res.status(200).json({ success: true, already: true, new_balance: pr.json && pr.json[0] && pr.json[0].balance });
    }

    const expected = Math.floor(Number(dep.total_amount) || 0);
    if (expected < 1) return res.status(400).json({ success: false, message: 'Nominal deposit tidak valid' });

    // 4) Cek mutasi di SERVER (bukan dari client)
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    let mj = null;
    try {
      const mr = await fetch(`${proto}://${host}/api/mutasi?amount=${expected}&t=${Date.now()}`, {
        cache: 'no-store', signal: ctrl.signal, headers: { Accept: 'application/json' }
      });
      mj = await mr.json().catch(() => null);
    } finally { clearTimeout(to); }

    const list = extractList(mj);
    const createdAt = new Date(dep.created_at).getTime();
    let hit = null;

    for (const m of list) {
      const amt = parseAmount(m.amount ?? m.nominal ?? m.total ?? m._amount ?? 0);
      if (amt !== expected) continue;
      const type = String(m.type || m.status || m.qris || '').trim().toUpperCase();
      if (['DB', 'DEBIT', 'OUT'].includes(type)) continue;
      const t = parseTime(m.date || m.time || m.created_at || m.datetime);
      // mutasi harus terjadi SETELAH deposit dibuat (cegah pakai pembayaran lama)
      if (t !== null && t < createdAt - 2 * 60 * 1000) continue;
      hit = m;
      break;
    }

    if (!hit) {
      return res.status(200).json({
        success: false, pending: true, expected,
        message: `Belum ada mutasi Rp ${expected.toLocaleString('id-ID')}. Pastikan nominal persis, tunggu 10-30 detik.`
      });
    }

    const ref = String(hit.refid || hit.ref || hit.id || hit.trx_id || `${expected}_${hit.date || hit.time || ''}`).slice(0, 120);

    // 5) Kredit lewat fungsi server-only (atomik, idempotent, ref unik)
    const rr = await sbFetch('/rest/v1/rpc/server_credit_deposit', {
      method: 'POST',
      body: JSON.stringify({ p_deposit_id: depositId, p_ref: ref })
    });
    if (!rr.ok) {
      const dup = /duplicate|unique/i.test(rr.text || '');
      return res.status(dup ? 409 : 500).json({
        success: false,
        message: dup ? 'Mutasi ini sudah dipakai deposit lain' : 'Gagal mengkredit saldo'
      });
    }
    const out = rr.json || {};
    if (out.success === false) return res.status(400).json({ success: false, message: out.message || 'Gagal' });
    return res.status(200).json({ success: true, new_balance: out.new_balance, already: !!out.already });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
