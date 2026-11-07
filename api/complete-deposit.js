// POST /api/complete-deposit
// Robust deposit credit — always returns JSON, never silent 500 without message

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
  const n = parseFloat(String(str).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : Math.floor(n);
}

function expectedTotal(dep) {
  const t = Math.floor(Number(dep.total_amount) || 0);
  if (t > 0) return t;
  return Math.floor(Number(dep.amount || 0) + Number(dep.unique_code || 0));
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
    'QP052692';
  const url =
    process.env.QIOSPAY_MUTASI_URL ||
    process.env.MUTASI_URL ||
    `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'Shine-Shop/1.0' },
      signal: controller.signal
    });
    const text = await r.text();
    if (!r.ok) throw new Error('Qiospay HTTP ' + r.status + ' ' + text.slice(0, 120));
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Qiospay response bukan JSON'); }
    let list = [];
    if (Array.isArray(data?.data)) list = data.data;
    else if (Array.isArray(data?.mutasi)) list = data.mutasi;
    else if (Array.isArray(data?.result)) list = data.result;
    else if (Array.isArray(data?.transactions)) list = data.transactions;
    else if (Array.isArray(data)) list = data;

    return (list || []).map((m) => {
      const amount = parseAmount(m?.amount ?? m?.nominal ?? m?.total ?? 0);
      const type = String(m?.type || m?.status || 'CR').toUpperCase();
      return {
        amount,
        refid: m?.refid ?? m?.ref ?? m?.id ?? m?.trx_id ?? null,
        type
      };
    }).filter((m) => m.amount > 0 && !['DB', 'DEBIT', 'OUT'].includes(m.type));
  } finally {
    clearTimeout(timer);
  }
}

async function creditDirect(admin, dep, mutasiRef) {
  const amount = Math.floor(Number(dep.amount) || 0);
  if (amount < 1) return { ok: false, message: 'amount deposit invalid: ' + dep.amount };

  // Re-read for race
  const { data: live, error: liveErr } = await admin
    .from('deposits')
    .select('*')
    .eq('id', dep.id)
    .maybeSingle();
  if (liveErr) return { ok: false, message: 're-read deposit: ' + liveErr.message };
  const row = live || dep;

  if (row.balance_credited === true || row.status === 'success') {
    const { data: p } = await admin.from('profiles').select('balance').eq('id', row.user_id).maybeSingle();
    return { ok: true, already: true, new_balance: p?.balance, amount };
  }

  const { data: prof, error: pErr } = await admin
    .from('profiles')
    .select('id, balance, email')
    .eq('id', row.user_id)
    .maybeSingle();
  if (pErr) return { ok: false, message: 'read profile: ' + pErr.message };
  if (!prof) return { ok: false, message: 'profile tidak ada untuk user_id ' + row.user_id };

  const next = Math.floor(Number(prof.balance) || 0) + amount;

  // Disable balance trigger via RPC if exists, else direct update
  try {
    await admin.rpc('allow_balance_write');
  } catch (_) {}

  // Try RPC first
  try {
    const { data: rpc1, error: e1 } = await admin.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: row.id,
      p_mutasi_amount: expectedTotal(row),
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });
    if (!e1 && rpc1 && rpc1.success !== false) {
      return {
        ok: true,
        via: 'rpc_mutasi',
        already: !!(rpc1.already || rpc1.already_credited),
        new_balance: rpc1.new_balance,
        amount: rpc1.amount || amount
      };
    }
  } catch (_) {}

  try {
    const { data: rpc2, error: e2 } = await admin.rpc('complete_deposit', { p_deposit_id: row.id });
    if (!e2 && rpc2 && rpc2.success !== false) {
      return {
        ok: true,
        via: 'rpc_complete',
        already: !!(rpc2.already || rpc2.already_credited),
        new_balance: rpc2.new_balance,
        amount: rpc2.amount || amount
      };
    }
  } catch (_) {}

  // Direct update — service_role bypasses RLS; trigger allows uid null
  const { error: upBal } = await admin
    .from('profiles')
    .update({ balance: next })
    .eq('id', row.user_id);
  if (upBal) {
    // Last resort: RPC set balance via SQL function that forces allow flag
    try {
      const { data: forced, error: fe } = await admin.rpc('force_credit_deposit_admin', {
        p_deposit_id: row.id,
        p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
      });
      if (!fe && forced && forced.success) {
        return { ok: true, via: 'force_rpc', new_balance: forced.new_balance, amount };
      }
      return {
        ok: false,
        message: 'Update balance gagal: ' + upBal.message + (fe ? ' | force: ' + fe.message : '') + (forced && forced.message ? ' | ' + forced.message : '')
      };
    } catch (ex) {
      return { ok: false, message: 'Update balance gagal: ' + upBal.message + ' | ' + (ex.message || '') };
    }
  }

  const patch = {
    status: 'success',
    balance_credited: true,
    paid_at: new Date().toISOString()
  };
  // optional columns
  try {
    patch.mutasi_verified = true;
    patch.credited_at = new Date().toISOString();
    if (mutasiRef) patch.mutasi_ref = String(mutasiRef);
  } catch (_) {}

  const { error: upDep } = await admin.from('deposits').update(patch).eq('id', row.id);
  if (upDep) {
    // try minimal patch
    await admin.from('deposits').update({ status: 'success', balance_credited: true }).eq('id', row.id);
  }

  try {
    await admin.from('balance_mutations').insert({
      user_id: row.user_id,
      email: row.email || prof.email,
      amount,
      type: 'deposit',
      reason: 'Deposit QRIS #' + row.id + (mutasiRef ? ' ref:' + mutasiRef : '')
    });
  } catch (_) {}

  return { ok: true, via: 'direct', new_balance: next, amount };
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
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token kosong — login ulang' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }
    body = body || {};
    const depositId = body.deposit_id || body.depositId;
    if (!depositId) {
      return res.status(400).json({ success: false, message: 'deposit_id wajib di body' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        message: 'ENV: SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel. Project Settings → API → service_role → Vercel Env → Redeploy'
      });
    }
    if (serviceKey === anon || serviceKey.length < 100) {
      return res.status(500).json({
        success: false,
        message: 'ENV: SERVICE_ROLE_KEY salah (jangan pakai anon key). Ambil service_role secret di Supabase API settings.'
      });
    }

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({
        success: false,
        message: 'Sesi invalid/expired: ' + (userErr?.message || 'login ulang')
      });
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
      return res.status(500).json({ success: false, message: 'Query deposit: ' + depErr.message });
    }
    if (!dep) {
      return res.status(404).json({ success: false, message: 'Deposit id tidak ditemukan: ' + depositId });
    }
    if (dep.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bukan deposit milik akun ini' });
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
      return res.status(400).json({ success: false, message: 'Deposit status expired — buat baru' });
    }

    const expected = expectedTotal(dep);
    if (expected < 1) {
      return res.status(400).json({
        success: false,
        message: 'total_amount/amount deposit invalid',
        amount: dep.amount,
        unique_code: dep.unique_code,
        total_amount: dep.total_amount
      });
    }

    let mutasiList;
    try {
      mutasiList = await fetchQiospayMutasi();
    } catch (e) {
      return res.status(502).json({
        success: false,
        message: 'Gagal fetch mutasi Qiospay: ' + (e.message || e),
        expected
      });
    }

    const found = mutasiList.find((m) => m.amount === expected);
    if (!found) {
      return res.status(200).json({
        success: false,
        pending: true,
        message:
          'Belum ada mutasi Rp ' +
          expected.toLocaleString('id-ID') +
          ' di Qiospay. Transfer exact nominal+unik, tunggu 10–30 dtk, Cek Status lagi.',
        expected,
        mutasi_count: mutasiList.length
      });
    }

    const credit = await creditDirect(admin, dep, found.refid);
    if (!credit.ok) {
      return res.status(500).json({
        success: false,
        message: credit.message || 'Kredit gagal',
        expected,
        mutasi_ref: found.refid
      });
    }

    try { await admin.rpc('credit_unique_share', { p_deposit_id: depositId }); } catch (_) {}
    try { await admin.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: depositId }); } catch (_) {}

    return res.status(200).json({
      success: true,
      already: !!credit.already,
      new_balance: credit.new_balance,
      amount: credit.amount,
      via: credit.via || 'ok',
      mutasi_ref: found.refid || null,
      message: 'Deposit berhasil'
    });
  } catch (e) {
    console.error('complete-deposit fatal', e);
    return res.status(500).json({
      success: false,
      message: 'Fatal: ' + (e.message || String(e))
    });
  }
}
