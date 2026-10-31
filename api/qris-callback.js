// /api/qris-callback.js  (atau /api/callback/accept/[secret].js)
// Callback real-time dari Qiospay saat dana masuk.
// Dashboard: https://shinedomain.my.id/api/callback/accept/Alvino11
//
// Payload: { "status": "success", "data": { "amount": 1000, "type": "CR", "refid": 295094156, ... } }

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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const urlPath = (req.url || '').split('?')[0];
    const pathParts = urlPath.split('/').filter(Boolean);
    const secretFromPath = pathParts[pathParts.length - 1];
    const providedSecret = secretFromPath || req.query?.secret || req.headers['x-secret-key'];
    const EXPECTED_SECRET = process.env.CALLBACK_SECRET_KEY || 'Alvino11';

    console.log('📥 Callback | secret:', providedSecret);
    if (providedSecret !== EXPECTED_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    console.log('📥 Payload:', JSON.stringify(payload).substring(0, 800));

    // Nested data (format resmi) ATAU flat
    const d = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
    const rawAmount =
      d.amount ?? d.nominal ?? d.total ?? d.total_amount ??
      payload.amount ?? payload.nominal ?? payload.total ?? payload.total_amount ?? 0;

    const callbackAmount = parseAmount(rawAmount);
    const txType = String(d.type || payload.type || 'CR').toUpperCase();
    const refid = d.refid ?? d.issuer_reff ?? d.buyer_reff ?? payload.refid ?? null;

    console.log('💰 Amount:', callbackAmount, '| type:', txType, '| ref:', refid);

    if (txType === 'DB' || txType === 'DEBIT') {
      return res.status(200).json({ success: true, message: 'Ignored debit', amount: callbackAmount });
    }

    if (!callbackAmount || callbackAmount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Nominal tidak valid',
        received: rawAmount,
        parsed: callbackAmount
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      return res.status(500).json({ success: false, message: 'Supabase key missing — set SUPABASE_SERVICE_ROLE_KEY' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const windowAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('status', 'pending')
      .eq('total_amount', callbackAmount)
      .gte('created_at', windowAgo)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Supabase select:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!deposits || deposits.length === 0) {
      console.log('ℹ️ Tidak ada deposit pending nominal', callbackAmount);
      return res.status(200).json({
        success: true,
        message: 'Callback received, no matching pending deposit',
        amount: callbackAmount
      });
    }

    const deposit = deposits[0];
    console.log('✅ Match deposit:', deposit.id, deposit.email, deposit.amount);

    // Atomic claim
    const { data: claimed, error: claimErr } = await supabase
      .from('deposits')
      .update({ status: 'success', paid_at: new Date().toISOString() })
      .eq('id', deposit.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.error('Claim error:', claimErr);
      return res.status(500).json({ success: false, message: claimErr.message });
    }

    if (!claimed) {
      return res.status(200).json({
        success: true,
        message: 'Already processed',
        deposit_id: deposit.id
      });
    }

    let creditOk = false;
    let creditDetail = null;

    // 1) add_user_balance (sama frontend)
    try {
      const { data: bal1, error: e1 } = await supabase.rpc('add_user_balance', {
        p_target_email: deposit.email,
        p_amount: deposit.amount,
        p_reason: `Deposit QRIS sukses (unik: ${deposit.unique_code}${refid ? ', ref:' + refid : ''})`
      });
      if (!e1 && (!bal1 || bal1.success !== false)) {
        creditOk = true;
        creditDetail = bal1;
        console.log('✅ add_user_balance OK', bal1);
      } else {
        console.warn('add_user_balance:', e1?.message || bal1);
      }
    } catch (e) {
      console.warn('add_user_balance ex:', e.message);
    }

    // 2) add_balance fallback
    if (!creditOk) {
      try {
        const { data: bal2, error: e2 } = await supabase.rpc('add_balance', {
          p_user_id: deposit.user_id,
          p_amount: deposit.amount
        });
        if (!e2) {
          creditOk = true;
          creditDetail = bal2;
          console.log('✅ add_balance OK', bal2);
        } else console.warn('add_balance:', e2.message);
      } catch (e) {
        console.warn('add_balance ex:', e.message);
      }
    }

    // 3) direct profiles update (service role)
    if (!creditOk) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', deposit.user_id)
          .maybeSingle();
        const next = (parseFloat(prof?.balance) || 0) + (parseFloat(deposit.amount) || 0);
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ balance: next })
          .eq('id', deposit.user_id);
        if (!upErr) {
          creditOk = true;
          creditDetail = { balance: next, method: 'direct_update' };
          console.log('✅ direct balance OK', next);
        } else console.error('direct update fail', upErr);
      } catch (e) {
        console.error('direct update ex', e.message);
      }
    }

    if (!creditOk) {
      await supabase.from('deposits').update({ status: 'pending', paid_at: null }).eq('id', deposit.id);
      return res.status(500).json({
        success: false,
        message: 'Gagal kredit saldo — deposit dikembalikan ke pending'
      });
    }

    try {
      await supabase.rpc('pay_referral_bonus_for_deposit', { p_deposit_id: deposit.id });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Deposit berhasil diproses',
      deposit_id: deposit.id,
      user_email: deposit.email,
      amount: deposit.amount,
      unique_code: deposit.unique_code,
      total_amount: deposit.total_amount,
      credit: creditDetail
    });
  } catch (error) {
    console.error('❌ Callback error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
