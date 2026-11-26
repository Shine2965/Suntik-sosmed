
/**
 * GET api/syahp/ay-deposit-cleanup
 * Menghapus riwayat deposit yang lebih dari 2 jam dan lock kode unik yang sudah kedaluwarsa.
 * Deposit paid yang belum dikredit TIDAK dihapus.
 */
const LOCK_MS = 2 * 60 * 60 * 1000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.end(JSON.stringify(body));
}

async function del(url, key, path) {
  const r = await fetch(url + path, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'return=representation' }
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: r.ok, status: r.status, count: Array.isArray(json) ? json.length : 0 };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'GET') return send(res, 405, { success: false, message: 'GET only' });

    const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, { success: false, message: 'SUPABASE env belum di-set' });
    }

    const cutoff = new Date(Date.now() - LOCK_MS).toISOString();
    const dep = await del(SUPABASE_URL, SUPABASE_KEY,
      '/rest/v1/deposits?created_at=lt.' + encodeURIComponent(cutoff) +
      '&or=(balance_credited.eq.true,status.neq.paid)');
    const lock = await del(SUPABASE_URL, SUPABASE_KEY,
      '/rest/v1/deposit_code_locks?expires_at=lt.' + encodeURIComponent(new Date().toISOString()));

    return send(res, 200, {
      success: true,
      deleted_deposits: dep.count,
      deleted_locks: lock.count,
      cutoff: cutoff
    });
  } catch (e) {
    return send(res, 500, { success: false, message: 'FUNCTION_ERROR: ' + (e.message || String(e)) });
  }
};
