// /api/qris-callback.js — Callback Qiospay (real-time)
// URL: https://shinedomain.my.id/api/callback/accept/Alvino11
// Payload: { "status":"success", "data":{ "amount":1000, "type":"CR", ... } }

import { createClient } from '@supabase/supabase-js';

function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.floor(val);
  let str = String(val).trim().replace(/[Rr][Pp]/g, '').replace(/\s/g, '');
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) str = str.replace(/,/g, '');
    else str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) str = str.replace(',', '.');
    else str = str.replace(/,/g, '');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) str = str.replace('.', '');
    else if (parts.length !== 2 || parts[1].length > 2) str = str.replace(/\./g, '');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.floor(num);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const pathParts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    const providedSecret = pathParts[pathParts.length - 1] || req.query?.secret || req.headers['x-secret-key'];
    const EXPECTED = process.env.CALLBACK_SECRET_KEY || 'Alvino11';
    if (providedSecret !== EXPECTED) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    console.log('📥 Callback:', JSON.stringify(payload).substring(0, 600));

    const d = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
    const callbackAmount = parseAmount(
      d.amount ?? d.nominal ?? d.total ?? payload.amount ?? payload.nominal ?? 0
    );
    const txType = String(d.type || payload.type || 'CR').toUpperCase();

    if (txType === 'DB' || txType === 'DEBIT') {
      return res.status(200).json({ success: true, message: 'Ignored debit' });
    }
    if (!callbackAmount || callbackAmount < 1000) {
      return res.status(400).json({ success: false, message: 'Nominal invalid', amount: callbackAmount });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) return res.status(500).json({ success: false, message: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
    const supabase = createClient(supabaseUrl, supabaseKey);

    const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('status', 'pending')
      .eq('total_amount', callbackAmount)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) return res.status(500).json({ success: false, message: error.message });
    if (!deposits?.length) {
      // Mungkin sudah success — cek juga success belum credited
      const { data: late } = await supabase
        .from('deposits')
        .select('*')
        .eq('total_amount', callbackAmount)
        .eq('balance_credited', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (late?.length) {
        const { data: done, error: e2 } = await supabase.rpc('complete_deposit', { p_deposit_id: late[0].id });
        return res.status(200).json({ success: true, message: 'Late complete', result: done, error: e2?.message });
      }
      return res.status(200).json({ success: true, message: 'No matching pending deposit', amount: callbackAmount });
    }

    const deposit = deposits[0];
    console.log('✅ Match', deposit.id, deposit.email, deposit.amount);

    // RPC atomik: status + profiles.balance + balance_mutations + balance_credited
    const { data: done, error: doneErr } = await supabase.rpc('complete_deposit', {
      p_deposit_id: deposit.id
    });

    if (!doneErr && done && done.success) {
      try { await supabase.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: deposit.id }); } catch (_) {}
      return res.status(200).json({
        success: true,
        message: done.already_credited ? 'Already credited' : 'Deposit OK',
        deposit_id: deposit.id,
        amount: deposit.amount,
        new_balance: done.new_balance,
        result: done
      });
    }

    console.warn('complete_deposit failed, fallback:', doneErr?.message || done);

    // Fallback service-role direct
    await supabase.from('deposits').update({ status: 'success', paid_at: new Date().toISOString() }).eq('id', deposit.id);
    const { data: prof } = await supabase.from('profiles').select('balance').eq('id', deposit.user_id).maybeSingle();
    const next = (parseFloat(prof?.balance) || 0) + (parseFloat(deposit.amount) || 0);
    const { error: upErr } = await supabase.from('profiles').update({ balance: next }).eq('id', deposit.user_id);
    if (upErr) return res.status(500).json({ success: false, message: upErr.message });
    try {
      await supabase.from('balance_mutations').insert({
        user_id: deposit.user_id,
        email: deposit.email,
        amount: deposit.amount,
        type: 'deposit',
        reason: `Deposit QRIS sukses (unik: ${deposit.unique_code})`
      });
    } catch (_) {}
    try {
      await supabase.from('deposits').update({ balance_credited: true }).eq('id', deposit.id);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Deposit OK (fallback)',
      deposit_id: deposit.id,
      amount: deposit.amount,
      new_balance: next
    });
  } catch (error) {
    console.error('❌', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
