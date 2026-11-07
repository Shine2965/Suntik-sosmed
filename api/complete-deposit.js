// POST /api/complete-deposit
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
  } else str = str.replace(/[^\d.-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.floor(n);
}

function expectedTotal(dep) {
  const t = Math.floor(Number(dep.total_amount) || 0);
  if (t > 0) return t;
  return Math.floor(Number(dep.amount || 0) + Number(dep.unique_code || 0));
}

async function fetchQiospayMutasi() {
  const apiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
  const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';
  const url = process.env.QIOSPAY_MUTASI_URL || `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal
    });
    if (!r.ok) throw new Error('Qiospay HTTP ' + r.status);
    const data = await r.json();
    let list = [];
    if (Array.isArray(data?.data)) list = data.data;
    else if (Array.isArray(data?.mutasi)) list = data.mutasi;
    else if (Array.isArray(data?.result)) list = data.result;
    else if (Array.isArray(data)) list = data;
    return (list || []).map((m) => ({
      amount: parseAmount(m?.amount ?? m?.nominal ?? m?.total ?? 0),
      refid: m?.refid ?? m?.ref ?? m?.id ?? null,
      type: String(m?.type || 'CR').toUpperCase()
    })).filter((m) => m.amount > 0 && !['DB', 'DEBIT', 'OUT'].includes(m.type));
  } finally {
    clearTimeout(timer);
  }
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
    if (!token) return res.status(401).json({ success: false, message: 'Login dulu' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }
    const depositId = body?.deposit_id || body?.depositId;
    if (!depositId) return res.status(400).json({ success: false, message: 'deposit_id wajib' });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const anon =
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        message: 'ENV: set SUPABASE_SERVICE_ROLE_KEY = JWT service_role (eyJ...) di Vercel, lalu Redeploy'
      });
    }
    if (!String(serviceKey).startsWith('eyJ')) {
      return res.status(500).json({
        success: false,
        message: 'ENV: SERVICE_ROLE_KEY harus JWT (eyJ...), bukan sb_secret_'
      });
    }

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesi invalid — login ulang' });
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
      return res.status(400).json({ success: false, message: 'Deposit expired' });
    }

    const expected = expectedTotal(dep);
    if (expected < 1) {
      return res.status(400).json({ success: false, message: 'Nominal deposit invalid' });
    }

    // WAJIB: mutasi dari Qiospay di SERVER (bukan data client)
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
          ' di Qiospay. Bayar exact, tunggu, Cek Status lagi.',
        expected,
        mutasi_count: mutasiList.length
      });
    }

    const { data: done, error: rpcErr } = await admin.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: depositId,
      p_mutasi_amount: expected,
      p_mutasi_ref: found.refid ? String(found.refid) : null
    });

    if (rpcErr) {
      // fallback force
      const { data: forced, error: fe } = await admin.rpc('force_credit_deposit_admin', {
        p_deposit_id: depositId,
        p_mutasi_ref: found.refid ? String(found.refid) : null
      });
      if (fe || !forced || forced.success === false) {
        return res.status(500).json({
          success: false,
          message: rpcErr.message + (fe ? ' | ' + fe.message : '') + (forced?.message ? ' | ' + forced.message : '')
        });
      }
      return res.status(200).json({
        success: true,
        already: !!(forced.already || forced.already_credited),
        new_balance: forced.new_balance,
        amount: forced.amount,
        via: 'force_after_mutasi_ok',
        message: 'Deposit berhasil'
      });
    }

    if (!done || done.success === false) {
      return res.status(400).json({
        success: false,
        message: done?.message || 'Kredit ditolak',
        result: done
      });
    }

    try { await admin.rpc('credit_unique_share', { p_deposit_id: depositId }); } catch (_) {}
    try { await admin.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: depositId }); } catch (_) {}

    return res.status(200).json({
      success: true,
      already: !!(done.already || done.already_credited),
      new_balance: done.new_balance,
      amount: done.amount,
      via: 'complete_deposit_with_mutasi',
      mutasi_ref: found.refid || null,
      message: 'Deposit berhasil'
    });
  } catch (e) {
    console.error('complete-deposit', e);
    return res.status(500).json({ success: false, message: e.message || String(e) });
  }
}
