// /api/irvankede-services.js
// Vercel Serverless Function - Proxy ke Irvankede SMM API
// Endpoint: https://irvankedesmm.co.id/api/services (POST)
// Markup harga 5%, group by category
// Harga provider = per 1.000 unit

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: false,
      msg: 'Method not allowed'
    });
  }

  try {
    const apiId = parseInt(process.env.IRVANKARDE_API_ID || process.env.IRVANKEDE_API_ID) || 81074;
    const apiKey =
      process.env.IRVANKARDE_API_KEY ||
      process.env.IRVANKEDE_API_KEY ||
      '';

    if (!apiKey) {
      console.error('IRVANKARDE_API_KEY / IRVANKEDE_API_KEY tidak ditemukan di environment');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap (IRVANKARDE_API_KEY missing)'
      });
    }

    // POST ke Irvankede — coba JSON dulu
    let response = await fetch('https://irvankedesmm.co.id/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'ShineShop-Proxy/1.0'
      },
      body: JSON.stringify({
        api_id: apiId,
        api_key: apiKey
      })
    });

    // Fallback form-urlencoded jika JSON ditolak / HTML
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || ct.includes('text/html')) {
      response = await fetch('https://irvankedesmm.co.id/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'ShineShop-Proxy/1.0'
        },
        body: new URLSearchParams({
          api_id: String(apiId),
          api_key: apiKey
        }).toString()
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Irvankede API HTTP error:', response.status, text.slice(0, 500));
      return res.status(502).json({
        status: false,
        msg: 'Gagal menghubungi provider (HTTP ' + response.status + ')'
      });
    }

    const data = await response.json();

    // Support beberapa bentuk respon panel Indo:
    // { status: true, services: [...] }
    // { status: true, data: [...] }
    // { success: true, data: [...] }
    // langsung array
    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(data.services)) {
      list = data.services;
    } else if (Array.isArray(data.data)) {
      list = data.data;
    } else {
      console.error('Irvankede response invalid:', JSON.stringify(data).slice(0, 400));
      return res.status(502).json({
        status: false,
        msg: data.msg || data.message || data.error || 'Respon provider tidak valid'
      });
    }

    if (data.status === false || data.success === false) {
      return res.status(502).json({
        status: false,
        msg: data.msg || data.message || data.error || 'Kredensial tidak valid / provider error'
      });
    }

    const grouped = {};
    const MARKUP = 1.05; // +5%

    for (const s of list) {
      const category = String(s.category || s.category_name || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) grouped[category] = [];

      const type = String(s.type || s.service_type || 'default').toLowerCase();
      const name = String(s.name || s.service || s.service_name || ('Service #' + s.id)).trim();
      const desc = String(s.description || s.desc || s.note || s.notes || '').trim();

      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply' ||
        /komentar|comment/i.test(name);

      // Harga Irvankede = per 1.000 unit
      const rawPrice = Number(s.price ?? s.rate ?? s.harga) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      grouped[category].push({
        id: s.id ?? s.service_id,
        name,
        pricePerFollower: markedUpPrice,
        min: Number(s.min) || 1,
        max: Number(s.max) || 1000000,
        average: s.average || s.avg_time || '-',
        desc,
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === 1 || s.refill === true || s.refill === '1'
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
    console.error('Error irvankede-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
}
