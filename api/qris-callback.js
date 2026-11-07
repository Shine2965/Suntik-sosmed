
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

function extractSecret(req) {
  const pathParts = (req.url || '').split('?')[0].split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1];
  if (last && !['api', 'callback', 'accept', 'qris-callback'].includes(last)) return last;
  return req.query?.secret || req.headers['x-secret-key'] || '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ success: true, message: 'qris callback alive' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'POST only' });

  try {
    const providedSecret = String(extractSecret(req) || '');
    const EXPECTED = process.env.CALLBACK_SECRET_KEY || 'Alvino11';
    if (providedSecret !== EXPECTED) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload || '{}'); } catch { payload = {}; }
    }
    payload = payload || {};
    const d = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const callbackAmount = parseAmount(d.amount ?? d.nominal ?? d.total ?? payload.amount ?? 0);
    const txType = String(d.type || payload.type || 'CR').toUpperCase();
    const mutasiRef = d.refid ?? d.ref ?? d.id ?? null;

    if (txType === 'DB' || txType === 'DEBIT') {
      return res.status(200).json({ success: true, message: 'Ignored debit' });
    }
    if (!callbackAmount || callbackAmount < 1000) {
      return res.status(400).json({ success: false, message: 'Nominal invalid', amount: callbackAmount });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || !String(serviceKey).startsWith('eyJ')) {
      return res.status(500).json({
        success: false,
        message: 'ENV SUPABASE_SERVICE_ROLE_KEY harus JWT service_role (eyJ...)'
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    let deposit = null;
    {
      const { data } = await supabase
        .from('deposits')
        .select('*')
        .eq('status', 'pending')
        .eq('total_amount', callbackAmount)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      deposit = data?.[0] || null;
    }
    if (!deposit) {
      const { data } = await supabase
        .from('deposits')
        .select('*')
        .eq('total_amount', callbackAmount)
        .or('balance_credited.eq.false,balance_credited.is.null')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      deposit = data?.[0] || null;
    }
    if (!deposit) {
      return res.status(200).json({ success: true, message: 'No matching pending deposit', amount: callbackAmount });
    }

    const { data: done, error } = await supabase.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: deposit.id,
      p_mutasi_amount: callbackAmount,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });

    if (error) {
      const { data: forced, error: fe } = await supabase.rpc('force_credit_deposit_admin', {
        p_deposit_id: deposit.id,
        p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
      });
      if (fe || !forced?.success) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.status(200).json({
        success: true,
        message: 'Deposit OK',
        deposit_id: deposit.id,
        new_balance: forced.new_balance,
        via: 'force'
      });
    }

    if (!done || done.success === false) {
      return res.status(200).json({ success: false, message: done?.message || 'rejected', result: done });
    }

    try { await supabase.rpc('credit_unique_share', { p_deposit_id: deposit.id }); } catch (_) {}
    try { await supabase.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: deposit.id }); } catch (_) {}

    return res.status(200).json({
      success: true,
      message: done.already || done.already_credited ? 'Already credited' : 'Deposit OK',
      deposit_id: deposit.id,
      amount: deposit.amount,
      new_balance: done.new_balance
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || String(e) });
  }
}
