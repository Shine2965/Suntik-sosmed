// /api/qris-callback.js
// Endpoint callback dari Qiospay
// Set di dashboard Qiospay: https://shinedomain.my.id/api/callback/accept/Alvino11

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // ===== VALIDASI SECRET KEY =====
    // URL: /api/callback/accept/Alvino11
    // Cek dari req.url path
    const urlPath = req.url || '';
    const secretFromPath = urlPath.split('/').filter(Boolean).pop();
    
    // Fallback check query & header
    const secretFromQuery = req.query?.secret;
    const secretFromHeader = req.headers['x-secret-key'];
    
    const providedSecret = secretFromPath || secretFromQuery || secretFromHeader;
    const EXPECTED_SECRET = process.env.CALLBACK_SECRET_KEY || 'Alvino11';

    console.log('📥 Callback masuk | Secret:', providedSecret, '| Expected:', EXPECTED_SECRET);

    if (providedSecret !== EXPECTED_SECRET) {
      console.warn('❌ Secret tidak cocok!');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ===== AMBIL PAYLOAD =====
    const payload = req.body || {};
    console.log('📥 QRIS Callback Payload:', JSON.stringify(payload, null, 2));

    // ===== PARSE NOMINAL =====
    // Qiospay bisa kirim: amount, nominal, total, total_amount
    const rawAmount = payload.amount ?? payload.nominal ?? payload.total ?? payload.total_amount ?? 0;
    
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

    const callbackAmount = parseAmount(rawAmount);
    console.log('💰 Nominal callback:', callbackAmount);

    if (!callbackAmount || callbackAmount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Nominal tidak valid',
        received: rawAmount
      });
    }

    // ===== KONEKSI SUPABASE UTAMA =====
    const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      return res.status(500).json({ success: false, message: 'Supabase key missing' });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===== CARI DEPOSIT PENDING YANG COCOK =====
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: deposits, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('status', 'pending')
      .eq('total_amount', callbackAmount)
      .gte('created_at', fifteenMinAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!deposits || deposits.length === 0) {
      console.log('ℹ️ Tidak ada deposit pending dengan nominal', callbackAmount);
      return res.status(200).json({
        success: true,
        message: 'Callback received, tapi tidak ada deposit yang cocok',
        amount: callbackAmount
      });
    }

    const deposit = deposits[0];
    console.log('✅ Deposit ditemukan:', deposit.id, deposit.email, deposit.amount);

    // ===== UPDATE DEPOSIT STATUS =====
    const { error: updateErr } = await supabase
      .from('deposits')
      .update({
        status: 'success',
        paid_at: new Date().toISOString()
      })
      .eq('id', deposit.id);

    if (updateErr) {
      console.error('❌ Update deposit error:', updateErr);
      return res.status(500).json({ success: false, message: updateErr.message });
    }

    // ===== TAMBAH SALDO =====
    const { data: newBalance, error: rpcErr } = await supabase.rpc('add_balance', {
      p_user_id: deposit.user_id,
      p_amount: deposit.amount
    });

    if (rpcErr) {
      console.error('❌ Add balance error:', rpcErr);
      return res.status(500).json({ success: false, message: rpcErr.message });
    }

    console.log('🎉 Deposit sukses! User:', deposit.email, '| Amount:', deposit.amount, '| New balance:', newBalance);

    return res.status(200).json({
      success: true,
      message: 'Deposit berhasil diproses',
      deposit_id: deposit.id,
      user_email: deposit.email,
      amount: deposit.amount,
      unique_code: deposit.unique_code,
      total_amount: deposit.total_amount,
      new_balance: newBalance
    });

  } catch (error) {
    console.error('❌ Callback error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
