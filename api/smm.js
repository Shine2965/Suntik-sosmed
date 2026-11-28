/**
 * Shine Shop SMM Reseller API (satu file)
 *
 * Base: POST atau GET  /api/smm
 * Auth : header x-api-key  ATAU  query/body key|api_key|apikey
 *
 * action:
 *   services  — daftar layanan (harga sudah +8% dari Fayupedia)
 *   add       — buat order  (service, target/link, quantity, custom_comments?)
 *   status    — cek status  (order)
 *   balance   — cek saldo user
 *   refill    — request refill (order)
 *
 * Env Vercel:
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  '';
const FAYU_KEY = (process.env.FAYUPEDIA_API_KEY || '').trim();
const FAYU_ID = parseInt(process.env.FAYUPEDIA_API_ID || '0', 10) || 0;
const MARKUP = Math.max(0, parseFloat(process.env.SMM_MARKUP_PCT || '8') || 8) / 100;

const FAYU_SERVICES = 'https://fayupedia.id/api/services';
const FAYU_ORDER = 'https://fayupedia.id/api/order';
const FAYU_STATUS = 'https://fayupedia.id/api/status';
const FAYU_REFILL = 'https://fayupedia.id/api/refill';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Api-Key');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function send(res, code, body) {
  cors(res);
  res.statusCode = code;
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try {
        resolve(JSON.parse(req.body || '{}'));
      } catch (_) {
        resolve({});
      }
      return;
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2e6) raw = raw.slice(0, 2e6);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function pickKey(req, body) {
  const h = req.headers || {};
  const q = req.query || {};
  return (
    h['x-api-key'] ||
    h['X-Api-Key'] ||
    (h.authorization || '').replace(/^Bearer\s+/i, '').trim() ||
    q.key ||
    q.api_key ||
    q.apikey ||
    body.key ||
    body.api_key ||
    body.apikey ||
    ''
  )
    .toString()
    .trim();
}

function markupPrice(raw) {
  const n = parseFloat(raw);
  if (!isFinite(n) || n < 0) return 0;
  return Math.ceil(n * (1 + MARKUP));
}

function sbAdmin() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function resolveApiUser(key) {
  const sb = sbAdmin();
  if (!sb) return { error: 'Server misconfigured (SUPABASE_SERVICE_ROLE_KEY)' };
  if (!key || key.length < 16) return { error: 'API key invalid' };

  const { data, error } = await sb
    .from('smm_api_keys')
    .select('id, user_id, key, is_active, label')
    .eq('key', key)
    .maybeSingle();

  if (error) return { error: 'DB: ' + error.message };
  if (!data) return { error: 'API key tidak ditemukan' };
  if (data.is_active === false) return { error: 'API key nonaktif' };

  const { data: profile, error: pe } = await sb
    .from('profiles')
    .select('id, email, balance, role, is_banned, banned')
    .eq('id', data.user_id)
    .maybeSingle();

  if (pe || !profile) return { error: 'User tidak ditemukan' };
  if (profile.is_banned || profile.banned) return { error: 'Akun dibanned' };

  return { keyRow: data, user: profile, sb };
}

async function fayuPost(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

async function getServiceRate(serviceId) {
  // Ambil rate original dari services list (cache singkat di memory process)
  if (!global.__fayuSvcCache || Date.now() - (global.__fayuSvcCacheAt || 0) > 5 * 60 * 1000) {
    const r = await fayuPost(FAYU_SERVICES, { api_id: FAYU_ID, api_key: FAYU_KEY });
    let list = [];
    if (r.json) {
      if (Array.isArray(r.json)) list = r.json;
      else if (Array.isArray(r.json.data)) list = r.json.data;
      else if (Array.isArray(r.json.services)) list = r.json.services;
    }
    global.__fayuSvcCache = list;
    global.__fayuSvcCacheAt = Date.now();
  }
  const sid = String(serviceId);
  const found = (global.__fayuSvcCache || []).find(
    (s) => String(s.service || s.id || s.service_id) === sid
  );
  if (!found) return null;
  const rate = parseFloat(found.rate || found.price || found.harga || 0) || 0;
  return { raw: found, rate, rate_markup: markupPrice(rate) };
}

function mapService(s) {
  const rate = parseFloat(s.rate || s.price || s.harga || 0) || 0;
  return {
    service: parseInt(s.service || s.id || s.service_id, 10) || s.service || s.id,
    name: s.name || s.service_name || '',
    type: s.type || s.category || '',
    category: s.category || s.type || s.category_name || '',
    rate: markupPrice(rate),
    min: parseInt(s.min, 10) || 0,
    max: parseInt(s.max, 10) || 0,
    refill: !!(s.refill === true || s.refill === 1 || s.refill === 'true')
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (!FAYU_KEY || !FAYU_ID) {
      return send(res, 500, {
        status: false,
        error: 'FAYUPEDIA_API_KEY / FAYUPEDIA_API_ID belum di-set di ENV'
      });
    }
    if (!SERVICE_KEY) {
      return send(res, 500, {
        status: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY belum di-set di ENV'
      });
    }

    const body = req.method === 'POST' ? await readBody(req) : {};
    const q = req.query || {};
    const action = String(q.action || body.action || body.act || 'services')
      .toLowerCase()
      .trim();

    // health tanpa key
    if (action === 'health' || action === 'ping') {
      return send(res, 200, {
        status: true,
        service: 'shine-smm-api',
        actions: ['services', 'add', 'status', 'balance', 'refill']
      });
    }

    const apiKey = pickKey(req, body);
    const auth = await resolveApiUser(apiKey);
    if (auth.error) return send(res, 401, { status: false, error: auth.error });

    const { user, sb, keyRow } = auth;

    // ---------- BALANCE ----------
    if (action === 'balance') {
      const { data: fresh } = await sb
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .maybeSingle();
      const bal = Number((fresh && fresh.balance) != null ? fresh.balance : user.balance) || 0;
      return send(res, 200, {
        status: true,
        balance: bal,
        currency: 'IDR',
        email: user.email
      });
    }

    // ---------- SERVICES ----------
    if (action === 'services') {
      const r = await fayuPost(FAYU_SERVICES, { api_id: FAYU_ID, api_key: FAYU_KEY });
      let list = [];
      if (r.json) {
        if (Array.isArray(r.json)) list = r.json;
        else if (Array.isArray(r.json.data)) list = r.json.data;
        else if (Array.isArray(r.json.services)) list = r.json.services;
      }
      if (!list.length && !r.ok) {
        return send(res, 502, {
          status: false,
          error: 'Gagal ambil services provider',
          detail: (r.text || '').slice(0, 200)
        });
      }
      global.__fayuSvcCache = list;
      global.__fayuSvcCacheAt = Date.now();
      const mapped = list.map(mapService);
      return send(res, 200, {
        status: true,
        count: mapped.length,
        data: mapped
      });
    }

    // ---------- ADD ORDER ----------
    if (action === 'add' || action === 'order') {
      const service = body.service || q.service || body.service_id;
      const target = body.target || body.link || q.target || q.link || '';
      const quantity = parseInt(body.quantity || body.qty || q.quantity || q.qty || 0, 10) || 0;
      const comments = body.custom_comments || body.comments || body.comment || '';

      if (!service || !target || quantity <= 0) {
        return send(res, 400, {
          status: false,
          error: 'Param wajib: service, target, quantity'
        });
      }

      const svc = await getServiceRate(service);
      if (!svc) {
        return send(res, 400, { status: false, error: 'Service ID tidak ditemukan' });
      }

      // rate Fayupedia biasanya per 1000
      const unit = svc.rate; // original per 1000
      const unitMarkup = svc.rate_markup;
      const costProvider = Math.ceil((unit * quantity) / 1000);
      const priceUser = Math.ceil((unitMarkup * quantity) / 1000);

      // Debit saldo
      const { data: prof } = await sb
        .from('profiles')
        .select('balance, email')
        .eq('id', user.id)
        .maybeSingle();
      const bal = Number(prof && prof.balance) || 0;
      if (bal < priceUser) {
        return send(res, 402, {
          status: false,
          error: 'Saldo tidak cukup',
          balance: bal,
          required: priceUser
        });
      }

      // Order ke Fayupedia
      const payload = {
        api_id: FAYU_ID,
        api_key: FAYU_KEY,
        service: parseInt(service, 10) || service,
        target: String(target),
        quantity: quantity
      };
      if (comments) payload.custom_comments = comments;

      const pr = await fayuPost(FAYU_ORDER, payload);
      const j = pr.json || {};
      const orderId =
        j.order ||
        j.order_id ||
        (j.data && (j.data.order || j.data.order_id || j.data.id)) ||
        j.id ||
        null;

      const ok = !!(pr.ok && (j.status === true || j.status === 'success' || orderId));
      if (!ok) {
        return send(res, 502, {
          status: false,
          error: (j && (j.msg || j.message || j.error)) || 'Provider menolak order',
          provider: j
        });
      }

      // Debit setelah provider OK
      const newBal = bal - priceUser;
      await sb.from('profiles').update({ balance: newBal }).eq('id', user.id);
      try {
        await sb.from('balance_mutations').insert({
          user_id: user.id,
          email: (prof && prof.email) || user.email,
          amount: -priceUser,
          type: 'purchase',
          note: 'SMM API order #' + orderId + ' service ' + service
        });
      } catch (_) {}

      // Simpan orders_detail
      const trx = 'SMM-' + Date.now() + '-' + String(orderId);
      try {
        await sb.from('orders_detail').insert({
          user_id: user.id,
          email: (prof && prof.email) || user.email,
          trx_id: trx,
          order_id: String(orderId),
          provider_order_id: String(orderId),
          service_id: String(service),
          service_name: (svc.raw && (svc.raw.name || svc.raw.service_name)) || '',
          target: String(target),
          quantity: quantity,
          total_payment: priceUser,
          provider_cost: costProvider,
          provider_charge: costProvider,
          charge: costProvider,
          order_status: 'pending',
          status: 'pending',
          sosmed_type: 'sosmed-2',
          meta: {
            source: 'smm_api',
            api_key_id: keyRow.id,
            rate_original: unit,
            rate_markup: unitMarkup,
            markup_pct: MARKUP * 100
          }
        });
      } catch (e) {
        console.warn('orders_detail insert', e.message || e);
      }

      try {
        await sb.from('smm_api_orders').insert({
          user_id: user.id,
          api_key_id: keyRow.id,
          provider_order_id: String(orderId),
          service_id: String(service),
          target: String(target),
          quantity,
          charge: priceUser,
          provider_cost: costProvider,
          status: 'pending'
        });
      } catch (_) {}

      return send(res, 200, {
        status: true,
        order: orderId,
        charge: priceUser,
        currency: 'IDR',
        balance: newBal,
        msg: 'Order #' + orderId + ' berhasil'
      });
    }

    // ---------- STATUS ----------
    if (action === 'status') {
      const orderId = body.order || body.order_id || q.order || q.order_id || body.id || q.id;
      if (!orderId) {
        return send(res, 400, { status: false, error: 'Param wajib: order' });
      }

      const r = await fayuPost(FAYU_STATUS, {
        api_id: FAYU_ID,
        api_key: FAYU_KEY,
        id: orderId
      });
      const j = r.json || {};
      const d = j.data || j;

      // sync ke DB
      const charge = parseFloat(d.charge) || 0;
      try {
        await sb
          .from('orders_detail')
          .update({
            order_status: String(d.status || '').toLowerCase() || undefined,
            status: String(d.status || '').toLowerCase() || undefined,
            start_count: parseInt(d.start_count, 10) || undefined,
            remains: parseInt(d.remains, 10) || undefined,
            charge: charge || undefined,
            provider_charge: charge || undefined,
            provider_cost: charge || undefined,
            last_checked_at: new Date().toISOString()
          })
          .eq('order_id', String(orderId));
      } catch (_) {}

      return send(res, 200, {
        status: true,
        order: orderId,
        data: {
          status: d.status || j.status || 'unknown',
          start_count: parseInt(d.start_count, 10) || 0,
          remains: parseInt(d.remains, 10) || 0,
          charge: charge,
          currency: 'IDR'
        }
      });
    }

    // ---------- REFILL ----------
    if (action === 'refill') {
      const orderId = body.order || body.order_id || q.order || q.order_id || body.id;
      if (!orderId) {
        return send(res, 400, { status: false, error: 'Param wajib: order' });
      }

      const r = await fayuPost(FAYU_REFILL, {
        api_id: FAYU_ID,
        api_key: FAYU_KEY,
        id: orderId
      });
      const j = r.json || {};
      const ok = !!(r.ok && (j.status === true || j.status === 'success' || j.refill));

      return send(res, ok ? 200 : 502, {
        status: ok,
        order: orderId,
        refill: j.refill || j.id || null,
        msg: j.msg || j.message || (ok ? 'Refill requested' : 'Refill gagal'),
        provider: j
      });
    }

    return send(res, 400, {
      status: false,
      error: 'Action tidak dikenal: ' + action,
      allowed: ['services', 'add', 'status', 'balance', 'refill']
    });
  } catch (e) {
    console.error('smm api', e);
    return send(res, 500, { status: false, error: e.message || String(e) });
  }
};
