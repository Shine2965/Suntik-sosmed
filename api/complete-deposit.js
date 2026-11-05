// POST /api/complete-deposit
// Body: { deposit_id: "uuid" }
// Header: Authorization: Bearer <user access_token>
// Server: verifikasi JWT user → load deposit → cek mutasi Qiospay → complete_deposit (service_role)

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
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.floor(n);
}

async function fetchQiospayMutasi() {
  const id = process.env.QIOSPAY_MERCHANT_ID || process.env.QRIS_MERCHANT_ID;
  const key = process.env.QIOSPAY_API_KEY || process.env.QRIS_API_KEY || process.env.MUTASI_API_KEY;
  const base = process.env.QIOSPAY_MUTASI_URL || process.env.MUTASI_URL || '';
  if (!base && (!id || !key)) {
    throw new Error('Qiospay env belum diset (QIOSPAY_MUTASI_URL / QIOSPAY_MERCHANT_ID + API_KEY)');
  }
  let url = base;
  if (!url) {
    url = `https://qiospay.id/api/mutasi/${encodeURIComponent(id)}/${encodeURIComponent(key)}`;
  } else {
    url = url.replace('{id}', id || '').replace('{key}', key || '');
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
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
    return list.map((m) => {
      const amount = parseAmount(m?.amount ?? m?.nominal ?? m?.total ?? 0);
      return {
        amount,
        refid: m?.refid ?? m?.ref ?? m?.id ?? m?.trx_id ?? null,
        type: String(m?.type || 'CR').toUpperCase(),
        raw: m
      };
    }).filter((m) => m.amount > 0 && m.type !== 'DB' && m.type !== 'DEBIT');
  } finally {
    clearTimeout(t);
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
    if (!token) return res.status(401).json({ success: false, message: 'Token wajib' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const depositId = body.deposit_id || body.depositId;
    if (!depositId) return res.status(400).json({ success: false, message: 'deposit_id wajib' });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const anon = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(500).json({ success: false, message: 'Missing SERVICE_ROLE_KEY' });

    // Verifikasi user dari JWT
    const userClient = createClient(supabaseUrl, anon || serviceKey, {
      global: { headers: { Authorization: 'Bearer ' + token } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: dep, error: depErr } = await admin
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .maybeSingle();

    if (depErr) return res.status(500).json({ success: false, message: depErr.message });
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
    if (dep.expires_at && new Date(dep.expires_at).getTime() < Date.now()) {
      try {
        await admin.from('deposits').update({ status: 'expired' }).eq('id', depositId).eq('status', 'pending');
      } catch (_) {}
      return res.status(400).json({ success: false, message: 'Deposit sudah kadaluarsa' });
    }

    const expected = Math.floor(
      Number(dep.total_amount) ||
      (Number(dep.amount || 0) + Number(dep.unique_code || 0))
    );
    if (expected < 1) {
      return res.status(400).json({ success: false, message: 'Nominal deposit invalid' });
    }

    // WAJIB cek mutasi Qiospay di server (bukan data client)
    const mutasiList = await fetchQiospayMutasi();
    const found = mutasiList.find((m) => m.amount === expected);
    if (!found) {
      return res.status(200).json({
        success: false,
        message: 'Mutasi belum terdeteksi di Qiospay',
        expected
      });
    }

    const { data: done, error: rpcErr } = await admin.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: depositId,
      p_mutasi_amount: expected,
      p_mutasi_ref: found.refid ? String(found.refid) : null
    });

    if (rpcErr) {
      return res.status(500).json({ success: false, message: rpcErr.message });
    }
    if (!done || done.success === false) {
      return res.status(400).json({
        success: false,
        message: (done && done.message) || 'Gagal kredit deposit'
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
      already: !!done.already,
      new_balance: done.new_balance,
      amount: done.amount,
      mutasi_ref: found.refid || null,
      message: 'Deposit berhasil'
    });
  } catch (e) {
    console.error('complete-deposit', e);
    return res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
}
