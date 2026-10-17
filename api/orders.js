// /api/orders.js
// Ambil daftar pesanan user + auto-check status dari provider sesuai sosmed_type

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vvzgpbiesvupuhqqoxrg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2emdwYmllc3Z1cHVocXFveHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzE3MTUsImV4cCI6MjEwNzY0NzcxNX0.W3_Ck8B5Q-nEfNlsyeufJsLsTqbM8xPcAeHoAHfGRwY';

const PROVIDERS = {
  'sosmed-1': {
    endpoint: 'https://lollipop-smm.com/api/v2',
    buildPayload: (orderId) => ({ key: process.env.LOLLIPOP_API_KEY || '8c2ed537ebc1125e55be03cf722a8e0b', action: 'status', order: parseInt(orderId) }),
    parseStatus: (data) => data ? { status: (data.status || '').toLowerCase(), start_count: parseInt(data.start_count) || 0, remains: parseInt(data.remains) || 0, charge: parseFloat(data.charge) || 0 } : null
  },
  'sosmed-2': {
    endpoint: 'https://fayupedia.id/api/status',
    buildPayload: (orderId) => ({ api_id: parseInt(process.env.FAYUPEDIA_API_ID) || 5522, api_key: process.env.FAYUPEDIA_API_KEY || 'qzysdo-hzbsqd-iz9ljh-8iozzn-rucfid', id: orderId }),
    parseStatus: (data) => {
      if (!data || !data.status) return null;
      const d = data.data || data;
      return { status: (d.status || '').toLowerCase(), start_count: parseInt(d.start_count) || 0, remains: parseInt(d.remains) || 0, charge: parseFloat(d.charge) || 0 };
    }
  },
  'sosmed-3': {
    endpoint: 'https://djuragansosmed.com/api/v2',
    buildPayload: (orderId) => ({ key: process.env.JURAGAN_API_KEY || '5a675b8b637f08969edd6322edc4dd2a', action: 'status', order: orderId }),
    parseStatus: (data) => data ? { status: (data.status || '').toLowerCase(), start_count: parseInt(data.start_count) || 0, remains: parseInt(data.remains) || 0, charge: parseFloat(data.charge) || 0 } : null
  },
  'sosmed-4': {
    endpoint: 'https://djuragansosmed.com/api/v2',
    buildPayload: (orderId) => ({ key: process.env.JURAGAN_API_KEY || '5a675b8b637f08969edd6322edc4dd2a', action: 'status', order: orderId }),
    parseStatus: (data) => data ? { status: (data.status || '').toLowerCase(), start_count: parseInt(data.start_count) || 0, remains: parseInt(data.remains) || 0, charge: parseFloat(data.charge) || 0 } : null
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
    const r = await fetch(provider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(provider.buildPayload(order.order_id))
    });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const data = await r.json();
    const parsed = provider.parseStatus(data);
    if (!parsed) return { ok: false, error: 'Respon provider tidak valid', raw: data };
    return { ok: true, ...parsed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ===== AUTH =====
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    });

    let userId = null;
    let userRole = 'user';
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        userRole = profile?.role || 'user';
      }
    }

    const isStaff = ['cs', 'admin', 'owner'].includes(userRole);
    const action = String(req.query.action || req.body?.action || 'list').toLowerCase();
    const orderTrxId = req.query.trx_id || req.body?.trx_id;

    // ===== ACTION: LIST (order sendiri atau semua kalau staff) =====
    if (action === 'list') {
      if (!userId) return res.status(401).json({ status: false, msg: 'Unauthorized' });

      const limit = parseInt(req.query.limit) || 100;
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
      
      // Kalau bukan staff, filter hanya milik sendiri
      if (!isStaff) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ status: false, msg: error.message });

      return res.status(200).json({
        status: true,
        orders: data || [],
        role: userRole,
        is_staff: isStaff,
        scope: isStaff ? 'all_users' : 'own_only'
      });
    }

    // ===== ACTION: CHECK (cek 1 order — harus milik sendiri ATAU staff) =====
    if (action === 'check') {
      if (!userId) return res.status(401).json({ status: false, msg: 'Unauthorized' });
      if (!orderTrxId) return res.status(400).json({ status: false, msg: 'trx_id wajib' });

      let query = supabase.from('orders').select('*').eq('trx_id', orderTrxId);
      if (!isStaff) query = query.eq('user_id', userId);
      
      const { data: order, error } = await query.maybeSingle();
      if (error || !order) return res.status(404).json({ status: false, msg: 'Order tidak ditemukan atau bukan milik Anda' });

      if (['success', 'failed', 'refunded', 'canceled'].includes(order.order_status)) {
        return res.status(200).json({ status: true, order, skipped: true });
      }

      const result = await checkProviderStatus(order);
      if (!result.ok) {
        return res.status(200).json({ status: true, order, check_error: result.error });
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

      return res.status(200).json({ status: true, order: updated || { ...order, ...updatePayload }, provider_status: result });
    }

    // ===== ACTION: CHECK_ALL =====
    if (action === 'check_all') {
      if (!userId) return res.status(401).json({ status: false, msg: 'Unauthorized' });

      let query = supabase.from('orders').select('*')
        .in('order_status', ['pending', 'processing', 'partial'])
        .not('order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!isStaff) query = query.eq('user_id', userId);

      const { data: orders, error } = await query;
      if (error) return res.status(500).json({ status: false, msg: error.message });
      if (!orders || orders.length === 0) return res.status(200).json({ status: true, updated: 0 });

      let updatedCount = 0;
      await Promise.allSettled(orders.map(async (order) => {
        const r = await checkProviderStatus(order);
        if (!r.ok) return null;
        const newStatus = normalizeStatus(r.status);
        const payload = {
          order_status: newStatus,
          start_count: r.start_count || order.start_count,
          remains: r.remains || order.remains,
          last_checked_at: new Date().toISOString()
        };
        await supabase.from('orders').update(payload).eq('trx_id', order.trx_id);
        updatedCount++;
        return { trx_id: order.trx_id, ...payload };
      }));

      return res.status(200).json({ status: true, updated: updatedCount });
    }

    return res.status(400).json({ status: false, msg: 'Action tidak dikenal' });
  } catch (err) {
    console.error('❌ orders API error:', err);
    return res.status(500).json({ status: false, msg: err.message });
  }
}
