// GET /api/deposit-health
// Cek env + koneksi Supabase + mutasi Qiospay (tanpa bocorkan key)

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const report = {
    ok: true,
    time: new Date().toISOString(),
    checks: {}
  };

  const supabaseUrl = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
  const anon =
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // 1) SERVICE_ROLE
  report.checks.service_role = {
    set: !!serviceKey,
    is_jwt: String(serviceKey).startsWith('eyJ'),
    length: serviceKey ? serviceKey.length : 0,
    prefix: serviceKey ? String(serviceKey).slice(0, 6) + '…' : null
  };
  if (!serviceKey || !String(serviceKey).startsWith('eyJ')) {
    report.ok = false;
    report.checks.service_role.error =
      'Harus JWT service_role (eyJ...) dari Supabase → Settings → API → service_role. Bukan sb_secret_. Redeploy setelah set.';
  }

  // 2) Anon
  report.checks.anon = {
    set: !!anon,
    is_jwt: String(anon).startsWith('eyJ')
  };

  // 3) Supabase service connection
  if (serviceKey && String(serviceKey).startsWith('eyJ')) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await admin.from('deposits').select('id, status').limit(1);
      report.checks.supabase_service = {
        ok: !error,
        error: error ? error.message : null,
        sample: data ? data.length : 0
      };
      if (error) report.ok = false;

      // Test RPC exists
      const { data: rpcData, error: rpcErr } = await admin.rpc('complete_deposit_with_mutasi', {
        p_deposit_id: '00000000-0000-0000-0000-000000000000',
        p_mutasi_amount: 1,
        p_mutasi_ref: null
      });
      report.checks.rpc_complete_deposit = {
        reachable: !rpcErr || !String(rpcErr.message || '').includes('Could not find the function'),
        message: rpcErr ? rpcErr.message : (rpcData && rpcData.message) || 'ok',
        hint: rpcErr && String(rpcErr.message || '').includes('Could not find')
          ? 'Jalankan SQL anti-fake-mutasi-deposit.sql'
          : null
      };
      if (rpcErr && String(rpcErr.message || '').includes('Could not find the function')) {
        report.ok = false;
      }
    } catch (e) {
      report.ok = false;
      report.checks.supabase_service = { ok: false, error: e.message };
    }
  } else {
    report.checks.supabase_service = { ok: false, error: 'skip — no valid service JWT' };
  }

  // 4) Qiospay mutasi
  try {
    const apiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
    const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';
    const url = `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    report.checks.qiospay = {
      http: r.status,
      ok: r.ok && (json?.status === 'success' || Array.isArray(json?.data) || Array.isArray(json)),
      mutasi_count: list.length,
      error: !r.ok ? text.slice(0, 150) : null
    };
    if (!report.checks.qiospay.ok) report.ok = false;
  } catch (e) {
    report.ok = false;
    report.checks.qiospay = { ok: false, error: e.message };
  }

  report.hint = report.ok
    ? 'Semua cek lolos. Kalau deposit masih gagal, kirim pesan error tepat saat Cek Status.'
    : 'Perbaiki item yang ok:false di atas, Redeploy, jalankan SQL jika RPC missing.';

  return res.status(200).json(report);
}
