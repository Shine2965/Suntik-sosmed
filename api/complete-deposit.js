// POST /api/complete-deposit
// Body: { deposit_id: "uuid" }
// Header: Authorization: Bearer <user access_token>
// Server verifikasi mutasi Qiospay lalu kredit via service_role

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
  const t = setTimeout(() => controller.abort(), 15000);
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
      throw new Error('Qiospay HTTP ' + r.status + (txt ? ': ' + txt.slice(0, 120) : ''));
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
        return {
          amount,
          refid: m?.refid ?? m?.ref ?? m?.id ?? m?.trx_id ?? null,
          type: String(m?.type || 'CR').toUpperCase()
        };
      })
      .filter((m) => m.amount > 0 && m.type !== 'DB' && m.type !== 'DEBIT');
  } finally {
    clearTimeout(t);
  }
}

async function creditDepositAdmin(admin, dep, mutasiAmount, mutasiRef) {
  // 1) Coba RPC
  try {
    const { data, error } = await admin.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: dep.id,
      p_mutasi_amount: mutasiAmount,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_mutasi', data };
    }
    // log but continue
    console.warn('rpc mutasi fail', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc mutasi ex', e.message);
  }

  try {
    const { data, error } = await admin.rpc('complete_deposit', { p_deposit_id: dep.id });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_complete', data };
    }
    console.warn('rpc complete fail', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc complete ex', e.message);
  }

  // 2) Fallback service_role direct (idempotent)
  if (dep.balance_credited === true || dep.status === 'success') {
    const { data: prof } = await admin.from('profiles').select('balance').eq('id', dep.user_id).maybeSingle();
    return {
      ok: true,
      via: 'already',
      data: { success: true, already: true, new_balance: prof?.balance, amount: dep.amount }
    };
  }

  const amount = Math.floor(Number(dep.amount) || 0);
  if (amount < 1) return { ok: false, message: 'Nominal deposit invalid' };

  const { data: prof, error: pErr } = await admin
    .from('profiles')
    .select('balance')
    .eq('id', dep.user_id)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!prof) return { ok: false, message: 'Profil user tidak ditemukan' };

  const next = Math.floor(Number(prof.balance) || 0) + amount;

  const { error: upBal } = await admin
    .from('profiles')
    .update({ balance: next })
    .eq('id', dep.user_id);
  if (upBal) return { ok: false, message: 'Update balance gagal: ' + upBal.message };

  const { error: upDep } = await admin
    .from('deposits')
    .update({
      status: 'success',
      balance_credited: true,
      mutasi_verified: true,
      mutasi_ref: mutasiRef ? String(mutasiRef) : null,
      paid_at: new Date().toISOString(),
      credited_at: new Date().toISOString()
    })
    .eq('id', dep.id);
  if (upDep) console.warn('update deposit', upDep.message);

  try {
    await admin.from('balance_mutations').insert({
      user_id: dep.user_id,
      email: dep.email,
      amount,
      type: 'deposit',
      reason: 'Deposit QRIS server #' + dep.id + ' ref:' + (mutasiRef || '-')
    });
  } catch (_) {}

  return {
    ok: true,
    via: 'direct_service_role',
    data: { success: true, new_balance: next, amount }
  };
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
    if (!token) return res.status(401).json({ success: false, message: 'Token wajib (login dulu)' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const depositId = body.deposit_id || body.depositId;
    if (!depositId) return res.status(400).json({ success: false, message: 'deposit_id wajib' });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        message: 'Server misconfig: SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel'
      });
    }

    // Verifikasi user
    const userClient = createClient(supabaseUrl, anon || serviceKey, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid / expired. Login ulang.' });
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

    if (depErr) {
      return res.status(500).json({ success: false, message: 'DB deposit: ' + depErr.message });
    }
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
        message: 'Sudah dikredit sebelumnya'
      });
    }

    if (dep.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Deposit sudah expired' });
    }
    if (dep.expires_at && new Date(dep.expires_at).getTime() < Date.now()) {
      try {
        await admin.from('deposits').update({ status: 'expired' }).eq('id', depositId).eq('status', 'pending');
      } catch (_) {}
      return res.status(400).json({ success: false, message: 'Deposit kadaluarsa' });
    }

    const expected = Math.floor(
      Number(dep.total_amount) ||
        Number(dep.amount || 0) + Number(dep.unique_code || 0)
    );
    if (expected < 1) {
      return res.status(400).json({ success: false, message: 'Nominal deposit invalid di DB' });
    }

    // Cek mutasi Qiospay (server-side)
    let mutasiList;
    try {
      mutasiList = await fetchQiospayMutasi();
    } catch (e) {
      return res.status(502).json({
        success: false,
        message: 'Gagal ambil mutasi Qiospay: ' + (e.message || e)
      });
    }

    const found = mutasiList.find((m) => m.amount === expected);
    if (!found) {
      return res.status(200).json({
        success: false,
        message: 'Mutasi belum terdeteksi untuk Rp ' + expected.toLocaleString('id-ID') + '. Tunggu 10–30 detik lalu Cek Status.',
        expected,
        mutasi_count: mutasiList.length
      });
    }

    const credit = await creditDepositAdmin(admin, dep, expected, found.refid);
    if (!credit.ok) {
      return res.status(500).json({
        success: false,
        message: credit.message || 'Gagal kredit saldo di server'
      });
    }

    try {
      await admin.rpc('credit_unique_share', { p_deposit_id: depositId });
    } catch (_) {}
    try {
      await admin.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: depositId });
    } catch (_) {}

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
    return res.status(500).json({
      success: false,
      message: e.message || 'Server error'
    });
  }
}
