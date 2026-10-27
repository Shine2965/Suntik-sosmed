// /api/fayupedia-services.js
// Vercel Serverless Function - Proxy ke Fayupedia API
// Support:
//   1. Ambil daftar layanan (default) — markup dari settings HTML (markup_sosmed2)
//   2. Cek saldo (?action=balance)
//   3. Cek status pesanan (?action=status&id=...)
//
// Markup sumber (prioritas):
//   1. Query/body: markup / markup_percent / percent  (contoh ?markup=10)
//   2. Supabase settings key: markup_sosmed2  (diset di HTML Owner)
//   3. Env: FAYUPEDIA_MARKUP_PERCENT
//   4. Default: 7.5

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      msg: 'Method not allowed. Use GET or POST'
    });
  }

  try {
    const apiId = parseInt(process.env.FAYUPEDIA_API_ID) || 5522;
    const apiKey = process.env.FAYUPEDIA_API_KEY || 'qzysdo-hzbsqd-iz9ljh-8iozzn-rucfid';

    if (!apiKey) {
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap (FAYUPEDIA_API_KEY missing)'
      });
    }

    // ===== PARSE BODY (untuk POST) =====
    let body = {};
    if (req.method === 'POST') {
      body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
    }

    // ===== DETECT ACTION (dari query atau body) =====
    const action = String(
      body.action ||
      (req.query && req.query.action) ||
      'services'
    ).toLowerCase().trim();

    // ============================================================
    // ACTION: BALANCE
    // ============================================================
    if (action === 'balance') {
      const balanceResponse = await fetch('https://fayupedia.id/api/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          api_id: apiId,
          api_key: apiKey
        })
      });

      if (!balanceResponse.ok) {
        const text = await balanceResponse.text().catch(() => '');
        console.error('Fayupedia balance HTTP error:', balanceResponse.status, text);
        return res.status(502).json({
          status: false,
          msg: `Gagal menghubungi provider (HTTP ${balanceResponse.status})`
        });
      }

      const balanceData = await balanceResponse.json();

      if (!balanceData.status) {
        return res.status(502).json({
          status: false,
          msg: balanceData.msg || 'Respon provider tidak valid'
        });
      }

      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

      return res.status(200).json({
        status: true,
        msg: balanceData.msg || 'OK',
        balance: Number(balanceData.balance) || 0
      });
    }

    // ============================================================
    // ACTION: STATUS
    // ============================================================
    if (action === 'status') {
      const rawId =
        body.id ||
        body.order_id ||
        body.order ||
        body.ids ||
        (req.query && (req.query.id || req.query.order_id || req.query.order || req.query.ids));

      if (!rawId) {
        return res.status(400).json({
          status: false,
          msg: 'Parameter "id" wajib diisi (bisa single atau multiple dipisah koma)'
        });
      }

      let idStr = String(rawId).trim();
      const idArray = idStr.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (idArray.length === 0) {
        return res.status(400).json({
          status: false,
          msg: 'Format ID tidak valid'
        });
      }

      if (idArray.length > 50) {
        return res.status(400).json({
          status: false,
          msg: 'Maksimal 50 ID Pesanan per request'
        });
      }

      idStr = idArray.join(',');

      try {
        console.log(`[Fayupedia Status] Checking IDs: ${idStr}`);

        const statusResponse = await fetch('https://fayupedia.id/api/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            api_id: apiId,
            api_key: apiKey,
            id: idStr
          })
        });

        if (!statusResponse.ok) {
          const text = await statusResponse.text().catch(() => '');
          console.error('Fayupedia status HTTP error:', statusResponse.status, text);
          return res.status(502).json({
            status: false,
            msg: `Gagal menghubungi provider (HTTP ${statusResponse.status})`,
            error: text
          });
        }

        const statusData = await statusResponse.json();
        console.log('[Fayupedia Status] Raw response:', JSON.stringify(statusData).substring(0, 800));

        if (statusData && statusData.status === false) {
          return res.status(200).json({
            status: false,
            msg: statusData.msg || statusData.message || 'Provider menolak request',
            results: []
          });
        }

        let itemsToNormalize = [];

        if (statusData.data !== undefined && statusData.data !== null) {
          if (Array.isArray(statusData.data)) {
            itemsToNormalize = statusData.data;
          } else if (typeof statusData.data === 'object') {
            itemsToNormalize = [statusData.data];
          }
        }

        if (itemsToNormalize.length === 0) {
          const rootHasOrderFields =
            statusData.order_status !== undefined ||
            statusData.order_id !== undefined ||
            statusData.remains !== undefined ||
            statusData.start_count !== undefined ||
            (typeof statusData.status === 'string' && statusData.status !== '');

          if (rootHasOrderFields) {
            itemsToNormalize = [statusData];
          }
        }

        if (itemsToNormalize.length === 0 && Array.isArray(statusData.results)) {
          itemsToNormalize = statusData.results;
        }

        if (itemsToNormalize.length === 0) {
          return res.status(200).json({
            status: true,
            msg: statusData.msg || 'OK',
            count: 0,
            results: []
          });
        }

        const normalizedArray = itemsToNormalize.map(item => normalizeStatusItem(item));

        return res.status(200).json({
          status: true,
          msg: statusData.msg || 'OK',
          count: normalizedArray.length,
          results: normalizedArray
        });

      } catch (fetchErr) {
        console.error('Fayupedia status fetch error:', fetchErr);
        return res.status(500).json({
          status: false,
          msg: 'Gagal cek status: ' + (fetchErr.message || '')
        });
      }
    }

    // ============================================================
    // ACTION: SERVICES (DEFAULT) — markup dinamis dari HTML settings
    // ============================================================
    const markupPercent = await resolveMarkupPercent(req, body);
    const MARKUP = 1 + (markupPercent / 100);
    console.log(`[Fayupedia Services] markup_percent=${markupPercent} → multiplier=${MARKUP}`);

    const servicesResponse = await fetch('https://fayupedia.id/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        api_id: apiId,
        api_key: apiKey
      })
    });

    if (!servicesResponse.ok) {
      const text = await servicesResponse.text().catch(() => '');
      console.error('Fayupedia services HTTP error:', servicesResponse.status, text);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${servicesResponse.status})`
      });
    }

    const data = await servicesResponse.json();

    if (!data.status || !Array.isArray(data.services)) {
      console.error('Fayupedia response invalid:', data);
      return res.status(502).json({
        status: false,
        msg: data.msg || 'Respon provider tidak valid'
      });
    }

    const grouped = {};

    for (const s of data.services) {
      const category = (s.category || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply';

      const rawPrice = Number(s.price) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      grouped[category].push({
        id: s.id,
        name: s.name || `Service #${s.id}`,
        pricePerFollower: markedUpPrice,
        rawPricePerFollower: rawPrice,
        min: Number(s.min) || 1,
        max: Number(s.max) || 1000000,
        average: s.average || '-',
        desc: s.description || '',
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === 1 || s.refill === true
      });
    }

    const sorted = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .forEach((cat) => {
        sorted[cat] = grouped[cat].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'id')
        );
      });

    // cache pendek supaya ganti markup cepat kelihatan
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.setHeader('X-Markup-Percent', String(markupPercent));

    // meta opsional (frontend boleh ignore)
    if (req.query && (req.query.meta === '1' || req.query.meta === 'true')) {
      return res.status(200).json({
        status: true,
        markup_percent: markupPercent,
        markup_multiplier: MARKUP,
        services: sorted
      });
    }

    return res.status(200).json(sorted);

  } catch (error) {
    console.error('Error fayupedia-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}

// ============================================================
// MARKUP: resolve dari query/body → Supabase settings → env → default
// ============================================================
function parsePercent(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace('%', '').replace(',', '.').trim());
  if (isNaN(n) || n < 0 || n > 500) return null;
  return n;
}

async function resolveMarkupPercent(req, body) {
  // 1) explicit dari request (HTML bisa kirim)
  const fromReq = parsePercent(
    (body && (body.markup ?? body.markup_percent ?? body.percent ?? body.markupPercent)) ??
    (req.query && (req.query.markup ?? req.query.markup_percent ?? req.query.percent))
  );
  if (fromReq != null) return fromReq;

  // 2) dari Supabase settings (key sama dengan HTML: markup_sosmed2)
  try {
    const fromDb = await fetchMarkupFromSupabase('markup_sosmed2');
    if (fromDb != null) return fromDb;
  } catch (e) {
    console.warn('fetchMarkupFromSupabase:', e.message || e);
  }

  // 3) env
  const fromEnv = parsePercent(process.env.FAYUPEDIA_MARKUP_PERCENT);
  if (fromEnv != null) return fromEnv;

  // 4) default 7.5%
  return 7.5;
}

async function fetchMarkupFromSupabase(settingKey) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // prioritaskan service role; fallback anon (kalau RLS izinkan read settings)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/settings?key=eq.${encodeURIComponent(settingKey)}&select=value&limit=1`;
  const resp = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.warn('Supabase settings HTTP', resp.status, t);
    return null;
  }

  const rows = await resp.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return parsePercent(rows[0].value);
}

// ============================================================
// NORMALIZE STATUS ITEM
// ============================================================
function normalizeStatusItem(item) {
  if (!item || typeof item !== 'object') {
    return {
      id: null,
      status: 'Unknown',
      order_status: 'Unknown',
      start_count: 0,
      remains: 0,
      charge: 0,
      currency: 'IDR',
      raw: item
    };
  }

  let statusValue = null;
  const tryFields = ['order_status', 'orderStatus', 'state', 'status'];
  for (const f of tryFields) {
    const v = item[f];
    if (v !== undefined && v !== null && typeof v !== 'boolean' && String(v).trim() !== '') {
      statusValue = String(v).trim();
      break;
    }
  }
  if (!statusValue) statusValue = 'Unknown';

  const id =
    item.id ??
    item.order ??
    item.order_id ??
    item.OrderId ??
    null;

  const startCount =
    parseInt(item.start_count ?? item.startCount ?? item.start ?? 0) || 0;

  const remains =
    parseInt(item.remains ?? item.remains_count ?? item.remaining ?? 0) || 0;

  const charge =
    parseFloat(item.charge ?? item.price ?? item.cost ?? 0) || 0;

  const currency = item.currency ?? 'IDR';

  return {
    id: id ? String(id) : null,
    status: statusValue,
    order_status: statusValue,
    start_count: startCount,
    remains: remains,
    charge: charge,
    currency: currency,
    raw: item
  };
}
