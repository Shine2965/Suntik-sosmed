// Callback Qiospay — TANPA SERVICE_ROLE_KEY
// URL: 

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
    const EXPECTED = process.env.CALLBACK_SECRET_KEY || process.env.DEPOSIT_SECRET || 'Alvino11';
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
    const anon =
      process.env.SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';

    const supabase = createClient(supabaseUrl, anon, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    // Cari deposit pending (anon perlu policy SELECT — fallback RPC-only match via list if needed)
    let deposit = null;
    const { data: rows, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('status', 'pending')
      .eq('total_amount', callbackAmount)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      // RLS mungkin blok select anon — coba pakai secret RPC helper kalau ada
      console.warn('select deposits', error.message);
    }
    deposit = rows?.[0] || null;

    let done, rpcErr;
    if (!deposit) {
      // RLS blok select → match by amount di dalam RPC SECURITY DEFINER
      const r = await supabase.rpc('server_complete_deposit_by_amount', {
        p_amount: callbackAmount,
        p_secret: EXPECTED,
        p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
      });
      done = r.data;
      rpcErr = r.error;
    } else {
      const r = await supabase.rpc('server_complete_deposit', {
        p_deposit_id: deposit.id,
        p_mutasi_amount: callbackAmount,
        p_secret: EXPECTED,
        p_mutasi_ref: mutasiRef ? String(mutasiRef) : null
      });
      done = r.data;
      rpcErr = r.error;
    }

    if (rpcErr) {
      return res.status(500).json({ success: false, message: rpcErr.message });
    }
    if (!done || done.success === false) {
      return res.status(200).json({ success: false, message: done?.message || 'rejected', result: done });
    }

    return res.status(200).json({
      success: true,
      message: done.already || done.already_credited ? 'Already credited' : (done.message || 'Deposit OK'),
      deposit_id: done.deposit_id || (deposit && deposit.id) || null,
      amount: done.amount || (deposit && deposit.amount) || null,
      new_balance: done.new_balance
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || String(e) });
  }
}
