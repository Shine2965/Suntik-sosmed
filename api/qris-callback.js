// Callback Qiospay
// URL di Qiospay: 
// Juga support: /api/qris-callback  + header/query secret

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
  } else {
    str = str.replace(/[^\d.-]/g, '');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.floor(n);
}

function extractSecret(req) {
  const url = req.url || '';
  const pathParts = url.split('?')[0].split('/').filter(Boolean);
  // /api/callback/accept/Alvino11 → last segment
  // /api/qris-callback → query/header
  const fromPath = pathParts[pathParts.length - 1];
  if (fromPath && fromPath !== 'qris-callback' && fromPath !== 'callback' && fromPath !== 'accept' && fromPath !== 'api') {
    return fromPath;
  }
  return req.query?.secret || req.headers['x-secret-key'] || '';
}

async function creditDeposit(supabase, deposit, callbackAmount, mutasiRef) {
  // 1) RPC mutasi
  try {
    const { data, error } = await supabase.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: deposit.id,
      p_mutasi_amount: callbackAmount,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_mutasi', data };
    }
    console.warn('rpc mutasi', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc mutasi ex', e.message);
  }

  // 2) RPC complete
  try {
    const { data, error } = await supabase.rpc('complete_deposit', { p_deposit_id: deposit.id });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'rpc_complete', data };
    }
    console.warn('rpc complete', error?.message || data?.message);
  } catch (e) {
    console.warn('rpc complete ex', e.message);
  }

  // 3) force_credit_deposit_admin
  try {
    const { data, error } = await supabase.rpc('force_credit_deposit_admin', {
      p_deposit_id: deposit.id,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });
    if (!error && data && data.success !== false) {
      return { ok: true, via: 'force_rpc', data };
    }
    console.warn('force rpc', error?.message || data?.message);
  } catch (e) {
    console.warn('force rpc ex', e.message);
  }

  // 4) Direct service_role update
  if (deposit.balance_credited === true || deposit.status === 'success') {
    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', deposit.user_id).maybeSingle();
    return { ok: true, via: 'already', data: { success: true, already: true, new_balance: prof?.balance } };
  }

  const amount = Math.floor(Number(deposit.amount) || 0);
  if (amount < 1) return { ok: false, message: 'amount invalid' };

  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', deposit.user_id)
    .maybeSingle();
  if (pErr) return { ok: false, message: pErr.message };
  if (!prof) return { ok: false, message: 'profile not found' };

  const next = Math.floor(Number(prof.balance) || 0) + amount;

  try { await supabase.rpc('allow_balance_write'); } catch (_) {}

  const { error: upBal } = await supabase
    .from('profiles')
    .update({ balance: next })
    .eq('id', deposit.user_id);
  if (upBal) return { ok: false, message: 'balance update: ' + upBal.message };

  await supabase
    .from('deposits')
    .update({
      status: 'success',
      balance_credited: true,
      paid_at: new Date().toISOString()
    })
    .eq('id', deposit.id);

  try {
    await supabase.from('balance_mutations').insert({
      user_id: deposit.user_id,
      email: deposit.email,
      amount,
      type: 'deposit',
      reason: 'Deposit callback QRIS #' + deposit.id + ' ref:' + (mutasiRef || '-')
    });
  } catch (_) {}

  return {
    ok: true,
    via: 'direct',
    data: { success: true, new_balance: next, amount }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET health check
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, message: 'qris callback alive' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const providedSecret = String(extractSecret(req) || '');
    // Default sama dengan URL Qiospay: .../accept/Alvino11
    const EXPECTED = process.env.CALLBACK_SECRET_KEY || 'Alvino11';
    if (providedSecret !== EXPECTED) {
      console.warn('callback unauthorized', { providedSecret, path: req.url });
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
    }
    payload = payload || {};

    const d = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const callbackAmount = parseAmount(
      d.amount ?? d.nominal ?? d.total ?? payload.amount ?? 0
    );
    const txType = String(d.type || payload.type || 'CR').toUpperCase();
    const mutasiRef = d.refid ?? d.ref ?? d.id ?? null;

    console.log('📥 Callback amount', callbackAmount, 'type', txType, 'ref', mutasiRef);

    if (txType === 'DB' || txType === 'DEBIT') {
      return res.status(200).json({ success: true, message: 'Ignored debit' });
    }
    if (!callbackAmount || callbackAmount < 1000) {
      return res.status(400).json({ success: false, message: 'Nominal invalid', amount: callbackAmount });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return res.status(500).json({
        success: false,
        message: 'Missing SUPABASE_SERVICE_ROLE_KEY di Vercel env'
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    // Match total_amount (amount + unique code)
    let deposit = null;
    {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('status', 'pending')
        .eq('total_amount', callbackAmount)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        return res.status(500).json({ success: false, message: 'DB: ' + error.message });
      }
      deposit = data?.[0] || null;
    }

    if (!deposit) {
      const { data: late } = await supabase
        .from('deposits')
        .select('*')
        .eq('total_amount', callbackAmount)
        .or('balance_credited.eq.false,balance_credited.is.null')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      deposit = late?.[0] || null;
    }

    // Fallback: match amount + unique_code computed
    if (!deposit) {
      const { data: cands } = await supabase
        .from('deposits')
        .select('*')
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(30);
      deposit = (cands || []).find((row) => {
        const total = Math.floor(
          Number(row.total_amount) ||
            Number(row.amount || 0) + Number(row.unique_code || 0)
        );
        return total === callbackAmount;
      }) || null;
    }

    if (!deposit) {
      return res.status(200).json({
        success: true,
        message: 'No matching pending deposit',
        amount: callbackAmount
      });
    }

    const credit = await creditDeposit(supabase, deposit, callbackAmount, mutasiRef);
    if (!credit.ok) {
      return res.status(500).json({
        success: false,
        message: credit.message || 'Credit failed',
        deposit_id: deposit.id
      });
    }

    try { await supabase.rpc('credit_unique_share', { p_deposit_id: deposit.id }); } catch (_) {}
    try { await supabase.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: deposit.id }); } catch (_) {}

    return res.status(200).json({
      success: true,
      message: credit.data?.already || credit.data?.already_credited ? 'Already credited' : 'Deposit OK',
      deposit_id: deposit.id,
      amount: deposit.amount,
      new_balance: credit.data?.new_balance,
      via: credit.via,
      result: credit.data
    });
  } catch (error) {
    console.error('❌ callback', error);
    return res.status(500).json({ success: false, message: error.message || String(error) });
  }
}
