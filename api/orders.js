/**
 * /api/orders.js — list / check status order provider
 * Env wajib:
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   FAYUPEDIA_API_KEY, FAYUPEDIA_API_ID   (sosmed-2)
 *   LOLLIPOP_API_KEY                     (sosmed-1)
 *   JURAGAN_API_KEY                      (sosmed-3/4 opsional)
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getProviders() {
  return {
    'sosmed-1': {
      endpoint: 'https://lollipop-smm.com/api/v2',
      buildPayload: (orderId) => ({
        key: process.env.LOLLIPOP_API_KEY || '',
        action: 'status',
        order: parseInt(orderId, 10)
      }),
      parseStatus: (data) =>
        data
          ? {
              status: String(data.status || '').toLowerCase(),
              start_count: parseInt(data.start_count, 10) || 0,
              remains: parseInt(data.remains, 10) || 0,
              charge: parseFloat(data.charge) || 0
            }
          : null
    },
    'sosmed-2': {
      endpoint: 'https://fayupedia.id/api/status',
      buildPayload: (orderId) => ({
        api_id: parseInt(process.env.FAYUPEDIA_API_ID || '0', 10) || 0,
        api_key: process.env.FAYUPEDIA_API_KEY || '',
        id: orderId
      }),
      parseStatus: (data) => {
        if (!data || data.status === false) return null;
        const d = data.data || data;
        return {
          status: String(d.status || data.status || '').toLowerCase(),
          start_count: parseInt(d.start_count, 10) || 0,
          remains: parseInt(d.remains, 10) || 0,
          charge: parseFloat(d.charge) || 0
        };
      }
    },
    'sosmed-3': {
      endpoint: 'https://djuragansosmed.com/api/v2',
      buildPayload: (orderId) => ({
        key: process.env.JURAGAN_API_KEY || '',
        action: 'status',
        order: orderId
      }),
      parseStatus: (data) =>
        data
          ? {
              status: String(data.status || '').toLowerCase(),
              start_count: parseInt(data.start_count, 10) || 0,
              remains: parseInt(data.remains, 10) || 0,
              charge: parseFloat(data.charge) || 0
            }
          : null
    },
    'sosmed-4': {
      endpoint: 'https://djuragansosmed.com/api/v2',
      buildPayload: (orderId) => ({
        key: process.env.JURAGAN_API_KEY || '',
        action: 'status',
        order: orderId
      }),
      parseStatus: (data) =>
        data
          ? {
              status: String(data.status || '').toLowerCase(),
              start_count: parseInt(data.start_count, 10) || 0,
              remains: parseInt(data.remains, 10) || 0,
              charge: parseFloat(data.charge) || 0
            }
          : null
    }
  };
}

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
  const PROVIDERS = getProviders();
  const provider = PROVIDERS[order.sosmed_type];
  if (!provider) return { ok: false, error: 'Provider tidak dikenal: ' + (order.sosmed_type || '-') };
  if (!order.order_id) return { ok: false, error: 'order_id kosong' };

  const payload = provider.buildPayload(order.order_id);
  if (!payload.key && !payload.api_key) {
    return { ok: false, error: 'API key provider belum di-set di ENV Vercel' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const data = await r.json();
    const parsed = provider.parseStatus(data);
    if (!parsed) return { ok: false, error: 'Respon provider tidak valid', raw: data };
    return Object.assign({ ok: true }, parsed);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({
        status: false,
        msg: 'SUPABASE_URL / SUPABASE_ANON_KEY belum di-set di Vercel ENV'
      });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ status: false, msg: 'Authorization token wajib dikirim' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ status: false, msg: 'Token tidak valid atau expired' });
    }

    const userId = user.id;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    const userRole = (profile && profile.role) || 'user';
    const isStaff = ['cs', 'admin', 'owner'].indexOf(userRole) !== -1;

    let body = {};
    if (req.method === 'POST') {
      body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
    }

    const action = String(req.query.action || body.action || 'list').toLowerCase();
    const orderTrxId = req.query.trx_id || body.trx_id;

    // Prefer orders_detail if table "orders" missing
    async function queryOrders(build) {
      let q = build(supabase.from('orders_detail').select('*'));
      let { data, error } = await q;
      if (error && /relation .* does not exist|Could not find the table/i.test(error.message || '')) {
        q = build(supabase.from('orders').select('*'));
        ({ data, error } = await q);
      }
      return { data, error };
    }

    if (action === 'list') {
      const limit = parseInt(req.query.limit, 10) || 200;
      const { data, error } = await queryOrders((base) => {
        let q = base.order('created_at', { ascending: false }).limit(limit);
        if (!isStaff) q = q.eq('user_id', userId);
        return q;
      });
      if (error) return res.status(500).json({ status: false, msg: 'DB error: ' + error.message });
      return res.status(200).json({
        status: true,
        success: true,
        orders: data || [],
        role: userRole,
        is_staff: isStaff,
        scope: isStaff ? 'all_users' : 'own_only'
      });
    }

    if (action === 'check') {
      if (!orderTrxId) return res.status(400).json({ status: false, msg: 'trx_id wajib' });

      const { data: rows, error } = await queryOrders((base) => {
        let q = base.eq('trx_id', orderTrxId);
        if (!isStaff) q = q.eq('user_id', userId);
        return q.limit(1);
      });
      if (error) return res.status(500).json({ status: false, msg: error.message });
      const order = Array.isArray(rows) ? rows[0] : rows;
      if (!order) return res.status(404).json({ status: false, msg: 'Order tidak ditemukan' });

      if (['success', 'failed', 'refunded', 'canceled'].indexOf(order.order_status) !== -1) {
        return res.status(200).json({ status: true, success: true, order, skipped: true });
      }

      const result = await checkProviderStatus(order);
      if (!result.ok) {
        return res.status(200).json({ status: true, success: true, order, check_error: result.error });
      }

      const newStatus = normalizeStatus(result.status);
      const updatePayload = {
        order_status: newStatus,
        start_count: result.start_count || order.start_count,
        remains: result.remains || order.remains,
        last_checked_at: new Date().toISOString()
      };

      // update di orders_detail dulu
      let updated = null;
      const up1 = await supabase.from('orders_detail').update(updatePayload).eq('trx_id', orderTrxId).select().maybeSingle();
      if (up1.data) updated = up1.data;
      else {
        const up2 = await supabase.from('orders').update(updatePayload).eq('trx_id', orderTrxId).select().maybeSingle();
        if (up2.data) updated = up2.data;
      }

      return res.status(200).json({
        status: true,
        success: true,
        order: updated || Object.assign({}, order, updatePayload),
        provider_status: result
      });
    }

    if (action === 'check_all') {
      const { data: orders, error } = await queryOrders((base) => {
        let q = base
          .in('order_status', ['pending', 'processing', 'partial'])
          .not('order_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(30);
        if (!isStaff) q = q.eq('user_id', userId);
        return q;
      });
      if (error) return res.status(500).json({ status: false, msg: error.message });
      if (!orders || !orders.length) return res.status(200).json({ status: true, success: true, updated: 0 });

      let updatedCount = 0;
      await Promise.all(
        orders.map(async (order) => {
          try {
            const r = await checkProviderStatus(order);
            if (!r.ok) return;
            const payload = {
              order_status: normalizeStatus(r.status),
              start_count: r.start_count || order.start_count,
              remains: r.remains || order.remains,
              last_checked_at: new Date().toISOString()
            };
            await supabase.from('orders_detail').update(payload).eq('trx_id', order.trx_id);
            await supabase.from('orders').update(payload).eq('trx_id', order.trx_id);
            updatedCount++;
          } catch (_) {}
        })
      );
      return res.status(200).json({ status: true, success: true, updated: updatedCount });
    }

    // health ping
    if (action === 'health' || action === 'ping') {
      return res.status(200).json({
        status: true,
        success: true,
        ok: true,
        has_fayupedia: !!process.env.FAYUPEDIA_API_KEY,
        has_lollipop: !!process.env.LOLLIPOP_API_KEY
      });
    }

    return res.status(400).json({ status: false, msg: 'Action tidak dikenal: ' + action });
  } catch (err) {
    console.error('orders API error', err);
    return res.status(500).json({
      status: false,
      msg: 'Server error: ' + (err.message || 'Unknown')
    });
  }
};
