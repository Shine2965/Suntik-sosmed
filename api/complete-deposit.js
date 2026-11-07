// POST /api/complete-deposit
// Body: { deposit_id }
// Server: JWT user → load deposit → mutasi Qiospay → kredit service_role
// Lebih tahan gagal: retry mutasi, multi-match, fallback RPC/direct

import { createClient } from '@supabase/supabase-js';

function parseAmount(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return Math.floor(val);
  let str = String(val).trim().replace(/[Rr][Pp]/g, '').replace(/\s/g, '');
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) str = str.replace(/,/g, '');
    else str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) str = str.replace(',', '.');
    else str = str.replace(/,/g, '');
  } else if ((str.match(/\./g) || []).length > 1) {
    str = str.replace(/\./g, '');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.floor(n);
}

async function fetchQiospayMutasi() {
  const apiKey =
    process.env.QIOSPAY_API_KEY ||
    process.env.QRIS_API_KEY ||
    process.env.MUTASI_API_KEY ||
    '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
  const merchantCode =
    process.env.QIOSPAY_MERCHANT_CODE ||
    process.env.QIOSPAY_MERCHANT_ID ||
    process.env.QRIS_MERCHANT_ID ||
    'QP052692';

  const url =
    process.env.QIOSPAY_MUTASI_URL ||
    process.env.MUTASI_URL ||
    `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 18000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Shine-Shop/1.0',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error('Qiospay HTTP ' + r.status + (txt ? ': ' + txt.slice(0, 100) : ''));
    }
    const data = await r.json();
    let list = [];
    if (Array.isArray(data?.data)) list = data.data;
    else if (Array.isArray(data?.mutasi)) list = data.mutasi;
    else if (Array.isArray(data?.result)) list = data.result;
    else if (Array.isArray(data?.transactions)) list = data.transactions;
    else if (Array.isArray(data)) list = data;

    return (list || [])
      .map((m) => {
        const amount = parseAmount(m?.amount ?? m?.nominal ?? m?.total ?? 0);
        const type = String(m?.type || m?.status || 'CR').toUpperCase();
        return {
          amount,
          refid: m?.refid ?? m?.ref ?? m?.id ?? m?.trx_id ?? null,
          type,
          time: m?.time || m?.tanggal || m?.date || null
        };
      })
      .filter((m) => m.amount > 0 && m.type !== 'DB' && m.type !== 'DEBIT' && m.type !== 'OUT');
  } finally {
    clearTimeout(t);
  }
}

async function creditDepositAdmin(admin, dep, mutasiAmount, mutasiRef) {
  // RPC 1
  try {
    const { data, error } = await admin.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: dep.id,
      p_mutasi_amount: mutasiAmount,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_mutasi', data };
    }
    console.warn('rpc mutasi', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc mutasi ex', e.message);
  }

  // RPC 2
  try {
    const { data, error } = await admin.rpc('complete_deposit', { p_deposit_id: dep.id });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_complete', data };
    }
    console.warn('rpc complete', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc complete ex', e.message);
  }

  // Direct service_role (idempotent)
  const { data: fresh } = await admin.from('deposits').select('*').eq('id', dep.id).maybeSingle();
  const row = fresh || dep;
  if (row.balance_credited === true || row.status === 'success') {
    const { data: prof } = await admin.from('profiles').select('balance').eq('id', row.user_id).maybeSingle();
    return {
      ok: true,
      via: 'already',
      data: { success: true, already: true, new_balance: prof?.balance, amount: row.amount }
    };
  }

  const amount = Math.floor(Number(row.amount) || 0);
  if (amount < 1) return { ok: false, message: 'Nominal deposit invalid' };

  const { data: prof, error: pErr } = await admin
    .from('profiles')
    .select('balance')
    .eq('id', row.user_id)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!prof) return { ok: false, message: 'Profil tidak ditemukan' };

  const next = Math.floor(Number(prof.balance) || 0) + amount;

  // Re-check race
  const { data: again } = await admin
    .from('deposits')
    .select('balance_credited, status')
    .eq('id', row.id)
    .maybeSingle();
  if (again && (again.balance_credited || again.status === 'success')) {
    const { data: p2 } = await admin.from('profiles').select('balance').eq('id', row.user_id).maybeSingle();
    return { ok: true, via: 'race_already', data: { success: true, already: true, new_balance: p2?.balance } };
  }

  const { error: upBal } = await admin.from('profiles').update({ balance: next }).eq('id', row.user_id);
  if (upBal) return { ok: false, message: 'Update balance gagal: ' + upBal.message };

  await admin
    .from('deposits')
    .update({
      status: 'success',
      balance_credited: true,
      mutasi_verified: true,
      mutasi_ref: mutasiRef ? String(mutasiRef) : null,
      paid_at: new Date().toISOString(),
      credited_at: new Date().toISOString()
    })
    .eq('id', row.id);

  try {
    await admin.from('balance_mutations').insert({
      user_id: row.user_id,
      email: row.email,
      amount,
      type: 'deposit',
      reason: 'Deposit QRIS #' + row.id + ' ref:' + (mutasiRef || '-')
    });
  } catch (_) {}

  return {
    ok: true,
    via: 'direct_service_role',
    data: { success: true, new_balance: next, amount }
  };
}

function expectedTotal(dep) {
  const t = Math.floor(Number(dep.total_amount) || 0);
  if (t > 0) return t;
  return Math.floor(Number(dep.amount || 0) + Number(dep.unique_code || 0));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'POST only' });

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ success: false, message: 'Token wajib — login ulang' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const depositId = body.deposit_id || body.depositId;
    if (!depositId) return res.status(400).json({ success: false, message: 'deposit_id wajib' });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        message: 'Server: SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel'
      });
    }

    const userClient = createClient(supabaseUrl, anon || serviceKey, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesi expired — login ulang' });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: dep, error: depErr } = await admin
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .maybeSingle();

    if (depErr) return res.status(500).json({ success: false, message: 'DB: ' + depErr.message });
    if (!dep) return res.status(404).json({ success: false, message: 'Deposit tidak ditemukan' });
    if (dep.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bukan deposit Anda' });
    }

    if (dep.balance_credited === true || dep.status === 'success') {
      const { data: prof } = await admin.from('profiles').select('balance').eq('id', userId).maybeSingle();
      return res.status(200).json({
        success: true,
        already: true,
        new_balance: prof?.balance,
        message: 'Sudah dikredit'
      });
    }

    if (dep.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Deposit expired — buat deposit baru' });
    }
    if (dep.expires_at && new Date(dep.expires_at).getTime() < Date.now() - 60000) {
      // grace 1 menit
      try {
        await admin.from('deposits').update({ status: 'expired' }).eq('id', depositId).eq('status', 'pending');
      } catch (_) {}
      return res.status(400).json({ success: false, message: 'Deposit kadaluarsa' });
    }

    const expected = expectedTotal(dep);
    if (expected < 1) {
      return res.status(400).json({ success: false, message: 'Nominal deposit invalid' });
    }

    // Ambil mutasi (1x + 1 retry)
    let mutasiList = [];
    let mutasiErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        mutasiList = await fetchQiospayMutasi();
        mutasiErr = null;
        break;
      } catch (e) {
        mutasiErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (mutasiErr) {
      return res.status(502).json({
        success: false,
        message: 'Gagal ambil mutasi Qiospay: ' + (mutasiErr.message || mutasiErr),
        expected
      });
    }

    // Match exact total (unik). Juga coba amount saja jika unique 0.
    let found = mutasiList.find((m) => m.amount === expected);
    if (!found && Number(dep.unique_code) > 0) {
      // kadang user transfer exact amount tanpa unik — jangan terima (aman)
      found = null;
    }
    if (!found) {
      return res.status(200).json({
        success: false,
        pending: true,
        message:
          'Belum terdeteksi transfer Rp ' +
          expected.toLocaleString('id-ID') +
          '. Pastikan nominal + kode unik exact. Coba Cek Status 10–20 detik lagi.',
        expected,
        mutasi_count: mutasiList.length
      });
    }

    const credit = await creditDepositAdmin(admin, dep, expected, found.refid);
    if (!credit.ok) {
      return res.status(500).json({
        success: false,
        message: credit.message || 'Gagal kredit saldo'
      });
    }

    try { await admin.rpc('credit_unique_share', { p_deposit_id: depositId }); } catch (_) {}
    try { await admin.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: depositId }); } catch (_) {}

    return res.status(200).json({
      success: true,
      already: !!(credit.data && (credit.data.already || credit.data.already_credited)),
      new_balance: credit.data?.new_balance,
      amount: credit.data?.amount || dep.amount,
      via: credit.via,
      mutasi_ref: found.refid || null,
      message: 'Deposit berhasil'
    });
  } catch (e) {
    console.error('complete-deposit fatal', e);
    return res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
}
