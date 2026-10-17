// /api/orders.js - Vercel Serverless (CommonJS)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';

// ===== PROVIDER CONFIG =====
const PROVIDERS = {
  'sosmed-1': {
    endpoint: 'https://lollipop-smm.com/api/v2',
    buildPayload: (orderId) => ({
      key: process.env.LOLLIPOP_API_KEY || '8c2ed537ebc1125e55be03cf722a8e0b',
      action: 'status',
      order: parseInt(orderId)
    }),
    parseStatus: (data) => data ? {
      status: (data.status || '').toLowerCase(),
      start_count: parseInt(data.start_count) || 0,
      remains: parseInt(data.remains) || 0,
      charge: parseFloat(data.charge) || 0
    } : null
  },
  'sosmed-2': {
    endpoint: 'https://fayupedia.id/api/status',
    buildPayload: (orderId) => ({
      api_id: parseInt(process.env.FAYUPEDIA_API_ID) || 5522,
      api_key: process.env.FAYUPEDIA_API_KEY || 'qzysdo-hzbsqd-iz9ljh-8iozzn-rucfid',
      id: orderId
    }),
    parseStatus: (data) => {
      if (!data || !data.status) return null;
      const d = data.data || data;
      return {
        status: (d.status || '').toLowerCase(),
        start_count: parseInt(d.start_count) || 0,
        remains: parseInt(d.remains) || 0,
        charge: parseFloat(d.charge) || 0
      };
    }
  },
  'sosmed-3': {
    endpoint: 'https://djuragansosmed.com/api/v2',
    buildPayload: (orderId) => ({
      key: process.env.JURAGAN_API_KEY || '5a675b8b637f08969edd6322edc4dd2a',
      action: 'status',
      order: orderId
    }),
    parseStatus: (data) => data ? {
      status: (data.status || '').toLowerCase(),
      start_count: parseInt(data.start_count) || 0,
      remains: parseInt(data.remains) || 0,
      charge: parseFloat(data.charge) || 0
    } : null
  },
  'sosmed-4': {
    endpoint: 'https://djuragansosmed.com/api/v2',
    buildPayload: (orderId) => ({
      key: process.env.JURAGAN_API_KEY || '5a675b8b637f08969edd6322edc4dd2a',
      action: 'status',
      order: orderId
    }),
    parseStatus: (data) => data ? {
      status: (data.status || '').toLowerCase(),
      start_count: parseInt(data.start_count) || 0,
      remains: parseInt(data.remains) || 0,
      charge: parseFloat(data.charge) || 0
    } : null
  }
};

function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (['completed', 'complete', 'success', 'done', 'finished'].includes(s)) return 'success';
  if (['partial'].includes(s)) return 'partial';
  if (['canceled', 'cancelled', 'cancel', 'fail', 'failed', 'error'].includes(s)) return 'failed';
  if (['in progress', 'inprogress', 'in_progress', 'processing', 'active'].includes(s)) return 'processing';
  if (['pending', 'waiting', 'queue'].includes(s)) return 'pending';
  return s || 'pending';
}

async function checkProviderStatus(order) {
  const provider = PROVIDERS[order.sosmed_type];
  if (!provider) return { ok: false, error: 'Provider tidak dikenal' };
  if (!order.order_id) return { ok: false, error: 'order_id kosong' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const r = await fetch(provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(provider.buildPayload(order.order_id)),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const data = await r.json();
    const parsed = provider.parseStatus(data);
    if (!parsed) return { ok: false, error: 'Respon provider tidak valid', raw: data };
    return Object.assign({ ok: true }, parsed);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ===== AUTH =====
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ status: false, msg: 'Authorization token wajib dikirim' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verifikasi token
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ status: false, msg: 'Token tidak valid atau expired' });
    }

    const userId = user.id;

    // Ambil role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const userRole = (profile && profile.role) ? profile.role : 'user';
    const isStaff = ['cs', 'admin', 'owner'].indexOf(userRole) !== -1;

    // ===== PARSE ACTION =====
    let body = {};
    if (req.method === 'POST') {
      body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
    }

    const action = String(req.query.action || body.action || 'list').toLowerCase();
    const orderTrxId = req.query.trx_id || body.trx_id;

    // ===== ACTION: LIST =====
    if (action === 'list') {
      const limit = parseInt(req.query.limit) || 200;

      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
      if (!isStaff) query = query.eq('user_id', userId);

      const { data, error } = await query;
      if (error) return res.status(500).json({ status: false, msg: 'DB error: ' + error.message });

      return res.status(200).json({
        status: true,
        orders: data || [],
        role: userRole,
        is_staff: isStaff,
        scope: isStaff ? 'all_users' : 'own_only'
      });
    }

    // ===== ACTION: CHECK =====
    if (action === 'check') {
      if (!orderTrxId) return res.status(400).json({ status: false, msg: 'trx_id wajib' });

      let q = supabase.from('orders').select('*').eq('trx_id', orderTrxId);
      if (!isStaff) q = q.eq('user_id', userId);

      const { data: order, error } = await q.maybeSingle();
      if (error) return res.status(500).json({ status: false, msg: error.message });
      if (!order) return res.status(404).json({ status: false, msg: 'Order tidak ditemukan atau bukan milik Anda' });

      // Skip kalau final
      if (['success', 'failed', 'refunded', 'canceled'].indexOf(order.order_status) !== -1) {
        return res.status(200).json({ status: true, order: order, skipped: true });
      }

      const result = await checkProviderStatus(order);
      if (!result.ok) {
        return res.status(200).json({ status: true, order: order, check_error: result.error });
      }

      const newStatus = normalizeStatus(result.status);
      const updatePayload = {
        order_status: newStatus,
        start_count: result.start_count || order.start_count,
        remains: result.remains || order.remains,
        last_checked_at: new Date().toISOString()
      };

      const { data: updated } = await supabase
        .from('orders').update(updatePayload).eq('trx_id', orderTrxId).select().single();

      return res.status(200).json({
        status: true,
        order: updated || Object.assign({}, order, updatePayload),
        provider_status: result
      });
    }

    // ===== ACTION: CHECK_ALL =====
    if (action === 'check_all') {
      let q = supabase.from('orders').select('*')
        .in('order_status', ['pending', 'processing', 'partial'])
        .not('order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!isStaff) q = q.eq('user_id', userId);

      const { data: orders, error } = await q;
      if (error) return res.status(500).json({ status: false, msg: error.message });
      if (!orders || orders.length === 0) return res.status(200).json({ status: true, updated: 0 });

      let updatedCount = 0;
      await Promise.all(orders.map(async (order) => {
        try {
          const r = await checkProviderStatus(order);
          if (!r.ok) return;
          const newStatus = normalizeStatus(r.status);
          const payload = {
            order_status: newStatus,
            start_count: r.start_count || order.start_count,
            remains: r.remains || order.remains,
            last_checked_at: new Date().toISOString()
          };
          await supabase.from('orders').update(payload).eq('trx_id', order.trx_id);
          updatedCount++;
        } catch (e) {}
      }));

      return res.status(200).json({ status: true, updated: updatedCount });
    }

    return res.status(400).json({ status: false, msg: 'Action tidak dikenal: ' + action });

  } catch (err) {
    console.error('❌ orders API error:', err);
    return res.status(500).json({
      status: false,
      msg: 'Server error: ' + (err.message || 'Unknown'),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
