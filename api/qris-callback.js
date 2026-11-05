// /api/qris-callback.js — Callback Qiospay

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const pathParts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const providedSecret =
      pathParts[pathParts.length - 1] ||
      req.query?.secret ||
      req.headers['x-secret-key'];
    const EXPECTED = process.env.CALLBACK_SECRET_KEY || '';
    if (!EXPECTED || providedSecret !== EXPECTED) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    const d = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const callbackAmount = parseAmount(
      d.amount ?? d.nominal ?? d.total ?? payload.amount ?? 0
    );
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
    if (!serviceKey) {
      return res.status(500).json({ success: false, message: 'Missing SERVICE_ROLE_KEY' });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Match exact total_amount (kode unik) — ambil 1 terbaru pending
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('status', 'pending')
      .eq('total_amount', callbackAmount)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return res.status(500).json({ success: false, message: error.message });

    let deposit = deposits?.[0];
    if (!deposit) {
      const { data: late } = await supabase
        .from('deposits')
        .select('*')
        .eq('total_amount', callbackAmount)
        .eq('balance_credited', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      deposit = late?.[0];
    }

    if (!deposit) {
      return res.status(200).json({
        success: true,
        message: 'No matching pending deposit',
        amount: callbackAmount
      });
    }

    // HANYA lewat RPC — tidak ada update balance manual
    const { data: done, error: doneErr } = await supabase.rpc('complete_deposit_with_mutasi', {
      p_deposit_id: deposit.id,
      p_mutasi_amount: callbackAmount,
      p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
    });

    if (doneErr) {
      console.error('RPC fail', doneErr.message);
      return res.status(500).json({ success: false, message: doneErr.message });
    }
    if (!done || done.success === false) {
      return res.status(200).json({
        success: false,
        message: done?.message || 'RPC rejected',
        result: done
      });
    }

    try {
      await supabase.rpc('credit_unique_share', { p_deposit_id: deposit.id });
    } catch (_) {}
    try {
      await supabase.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: deposit.id });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: done.already || done.already_credited ? 'Already credited' : 'Deposit OK',
      deposit_id: deposit.id,
      amount: deposit.amount,
      new_balance: done.new_balance,
      result: done
    });
  } catch (error) {
    console.error('❌ callback', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
