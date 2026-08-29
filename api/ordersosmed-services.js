// /api/ordersosmed-services.js
// Vercel Serverless Function - Proxy ke OrderSosmed API

export default async function handler(req, res) {
  // ===== CORS =====
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
    // ===== AMBIL ENV =====
    const apiId = parseInt(process.env.ORDER_API_ID) || 11313;
    const apiKey = process.env.ORDER_API_KEY || '23941803d5391da4e45a1bf4ebca52064fa17a53574d1c3655a0173dd7530fb1';
    const secretKey = process.env.ORDER_SECRET_KEY || 'Alvino11';

    if (!apiKey || !secretKey) {
      console.error('ORDER_API_KEY atau ORDER_SECRET_KEY tidak ditemukan');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API tidak lengkap'
      });
    }

    // ===== PROXY KE ORDERSOSMED =====
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://ordersosmed.id/api-1/service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ShineShop/1.0'
      },
      body: JSON.stringify({
        api_id: apiId,
        api_key: apiKey,
        secret_key: secretKey
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('OrderSosmed API HTTP error:', response.status);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${response.status})`
      });
    }

    const raw = await response.json();

    // ===== VALIDASI RESPONSE =====
    // Response format: { response: true, data: [...] } atau { response: false, data: { msg: "..." } }
    if (!raw || raw.response !== true || !Array.isArray(raw.data)) {
      console.error('OrderSosmed response invalid:', raw);
      return res.status(502).json({
        status: false,
        msg: raw?.data?.msg || 'Respon provider tidak valid'
      });
    }

    if (raw.data.length === 0) {
      return res.status(200).json({});
    }

    // ===== PROSES DATA =====
    const grouped = {};
    const MARKUP = 1.06; // +6%

    for (const s of raw.data) {
      // Skip kalo tidak ada category_name
      const category = (s.category_name || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      // Deteksi tipe komentar dari field 'type'
      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply' ||
        type === 'custom comments' ||
        type === 'mentions custom list' ||
        type === 'mentions hashtag' ||
        type === 'mentions user followers' ||
        type === 'mentions media likers' ||
        type === 'poll' ||
        type === 'comment replies';

      const rawPrice = Number(s.price) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      grouped[category].push({
        id: s.id,
        name: s.service_name || s.name || `Service #${s.id}`,
        pricePerFollower: markedUpPrice,
        min: Number(s.min) || 1,
        max: Number(s.max) || 1000000,
        average: '-',
        desc: s.description || s.note || '',
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === true || s.refill === 1 || s.refill === 'true',
        category: s.category_name || category,
        category_id: s.category_id || null
      });
    }

    // ===== URUTKAN KATEGORI & LAYANAN =====
    const sorted = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .forEach((cat) => {
        sorted[cat] = grouped[cat].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'id')
        );
      });

    // ===== CACHE =====
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json(sorted);

  } catch (error) {
    console.error('Error ordersosmed-services:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        status: false,
        msg: 'Provider timeout (15 detik)'
      });
    }

    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}
