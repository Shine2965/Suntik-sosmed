// /api/fayupedia-services.js
// Vercel Serverless Function - Proxy ke Fayupedia API
// Support:
//   1. Ambil daftar layanan (default)
//   2. Cek saldo (?action=balance)
//   3. Cek status pesanan (?action=status&id=...)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow GET dan POST
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
    // 🔥 ACTION: BALANCE (CEK SALDO)
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
    // 🔥 ACTION: STATUS (CEK STATUS PESANAN)
    // Support single ID atau multiple ID (dipisah koma, max 50)
    // ============================================================
    if (action === 'status') {
      // Ambil ID dari body / query — support berbagai nama parameter
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

      // Normalisasi ID: hapus spasi, trim
      let idStr = String(rawId).trim();
      
      // Validasi: pisahkan per koma, filter yang valid
      const idArray = idStr.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      if (idArray.length === 0) {
        return res.status(400).json({
          status: false,
          msg: 'Format ID tidak valid'
        });
      }

      // Batasan max 50 ID sesuai dokumentasi
      if (idArray.length > 50) {
        return res.status(400).json({
          status: false,
          msg: 'Maksimal 50 ID Pesanan per request'
        });
      }

      idStr = idArray.join(',');

      try {
        console.log(`🔍 [Fayupedia Status] Checking IDs: ${idStr}`);

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
        console.log('📥 [Fayupedia Status] Raw response:', JSON.stringify(statusData).substring(0, 800));

        // Kalau response error dari provider
        if (statusData && statusData.status === false) {
          return res.status(200).json({
            status: false,
            msg: statusData.msg || statusData.message || 'Provider menolak request',
            results: []
          });
        }

        // ===== DETEKSI BERBAGAI STRUKTUR RESPONSE =====
        // 
        // Struktur 1 (PALING UMUM — sesuai docs Fayupedia single ID):
        // {
        //   "status": true,
        //   "msg": "Pesanan ditemukan.",
        //   "order_id": 1107,
        //   "order_status": "processing",
        //   "charge": 10000,
        //   "start_count": 10,
        //   "remains": 90
        // }
        //
        // Struktur 2 (multiple ID — data array):
        // { "status": true, "msg": "...", "data": [ {id, status, ...}, ... ] }
        //
        // Struktur 3 (single di dalam data):
        // { "status": true, "msg": "...", "data": {id, status, ...} }
        //
        // Struktur 4 (data null):
        // { "status": true, "msg": "...", "data": null }

        let itemsToNormalize = [];

        // Cek 1: Ada `data` — array atau object
        if (statusData.data !== undefined && statusData.data !== null) {
          if (Array.isArray(statusData.data)) {
            itemsToNormalize = statusData.data;
          } else if (typeof statusData.data === 'object') {
            itemsToNormalize = [statusData.data];
          }
        }

        // Cek 2: Kalau `data` kosong/null, cek root punya field order (kasus utama Fayupedia)
        if (itemsToNormalize.length === 0) {
          const rootHasOrderFields = 
            statusData.order_status !== undefined ||
            statusData.order_id !== undefined ||
            statusData.remains !== undefined ||
            statusData.start_count !== undefined ||
            (typeof statusData.status === 'string' && statusData.status !== '');

          if (rootHasOrderFields) {
            // Root object itu sendiri adalah item pesanan
            itemsToNormalize = [statusData];
          }
        }

        // Cek 3: Kalau ada `results` array (dari proxy lain / wrapper)
        if (itemsToNormalize.length === 0 && Array.isArray(statusData.results)) {
          itemsToNormalize = statusData.results;
        }

        // Kalau benar-benar tidak ada data pesanan
        if (itemsToNormalize.length === 0) {
          return res.status(200).json({
            status: true,
            msg: statusData.msg || 'OK',
            count: 0,
            results: []
          });
        }

        // Normalize setiap item
        const normalizedArray = itemsToNormalize.map(item => normalizeStatusItem(item));

        return res.status(200).json({
          status: true,
          msg: statusData.msg || 'OK',
          count: normalizedArray.length,
          results: normalizedArray
        });

      } catch (fetchErr) {
        console.error('❌ Fayupedia status fetch error:', fetchErr);
        return res.status(500).json({
          status: false,
          msg: 'Gagal cek status: ' + (fetchErr.message || '')
        });
      }
    }

    // ============================================================
    // 🔥 ACTION: SERVICES (DAFTAR LAYANAN) — DEFAULT
    // ============================================================
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

    // ===== GROUP BY CATEGORY + MARKUP 7.5% =====
    const grouped = {};
    const MARKUP = 1.075;

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

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

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
// 🔧 HELPER: NORMALIZE STATUS ITEM
// Fayupedia pakai `order_status` di root, tapi kita normalisasi
// ke field `status` DAN `order_status` supaya kompatibel dengan frontend
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

  // Prioritas: order_status → orderStatus → state → status (skip boolean)
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

  // Ambil ID pesanan
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
    status: statusValue,        // kompatibel dengan frontend
    order_status: statusValue,  // juga isi order_status
    start_count: startCount,
    remains: remains,
    charge: charge,
    currency: currency,
    raw: item
  };
}
